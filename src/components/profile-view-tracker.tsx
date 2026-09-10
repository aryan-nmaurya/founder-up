"use client";
import { useEffect } from "react";

/**
 * Plan §55 - profile views, counted once per visitor per UTC day (the dedupe
 * happens server-side on a hashed fingerprint, never on a stored IP).
 * Fires from the client so prefetches and crawlers don't inflate the number.
 */
export function ProfileViewTracker({ founderId }: { founderId: string }) {
  useEffect(() => {
    const id = setTimeout(() => {
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ founder_id: founderId, event: "PROFILE_VIEW" }),
        keepalive: true,
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(id);
  }, [founderId]);

  return null;
}
