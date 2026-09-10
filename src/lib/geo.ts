import "server-only";
import { cookies, headers } from "next/headers";
import { CURRENCIES, type Currency } from "./config";

export const CURRENCY_COOKIE = "fu_currency";

/**
 * Plan §5 - country comes from the hosting provider's geo header.
 * We deliberately read only the country code and never store the IP.
 */
export async function detectCountry(): Promise<string | null> {
  const h = await headers();
  const candidate =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code") ??
    null;
  if (!candidate) return null;
  const code = candidate.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Plan §4 - India defaults to INR, everyone else to USD. A manual choice is
 * remembered in a cookie and is never silently overridden afterwards.
 */
export async function resolveCurrency(): Promise<{
  currency: Currency;
  source: "preference" | "geo" | "default";
  country: string | null;
}> {
  const cookieStore = await cookies();
  const preferred = cookieStore.get(CURRENCY_COOKIE)?.value?.toUpperCase();
  const country = await detectCountry();

  if (preferred && (CURRENCIES as readonly string[]).includes(preferred)) {
    return { currency: preferred as Currency, source: "preference", country };
  }
  if (country === "IN") return { currency: "INR", source: "geo", country };
  if (country) return { currency: "USD", source: "geo", country };
  return { currency: "USD", source: "default", country: null };
}

/**
 * A coarse, rotating visitor fingerprint for de-duplicating profile views.
 * Deliberately not reversible and not stored alongside the raw IP.
 */
export async function visitorHash(salt: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const ua = h.get("user-agent") ?? "unknown";
  const data = new TextEncoder().encode(`${salt}:${ip}:${ua}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
