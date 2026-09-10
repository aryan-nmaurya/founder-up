import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Session-scoped client. Every query made through this runs under the signed-in
 * user's RLS policies.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  // Read cookies before the config check. Touching cookies() is what marks a
  // route as dynamic, and an auth-dependent page must never be prerendered -
  // including on a build that has no credentials yet.
  const cookieStore = await cookies();
  if (!isSupabaseConfigured()) return null;

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}
