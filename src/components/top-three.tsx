import Link from "next/link";
import { flagFor } from "@/lib/countries";
import { formatPoints, displayUrl } from "@/lib/format";
import { FounderAvatar } from "./founder-avatar";
import { Clock, Flame } from "lucide-react";
import type { LeaderboardRow as DbRow } from "@/types/db";
import { EarlyFounderBadge } from "./early-founder-badge";

interface TopThreeProps {
  rows: DbRow[];
}

export function TopThree({ rows }: TopThreeProps) {
  if (!rows || rows.length === 0) return null;

  const first = rows[0];
  const second = rows[1];
  const third = rows[2];

  // Calculate tension gap between #1 and #2
  const gapBetween1And2 =
    second ? Math.max(first.points - second.points, 1) : null;

  return (
    <div className="space-y-3">
      {/* #1 Founder — Prestigious with subtle warm-accent tint & tension badge */}
      <Link
        href={`/${first.username}`}
        className="group relative block rounded-2xl border-2 border-accent/25 bg-gradient-to-r from-[#FFF8F6] via-white to-[#FCFBF9] p-5 sm:p-6 transition-all duration-150 hover:border-accent/50 hover:shadow-md"
      >
        {/* Subtle top indicator bar */}
        <div className="absolute top-0 inset-x-6 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Rank #1 badge */}
            <div className="flex flex-col items-center justify-center shrink-0 w-10 sm:w-12">
              <span className="text-[22px] sm:text-[26px] font-black text-accent tabular tracking-tight">
                #1
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent/80">
                Top
              </span>
            </div>

            {/* Avatar */}
            <div className="shrink-0 relative">
              <FounderAvatar
                src={first.avatar_url}
                name={first.full_name}
                size={54}
                className="ring-3 ring-accent/20 group-hover:ring-accent/40 transition-all shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white shadow-xs">
                👑
              </span>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[17px] sm:text-[19px] font-extrabold text-fg group-hover:text-accent transition-colors">
                  {first.full_name}
                </span>
                <span className="text-[16px] leading-none" title={first.country_code}>
                  {flagFor(first.country_code)}
                </span>
                {first.is_verified ? (
                  <span
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent/15 text-accent text-[10px] font-bold"
                    title="Verified founder"
                  >
                    ✓
                  </span>
                ) : null}
                {first.is_early_founder ? (
                  <EarlyFounderBadge number={first.founder_number} size="sm" />
                ) : null}
              </div>

              {first.headline ? (
                <p className="mt-0.5 truncate text-[14px] sm:text-[15px] text-muted font-medium">
                  {first.headline}
                </p>
              ) : null}

              {first.venture_name ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent-subtle/70 px-2.5 py-0.5 text-[12px] font-semibold text-fg">
                    <span className="text-accent font-bold">⚡</span>
                    <span>{first.venture_name}</span>
                    {first.venture_url ? (
                      <span className="text-subtle font-normal">
                        · {displayUrl(first.venture_url)}
                      </span>
                    ) : null}
                  </span>

                  {/* Competitive Tension Badge */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted shadow-2xs">
                    {gapBetween1And2 && gapBetween1And2 < 500 ? (
                      <>
                        <Flame className="h-3 w-3 text-accent" />
                        <span>#2 is only {formatPoints(gapBetween1And2)} RP behind</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 text-accent" />
                        <span>Current leader</span>
                      </>
                    )}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: RP and Movement */}
          <div className="shrink-0 text-left sm:text-right pl-14 sm:pl-0">
            <div className="text-[20px] sm:text-[24px] font-black text-fg tabular tracking-tight">
              {formatPoints(first.points)}
              <span className="ml-1 text-[13px] font-bold text-accent">RP</span>
            </div>
            {false ? null : (
              <div className="text-[12px] font-semibold text-muted">
                Current Leader
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* #2 and #3 Founders — Restrained, Confident Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {second ? (
          <Link
            href={`/${second.username}`}
            className="group relative rounded-2xl border border-border bg-white p-4 sm:p-5 transition-all duration-150 hover:border-border-strong hover:bg-[#FAF8F5] hover:shadow-xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 shrink-0 text-left">
                <span className="text-[19px] sm:text-[22px] font-black text-fg tabular">
                  #2
                </span>
              </div>

              <div className="shrink-0">
                <FounderAvatar
                  src={second.avatar_url}
                  name={second.full_name}
                  size={46}
                  className="ring-2 ring-border group-hover:ring-accent/25 transition-all"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-fg group-hover:text-accent transition-colors">
                    {second.full_name}
                  </span>
                  <span className="text-[13px]">{flagFor(second.country_code)}</span>
                  {second.is_verified && (
                    <span className="text-accent text-[11px] font-bold">✓</span>
                  )}
                  {second.is_early_founder ? (
                    <EarlyFounderBadge number={second.founder_number} size="sm" />
                  ) : null}
                </div>

                {second.headline && (
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {second.headline}
                  </p>
                )}

                {second.venture_name && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg truncate">
                      <span className="text-accent">⚡</span>
                      {second.venture_name}
                    </span>
                    {gapBetween1And2 && (
                      <span className="text-[10px] text-subtle font-medium">
                        · {formatPoints(gapBetween1And2)} RP to #1
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[17px] font-black text-fg tabular">
                  {formatPoints(second.points)}
                  <span className="ml-1 text-[11px] font-semibold text-subtle">RP</span>
                </div>
              </div>
            </div>
          </Link>
        ) : null}

        {third ? (
          <Link
            href={`/${third.username}`}
            className="group relative rounded-2xl border border-border bg-white p-4 sm:p-5 transition-all duration-150 hover:border-border-strong hover:bg-[#FAF8F5] hover:shadow-xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 shrink-0 text-left">
                <span className="text-[19px] sm:text-[22px] font-black text-fg tabular">
                  #3
                </span>
              </div>

              <div className="shrink-0">
                <FounderAvatar
                  src={third.avatar_url}
                  name={third.full_name}
                  size={46}
                  className="ring-2 ring-border group-hover:ring-accent/25 transition-all"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-fg group-hover:text-accent transition-colors">
                    {third.full_name}
                  </span>
                  <span className="text-[13px]">{flagFor(third.country_code)}</span>
                  {third.is_verified && (
                    <span className="text-accent text-[11px] font-bold">✓</span>
                  )}
                  {third.is_early_founder ? (
                    <EarlyFounderBadge number={third.founder_number} size="sm" />
                  ) : null}
                </div>

                {third.headline && (
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {third.headline}
                  </p>
                )}

                {third.venture_name && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg truncate">
                      <span className="text-accent">⚡</span>
                      {third.venture_name}
                    </span>
                    {second && (
                      <span className="text-[10px] text-subtle font-medium">
                        · {formatPoints(Math.max(second.points - third.points, 1))} RP to #2
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[17px] font-black text-fg tabular">
                  {formatPoints(third.points)}
                  <span className="ml-1 text-[11px] font-semibold text-subtle">RP</span>
                </div>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
