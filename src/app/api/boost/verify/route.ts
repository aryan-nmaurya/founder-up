import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validation";
import {
  baseAmountSubunit,
  fetchRazorpayPayment,
  verifyCheckoutSignature,
} from "@/lib/razorpay";
import { getFounderRanks, invalidateLeaderboard } from "@/lib/ranking";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { AwardResult, BoostOutcome, VerifyResponse } from "@/types/db";

function reply(body: VerifyResponse, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Plan §20 - the browser callback.
 *
 * The signature proves the callback is genuine, but the amounts still come from
 * Razorpay's own API, never from the browser. The webhook remains authoritative:
 * if this route fails, the webhook will award the points anyway.
 *
 * Checkout only calls this once it has taken the money, so the answer is always
 * explicit: CONFIRMED with an outcome, PENDING, or an error. Nothing else may
 * send the founder back to a payment form.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return reply({ error: "Not signed in." }, 401);
  }

  const limit = rateLimit(
    `verify:${profile.id}`,
    RATE_LIMITS.boostVerify.limit,
    RATE_LIMITS.boostVerify.window,
  );
  if (!limit.ok) {
    return reply({ error: "Too many requests." }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }

  const parsed = verifyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return reply({ error: "Invalid payment details." }, 400);
  }

  if (!verifyCheckoutSignature(parsed.data)) {
    console.warn("[boost/verify] signature mismatch", {
      order: parsed.data.razorpay_order_id,
    });
    return reply({ error: "Payment could not be verified." }, 400);
  }

  const supabase = requireAdminSupabase();

  // The order must belong to the signed-in founder.
  const { data: order } = await supabase
    .from("boost_orders")
    .select("id, founder_id")
    .eq("razorpay_order_id", parsed.data.razorpay_order_id)
    .maybeSingle();

  if (!order || (order as { founder_id: string }).founder_id !== profile.id) {
    return reply({ error: "Unknown order." }, 404);
  }

  try {
    const payment = await fetchRazorpayPayment(parsed.data.razorpay_payment_id);

    // The signature already binds these two ids; this checks Razorpay agrees.
    if (payment.order_id !== parsed.data.razorpay_order_id) {
      return reply({ error: "Payment does not match this order." }, 400);
    }

    if (payment.status === "created" || payment.status === "authorized") {
      // Not an error: the webhook finishes the job once capture lands.
      return reply(
        {
          status: "PENDING",
          message: "Payment is still processing. Your points will appear shortly.",
        },
        202,
      );
    }
    if (payment.status !== "captured") {
      return reply(
        {
          error:
            payment.status === "refunded"
              ? "This payment was refunded, so no Rank Points were added."
              : "This payment did not go through, so no Rank Points were added.",
        },
        402,
      );
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
      return reply({ error: "Payment received, but ranking is still updating." }, 500);
    }

    const result = data as AwardResult;

    if (result.status === "AWARDED") {
      invalidateLeaderboard();
      return reply({
        status: "CONFIRMED",
        outcome: {
          rank_points: Number(result.rank_points ?? 0),
          previous_global_rank: result.previous_global_rank,
          new_global_rank: result.new_global_rank,
          previous_country_rank: result.previous_country_rank,
          new_country_rank: result.new_country_rank,
        },
      });
    }

    if (result.status === "ALREADY_PROCESSED") {
      // Usually the webhook beating this callback - the common case, not an
      // error. Report what that earlier award did.
      const outcome = await processedOutcome(supabase, payment.id, profile.id);
      if (outcome) return reply({ status: "CONFIRMED", outcome });
      return reply({ error: "This payment has since been reversed." }, 409);
    }

    console.error("[boost/verify] award refused:", result.status);
    return reply({ error: "Could not confirm the payment right now." }, 500);
  } catch (error) {
    console.error("[boost/verify] failed:", error);
    return reply({ error: "Could not confirm the payment right now." }, 502);
  }
}

/** The outcome of a payment another path (normally the webhook) already awarded. */
async function processedOutcome(
  supabase: SupabaseClient,
  razorpayPaymentId: string,
  founderId: string,
): Promise<BoostOutcome | null> {
  const { data } = await supabase
    .from("payments")
    .select("founder_id, rank_points_awarded, status")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();

  const row = data as {
    founder_id: string;
    rank_points_awarded: number;
    status: string;
  } | null;
  if (!row || row.founder_id !== founderId || row.status !== "CAPTURED") return null;

  // Where the founder stood before is no longer known; where they stand now is.
  const ranks = await getFounderRanks(founderId);
  return {
    rank_points: Number(row.rank_points_awarded),
    previous_global_rank: null,
    new_global_rank: ranks?.global_rank ?? null,
    previous_country_rank: null,
    new_country_rank: ranks?.country_rank ?? null,
  };
}
