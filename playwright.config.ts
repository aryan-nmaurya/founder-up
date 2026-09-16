import { defineConfig, devices } from "@playwright/test";
import { APP_URL, NO_PAYMENTS_URL, RAZORPAY, serverEnv } from "./e2e/support/env";

const reuse = !process.env.CI;

/**
 * End-to-end suite. `npm run test:e2e` first brings up a dedicated Supabase
 * stack (e2e/stack.mjs); this config then builds the app once and serves it
 * twice - with a stand-in Razorpay, and with no payment keys at all.
 *
 * E2E_SKIP_BUILD=1 reuses the last build while iterating on specs.
 */
export default defineConfig({
  testDir: "./e2e",
  // One shared database and in-process rate limits: tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_URL,
    // PW_CHANNEL=chrome uses an installed Chrome instead of the bundled Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/support/razorpay-mock.mjs",
      url: `${RAZORPAY.mockUrl}/__health`,
      reuseExistingServer: reuse,
      env: { RAZORPAY_KEY_ID: RAZORPAY.keyId, RAZORPAY_KEY_SECRET: RAZORPAY.keySecret },
    },
    {
      command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start -p 3100`,
      url: APP_URL,
      timeout: 300_000,
      reuseExistingServer: reuse,
      env: serverEnv({ payments: true }),
    },
    {
      command: `node e2e/support/wait-for.mjs ${APP_URL} && npx next start -p 3101`,
      url: NO_PAYMENTS_URL,
      timeout: 300_000,
      reuseExistingServer: reuse,
      env: serverEnv({ payments: false }),
    },
  ],
});
