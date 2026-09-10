import { ButtonLink } from "./ui/button";
import { EmptyState } from "./ui/misc";
import { LeaderboardRow } from "./leaderboard-row";
import { countryName } from "@/lib/countries";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/config";
import type { LeaderboardRow as Row } from "@/types/db";

export function Leaderboard({
  rows,
  country,
  period,
  total,
  shown,
  baseQuery,
}: {
  rows: Row[];
  country: string | null;
  period: "ALL_TIME" | "TODAY";
  total: number;
  shown: number;
  baseQuery: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={
          country
            ? `No ranked founders from ${countryName(country)} yet.`
            : period === "TODAY"
              ? "Nobody has boosted today yet."
              : "No founders are ranked yet."
        }
        body={
          period === "TODAY"
            ? "The daily board resets at 00:00 UTC. First boost of the day takes #1."
            : "Be the first founder on the board."
        }
        action={
          <ButtonLink href="/join" size="md">
            Get ranked
          </ButtonLink>
        }
      />
    );
  }

  const hasMore = shown < total;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((row) => (
          <LeaderboardRow key={`${row.id}-${row.rank}`} row={row} />
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <ButtonLink
            href={`/?${[baseQuery, `limit=${shown + LEADERBOARD_PAGE_SIZE}`]
              .filter(Boolean)
              .join("&")}#leaderboard`}
            variant="secondary"
            size="md"
            className="rounded-xl px-6 py-2.5 font-semibold text-[13px] shadow-2xs hover:bg-surface"
          >
            Load more founders
          </ButtonLink>
        </div>
      ) : null}

      <p className="mt-5 text-center text-[12px] font-medium text-subtle tabular">
        Showing {Math.min(shown, total)} of {total} ranked founders
      </p>
    </div>
  );
}
