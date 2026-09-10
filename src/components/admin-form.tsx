"use client";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import type { AdminState } from "@/app/admin/actions";

const initial: AdminState = {};

type Action = (state: AdminState, formData: FormData) => Promise<AdminState>;

/**
 * Deliberately plain. Plan §53 - functionality first.
 *
 * Children are ordinary elements, not a render prop: the admin pages are
 * Server Components, and a function cannot cross the server/client boundary.
 * Pending state is read inside the form by SubmitButton.
 */
export function AdminForm({
  action,
  hidden,
  children,
  className,
}: {
  action: Action;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initial);

  return (
    <form action={formAction} className={className ?? "inline"}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {state.error ? (
        <span className="ml-2 text-[12px] text-negative">{state.error}</span>
      ) : null}
      {state.ok && state.message ? (
        <span className="ml-2 text-[12px] text-positive">{state.message}</span>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "rounded border border-border-strong px-2 py-1 text-[13px] hover:bg-surface disabled:opacity-50",
        className,
      )}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
