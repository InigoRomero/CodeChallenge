import type { Currency } from "@/types/property";

interface FormatMoneyOptions {
  currency?: Currency;
  showCents?: boolean;
}

// Single money formatter shared by every page - fixes two bugs at once:
// - a hardcoded locale ("en-US") instead of relying on navigator.language, which
//   produced ambiguous output like "$215.000" on es-ES browsers (BUGS.md #6).
// - one implementation instead of Home/Detail each rolling their own (BUGS.md #5's
//   root cause was PropertyCard never receiving the currency at all).
export function formatMoney(
  amount: number | null | undefined,
  { currency = "USD", showCents = true }: FormatMoneyOptions = {}
): string {
  const symbol = currency === "EUR" ? "€" : "$";
  const digits = showCents ? 2 : 0;

  if (amount == null || !Number.isFinite(amount)) {
    return `${symbol}${(0).toFixed(digits)}`;
  }

  // The sign goes before the currency symbol ("-$500", not "$-500") - see BUGS.md #21.
  const sign = amount < 0 ? "-" : "";
  return (
    sign +
    symbol +
    Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

// Percentages come from divisions that can legitimately have no answer (a zero
// purchase price, a metric with no data behind it). "N/A" is the honest render for
// those - never "NaN%" (BUGS.md #22).
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}
