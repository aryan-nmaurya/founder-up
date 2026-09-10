"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/field";
import { track } from "@/lib/analytics-client";

/**
 * Plan §8 - Google and GitHub, plus an email magic link. No passwords, and no
 * X login (founders link their X profile manually instead).
 */
export function AuthButtons({ next }: { next?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserSupabase();
  const configured = Boolean(supabase);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`
      : undefined;

  async function oauth(provider: "google" | "github") {
    if (!supabase) return;
    track("signup_started", { provider });
    setBusy(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy("email");
    setError(null);
    track("signup_started", { provider: "email" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setError(error.message);
    else setSent(true);
    setBusy(null);
  }

  if (!configured) {
    return (
      <div className="rounded-md border border-[#f0d8a8] bg-[#fdf8ee] px-3 py-2.5 text-[13px] text-[#7a5b12]">
        Sign-in needs Supabase credentials. Add them to{" "}
        <code className="rounded bg-white/70 px-1">.env.local</code> and restart.
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-4 text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-[13px] text-muted">
          We sent a sign-in link to {email}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => oauth("google")}
        >
          {busy === "google" ? "Redirecting…" : "Continue with Google"}
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => oauth("github")}
        >
          {busy === "github" ? "Redirecting…" : "Continue with GitHub"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-subtle">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={magicLink} className="space-y-2">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth disabled={busy !== null || !email.trim()}>
          {busy === "email" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      {error ? <p className="text-[13px] text-negative">{error}</p> : null}
    </div>
  );
}
