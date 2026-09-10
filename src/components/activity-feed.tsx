import Link from "next/link";
import { flagFor } from "@/lib/countries";
import { formatRelative } from "@/lib/format";
import type { ActivityEvent } from "@/types/db";

function describe(event: ActivityEvent): string {
  const meta = event.metadata as { from?: number; to?: number; scope?: string };
  switch (event.type) {
    case "JOINED":
      return "joined FounderUp";
    case "REACHED_NUMBER_ONE":
      return `moved to #1 ${meta.scope || "Global"}`;
    case "ENTERED_TOP_10":
      return `entered ${meta.scope ? `${meta.scope}'s` : "Global"} Top 10`;
    case "RANK_UP":
      return meta.from && meta.to
        ? `climbed from #${meta.from} to #${meta.to}`
        : "climbed up the leaderboard";
    case "BOOSTED":
    default:
      return "boosted their rank";
  }
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-2xs">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">
          Live activity
        </h2>
      </div>

      <ul className="divide-y divide-border/60">
        {events.map((event) => {
          const profile = event.profiles;
          if (!profile) return null;
          return (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 py-2.5 text-[13px] sm:text-[14px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-accent text-[10px] leading-none shrink-0">
                  ●
                </span>
                <Link
                  href={`/${profile.username}`}
                  className="font-bold text-fg hover:text-accent hover:underline underline-offset-2 transition-colors truncate shrink-0"
                >
                  {profile.full_name}
                </Link>
                <span className="text-[13px] shrink-0" title={profile.country_code}>
                  {flagFor(profile.country_code)}
                </span>
                <span className="text-muted font-medium truncate">
                  {describe(event)}
                </span>
              </div>

              <span className="shrink-0 text-[12px] font-medium text-subtle tabular">
                {formatRelative(event.created_at)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
