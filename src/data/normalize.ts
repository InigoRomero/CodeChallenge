// The one place the us-system/spain-system field synonyms get resolved. Every API route
// reads the RAW_* tables through here rather than re-resolving them itself.

import {
  RAW_OWNERS,
  RAW_PROPERTIES,
  RAW_TRANSACTIONS,
  type RawPropertyRow,
  type RawTransactionRow,
} from "@/data/mockProperties";
import type { Currency, PropertyListItem, TrendDirection } from "@/types/property";

function toFiniteNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getPropertyId(p: RawPropertyRow): string {
  return p.id ?? p.property_id ?? "";
}

function getPropertyName(p: RawPropertyRow): string {
  return p.name ?? p.nombre ?? "Unknown Property";
}

function getPropertyAddress(p: RawPropertyRow): string {
  return p.address ?? [p.direccion, p.ciudad].filter(Boolean).join(", ");
}

function getCurrency(p: RawPropertyRow): Currency {
  const raw = p.currency ?? p.moneda;
  return raw?.toUpperCase() === "EUR" ? "EUR" : "USD";
}

function isPropertyActive(p: RawPropertyRow): boolean {
  if (p.is_active !== undefined) return p.is_active === 1;
  if (p.activo !== undefined) return p.activo === true;
  return true;
}

function getOwnerId(p: RawPropertyRow): string | undefined {
  return p.owner_id ?? p.propietario_id;
}

function getOwnerName(ownerId: string | undefined): string {
  const owner = RAW_OWNERS.find((o) => o.owner_id === ownerId);
  return owner?.full_name ?? owner?.nombre_completo ?? "Unknown Owner";
}

function matchesProperty(t: RawTransactionRow, propId: string): boolean {
  return (t.property_id ?? t.propiedad_id) === propId;
}

function isIncomeTxn(t: RawTransactionRow): boolean {
  const kind = (t.type ?? t.tipo ?? "").toLowerCase();
  return kind === "income" || kind === "ingreso";
}

function isExpenseTxn(t: RawTransactionRow): boolean {
  const kind = (t.type ?? t.tipo ?? "").toLowerCase();
  return kind === "expense" || kind === "gasto";
}

function sumTransactions(
  propId: string,
  predicate: (t: RawTransactionRow) => boolean
): number {
  return RAW_TRANSACTIONS.filter((t) => matchesProperty(t, propId) && predicate(t)).reduce(
    (sum, t) => sum + toFiniteNumber(t.amount ?? t.monto),
    0
  );
}

export function getMonthlyIncome(p: RawPropertyRow): number {
  if (p.monthlyIncomeOverride !== undefined) return p.monthlyIncomeOverride;
  return sumTransactions(getPropertyId(p), isIncomeTxn);
}

export function getMonthlyExpenses(p: RawPropertyRow): number {
  return sumTransactions(getPropertyId(p), isExpenseTxn);
}

function getTrendDirection(p: RawPropertyRow): TrendDirection | null {
  const direction = p.analytics?.trend?.direction;
  return direction === "up" || direction === "down" ? direction : null;
}

export function normalizeProperty(p: RawPropertyRow): PropertyListItem {
  return {
    id: getPropertyId(p),
    name: getPropertyName(p),
    address: getPropertyAddress(p),
    currency: getCurrency(p),
    purchasePrice: toFiniteNumber(p.purchasePrice ?? p.precio_compra),
    currentValue: toFiniteNumber(p.currentValue ?? p.valor_actual),
    monthlyIncome: getMonthlyIncome(p),
    monthlyExpenses: getMonthlyExpenses(p),
    ownerName: getOwnerName(getOwnerId(p)),
    annualYield: p.metrics?.annualYield ?? null,
    trendDirection: getTrendDirection(p),
  };
}

export function getActiveProperties(): PropertyListItem[] {
  return RAW_PROPERTIES.filter(isPropertyActive).map(normalizeProperty);
}

export function findActiveProperty(id: string): PropertyListItem | undefined {
  const raw = RAW_PROPERTIES.find((p) => isPropertyActive(p) && getPropertyId(p) === id);
  return raw ? normalizeProperty(raw) : undefined;
}

export function findRawPropertyById(id: string): RawPropertyRow | undefined {
  return RAW_PROPERTIES.find((p) => getPropertyId(p) === id);
}
