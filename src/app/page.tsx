import type { Metadata } from "next";
import { Leaderboard } from "@/components/leaderboard";
import { RegionSelector } from "@/components/region-selector";
import { TopThree } from "@/components/top-three";
import { ActivityFeed } from "@/components/activity-feed";
import { DailyReset } from "@/components/daily-reset";
import { HowItWorks } from "@/components/how-it-works";
import { HeroSection } from "@/components/hero-section";
import { EarlyFounderSpots } from "@/components/early-founder-spots";
import { TrackEvent } from "@/components/track-event";
import { Notice } from "@/components/ui/misc";
import {
  getFounderRanks,
  getCurrentLeader,
  getLeaderboard,
  getLeaderboardCount,
  getNextRankGap,
  getRecentActivity,
  type Period,
} from "@/lib/ranking";
import { getActiveCountries } from "@/lib/db";
import { getEarlyFounderStatus } from "@/lib/early-founder";
import { getCurrentProfile } from "@/lib/auth";
import { isValidCountry, countryName } from "@/lib/countries";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/config";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

type SearchParams = Promise<{
  period?: string;
  country?: string;
  limit?: string;
}>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const period: Period = params.period === "today" ? "TODAY" : "ALL_TIME";
  const country =
    params.country && isValidCountry(params.country)
      ? params.country.toUpperCase()
      : null;

  const requested = Number(params.limit);
  const limit = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : LEADERBOARD_PAGE_SIZE,
    5_000,
  );

  const [leaderboardRows, leaderboardTotal, activity, activeCountries, profile, earlyFounders, leader] =
    await Promise.all([
      getLeaderboard({ period, country, limit }),
      getLeaderboardCount(period, country),
      getRecentActivity(6),
      getActiveCountries(),
      getCurrentProfile(),
      getEarlyFounderStatus(),
      getCurrentLeader(period, country),
    ]);

  const [heroRanks, heroGap] = profile
    ? await Promise.all([getFounderRanks(profile.id), getNextRankGap(profile.id)])
    : [null, null];
  const leaderboardAvailable = leaderboardRows !== null && leaderboardTotal !== null;
  const rows = leaderboardRows ?? [];
  const total = leaderboardTotal ?? 0;

  const query = new URLSearchParams();
  if (period === "TODAY") query.set("period", "today");
  if (country) query.set("country", country);

  // Top 3 prestigious spotlight, followed by remaining leaderboard rows
  const podium = rows.length > 3 ? rows.slice(0, 3) : rows.slice(0, Math.min(rows.length, 3));
  const rest = rows.length > 3 ? rows.slice(3) : [];

  return (
    <div className="space-y-8 sm:space-y-10">
      <TrackEvent event="homepage_view" />

      {/* Main Competitive Hero */}
      <HeroSection profile={profile} ranks={heroRanks} gap={heroGap} />

      {/* Early Founder availability - counted in the database, not hardcoded. */}
      <EarlyFounderSpots status={earlyFounders} />

      {/* Leaderboard Section */}
      <section id="leaderboard" className="scroll-mt-6 space-y-4">
        {/* Horizontal Control Bar: Global, Searchable Country, and All-Time / Today */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3">
          <RegionSelector
            period={period}
            country={country}
            activeCountries={activeCountries}
          />
          {period === "TODAY" ? <DailyReset /> : null}
        </div>

        <h2 className="sr-only">
          {period === "TODAY" ? "Today's" : "All-time"} leaderboard
          {country ? ` for ${countryName(country)}` : " (global)"}
        </h2>

        {!leaderboardAvailable ? (
          <Notice tone="warning">
            The leaderboard couldn&apos;t be loaded right now. Please check again shortly.
          </Notice>
        ) : (
          <>
            {podium.length > 0 ? (
              <TopThree
                rows={podium}
                leadingSince={
                  leader && leader.founder_id === podium[0].id ? leader.started_at : null
                }
              />
            ) : null}

            {rest.length > 0 || podium.length === 0 ? (
              <Leaderboard
                rows={rest.length > 0 ? rest : rows}
                country={country}
                period={period}
                total={total}
                shown={rows.length}
                baseQuery={query.toString()}
              />
            ) : (
              <p className="text-center text-[12px] font-medium text-subtle tabular">
                Showing {rows.length} of {total} ranked founders
              </p>
            )}
          </>
        )}
      </section>

      {/* Live Activity Feed */}
      <ActivityFeed events={activity} />

      {/* How It Works & Transparency */}
      <HowItWorks />
    </div>
  );
}
