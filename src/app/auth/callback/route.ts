import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Exchanges the OAuth / magic-link code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/join?error=${encodeURIComponent(error)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/join`);
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(`${origin}/join`);

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/join?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Send half-finished signups to onboarding, everyone else onward.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    if (!profile) return NextResponse.redirect(`${origin}/onboarding`);
  }

  const safeNext = next && next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
