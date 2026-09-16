import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Stack = {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  mailpitUrl: string;
};

const STACK_FILE = path.resolve(__dirname, "..", ".stack.json");

function loadStack(): Stack {
  if (!existsSync(STACK_FILE)) {
    throw new Error(
      "e2e/.stack.json is missing. `npm run test:e2e` creates it, or run `node e2e/stack.mjs`.",
    );
  }
  const stack = JSON.parse(readFileSync(STACK_FILE, "utf8")) as Stack;

  // The suite resets this database before every run. Never let that be
  // anything but a stack on this machine.
  for (const url of [stack.apiUrl, stack.dbUrl, stack.mailpitUrl]) {
    const host = new URL(url).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error(`Refusing to run the E2E suite against a non-local service: ${url}`);
    }
  }
  return stack;
}

export const stack = loadStack();

/** The app, with the stand-in Razorpay wired in. */
export const APP_URL = "http://localhost:3100";

/** The same build with no Razorpay keys at all. */
export const NO_PAYMENTS_URL = "http://localhost:3101";

/** Test-mode credentials for the stand-in Razorpay. Never real keys. */
export const RAZORPAY = {
  keyId: "rzp_test_founderupe2e",
  keySecret: "e2e-checkout-secret",
  webhookSecret: "e2e-webhook-secret",
  mockUrl: "http://127.0.0.1:3199",
} as const;

/**
 * Everything the app reads from its environment, set explicitly so nothing
 * leaks in from .env.local - process env wins over .env files in Next.js.
 */
export function serverEnv({ payments }: { payments: boolean }): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_URL: APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    NEXT_PUBLIC_POSTHOG_KEY: "",
    SENTRY_DSN: "",
    RAZORPAY_KEY_ID: payments ? RAZORPAY.keyId : "",
    RAZORPAY_KEY_SECRET: payments ? RAZORPAY.keySecret : "",
    RAZORPAY_WEBHOOK_SECRET: payments ? RAZORPAY.webhookSecret : "",
    RAZORPAY_API_BASE_URL: payments ? `${RAZORPAY.mockUrl}/v1` : "",
  };
}
