import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";
import { shouldInjectFailure } from "@/lib/chaos";
import { calculateNetCashflow, calculateRoi } from "@/lib/metrics";
import type { Portfolio } from "@/types/property";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceError = url.searchParams.get("forceError");

  if (forceError === "1" || shouldInjectFailure(0.15)) {
    return NextResponse.json(
      { ok: false, err_msg: "something went wrong on our end sorry!!" },
      { status: 500 }
    );
  }

  const properties = getActiveProperties();

  // Sums USD and EUR properties as one unit: there is no FX rate source in the data.
  const totalPurchase = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalIncome = properties.reduce((sum, p) => sum + p.monthlyIncome, 0);
  const totalExpenses = properties.reduce((sum, p) => sum + p.monthlyExpenses, 0);

  const portfolio: Portfolio = {
    totalWorth: totalValue,
    totalInvested: totalPurchase,
    monthlyCashflow: calculateNetCashflow(totalIncome, totalExpenses),
    propertyCount: properties.length,
    gainLossPercent: calculateRoi(totalValue, totalPurchase),
    currency: "USD",
  };

  return NextResponse.json({ portfolio });
}
