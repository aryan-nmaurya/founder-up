import { NextResponse } from "next/server";
import { z } from "zod";
import { recordClick, recordProfileView } from "@/lib/analytics";
import { visitorHash } from "@/lib/geo";
import { clientKey, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasServiceRole } from "@/lib/supabase/env";

const schema = z.object({
  founder_id: z.string().uuid(),
  event: z.literal("PROFILE_VIEW").optional(),
  link_type: z
    .enum(["WEBSITE", "X", "LINKEDIN", "GITHUB", "EMAIL", "CONNECT", "VENTURE"])
    .optional(),
  venture_id: z.string().uuid().nullable().optional(),
});

/**
 * Plan §12, §55 - counts what a founder's ranking actually bought them.
 * Written server-side only; the browser can't inflate these numbers freely
 * because the endpoint is rate limited and views dedupe per visitor per day.
 */
export async function POST(request: Request) {
  if (!hasServiceRole()) return NextResponse.json({ ok: true });

  const limit = rateLimit(
    await clientKey("track"),
    RATE_LIMITS.track.limit,
    RATE_LIMITS.track.window,
  );
  if (!limit.ok) return NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  try {
    if (parsed.data.event === "PROFILE_VIEW") {
      const hash = await visitorHash(parsed.data.founder_id);
      await recordProfileView(parsed.data.founder_id, hash);
    } else if (parsed.data.link_type) {
      await recordClick(
        parsed.data.founder_id,
        parsed.data.link_type,
        parsed.data.venture_id ?? null,
      );
    }
  } catch (error) {
    console.error("[track] failed:", error);
  }

  // Always 200 - tracking must never surface to the visitor.
  return NextResponse.json({ ok: true });
}
