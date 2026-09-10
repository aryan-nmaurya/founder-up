"use client";
import { useActionState, useState } from "react";
import { updateProfileAction, type ActionState } from "@/app/settings/actions";
import { COUNTRY_CHANGE_COOLDOWN_DAYS, LIMITS } from "@/lib/config";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { CountrySelect } from "./country-select";
import { AvatarUpload } from "./avatar-upload";
import { Divider } from "./ui/misc";
import type { Profile } from "@/types/db";

const initial: ActionState = {};

/** Plan §29 - Basic, Links, Connect. One Save button. */
export function ProfileForm({
  profile,
  userId,
  countryLocked,
  countryUnlocksOn,
}: {
  profile: Profile;
  userId: string;
  countryLocked: boolean;
  countryUnlocksOn: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [contactType, setContactType] = useState(profile.contact_type);

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-5">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Basic
        </h2>

        <AvatarUpload
          name="avatar_url"
          initialUrl={profile.avatar_url}
          founderName={profile.full_name}
          userId={userId}
        />

        <Field label="Full name" htmlFor="full_name">
          <Input
            id="full_name"
            name="full_name"
            required
            maxLength={LIMITS.fullName}
            defaultValue={profile.full_name}
          />
        </Field>

        <Field label="Username" htmlFor="username" hint="Changing this changes your profile link.">
          <Input
            id="username"
            name="username"
            required
            autoCapitalize="none"
            spellCheck={false}
            minLength={LIMITS.username.min}
            maxLength={LIMITS.username.max}
            defaultValue={profile.username}
          />
        </Field>

        <Field
          label="Country"
          htmlFor="country_code"
          hint={
            countryLocked
              ? `Country affects your regional FounderUp rank. You can change it again on ${countryUnlocksOn}.`
              : `Country affects your regional FounderUp rank. It can only be changed once every ${COUNTRY_CHANGE_COOLDOWN_DAYS} days.`
          }
        >
          <CountrySelect
            id="country_code"
            defaultValue={profile.country_code}
            disabled={countryLocked}
          />
          {countryLocked ? (
            <input type="hidden" name="country_code" value={profile.country_code} />
          ) : null}
        </Field>

        <Field
          label="Headline"
          htmlFor="headline"
          hint="One line. Example: Building AI tools for developers."
          counter={`${headline.length}/${LIMITS.headline}`}
        >
          <Input
            id="headline"
            name="headline"
            maxLength={LIMITS.headline}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </Field>

        <Field
          label="Bio"
          htmlFor="bio"
          hint="Keep it short. FounderUp is not a résumé."
          counter={`${bio.length}/${LIMITS.bio}`}
        >
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={LIMITS.bio}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>
      </section>

      <Divider />

      <section className="space-y-5">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Links
        </h2>

        <Field label="Website" htmlFor="website_url">
          <Input
            id="website_url"
            name="website_url"
            inputMode="url"
            placeholder="yoursite.com"
            defaultValue={profile.website_url ?? ""}
          />
        </Field>

        <Field label="X" htmlFor="x_url">
          <Input
            id="x_url"
            name="x_url"
            inputMode="url"
            placeholder="x.com/yourhandle"
            defaultValue={profile.x_url ?? ""}
          />
        </Field>

        <Field label="LinkedIn" htmlFor="linkedin_url">
          <Input
            id="linkedin_url"
            name="linkedin_url"
            inputMode="url"
            placeholder="linkedin.com/in/you"
            defaultValue={profile.linkedin_url ?? ""}
          />
        </Field>

        <Field label="GitHub" htmlFor="github_url">
          <Input
            id="github_url"
            name="github_url"
            inputMode="url"
            placeholder="github.com/you"
            defaultValue={profile.github_url ?? ""}
          />
        </Field>
      </section>

      <Divider />

      <section className="space-y-5">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
          Connect
        </h2>
        <p className="-mt-2 text-[13px] text-muted">
          Where the Connect button on your profile sends people. FounderUp has no
          inbox of its own.
        </p>

        <Field label="Preferred destination" htmlFor="contact_type">
          <Select
            id="contact_type"
            name="contact_type"
            value={contactType}
            onChange={(e) => setContactType(e.target.value as Profile["contact_type"])}
          >
            <option value="WEBSITE">Website</option>
            <option value="X">X</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="EMAIL">Email</option>
          </Select>
        </Field>

        {contactType === "EMAIL" ? (
          <Field label="Contact email" htmlFor="contact_email" hint="Shown publicly as a mailto link.">
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile.contact_value ?? ""}
            />
          </Field>
        ) : (
          <input type="hidden" name="contact_email" value={profile.contact_value ?? ""} />
        )}
      </section>

      {state.error ? (
        <p className="rounded-md border border-[#f3c6c1] bg-[#fef3f2] px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md border border-[#bfe3ce] bg-[#f2faf5] px-3 py-2 text-[13px] text-positive">
          {state.message ?? "Saved"}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-white px-4 py-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
