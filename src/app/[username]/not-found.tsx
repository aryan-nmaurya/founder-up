import { ButtonLink } from "@/components/ui/button";

export default function FounderNotFound() {
  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight">
        No founder here
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        That username isn&apos;t on FounderUp, or the profile has been removed.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href="/">Browse the leaderboard</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search founders
        </ButtonLink>
      </div>
    </div>
  );
}
