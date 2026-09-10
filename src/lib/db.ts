import "server-only";
import { createServerSupabase } from "./supabase/server";
import { createPublicSupabase } from "./supabase/public";
import type {
  BoostOrder,
  FounderStats,
  Payment,
  Profile,
  SearchRow,
  Venture,
} from "@/types/db";

/** Public data, read as `anon`. Never reads cookies - see supabase/public.ts. */
function reader() {
  return createPublicSupabase();
}

import {
  getMockProfileByUsername,
  getMockVentures,
  getMockActiveCountries,
} from "./mock-data";

export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const supabase = reader();
  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (data) return data as Profile;
  }
  return getMockProfileByUsername(username);
}

export async function getVentures(founderId: string): Promise<Venture[]> {
  const supabase = reader();
  if (supabase) {
    const { data } = await supabase
      .from("ventures")
      .select("*")
      .eq("founder_id", founderId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (data && data.length > 0) return data as Venture[];
  }
  return getMockVentures(founderId);
}

/** Owner view - includes hidden ventures. */
export async function getOwnVentures(founderId: string): Promise<Venture[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("ventures")
    .select("*")
    .eq("founder_id", founderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Venture[];
}

/** Plan §55 - what a founder gets for their money. */
export async function getFounderStats(
  founderId: string,
): Promise<FounderStats> {
  const supabase = reader();
  const empty = { profile_views: 0, website_clicks: 0, connect_clicks: 0 };
  if (!supabase) return empty;
  const { data, error } = await supabase.rpc("founder_stats", {
    p_founder_id: founderId,
  });
  if (error || !data?.length) return empty;
  const row = data[0] as Record<string, number | string>;
  return {
    profile_views: Number(row.profile_views ?? 0),
    website_clicks: Number(row.website_clicks ?? 0),
    connect_clicks: Number(row.connect_clicks ?? 0),
  };
}

/** Plan §61 - boost history. */
export async function getPaymentHistory(
  founderId: string,
  limit = 25,
): Promise<Payment[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("founder_id", founderId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Payment[];
}

export async function getOpenBoostOrders(
  founderId: string,
): Promise<BoostOrder[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("boost_orders")
    .select("*")
    .eq("founder_id", founderId)
    .eq("status", "CREATED")
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as BoostOrder[];
}

/** Plan §44 - name, username or venture name. Country is the only filter. */
export async function searchFounders(
  query: string,
  country: string | null,
  limit = 25,
): Promise<SearchRow[]> {
  const supabase = reader();
  if (!supabase) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("search_founders", {
    p_query: trimmed,
    p_country: country,
    p_limit: limit,
  });
  if (error) {
    console.error("[search] failed:", error.message);
    return [];
  }
  return (data ?? []) as SearchRow[];
}

/** Countries that actually have ranked founders, for the country picker. */
export async function getActiveCountries(): Promise<string[]> {
  const supabase = reader();
  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("country_code")
      .gt("total_rank_points", 0)
      .eq("is_suspended", false);
    if (data && data.length > 0) {
      return [...new Set(data.map((r) => (r as { country_code: string }).country_code))];
    }
  }
  return getMockActiveCountries();
}

export async function getAllUsernames(limit = 5000): Promise<
  { username: string; updated_at: string }[]
> {
  const supabase = reader();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .eq("is_suspended", false)
    .order("total_rank_points", { ascending: false })
    .limit(limit);
  return (data ?? []) as { username: string; updated_at: string }[];
}
