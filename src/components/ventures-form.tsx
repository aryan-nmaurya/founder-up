"use client";
import { useActionState, useState } from "react";
import {
  deleteVentureAction,
  reorderVentureAction,
  saveVentureAction,
  type ActionState,
} from "@/app/settings/actions";
import { LIMITS, MAX_VENTURES_PER_FOUNDER } from "@/lib/config";
import { displayUrl } from "@/lib/format";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { EmptyState } from "./ui/misc";
import type { Venture } from "@/types/db";

const initial: ActionState = {};

export function VenturesManager({ ventures }: { ventures: Venture[] }) {
  const [editing, setEditing] = useState<Venture | "new" | null>(null);
  const atLimit = ventures.length >= MAX_VENTURES_PER_FOUNDER;

  return (
    <div className="space-y-5">
      {ventures.length === 0 ? (
        <EmptyState
          title="What are you building?"
          body="Add the projects and businesses you want people to find."
          action={<Button onClick={() => setEditing("new")}>Add project</Button>}
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {ventures.map((venture, index) => (
            <li key={venture.id} className="py-3">
              {editing !== "new" && editing?.id === venture.id ? (
                <VentureForm venture={venture} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] uppercase tracking-wide text-subtle">
                      {venture.type === "BUSINESS" ? "Business" : "Project"}
                    </p>
                    <p className="font-medium">{venture.name}</p>
                    {venture.description ? (
                      <p className="text-[14px] text-muted">{venture.description}</p>
                    ) : null}
                    {venture.url ? (
                      <p className="text-[13px] text-subtle">{displayUrl(venture.url)}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <ReorderButton
                      id={venture.id}
                      direction="up"
                      disabled={index === 0}
                    />
                    <ReorderButton
                      id={venture.id}
                      direction="down"
                      disabled={index === ventures.length - 1}
                    />
                    <button
                      onClick={() => setEditing(venture)}
                      className="rounded px-2 py-1 text-[13px] text-muted hover:bg-surface hover:text-fg"
                    >
                      Edit
                    </button>
                    <DeleteButton id={venture.id} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing === "new" ? (
        <div className="rounded-lg border border-border p-4">
          <VentureForm onDone={() => setEditing(null)} />
        </div>
      ) : ventures.length > 0 ? (
        <div>
          <Button
            variant="secondary"
            onClick={() => setEditing("new")}
            disabled={atLimit}
          >
            Add another
          </Button>
          {atLimit ? (
            <p className="mt-2 text-[12px] text-subtle">
              You&apos;ve reached the limit of {MAX_VENTURES_PER_FOUNDER} ventures.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VentureForm({
  venture,
  onDone,
}: {
  venture?: Venture;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveVentureAction, initial);

  if (state.ok && !pending) {
    // The list is revalidated by the action; just collapse the editor.
    queueMicrotask(onDone);
  }

  return (
    <form action={action} className="space-y-4">
      {venture ? <input type="hidden" name="id" value={venture.id} /> : null}

      <Field label="Type" htmlFor={`type-${venture?.id ?? "new"}`}>
        <Select
          id={`type-${venture?.id ?? "new"}`}
          name="type"
          defaultValue={venture?.type ?? "PROJECT"}
        >
          <option value="PROJECT">Project</option>
          <option value="BUSINESS">Business</option>
        </Select>
      </Field>

      <Field label="Name" htmlFor={`name-${venture?.id ?? "new"}`}>
        <Input
          id={`name-${venture?.id ?? "new"}`}
          name="name"
          required
          maxLength={LIMITS.ventureName}
          defaultValue={venture?.name ?? ""}
        />
      </Field>

      <Field label="One line about it" htmlFor={`description-${venture?.id ?? "new"}`}>
        <Textarea
          id={`description-${venture?.id ?? "new"}`}
          name="description"
          rows={2}
          maxLength={LIMITS.ventureDescription}
          defaultValue={venture?.description ?? ""}
        />
      </Field>

      <Field label="Link" htmlFor={`url-${venture?.id ?? "new"}`} hint="Optional.">
        <Input
          id={`url-${venture?.id ?? "new"}`}
          name="url"
          inputMode="url"
          placeholder="yourproject.com"
          defaultValue={venture?.url ?? ""}
        />
      </Field>

      {state.error ? (
        <p className="text-[13px] text-negative">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [, action, pending] = useActionState(deleteVentureAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded px-2 py-1 text-[13px] text-muted hover:bg-surface hover:text-negative disabled:opacity-50"
      >
        Delete
      </button>
    </form>
  );
}

function ReorderButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const [, action, pending] = useActionState(reorderVentureAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled || pending}
        aria-label={`Move ${direction}`}
        className="rounded px-1.5 py-1 text-[12px] text-muted hover:bg-surface hover:text-fg disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
