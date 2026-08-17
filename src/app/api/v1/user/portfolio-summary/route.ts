import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";
import type { Portfolio } from "@/types/property";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceError = url.searchParams.get("forceError");

  if (forceError === "1" || Math.random() < 0.15) {
    return NextResponse.json(
      { ok: false, err_msg: "something went wrong on our end sorry!!" },
      { status: 500 }
    );
  }

  const properties = getActiveProperties();

  // NOTE: sums raw currentValue/purchasePrice across USD and EUR properties without
  // converting currency - see BUGS.md new entry. No FX rate source exists in the mock data.
  const totalPurchase = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalIncome = properties.reduce((sum, p) => sum + p.monthlyIncome, 0);
  const totalExpenses = properties.reduce((sum, p) => sum + p.monthlyExpenses, 0);

  const portfolio: Portfolio = {
    totalWorth: totalValue,
    totalInvested: totalPurchase,
    monthlyCashflow: totalIncome - totalExpenses,
    propertyCount: properties.length,
    gainLossPercent: ((totalValue - totalPurchase) / totalPurchase) * 100,
    currency: "USD",
  };

  return NextResponse.json({ portfolio });
}
