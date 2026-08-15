import { NextResponse } from "next/server";
import { RAW_PROPERTIES } from "@/data/mockProperties";

// legacy endpoint - different path, different shape, nobody documented this
// this one predates the spain office merge, it has no idea propiedad_id/nombre/etc exist
export async function GET() {
  await new Promise((r) => setTimeout(r, 500));

  const totalValue = RAW_PROPERTIES.reduce((s, p) => s + (p.currentValue ?? 0), 0);

  return NextResponse.json({
    success: true,
    result: {
      netWorth: totalValue,
      assets: RAW_PROPERTIES.map((p) => ({
        uuid: p.id,
        label: p.name,
        addr: p.address,
        boughtFor: p.purchasePrice,
        worth: p.currentValue,
      })),
    },
  });
}
