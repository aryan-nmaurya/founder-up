import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { reportSchema, plainText } from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/** Plan §47 - reporting is available to signed-in founders and reviewed manually. */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "Sign in to report a profile." },
      { status: 401 },
    );
  }

  const limit = rateLimit(
    `report:${profile.id}`,
    RATE_LIMITS.report.limit,
    RATE_LIMITS.report.window,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You've sent several reports recently. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  }
  if (parsed.data.profile_id === profile.id) {
    return NextResponse.json(
      { error: "You can't report your own profile." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: profile.id,
    profile_id: parsed.data.profile_id,
    reason: parsed.data.reason,
    details: plainText(parsed.data.details ?? "", 1000),
  });

  if (error) {
    console.error("[report] insert failed:", error.message);
    return NextResponse.json({ error: "Could not send that report." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
