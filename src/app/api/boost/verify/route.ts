import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validation";
import {
  baseAmountSubunit,
  fetchRazorpayPayment,
  verifyCheckoutSignature,
} from "@/lib/razorpay";
import { invalidateLeaderboard } from "@/lib/ranking";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { AwardResult } from "@/types/db";

/**
 * Plan §20 - the browser callback.
 *
 * The signature proves the callback is genuine, but the amounts still come from
 * Razorpay's own API, never from the browser. The webhook remains authoritative:
 * if this route fails, the webhook will award the points anyway.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const limit = rateLimit(
    `verify:${profile.id}`,
    RATE_LIMITS.boostVerify.limit,
    RATE_LIMITS.boostVerify.window,
  );
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = verifyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment details." }, { status: 400 });
  }

  if (!verifyCheckoutSignature(parsed.data)) {
    console.warn("[boost/verify] signature mismatch", {
      order: parsed.data.razorpay_order_id,
    });
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  const supabase = requireAdminSupabase();

  // The order must belong to the signed-in founder.
  const { data: order } = await supabase
    .from("boost_orders")
    .select("id, founder_id")
    .eq("razorpay_order_id", parsed.data.razorpay_order_id)
    .maybeSingle();

  if (!order || (order as { founder_id: string }).founder_id !== profile.id) {
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  }

  try {
    const payment = await fetchRazorpayPayment(parsed.data.razorpay_payment_id);

    if (payment.status !== "captured") {
      // Not an error: the webhook will finish the job once capture lands.
      return NextResponse.json({
        status: "PENDING",
        message: "Payment is still processing. Your points will appear shortly.",
      });
    }

    const { data, error } = await supabase.rpc("award_rank_points", {
      p_razorpay_payment_id: payment.id,
      p_razorpay_order_id: parsed.data.razorpay_order_id,
      p_currency: payment.currency,
      p_amount_subunit: Number(payment.amount),
      p_base_amount_subunit: baseAmountSubunit(payment),
      p_captured_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[boost/verify] award failed:", error.message);
      return NextResponse.json(
        { error: "Payment received, but ranking is still updating." },
        { status: 500 },
      );
    }

    const result = data as AwardResult;
    invalidateLeaderboard();

    if (result.status === "ALREADY_PROCESSED") {
      // The webhook beat the callback. Report success, not a duplicate.
      return NextResponse.json({ status: "ALREADY_PROCESSED", outcome: null });
    }

    return NextResponse.json({ status: result.status, outcome: result });
  } catch (error) {
    console.error("[boost/verify] failed:", error);
    return NextResponse.json(
      { error: "Could not confirm the payment right now." },
      { status: 502 },
    );
  }
}
