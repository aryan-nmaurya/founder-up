import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderAvatar } from "@/components/founder-avatar";
import { FounderRank } from "@/components/founder-rank";
import { VentureItem } from "@/components/venture-item";
import { ConnectButton, connectHint } from "@/components/connect-button";
import { TrackedLink } from "@/components/tracked-link";
import { ShareRank } from "@/components/share-rank";
import { ReportDialog } from "@/components/report-dialog";
import { ProfileViewTracker } from "@/components/profile-view-tracker";
import { TrackEvent } from "@/components/track-event";
import { ButtonLink } from "@/components/ui/button";
import { BoostDialog } from "@/components/boost-dialog";
import { getProfileByUsername, getVentures } from "@/lib/db";
import { getFounderRanks, getNextRankGap } from "@/lib/ranking";
import { getCurrentProfile } from "@/lib/auth";
import { countryName, flagFor } from "@/lib/countries";
import { formatPoints, displayUrl } from "@/lib/format";
import { APP_NAME, APP_URL } from "@/lib/config";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EarlyFounderBadge } from "@/components/early-founder-badge";

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile || profile.is_suspended) {
    return { title: "Founder not found", robots: { index: false, follow: false } };
  }

  const ventures = await getVentures(profile.id);
  const country = countryName(profile.country_code);
  const title = `${profile.full_name} — Founder in ${country}`;

  const built = ventures.map((v) => v.name).slice(0, 2).join(" and ");
  const description = built
    ? `Discover ${profile.full_name}, founder of ${built}. See what they're building on ${APP_NAME}.`
    : profile.headline
      ? `${profile.full_name} — ${profile.headline}. See what they're building on ${APP_NAME}.`
      : `Discover ${profile.full_name}, a founder in ${country} on ${APP_NAME}.`;

  return {
    title,
    description,
    alternates: { canonical: `/${profile.username}` },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `${APP_URL}/${profile.username}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function FounderProfilePage({ params }: { params: Params }) {
  const { username } = await params;

  const [publicProfile, viewer] = await Promise.all([
    getProfileByUsername(username),
    getCurrentProfile(),
  ]);

  const profile =
    publicProfile ??
    (viewer?.username === username.toLowerCase() ? viewer : null);
  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;
  if (profile.is_suspended && !isOwner) notFound();

  const [ventures, ranks, gap] = await Promise.all([
    getVentures(profile.id),
    getFounderRanks(profile.id),
    getNextRankGap(profile.id),
  ]);

  const projects = ventures.filter((v) => v.type === "PROJECT" && v.status === "ACTIVE");
  const businesses = ventures.filter((v) => v.type === "BUSINESS" && v.status === "ACTIVE");

  const socials = [
    { label: "X", url: profile.x_url, type: "X" as const },
    { label: "LinkedIn", url: profile.linkedin_url, type: "LINKEDIN" as const },
    { label: "GitHub", url: profile.github_url, type: "GITHUB" as const },
  ].filter((s) => Boolean(s.url));

  return (
    <div className="mx-auto max-w-(--container-narrow) py-2 sm:py-6">
      {!isOwner ? <ProfileViewTracker founderId={profile.id} /> : null}
      <TrackEvent event="founder_profile_view" />

      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to leaderboard</span>
        </Link>
      </div>

      {profile.is_suspended ? (
        <div className="mb-6 rounded-xl border border-negative/20 bg-negative/5 px-4 py-3 text-[13px] font-medium text-negative">
          This profile is suspended and hidden from FounderUp.
        </div>
      ) : null}

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* 80px Avatar */}
            <div className="relative shrink-0">
              <FounderAvatar
                src={profile.avatar_url}
                name={profile.full_name}
                size={84}
                className="ring-4 ring-border shadow-xs"
              />
              {profile.is_verified && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white shadow-xs"
                  title="Verified founder"
                >
                  ✓
                </span>
              )}
            </div>

            {/* Name, Flag, Headline */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-fg">
                  {profile.full_name}
                </h1>
                <span className="text-[20px] leading-none" title={profile.country_code}>
                  {flagFor(profile.country_code)}
                </span>
                {profile.is_early_founder && (
                  <EarlyFounderBadge number={profile.founder_number} />
                )}
              </div>

              <p className="mt-1 text-[14px] font-semibold text-muted">
                {countryName(profile.country_code)}
              </p>

              {profile.headline ? (
                <p className="mt-2 text-[15px] sm:text-[16px] font-medium text-fg/90">
                  {profile.headline}
                </p>
              ) : null}
            </div>
          </div>

          {/* Rank Pills Card */}
          <div className="shrink-0 sm:text-right">
            <div className="inline-flex flex-col sm:items-end rounded-xl border border-border bg-surface p-3 sm:px-4 sm:py-3 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Leaderboard Rank
              </span>
              <div className="mt-1">
                <FounderRank
                  globalRank={ranks?.global_rank ?? null}
                  countryRank={ranks?.country_rank ?? null}
                  countryCode={profile.country_code}
                  cta={
                    isOwner ? (
                      <Link
                        href="/dashboard"
                        className="inline-flex h-7 items-center rounded-lg bg-fg px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-black"
                      >
                        Get ranked
                      </Link>
                    ) : null
                  }
                />
              </div>
              <span className="mt-1 text-[13px] font-extrabold text-fg tabular">
                {formatPoints(profile.total_rank_points)}{" "}
                <span className="text-[11px] font-semibold text-accent">RP</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio ? (
          <p className="mt-6 whitespace-pre-line text-[14px] sm:text-[15px] leading-relaxed text-muted border-t border-border/80 pt-5">
            {profile.bio}
          </p>
        ) : null}

        {/* Primary Action Buttons: Website & Connect */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5">
          <ConnectButton profile={profile} />

          {profile.website_url ? (
            <TrackedLink
              href={profile.website_url}
              founderId={profile.id}
              linkType="WEBSITE"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong bg-white px-5 text-[14px] font-semibold text-fg hover:bg-surface transition-all shadow-2xs"
            >
              <span>{displayUrl(profile.website_url)}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </TrackedLink>
          ) : null}

          {/* Social text links */}
          {socials.length > 0 ? (
            <div className="flex items-center gap-3 ml-auto text-[13px] font-semibold">
              {socials.map((s) => (
                <TrackedLink
                  key={s.label}
                  href={s.url as string}
                  founderId={profile.id}
                  linkType={s.type}
                  className="text-muted underline underline-offset-4 hover:text-fg transition-colors"
                >
                  {s.label}
                </TrackedLink>
              ))}
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-[12px] text-subtle">{connectHint(profile)}</p>
      </div>

      {/* Building Section (Ventures) */}
      {(projects.length > 0 || businesses.length > 0) && (
        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">
              Building
            </h2>
            <span className="text-[12px] font-semibold text-subtle tabular">
              {projects.length + businesses.length} active ventures
            </span>
          </div>

          <div className="space-y-3">
            {projects.map((v) => (
              <VentureItem key={v.id} venture={v} founderId={profile.id} />
            ))}
            {businesses.map((v) => (
              <VentureItem key={v.id} venture={v} founderId={profile.id} />
            ))}
          </div>
        </section>
      )}

      {/* Rank Boost & Share Section */}
      <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-fg tracking-tight">
              Rank Points Visibility
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              Founders boost their visibility on the public leaderboard through Rank Points.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {isOwner ? (
              <div className="flex items-center gap-2">
                <BoostDialog
                  ranks={ranks}
                  gap={gap}
                  founderName={profile.full_name}
                  founderEmail="founder@example.com"
                  username={profile.username}
                  countryCode={profile.country_code}
                  razorpayEnabled={Boolean(process.env.RAZORPAY_KEY_ID)}
                  triggerLabel="Boost your rank ↑"
                />
                <ButtonLink href="/settings/profile" variant="secondary" size="md">
                  Edit profile
                </ButtonLink>
              </div>
            ) : (
              <BoostDialog
                ranks={ranks}
                gap={gap}
                founderName={profile.full_name}
                founderEmail="founder@example.com"
                username={profile.username}
                countryCode={profile.country_code}
                razorpayEnabled={Boolean(process.env.RAZORPAY_KEY_ID)}
                triggerLabel="Boost this founder ↑"
              />
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border max-w-sm">
          <ShareRank
            username={profile.username}
            globalRank={ranks?.global_rank ?? null}
            countryRank={ranks?.country_rank ?? null}
            countryCode={profile.country_code}
            ventureName={projects[0]?.name ?? businesses[0]?.name ?? null}
          />
        </div>
      </section>

      {/* Footer link & Report Dialog */}
      <div className="mt-8 flex items-center justify-between border-t border-border/80 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-fg transition-colors"
        >
          ← Leaderboard
        </Link>
        {!isOwner ? <ReportDialog profileId={profile.id} /> : null}
      </div>
    </div>
  );
}
