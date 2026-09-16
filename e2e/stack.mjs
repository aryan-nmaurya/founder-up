#!/usr/bin/env node
// Brings up the dedicated E2E Supabase stack (e2e/stack/supabase/config.toml),
// applies any migrations it hasn't seen yet, and records its URLs and keys in
// e2e/.stack.json for playwright.config.ts.
//
// Safe to run repeatedly: a stack that is already running is reused. It never
// touches the development stack, which lives on different ports and volumes.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.join(here, "stack");

function supabase(args, { capture = false } = {}) {
  try {
    return execFileSync("supabase", [...args, "--workdir", workdir], {
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("The Supabase CLI is required: https://supabase.com/docs/guides/local-development/cli/getting-started");
    }
    throw error;
  }
}

console.log("Starting the E2E Supabase stack (reused if already running)...");
supabase(["start"]);

console.log("Applying pending migrations...");
supabase(["migration", "up", "--local"]);

// `status` can print warnings around the JSON, so take the object itself.
const raw = supabase(["status", "-o", "json"], { capture: true });
const status = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

const stack = {
  apiUrl: status.API_URL,
  dbUrl: status.DB_URL,
  anonKey: status.ANON_KEY,
  serviceRoleKey: status.SERVICE_ROLE_KEY,
  mailpitUrl: status.MAILPIT_URL ?? status.INBUCKET_URL,
};
writeFileSync(path.join(here, ".stack.json"), `${JSON.stringify(stack, null, 2)}\n`);
console.log(`E2E stack ready at ${stack.apiUrl}`);
