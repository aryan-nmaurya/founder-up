import Image from "next/image";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function FounderAvatar({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const shared = cn(
    "shrink-0 rounded-full border border-border object-cover bg-surface",
    className,
  );

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={shared}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        shared,
        "inline-flex items-center justify-center font-medium text-muted",
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
    >
      {initials(name)}
    </span>
  );
}
