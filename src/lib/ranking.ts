import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { createPublicSupabase } from "./supabase/public";
import { LEADERBOARD_CACHE_SECONDS, LEADERBOARD_PAGE_SIZE } from "./config";
import { countryName } from "./countries";
import type {
  ActivityEvent,
  CurrentLeader,
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


async function fetchLeaderboard(
  period: Period,
  country: string | null,
  limit: number,
  offset: number,
): Promise<LeaderboardRow[] | null> {
  const supabase = reader();
  if (!supabase) return null;

  const fn = period === "TODAY" ? "leaderboard_today" : "leaderboard_all_time";
  const rows: LeaderboardRow[] = [];
  let remaining = limit;
  let cursor = offset;

  // The RPC deliberately caps one response at 100. Fetch larger requested
  // result sets in bounded pages so "Load more" never stalls at that boundary.
  while (remaining > 0) {
    const pageSize = Math.min(remaining, 100);
    const { data, error } = await supabase.rpc(fn, {
      p_country: country,
      p_limit: pageSize,
      p_offset: cursor,
    });
    if (error) {
      console.error(`[leaderboard] ${fn} failed:`, error.message);
      return null;
    }
    const page = (data ?? []) as LeaderboardRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    cursor += page.length;
    remaining -= page.length;
  }
  return rows;
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
}): Promise<LeaderboardRow[] | null> {
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
): Promise<number | null> {
  const supabase = reader();
  if (supabase) {
    const { data, error } = await supabase.rpc("leaderboard_count", {
      p_period: period,
      p_country: country,
    });
    if (error) console.error("[leaderboard] count failed:", error.message);
    else if (data != null) return Number(data);
  }
  return null;
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
  return null;
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
    if (error) console.error("[ranking] next_rank_gap failed:", error.message);
    else if (data?.length) return data[0] as NextRankGap;
  }
  // No gap beats an invented one: the boost dialog turns this into a claim
  // about rank, right next to a payment button.
  return null;
}

/**
 * The sitting #1 of a leaderboard view and when they took the spot. Cached and
 * invalidated with the leaderboard itself, so the two stay in step.
 */
export async function getCurrentLeader(
  period: Period,
  country: string | null,
): Promise<CurrentLeader | null> {
  const supabase = reader();
  if (!supabase) return null;
  const cached = unstable_cache(
    async () => {
      const { data, error } = await supabase.rpc("current_leader", {
        p_period: period,
        p_country: country,
      });
      if (error) {
        console.error("[leaderboard] current_leader failed:", error.message);
        return null;
      }
      return ((data ?? [])[0] as CurrentLeader | undefined) ?? null;
    },
    ["current-leader", period, country ?? "GLOBAL"],
    { revalidate: LEADERBOARD_CACHE_SECONDS, tags: [LEADERBOARD_TAG] },
  );
  return cached();
}

/**
 * When a founder holds an all-time #1 - globally, or failing that in their
 * country - what they hold and since when. Null for everyone else.
 */
export async function getLeadership(
  founderId: string,
  ranks: FounderRanks | null,
  countryCode: string,
): Promise<{ label: string; since: string } | null> {
  if (!ranks?.is_ranked) return null;
  const scope =
    ranks.global_rank === 1 ? null : ranks.country_rank === 1 ? countryCode : undefined;
  if (scope === undefined) return null;

  const leader = await getCurrentLeader("ALL_TIME", scope);
  if (!leader || leader.founder_id !== founderId) return null;
  return {
    label: scope ? `#1 in ${countryName(scope)}` : "#1 globally",
    since: leader.started_at,
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
        if (error) {
          console.error("[activity] failed:", error.message);
          return [];
        }
        return (data ?? []) as unknown as ActivityEvent[];
      },
      ["activity", String(limit)],
      { revalidate: LEADERBOARD_CACHE_SECONDS, tags: [LEADERBOARD_TAG] },
    );
    return cached();
  }
  return [];
}

/**
 * Plan §56 - a captured payment expires the leaderboard cache immediately so
 * the founder sees the boost they just paid for.
 */
export function invalidateLeaderboard() {
  try {
    // Server Actions: the next render waits for fresh data.
    updateTag(LEADERBOARD_TAG);
  } catch {
    try {
      // Route Handlers - the payment callback and the webhook - may not call
      // updateTag. expire: 0 gives the same "never serve stale" guarantee.
      revalidateTag(LEADERBOARD_TAG, { expire: 0 });
    } catch (error) {
      // Outside any request scope the short TTL is enough.
      console.warn("[leaderboard] cache invalidation skipped:", error);
    }
  }
}
