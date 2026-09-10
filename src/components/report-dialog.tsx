"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Field, Select, Textarea } from "./ui/field";

const REASONS = [
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "SPAM", label: "Spam profile" },
  { value: "SCAM", label: "Scam" },
  { value: "ILLEGAL", label: "Illegal business" },
  { value: "EXPLICIT", label: "Explicit content" },
  { value: "HATE", label: "Hate or extremist content" },
  { value: "MISLEADING_LINK", label: "Misleading external link" },
  { value: "OTHER", label: "Something else" },
];

/** Plan §47 - every profile is reportable. Review is manual. */
export function ReportDialog({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          reason: form.get("reason"),
          details: form.get("details"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send that report");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] text-subtle underline underline-offset-2 hover:text-fg"
      >
        Report profile
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report profile"
            className="w-full max-w-sm rounded-t-xl border border-border bg-white p-5 sm:rounded-xl"
          >
            {done ? (
              <div className="text-center">
                <p className="font-medium">Report received</p>
                <p className="mt-1 text-[13px] text-muted">
                  We review reports manually. Thanks for flagging it.
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="text-[16px] font-semibold">Report this profile</h2>

                <Field label="Reason" htmlFor="reason">
                  <Select id="reason" name="reason" defaultValue="IMPERSONATION">
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Details" htmlFor="details" hint="Optional.">
                  <Textarea id="details" name="details" rows={3} maxLength={1000} />
                </Field>

                {error ? <p className="text-[13px] text-negative">{error}</p> : null}

                <div className="flex gap-2">
                  <Button type="submit" disabled={busy} className="flex-1">
                    {busy ? "Sending…" : "Send report"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
