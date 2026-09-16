import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const LINKS = [
  { href: "/#leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
  { href: "/rules", label: "Rules" },
  { href: "/pricing", label: "Pricing" },
  { href: "/search", label: "Search" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/shipping", label: "Shipping" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-(--container-page) px-4 py-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted hover:text-fg">
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-subtle">
          &copy; {new Date().getFullYear()} {APP_NAME}. Rankings are determined by
          paid Rank Points.
        </p>
      </div>
    </footer>
  );
}
