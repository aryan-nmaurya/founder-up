import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { baseAmountSubunit } from "./razorpay";
import { invalidateLeaderboard } from "./ranking";

export type RazorpayPaymentEntity = {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  base_amount?: number;
  status?: string;
};

export type RazorpayWebhook = {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: { id: string } };
    refund?: { entity?: { payment_id?: string } };
  };
};

export type ProcessResult = {
  status: "PROCESSED" | "IGNORED";
  detail?: string;
  data?: unknown;
};

/**
 * Plan §21, §22, §23 - the one place a Razorpay event turns into Rank Points.
 *
 * Shared by the live webhook route and the admin retry button, so a replay
 * behaves identically to the original delivery. Safe to call repeatedly:
 * award_rank_points and revoke_rank_points are both idempotent.
 */
export async function processRazorpayEvent(
  event: RazorpayWebhook,
  supabase: SupabaseClient,
): Promise<ProcessResult> {
  const payment = event.payload?.payment?.entity;

  switch (event.event) {
    case "order.paid":
    case "payment.captured": {
      if (!payment?.id || !payment.order_id) {
        return { status: "IGNORED", detail: "missing payment or order id" };
      }
      const { data, error } = await supabase.rpc("award_rank_points", {
        p_razorpay_payment_id: payment.id,
        p_razorpay_order_id: payment.order_id,
        p_currency: payment.currency,
        p_amount_subunit: Number(payment.amount),
        p_base_amount_subunit: baseAmountSubunit(payment),
        p_captured_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      invalidateLeaderboard();
      return { status: "PROCESSED", data };
    }

    // FounderUp does not offer refunds, but a bank or Razorpay can still force
    // one. When the money goes, the points go with it.
    case "refund.processed":
    case "payment.refunded": {
      const paymentId = payment?.id ?? event.payload?.refund?.entity?.payment_id;
      if (!paymentId) return { status: "IGNORED", detail: "missing payment id" };

      const { data, error } = await supabase.rpc("revoke_rank_points", {
        p_razorpay_payment_id: paymentId,
        p_type: "REFUND",
        p_reason: `Razorpay ${event.event}`,
      });
      if (error) throw new Error(error.message);
      invalidateLeaderboard();
      return { status: "PROCESSED", data };
    }

    case "payment.dispute.created":
    case "payment.dispute.lost": {
      if (!payment?.id) return { status: "IGNORED", detail: "missing payment id" };
      const { data, error } = await supabase.rpc("revoke_rank_points", {
        p_razorpay_payment_id: payment.id,
        p_type: "CHARGEBACK",
        p_reason: `Razorpay ${event.event}`,
      });
      if (error) throw new Error(error.message);
      invalidateLeaderboard();
      return { status: "PROCESSED", data };
    }

    case "payment.failed": {
      if (payment?.order_id) {
        await supabase
          .from("boost_orders")
          .update({ status: "FAILED" })
          .eq("razorpay_order_id", payment.order_id)
          .eq("status", "CREATED");
      }
      return { status: "PROCESSED" };
    }

    default:
      return { status: "IGNORED", detail: `unhandled event ${event.event}` };
  }
}
