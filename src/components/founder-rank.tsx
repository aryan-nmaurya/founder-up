import { flagFor } from "@/lib/countries";
import { formatRank } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Plan §1 - the two scopes, shown the same way everywhere. */
export function FounderRank({
  globalRank,
  countryRank,
  countryCode,
  className,
}: {
  globalRank: number | null;
  countryRank: number | null;
  countryCode: string;
  className?: string;
}) {
  if (globalRank == null) {
    return (
      <p className={cn("text-[14px] text-muted", className)}>Not ranked yet</p>
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
