import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/legal-page";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `${APP_NAME} terms of service.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="10 September 2026">
      <P>
        These terms cover your use of {APP_NAME}. By creating a profile or making
        a payment, you agree to them.
      </P>

      <H2>Who can use {APP_NAME}</H2>
      <UL>
        <li>
          Profiles are for individual founders. Company-only, project-only and
          agency accounts are not eligible for the leaderboard.
        </li>
        <li>
          You must be old enough to enter a contract and to make payments in your
          country.
        </li>
        <li>One profile per person.</li>
      </UL>

      <H2>What ranking is</H2>
      <P>
        Rank is determined solely by paid Rank Points. It is a paid visibility
        mechanic. It is not an endorsement, a review, an award, an
        investment-worthiness signal, or any objective measure of a founder or
        their business. We display this plainly next to every leaderboard, and
        you agree not to present your rank as anything else.
      </P>
      <P>
        Positions shown before a payment completes are estimates. Another founder
        may boost at the same time, so we never guarantee a final position.
      </P>

      <H2>Payments</H2>
      <UL>
        <li>Boosts are one-off payments processed by Razorpay.</li>
        <li>
          One Rank Point equals one rupee of captured payment value; other
          currencies are converted to their INR value first.
        </li>
        <li>
          Rank Points are delivered immediately and are non-refundable. See the{" "}
          <Link href="/refunds" className="underline underline-offset-2 hover:text-fg">
            refund policy
          </Link>
          .
        </li>
        <li>
          If a payment is reversed by your bank, the matching Rank Points are
          removed and your rank is recalculated.
        </li>
      </UL>

      <H2>Content rules</H2>
      <P>You may not use {APP_NAME} for:</P>
      <UL>
        <li>impersonating another person, company or brand;</li>
        <li>illegal businesses or illegal activity;</li>
        <li>scams, fraud, or deceptive claims;</li>
        <li>malware, phishing, or misleading external links;</li>
        <li>sexually explicit content;</li>
        <li>hateful or extremist content;</li>
        <li>spam profiles or automated mass account creation.</li>
      </UL>
      <P>
        Profile text is stored and displayed as plain text. Links must be
        ordinary http or https web addresses.
      </P>

      <H2>Country and rankings</H2>
      <P>
        Your country determines your regional leaderboard. To keep regional
        boards meaningful, it can be changed once every 30 days, and every change
        is logged. Deliberately manipulating regional rankings may result in
        suspension.
      </P>

      <H2>Moderation and suspension</H2>
      <P>
        We can hide, suspend or remove a profile that breaks these rules, and we
        review reports manually. Rank Points already purchased are not refunded
        when a profile is suspended for a violation.
      </P>

      <H2>Your content</H2>
      <P>
        You keep ownership of what you post. You give us permission to display it
        on {APP_NAME}, including in search results, share cards and social
        previews, for as long as your profile is live.
      </P>

      <H2>Availability</H2>
      <P>
        {APP_NAME} is provided as-is. We do not promise uninterrupted
        availability, and we may change or discontinue features. Where the law
        allows, our liability for any claim relating to the service is limited to
        the amount you paid us in the three months before the claim.
      </P>

      <H2>Changes</H2>
      <P>
        We may update these terms. Material changes will be noted on this page
        with a new date.
      </P>

      <H2>Contact</H2>
      <P>{CONTACT_EMAIL}</P>

      <P className="text-subtle">
        <em>
          Operator details and governing law should be completed before launch and
          the commercial and tax language reviewed by a qualified professional in
          your jurisdiction.
        </em>
      </P>
    </LegalPage>
  );
}
