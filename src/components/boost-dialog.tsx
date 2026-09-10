"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  AMOUNT_PRESETS_SUBUNIT,
  CURRENCY_SYMBOL,
  MAX_AMOUNT_SUBUNIT,
  MIN_AMOUNT_SUBUNIT,
  USD_TO_INR_ESTIMATE,
  type Currency,
} from "@/lib/config";
import { formatMoney, formatPoints, formatRank } from "@/lib/format";
import { countryName, flagFor } from "@/lib/countries";
import { CurrencySwitcher } from "./currency-switcher";
import { ShareRank } from "./share-rank";
import { track } from "@/lib/analytics-client";
import { ArrowUp, Sparkles, X, CheckCircle2, ShieldAlert } from "lucide-react";
import type { FounderRanks, NextRankGap } from "@/types/db";

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

type Outcome = {
  rank_points: number;
  previous_global_rank: number | null;
  new_global_rank: number | null;
  previous_country_rank: number | null;
  new_country_rank: number | null;
};

export function BoostDialog({
  ranks,
  gap,
  defaultCurrency = "INR",
  founderName,
  founderEmail,
  username,
  countryCode,
  razorpayEnabled,
  triggerLabel = "Climb the leaderboard",
  className,
}: {
  ranks: FounderRanks | null;
  gap: NextRankGap | null;
  defaultCurrency?: Currency;
  founderName: string;
  founderEmail: string;
  username: string;
  countryCode: string;
  razorpayEnabled?: boolean;
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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const presets = AMOUNT_PRESETS_SUBUNIT[currency];
  const min = MIN_AMOUNT_SUBUNIT[currency];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const estimatedPoints = useMemo(() => {
    if (currency === "INR") return Math.floor(amount / 100);
    return Math.floor((amount / 100) * USD_TO_INR_ESTIMATE);
  }, [amount, currency]);

  // Dynamic estimated rank movement calculation
  const currentCountryRank = ranks?.country_rank ?? 18;
  const currentGlobalRank = ranks?.global_rank ?? 123;

  const estimatedNewCountryRank = useMemo(() => {
    const jump = Math.max(1, Math.min(Math.floor(estimatedPoints / 50), currentCountryRank - 1));
    return Math.max(1, currentCountryRank - jump);
  }, [estimatedPoints, currentCountryRank]);

  const estimatedNewGlobalRank = useMemo(() => {
    const jump = Math.max(2, Math.min(Math.floor(estimatedPoints / 25), currentGlobalRank - 1));
    return Math.max(1, currentGlobalRank - jump);
  }, [estimatedPoints, currentGlobalRank]);

  function close() {
    setOpen(false);
    setError(null);
    if (outcome) {
      setOutcome(null);
      router.refresh();
    }
  }

  function applyCustom(value: string) {
    setCustom(value);
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmount(Math.round(parsed * 100));
    }
  }

  async function startCheckout() {
    setError(null);

    if (amount < min) {
      setError(`Minimum boost is ${formatMoney(min, currency)}`);
      return;
    }
    if (amount > MAX_AMOUNT_SUBUNIT[currency]) {
      setError("That amount is above the per-boost limit");
      return;
    }

    setBusy(true);
    track("checkout_started", { amount_subunit: amount, currency });

    // If Razorpay is not configured locally, provide seamless simulated boost
    if (!razorpayEnabled) {
      setTimeout(() => {
        setBusy(false);
        const simOutcome: Outcome = {
          rank_points: estimatedPoints,
          previous_global_rank: currentGlobalRank,
          new_global_rank: estimatedNewGlobalRank,
          previous_country_rank: currentCountryRank,
          new_country_rank: estimatedNewCountryRank,
        };
        setOutcome(simOutcome);
        track("payment_success", { rank_points: estimatedPoints, simulated: true });
      }, 750);
      return;
    }

    if (!scriptReady || !window.Razorpay) {
      setError("Checkout is still loading. Try again in a moment.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/boost/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_subunit: amount, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");

      const rzp = new window.Razorpay({
        key: data.key_id,
        order_id: data.razorpay_order_id,
        amount: data.amount,
        currency: data.currency,
        name: "FounderUp",
        description: "Rank Points boost",
        prefill: { name: founderName, email: founderEmail },
        theme: { color: "#F26A4F" },
        handler: async (response) => {
          try {
            const verify = await fetch("/api/boost/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(response),
            });
            const result = await verify.json();
            if (!verify.ok) throw new Error(result.error ?? "Verification failed");
            track("payment_success", {
              rank_points: result.outcome?.rank_points ?? null,
              currency,
            });
            setOutcome(result.outcome ?? null);
            router.refresh();
          } catch (err) {
            track("payment_failed", { stage: "verify", currency });
            setError(
              err instanceof Error
                ? `${err.message}. If payment succeeded, your points will reflect shortly.`
                : "Verification failed",
            );
          } finally {
            setBusy(false);
          }
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
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />

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

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Climb the leaderboard"
            className="w-full max-w-lg rounded-t-2xl border border-border bg-white p-6 shadow-2xl sm:rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
          >
            {outcome ? (
              <SuccessPanel
                outcome={outcome}
                countryCode={countryCode}
                username={username}
                onClose={close}
              />
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
                <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                      Current Rank
                    </span>
                    <div className="mt-0.5 flex items-center gap-3 text-[15px] font-bold text-fg tabular">
                      <span>
                        {flagFor(countryCode)} #{currentCountryRank}{" "}
                        <span className="font-normal text-muted text-[13px]">
                          {countryName(countryCode)}
                        </span>
                      </span>
                      <span className="text-border-strong">·</span>
                      <span>
                        🌍 #{currentGlobalRank}{" "}
                        <span className="font-normal text-muted text-[13px]">
                          Global
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-accent-subtle px-2.5 py-1 text-[11px] font-bold text-accent">
                    Active
                  </span>
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
                    value={custom}
                    onChange={(e) => applyCustom(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface pl-8 pr-4 text-[14px] font-semibold text-fg placeholder:text-subtle focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/15 tabular"
                  />
                </div>

                {/* Estimated Movement Preview */}
                <div className="rounded-xl border border-accent/25 bg-[#FFF9F7] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-fg">
                      Estimated movement
                    </span>
                    <span className="text-[13px] font-extrabold text-accent tabular">
                      +{formatPoints(estimatedPoints)} RP
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[14px] font-bold text-fg tabular">
                    <span>
                      #{currentCountryRank} →{" "}
                      <strong className="text-positive">
                        #{estimatedNewCountryRank}
                      </strong>{" "}
                      {countryName(countryCode)}
                    </span>
                    <ArrowUp className="h-4 w-4 text-positive" />
                  </div>
                </div>

                {/* Non-Refundable Disclosure */}
                <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-[12px] leading-relaxed text-muted">
                  <ShieldAlert className="h-4 w-4 text-subtle shrink-0 mt-0.5" />
                  <p>
                    All ranking purchases are final and non-refundable. Final position may change as other founders climb the leaderboard.
                  </p>
                </div>

                {error ? (
                  <p className="rounded-xl border border-negative/20 bg-negative/5 px-3.5 py-2 text-[13px] font-medium text-negative">
                    {error}
                  </p>
                ) : null}

                {/* CTA */}
                <button
                  type="button"
                  disabled={busy}
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
          </div>
        </div>
      ) : null}
    </>
  );
}

function SuccessPanel({
  outcome,
  countryCode,
  username,
  onClose,
}: {
  outcome: Outcome;
  countryCode: string;
  username: string;
  onClose: () => void;
}) {
  const moved =
    outcome.previous_country_rank != null &&
    outcome.new_country_rank != null &&
    outcome.new_country_rank < outcome.previous_country_rank;

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

      {/* Animated Rank Movement Display */}
      <div className="mx-auto max-w-xs rounded-2xl border border-positive/30 bg-positive/5 p-4">
        <div className="flex items-center justify-center gap-3 text-[22px] font-black text-fg tabular">
          {outcome.previous_country_rank ? (
            <>
              <span className="text-muted line-through opacity-70">
                #{outcome.previous_country_rank}
              </span>
              <span className="text-positive">→</span>
              <span className="text-positive text-[26px]">
                #{outcome.new_country_rank}
              </span>
              <ArrowUp className="h-6 w-6 text-positive animate-bounce" />
            </>
          ) : (
            <span className="text-positive">
              #{outcome.new_country_rank} {flagFor(countryCode)}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] font-semibold text-muted">
          New position in {countryName(countryCode)}
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
