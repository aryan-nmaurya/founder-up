#!/usr/bin/env node
// A stand-in for the two Razorpay endpoints FounderUp calls - create an order,
// fetch a payment - plus control routes the specs use to play the customer.
//
// The app only talks to this with rzp_test_ keys (see src/lib/razorpay.ts), and
// it checks the same Basic auth and signs checkout responses with the same key
// secret the real Razorpay would.
import crypto from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.RAZORPAY_MOCK_PORT ?? 3199);
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
if (!KEY_ID || !KEY_SECRET) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
const EXPECTED_AUTH = `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`;

const orders = new Map();
const payments = new Map();
let failPaymentFetches = 0;

const newId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString("hex")}`;
const now = () => Math.floor(Date.now() / 1000);

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function razorpayError(res, status, code, description) {
  send(res, status, { error: { code, description } });
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function razorpayApi(req, res, url) {
  if (req.headers.authorization !== EXPECTED_AUTH) {
    return razorpayError(res, 401, "BAD_REQUEST_ERROR", "Authentication failed");
  }

  if (req.method === "POST" && url.pathname === "/v1/orders") {
    const body = await readJson(req);
    const order = {
      id: newId("order"),
      entity: "order",
      amount: body.amount,
      amount_paid: 0,
      currency: body.currency,
      receipt: body.receipt,
      notes: body.notes ?? {},
      status: "created",
      created_at: now(),
    };
    orders.set(order.id, order);
    return send(res, 200, order);
  }

  const payment = url.pathname.match(/^\/v1\/payments\/([^/]+)$/);
  if (req.method === "GET" && payment) {
    if (failPaymentFetches > 0) {
      failPaymentFetches -= 1;
      return razorpayError(res, 500, "SERVER_ERROR", "Razorpay is unavailable (mock)");
    }
    const found = payments.get(decodeURIComponent(payment[1]));
    if (!found) return razorpayError(res, 400, "BAD_REQUEST_ERROR", "The id provided does not exist");
    return send(res, 200, found);
  }

  return razorpayError(res, 404, "BAD_REQUEST_ERROR", "Not a mocked endpoint");
}

async function control(req, res, url) {
  // The customer pays for an order. Returns what Checkout would hand the page.
  if (req.method === "POST" && url.pathname === "/__control/pay") {
    const { order_id, status = "captured" } = await readJson(req);
    const order = orders.get(order_id);
    if (!order) return send(res, 404, { error: "unknown order" });

    const payment = {
      id: newId("pay"),
      entity: "payment",
      order_id,
      amount: order.amount,
      currency: order.currency,
      status,
      method: "upi",
      // Razorpay reports the INR value of foreign-currency payments.
      ...(order.currency === "INR" ? {} : { base_amount: order.amount * 88 }),
      created_at: now(),
    };
    payments.set(payment.id, payment);

    const razorpay_signature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${order_id}|${payment.id}`)
      .digest("hex");
    return send(res, 200, {
      checkout: { razorpay_order_id: order_id, razorpay_payment_id: payment.id, razorpay_signature },
      payment,
    });
  }

  const update = url.pathname.match(/^\/__control\/payments\/([^/]+)$/);
  if (req.method === "POST" && update) {
    const found = payments.get(decodeURIComponent(update[1]));
    if (!found) return send(res, 404, { error: "unknown payment" });
    Object.assign(found, await readJson(req));
    return send(res, 200, found);
  }

  if (req.method === "POST" && url.pathname === "/__control/fail-payment-fetches") {
    failPaymentFetches = Number((await readJson(req)).count ?? 1);
    return send(res, 200, { failPaymentFetches });
  }

  if (req.method === "GET" && url.pathname === "/__control/orders") {
    return send(res, 200, [...orders.values()]);
  }

  return send(res, 404, { error: "not found" });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    try {
      if (url.pathname === "/__health") return send(res, 200, { ok: true });
      if (url.pathname.startsWith("/v1/")) return await razorpayApi(req, res, url);
      if (url.pathname.startsWith("/__control/")) return await control(req, res, url);
      return send(res, 404, { error: "not found" });
    } catch (error) {
      return send(res, 500, { error: String(error) });
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Razorpay stand-in listening on http://127.0.0.1:${PORT}`);
  });
