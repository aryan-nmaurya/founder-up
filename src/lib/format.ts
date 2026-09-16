import { CURRENCY_SYMBOL, type Currency } from "./config";

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(points)));
}

/** Amounts are stored in subunits (paise / cents). */
export function formatMoney(subunit: number, currency: Currency): string {
  const major = subunit / 100;
  const fractionDigits = Number.isInteger(major) ? 0 : 2;
  return `${CURRENCY_SYMBOL[currency]}${new Intl.NumberFormat(
    currency === "INR" ? "en-IN" : "en-US",
    { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 },
  ).format(major)}`;
}

export function formatRank(rank: number | null | undefined): string {
  return rank == null ? "Unranked" : `#${rank}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelative(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** How long something has lasted: "3d 4h", "4h 12m", "12m 5s", "5s". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Hostname only, for showing links without the noise. */
export function displayUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Plan §2 - Today is a UTC day, identical for every visitor. */
export function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(0, Math.floor((next - now.getTime()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
