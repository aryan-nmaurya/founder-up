import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Anonymous, session-free client for reading public data.
 *
 * Deliberately does not touch cookies, so it is safe inside `unstable_cache`
 * callbacks and in sitemap generation, both of which run outside a request
 * scope. RLS still applies - it just applies as `anon`.
 */
let cached: SupabaseClient | null = null;

export function createPublicSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  cached ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
