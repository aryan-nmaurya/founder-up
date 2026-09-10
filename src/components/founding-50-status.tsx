import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface Founding50StatusProps {
  claimed?: number;
  total?: number;
}

export function Founding50Status({
  claimed = 37,
  total = 50,
}: Founding50StatusProps) {
  const isComplete = claimed >= total;
  const progressPercent = Math.min(Math.round((claimed / total) * 100), 100);

  if (isComplete) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-4 transition-all">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-accent text-xs font-semibold">
              ✓
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">
                FounderUp is live
              </p>
              <p className="text-[13px] text-muted">
                Create your profile free. Enter the leaderboard from ₹100 / $1.
              </p>
            </div>
          </div>
          <Link
            href="/join"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-white px-4 text-[13px] font-semibold text-fg hover:bg-surface transition-colors"
          >
            Create profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-surface to-surface-subtle/70 p-4 sm:p-5 transition-all shadow-2xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Sparkles className="h-3 w-3" />
              Founding 50
            </span>
            <span className="text-[13px] font-semibold text-fg tabular">
              {claimed} / {total} spots claimed
            </span>
          </div>

          <p className="text-[14px] text-muted">
            The first 50 founders get ranked free. Show what you&apos;re building.
          </p>

          {/* Minimal tasteful progress bar */}
          <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href="/join"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-fg px-4 text-[13px] font-semibold text-white hover:bg-black transition-all shadow-xs"
          >
            <span>Claim your profile</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
