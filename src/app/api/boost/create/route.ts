import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { boostRequestSchema, firstError } from "@/lib/validation";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyId,
} from "@/lib/razorpay";
import { clientKey, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Plan §18 - create the order server-side.
 *
 * The founder id comes from the session, never from the request body, and the
 * amount is re-validated against the currency minimum before Razorpay sees it.
 * The body does name the profile the dialog thinks it is boosting, but only so
 * a mismatch can be refused.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Sign in to boost your rank." }, { status: 401 });
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: "This profile is suspended." }, { status: 403 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this deployment yet." },
      { status: 503 },
    );
  }

  const limit = rateLimit(
    `boost:${profile.id}`,
    RATE_LIMITS.boostCreate.limit,
    RATE_LIMITS.boostCreate.window,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many boost attempts. Try again in a few minutes." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }
  // Also cap per-IP so one machine can't cycle accounts.
  const ipLimit = rateLimit(
    await clientKey("boost-ip"),
    RATE_LIMITS.boostCreate.limit * 3,
    RATE_LIMITS.boostCreate.window,
  );
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = boostRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const { amount_subunit, currency, founder_id } = parsed.data;

  // Rank Points always go to the signed-in founder. If the dialog was showing
  // anyone else's profile, refuse rather than charge one account for a boost
  // meant for another.
  if (founder_id !== profile.id) {
    return NextResponse.json(
      { error: "You can only boost your own profile." },
      { status: 403 },
    );
  }

  const supabase = requireAdminSupabase();

  // Step 3 - our own order first, so an abandoned checkout is still visible.
  const { data: order, error: orderError } = await supabase
    .from("boost_orders")
    .insert({
      founder_id: profile.id,
      requested_amount: amount_subunit,
      requested_currency: currency,
      status: "CREATED",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[boost/create] could not create boost order:", orderError?.message);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  try {
    const razorpayOrder = await createRazorpayOrder({
      amountSubunit: amount_subunit,
      currency,
      founderId: profile.id,
      boostOrderId: order.id,
    });

    const { error: linkError } = await supabase
      .from("boost_orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id);
    // Unlinked, neither the callback nor the webhook could find this order, so
    // a payment would capture and award nothing. Never hand it to Checkout.
    if (linkError) {
      throw new Error(`could not link the Razorpay order: ${linkError.message}`);
    }

    return NextResponse.json({
      boost_order_id: order.id,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: razorpayKeyId(),
    });
  } catch (error) {
    await supabase.from("boost_orders").update({ status: "FAILED" }).eq("id", order.id);
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[boost/create] razorpay order failed:", message);

    // Plan §24 - a fresh account often can't take USD until international
    // payments are approved. Say so plainly rather than leaking gateway noise.
    if (currency === "USD" && /international|currency|not.*supported/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "International payments aren't enabled on this account yet. Try INR, or contact support.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
