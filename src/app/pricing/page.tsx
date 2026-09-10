import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/legal-page";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Boost your rank on ${APP_NAME}. Minimum ₹100 in India, $1 internationally.`,
  alternates: { canonical: "/pricing" },
};

/** Plan §62 - ridiculously simple. No tiers, no subscriptions. */
export default function PricingPage() {
  return (
    <LegalPage title="Boost your rank">
      <P>
        {APP_NAME} is pay-as-you-go. There are no subscriptions, no Pro plan and
        no premium profile. You pay when you want to climb, and you pay nothing
        otherwise. Creating a profile is free.
      </P>

      <H2>India</H2>
      <P>Minimum ₹100 per boost.</P>

      <H2>International</H2>
      <P>
        Minimum $1 per boost. Outside India, USD is selected automatically. You
        can switch to INR at any time, and we won&apos;t switch it back on you.
      </P>

      <H2>How Rank Points are calculated</H2>
      <UL>
        <li>₹1 of captured payment value = 1 Rank Point.</li>
        <li>₹500 adds 500 RP.</li>
        <li>
          Payments in other currencies are converted to their INR value at the
          rate the payment gateway settles at, then converted to Rank Points.
        </li>
        <li>Fractions are rounded down.</li>
      </UL>

      <P>
        Rank Points are delivered immediately and are non-refundable. See the{" "}
        <Link href="/refunds" className="underline underline-offset-2 hover:text-fg">
          refund policy
        </Link>
        .
      </P>

      <div className="pt-2">
        <ButtonLink href="/join" size="lg">
          Join {APP_NAME}
        </ButtonLink>
      </div>
    </LegalPage>
  );
}
