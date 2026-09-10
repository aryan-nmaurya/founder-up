import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/legal-page";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description: `${APP_NAME} refund and cancellation policy.`,
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund and cancellation policy" updated="10 September 2026">
      <H2>All boosts are final</H2>
      <P>
        {APP_NAME} does not offer refunds. Rank Points are a digital benefit that
        is delivered immediately and consumed the moment it is applied — your
        score and leaderboard position change as soon as the payment is captured.
        For that reason every boost is final and non-refundable once it has been
        processed.
      </P>
      <P>
        There is no cancellation window, because there is nothing to cancel: a
        boost is a single, instantly fulfilled purchase, not a subscription or a
        recurring charge.
      </P>

      <H2>Before you pay</H2>
      <UL>
        <li>
          The amount, the currency and the Rank Points you will receive are shown
          before you confirm the payment.
        </li>
        <li>
          Rank Points buy visibility on a public leaderboard. They do not buy a
          guaranteed position — another founder can boost past you at any time,
          which is why every position we show before payment is labelled an
          estimate.
        </li>
        <li>
          Ranking is not an endorsement and is not a measure of founder quality.
        </li>
      </UL>

      <H2>Failed and incomplete payments</H2>
      <P>
        If a payment fails or you abandon checkout, no Rank Points are added and
        nothing is charged. If your bank shows a pending amount for a payment
        that did not complete, it is released by the bank on its usual schedule —
        {" "}{APP_NAME} never received it.
      </P>
      <P>
        If money leaves your account but Rank Points do not appear within a few
        minutes, email us at {CONTACT_EMAIL} with the payment reference and we
        will apply the missing points or return the payment if it cannot be
        applied.
      </P>

      <H2>Duplicate and erroneous charges</H2>
      <P>
        If you are charged twice for the same boost because of a technical fault
        on our side or the payment gateway&apos;s, the duplicate charge is
        returned. This is a correction of an error, not a refund of a completed
        boost.
      </P>

      <H2>Chargebacks</H2>
      <P>
        If a payment is reversed by your bank or card network, the corresponding
        Rank Points are removed from your score and your rank is recalculated.
        The original payment record is retained. Accounts with repeated
        chargebacks may be suspended.
      </P>

      <H2>Suspended profiles</H2>
      <P>
        If a profile is suspended for breaking our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
          Terms
        </Link>
        , Rank Points already purchased are not refunded.
      </P>

      <H2>Questions</H2>
      <P>Email {CONTACT_EMAIL}. We reply to payment questions first.</P>
    </LegalPage>
  );
}
