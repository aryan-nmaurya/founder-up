import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import type { Currency } from "./config";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export function isRazorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

export function razorpayKeyId(): string {
  return KEY_ID;
}

let client: Razorpay | null = null;
function instance(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay keys are not configured");
  }
  client ??= new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  return client;
}

export type CreatedOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | undefined;
};

/**
 * Plan §18 - the order is always created server-side so the amount that
 * Checkout sees is one we authored, not one the browser supplied.
 */
export async function createRazorpayOrder(params: {
  amountSubunit: number;
  currency: Currency;
  founderId: string;
  boostOrderId: string;
}): Promise<CreatedOrder> {
  const order = await instance().orders.create({
    amount: params.amountSubunit,
    currency: params.currency,
    receipt: params.boostOrderId,
    notes: {
      founder_id: params.founderId,
      boost_order_id: params.boostOrderId,
      product: "founderup_rank_boost",
    },
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
  };
}

export async function fetchRazorpayPayment(paymentId: string) {
  return instance().payments.fetch(paymentId);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Plan §20 - the browser callback signature. Genuine, but not authoritative:
 * the webhook is what actually awards points.
 */
export function verifyCheckoutSignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
    .digest("hex");
  return safeEqual(expected, params.razorpay_signature);
}

/** Plan §21 - webhook signature is checked against the raw request body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

export function isWebhookConfigured(): boolean {
  return Boolean(WEBHOOK_SECRET);
}

/**
 * Razorpay reports `base_amount` (in INR subunits) for non-INR payments.
 * INR payments have no base_amount, so the amount itself is the base.
 * Plan §3 - this is what stops currency arbitrage from moving the leaderboard.
 */
export function baseAmountSubunit(payment: {
  amount: number | string;
  currency: string;
  base_amount?: number | string | null;
}): number {
  const currency = String(payment.currency).toUpperCase();
  if (currency === "INR") return Number(payment.amount);
  if (payment.base_amount != null) return Number(payment.base_amount);
  return 0;
}

export function rankPointsFromBase(baseAmountInPaise: number): number {
  if (!Number.isFinite(baseAmountInPaise) || baseAmountInPaise <= 0) return 0;
  return Math.floor(baseAmountInPaise / 100);
}
