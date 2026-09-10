import { RANKING_DISCLOSURE } from "@/lib/config";

/** Plan §37 - the paid mechanic is stated plainly, next to the leaderboard. */
export function HowItWorks() {
  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-4">
      <h2 className="text-[14px] font-medium">How ranking works</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {RANKING_DISCLOSURE}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        One Rank Point is one rupee of captured payment value. Payments in other
        currencies are converted to their INR value first, so no currency has an
        advantage. Today&apos;s board resets at 00:00 UTC.
      </p>
    </section>
  );
}
