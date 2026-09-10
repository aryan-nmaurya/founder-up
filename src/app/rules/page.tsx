import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Flame, Globe2, Sparkles, Clock, AlertCircle } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Rules & How Ranking Works — ${APP_NAME}`,
  description: "Complete rules, Rank Points calculation, Founding 50 details, and fair competition guidelines.",
};

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-(--container-narrow) py-4 sm:py-8 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-fg transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to leaderboard</span>
        </Link>

        <h1 className="text-[32px] sm:text-[38px] font-extrabold tracking-tight text-fg">
          Rules & Ranking System
        </h1>
        <p className="mt-2 text-[16px] text-muted font-medium">
          Transparent, competitive visibility for ambitious founders.
        </p>
      </div>

      {/* Core Rules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Flame className="h-5 w-5" />
            <h2 className="text-[16px] font-bold text-fg">Rank Points (RP)</h2>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">
            1 RP equals ₹1 of captured payment value. Foreign currencies (USD) are converted to their base INR value at payment capture time, eliminating currency arbitrage.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-[16px] font-bold text-fg">The Founding 50</h2>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">
            The first 50 founders who complete their profiles receive complimentary ranked entry without payment. After spot #50 is claimed, new profiles can join for free and enter the ranked board from ₹100 or $1.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Globe2 className="h-5 w-5" />
            <h2 className="text-[16px] font-bold text-fg">Global & Country Boards</h2>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">
            There are no arbitrary categories. Every founder competes in only two scopes: <strong>Global</strong> and their designated <strong>Country</strong> leaderboard.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Clock className="h-5 w-5" />
            <h2 className="text-[16px] font-bold text-fg">Today vs All-Time</h2>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">
            All-Time displays lifetime Rank Points. The <strong>Today</strong> board resets daily at 00:00 UTC, giving every new or active founder a board they can realistically win each day.
          </p>
        </div>
      </div>

      {/* Payment & Refund Policy */}
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-fg">
          <ShieldCheck className="h-5 w-5 text-positive" />
          <h2 className="text-[18px] font-bold">Payment Terms & Non-Refundability</h2>
        </div>
        <div className="space-y-3 text-[14px] leading-relaxed text-muted">
          <p>
            Rank Points are delivered instantly to your profile upon capture. Because leaderboard visibility is consumed in real time, <strong>all ranking purchases are final and non-refundable</strong>.
          </p>
          <p>
            Leaderboard positions are dynamic: if another founder boosts their rank after you, your position may adjust accordingly.
          </p>
        </div>
      </div>

      {/* Code of Conduct */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-3">
        <div className="flex items-center gap-2 text-fg">
          <AlertCircle className="h-5 w-5 text-accent" />
          <h2 className="text-[16px] font-bold">Fair Competition & Moderation</h2>
        </div>
        <p className="text-[14px] leading-relaxed text-muted">
          Founders must represent genuine projects, businesses, and identities. Impersonation, spam links, fraudulent schemes, or abusive content result in immediate profile suspension and forfeiture of ranking without refund.
        </p>
      </div>

      <div className="pt-4 text-center">
        <Link
          href="/join"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-fg px-6 text-[14px] font-bold text-white hover:bg-black transition-all shadow-xs"
        >
          Claim your founder profile
        </Link>
      </div>
    </div>
  );
}
