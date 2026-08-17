import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";

// legacy endpoint - different path, different shape, nobody documented this
// this one predates the spain office merge, it has no idea propiedad_id/nombre/etc exist
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
