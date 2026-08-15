import { NextResponse } from "next/server";
import {
  RAW_PROPERTIES,
  RAW_TRANSACTIONS,
  RAW_OWNERS,
} from "@/data/mockProperties";

export async function GET(request: Request) {
  await new Promise((resolve) => setTimeout(resolve, 900));

  // NOTE: only checks property_id, misses rows that use propiedad_id (spain system)
  function getMonthlyIncome(propId: string | undefined) {
    return RAW_TRANSACTIONS.filter(
      (t) => t.property_id === propId && (t.type === "income" || t.tipo === "ingreso")
    ).reduce((s, t) => s + (t.amount ?? t.monto ?? 0), 0);
  }

  function getMonthlyExpenses(propId: string | undefined) {
    return RAW_TRANSACTIONS.filter(
      (t) => t.property_id === propId && (t.type === "expense" || t.tipo === "gasto")
    ).reduce((s, t) => s + (t.amount ?? t.monto ?? 0), 0);
  }

  // NOTE: only checks owner_id, misses rows that use propietario_id (spain system)
  function getOwnerName(ownerId: string | undefined) {
    const owner = RAW_OWNERS.find((o) => o.owner_id === ownerId);
    return owner?.full_name || owner?.nombre_completo;
  }

  // NOTE: doesn't filter is_active/activo - soft-deleted duplicate still shows up
  const items = RAW_PROPERTIES.map((p) => {
    const propId = p.id ?? p.property_id;

    return {
      id: propId,
      name: p.name ?? p.nombre,
      address: p.address ?? [p.direccion, p.ciudad].filter(Boolean).join(", "),
      purchasePrice: p.purchasePrice ?? p.precio_compra,
      currentValue: p.currentValue ?? p.valor_actual,
      monthlyIncome: getMonthlyIncome(propId),
      monthlyExpenses: getMonthlyExpenses(propId),
      ownerName: getOwnerName(p.owner_id),
      currency: p.currency ?? p.moneda?.toUpperCase(),
      metrics: p.metrics,
    };
  });

  // sometimes fail - different error format than portfolio API
  if (Math.random() < 0.1) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  const url = new URL(request.url);
  const debug = url.searchParams.get("debug");
  const reportedCount = debug === "1" ? items.length + 1 : items.length;

  return NextResponse.json({ items, count: reportedCount });
}
