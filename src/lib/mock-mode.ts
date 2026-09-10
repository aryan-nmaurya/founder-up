import { isSupabaseConfigured } from "./supabase/env";

/**
 * Whether the demo fixtures in mock-data.ts may stand in for real records.
 *
 * This is deliberately opt-in. Falling back whenever a query returned zero rows
 * meant a healthy but empty production database served fabricated founders and
 * Rank Points on the public leaderboard — exactly what the plan forbids
 * (§68: never fabricate payments or ranks; trust is the product).
 *
 * Mocks are used only when:
 *   - Supabase is not configured at all (a fresh clone with no .env.local), or
 *   - NEXT_PUBLIC_USE_MOCK_DATA is explicitly "true" for design work.
 *
 * A configured database that legitimately has no founders yet renders the real
 * empty state instead.
 */
export function mockDataEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") return true;
  return !isSupabaseConfigured();
}
