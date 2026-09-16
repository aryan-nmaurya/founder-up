"use client";
import { useSyncExternalStore } from "react";
import { Crown } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * How long a #1 has held the spot, ticking once a second.
 *
 * The server can't know the viewer's clock, so it renders the start date
 * ("since Sep 9, 2026") - which is also what a crawler sees - and the live
 * duration takes over after hydration. One shared timer drives every instance.
 */
let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const notify of listeners) notify();
  }, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
      now = null;
    }
  };
}

function getSnapshot(): number {
  now ??= Date.now();
  return now;
}

function getServerSnapshot(): number | null {
  return null;
}

export function LeadingFor({
  since,
  label = "Leading",
  className,
}: {
  /** When the reign began (ISO timestamp from current_leader). */
  since: string;
  /** What is being held: "Leading", "#1 in Malta", "#1 globally". */
  label?: string;
  className?: string;
}) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular", className)}
      title={`#1 since ${formatDate(since)}`}
    >
      <Crown className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <span>
        {current == null
          ? `${label} since ${formatDate(since)}`
          : `${label} for ${formatDuration(current - Date.parse(since))}`}
      </span>
    </span>
  );
}
