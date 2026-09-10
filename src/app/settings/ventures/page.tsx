import type { Metadata } from "next";
import Link from "next/link";
import { VenturesManager } from "@/components/ventures-form";
import { PageHeader } from "@/components/ui/misc";
import { requireProfile } from "@/lib/auth";
import { getOwnVentures } from "@/lib/db";
import { MAX_VENTURES_PER_FOUNDER } from "@/lib/config";

export const metadata: Metadata = {
  title: "Manage projects",
  robots: { index: false, follow: false },
};

export default async function VenturesSettingsPage() {
  const profile = await requireProfile();
  const ventures = await getOwnVentures(profile.id);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="What you're building"
        subtitle={`Projects and businesses shown on your profile. Up to ${MAX_VENTURES_PER_FOUNDER}.`}
      />

      <VenturesManager ventures={ventures} />

      <p className="mt-8 text-[13px]">
        <Link href="/dashboard" className="text-muted hover:text-fg">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
