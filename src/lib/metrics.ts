// One definition of each financial metric, shared by the API routes and the pages so the
// two can't drift. Imports nothing from the data layer, to stay out of the client bundle.

// Null, not zero: a property with no purchase price has no return to report.
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
