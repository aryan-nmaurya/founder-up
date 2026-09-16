"use client";

/**
 * Plan §54 - product funnel events.
 *
 * PostHog is the destination when NEXT_PUBLIC_POSTHOG_KEY is set. Without a key
 * every call is a no-op, so local development stays quiet and nothing is sent
 * from a deployment that hasn't opted in. The library is loaded lazily and only
 * once, so it never sits in the critical path of the leaderboard.
 */
export type FunnelEvent =
  | "homepage_view"
  | "leaderboard_country_changed"
  | "founder_profile_view"
  | "venture_clicked"
  | "connect_clicked"
  | "signup_started"
  | "signup_completed"
  | "profile_completed"
  | "boost_opened"
  | "boost_amount_selected"
  | "checkout_started"
  | "payment_success"
  | "payment_pending"
  | "payment_unconfirmed"
  | "payment_failed"
  | "share_rank_clicked";

type PostHog = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    posthog?: PostHog;
  }
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let loading: Promise<PostHog | null> | null = null;

async function client(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return null;
  if (window.posthog) return window.posthog;

  loading ??= import("posthog-js")
    .then((module) => {
      const posthog = module.default as unknown as PostHog;
      posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: false,
        // Plan §51 privacy posture: no session recording, no autocapture.
        autocapture: false,
        disable_session_recording: true,
        // Funnel events are intentionally session-scoped; do not assign a
        // durable browser identity that could become a visitor profile.
        persistence: "memory",
      });
      window.posthog = posthog;
      return posthog;
    })
    .catch(() => null);

  return loading;
}

export function track(event: FunnelEvent, properties?: Record<string, unknown>) {
  if (!KEY) return;
  void client().then((posthog) => posthog?.capture(event, properties));
}
