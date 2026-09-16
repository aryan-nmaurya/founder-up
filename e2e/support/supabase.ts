import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import { APP_URL, stack } from "./env";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service role: fixtures and assertions only, never what a user could do. */
export const admin = createClient(stack.apiUrl, stack.serviceRoleKey, noSession);

/** Exactly what anyone holding the public anon key can do. */
export function anonClient(): SupabaseClient {
  return createClient(stack.apiUrl, stack.anonKey, noSession);
}

let sequence = 0;
/** A username-safe identifier that is unique across runs. */
export function uniqueName(prefix: string): string {
  const suffix = `${Date.now().toString(36)}${(sequence++).toString(36)}`;
  return `${prefix}_${suffix}`.slice(0, 30);
}

const PASSWORD = "e2e-password-1";

export type TestUser = { id: string; email: string; password: string };

export async function createUser(): Promise<TestUser> {
  const email = `${uniqueName("user")}@e2e.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return { id: data.user.id, email, password: PASSWORD };
}

/** A client carrying the user's own session - what their browser can do. */
export async function userClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(stack.apiUrl, stack.anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`signInWithPassword: ${error.message}`);
  return client;
}

export type TestFounder = TestUser & {
  founderId: string;
  username: string;
  fullName: string;
  countryCode: string;
  client: SupabaseClient;
};

/** A user who has completed onboarding, through the RPC the app itself calls. */
export async function createFounder(
  opts: { country?: string; name?: string } = {},
): Promise<TestFounder> {
  const user = await createUser();
  const client = await userClient(user);
  const username = uniqueName("f");
  const fullName = opts.name ?? `Founder ${username.slice(-6)}`;
  const countryCode = opts.country ?? "IN";

  const { data, error } = await client.rpc("create_founder_profile", {
    p_username: username,
    p_full_name: fullName,
    p_country_code: countryCode,
    p_headline: "Building in public",
  });
  if (error) throw new Error(`create_founder_profile: ${error.message}`);

  return {
    ...user,
    founderId: (data as { id: string }).id,
    username,
    fullName,
    countryCode,
    client,
  };
}

/** Rank Points the way a real capture awards them: our order, then award_rank_points. */
export async function awardPoints(founderId: string, rupees: number) {
  const orderId = `order_${uniqueName("seed")}`;
  const { error: orderError } = await admin.from("boost_orders").insert({
    founder_id: founderId,
    requested_amount: rupees * 100,
    requested_currency: "INR",
    razorpay_order_id: orderId,
  });
  if (orderError) throw new Error(`boost_orders: ${orderError.message}`);

  const { data, error } = await admin.rpc("award_rank_points", {
    p_razorpay_payment_id: `pay_${orderId}`,
    p_razorpay_order_id: orderId,
    p_currency: "INR",
    p_amount_subunit: rupees * 100,
    p_base_amount_subunit: rupees * 100,
    p_captured_at: new Date().toISOString(),
  });
  if (error || (data as { status: string }).status !== "AWARDED") {
    throw new Error(`award_rank_points: ${error?.message ?? JSON.stringify(data)}`);
  }
}

export async function totalRankPoints(founderId: string): Promise<number> {
  const { data, error } = await admin
    .from("profiles")
    .select("total_rank_points")
    .eq("id", founderId)
    .single();
  if (error) throw new Error(error.message);
  return Number(data.total_rank_points);
}

/**
 * Signs the browser in with session cookies written by @supabase/ssr itself,
 * so the app sees exactly what a real sign-in leaves behind.
 */
export async function signInBrowser(context: BrowserContext, user: TestUser) {
  const jar = new Map<string, string>();
  const client = createServerClient(stack.apiUrl, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`signInWithPassword: ${error.message}`);
  if (jar.size === 0) throw new Error("@supabase/ssr wrote no session cookies");

  const { hostname } = new URL(APP_URL);
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      domain: hostname,
      path: "/",
      sameSite: "Lax" as const,
    })),
  );
}
