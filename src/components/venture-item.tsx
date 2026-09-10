import { displayUrl } from "@/lib/format";
import { TrackedLink } from "./tracked-link";
import { ExternalLink, Layers } from "lucide-react";
import type { Venture } from "@/types/db";

export function VentureItem({
  venture,
  founderId,
}: {
  venture: Venture;
  founderId: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 transition-all hover:border-border-strong hover:shadow-2xs">
      <div className="flex items-start gap-3.5">
        {/* Logo or geometric icon badge */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-fg font-bold shadow-2xs">
          {venture.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venture.logo_url}
              alt=""
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <Layers className="h-5 w-5 text-accent" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[15px] sm:text-[16px] text-fg">
              {venture.name}
            </h3>
            <span className="rounded-full bg-surface-subtle border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {venture.type}
            </span>
          </div>

          {venture.description ? (
            <p className="mt-1 text-[13px] sm:text-[14px] leading-relaxed text-muted">
              {venture.description}
            </p>
          ) : null}

          {venture.url ? (
            <div className="mt-2.5">
              <TrackedLink
                href={venture.url}
                founderId={founderId}
                linkType="VENTURE"
                ventureId={venture.id}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-hover hover:underline underline-offset-2"
              >
                <span>{displayUrl(venture.url)}</span>
                <ExternalLink className="h-3 w-3" />
              </TrackedLink>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
