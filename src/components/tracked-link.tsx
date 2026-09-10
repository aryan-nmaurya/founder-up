"use client";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics-client";
import type { LinkType } from "@/types/db";

/**
 * Plan §12 - outbound clicks are counted so a founder can see what their
 * ranking actually bought them. Plan §49 - external links always carry
 * rel="noopener noreferrer".
 *
 * The beacon is fire-and-forget; a failed count must never block the click.
 */
export function TrackedLink({
  href,
  founderId,
  linkType,
  ventureId,
  className,
  children,
}: {
  href: string;
  founderId: string;
  linkType: LinkType;
  ventureId?: string;
  className?: string;
  children: ReactNode;
}) {
  function onClick() {
    if (linkType === "VENTURE") track("venture_clicked");
    else if (linkType === "CONNECT") track("connect_clicked");
    try {
      const body = JSON.stringify({
        founder_id: founderId,
        link_type: linkType,
        venture_id: ventureId ?? null,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track", { method: "POST", body, keepalive: true });
      }
    } catch {
      // Never let analytics break navigation.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={className}
    >
      {children}
    </a>
  );
}
