"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { allCountries } from "@/lib/countries";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

/** Plan §44 - search box plus a country filter. Nothing else. */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (country) next.set("country", country);
    router.push(`/search?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        type="search"
        placeholder="Search founders…"
        aria-label="Search founders"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="sm:flex-1"
      />
      <Select
        aria-label="Country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="sm:w-52"
      >
        <option value="">All countries</option>
        {allCountries().map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.name}
          </option>
        ))}
      </Select>
      <Button type="submit">Search</Button>
    </form>
  );
}
