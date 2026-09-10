import type { Metadata } from "next";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { AdminForm, SubmitButton } from "@/components/admin-form";
import { retryWebhookAction } from "@/app/admin/actions";
import { PageHeader, Badge } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import type { WebhookEvent } from "@/types/db";

export const metadata: Metadata = {
  title: "Admin · Webhooks",
  robots: { index: false, follow: false },
};

export default async function AdminWebhooksPage() {
  const supabase = requireAdminSupabase();
  const { data } = await supabase
    .from("webhook_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []) as WebhookEvent[];

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Retrying is safe — awarding and revoking points are both idempotent."
      />

      {events.length === 0 ? (
        <p className="text-[14px] text-muted">No webhook deliveries yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge
                  tone={
                    event.status === "FAILED"
                      ? "negative"
                      : event.status === "PROCESSED"
                        ? "positive"
                        : "neutral"
                  }
                >
                  {event.status}
                </Badge>
                <span className="font-mono text-[13px]">{event.event_type}</span>
                {event.attempts > 0 ? (
                  <span className="text-[12px] text-subtle">
                    {event.attempts} retr{event.attempts === 1 ? "y" : "ies"}
                  </span>
                ) : null}
                <span className="ml-auto text-[12px] text-subtle">
                  {formatDate(event.created_at)}
                </span>
              </div>

              {event.error ? (
                <p className="mt-1 text-[13px] text-negative">{event.error}</p>
              ) : null}

              {event.status !== "PROCESSED" ? (
                <div className="mt-2">
                  <AdminForm action={retryWebhookAction} hidden={{ id: event.id }}>
                    <SubmitButton pendingLabel="Retrying…">Retry</SubmitButton>
                  </AdminForm>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
