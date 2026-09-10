"use client";
import { useState } from "react";
import { APP_URL } from "@/lib/config";
import { flagFor } from "@/lib/countries";
import { formatRank } from "@/lib/format";
import { Button } from "./ui/button";
import { track } from "@/lib/analytics-client";

/**
 * Plan §42 - shareable, but nothing is ever posted automatically.
 * The X intent opens a pre-filled composer the founder still has to send.
 */
export function ShareRank({
  username,
  globalRank,
  countryRank,
  countryCode,
  ventureName,
}: {
  username: string;
  globalRank: number | null;
  countryRank: number | null;
  countryCode: string;
  ventureName?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${APP_URL}/${username}`;

  const line =
    countryRank != null
      ? `Just reached ${formatRank(countryRank)} on FounderUp ${flagFor(countryCode)}`
      : `Just reached ${formatRank(globalRank)} on FounderUp 🌍`;

  const text = ventureName ? `${line}\nBuilding ${ventureName}.` : line;

  const intent = `https://x.com/intent/post?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(url)}`;

  async function copy() {
    track("share_rank_clicked", { method: "copy" });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex gap-2">
      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("share_rank_clicked", { method: "x" })}
        className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-fg px-4 text-[14px] font-medium text-white hover:bg-black"
      >
        Share on X
      </a>
      <Button variant="secondary" onClick={copy} className="flex-1">
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
