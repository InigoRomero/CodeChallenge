import { NextResponse } from "next/server";
import { findActiveProperty, findRawPropertyById } from "@/data/normalize";
import type { PropertyDetail, PropertyStats } from "@/types/property";

// yes, query param instead of RESTful path. deal with it.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("property_id") || searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const property = findActiveProperty(id);

  if (!property) {
    if (Math.random() < 0.3) {
      return NextResponse.json({ property: null, status: "not_found" });
    }
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const roi = ((property.currentValue - property.purchasePrice) / property.purchasePrice) * 100;
  const net = property.monthlyIncome - property.monthlyExpenses;

  const raw = findRawPropertyById(id);
  const stats: PropertyStats | null =
    raw?.analytics === null
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
