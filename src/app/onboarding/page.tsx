import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { detectCountry } from "@/lib/geo";
import { usernameSchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
};

/** Turns an email or OAuth name into a plausible starting username. */
function suggestUsername(seed: string): string {
  const candidate = seed
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
  return usernameSchema.safeParse(candidate).success ? candidate : "";
}

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await getCurrentProfile();
  if (existing) redirect("/dashboard");

  const meta = user.user_metadata ?? {};
  const name =
    (meta.full_name as string) ??
    (meta.name as string) ??
    (meta.user_name as string) ??
    "";

  const country = (await detectCountry()) ?? "";
  const seed = (meta.user_name as string) || name || user.email || "";

  return (
    <div className="mx-auto max-w-md py-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">
        Step 1 of 2
      </p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
        Set up your profile
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        This is what visitors see when they find you.
      </p>

      <div className="mt-7">
        <OnboardingForm
          defaultName={name}
          defaultCountry={country}
          suggestedUsername={suggestUsername(seed)}
        />
      </div>
    </div>
  );
}
