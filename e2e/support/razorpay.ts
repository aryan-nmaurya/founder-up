import crypto from "node:crypto";
import type { Page } from "@playwright/test";
import { RAZORPAY } from "./env";

export type CheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type MockPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

type MockOrder = { id: string; amount: number; currency: string; receipt: string };

/** What the page handed to Razorpay Checkout. */
export type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  prefill: { name?: string; email?: string };
};

type CheckoutWindow = Window & {
  __checkout?: CheckoutOptions & {
    handler: (response: CheckoutResponse) => void;
    modal: { ondismiss: () => void };
  };
};

async function control<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RAZORPAY.mockUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Razorpay stand-in ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** The customer's side of Razorpay: paying, and what happens afterwards. */
export const razorpayMock = {
  pay: (orderId: string, status: "captured" | "authorized" = "captured") =>
    control<{ checkout: CheckoutResponse; payment: MockPayment }>("/__control/pay", {
      order_id: orderId,
      status,
    }),
  setPaymentStatus: (paymentId: string, status: "captured" | "failed") =>
    control<MockPayment>(`/__control/payments/${paymentId}`, { status }),
  failNextPaymentFetches: (count = 1) =>
    control("/__control/fail-payment-fetches", { count }),
  orders: () => control<MockOrder[]>("/__control/orders"),
};

/**
 * Stands in for checkout.js in the browser. Opening Checkout records what the
 * page asked for instead of showing Razorpay's UI; the spec then decides how
 * the customer's payment goes.
 */
export async function installFakeCheckout(page: Page) {
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Razorpay = function (options) {
        return { open: function () { window.__checkout = options; } };
      };`,
    }),
  );
}

export async function waitForCheckoutScript(page: Page) {
  await page.waitForFunction(() => typeof window.Razorpay === "function");
}

export async function openedCheckout(page: Page): Promise<CheckoutOptions> {
  await page.waitForFunction(() => Boolean((window as CheckoutWindow).__checkout));
  return page.evaluate(() => {
    const options = (window as CheckoutWindow).__checkout!;
    return {
      key: options.key,
      order_id: options.order_id,
      amount: options.amount,
      currency: options.currency,
      prefill: options.prefill,
    };
  });
}

/** Razorpay calling the page back after it has taken the money. */
export async function completeCheckout(page: Page, response: CheckoutResponse) {
  await page.evaluate((r) => (window as CheckoutWindow).__checkout!.handler(r), response);
}

/** The customer closing Checkout without paying. */
export async function dismissCheckout(page: Page) {
  await page.evaluate(() => (window as CheckoutWindow).__checkout!.modal.ondismiss());
}

/** A webhook delivery signed exactly as Razorpay signs one. */
export function signedWebhook(event: string, payment: MockPayment) {
  const body = JSON.stringify({ event, payload: { payment: { entity: payment } } });
  const signature = crypto
    .createHmac("sha256", RAZORPAY.webhookSecret)
    .update(body)
    .digest("hex");
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": `evt_${payment.id}`,
    },
  };
}
