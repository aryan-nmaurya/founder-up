import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui/misc";
import { requireProfile, requireUser } from "@/lib/auth";
import { countryCooldown } from "@/lib/country-cooldown";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage() {
  const profile = await requireProfile();
  const user = await requireUser();

  const { locked, unlocksAt } = countryCooldown(profile.country_changed_at);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Edit profile"
        subtitle={
          <>
            Public at{" "}
            <Link
              href={`/${profile.username}`}
              className="underline underline-offset-2 hover:text-fg"
            >
              /{profile.username}
            </Link>
          </>
        }
      />

      <ProfileForm
        profile={profile}
        userId={user.id}
        countryLocked={locked}
        countryUnlocksOn={unlocksAt ? formatDate(unlocksAt.toISOString()) : null}
      />

      <p className="mt-8 text-[13px]">
        <Link href="/dashboard" className="text-muted hover:text-fg">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
