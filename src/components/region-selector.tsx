"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ChevronDown, X, Check, Globe } from "lucide-react";
import { allCountries, countryName, flagFor } from "@/lib/countries";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics-client";

interface RegionSelectorProps {
  period: "ALL_TIME" | "TODAY";
  country: string | null;
  activeCountries: string[];
}

export function RegionSelector({
  period,
  country,
  activeCountries,
}: RegionSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Auto-focus search input when opened, and reset the query when it closes.
  // Both happen in the timer callback so neither is a synchronous setState
  // inside the effect body.
  useEffect(() => {
    const id = setTimeout(() => {
      if (dropdownOpen) searchInputRef.current?.focus();
      else setSearchQuery("");
    }, 50);
    return () => clearTimeout(id);
  }, [dropdownOpen]);

  function updateQuery(next: Record<string, string | null>) {
    if ("country" in next) {
      track("leaderboard_country_changed", { country: next.country });
    }
    const query = new URLSearchParams(searchParams.toString());
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
  const filtered = searchQuery.trim()
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : countries;

  const rankedFiltered = filtered.filter((c) => activeCountries.includes(c.code));
  const otherFiltered = filtered.filter((c) => !activeCountries.includes(c.code));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 py-1 transition-opacity",
        pending && "opacity-60",
      )}
      aria-busy={pending}
    >
      {/* Region controls: Global & Country */}
      <div className="flex items-center gap-2">
        {/* Global tab with Globe SVG icon */}
        <button
          type="button"
          onClick={() => {
            updateQuery({ country: null });
            setDropdownOpen(false);
          }}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition-all shadow-2xs",
            country === null
              ? "bg-fg text-white shadow-xs"
              : "border border-border bg-white text-muted hover:border-border-strong hover:text-fg",
          )}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>Global</span>
        </button>

        {/* Selected Country pill with quick clear */}
        {country ? (
          <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-subtle px-3 text-[13px] font-semibold text-fg shadow-2xs">
            <span>{flagFor(country)}</span>
            <span>{countryName(country)}</span>
            <button
              type="button"
              onClick={() => updateQuery({ country: null })}
              className="ml-1 rounded-full p-0.5 text-muted hover:bg-accent/15 hover:text-fg transition-colors"
              aria-label="Clear country filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* Searchable Country dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[13px] font-semibold text-muted hover:border-border-strong hover:text-fg transition-all shadow-2xs",
              dropdownOpen && "border-fg text-fg ring-2 ring-fg/5",
            )}
            aria-expanded={dropdownOpen}
            aria-label="Select Country"
          >
            <span>Country</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-150",
                dropdownOpen && "rotate-180",
              )}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              {/* Search input */}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-surface pl-8 pr-3 text-[13px] text-fg placeholder:text-subtle focus:border-fg focus:bg-white focus:outline-none"
                />
              </div>

              {/* Country lists */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 text-[13px]">
                {rankedFiltered.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-subtle">
                      Ranked Founders
                    </div>
                    {rankedFiltered.map((c) => {
                      const isSelected = country === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            updateQuery({ country: c.code });
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors",
                            isSelected
                              ? "bg-accent-subtle font-semibold text-accent"
                              : "text-fg hover:bg-surface",
                          )}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span>{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {otherFiltered.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-subtle">
                      All Countries
                    </div>
                    {otherFiltered.map((c) => {
                      const isSelected = country === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            updateQuery({ country: c.code });
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors",
                            isSelected
                              ? "bg-accent-subtle font-semibold text-accent"
                              : "text-fg hover:bg-surface",
                          )}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span>{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {filtered.length === 0 && (
                  <p className="py-4 text-center text-[12px] text-muted">
                    No country matches &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Period toggle: All-Time | Today */}
      <div className="inline-flex items-center rounded-xl border border-border bg-surface p-0.5 shadow-2xs">
        <button
          type="button"
          onClick={() => updateQuery({ period: null })}
          className={cn(
            "rounded-lg px-3 py-1 text-[13px] font-semibold transition-all",
            period === "ALL_TIME"
              ? "bg-white text-fg shadow-xs"
              : "text-muted hover:text-fg",
          )}
        >
          All-Time
        </button>
        <button
          type="button"
          onClick={() => updateQuery({ period: "today" })}
          className={cn(
            "rounded-lg px-3 py-1 text-[13px] font-semibold transition-all",
            period === "TODAY"
              ? "bg-white text-fg shadow-xs"
              : "text-muted hover:text-fg",
          )}
        >
          Today
        </button>
      </div>
    </div>
  );
}
