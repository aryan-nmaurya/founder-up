/**
 * Local development seed.
 *
 * Plan §68 is explicit: do not launch with fake founders, and never fabricate
 * payments or ranks on the real site. This script therefore refuses to run
 * against anything but a local Supabase unless you deliberately override it,
 * and everything it creates is obviously fake.
 *
 *   node scripts/seed-dev.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local - fall back to the ambient environment.
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(url);
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to seed a non-local Supabase (${url}).\n` +
      "FounderUp must not launch with fabricated founders or payments.\n" +
      "Set SEED_ALLOW_REMOTE=1 only if you truly know what you are doing.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Seed = {
  username: string;
  name: string;
  country: string;
  headline: string;
  ventures: { type: "PROJECT" | "BUSINESS"; name: string; description: string; url?: string }[];
  boosts: { currency: "INR" | "USD"; amount: number; base: number }[];
  admin?: boolean;
};

const FOUNDERS: Seed[] = [
  {
    username: "demo_alex",
    name: "Alex Morgan",
    country: "US",
    headline: "Building AI tools for developers.",
    ventures: [
      { type: "BUSINESS", name: "Acme AI", description: "AI development studio", url: "https://example.com" },
      { type: "PROJECT", name: "Promptbook", description: "Prompt versioning for teams" },
    ],
    boosts: [{ currency: "USD", amount: 5000, base: 440000 }],
  },
  {
    username: "demo_sarah",
    name: "Sarah Chen",
    country: "SG",
    headline: "Founder of DesignFlow.",
    ventures: [
      { type: "BUSINESS", name: "DesignFlow", description: "Design handoff, minus the meetings", url: "https://example.com" },
    ],
    boosts: [{ currency: "USD", amount: 2500, base: 220000 }],
  },
  {
    username: "demo_aryan",
    name: "Aryan Sharma",
    country: "IN",
    headline: "Building useful products on the internet.",
    ventures: [
      { type: "PROJECT", name: "FounderUp", description: "The leaderboard for founders", url: "https://example.com" },
      { type: "BUSINESS", name: "ABC Labs", description: "AI software company" },
    ],
    boosts: [
      { currency: "INR", amount: 100000, base: 100000 },
      { currency: "INR", amount: 50000, base: 50000 },
    ],
    admin: true,
  },
  {
    username: "demo_rahul",
    name: "Rahul Verma",
    country: "IN",
    headline: "Solo founder. Shipping weekly.",
    ventures: [{ type: "PROJECT", name: "Invoicely", description: "Invoicing for freelancers" }],
    boosts: [{ currency: "INR", amount: 25000, base: 25000 }],
  },
  {
    username: "demo_lena",
    name: "Lena Fischer",
    country: "DE",
    headline: "Climate hardware.",
    ventures: [{ type: "BUSINESS", name: "Kohlen", description: "Carbon capture for small industry" }],
    boosts: [{ currency: "USD", amount: 1000, base: 88000 }],
  },
  {
    username: "demo_priya",
    name: "Priya Nair",
    country: "IN",
    headline: "Health data infrastructure.",
    ventures: [{ type: "BUSINESS", name: "Vitals", description: "Interoperable health records" }],
    boosts: [{ currency: "INR", amount: 10000, base: 10000 }],
  },
  {
    username: "demo_tom",
    name: "Tom Okafor",
    country: "NG",
    headline: "Payments for African SMEs.",
    ventures: [{ type: "BUSINESS", name: "Kobo", description: "Collections and payouts" }],
    boosts: [],
  },
];

async function seed() {
  console.log(`Seeding ${url}\n`);

  for (const founder of FOUNDERS) {
    const email = `${founder.username}@founderup.test`;

    const { data: created, error: userError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password: "founderup-demo-password",
      });

    let userId = created?.user?.id;

    if (userError) {
      if (!/already/i.test(userError.message)) {
        console.error(`  ${founder.username}: ${userError.message}`);
        continue;
      }
      const { data: list } = await supabase.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === email)?.id;
    }
    if (!userId) {
      console.error(`  ${founder.username}: could not resolve user`);
      continue;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: userId,
          username: founder.username,
          full_name: founder.name,
          country_code: founder.country,
          headline: founder.headline,
          website_url: "https://example.com",
          contact_type: "WEBSITE",
          is_admin: Boolean(founder.admin),
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    if (profileError || !profile) {
      console.error(`  ${founder.username}: ${profileError?.message}`);
      continue;
    }

    const founderId = (profile as { id: string }).id;

    await supabase.from("ventures").delete().eq("founder_id", founderId);
    if (founder.ventures.length) {
      await supabase.from("ventures").insert(
        founder.ventures.map((venture, index) => ({
          founder_id: founderId,
          type: venture.type,
          name: venture.name,
          description: venture.description,
          url: venture.url ?? null,
          sort_order: index,
        })),
      );
    }

    for (const [index, boost] of founder.boosts.entries()) {
      const orderId = `order_seed_${founder.username}_${index}`;

      await supabase.from("boost_orders").upsert(
        {
          founder_id: founderId,
          requested_amount: boost.amount,
          requested_currency: boost.currency,
          razorpay_order_id: orderId,
          status: "CREATED",
        },
        { onConflict: "razorpay_order_id" },
      );

      const { data: result, error: awardError } = await supabase.rpc(
        "award_rank_points",
        {
          p_razorpay_payment_id: `pay_seed_${founder.username}_${index}`,
          p_razorpay_order_id: orderId,
          p_currency: boost.currency,
          p_amount_subunit: boost.amount,
          p_base_amount_subunit: boost.base,
          p_captured_at: new Date().toISOString(),
        },
      );

      if (awardError) console.error(`  boost failed: ${awardError.message}`);
      else if ((result as { status: string }).status === "AWARDED") {
        console.log(
          `  ${founder.username}: +${(result as { rank_points: number }).rank_points} RP`,
        );
      }
    }

    console.log(`✓ ${founder.username}${founder.admin ? " (admin)" : ""}`);
  }

  const { data: board } = await supabase.rpc("leaderboard_all_time", {
    p_country: null,
    p_limit: 10,
    p_offset: 0,
  });

  console.log("\nGlobal all-time:");
  for (const row of (board ?? []) as { rank: number; username: string; points: number }[]) {
    console.log(`  #${row.rank}  ${row.username.padEnd(14)} ${row.points} RP`);
  }

  console.log(
    "\nDemo sign-in: any demo_*@founderup.test / founderup-demo-password" +
      "\ndemo_aryan is an admin, so /admin is reachable.",
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
