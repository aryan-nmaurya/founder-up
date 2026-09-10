"use client";
import { useActionState, useEffect, useState } from "react";
import { APP_URL, LIMITS } from "@/lib/config";
import { createProfileAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/field";
import { CountrySelect } from "./country-select";

const initial: ActionState = {};
const host = APP_URL.replace(/^https?:\/\//, "");

export function OnboardingForm({
  defaultName,
  defaultCountry,
  suggestedUsername,
}: {
  defaultName: string;
  defaultCountry: string;
  suggestedUsername: string;
}) {
  const [state, action, pending] = useActionState(createProfileAction, initial);
  const [username, setUsername] = useState(suggestedUsername);
  const [check, setCheck] = useState<{ available: boolean; reason: string | null } | null>(
    null,
  );

  // Live availability, debounced. Plan §9 validation rules are enforced again
  // on the server, this is only to save the founder a round trip.
  useEffect(() => {
    // Every state update happens in the timeout callback, never synchronously
    // in the effect body.
    const id = setTimeout(async () => {
      if (username.length < LIMITS.username.min) {
        setCheck(null);
        return;
      }
      try {
        const res = await fetch(`/api/username/check?u=${encodeURIComponent(username)}`);
        setCheck(await res.json());
      } catch {
        setCheck(null);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [username]);

  return (
    <form action={action} className="space-y-5">
      <Field
        label="Username"
        htmlFor="username"
        hint={`Your profile will live at ${host}/${username || "yourname"}`}
        error={check && !check.available ? check.reason : null}
      >
        <Input
          id="username"
          name="username"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={LIMITS.username.min}
          maxLength={LIMITS.username.max}
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
        />
      </Field>

      {check?.available ? (
        <p className="-mt-3 text-[12px] text-positive">{username} is available</p>
      ) : null}

      <Field label="Full name" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          required
          maxLength={LIMITS.fullName}
          defaultValue={defaultName}
          autoComplete="name"
        />
      </Field>

      <Field
        label="Country"
        htmlFor="country_code"
        hint="This sets your regional leaderboard. It can only be changed once every 30 days."
      >
        <CountrySelect id="country_code" defaultValue={defaultCountry} />
      </Field>

      <Field
        label="One line about you"
        htmlFor="headline"
        hint="Example: Building AI tools for developers."
      >
        <Input id="headline" name="headline" maxLength={LIMITS.headline} />
      </Field>

      {state.error ? (
        <p className="rounded-md border border-[#f3c6c1] bg-[#fef3f2] px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Creating your profile…" : "Continue"}
      </Button>
    </form>
  );
}
