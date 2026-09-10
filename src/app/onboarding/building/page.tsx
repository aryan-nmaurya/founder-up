import type { Metadata } from "next";
import { FirstVentureForm } from "@/components/first-venture-form";
import { requireProfile } from "@/lib/auth";
import { EARLY_FOUNDER_LIMIT } from "@/lib/config";
import { TrackEvent } from "@/components/track-event";
import { EarlyFounderBadge } from "@/components/early-founder-badge";

export const metadata: Metadata = {
  title: "What are you building?",
  robots: { index: false, follow: false },
};

export default async function OnboardingBuildingPage({
  searchParams,
}: {
  searchParams: Promise<{ early?: string }>;
}) {
  const profile = await requireProfile();
  await searchParams;

  return (
    <div className="mx-auto max-w-md py-4">
      <TrackEvent event="signup_completed" />

      {profile.is_early_founder ? (
        <div className="mb-6 rounded-xl border border-accent/20 bg-accent-subtle px-4 py-3.5">
          <EarlyFounderBadge number={profile.founder_number} />
          <p className="mt-2 text-[13px] text-muted">
            You made the first {EARLY_FOUNDER_LIMIT} founders. Your number is permanent, and
            you&apos;re on the leaderboard already — no payment needed.
          </p>
        </div>
      ) : null}
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
