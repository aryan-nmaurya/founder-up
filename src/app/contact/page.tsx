import type { Metadata } from "next";
import { LegalPage, H2, P } from "@/components/legal-page";
import { APP_NAME, CONTACT_EMAIL, LEGAL_OPERATOR_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${APP_NAME}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <P>
        {APP_NAME} is run by a small team. Email is the fastest way to reach us.
      </P>

      <H2>Email</H2>
      <P>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-fg underline underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>
      </P>

      <H2>Payment problems</H2>
      <P>
        If money left your account and Rank Points did not appear, email us with
        the payment reference. Payment issues are answered first.
      </P>

      <H2>Reporting a profile</H2>
      <P>
        Use the “Report profile” link at the bottom of any founder&apos;s profile.
        Reports are reviewed manually.
      </P>

      <H2>Operator</H2>
      <P>
        {LEGAL_OPERATOR_NAME} operates this service. Legal notices may be sent to
        the email address above.
      </P>
    </LegalPage>
  );
}
