import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicSupabase } from "./supabase/public";
import { EARLY_FOUNDER_LIMIT } from "./config";
import { LEADERBOARD_TAG } from "./ranking";

export type EarlyFounderStatus = {
  available: boolean;
  claimed: number;
  spots: number;
  remaining: number;
  allClaimed: boolean;
};

const FALLBACK: EarlyFounderStatus = {
  available: false,
  claimed: 0,
  spots: EARLY_FOUNDER_LIMIT,
  remaining: EARLY_FOUNDER_LIMIT,
  allClaimed: false,
};

/**
 * How many Early Founder spots are gone.
 *
 * Counted in the database from the number sequence, not from surviving
 * profiles: a deleted account never reopens its number, so counting live rows
 * would let the tally slide backwards.
 *
 * Cached with the leaderboard, so a completed onboarding refreshes it.
 */
export async function getEarlyFounderStatus(): Promise<EarlyFounderStatus> {
  const supabase = createPublicSupabase();
  if (!supabase) return FALLBACK;

  const cached = unstable_cache(
    async () => {
      const { data, error } = await supabase.rpc("early_founder_status");
      if (error || !data?.length) {
        if (error) console.error("[early-founder] status failed:", error.message);
        return FALLBACK;
      }
      const row = data[0] as {
        claimed: number;
        spots: number;
        remaining: number;
        all_claimed: boolean;
      };
      return {
        available: true,
        claimed: Number(row.claimed),
        spots: Number(row.spots),
        remaining: Number(row.remaining),
        allClaimed: Boolean(row.all_claimed),
      };
    },
    ["early-founder-status"],
    { revalidate: 20, tags: [LEADERBOARD_TAG] },
  );

  return cached();
}
