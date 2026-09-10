"use client";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire this to Sentry (or equivalent) once a DSN is configured.
    console.error("[founderup] unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        The page didn&apos;t load. No payment or ranking was affected.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[12px] text-subtle">{error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Leaderboard
        </ButtonLink>
      </div>
    </div>
  );
}
