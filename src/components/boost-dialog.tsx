"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  AMOUNT_PRESETS_SUBUNIT,
  CONTACT_EMAIL,
  CURRENCY_SYMBOL,
  MAX_AMOUNT_SUBUNIT,
  MIN_AMOUNT_SUBUNIT,
  USD_TO_INR_ESTIMATE,
  type Currency,
} from "@/lib/config";
import { formatMoney, formatPoints, formatRank } from "@/lib/format";
import { countryName, flagFor } from "@/lib/countries";
import { cn } from "@/lib/cn";
import { CurrencySwitcher } from "./currency-switcher";
import { ShareRank } from "./share-rank";
import { Modal } from "./ui/modal";
import { track } from "@/lib/analytics-client";
import {
  ArrowUp,
  Sparkles,
  X,
  CheckCircle2,
  ShieldAlert,
  Clock,
  TriangleAlert,
} from "lucide-react";
import type {
  BoostOutcome,
  FounderRanks,
  NextRankGap,
  VerifyResponse,
} from "@/types/db";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string };
  theme: { color: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/**
 * Once Checkout hands back a payment, the form never returns for it: money may
 * have moved, so the only honest answers left are confirmed, still processing,
 * or not confirmed yet.
 */
type Phase =
  | { step: "form" }
  | { step: "confirming"; payment: RazorpayHandlerResponse }
  | { step: "success"; outcome: BoostOutcome }
  | { step: "pending"; payment: RazorpayHandlerResponse }
  | { step: "unconfirmed"; payment: RazorpayHandlerResponse; reason: string };

export function BoostDialog({
  founderId,
  ranks,
  gap,
  defaultCurrency = "INR",
  payerName,
  payerEmail,
  username,
  countryCode,
  razorpayEnabled,
  triggerLabel = "Climb the leaderboard",
  className,
}: {
  /** The signed-in founder. A boost only ever goes to the account that pays. */
  founderId: string;
  ranks: FounderRanks | null;
  gap: NextRankGap | null;
  defaultCurrency?: Currency;
  payerName: string;
  payerEmail: string;
  username: string;
  countryCode: string;
  razorpayEnabled: boolean;
  triggerLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [amount, setAmount] = useState<number>(AMOUNT_PRESETS_SUBUNIT[defaultCurrency][0]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "form" });

  const presets = AMOUNT_PRESETS_SUBUNIT[currency];
  const min = MIN_AMOUNT_SUBUNIT[currency];

  function close() {
    // Mid-confirmation the dialog stays put, so the answer has somewhere to land.
    if (phase.step === "confirming") return;
    setOpen(false);
    setError(null);
    if (phase.step !== "form") {
      setPhase({ step: "form" });
      router.refresh();
    }
  }

  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  const estimatedPoints = useMemo(() => {
    if (currency === "INR") return Math.floor(amount / 100);
    return Math.floor((amount / 100) * USD_TO_INR_ESTIMATE);
  }, [amount, currency]);

  function applyCustom(value: string) {
    setCustom(value);
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmount(Math.round(parsed * 100));
    }
  }

  async function confirm(payment: RazorpayHandlerResponse) {
    setPhase({ step: "confirming", payment });
    let reason = "FounderUp couldn't be reached to confirm it.";
    try {
      const res = await fetch("/api/boost/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payment),
      });
      const result = (await res
        .json()
        .catch(() => ({ error: "FounderUp sent an unexpected response." }))) as VerifyResponse;

      if ("status" in result && result.status === "CONFIRMED") {
        track("payment_success", { rank_points: result.outcome.rank_points, currency });
        setPhase({ step: "success", outcome: result.outcome });
        router.refresh();
        return;
      }
      if ("status" in result && result.status === "PENDING") {
        track("payment_pending", { currency });
        setPhase({ step: "pending", payment });
        return;
      }
      if ("error" in result && result.error) reason = result.error;
    } catch {
      // Network failure: the reason above stands.
    }
    track("payment_unconfirmed", { currency });
    setPhase({ step: "unconfirmed", payment, reason });
  }

  async function startCheckout() {
    setError(null);
    if (!razorpayEnabled) return;

    if (amount < min) {
      setError(`Minimum boost is ${formatMoney(min, currency)}`);
      return;
    }
    if (amount > MAX_AMOUNT_SUBUNIT[currency]) {
      setError("That amount is above the per-boost limit");
      return;
    }
    if (!window.Razorpay) {
      setError("Checkout is still loading. Try again in a moment.");
      return;
    }

    setBusy(true);
    track("checkout_started", { amount_subunit: amount, currency });

    try {
      const res = await fetch("/api/boost/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ founder_id: founderId, amount_subunit: amount, currency }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");

      const rzp = new window.Razorpay({
        key: data.key_id,
        order_id: data.razorpay_order_id,
        amount: data.amount,
        currency: data.currency,
        name: "FounderUp",
        description: "Rank Points boost",
        prefill: { name: payerName, email: payerEmail || undefined },
        theme: { color: "#F26A4F" },
        // Checkout calls this only after it has taken the money.
        handler: (response) => {
          setBusy(false);
          void confirm(response);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (err) {
      track("payment_failed", { stage: "create", currency });
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(false);
    }
  }

  return (
    <>
      {razorpayEnabled ? (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      ) : null}

      <button
        type="button"
        onClick={() => {
          track("boost_opened", { global_rank: ranks?.global_rank ?? null });
          setOpen(true);
        }}
        className={
          className ||
          "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-bold text-white shadow-xs hover:bg-accent-hover transition-all active:scale-98"
        }
      >
        <Sparkles className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      <Modal
        open={open}
        onClose={() => closeRef.current()}
        label="Climb the leaderboard"
        className="rounded-t-2xl border border-border bg-white p-6 shadow-2xl sm:rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
      >
        {open ? (
          <>
            {phase.step === "success" ? (
              <SuccessPanel
                outcome={phase.outcome}
                countryCode={countryCode}
                username={username}
                onClose={close}
              />
            ) : phase.step === "confirming" ? (
              <StatusPanel
                tone="neutral"
                title="Confirming your payment…"
                paymentId={phase.payment.razorpay_payment_id}
              >
                <p>Checking with Razorpay. This usually takes a few seconds.</p>
              </StatusPanel>
            ) : phase.step === "pending" ? (
              <StatusPanel
                tone="neutral"
                title="Payment received, still processing"
                paymentId={phase.payment.razorpay_payment_id}
                onRetry={() => confirm(phase.payment)}
                onClose={close}
              >
                <p>
                  Razorpay hasn&apos;t finished confirming it yet. Your Rank Points
                  are added automatically as soon as it clears, so you don&apos;t
                  need to pay again.
                </p>
              </StatusPanel>
            ) : phase.step === "unconfirmed" ? (
              <StatusPanel
                tone="warning"
                title="We couldn't confirm your payment yet"
                paymentId={phase.payment.razorpay_payment_id}
                onRetry={() => confirm(phase.payment)}
                onClose={close}
              >
                <p>{phase.reason}</p>
                <p>
                  If you were charged, your Rank Points are added automatically
                  once Razorpay confirms the payment. Please don&apos;t pay again.
                  If they haven&apos;t appeared within an hour, email {CONTACT_EMAIL}{" "}
                  with the payment ID below.
                </p>
              </StatusPanel>
            ) : (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[20px] font-bold text-fg tracking-tight">
                      Climb the leaderboard
                    </h2>
                    <p className="mt-1 text-[13px] text-muted">
                      Compete for visibility and founder discovery.
                    </p>
                  </div>
                  <button
                    onClick={close}
                    aria-label="Close modal"
                    className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-fg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Current Rank Banner */}
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                    Current Rank
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[15px] font-bold text-fg tabular">
                    {!ranks ? (
                      <span className="font-medium text-muted">Unavailable right now</span>
                    ) : ranks.is_ranked ? (
                      <>
                        <span>
                          {flagFor(countryCode)} {formatRank(ranks.country_rank)}{" "}
                          <span className="font-normal text-muted text-[13px]">
                            {countryName(countryCode)}
                          </span>
                        </span>
                        <span className="text-border-strong">·</span>
                        <span>
                          🌍 {formatRank(ranks.global_rank)}{" "}
                          <span className="font-normal text-muted text-[13px]">
                            Global
                          </span>
                        </span>
                      </>
                    ) : (
                      <span>Unranked</span>
                    )}
                  </div>
                </div>

                {/* Currency Switcher */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-fg">
                    Choose boost amount
                  </span>
                  <CurrencySwitcher
                    value={currency}
                    onChange={(next) => {
                      setCurrency(next);
                      setAmount(AMOUNT_PRESETS_SUBUNIT[next][0]);
                      setCustom("");
                      setError(null);
                    }}
                    disabled={busy}
                  />
                </div>

                {/* Presets Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {presets.slice(0, 4).map((preset) => {
                    const isSelected = amount === preset && !custom;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setAmount(preset);
                          setCustom("");
                          setError(null);
                        }}
                        className={`h-12 rounded-xl border text-[14px] font-bold tabular transition-all ${
                          isSelected
                            ? "border-accent bg-accent-subtle text-accent shadow-xs ring-2 ring-accent/20"
                            : "border-border bg-white text-fg hover:border-border-strong hover:bg-surface"
                        }`}
                      >
                        {formatMoney(preset, currency)}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Field */}
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">
                    {CURRENCY_SYMBOL[currency]}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Custom amount"
                    aria-label="Custom amount"
                    value={custom}
                    onChange={(e) => applyCustom(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface pl-8 pr-4 text-[14px] font-semibold text-fg placeholder:text-subtle focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/15 tabular"
                  />
                </div>

                <RankEstimate
                  points={estimatedPoints}
                  approximate={currency !== "INR"}
                  ranks={ranks}
                  gap={gap}
                  countryCode={countryCode}
                />

                {/* Non-Refundable Disclosure */}
                <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-[12px] leading-relaxed text-muted">
                  <ShieldAlert className="h-4 w-4 text-subtle shrink-0 mt-0.5" />
                  <p>
                    All ranking purchases are final and non-refundable. Final position may change as other founders climb the leaderboard.
                  </p>
                </div>

                {!razorpayEnabled ? (
                  <p
                    role="status"
                    className="rounded-xl border border-[#f0d8a8] bg-[#fdf8ee] px-3.5 py-2 text-[13px] font-medium text-[#7a5b12]"
                  >
                    Checkout isn&apos;t available on this deployment yet, so no
                    payment can be taken.
                  </p>
                ) : null}

                {error ? (
                  <p className="rounded-xl border border-negative/20 bg-negative/5 px-3.5 py-2 text-[13px] font-medium text-negative">
                    {error}
                  </p>
                ) : null}

                {/* CTA */}
                <button
                  type="button"
                  disabled={busy || !razorpayEnabled}
                  onClick={startCheckout}
                  className="w-full h-12 rounded-xl bg-fg text-[14px] font-bold text-white shadow-xs hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <span>Processing…</span>
                  ) : (
                    <span>
                      Continue to payment · {formatMoney(amount, currency)}
                    </span>
                  )}
                </button>
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </>
  );
}

/**
 * Plan §16 - what a boost this size is expected to do, from real numbers only:
 * the founder's current rank and the gap to the next position. Whatever those
 * can't support is left unsaid rather than guessed.
 */
function RankEstimate({
  points,
  approximate,
  ranks,
  gap,
  countryCode,
}: {
  points: number;
  approximate: boolean;
  ranks: FounderRanks | null;
  gap: NextRankGap | null;
  countryCode: string;
}) {
  const country = countryName(countryCode);

  function versus(needed: number, target: number, where: string): ReactNode {
    return points >= needed ? (
      <>
        Enough to reach <strong className="text-positive">#{target}</strong> {where}
      </>
    ) : (
      <>
        {formatPoints(needed - points)} RP short of <strong>#{target}</strong> {where}
      </>
    );
  }

  let headline: ReactNode;
  let secondary: ReactNode = null;
  if (!ranks) {
    headline = "No estimate while your rank is unavailable.";
  } else if (!ranks.is_ranked) {
    headline = "Puts you on the leaderboard.";
  } else {
    headline =
      gap?.country_gap && gap.country_target_rank
        ? versus(gap.country_gap, gap.country_target_rank, `in ${country}`)
        : ranks.country_rank === 1
          ? <>Adds to your lead at <strong>#1</strong> in {country}</>
          : "Adds to your total.";
    secondary =
      gap?.global_gap && gap.global_target_rank
        ? versus(gap.global_gap, gap.global_target_rank, "globally")
        : ranks.global_rank === 1
          ? <>Adds to your lead at <strong>#1</strong> globally</>
          : null;
  }

  return (
    <div className="rounded-xl border border-accent/25 bg-[#FFF9F7] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-fg">Estimated movement</span>
        <span className="text-[13px] font-extrabold text-accent tabular">
          {approximate ? "≈ " : ""}+{formatPoints(points)} RP
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[14px] font-bold text-fg tabular">
        <ArrowUp className="h-4 w-4 shrink-0 text-positive" />
        <span>{headline}</span>
      </p>
      {secondary ? (
        <p className="mt-0.5 pl-5.5 text-[13px] font-medium text-muted tabular">{secondary}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-muted">
        Based on the leaderboard right now
        {approximate ? " and an estimated exchange rate" : ""}. Other founders
        may move before your payment clears.
      </p>
    </div>
  );
}

function StatusPanel({
  tone,
  title,
  paymentId,
  children,
  onRetry,
  onClose,
}: {
  tone: "neutral" | "warning";
  title: string;
  paymentId: string;
  children: ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="space-y-4 py-2 text-center" role="status" aria-live="polite">
      <div
        className={cn(
          "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
          tone === "warning" ? "bg-[#fdf8ee] text-[#7a5b12]" : "bg-surface text-fg",
        )}
      >
        {tone === "warning" ? (
          <TriangleAlert className="h-7 w-7" />
        ) : (
          <Clock className="h-7 w-7" />
        )}
      </div>

      <div>
        <h2 className="text-[20px] font-extrabold text-fg tracking-tight">{title}</h2>
        <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted">
          {children}
        </div>
      </div>

      <p className="text-[12px] text-muted">
        Payment ID <span className="font-mono text-fg">{paymentId}</span>
      </p>

      {onRetry || onClose ? (
        <div className="flex gap-2 pt-1">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-11 flex-1 rounded-xl bg-fg text-[13px] font-bold text-white hover:bg-black transition-colors"
            >
              Check again
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl border border-border bg-white text-[13px] font-bold text-fg hover:bg-surface transition-colors"
            >
              Close
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuccessPanel({
  outcome,
  countryCode,
  username,
  onClose,
}: {
  outcome: BoostOutcome;
  countryCode: string;
  username: string;
  onClose: () => void;
}) {
  const hasBefore =
    outcome.previous_country_rank != null && outcome.new_country_rank != null;
  const moved =
    hasBefore && (outcome.new_country_rank as number) < (outcome.previous_country_rank as number);

  return (
    <div className="text-center py-2 space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive/10 text-positive">
        <CheckCircle2 className="h-8 w-8" />
      </div>

      <div>
        <h2 className="text-[22px] font-extrabold text-fg tracking-tight">
          {moved ? "You moved up the ranks!" : "Boost Successful!"}
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          +{formatPoints(outcome.rank_points)} Rank Points added to your profile.
        </p>
      </div>

      {/* Rank Movement Display */}
      <div className="mx-auto max-w-xs rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center justify-center gap-3 text-[22px] font-black text-fg tabular">
          {hasBefore ? (
            <>
              <span className="text-muted line-through opacity-70">
                #{outcome.previous_country_rank}
              </span>
              <span className="text-positive">→</span>
              <span className="text-positive text-[26px]">
                #{outcome.new_country_rank}
              </span>
              {moved ? <ArrowUp className="h-6 w-6 text-positive animate-bounce" /> : null}
            </>
          ) : (
            <span className="text-positive">
              {formatRank(outcome.new_country_rank)} {flagFor(countryCode)}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] font-semibold text-muted">
          Your position in {countryName(countryCode)}
        </p>
      </div>

      <div className="pt-2 space-y-2.5">
        <ShareRank
          username={username}
          globalRank={outcome.new_global_rank}
          countryRank={outcome.new_country_rank}
          countryCode={countryCode}
        />
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl border border-border bg-white text-[13px] font-bold text-fg hover:bg-surface transition-colors"
        >
          Back to Leaderboard
        </button>
      </div>
    </div>
  );
}
