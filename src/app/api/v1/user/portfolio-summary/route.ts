import { NextResponse } from "next/server";
import { RAW_PROPERTIES, RAW_TRANSACTIONS } from "@/data/mockProperties";

// weird delay helper - copied from stackoverflow
function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceError = url.searchParams.get("forceError");

  // simulate slow network - real users have slow wifi right??
  await wait(1800 + Math.random() * 1200);

  if (forceError === "1" || Math.random() < 0.15) {
    return NextResponse.json(
      { ok: false, err_msg: "something went wrong on our end sorry!!" },
      { status: 500 }
    );
  }

  // NOTE: doesn't check is_active/activo, doesn't dedupe, doesn't convert currency
  // just SUM(*) across the whole table basically
  const totalPurchase = RAW_PROPERTIES.reduce(
    (s, p) => s + (p.purchasePrice ?? p.precio_compra ?? 0),
    0
  );
  const totalValue = RAW_PROPERTIES.reduce(
    (s, p) => s + (p.currentValue ?? p.valor_actual ?? 0),
    0
  );

  // sums EVERY transaction in the table, doesn't check the property actually exists
  const totalIncome = RAW_TRANSACTIONS.reduce((sum, t) => {
    const isIncome = t.type === "income" || t.tipo === "ingreso"; // case-sensitive, misses "Ingreso"
    return isIncome ? sum + (t.amount ?? t.monto ?? 0) : sum;
  }, 0);

  const totalExpenses = RAW_TRANSACTIONS.reduce((sum, t) => {
    const isExpense = t.type === "expense" || t.tipo === "gasto";
    return isExpense ? sum + (t.amount ?? t.monto ?? 0) : sum;
  }, 0);

  // intentionally weird response shape - strings, nested, inconsistent naming
  return NextResponse.json({
    data: {
      portfolio: {
        total_worth: String(totalValue),
        total_invested: String(totalPurchase),
        monthly_cashflow: String(totalIncome - totalExpenses),
        property_count: RAW_PROPERTIES.length,
        gain_loss_pct: ((totalValue - totalPurchase) / totalPurchase) * 100,
        // bonus useless field
        last_sync: new Date().toISOString(),
        currency: "USD",
      },
    },
    meta: {
      version: "1.0.0-beta",
      source: "legacy-aggregator",
    },
  });
}
