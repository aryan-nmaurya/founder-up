import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase/server";
import type { Profile } from "@/types/db";

/** Deduped per request so a page can ask several times without extra round trips. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  // Private columns (is_admin, auth_user_id, ...) are readable only through
  // current_profile(), which returns the caller's own row. Migration 0007.
  const { data, error } = await supabase.rpc("current_profile").maybeSingle();
  if (error) console.error("[auth] current_profile failed:", error.message);

  return (data as Profile | null) ?? null;
});

/** Signed in, but may not have finished onboarding yet. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/join");
  return user;
}

/** Signed in *and* onboarded. Sends half-finished signups back to onboarding. */
export async function requireProfile(): Promise<Profile> {
  const user = await getSessionUser();
  if (!user) redirect("/join");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");
  if (profile.is_suspended) redirect("/suspended");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/");
  return profile;
}
