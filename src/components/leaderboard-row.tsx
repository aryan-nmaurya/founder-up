import Link from "next/link";
import { flagFor } from "@/lib/countries";
import { formatPoints, displayUrl } from "@/lib/format";
import { FounderAvatar } from "./founder-avatar";
import { ArrowUp, Sparkles } from "lucide-react";
import type { ExtendedLeaderboardRow } from "@/lib/mock-data";
import type { LeaderboardRow as DbRow } from "@/types/db";

interface LeaderboardRowProps {
  row: DbRow | ExtendedLeaderboardRow;
  index?: number;
}

export function LeaderboardRow({ row }: LeaderboardRowProps) {
  const extended = row as ExtendedLeaderboardRow;
  const movement = extended.rank_change_today;

  return (
    <li className="group list-none">
      <Link
        href={`/${row.username}`}
        className="block relative rounded-2xl border border-border bg-white px-4 py-4 sm:px-6 sm:py-5 transition-all duration-150 hover:border-border-strong hover:bg-[#FAF8F5] hover:shadow-sm"
      >
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Rank Number */}
          <div className="w-9 sm:w-11 shrink-0 text-left">
            <span className="text-[17px] sm:text-[20px] font-bold text-fg/80 tabular tracking-tight">
              #{row.rank}
            </span>
          </div>

          {/* Avatar */}
          <div className="shrink-0 relative">
            <FounderAvatar
              src={row.avatar_url}
              name={row.full_name}
              size={46}
              className="ring-2 ring-border group-hover:ring-accent/30 transition-all"
            />
          </div>

          {/* Founder Details & Headline */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="truncate text-[15px] sm:text-[16px] font-bold text-fg group-hover:text-accent transition-colors">
                {row.full_name}
              </span>
              <span
                aria-label={row.country_code}
                className="shrink-0 text-[14px] leading-none"
                title={row.country_code}
              >
                {flagFor(row.country_code)}
              </span>

              {row.is_verified ? (
                <span
                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent/10 text-accent text-[10px] font-bold"
                  title="Verified founder"
                >
                  ✓
                </span>
              ) : null}

              {extended.is_founding_50 ? (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-surface-subtle border border-border px-2 py-0.5 text-[10px] font-semibold text-muted">
                  <Sparkles className="h-2.5 w-2.5 text-accent" />
                  Founding 50
                </span>
              ) : null}
            </div>

            {/* One-line headline */}
            {row.headline ? (
              <p className="mt-0.5 truncate text-[13px] sm:text-[14px] text-muted font-medium">
                {row.headline}
              </p>
            ) : null}

            {/* Primary Project/Business badge */}
            {row.venture_name ? (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-fg max-w-[240px] truncate">
                  <span className="text-accent font-bold">⚡</span>
                  <span className="truncate font-semibold">{row.venture_name}</span>
                  {row.venture_url ? (
                    <span className="text-subtle font-normal">· {displayUrl(row.venture_url)}</span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          {/* Right: Rank Points & Movement */}
          <div className="shrink-0 text-right">
            <div className="text-[16px] sm:text-[18px] font-extrabold text-fg tabular tracking-tight">
              {formatPoints(row.points)}
              <span className="ml-1 text-[12px] font-semibold text-subtle">RP</span>
            </div>

            {movement !== undefined && movement !== null && movement > 0 ? (
              <div className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-positive tabular">
                <ArrowUp className="h-3 w-3" />
                <span>{movement} today</span>
              </div>
            ) : movement !== undefined && movement === 0 ? (
              <div className="mt-0.5 text-[11px] font-medium text-subtle">
                steady
              </div>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
