// Financial metrics shared by the API routes and the pages. Kept free of any data-layer
// import so both sides can use it without pulling the mock database into the client bundle.
//
// The point of this module is that there is exactly ONE definition of each metric. ROI used
// to be computed independently in property-details/route.ts and in the detail page, which is
// how the route ended up emitting Infinity/NaN for a zero purchase price while the page
// guarded against it - see BUGS.md #31.

// Returns null when the return is undefined rather than zero: a property with no purchase
// price has no ROI, and `null` is the only honest answer. Callers render it as "N/A".
export function calculateRoi(currentValue: number, purchasePrice: number): number | null {
  if (!Number.isFinite(currentValue) || !Number.isFinite(purchasePrice)) return null;
  if (purchasePrice === 0) return null;
  return ((currentValue - purchasePrice) / purchasePrice) * 100;
}

export function calculateNetCashflow(monthlyIncome: number, monthlyExpenses: number): number {
  const income = Number.isFinite(monthlyIncome) ? monthlyIncome : 0;
  const expenses = Number.isFinite(monthlyExpenses) ? monthlyExpenses : 0;
  return income - expenses;
}
