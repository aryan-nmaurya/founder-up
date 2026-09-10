import type { ReactNode } from "react";
import { flagFor } from "@/lib/countries";
import { formatRank } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Plan §1 - the two scopes, shown the same way everywhere.
 *
 * A founder with no rank is Unranked rather than absent: since the Early
 * Founder programme, being on the board is about eligibility, not points, so
 * "0 RP" no longer means "not ranked".
 */
export function FounderRank({
  globalRank,
  countryRank,
  countryCode,
  className,
  cta,
}: {
  globalRank: number | null;
  countryRank: number | null;
  countryCode: string;
  className?: string;
  cta?: ReactNode;
}) {
  if (globalRank == null) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <p className="text-[15px] font-medium text-muted">Unranked</p>
        {cta}
      </div>
    );
  }

  return (
    <p className={cn("text-[15px] font-medium tabular", className)}>
      <span>🌍 {formatRank(globalRank)} Global</span>
      {countryRank != null ? (
        <>
          <span className="mx-2 text-border-strong">·</span>
          <span>
            {flagFor(countryCode)} {formatRank(countryRank)}
          </span>
        </>
      ) : null}
    </p>
  );
}
