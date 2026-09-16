import { expect, test } from "@playwright/test";
import { APP_URL } from "./support/env";
import { admin, createFounder, signInBrowser, uniqueName } from "./support/supabase";

test("a public profile page carries no private fields (blocker 4)", async ({ request }) => {
  const founder = await createFounder({ country: "PT" });

  const res = await request.get(`/${founder.username}`);
  expect(res.ok()).toBe(true);
  const html = await res.text();

  expect(html).toContain(founder.fullName);
  // auth_user_id is the auth user's id; nothing on a public page may carry it.
  expect(html).not.toContain(founder.id);
  expect(html).not.toContain("auth_user_id");
  expect(html).not.toContain("is_admin");
});

test("profile views reach the founder's own dashboard (blocker 5)", async ({ browser, page }) => {
  const founder = await createFounder({ country: "UY" });

  // A visitor in a separate browser, as a stranger would be.
  const visitorContext = await browser.newContext({ baseURL: APP_URL });
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/${founder.username}`);
  await expect(visitor.getByRole("heading", { name: founder.fullName })).toBeVisible();
  await expect
    .poll(async () => {
      const { count } = await admin
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("founder_id", founder.founderId);
      return count;
    })
    .toBe(1);
  await visitorContext.close();

  await signInBrowser(page.context(), founder);
  await page.goto("/dashboard");
  const views = page.getByText("Profile views", { exact: true }).locator("..");
  await expect(views).toContainText("1");
});

test("a founder edits their profile and the public page shows it", async ({ page }) => {
  const founder = await createFounder({ country: "CL" });
  await signInBrowser(page.context(), founder);

  await page.goto("/settings/profile");
  await page.getByLabel("Headline").fill("Shipping every single week");
  await page.getByLabel("Website").fill("clfounder.dev");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.goto(`/${founder.username}`);
  await expect(page.getByText("Shipping every single week")).toBeVisible();
  // The app normalises the link before the database's own check sees it.
  await expect(page.getByRole("link", { name: "clfounder.dev" }).first()).toHaveAttribute(
    "href",
    "https://clfounder.dev/",
  );
});

test("a failed profile save rolls back every field", async () => {
  const founder = await createFounder({ country: "CH" });
  const attemptedUsername = uniqueName("atomic");

  const { error } = await founder.client.rpc("update_founder_profile", {
    p_username: attemptedUsername,
    p_country_code: founder.countryCode,
    p_full_name: founder.fullName,
    p_avatar_url: null,
    p_headline: "This must roll back",
    p_bio: null,
    p_website_url: "javascript:alert(1)",
    p_x_url: null,
    p_linkedin_url: null,
    p_github_url: null,
    p_contact_type: "WEBSITE",
    p_contact_value: null,
  });
  expect(error?.message).toMatch(/profiles_website_url_http/);

  const { data: profile } = await admin
    .from("profiles")
    .select("username, headline")
    .eq("id", founder.founderId)
    .single();
  expect(profile).toMatchObject({
    username: founder.username,
    headline: "Building in public",
  });
});
