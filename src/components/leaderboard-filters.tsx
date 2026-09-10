"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { allCountries, flagFor } from "@/lib/countries";
import { track } from "@/lib/analytics-client";
import { cn } from "@/lib/cn";

/**
 * Plan §25 - two rows of controls and nothing else.
 * Row one: All-Time | Today. Row two: Global | Country.
 */
export function LeaderboardFilters({
  period,
  country,
  activeCountries,
}: {
  period: "ALL_TIME" | "TODAY";
  country: string | null;
  activeCountries: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(next: Record<string, string | null>) {
    if ("country" in next) {
      track("leaderboard_country_changed", { country: next.country });
    }
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    query.delete("limit");
    startTransition(() => {
      router.push(`${pathname}?${query.toString()}#leaderboard`, { scroll: false });
    });
  }

  const countries = allCountries();
  const ranked = countries.filter((c) => activeCountries.includes(c.code));
  const rest = countries.filter((c) => !activeCountries.includes(c.code));

  return (
    <div
      className={cn("space-y-2.5", pending && "opacity-60")}
      aria-busy={pending}
    >
      <div className="flex items-center gap-1" role="tablist" aria-label="Leaderboard period">
        <Tab active={period === "ALL_TIME"} onClick={() => update({ period: null })}>
          All-Time
        </Tab>
        <Tab active={period === "TODAY"} onClick={() => update({ period: "today" })}>
          Today
        </Tab>
      </div>

      <div className="flex items-center gap-1">
        <Tab active={country === null} onClick={() => update({ country: null })}>
          🌍 Global
        </Tab>

        <div className="relative min-w-0 flex-1 sm:flex-none">
          <select
            aria-label="Filter by country"
            value={country ?? ""}
            onChange={(e) => update({ country: e.target.value || null })}
            className={cn(
              "h-8 w-full appearance-none truncate rounded-md border px-3 pr-7 text-[13px] font-medium sm:w-auto",
              country
                ? "border-fg bg-fg text-white"
                : "border-border-strong bg-white text-fg hover:bg-surface",
            )}
          >
            <option value="">Country</option>
            {ranked.length > 0 ? (
              <optgroup label="With ranked founders">
                {ranked.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All countries">
              {rest.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </optgroup>
          </select>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]",
              country ? "text-white" : "text-muted",
            )}
          >
            ▼
          </span>
        </div>

        {country ? (
          <button
            onClick={() => update({ country: null })}
            className="rounded px-2 py-1 text-[13px] text-muted hover:text-fg"
          >
            Clear {flagFor(country)}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        // shrink-0 + nowrap: on a narrow screen the flex row would otherwise
        // squeeze "Global" until it wrapped out of the button.
        "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium",
        active
          ? "bg-fg text-white"
          : "border border-border-strong bg-white text-fg hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}
