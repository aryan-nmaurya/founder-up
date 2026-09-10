import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { AdminForm, SubmitButton } from "@/components/admin-form";
import { setReportStatusAction } from "@/app/admin/actions";
import { PageHeader, Badge } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import type { Report } from "@/types/db";

export const metadata: Metadata = {
  title: "Admin · Reports",
  robots: { index: false, follow: false },
};

type Row = Report & {
  profiles: { username: string; full_name: string } | null;
};

const NEXT_STATUS = ["REVIEWING", "ACTIONED", "DISMISSED"] as const;

export default async function AdminReportsPage() {
  const supabase = requireAdminSupabase();
  const { data } = await supabase
    .from("reports")
    .select("*, profiles!reports_profile_id_fkey(username, full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const reports = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Reviewed manually." />

      {reports.length === 0 ? (
        <p className="text-[14px] text-muted">No reports.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {reports.map((report) => (
            <li key={report.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge
                  tone={
                    report.status === "OPEN"
                      ? "negative"
                      : report.status === "ACTIONED"
                        ? "positive"
                        : "neutral"
                  }
                >
                  {report.status}
                </Badge>
                <span className="text-[13px] font-medium">{report.reason}</span>
                {report.profiles ? (
                  <Link
                    href={`/${report.profiles.username}`}
                    className="text-[13px] underline underline-offset-2"
                  >
                    @{report.profiles.username}
                  </Link>
                ) : null}
                <span className="ml-auto text-[12px] text-subtle">
                  {formatDate(report.created_at)}
                </span>
              </div>

              {report.details ? (
                <p className="mt-1 text-[13px] text-muted">{report.details}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                {NEXT_STATUS.filter((s) => s !== report.status).map((status) => (
                  <AdminForm
                    key={status}
                    action={setReportStatusAction}
                    hidden={{ id: report.id, status }}
                  >
                    <SubmitButton>Mark {status.toLowerCase()}</SubmitButton>
                  </AdminForm>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
