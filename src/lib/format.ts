import type { Currency } from "@/types/property";

interface FormatMoneyOptions {
  currency?: Currency;
  showCents?: boolean;
}

// The locale is pinned rather than the browser's: an es-ES visitor reading "$215.000"
// cannot tell thousands from cents.
export function formatMoney(
  amount: number | null | undefined,
  { currency = "USD", showCents = true }: FormatMoneyOptions = {}
): string {
  const symbol = currency === "EUR" ? "€" : "$";
  const digits = showCents ? 2 : 0;

  if (amount == null || !Number.isFinite(amount)) {
    return `${symbol}${(0).toFixed(digits)}`;
  }

  // "-$500", not "$-500".
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

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}
