import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const tones = {
    neutral: "border-border-strong text-muted",
    positive: "border-[#bfe3ce] text-positive",
    negative: "border-[#f3c6c1] text-negative",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Plan §58 - empty states are useful, not decorative. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg px-5 py-8 text-center">
      <p className="font-medium text-fg">{title}</p>
      {body ? <p className="mt-1 text-[14px] text-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold tabular">{value}</p>
    </div>
  );
}

export function Notice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 text-[13px]",
        tone === "warning"
          ? "border-[#f0d8a8] bg-[#fdf8ee] text-[#7a5b12]"
          : "border-border bg-surface text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-[14px] text-muted">{subtitle}</p> : null}
    </header>
  );
}
