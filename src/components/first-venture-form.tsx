"use client";
import Link from "next/link";
import { useActionState } from "react";
import { LIMITS } from "@/lib/config";
import { addFirstVentureAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";

const initial: ActionState = {};

/** Plan §9 step 4 - skippable. */
export function FirstVentureForm() {
  const [state, action, pending] = useActionState(addFirstVentureAction, initial);

  return (
    <form action={action} className="space-y-5">
      <Field label="Type" htmlFor="type">
        <Select id="type" name="type" defaultValue="PROJECT">
          <option value="PROJECT">Project</option>
          <option value="BUSINESS">Business</option>
        </Select>
      </Field>

      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={LIMITS.ventureName} />
      </Field>

      <Field
        label="One line about it"
        htmlFor="description"
        hint="Keep it short. This shows on the leaderboard."
      >
        <Textarea
          id="description"
          name="description"
          maxLength={LIMITS.ventureDescription}
          rows={2}
        />
      </Field>

      <Field label="Link" htmlFor="url" hint="Optional.">
        <Input id="url" name="url" inputMode="url" placeholder="yourproject.com" />
      </Field>

      {state.error ? (
        <p className="rounded-md border border-[#f3c6c1] bg-[#fef3f2] px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Publish my profile"}
        </Button>
        <Link
          href="/dashboard?welcome=1"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong px-5 text-[15px] font-medium hover:bg-surface"
        >
          Skip
        </Link>
      </div>
    </form>
  );
}
