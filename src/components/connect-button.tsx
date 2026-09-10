import { ButtonLink } from "./ui/button";
import { TrackedLink } from "./tracked-link";
import type { Profile } from "@/types/db";

/**
 * Plan §12 - FounderUp has no inbox. Connect opens whichever destination the
 * founder chose, and the click is counted.
 */
export function connectDestination(profile: Profile): string | null {
  switch (profile.contact_type) {
    case "EMAIL":
      return profile.contact_value ? `mailto:${profile.contact_value}` : null;
    case "X":
      return profile.x_url;
    case "LINKEDIN":
      return profile.linkedin_url;
    case "WEBSITE":
    default:
      return profile.website_url;
  }
}

const LABELS: Record<Profile["contact_type"], string> = {
  WEBSITE: "website",
  X: "X",
  LINKEDIN: "LinkedIn",
  EMAIL: "email",
};

export function ConnectButton({ profile }: { profile: Profile }) {
  const href = connectDestination(profile);
  if (!href) return null;

  const isMail = href.startsWith("mailto:");

  if (isMail) {
    // mailto: never opens a new tab, and there is nothing to sandbox.
    return (
      <ButtonLink href={href} size="lg">
        Connect
      </ButtonLink>
    );
  }

  return (
    <TrackedLink
      href={href}
      founderId={profile.id}
      linkType="CONNECT"
      className="inline-flex h-11 items-center justify-center rounded-xl bg-fg px-5 text-[14px] font-bold text-white hover:bg-black shadow-xs transition-all active:scale-[0.98]"
    >
      Connect
    </TrackedLink>
  );
}

export function connectHint(profile: Profile): string {
  return `Opens their ${LABELS[profile.contact_type]}`;
}
