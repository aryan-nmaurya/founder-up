import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { MIN_AMOUNT_SUBUNIT } from "@/lib/config";
import type { EarlyFounderStatus } from "@/lib/early-founder";

/**
 * Public availability of the Early Founder spots.
 * Designed as a refined, slim editorial announcement panel.
 */
export function EarlyFounderSpots({ status }: { status: EarlyFounderStatus }) {
  const minInr = formatMoney(MIN_AMOUNT_SUBUNIT.INR, "INR");
  const minUsd = formatMoney(MIN_AMOUNT_SUBUNIT.USD, "USD");

  if (!status.available) {
    return (
      <div className="rounded-xl border border-border bg-white px-4 py-3 text-[13px] text-muted shadow-2xs sm:px-5">
        Early Founder availability couldn&apos;t be loaded right now. Please check again shortly.
      </div>
    );
  }

  if (status.allClaimed) {
    return (
      <div className="rounded-xl border border-border bg-white px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[11px] font-bold text-accent">
              ✓
            </span>
            <div>
              <p className="text-[13px] sm:text-[14px] font-semibold text-fg">
                Early Founder spots claimed.
              </p>
              <p className="text-[12px] sm:text-[13px] text-muted">
                Create your profile free. Get ranked from {minInr} / {minUsd}.
              </p>
            </div>
          </div>
          <Link
            href="/join"
            className="inline-flex h-8 sm:h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white px-3.5 text-[12px] sm:text-[13px] font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface-subtle shadow-2xs"
          >
            Create profile
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((status.claimed / status.spots) * 100));

  return (
    <div className="rounded-xl border border-border bg-white/80 p-4 sm:px-5 sm:py-3.5 shadow-2xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent-subtle border border-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
              <Sparkles className="h-3 w-3" />
              Early Founder
            </span>
            <span className="text-[13px] font-semibold tabular text-fg">
              {status.claimed} / {status.spots} claimed
            </span>
            <span className="text-[12px] text-subtle hidden sm:inline">
              · First {status.spots} get ranked free
            </span>
          </div>

          <div className="flex items-center gap-3 pt-0.5">
            <div
              className="h-1.5 w-40 sm:w-56 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={status.claimed}
              aria-valuemin={0}
              aria-valuemax={status.spots}
              aria-label="Early Founder spots claimed"
            >
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] text-muted font-medium tabular">{status.spots - status.claimed} spots remaining</span>
          </div>
        </div>

        <div className="shrink-0 pt-1 sm:pt-0">
          <Link
            href="/join"
            className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12px] sm:text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-accent-hover"
          >
            <span>Claim your spot</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
