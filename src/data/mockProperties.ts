// TODO: this file has properties AND owners AND transactions in it now, rename later
// exported "as-is" from the old database - nobody cleaned up the column names
// after we merged the spanish office system with the us system, sorry in advance

export type RawOwnerRow = {
  owner_id: string;
  full_name?: string; // us system
  nombre_completo?: string; // spain system
  email: string;
  country?: string;
  pais?: string;
};

export type RawPropertyRow = {
  id?: string; // us system primary key
  property_id?: string; // spain system primary key
  name?: string;
  nombre?: string;
  address?: string;
  direccion?: string;
  city?: string;
  ciudad?: string;
  country?: string;
  pais?: string;
  purchasePrice?: number;
  precio_compra?: number;
  currentValue?: number;
  valor_actual?: number;
  currency?: "USD" | "EUR";
  moneda?: "USD" | "EUR" | "usd" | "eur";
  owner_id?: string; // fk to RAW_OWNERS.owner_id (us naming)
  propietario_id?: string; // fk to RAW_OWNERS.owner_id (spain naming, same table!)
  is_active?: number; // 1 / 0 - us system soft-delete flag
  activo?: boolean; // true / false - spain system soft-delete flag (different type!)
  metrics?: { annualYield: number } | null;
  analytics?: { trend: { direction: string } } | null;
};

export type RawTransactionRow = {
  id: string;
  property_id?: string; // fk (us naming)
  propiedad_id?: string; // fk (spain naming, same column meaning!)
  type?: "income" | "expense";
  tipo?: "ingreso" | "gasto" | "Ingreso";
  amount?: number;
  monto?: number;
  month?: string;
  mes?: string;
};

export const RAW_OWNERS: RawOwnerRow[] = [
  {
    owner_id: "own_1",
    full_name: "Maria Garcia",
    email: "maria@example.com",
    pais: "Spain",
  },
  {
    owner_id: "own_2",
    nombre_completo: "John Smith",
    email: "john@example.com",
    country: "USA",
  },
  {
    owner_id: "own_2b",
    nombre_completo: "John Smith",
    email: "john@example.com",
    country: "USA",
  },
  {
    owner_id: "own_9",
    full_name: "Ghost Owner",
    email: "ghost@example.com",
    pais: "Portugal",
  },
];

export const RAW_PROPERTIES: RawPropertyRow[] = [
  {
    id: "prop-001",
    name: "Sunset Apartments Unit 4B",
    address: "742 Evergreen Terrace, Springfield",
    currency: "USD",
    purchasePrice: 185000,
    currentValue: 215000,
    owner_id: "own_1",
    is_active: 1,
    metrics: { annualYield: 8.1 },
  },
  {
    property_id: "PROP-002",
    nombre: "Oak Street Duplex",
    direccion: "12 Oak Street",
    ciudad: "Portland",
    pais: "USA",
    moneda: "USD",
    precio_compra: 320000,
    valor_actual: 348000,
    propietario_id: "own_2",
    activo: true,
    metrics: { annualYield: 10.5 },
  },
  {
    id: "prop-003",
    name: "Downtown Loft",
    direccion: "88 Market St",
    ciudad: "San Francisco",
    precio_compra: 510000,
    currentValue: 495000,
    currency: "USD",
    owner_id: "own_999",
    is_active: 1,
    metrics: { annualYield: 7.6 },
  },
  {
    id: "prop-004",
    name: "Riverside Cottage",
    address: "5 River Road, Austin",
    currency: "EUR",
    purchasePrice: 240000,
    currentValue: 267000,
    owner_id: "own_2b",
    is_active: 1,
    metrics: { annualYield: 9.5 },
  },
  {
    property_id: "PROP-005",
    nombre: "Harbor View Condo",
    direccion: "200 Harbor Blvd",
    ciudad: "Miami",
    pais: "USA",
    moneda: "usd",
    precio_compra: 410000,
    valor_actual: 438000,
    propietario_id: "own_1",
    activo: true,
    metrics: { annualYield: 0 },
  },
  {
    id: "prop-002-dup",
    name: "Oak Street Duplex",
    address: "12 Oak Street, Portland",
    currency: "USD",
    purchasePrice: 320000,
    currentValue: 351000,
    owner_id: "own_2",
    is_active: 0,
    metrics: { annualYield: 10.5 },
  },
  {
    id: "prop-006",
    name: "Lakeview Studio",
    address: "404 Missing Fields Blvd, Denver",
    currency: "USD",
    purchasePrice: 95000,
    currentValue: 112000,
    owner_id: "own_1",
    is_active: 1,
    metrics: null,
    analytics: null,
  },
];

export const RAW_TRANSACTIONS: RawTransactionRow[] = [
  { id: "txn-001", property_id: "prop-001", type: "income", amount: 1450, month: "2026-06" },
  { id: "txn-002", property_id: "prop-001", type: "expense", amount: 620, month: "2026-06" },
  { id: "txn-003", property_id: "prop-001", tipo: "Ingreso", monto: 100, mes: "2026-06" },
  { id: "txn-004", propiedad_id: "PROP-002", tipo: "ingreso", monto: 2800, mes: "2026-06" },
  { id: "txn-005", propiedad_id: "PROP-002", tipo: "gasto", monto: 1100, mes: "2026-06" },
  { id: "txn-006", property_id: "prop-003", type: "income", amount: 3200, month: "2026-06" },
  { id: "txn-007", property_id: "prop-003", type: "expense", amount: 1850, month: "2026-06" },
  { id: "txn-008", property_id: "prop-003", type: "expense", amount: 1850, month: "2026-06" },
  { id: "txn-009", property_id: "prop-004", type: "income", amount: 1900, month: "2026-06" },
  { id: "txn-010", property_id: "prop-004", type: "expense", amount: 780, month: "2026-06" },
  { id: "txn-012", property_id: "prop-004", type: "expense", amount: Number("N/A"), month: "2026-06" },
  { id: "txn-011", property_id: "prop-000-ghost", type: "expense", amount: 99999, month: "2026-06" },
];
