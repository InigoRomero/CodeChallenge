import { NextResponse } from "next/server";
import { findActiveProperty, findRawPropertyById } from "@/data/normalize";
import { calculateNetCashflow, calculateRoi } from "@/lib/metrics";
import type { PropertyDetail, PropertyStats } from "@/types/property";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("property_id") || searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const property = findActiveProperty(id);

  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const roi = calculateRoi(property.currentValue, property.purchasePrice);
  const net = calculateNetCashflow(property.monthlyIncome, property.monthlyExpenses);

  const raw = findRawPropertyById(id);
  // No ROI means no trend: an arrow derived from a non-number is a fabricated one.
  const stats: PropertyStats | null =
    raw?.analytics === null || roi === null
      ? null
      : {
          roi,
          net,
          trend: { direction: roi >= 0 ? "up" : "down", label: "12mo" },
        };

  const propertyDetail: PropertyDetail = {
    id: property.id,
    name: property.name,
    address: property.address,
    currency: property.currency,
    purchasePrice: property.purchasePrice,
    currentValue: property.currentValue,
    monthlyIncome: property.monthlyIncome,
    monthlyExpenses: property.monthlyExpenses,
    ownerName: property.ownerName,
    stats,
  };

  return NextResponse.json({
    property: propertyDetail,
    fetchedAt: Date.now(),
  });
}
