import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthButtons } from "@/components/auth-buttons";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Join ${APP_NAME}`,
  description: "Show what you're building. Climb the leaderboard.",
  alternates: { canonical: "/join" },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const user = await getSessionUser();
  if (user) {
    const profile = await getCurrentProfile();
    redirect(profile ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="mx-auto max-w-sm py-6">
      <div className="text-center">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Join {APP_NAME}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Show what you&apos;re building. Climb the leaderboard.
        </p>
      </div>

      <div className="mt-7">
        <AuthButtons next={next} />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-subtle">
        Creating a profile is free. Ranking is determined by paid Rank Points.
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
