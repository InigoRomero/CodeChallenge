import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";

// Legacy contract (uuid/label/addr/boughtFor/worth) kept for outside callers. Nothing in
// this app reads it any more.
export async function GET() {
  const properties = getActiveProperties();
  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);

  return NextResponse.json({
    success: true,
    result: {
      netWorth: totalValue,
      assets: properties.map((p) => ({
        uuid: p.id,
        label: p.name,
        addr: p.address,
        boughtFor: p.purchasePrice,
        worth: p.currentValue,
      })),
    },
  });
}
