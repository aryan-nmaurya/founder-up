import type { Metadata } from "next";
import { LegalPage, H2, P, UL } from "@/components/legal-page";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${APP_NAME} handles your data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="10 September 2026">
      <P>
        {APP_NAME} is a public leaderboard, so most of what you enter is meant to
        be seen. This page says exactly what is public, what is not, and what we
        keep.
      </P>

      <H2>What is public</H2>
      <UL>
        <li>Your name, username, photo, country, headline and bio.</li>
        <li>Your projects and businesses, and the links you add to them.</li>
        <li>Your website and social links, and your chosen Connect destination.</li>
        <li>Your Rank Points and leaderboard positions.</li>
      </UL>
      <P>
        If you choose email as your Connect destination, that email address is
        shown publicly. Nothing else about your account is.
      </P>

      <H2>What is private</H2>
      <UL>
        <li>Your sign-in email address, unless you publish it as a contact.</li>
        <li>Your payment history and the amounts you paid.</li>
        <li>Your profile view and click statistics, which only you can see.</li>
      </UL>
      <P>
        We never show what any individual founder paid, and we do not show
        payment amounts in the public activity feed.
      </P>

      <H2>Payment data</H2>
      <P>
        Payments are processed by Razorpay. Card numbers, UPI details and bank
        credentials are handled entirely by Razorpay and never reach our servers.
        We store the payment identifier, amount, currency, converted INR value,
        status, and the Rank Points awarded, so we can show your history and
        correct errors.
      </P>

      <H2>Location</H2>
      <P>
        We read a coarse country code from your connection to decide whether to
        show prices in INR or USD. We do not store your IP address for this. Your
        currency choice is remembered in a cookie on your device.
      </P>

      <H2>Analytics</H2>
      <P>
        We count profile views and outbound link clicks so founders can see what
        their ranking earned them. Views are de-duplicated using a short-lived,
        one-way fingerprint derived from your connection and browser; it cannot
        be reversed into an IP address, and we do not build visitor profiles or
        sell data.
      </P>

      <H2>Cookies</H2>
      <P>
        We use a session cookie to keep you signed in and a preference cookie for
        your chosen currency. We do not use advertising cookies.
      </P>

      <H2>Retention</H2>
      <P>
        Profile data is kept while your profile exists. Payment records and the
        Rank Point ledger are kept after deletion where we are required to retain
        financial records.
      </P>

      <H2>Your choices</H2>
      <UL>
        <li>Edit or remove most profile fields at any time in settings.</li>
        <li>
          Ask us to delete your profile by emailing {CONTACT_EMAIL} from your
          sign-in address.
        </li>
        <li>Ask for a copy of the data we hold about you.</li>
      </UL>

      <H2>Contact</H2>
      <P>{CONTACT_EMAIL}</P>

      <P className="text-subtle">
        <em>
          Operator details, data-controller identity and grievance-officer
          contact should be completed before launch and reviewed by a qualified
          professional in your jurisdiction.
        </em>
      </P>
    </LegalPage>
  );
}
