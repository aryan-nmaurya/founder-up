import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import type { FounderRanks, NextRankGap, Profile } from "@/types/db";
import { countryName, flagFor } from "@/lib/countries";
import { formatPoints, formatRank } from "@/lib/format";

export function HeroSection({
  profile,
  ranks,
  gap,
}: {
  profile: Profile | null;
  ranks: FounderRanks | null;
  gap: NextRankGap | null;
}) {
  return (
    <section className="pt-3 pb-2 sm:pt-6 sm:pb-4 text-center">
      {/* Direct, competitive headline */}
      <h1 className="text-[34px] font-extrabold tracking-tight text-fg sm:text-[46px] md:text-[50px] leading-[1.12]">
        Who&apos;s the <span className="text-accent underline decoration-accent/30 underline-offset-4">#1 founder</span> today?
      </h1>

      {/* Subtitle */}
      <p className="mx-auto mt-3 max-w-xl text-[15px] sm:text-[17px] font-medium text-muted">
        Show what you&apos;re building. Climb the leaderboard. Get discovered.
      </p>

      <div className="mx-auto mt-6 max-w-lg">
        {profile ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-subtle/60 p-3 sm:px-4 sm:py-3 shadow-xs">
            <div className="text-center sm:text-left">
              <p className="text-[13px] font-semibold text-fg">
                {ranks ? (
                  ranks.is_ranked ? (
                    <>
                      You&apos;re <span className="text-accent">{formatRank(ranks.country_rank)}</span>{" "}
                      in {flagFor(profile.country_code)} {countryName(profile.country_code)}
                    </>
                  ) : (
                    "Your profile is live and currently Unranked"
                  )
                ) : (
                  "Your current rank is unavailable"
                )}
              </p>
              <p className="text-[12px] text-muted">
                {ranks?.is_ranked && gap?.global_gap && gap.global_target_rank
                  ? `${formatPoints(gap.global_gap)} RP to take estimated #${gap.global_target_rank} globally`
                  : ranks?.is_ranked
                    ? "Add Rank Points to strengthen your position"
                    : ranks
                      ? "Boost from your dashboard to enter the leaderboard"
                      : "Check your dashboard again in a moment"}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-fg px-4 text-[13px] font-semibold text-white hover:bg-black transition-all shadow-xs shrink-0"
            >
              <span>{ranks?.is_ranked ? "Climb ↑" : "View dashboard"}</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/join"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-fg px-6 text-[14px] font-semibold text-white hover:bg-black transition-all shadow-sm hover:shadow"
            >
              <span>Join FounderUp</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#leaderboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-5 text-[14px] font-semibold text-fg hover:border-border-strong hover:bg-surface transition-all shadow-2xs"
            >
              <TrendingUp className="h-4 w-4 text-accent" />
              <span>Explore ranks</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
