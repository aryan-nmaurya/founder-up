"use server";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { onboardingSchema, ventureSchema, firstError, plainText } from "@/lib/validation";
import { LIMITS } from "@/lib/config";
import { clientKey, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export type ActionState = { error?: string; ok?: boolean };

/** Plan §9 steps 2-3 - username, name, country, headline. */
export async function createProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You need to sign in first." };

  const limit = rateLimit(
    await clientKey("signup"),
    RATE_LIMITS.signup.limit,
    RATE_LIMITS.signup.window,
  );
  if (!limit.ok) return { error: "Too many attempts. Try again shortly." };

  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    full_name: formData.get("full_name"),
    country_code: formData.get("country_code"),
    headline: formData.get("headline"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  const { error } = await supabase.rpc("create_founder_profile", {
    p_username: parsed.data.username,
    p_full_name: parsed.data.full_name,
    p_country_code: parsed.data.country_code,
    p_headline: plainText(parsed.data.headline ?? "", LIMITS.headline),
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("USERNAME_TAKEN")) return { error: "That username is taken." };
    if (message.includes("USERNAME_RESERVED")) return { error: "That username is reserved." };
    if (message.includes("PROFILE_EXISTS")) redirect("/dashboard");
    console.error("[onboarding] create_founder_profile failed:", message);
    return { error: "Could not create your profile. Please try again." };
  }

  redirect("/onboarding/building");
}

/** Plan §9 step 4 - what you're building. Skippable. */
export async function addFirstVentureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You need to sign in first." };

  const parsed = ventureSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Database is not configured." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { error } = await supabase.from("ventures").insert({
    founder_id: (profile as { id: string }).id,
    type: parsed.data.type,
    name: parsed.data.name,
    description: plainText(parsed.data.description ?? "", LIMITS.ventureDescription),
    url: parsed.data.url,
  });

  if (error) {
    if (error.message.includes("VENTURE_LIMIT_REACHED")) {
      return { error: "You've reached the limit of 5 ventures." };
    }
    return { error: "Could not save that. Please try again." };
  }

  redirect("/dashboard?welcome=1");
}
