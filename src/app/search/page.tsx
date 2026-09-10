import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { FounderAvatar } from "@/components/founder-avatar";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { searchFounders } from "@/lib/db";
import { isValidCountry, flagFor, countryName } from "@/lib/countries";
import { formatPoints } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search founders",
  description: "Find founders by name, username or what they're building.",
  alternates: { canonical: "/search" },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string }>;
}) {
  const { q, country: rawCountry } = await searchParams;
  const country = rawCountry && isValidCountry(rawCountry) ? rawCountry.toUpperCase() : null;
  const query = (q ?? "").trim();

  const results = query.length >= 2 ? await searchFounders(query, country, 25) : [];

  return (
    <div className="mx-auto max-w-(--container-narrow)">
      <PageHeader
        title="Search founders"
        subtitle="By name, username or what they're building."
      />

      <SearchBox />

      <div className="mt-7">
        {query.length < 2 ? (
          <p className="text-[14px] text-muted">
            Type at least two characters to search.
          </p>
        ) : results.length === 0 ? (
          <EmptyState
            title={`No founders match "${query}"${country ? ` in ${countryName(country)}` : ""}.`}
            body="Try a different name, or browse the leaderboard."
            action={<ButtonLink href="/">Browse leaderboard</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {results.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/${row.username}`}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-surface"
                >
                  <FounderAvatar src={row.avatar_url} name={row.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {row.full_name}
                      <span className="text-[13px]">{flagFor(row.country_code)}</span>
                    </p>
                    {row.headline ? (
                      <p className="truncate text-[13px] text-muted">{row.headline}</p>
                    ) : null}
                    {row.venture_name ? (
                      <p className="truncate text-[13px] text-subtle">
                        {row.venture_name}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[14px] tabular text-muted">
                    {row.is_ranked ? `${formatPoints(row.points)} RP` : "Unranked"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
