import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-border-strong bg-white px-3 py-2 " +
  "text-fg placeholder:text-subtle focus:border-fg focus:outline-none";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  counter,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  counter?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg">
          {label}
        </label>
        {counter ? <span className="text-[12px] text-subtle tabular">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="text-[12px] text-negative">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-10 appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}
