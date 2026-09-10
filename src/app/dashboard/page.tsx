import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getFounderRanks, getNextRankGap } from "@/lib/ranking";
import { getFounderStats, getPaymentHistory } from "@/lib/db";
import { resolveCurrency } from "@/lib/geo";
import { getSessionUser } from "@/lib/auth";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { BoostDialog } from "@/components/boost-dialog";
import { FounderRank } from "@/components/founder-rank";
import { EarlyFounderBadge } from "@/components/early-founder-badge";
import { Divider, Notice, Stat } from "@/components/ui/misc";
import { TrackEvent } from "@/components/track-event";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatMoney, formatPoints } from "@/lib/format";
import { flagFor } from "@/lib/countries";
import { MIN_AMOUNT_SUBUNIT, type Currency } from "@/lib/config";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

const STATUS_LABEL = {
  CAPTURED: "Successful",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const profile = await requireProfile();

  const [ranks, gap, stats, payments, currency, user] = await Promise.all([
    getFounderRanks(profile.id),
    getNextRankGap(profile.id),
    getFounderStats(profile.id),
    getPaymentHistory(profile.id),
    resolveCurrency(),
    getSessionUser(),
  ]);

  return (
    <div className="mx-auto max-w-(--container-narrow) space-y-8">
      {welcome ? <TrackEvent event="profile_completed" /> : null}

      {welcome ? (
        <Notice>
          Your profile is live at{" "}
          <Link
            href={`/${profile.username}`}
            className="font-medium underline underline-offset-2"
          >
            /{profile.username}
          </Link>
          . Boost to enter the leaderboard.
        </Notice>
      ) : null}

      <section>
        <h1 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Your FounderUp
        </h1>

        {profile.is_early_founder ? (
          <div className="mt-2">
            <EarlyFounderBadge number={profile.founder_number} />
          </div>
        ) : null}

        <div className="mt-2">
          <FounderRank
            globalRank={ranks?.global_rank ?? null}
            countryRank={ranks?.country_rank ?? null}
            countryCode={profile.country_code}
            className="text-[19px]"
          />
        </div>

        <p className="mt-2 text-[26px] font-semibold tabular">
          {formatPoints(profile.total_rank_points)}{" "}
          <span className="text-[15px] font-normal text-muted">RP</span>
        </p>

        {ranks?.today_points ? (
          <p className="mt-1 text-[13px] text-muted tabular">
            {formatPoints(ranks.today_points)} RP today · Today&apos;s rank 🌍{" "}
            {ranks.today_global_rank ? `#${ranks.today_global_rank}` : "—"} ·{" "}
            {flagFor(profile.country_code)}{" "}
            {ranks.today_country_rank ? `#${ranks.today_country_rank}` : "—"}
          </p>
        ) : null}

        {/* Plan §16 - concrete next step, always labelled an estimate. */}
        {gap?.global_gap && gap.global_target_rank ? (
          <p className="mt-3 text-[14px]">
            <strong className="font-medium tabular">
              {formatPoints(gap.global_gap)} RP
            </strong>{" "}
            to take estimated #{gap.global_target_rank} globally
            {gap.country_gap && gap.country_target_rank ? (
              <>
                {" · "}
                <strong className="font-medium tabular">
                  {formatPoints(gap.country_gap)} RP
                </strong>{" "}
                to take #{gap.country_target_rank} in {flagFor(profile.country_code)}
              </>
            ) : null}
          </p>
        ) : !profile.is_ranked ? (
          <p className="mt-3 text-[14px] text-muted">
            You&apos;re Unranked. Get ranked from{" "}
            {formatMoney(MIN_AMOUNT_SUBUNIT.INR, "INR")} /{" "}
            {formatMoney(MIN_AMOUNT_SUBUNIT.USD, "USD")} to enter the leaderboard.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <BoostDialog
            ranks={ranks}
            gap={gap}
            defaultCurrency={currency.currency as Currency}
            founderName={profile.full_name}
            founderEmail={user?.email ?? ""}
            username={profile.username}
            countryCode={profile.country_code}
            razorpayEnabled={isRazorpayConfigured()}
          />
          <ButtonLink href={`/${profile.username}`} variant="secondary" size="lg">
            View public profile
          </ButtonLink>
        </div>

        {!isRazorpayConfigured() ? (
          <div className="mt-3">
            <Notice tone="warning">
              Razorpay keys aren&apos;t configured, so checkout is disabled on this
              deployment.
            </Notice>
          </div>
        ) : null}
      </section>

      <Divider />

      {/* Plan §55 - what the ranking bought. */}
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Your reach
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Stat label="Profile views" value={formatPoints(stats.profile_views)} />
          <Stat label="Website clicks" value={formatPoints(stats.website_clicks)} />
          <Stat label="Connect clicks" value={formatPoints(stats.connect_clicks)} />
        </div>
      </section>

      <Divider />

      {/* Plan §61 - boost history. */}
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Boost history
        </h2>

        {payments.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">No boosts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[14px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-subtle">
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Rank Points</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 tabular">
                      {formatMoney(
                        payment.amount_subunit,
                        payment.currency as Currency,
                      )}
                    </td>
                    <td className="py-2.5 tabular">
                      {payment.status === "CAPTURED" ? "+" : ""}
                      {formatPoints(payment.rank_points_awarded)} RP
                    </td>
                    <td className="py-2.5 text-muted">
                      {formatDate(payment.captured_at ?? payment.created_at)}
                    </td>
                    <td className="py-2.5 text-muted">
                      {STATUS_LABEL[payment.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-subtle">
              Rank Points for non-INR payments are calculated from the converted
              INR value of the captured payment.
            </p>
          </div>
        )}
      </section>

      <Divider />

      <section className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        <Link href="/settings/profile" className="text-muted hover:text-fg">
          Edit profile
        </Link>
        <Link href="/settings/ventures" className="text-muted hover:text-fg">
          Manage projects
        </Link>
        {profile.is_admin ? (
          <Link href="/admin" className="text-muted hover:text-fg">
            Admin
          </Link>
        ) : null}
        <form action="/auth/signout" method="post" className="ml-auto">
          <button type="submit" className="text-muted hover:text-fg">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
