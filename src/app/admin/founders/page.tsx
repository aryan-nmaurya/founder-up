import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { AdminForm, SubmitButton } from "@/components/admin-form";
import { adjustPointsAction, setProfileFlagAction } from "@/app/admin/actions";
import { PageHeader, Badge } from "@/components/ui/misc";
import { EarlyFounderBadge } from "@/components/early-founder-badge";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate, formatPoints } from "@/lib/format";
import { flagFor } from "@/lib/countries";
import type { Profile, RankLedgerEntry } from "@/types/db";

export const metadata: Metadata = {
  title: "Admin · Founders",
  robots: { index: false, follow: false },
};

export default async function AdminFoundersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>;
}) {
  const { q, id } = await searchParams;
  const supabase = requireAdminSupabase();

  let profiles: Profile[] = [];
  if (q && q.trim().length >= 1) {
    const term = `%${q.trim()}%`;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.${term},full_name.ilike.${term}`)
      .order("total_rank_points", { ascending: false })
      .limit(25);
    profiles = (data ?? []) as Profile[];
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    profiles = (data ?? []) as Profile[];
  }

  let ledger: RankLedgerEntry[] = [];
  if (id) {
    const { data } = await supabase
      .from("rank_ledger")
      .select("*")
      .eq("founder_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    ledger = (data ?? []) as RankLedgerEntry[];
  }

  return (
    <div>
      <PageHeader title="Founders" subtitle="Search, suspend, verify, adjust." />

      <form method="get" className="mb-6 flex gap-2">
        <Input name="q" placeholder="Username or name" defaultValue={q ?? ""} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <ul className="divide-y divide-border border-y border-border">
        {profiles.map((profile) => (
          <li key={profile.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${profile.username}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {profile.full_name}
                  </Link>
                  <span className="text-[13px] text-muted">@{profile.username}</span>
                  <span className="text-[13px]">{flagFor(profile.country_code)}</span>
                  {profile.is_early_founder ? (
                    <EarlyFounderBadge number={profile.founder_number} size="sm" />
                  ) : null}
                  {!profile.is_ranked ? <Badge>Unranked</Badge> : null}
                  {profile.is_suspended ? <Badge tone="negative">Suspended</Badge> : null}
                  {profile.is_verified ? <Badge tone="positive">Verified</Badge> : null}
                  {profile.is_admin ? <Badge>Admin</Badge> : null}
                </p>
                {/* Founder numbers are historical identifiers: shown, never edited. */}
                <p className="mt-0.5 text-[13px] text-muted tabular">
                  Founder #{profile.founder_number} ·{" "}
                  {formatPoints(profile.total_rank_points)} RP · completed{" "}
                  {formatDate(profile.profile_completed_at ?? profile.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <AdminForm
                  action={setProfileFlagAction}
                  hidden={{
                    id: profile.id,
                    field: "is_suspended",
                    value: String(!profile.is_suspended),
                  }}
                >
                  <SubmitButton>
                    {profile.is_suspended ? "Unsuspend" : "Suspend"}
                  </SubmitButton>
                </AdminForm>

                <AdminForm
                  action={setProfileFlagAction}
                  hidden={{
                    id: profile.id,
                    field: "is_verified",
                    value: String(!profile.is_verified),
                  }}
                >
                  <SubmitButton>
                    {profile.is_verified ? "Unverify" : "Verify"}
                  </SubmitButton>
                </AdminForm>

                <Link
                  href={`/admin/founders?${q ? `q=${encodeURIComponent(q)}&` : ""}id=${profile.id}`}
                  className="rounded border border-border-strong px-2 py-1 hover:bg-surface"
                >
                  Ledger
                </Link>
              </div>
            </div>

            <AdminForm
              action={adjustPointsAction}
              hidden={{ id: profile.id }}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <input
                name="points"
                inputMode="numeric"
                placeholder="±RP"
                className="h-8 w-24 rounded border border-border-strong px-2 text-[13px] tabular"
              />
              <input
                name="reason"
                placeholder="Reason (required)"
                className="h-8 min-w-40 flex-1 rounded border border-border-strong px-2 text-[13px]"
              />
              <SubmitButton className="h-8" pendingLabel="Adjusting…">
                Adjust
              </SubmitButton>
            </AdminForm>

            {id === profile.id ? (
              <div className="mt-3 rounded border border-border bg-surface p-3">
                <p className="text-[12px] uppercase tracking-wide text-subtle">
                  Rank ledger
                </p>
                {ledger.length === 0 ? (
                  <p className="mt-1 text-[13px] text-muted">No entries.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-[13px] tabular">
                    {ledger.map((entry) => (
                      <li key={entry.id} className="flex gap-3">
                        <span
                          className={
                            entry.points >= 0 ? "text-positive" : "text-negative"
                          }
                        >
                          {entry.points >= 0 ? "+" : ""}
                          {formatPoints(Math.abs(entry.points))}
                        </span>
                        <span className="text-muted">{entry.type}</span>
                        <span className="text-subtle">{entry.reason}</span>
                        <span className="ml-auto text-subtle">
                          {formatDate(entry.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {profiles.length === 0 ? (
        <p className="py-6 text-[14px] text-muted">No founders found.</p>
      ) : null}
    </div>
  );
}
