import { expect, test } from "@playwright/test";
import { awardPoints, createFounder, signInBrowser } from "./support/supabase";
import { db } from "./support/db";

// Every board's #1 shows how long they have held the spot (migration 0009).
// The database opens a reign whenever #1 changes hands; these specs pin a
// reign's start so the time on screen is exact. Each uses its own country so
// the podium doesn't depend on test order.

async function backdateReign(
  founderId: string,
  board: "ALL_TIME" | "TODAY",
  scope: string,
  age: string,
) {
  const updated = await db`
    update public.leader_reigns
       set started_at = now() - ${age}::interval
     where founder_id = ${founderId} and board = ${board} and scope = ${scope}
       and ended_at is null
    returning id`;
  expect(updated, `a sitting ${board} reign in ${scope}`).toHaveLength(1);
}

test("the #1 on the podium shows how long they have led", async ({ page }) => {
  const leader = await createFounder({ country: "MT", name: "Marta Vella" });
  const chaser = await createFounder({ country: "MT" });
  await awardPoints(leader.founderId, 700);
  await awardPoints(chaser.founderId, 200);
  await backdateReign(leader.founderId, "ALL_TIME", "MT", "3 days 4 hours 5 minutes");

  await page.goto("/?country=MT");
  await expect(page.getByRole("link", { name: /Marta Vella/ }).first()).toContainText(
    "Leading for 3d 4h",
  );
});

test("taking #1 starts a fresh clock for the new leader", async ({ page }) => {
  const incumbent = await createFounder({ country: "BE", name: "Bram Peeters" });
  const challenger = await createFounder({ country: "BE", name: "Lotte Janssens" });
  await awardPoints(incumbent.founderId, 300);
  await backdateReign(incumbent.founderId, "ALL_TIME", "BE", "2 days");
  await awardPoints(challenger.founderId, 500);

  await page.goto("/?country=BE");
  // Seconds or minutes - not the two days the incumbent had.
  await expect(page.getByRole("link", { name: /Lotte Janssens/ }).first()).toContainText(
    /Leading for (\d+s|\d+m \d+s)/,
  );
});

test("the Today board keeps its own clock", async ({ page }) => {
  const founder = await createFounder({ country: "HR", name: "Ivana Horvat" });
  await awardPoints(founder.founderId, 250);
  await backdateReign(founder.founderId, "TODAY", "HR", "2 hours 10 minutes");

  await page.goto("/?period=today&country=HR");
  await expect(page.getByRole("link", { name: /Ivana Horvat/ }).first()).toContainText(
    "Leading for 2h 10m",
  );
});

test("a country #1 sees the lead time on their profile and dashboard", async ({ page }) => {
  // A bigger founder elsewhere keeps this one from also being #1 globally.
  const giant = await createFounder({ country: "AR" });
  await awardPoints(giant.founderId, 5_000);
  const founder = await createFounder({ country: "CY", name: "Eleni Georgiou" });
  await backdateReign(founder.founderId, "ALL_TIME", "CY", "5 days 6 hours");

  await page.goto(`/${founder.username}`);
  await expect(page.getByText("#1 in Cyprus for 5d 6h")).toBeVisible();

  await signInBrowser(page.context(), founder);
  await page.goto("/dashboard");
  await expect(page.getByText("#1 in Cyprus for 5d 6h")).toBeVisible();
});
