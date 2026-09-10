import type { ReactNode } from "react";

/** Shared shell so every policy page reads the same way. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-(--container-narrow)">
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      {updated ? (
        <p className="mt-1 text-[13px] text-subtle">Last updated {updated}</p>
      ) : null}
      <div className="prose-founderup mt-6 space-y-4 text-[15px] leading-relaxed">
        {children}
      </div>
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-3 text-[17px] font-semibold">{children}</h2>;
}

export function P({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={className ?? "text-muted"}>{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-muted marker:text-border-strong">
      {children}
    </ul>
  );
}
