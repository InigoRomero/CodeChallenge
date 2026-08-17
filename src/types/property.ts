// Shared type contracts for the normalized property domain.
// These describe what the API actually returns after src/data/normalize.ts -
// the interfaces referenced by CLAUDE.md's "no any" rule.

export type Currency = "USD" | "EUR";
export type TrendDirection = "up" | "down";

// Shape returned by GET /api/properties/list (one item) and GET /api/legacy/portfolio
// (after normalization, before being remapped to the legacy uuid/label/addr contract).
export interface PropertyListItem {
  id: string;
  name: string;
  address: string;
  currency: Currency;
  purchasePrice: number;
  currentValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  ownerName: string;
  annualYield: number | null;
  trendDirection: TrendDirection | null;
}

export interface PropertyStats {
  roi: number;
  net: number;
  trend: { direction: TrendDirection; label: string };
}

// Shape returned by GET /api/property-details.
export interface PropertyDetail {
  id: string;
  name: string;
  address: string;
  purchasePrice: number;
  currentValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  ownerName: string;
  stats: PropertyStats | null;
  // Never sent by any endpoint - no down-payment/financing concept exists in the data
  // model yet. Kept optional so Cash-on-Cash Return's calc keeps compiling; see BUGS.md #18.
  downPayment?: number;
}

// Shape returned by GET /api/v1/user/portfolio-summary.
export interface Portfolio {
  totalWorth: number;
  totalInvested: number;
  monthlyCashflow: number;
  propertyCount: number;
  gainLossPercent: number;
  currency: Currency;
}
