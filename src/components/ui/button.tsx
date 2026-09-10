import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold " +
  "disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap transition-all duration-150 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-white hover:bg-black shadow-xs",
  secondary:
    "bg-white text-fg border border-border-strong hover:bg-surface active:bg-surface-subtle shadow-2xs",
  accent: "bg-accent text-white hover:bg-accent-hover shadow-xs",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface",
  danger: "bg-white text-negative border border-border-strong hover:bg-negative/5",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-11 px-5 text-[15px]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
