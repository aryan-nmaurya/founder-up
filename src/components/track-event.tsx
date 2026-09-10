"use client";
import { useEffect } from "react";
import { track, type FunnelEvent } from "@/lib/analytics-client";

/** Fires a funnel event once when a page renders. */
export function TrackEvent({
  event,
  properties,
}: {
  event: FunnelEvent;
  properties?: Record<string, unknown>;
}) {
  useEffect(() => {
    track(event, properties);
    // Intentionally fires once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
