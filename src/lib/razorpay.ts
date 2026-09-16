import "server-only";
import crypto from "node:crypto";
import type { Currency } from "./config";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

export function razorpayKeyId(): string {
  return KEY_ID;
}

/**
 * The E2E suite points the server at a stand-in Razorpay. The override only
 * takes effect with test-mode keys, so a live deployment can never be told to
 * trust anything other than Razorpay itself.
 */
function apiBase(): string {
  const override = process.env.RAZORPAY_API_BASE_URL?.replace(/\/+$/, "");
  if (!override) return RAZORPAY_API;
  if (!KEY_ID.startsWith("rzp_test_")) {
    console.error("[razorpay] RAZORPAY_API_BASE_URL ignored: it only applies to rzp_test_ keys");
    return RAZORPAY_API;
  }
  return override;
}

/** A failed Razorpay API call, carrying Razorpay's own description. */
export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function razorpay<T>(path: string, post?: { body: unknown }): Promise<T> {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay keys are not configured");
  }

  const response = await fetch(`${apiBase()}${path}`, {
    method: post ? "POST" : "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
      ...(post ? { "content-type": "application/json" } : {}),
    },
    body: post ? JSON.stringify(post.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { error?: { code?: string; description?: string } } | null)?.error;
    throw new RazorpayError(
      detail?.description ?? `Razorpay responded with HTTP ${response.status}`,
      response.status,
      detail?.code ?? null,
    );
  }
  return data as T;
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
  const order = await razorpay<{
    id: string;
    amount: number | string;
    currency: string;
    receipt?: string;
  }>("/orders", {
    body: {
      amount: params.amountSubunit,
      currency: params.currency,
      receipt: params.boostOrderId,
      notes: {
        founder_id: params.founderId,
        boost_order_id: params.boostOrderId,
        product: "founderup_rank_boost",
      },
    },
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
  };
}

/** Razorpay's payment entity - only the fields FounderUp reads. */
export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number | string;
  currency: string;
  base_amount?: number | string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
};

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
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
