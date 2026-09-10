import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { EARLY_FOUNDER_LIMIT } from "@/lib/config";

/**
 * The permanent Early Founder marker.
 *
 * Kept visually secondary to the live leaderboard rank next to it: this is a
 * historical identity that never changes, not a position that moves. Render it
 * only when `profile.is_early_founder` is true.
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full",
        "border border-accent/20 bg-accent-subtle font-bold text-accent",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        className,
      )}
    >
      <Sparkles className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Early Founder <span className="tabular">#{number}</span>
    </span>
  );
}
