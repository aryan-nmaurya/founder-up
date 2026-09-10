import type { Metadata } from "next";
import { LegalPage, H2, P } from "@/components/legal-page";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Delivery policy",
  description: `${APP_NAME} is a digital service and does not ship physical goods.`,
  alternates: { canonical: "/shipping" },
};

/** Plan §39 - required for Razorpay international activation. */
export default function ShippingPage() {
  return (
    <LegalPage title="Delivery policy" updated="10 September 2026">
      <H2>Digital service</H2>
      <P>
        {APP_NAME} provides a digital service and does not ship physical goods.
        There are no shipping charges, no delivery addresses and no couriers.
      </P>

      <H2>How your purchase is delivered</H2>
      <P>
        A boost is delivered electronically and immediately. As soon as the
        payment is captured, the Rank Points are added to your account, your
        score updates and your position on the leaderboard is recalculated. This
        normally happens within a few seconds.
      </P>
      <P>
        If the payment gateway confirms a payment after a delay, the Rank Points
        are applied when that confirmation arrives. You do not need to pay again.
      </P>

      <H2>If something doesn&apos;t arrive</H2>
      <P>
        If a payment has been taken and your Rank Points have not appeared within
        a few minutes, email {CONTACT_EMAIL} with the payment reference and we
        will resolve it.
      </P>
    </LegalPage>
  );
}
