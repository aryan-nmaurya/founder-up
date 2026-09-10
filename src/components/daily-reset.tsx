"use client";
import { useSyncExternalStore } from "react";
import { formatCountdown, secondsUntilUtcMidnight } from "@/lib/format";

/**
 * Plan §2 - "Daily leaderboard resets at 00:00 UTC", identical for everyone.
 *
 * Read through an external store rather than state-in-an-effect: the clock is
 * an outside system, and the server snapshot is null so the markup matches on
 * hydration instead of flashing a wrong time.
 */
let cached: number | null = null;

function subscribe(onChange: () => void) {
  const id = setInterval(() => {
    cached = secondsUntilUtcMidnight();
    onChange();
  }, 1000);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  cached ??= secondsUntilUtcMidnight();
  return cached;
}

function getServerSnapshot(): number | null {
  return null;
}

export function DailyReset() {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <p className="text-[12px] text-subtle">
      Daily leaderboard resets at 00:00 UTC
      {seconds != null ? (
        <span className="tabular"> · {formatCountdown(seconds)}</span>
      ) : null}
    </p>
  );
}
