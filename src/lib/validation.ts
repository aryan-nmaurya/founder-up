import { z } from "zod";
import { LIMITS, MAX_AMOUNT_SUBUNIT, MIN_AMOUNT_SUBUNIT } from "./config";
import { isValidCountry } from "./countries";

/**
 * Plan §49 - every external URL is validated. Only http/https survive;
 * javascript: and data: are rejected outright.
 */
export function safeExternalUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  if (url.href.length > LIMITS.url) return null;
  return url.href;
}

/** Plan §50 - user text is stored and rendered as plain text, never HTML. */
export function plainText(
  input: string | null | undefined,
  max: number,
): string | null {
  if (input == null) return null;
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

const optionalUrl = z
  .string()
  .max(LIMITS.url)
  .optional()
  .nullable()
  .transform((v) => safeExternalUrl(v));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.username.min, `At least ${LIMITS.username.min} characters`)
  .max(LIMITS.username.max, `At most ${LIMITS.username.max} characters`)
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only");

export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidCountry, "Choose a country");

export const onboardingSchema = z.object({
  username: usernameSchema,
  full_name: z.string().trim().min(1, "Enter your name").max(LIMITS.fullName),
  country_code: countrySchema,
  headline: z.string().trim().max(LIMITS.headline).optional().or(z.literal("")),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(LIMITS.fullName),
  username: usernameSchema,
  country_code: countrySchema,
  headline: z.string().trim().max(LIMITS.headline).optional().or(z.literal("")),
  bio: z.string().trim().max(LIMITS.bio).optional().or(z.literal("")),
  website_url: optionalUrl,
  x_url: optionalUrl,
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  contact_type: z.enum(["WEBSITE", "X", "LINKEDIN", "EMAIL"]),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});

export const ventureSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["PROJECT", "BUSINESS"]),
  name: z.string().trim().min(1, "Name is required").max(LIMITS.ventureName),
  description: z
    .string()
    .trim()
    .max(LIMITS.ventureDescription)
    .optional()
    .or(z.literal("")),
  url: optionalUrl,
});

export const reportSchema = z.object({
  profile_id: z.string().uuid(),
  reason: z.enum([
    "IMPERSONATION",
    "SPAM",
    "SCAM",
    "ILLEGAL",
    "EXPLICIT",
    "HATE",
    "MISLEADING_LINK",
    "OTHER",
  ]),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Plan §18 - the server never trusts a browser-supplied amount. It is
 * re-validated against the currency minimum before an order is created.
 */
export const boostRequestSchema = z
  .object({
    amount_subunit: z.number().int().positive(),
    currency: z.enum(["INR", "USD"]),
    // The profile the dialog believes it is boosting. Compared with the
    // session, never used as the target.
    founder_id: z.string().uuid(),
  })
  .superRefine((val, ctx) => {
    const min = MIN_AMOUNT_SUBUNIT[val.currency];
    const max = MAX_AMOUNT_SUBUNIT[val.currency];
    if (val.amount_subunit < min) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_subunit"],
        message: `Minimum boost is ${val.currency === "INR" ? "₹100" : "$1"}`,
      });
    }
    if (val.amount_subunit > max) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_subunit"],
        message: "That amount is above the per-boost limit",
      });
    }
  });

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something in that form isn't valid";
}
