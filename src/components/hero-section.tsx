"use client";

import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import type { Profile } from "@/types/db";
import { formatMoney } from "@/lib/format";

interface HeroSectionProps {
  profile: Profile | null;
  onOpenBoost?: () => void;
}

export function HeroSection({
  profile,
  onOpenBoost,
}: HeroSectionProps) {
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

      {/* Contextual competitive action strip */}
      <div className="mx-auto mt-6 max-w-lg">
        {profile ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-subtle/60 p-3 sm:px-4 sm:py-3 shadow-xs">
            <div className="text-left">
              <p className="text-[13px] font-semibold text-fg">
                You&apos;re <span className="text-accent">#18</span> in India
              </p>
              <p className="text-[12px] text-muted">
                {formatMoney(30000, "INR")} could move you to approximately <strong className="text-fg">#12</strong>
              </p>
            </div>
            {onOpenBoost ? (
              <button
                type="button"
                onClick={onOpenBoost}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-fg px-4 text-[13px] font-semibold text-white hover:bg-black transition-all shadow-xs shrink-0"
              >
                <span>Climb ↑</span>
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-fg px-4 text-[13px] font-semibold text-white hover:bg-black transition-all shadow-xs shrink-0"
              >
                <span>Climb ↑</span>
              </Link>
            )}
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
