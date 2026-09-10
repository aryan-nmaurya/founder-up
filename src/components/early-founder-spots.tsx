import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { MIN_AMOUNT_SUBUNIT } from "@/lib/config";
import type { EarlyFounderStatus } from "@/lib/early-founder";

/**
 * Public availability of the Early Founder spots.
 *
 * The count comes from the database sequence, so this flips to the claimed
 * state on its own the moment number 50 is issued - there is no admin toggle.
 */
export function EarlyFounderSpots({ status }: { status: EarlyFounderStatus }) {
  const minInr = formatMoney(MIN_AMOUNT_SUBUNIT.INR, "INR");
  const minUsd = formatMoney(MIN_AMOUNT_SUBUNIT.USD, "USD");

  if (status.allClaimed) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[12px] font-semibold text-accent">
              ✓
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">
                Early Founder spots claimed.
              </p>
              <p className="text-[13px] text-muted">
                Create your profile free. Get ranked from {minInr} / {minUsd}.
              </p>
            </div>
          </div>
          <Link
            href="/join"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-white px-4 text-[13px] font-semibold text-fg transition-colors hover:bg-surface"
          >
            Create profile
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((status.claimed / status.spots) * 100));

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-r from-surface to-surface-subtle/70 p-4 shadow-2xs sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Sparkles className="h-3 w-3" />
              Early Founder
            </span>
            <span className="text-[13px] font-semibold tabular text-fg">
              {status.claimed} / {status.spots} spots claimed
            </span>
          </div>

          <p className="text-[14px] text-muted">
            Join early. The first {status.spots} founders get ranked free and keep
            a permanent Early Founder number.
          </p>

          <div
            className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border"
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
        </div>

        <div className="shrink-0">
          <Link
            href="/join"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-fg px-4 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-black"
          >
            <span>Claim your spot</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
