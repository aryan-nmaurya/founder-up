import type { Metadata } from "next";
import { FirstVentureForm } from "@/components/first-venture-form";
import { requireProfile } from "@/lib/auth";
import { TrackEvent } from "@/components/track-event";

export const metadata: Metadata = {
  title: "What are you building?",
  robots: { index: false, follow: false },
};

export default async function OnboardingBuildingPage() {
  await requireProfile();

  return (
    <div className="mx-auto max-w-md py-4">
      <TrackEvent event="signup_completed" />
      <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">
        Step 2 of 2
      </p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
        What are you building?
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Add a project or business. You can add up to five, and change them any
        time.
      </p>

      <div className="mt-7">
        <FirstVentureForm />
      </div>
    </div>
  );
}
