import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, hasServiceRole } from "./env";

/**
 * Service-role client. Bypasses RLS, so it must only ever be reached from
 * server code that has already established who the caller is.
 *
 * Everything that touches Rank Points goes through here.
 */
let cached: SupabaseClient | null = null;

export function createAdminSupabase(): SupabaseClient | null {
  if (!hasServiceRole()) return null;
  cached ??= createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

export function requireAdminSupabase(): SupabaseClient {
  const client = createAdminSupabase();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Payment and ranking operations require it.",
    );
  }
  return client;
}
