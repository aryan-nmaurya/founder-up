"use client";
import { CURRENCIES, type Currency } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * Plan §4 - an international visitor may switch to INR. Once they choose, the
 * preference is remembered and we never silently switch it back.
 */
export function CurrencySwitcher({
  value,
  onChange,
  disabled,
}: {
  value: Currency;
  onChange: (next: Currency) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border-strong p-0.5">
      {CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          disabled={disabled}
          onClick={() => {
            document.cookie = `fu_currency=${currency}; path=/; max-age=31536000; samesite=lax`;
            onChange(currency);
          }}
          className={cn(
            "h-7 rounded px-2.5 text-[12px] font-medium disabled:opacity-50",
            value === currency ? "bg-fg text-white" : "text-muted hover:text-fg",
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
