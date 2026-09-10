import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-[15px] text-muted">
        That page doesn&apos;t exist on FounderUp.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/">Back to the leaderboard</ButtonLink>
      </div>
    </div>
  );
}
