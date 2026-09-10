import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Shown when the app is running without credentials, so a fresh clone renders
 * something honest instead of an empty page or a crash.
 */
export function SetupNotice() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="rounded-lg border border-[#f0d8a8] bg-[#fdf8ee] px-4 py-3.5 text-[13px] text-[#7a5b12]">
      <p className="font-medium">FounderUp isn&apos;t connected to a database yet.</p>
      <p className="mt-1 leading-relaxed">
        Copy <code className="rounded bg-white/70 px-1">.env.example</code> to{" "}
        <code className="rounded bg-white/70 px-1">.env.local</code>, add your
        Supabase and Razorpay keys, then run the SQL in{" "}
        <code className="rounded bg-white/70 px-1">supabase/migrations/</code>.
        See <code className="rounded bg-white/70 px-1">README.md</code>.
      </p>
    </div>
  );
}
