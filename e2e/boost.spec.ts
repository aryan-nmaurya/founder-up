import { expect, test, type Page } from "@playwright/test";
import { APP_URL, NO_PAYMENTS_URL } from "./support/env";
import {
  admin,
  awardPoints,
  createFounder,
  signInBrowser,
  totalRankPoints,
  type TestFounder,
} from "./support/supabase";
import {
  completeCheckout,
  dismissCheckout,
  installFakeCheckout,
  openedCheckout,
  razorpayMock,
  signedWebhook,
  waitForCheckoutScript,
} from "./support/razorpay";

// The money path, end to end: dashboard -> dialog -> /api/boost/create ->
// Checkout -> /api/boost/verify (and the webhook). Launch review blockers 1-3.
// Each test uses its own country so country ranks don't depend on test order.

test.beforeEach(async ({ page }) => {
  await installFakeCheckout(page);
});

async function openBoostDialog(page: Page, founder: TestFounder, baseUrl = APP_URL) {
  await signInBrowser(page.context(), founder);
  // Show rupee presets regardless of where the test machine is.
  await page.context().addCookies([{ name: "fu_currency", value: "INR", url: baseUrl }]);
  await page.goto(`${baseUrl}/dashboard`);
  await page.getByRole("button", { name: "Climb the leaderboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Climb the leaderboard" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function startPayment(page: Page, dialog: ReturnType<Page["getByRole"]>, preset = "₹100") {
  await dialog.getByRole("button", { name: preset, exact: true }).click();
  await waitForCheckoutScript(page);
  await dialog.getByRole("button", { name: /Continue to payment/ }).click();
  return openedCheckout(page);
}

const successHeading = /Boost Successful!|You moved up the ranks!/;

test.describe("boosting your own profile", () => {
  test("pays for exactly the chosen amount and shows the real result", async ({ page }) => {
    const rival = await createFounder({ country: "NZ" });
    await awardPoints(rival.founderId, 300);
    const me = await createFounder({ country: "NZ", name: "Nia Payer" });

    const dialog = await openBoostDialog(page, me);

    // Real standings and the real gap - not placeholder ranks (blocker 3).
    await expect(dialog.getByText("#2", { exact: false }).first()).toBeVisible();
    await dialog.getByRole("button", { name: "₹500", exact: true }).click();
    await expect(dialog).toContainText("Enough to reach #1 in New Zealand");

    const checkout = await startPayment(page, dialog, "₹500");
    // Prefilled with the payer's own details, not a placeholder (blocker 1).
    expect(checkout.prefill).toEqual({ name: "Nia Payer", email: me.email });
    expect(checkout.amount).toBe(50_000);

    const { checkout: paid } = await razorpayMock.pay(checkout.order_id);
    await completeCheckout(page, paid);

    await expect(dialog.getByRole("heading", { name: "You moved up the ranks!" })).toBeVisible();
    await expect(dialog).toContainText("+500 Rank Points added");
    expect(await totalRankPoints(me.founderId)).toBe(500);

    const { data: orders } = await admin
      .from("boost_orders")
      .select("founder_id, status")
      .eq("razorpay_order_id", checkout.order_id);
    expect(orders).toEqual([{ founder_id: me.founderId, status: "PAID" }]);
  });

  test("ends on success when the webhook got there first (blocker 2)", async ({ page, request }) => {
    const me = await createFounder({ country: "IS" });
    const dialog = await openBoostDialog(page, me);
    const checkout = await startPayment(page, dialog);

    const { checkout: paid, payment } = await razorpayMock.pay(checkout.order_id);
    // The usual race: Razorpay's webhook lands before the browser callback.
    const hook = signedWebhook("payment.captured", payment);
    const delivered = await request.post("/api/webhooks/razorpay", {
      data: hook.body,
      headers: hook.headers,
    });
    expect(delivered.ok()).toBe(true);

    await completeCheckout(page, paid);

    await expect(dialog.getByRole("heading", { name: successHeading })).toBeVisible();
    await expect(dialog).toContainText("+100 Rank Points added");
    await expect(dialog.getByRole("button", { name: /Continue to payment/ })).toHaveCount(0);
    // Awarded once, not once per path.
    expect(await totalRankPoints(me.founderId)).toBe(100);
  });

  test("never returns to the payment form while a payment is processing (blocker 2)", async ({ page }) => {
    const me = await createFounder({ country: "NO" });
    const dialog = await openBoostDialog(page, me);
    const checkout = await startPayment(page, dialog);

    const { checkout: paid, payment } = await razorpayMock.pay(checkout.order_id, "authorized");
    await completeCheckout(page, paid);

    await expect(
      dialog.getByRole("heading", { name: "Payment received, still processing" }),
    ).toBeVisible();
    await expect(dialog).toContainText("you don't need to pay again");
    await expect(dialog).toContainText(payment.id);
    await expect(dialog.getByRole("button", { name: /Continue to payment/ })).toHaveCount(0);
    expect(await totalRankPoints(me.founderId)).toBe(0);

    await razorpayMock.setPaymentStatus(payment.id, "captured");
    await dialog.getByRole("button", { name: "Check again" }).click();

    await expect(dialog.getByRole("heading", { name: successHeading })).toBeVisible();
    expect(await totalRankPoints(me.founderId)).toBe(100);
  });

  test("warns against paying twice when a payment can't be confirmed (blocker 2)", async ({ page, request }) => {
    const me = await createFounder({ country: "FI" });
    const dialog = await openBoostDialog(page, me);
    const checkout = await startPayment(page, dialog);

    const { checkout: paid, payment } = await razorpayMock.pay(checkout.order_id);
    await razorpayMock.failNextPaymentFetches(1);
    await completeCheckout(page, paid);

    await expect(
      dialog.getByRole("heading", { name: "We couldn't confirm your payment yet" }),
    ).toBeVisible();
    await expect(dialog).toContainText("Please don't pay again");
    await expect(dialog).toContainText(payment.id);
    await expect(dialog.getByRole("button", { name: /Continue to payment/ })).toHaveCount(0);

    // The webhook settles it in the meantime; checking again then confirms.
    const hook = signedWebhook("payment.captured", payment);
    expect((await request.post("/api/webhooks/razorpay", { data: hook.body, headers: hook.headers })).ok()).toBe(true);
    await dialog.getByRole("button", { name: "Check again" }).click();

    await expect(dialog.getByRole("heading", { name: successHeading })).toBeVisible();
    expect(await totalRankPoints(me.founderId)).toBe(100);
  });

  test("closing Checkout without paying returns to the form and charges nothing", async ({ page }) => {
    const me = await createFounder({ country: "EE" });
    const dialog = await openBoostDialog(page, me);
    const checkout = await startPayment(page, dialog);

    await dismissCheckout(page);

    await expect(dialog.getByRole("button", { name: "Continue to payment · ₹100" })).toBeEnabled();
    expect(await totalRankPoints(me.founderId)).toBe(0);
    const { data: order } = await admin
      .from("boost_orders")
      .select("status")
      .eq("razorpay_order_id", checkout.order_id)
      .single();
    expect(order?.status).toBe("CREATED");
  });
});

test.describe("boosting someone else (blocker 1)", () => {
  test("a visitor is pointed at their own profile, never offered this one's", async ({ page }) => {
    const owner = await createFounder({ country: "LT" });
    const visitor = await createFounder({ country: "LT" });

    await page.goto(`/${owner.username}`);
    await expect(page.getByRole("heading", { name: owner.fullName })).toBeVisible();
    await expect(page.getByRole("button", { name: /boost/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Get your own profile" })).toHaveAttribute("href", "/join");

    await signInBrowser(page.context(), visitor);
    await page.reload();
    await expect(page.getByRole("button", { name: /boost/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Boost your own rank" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  test("the order API refuses a boost aimed at anyone but the signed-in founder", async ({ page }) => {
    const owner = await createFounder({ country: "LV" });
    const visitor = await createFounder({ country: "LV" });
    await signInBrowser(page.context(), visitor);
    const ordersBefore = (await razorpayMock.orders()).length;

    const refused = await page.request.post("/api/boost/create", {
      data: { founder_id: owner.founderId, amount_subunit: 10_000, currency: "INR" },
    });
    expect(refused.status()).toBe(403);
    expect((await razorpayMock.orders()).length).toBe(ordersBefore);

    const { count } = await admin
      .from("boost_orders")
      .select("id", { count: "exact", head: true })
      .in("founder_id", [owner.founderId, visitor.founderId]);
    expect(count).toBe(0);

    const own = await page.request.post("/api/boost/create", {
      data: { founder_id: visitor.founderId, amount_subunit: 10_000, currency: "INR" },
    });
    expect(own.status()).toBe(200);
  });
});

test.describe("a deployment without Razorpay (blocker 3)", () => {
  test("takes no payment and invents no success", async ({ page }) => {
    const me = await createFounder({ country: "SI" });
    const dialog = await openBoostDialog(page, me, NO_PAYMENTS_URL);

    await expect(dialog.getByRole("status")).toContainText(
      "Checkout isn't available on this deployment",
    );
    await expect(dialog.getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
    // The estimate comes from real standings: alone in Slovenia is #1.
    await expect(dialog).toContainText("Adds to your lead at #1 in Slovenia");

    const res = await page.request.post(`${NO_PAYMENTS_URL}/api/boost/create`, {
      data: { founder_id: me.founderId, amount_subunit: 10_000, currency: "INR" },
    });
    expect(res.status()).toBe(503);
    await expect(dialog.getByRole("heading", { name: successHeading })).toHaveCount(0);
    expect(await totalRankPoints(me.founderId)).toBe(0);
  });
});
