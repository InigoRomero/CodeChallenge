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
  if (amount == null) {
    return showCents ? `${symbol}0.00` : `${symbol}0`;
  }
  return (
    symbol +
    Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    })
  );
}
