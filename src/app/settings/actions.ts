"use server";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  firstError,
  plainText,
  profileSchema,
  ventureSchema,
} from "@/lib/validation";
import { COUNTRY_CHANGE_COOLDOWN_DAYS, LIMITS } from "@/lib/config";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { safeExternalUrl } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean; message?: string };

/** Plan §29 - one Save button for the whole profile. */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to sign in." };

  const limit = rateLimit(
    `profile:${profile.id}`,
    RATE_LIMITS.profileUpdate.limit,
    RATE_LIMITS.profileUpdate.window,
  );
  if (!limit.ok) return { error: "Too many changes at once. Try again shortly." };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    country_code: formData.get("country_code"),
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    website_url: formData.get("website_url"),
    x_url: formData.get("x_url"),
    linkedin_url: formData.get("linkedin_url"),
    github_url: formData.get("github_url"),
    contact_type: formData.get("contact_type"),
    contact_email: formData.get("contact_email"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  // The chosen Connect destination has to actually exist.
  const destinations = {
    WEBSITE: data.website_url,
    X: data.x_url,
    LINKEDIN: data.linkedin_url,
    EMAIL: data.contact_email || null,
  } as const;
  if (!destinations[data.contact_type]) {
    return {
      error: `Add your ${data.contact_type.toLowerCase()} before choosing it as your Connect link.`,
    };
  }

  // Username and country go through their own guarded functions.
  if (data.username !== profile.username) {
    const { error } = await supabase.rpc("change_username", {
      p_username: data.username,
    });
    if (error) {
      if (error.message.includes("USERNAME_TAKEN")) return { error: "That username is taken." };
      if (error.message.includes("USERNAME_RESERVED")) return { error: "That username is reserved." };
      return { error: "Could not change your username." };
    }
  }

  if (data.country_code !== profile.country_code) {
    const { error } = await supabase.rpc("change_country", {
      p_country_code: data.country_code,
      p_cooldown_days: COUNTRY_CHANGE_COOLDOWN_DAYS,
    });
    if (error) {
      if (error.message.includes("COUNTRY_COOLDOWN")) {
        return {
          error: `You can only change your country once every ${COUNTRY_CHANGE_COOLDOWN_DAYS} days.`,
        };
      }
      return { error: "Could not change your country." };
    }
  }

  const avatarUrl = formData.get("avatar_url");

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name,
      headline: plainText(data.headline ?? "", LIMITS.headline),
      bio: plainText(data.bio ?? "", LIMITS.bio),
      website_url: data.website_url,
      x_url: data.x_url,
      linkedin_url: data.linkedin_url,
      github_url: data.github_url,
      contact_type: data.contact_type,
      contact_value: data.contact_type === "EMAIL" ? data.contact_email : null,
      ...(typeof avatarUrl === "string" && avatarUrl
        ? { avatar_url: safeExternalUrl(avatarUrl) }
        : {}),
    })
    .eq("id", profile.id);

  if (error) {
    console.error("[settings] profile update failed:", error.message);
    return { error: "Could not save your profile." };
  }

  revalidatePath("/settings/profile");
  revalidatePath(`/${data.username}`);
  return { ok: true, message: "Saved" };
}

export async function saveVentureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to sign in." };

  const limit = rateLimit(
    `venture:${profile.id}`,
    RATE_LIMITS.ventureWrite.limit,
    RATE_LIMITS.ventureWrite.window,
  );
  if (!limit.ok) return { error: "Too many changes at once. Try again shortly." };

  const rawId = formData.get("id");
  const parsed = ventureSchema.safeParse({
    id: typeof rawId === "string" && rawId ? rawId : undefined,
    type: formData.get("type"),
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  const payload = {
    type: parsed.data.type,
    name: parsed.data.name,
    description: plainText(parsed.data.description ?? "", LIMITS.ventureDescription),
    url: parsed.data.url,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("ventures")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("founder_id", profile.id)
    : await supabase
        .from("ventures")
        .insert({ ...payload, founder_id: profile.id });

  if (error) {
    if (error.message.includes("VENTURE_LIMIT_REACHED")) {
      return { error: "You've reached the limit of 5 ventures." };
    }
    console.error("[settings] venture save failed:", error.message);
    return { error: "Could not save that." };
  }

  revalidatePath("/settings/ventures");
  revalidatePath(`/${profile.username}`);
  return { ok: true, message: "Saved" };
}

export async function deleteVentureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to sign in." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Nothing to delete." };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  const { error } = await supabase
    .from("ventures")
    .delete()
    .eq("id", id)
    .eq("founder_id", profile.id);

  if (error) return { error: "Could not delete that." };

  revalidatePath("/settings/ventures");
  revalidatePath(`/${profile.username}`);
  return { ok: true, message: "Deleted" };
}

/** Plan §11 - reorder controls how ventures appear on the public profile. */
export async function reorderVentureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to sign in." };

  const id = formData.get("id");
  const direction = formData.get("direction");
  if (typeof id !== "string" || (direction !== "up" && direction !== "down")) {
    return { error: "Invalid request." };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, sort_order")
    .eq("founder_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!ventures) return { error: "Could not reorder." };

  const list = ventures as { id: string; sort_order: number }[];
  const index = list.findIndex((v) => v.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return { ok: true };

  [list[index], list[target]] = [list[target], list[index]];

  await Promise.all(
    list.map((venture, position) =>
      supabase
        .from("ventures")
        .update({ sort_order: position })
        .eq("id", venture.id)
        .eq("founder_id", profile.id),
    ),
  );

  revalidatePath("/settings/ventures");
  revalidatePath(`/${profile.username}`);
  return { ok: true };
}
