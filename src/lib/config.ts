/**
 * Central product configuration.
 * Values here mirror the decisions in Docs/implementation_plan.md.
 */

export const APP_NAME = "FounderUp";
export const APP_TAGLINE = "The leaderboard for founders.";
export const APP_DESCRIPTION =
  "Discover founders, see what they're building, and connect.";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

/** Plan §4 — currency rules. Amounts are in subunits (paise / cents). */
export const CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MIN_AMOUNT_SUBUNIT: Record<Currency, number> = {
  INR: 10_000, // Rs.100
  USD: 100, // $1
};

export const MAX_AMOUNT_SUBUNIT: Record<Currency, number> = {
  INR: 50_00_000, // Rs.5,00,000 per boost
  USD: 600_000, // $6,000 per boost
};

export const AMOUNT_PRESETS_SUBUNIT: Record<Currency, number[]> = {
  INR: [10_000, 25_000, 50_000, 100_000, 250_000],
  USD: [100, 500, 1_000, 2_500, 5_000],
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

/**
 * Plan §16 — used only to *estimate* the RP a USD boost will yield, for UI copy.
 * The authoritative conversion is Razorpay's `base_amount` at capture time.
 */
export const USD_TO_INR_ESTIMATE = Number(
  process.env.NEXT_PUBLIC_USD_INR_ESTIMATE ?? 88,
);

/** Plan §11 */
export const MAX_VENTURES_PER_FOUNDER = 5;

/** Plan §10 */
export const LIMITS = {
  fullName: 60,
  username: { min: 3, max: 30 },
  headline: 80,
  bio: 500,
  ventureName: 60,
  ventureDescription: 160,
  url: 300,
} as const;

/** Plan §30 — country changes are rate-limited to blunt regional gaming. */
export const COUNTRY_CHANGE_COOLDOWN_DAYS = 30;

/** Plan §45 */
export const LEADERBOARD_PAGE_SIZE = 50;

/** Plan §56 — brief cache on public leaderboard reads. */
export const LEADERBOARD_CACHE_SECONDS = 20;

/** Plan §57 */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@founderup.com";

/** Plan §37 — shown next to every leaderboard. */
export const RANKING_DISCLOSURE =
  "Rank is determined by paid Rank Points. Paying for Rank Points increases visibility; ranking does not represent FounderUp's endorsement or an objective measure of founder quality.";

/** All boosts are final — FounderUp does not offer refunds. */
export const REFUND_POLICY_SUMMARY =
  "Rank Points are delivered instantly and are non-refundable. All boosts are final.";
