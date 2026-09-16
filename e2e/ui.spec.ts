import { expect, test } from "@playwright/test";
import { createFounder, signInBrowser } from "./support/supabase";

test("a one-founder country board does not render an empty state", async ({ page }) => {
  const founder = await createFounder({ country: "BD" });
  // The changing limit also gives this assertion a fresh leaderboard cache key
  // when the suite is rerun against a reused production build.
  const limit = 1_000 + (Date.now() % 3_000);
  await page.goto(`/?country=BD&limit=${limit}`);

  await expect(page.locator("#leaderboard").getByText(founder.fullName)).toBeVisible();
  await expect(page.getByText(/No ranked founders|No founders are ranked/)).toHaveCount(0);
  await expect(page.getByText("Showing 1 of 1 ranked founders")).toBeVisible();
});

test("the 375px layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  await expect(page.getByRole("link", { name: "Search founders" })).toBeVisible();
});

test("sign-in failures are explained", async ({ page }) => {
  await page.goto("/join?error=Access%20denied");
  await expect(page.getByText("Sign-in didn't complete. Please try again.")).toBeVisible();
});

test("the signed-in homepage uses the founder's real country and rank", async ({ page }) => {
  const founder = await createFounder({ country: "CA", name: "Casey North" });
  await signInBrowser(page.context(), founder);
  await page.goto("/");

  await expect(page.getByText(/You're #\d+ in 🇨🇦 Canada/)).toBeVisible();
  await expect(page.getByText(/#18 in India/)).toHaveCount(0);
});

test("an Early Founder welcome says they are already ranked", async ({ page }) => {
  const founder = await createFounder({ country: "NP" });
  await signInBrowser(page.context(), founder);
  await page.goto("/dashboard?welcome=1");

  await expect(page.getByText(/You’re on the leaderboard/)).toBeVisible();
  await expect(page.getByText(/Boost to enter the leaderboard/)).toHaveCount(0);
});

test("report dialog closes with Escape and returns focus", async ({ page }) => {
  const founder = await createFounder({ country: "DK" });
  await page.goto(`/${founder.username}`);
  const trigger = page.getByRole("button", { name: "Report profile" });
  await trigger.click();

  await expect(page.getByRole("dialog", { name: "Report profile" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Report profile" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
