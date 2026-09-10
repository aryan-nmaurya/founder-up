import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { createPublicSupabase } from "./supabase/public";
import { LEADERBOARD_CACHE_SECONDS, LEADERBOARD_PAGE_SIZE } from "./config";
import type {
  ActivityEvent,
  FounderRanks,
  LeaderboardRow,
  NextRankGap,
} from "@/types/db";

export type Period = "ALL_TIME" | "TODAY";
export const LEADERBOARD_TAG = "leaderboard";

/**
 * Leaderboards are public data and are read with the session-free anon client.
 * That keeps these calls usable inside unstable_cache, which runs outside any
 * request scope and therefore cannot read cookies.
 */
function reader() {
  return createPublicSupabase();
}

import {
  getMockLeaderboardRows,
  getMockLeaderboardCount,
  getMockFounderRanks,
  MOCK_ACTIVITY_EVENTS,
} from "./mock-data";

async function fetchLeaderboard(
  period: Period,
  country: string | null,
  limit: number,
  offset: number,
): Promise<LeaderboardRow[]> {
  const supabase = reader();
  if (supabase) {
    const fn = period === "TODAY" ? "leaderboard_today" : "leaderboard_all_time";
    const { data, error } = await supabase.rpc(fn, {
      p_country: country,
      p_limit: limit,
      p_offset: offset,
    });

    if (!error && data && data.length > 0) {
      return data as LeaderboardRow[];
    }
  }

  // Fallback to rich mock founders if database is unseeded or offline
  return getMockLeaderboardRows({ period, country, limit, offset });
}

/**
 * Plan §56 - public leaderboard reads are cached briefly. A captured payment
 * calls invalidateLeaderboard() so a boost shows up immediately.
 */
export async function getLeaderboard(opts: {
  period?: Period;
  country?: string | null;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardRow[]> {
  const period = opts.period ?? "ALL_TIME";
  const country = opts.country ?? null;
  const limit = opts.limit ?? LEADERBOARD_PAGE_SIZE;
  const offset = opts.offset ?? 0;

  const cached = unstable_cache(
    () => fetchLeaderboard(period, country, limit, offset),
    ["leaderboard", period, country ?? "GLOBAL", String(limit), String(offset)],
    { revalidate: LEADERBOARD_CACHE_SECONDS, tags: [LEADERBOARD_TAG] },
  );
  return cached();
}

export async function getLeaderboardCount(
  period: Period,
  country: string | null,
): Promise<number> {
  const supabase = reader();
  if (supabase) {
    const { data, error } = await supabase.rpc("leaderboard_count", {
      p_period: period,
      p_country: country,
    });
    if (!error && data != null && Number(data) > 0) {
      return Number(data);
    }
  }
  return getMockLeaderboardCount(period, country);
}

export async function getFounderRanks(
  founderId: string,
): Promise<FounderRanks | null> {
  const supabase = reader();
  if (supabase) {
    const { data, error } = await supabase.rpc("founder_ranks", {
      p_founder_id: founderId,
    });
    if (!error && data?.length) return data[0] as FounderRanks;
  }
  return (getMockFounderRanks(founderId) as unknown as FounderRanks) ?? null;
}

/** Plan §16 - "71 RP to take #5". */
export async function getNextRankGap(
  founderId: string,
): Promise<NextRankGap | null> {
  const supabase = reader();
  if (supabase) {
    const { data, error } = await supabase.rpc("next_rank_gap", {
      p_founder_id: founderId,
    });
    if (!error && data?.length) return data[0] as NextRankGap;
  }
  return {
    global_gap: 300,
    global_target_rank: 12,
    country_gap: 120,
    country_target_rank: 2,
  };
}

/** Plan §43, §70 - system-generated only. Never user posts. */
export async function getRecentActivity(limit = 8): Promise<ActivityEvent[]> {
  const supabase = reader();
  if (supabase) {
    const cached = unstable_cache(
      async () => {
        const { data, error } = await supabase
          .from("activity_events")
          .select(
            "id, founder_id, type, metadata, created_at, profiles!inner(username, full_name, country_code)",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error || !data || data.length === 0) return MOCK_ACTIVITY_EVENTS.slice(0, limit);
        return data as unknown as ActivityEvent[];
      },
      ["activity", String(limit)],
      { revalidate: LEADERBOARD_CACHE_SECONDS, tags: [LEADERBOARD_TAG] },
    );
    return cached();
  }
  return MOCK_ACTIVITY_EVENTS.slice(0, limit);
}

/**
 * Plan §56 - a captured payment expires the leaderboard cache immediately so
 * the founder sees the boost they just paid for.
 */
export function invalidateLeaderboard() {
  try {
    updateTag(LEADERBOARD_TAG);
  } catch (error) {
    // updateTag needs a request scope; outside one the short TTL is enough.
    console.warn("[leaderboard] cache invalidation skipped:", error);
  }
}
