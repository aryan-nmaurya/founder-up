import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { EARLY_FOUNDER_LIMIT } from "@/lib/config";

/**
 * Archival Early Founder marker.
 *
 * Subtle, collectible status label with a fine border. Kept visually secondary
 * to the live leaderboard rank beside it: this is a permanent identity, not a
 * position that moves.
 *
 * The wording is fixed at "Early Founder #N" by product spec - not "Founding
 * #N", "Founder #N" or "Member #N". Please don't rename it.
 */
export function EarlyFounderBadge({
  number,
  size = "md",
  className,
}: {
  number: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={`One of the first ${EARLY_FOUNDER_LIMIT} founders on FounderUp`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md font-semibold tabular",
        "border border-accent/20 bg-accent-subtle text-accent",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <Sparkles className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span>Early Founder #{number}</span>
    </span>
  );
}
