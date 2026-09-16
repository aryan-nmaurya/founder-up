import "server-only";
import { requireAdminSupabase, createAdminSupabase } from "./supabase/admin";
import type { LinkType } from "@/types/db";

/**
 * Plan §12, §55 - click and view tracking, written server-side only so the
 * numbers a founder is paying for can't be inflated from the browser.
 */
export async function recordProfileView(founderId: string, visitorHash: string) {
  const supabase = createAdminSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("record_profile_view", {
    p_founder_id: founderId,
    p_visitor_hash: visitorHash,
  });
  if (error) console.error("[track] profile view failed:", error.message);
}

export async function recordClick(
  founderId: string,
  linkType: LinkType,
  ventureId?: string | null,
) {
  const supabase = requireAdminSupabase();
  const { error } = await supabase.rpc("record_click", {
    p_founder_id: founderId,
    p_link_type: linkType,
    p_venture_id: ventureId ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Plan §54 - product funnel events. PostHog is the destination when a key is
 * present; without one this is a no-op so local development stays quiet.
 */
export const FUNNEL_EVENTS = [
  "homepage_view",
  "leaderboard_country_changed",
  "founder_profile_view",
  "venture_clicked",
  "connect_clicked",
  "signup_started",
  "signup_completed",
  "profile_completed",
  "boost_opened",
  "boost_amount_selected",
  "checkout_started",
  "payment_success",
  "payment_pending",
  "payment_unconfirmed",
  "payment_failed",
  "share_rank_clicked",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
