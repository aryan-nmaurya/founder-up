import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Account suspended",
  robots: { index: false, follow: false },
};

export default function SuspendedPage() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight">
        Your profile is suspended
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        This profile is hidden from FounderUp while it is under review. If you
        think this is a mistake, email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="underline underline-offset-2 hover:text-fg"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
