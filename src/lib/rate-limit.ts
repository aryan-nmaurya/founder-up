import "server-only";

/**
 * Plan §51 - rate limiting on the endpoints that can be abused.
 *
 * This is an in-process fixed-window counter. On a single server it is exact;
 * on serverless it is per-instance, which still blunts scripted abuse. If
 * FounderUp outgrows that, swap the store for Redis - the call sites don't
 * change.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds };
}

/** Per-endpoint budgets. */
export const RATE_LIMITS = {
  usernameCheck: { limit: 30, window: 60 },
  profileUpdate: { limit: 20, window: 300 },
  ventureWrite: { limit: 40, window: 300 },
  search: { limit: 60, window: 60 },
  boostCreate: { limit: 10, window: 300 },
  boostVerify: { limit: 20, window: 300 },
  report: { limit: 5, window: 3600 },
  track: { limit: 120, window: 60 },
  signup: { limit: 5, window: 3600 },
} as const;

export async function clientKey(prefix: string): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local";
  return `${prefix}:${ip}`;
}
