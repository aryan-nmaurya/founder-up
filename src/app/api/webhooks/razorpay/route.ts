import { NextResponse } from "next/server";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { isWebhookConfigured, verifyWebhookSignature } from "@/lib/razorpay";
import { processRazorpayEvent, type RazorpayWebhook } from "@/lib/webhooks";

export const runtime = "nodejs";
// The signature is computed over the exact bytes Razorpay sent.
export const dynamic = "force-dynamic";

/**
 * Plan §21 - the authoritative payment event.
 *
 * Idempotent by construction: award_rank_points is a no-op once a payment id
 * has been seen, so Razorpay retries cost nothing. Every delivery is recorded
 * so a failure is visible and retryable from /admin/webhooks.
 */
export async function POST(request: Request) {
  if (!isWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = requireAdminSupabase();
  const eventId = request.headers.get("x-razorpay-event-id");

  // Record first, so a throw still leaves something to inspect.
  const { data: stored, error: storeError } = await supabase
    .from("webhook_events")
    .upsert(
      {
        provider: "razorpay",
        event_id: eventId,
        event_type: event.event,
        payload: event as unknown as Record<string, unknown>,
        status: "PENDING",
      },
      { onConflict: "provider,event_id" },
    )
    .select("id")
    .maybeSingle();

  if (storeError) {
    console.error("[webhook] could not record event:", storeError.message);
  }
  const eventRowId = (stored as { id: string } | null)?.id ?? null;

  async function finish(status: string, error?: string) {
    if (!eventRowId) return;
    await supabase
      .from("webhook_events")
      .update({
        status,
        error: error ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRowId);
  }

  try {
    const result = await processRazorpayEvent(event, supabase);
    await finish(result.status, result.detail);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[webhook] processing failed:", message);
    await finish("FAILED", message);
    // A 500 asks Razorpay to retry, which is safe here.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
