import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { PageHeader, Stat } from "@/components/ui/misc";
import { formatPoints } from "@/lib/format";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

async function count(table: string, filter?: [string, string]) {
  const supabase = requireAdminSupabase();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count: value } = await query;
  return value ?? 0;
}

export default async function AdminOverviewPage() {
  const [founders, ranked, openReports, failedWebhooks, payments, suspended] =
    await Promise.all([
      count("profiles"),
      count("profiles", ["is_suspended", "false"]),
      count("reports", ["status", "OPEN"]),
      count("webhook_events", ["status", "FAILED"]),
      count("payments", ["status", "CAPTURED"]),
      count("profiles", ["is_suspended", "true"]),
    ]);

  return (
    <div>
      <PageHeader title="Admin" subtitle="Operate FounderUp without touching the database." />

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Stat label="Founders" value={formatPoints(founders)} />
        <Stat label="Active" value={formatPoints(ranked)} />
        <Stat label="Suspended" value={formatPoints(suspended)} />
        <Stat label="Captured payments" value={formatPoints(payments)} />
        <Stat label="Open reports" value={formatPoints(openReports)} />
        <Stat label="Failed webhooks" value={formatPoints(failedWebhooks)} />
      </div>

      {openReports > 0 || failedWebhooks > 0 ? (
        <div className="mt-6 space-y-1 text-[14px]">
          {openReports > 0 ? (
            <p>
              <Link href="/admin/reports" className="underline underline-offset-2">
                {openReports} report{openReports === 1 ? "" : "s"} waiting for review
              </Link>
            </p>
          ) : null}
          {failedWebhooks > 0 ? (
            <p>
              <Link href="/admin/webhooks" className="underline underline-offset-2">
                {failedWebhooks} failed webhook{failedWebhooks === 1 ? "" : "s"} to retry
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-[14px] text-muted">Nothing needs attention.</p>
      )}
    </div>
  );
}
