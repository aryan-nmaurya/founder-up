import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { PageHeader, Badge } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatPoints } from "@/lib/format";
import type { Currency } from "@/lib/config";
import type { Payment } from "@/types/db";

export const metadata: Metadata = {
  title: "Admin · Payments",
  robots: { index: false, follow: false },
};

type Row = Payment & {
  profiles: { username: string; full_name: string } | null;
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = requireAdminSupabase();

  let query = supabase
    .from("payments")
    .select("*, profiles(username, full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (q?.trim()) {
    const term = q.trim();
    query = query.or(
      `razorpay_payment_id.eq.${term},razorpay_order_id.eq.${term}`,
    );
  }

  const { data } = await query;
  const payments = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Search by Razorpay payment or order ID."
      />

      <form method="get" className="mb-6 flex gap-2">
        <Input name="q" placeholder="pay_… or order_…" defaultValue={q ?? ""} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {payments.length === 0 ? (
        <p className="text-[14px] text-muted">No payments found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-subtle">
                <th className="py-2 font-medium">Founder</th>
                <th className="py-2 font-medium">Paid</th>
                <th className="py-2 font-medium">INR base</th>
                <th className="py-2 font-medium">RP</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Payment ID</th>
                <th className="py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    {payment.profiles ? (
                      <Link
                        href={`/${payment.profiles.username}`}
                        className="underline underline-offset-2"
                      >
                        @{payment.profiles.username}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 tabular">
                    {formatMoney(payment.amount_subunit, payment.currency as Currency)}
                  </td>
                  <td className="py-2 tabular">
                    {formatMoney(payment.base_amount_subunit, "INR")}
                  </td>
                  <td className="py-2 tabular">
                    {formatPoints(payment.rank_points_awarded)}
                  </td>
                  <td className="py-2">
                    <Badge
                      tone={
                        payment.status === "CAPTURED"
                          ? "positive"
                          : payment.status === "DISPUTED"
                            ? "negative"
                            : "neutral"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="py-2 font-mono text-[12px] text-muted">
                    {payment.razorpay_payment_id}
                  </td>
                  <td className="py-2 text-muted">
                    {formatDate(payment.captured_at ?? payment.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
