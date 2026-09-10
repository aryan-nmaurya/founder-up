import { COUNTRY_CHANGE_COOLDOWN_DAYS } from "./config";

export type CountryCooldown = { locked: boolean; unlocksAt: Date | null };

/**
 * Plan §30 - country can be changed once every 30 days.
 *
 * Lives outside the component so the current time is read in a plain module
 * function rather than during render.
 */
export function countryCooldown(
  countryChangedAt: string | null,
  now: number = Date.now(),
): CountryCooldown {
  if (!countryChangedAt) return { locked: false, unlocksAt: null };

  const unlocksAt = new Date(
    new Date(countryChangedAt).getTime() +
      COUNTRY_CHANGE_COOLDOWN_DAYS * 86_400_000,
  );
  return { locked: unlocksAt.getTime() > now, unlocksAt };
}
