import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/validation";
import { clientKey, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/** Plan §51 - username checks are rate limited so the table can't be enumerated. */
export async function GET(request: NextRequest) {
  const limit = rateLimit(
    await clientKey("username"),
    RATE_LIMITS.usernameCheck.limit,
    RATE_LIMITS.usernameCheck.window,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { available: false, reason: "Slow down a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({
      available: false,
      reason: parsed.error.issues[0]?.message ?? "Invalid username",
    });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ available: false, reason: "Not configured" });
  }

  const { data, error } = await supabase.rpc("username_available", {
    p_username: parsed.data,
  });
  if (error) {
    return NextResponse.json({ available: false, reason: "Could not check" });
  }

  return NextResponse.json({
    available: Boolean(data),
    reason: data ? null : "That username is taken or reserved.",
  });
}
