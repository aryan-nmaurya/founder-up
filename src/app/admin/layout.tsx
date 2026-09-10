import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

// Admin is always request-time: it reads the service role and live counts.
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/founders", label: "Founders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/webhooks", label: "Webhooks" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3 text-[13px]">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded px-2.5 py-1.5 text-muted hover:bg-surface hover:text-fg"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
