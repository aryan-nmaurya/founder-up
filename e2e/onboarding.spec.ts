import { expect, test } from "@playwright/test";
import { stack } from "./support/env";
import { admin, uniqueName } from "./support/supabase";

/** The sign-in link Supabase emailed, read from the stack's Mailpit inbox. */
async function magicLinkFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${stack.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages.length > 0) {
      const res = await fetch(`${stack.mailpitUrl}/api/v1/message/${messages[0].ID}`);
      const message = (await res.json()) as { Text?: string; HTML?: string };
      const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`;
      const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

// The full first-run journey through the real auth flow: magic link, the
// /auth/callback code exchange, onboarding, the Early Founder number, the first
// venture, and the public profile. The review could not complete this at all.
test("a new founder signs in by email, onboards, and goes live", async ({ page }) => {
  const email = `${uniqueName("newbie")}@e2e.test`;
  const username = uniqueName("nova");

  await page.goto("/join");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Full name").fill("Nova Builder");
  await page.getByLabel("Country").selectOption("PE");
  await page.getByLabel("One line about you").fill("Building tools for makers");
  await page.getByRole("button", { name: "Continue" }).click();

  // The number is issued by the database; the page must show that number.
  await expect(page).toHaveURL(/\/onboarding\/building/);
  const { data: profile } = await admin
    .from("profiles")
    .select("founder_number, is_early_founder, is_ranked, country_code")
    .eq("username", username)
    .single();
  expect(profile).toMatchObject({ is_early_founder: true, is_ranked: true, country_code: "PE" });
  const badge = `Early Founder #${profile!.founder_number}`;
  await expect(page.getByText(badge)).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Nova Tools");
  await page.getByLabel("One line about it").fill("Tiny tools, shipped weekly");
  await page.getByLabel("Link").fill("novatools.dev");
  await page.getByRole("button", { name: "Publish my profile" }).click();

  await expect(page).toHaveURL(/\/dashboard\?welcome=1/);
  await expect(page.getByText(badge)).toBeVisible();
  await expect(page.getByText(/🌍 #\d+ Global/)).toBeVisible();

  await page.goto(`/${username}`);
  await expect(page.getByRole("heading", { name: "Nova Builder" })).toBeVisible();
  await expect(page.getByText("Nova Tools")).toBeVisible();
});
