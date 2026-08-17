// What the API returns once src/data/normalize.ts has resolved the raw us/spain synonyms.

export type Currency = "USD" | "EUR";
export type TrendDirection = "up" | "down";

// GET /api/properties/list (one item), and the input to /api/legacy/portfolio's remapping.
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

// GET /api/property-details.
export interface PropertyDetail {
  id: string;
  name: string;
  address: string;
  // The property's own currency, not a display preference.
  currency: Currency;
  purchasePrice: number;
  currentValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  ownerName: string;
  stats: PropertyStats | null;
  // No endpoint sends this: financing isn't modelled yet. Cash-on-Cash Return renders
  // "N/A" until something does.
  downPayment?: number;
}

// GET /api/v1/user/portfolio-summary.
export interface Portfolio {
  totalWorth: number;
  totalInvested: number;
  monthlyCashflow: number;
  propertyCount: number;
  // Null on an empty portfolio: nothing invested to measure a return against.
  gainLossPercent: number | null;
  currency: Currency;
}
