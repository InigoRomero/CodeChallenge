import { NextResponse } from "next/server";
import {
  RAW_PROPERTIES,
  RAW_TRANSACTIONS,
  RAW_OWNERS,
} from "@/data/mockProperties";

// yes, query param instead of RESTful path. deal with it.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("property_id") || searchParams.get("id");

  await new Promise((r) => setTimeout(r, 600));

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // primary key is called "id" OR "property_id" depending on which system the row came from
  const found = RAW_PROPERTIES.find((p) => p.id === id || p.property_id === id);

  if (!found) {
    if (Math.random() < 0.3) {
      return NextResponse.json({ property: null, status: "not_found" });
    }
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const propId = found.id ?? found.property_id;
  const purchase = found.purchasePrice ?? found.precio_compra ?? 0;
  const value = found.currentValue ?? found.valor_actual ?? 0;

  // NOTE: only checks property_id, misses transactions linked via propiedad_id
  const rent = RAW_TRANSACTIONS.filter(
    (t) => t.property_id === propId && (t.type === "income" || t.tipo === "ingreso")
  ).reduce((s, t) => s + (t.amount ?? t.monto ?? 0), 0);

  const costs = RAW_TRANSACTIONS.filter(
    (t) => t.property_id === propId && (t.type === "expense" || t.tipo === "gasto")
  ).reduce((s, t) => s + (t.amount ?? t.monto ?? 0), 0);

  // NOTE: only checks owner_id, misses owners linked via propietario_id
  const owner = RAW_OWNERS.find((o) => o.owner_id === found.owner_id);

  const roi = ((value - purchase) / purchase) * 100;
  const net = rent - costs;

  const stats =
    found.analytics === null
      ? null
      : {
          roi,
          net,
          trend: { direction: roi >= 0 ? "up" : "down", label: "12mo" },
        };

  // completely different field names than list endpoint
  return NextResponse.json({
    property: {
      identifier: propId,
      displayName: found.name ?? found.nombre,
      fullAddress: found.address ?? [found.direccion, found.ciudad].filter(Boolean).join(", "),
      purchase,
      value_now: value,
      rent,
      costs,
      ownerName: owner?.full_name || owner?.nombre_completo,
      stats,
    },
    fetchedAt: Date.now(),
  });
}
