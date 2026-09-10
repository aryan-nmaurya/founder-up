import type { Metadata } from "next";
import { Leaderboard } from "@/components/leaderboard";
import { RegionSelector } from "@/components/region-selector";
import { TopThree } from "@/components/top-three";
import { ActivityFeed } from "@/components/activity-feed";
import { DailyReset } from "@/components/daily-reset";
import { HowItWorks } from "@/components/how-it-works";
import { HeroSection } from "@/components/hero-section";
import { Founding50Status } from "@/components/founding-50-status";
import { TrackEvent } from "@/components/track-event";
import {
  getLeaderboard,
  getLeaderboardCount,
  getRecentActivity,
  type Period,
} from "@/lib/ranking";
import { getActiveCountries } from "@/lib/db";
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
    100,
  );

  const [rows, total, activity, activeCountries, profile] = await Promise.all([
    getLeaderboard({ period, country, limit }),
    getLeaderboardCount(period, country),
    getRecentActivity(6),
    getActiveCountries(),
    getCurrentProfile(),
  ]);

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
      <HeroSection profile={profile} />

      {/* Tasteful Founding 50 Status Launch Banner */}
      <Founding50Status claimed={37} total={50} />

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

        {/* Top 3 Spotlight */}
        {podium.length > 0 && <TopThree rows={podium} />}

        {/* Rest of Leaderboard */}
        <Leaderboard
          rows={rest.length > 0 ? rest : (podium.length > 0 ? [] : rows)}
          country={country}
          period={period}
          total={total}
          shown={rows.length}
          baseQuery={query.toString()}
        />
      </section>

      {/* Live Activity Feed */}
      <ActivityFeed events={activity} />

      {/* How It Works & Transparency */}
      <HowItWorks />
    </div>
  );
}
