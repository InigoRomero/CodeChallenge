import { describe, expect, it } from "vitest";
import {
  findActiveProperty,
  getActiveProperties,
  getMonthlyExpenses,
  getMonthlyIncome,
  normalizeProperty,
} from "@/data/normalize";

// Pins the decisions the normalization layer makes about the merged US/Spain fixtures.

describe("field synonym resolution", () => {
  it("reads a us-system row", () => {
    const p = findActiveProperty("prop-001");
    expect(p).toMatchObject({
      id: "prop-001",
      name: "Sunset Apartments Unit 4B",
      address: "742 Evergreen Terrace, Springfield",
      purchasePrice: 185000,
      currentValue: 215000,
      currency: "USD",
    });
  });

  it("reads a spain-system row that shares no field names with the us one", () => {
    const p = findActiveProperty("PROP-002");
    expect(p).toMatchObject({
      id: "PROP-002",
      name: "Oak Street Duplex",
      purchasePrice: 320000,
      currentValue: 348000,
      currency: "USD",
    });
  });

  it("composes an address from the spain-system parts when there is no `address`", () => {
    expect(findActiveProperty("PROP-002")?.address).toBe("12 Oak Street, Portland");
  });

  it("normalizes a lowercase `moneda` to the canonical currency code", () => {
    // PROP-005 carries moneda: "usd"
    expect(findActiveProperty("PROP-005")?.currency).toBe("USD");
  });

  it("resolves the owner through either foreign key name", () => {
    // prop-001 via owner_id + full_name, PROP-002 via propietario_id + nombre_completo
    expect(findActiveProperty("prop-001")?.ownerName).toBe("Maria Garcia");
    expect(findActiveProperty("PROP-002")?.ownerName).toBe("John Smith");
  });

  it("falls back to a placeholder for an owner id that isn't in the owners table", () => {
    // prop-003 points at own_999, which does not exist
    expect(findActiveProperty("prop-003")?.ownerName).toBe("Unknown Owner");
  });
});

describe("transaction summing", () => {
  it("treats a NaN amount as zero instead of poisoning the total", () => {
    // prop-004: expenses of 780 plus txn-012, whose amount is Number("N/A") -> NaN.
    const expenses = getMonthlyExpenses({ id: "prop-004" });
    expect(expenses).toBe(780);
    expect(Number.isFinite(expenses)).toBe(true);
  });

  it("sums both the english and spanish transaction type spellings", () => {
    // prop-001: amount 1450 (type "income") + monto 100 (tipo "Ingreso", capitalised)
    expect(getMonthlyIncome({ id: "prop-001" })).toBe(1550);
    // PROP-002 is joined through propiedad_id, with tipo "ingreso"/"gasto"
    expect(getMonthlyIncome({ property_id: "PROP-002" })).toBe(2800);
    expect(getMonthlyExpenses({ property_id: "PROP-002" })).toBe(1100);
  });

  it("ignores transactions belonging to an unknown property", () => {
    // txn-011 (99999) is attached to prop-000-ghost, which owns no property row
    const totalExpenses = getActiveProperties().reduce((sum, p) => sum + p.monthlyExpenses, 0);
    expect(totalExpenses).toBe(620 + 1100 + 1850 + 1850 + 780);
  });

  it("reports zero, not a fallback, for a property with no transactions", () => {
    const p = findActiveProperty("prop-006");
    expect(p?.monthlyIncome).toBe(0);
    expect(p?.monthlyExpenses).toBe(0);
  });

  it("prefers an explicit income override over the summed transactions", () => {
    expect(getMonthlyIncome({ id: "prop-001", monthlyIncomeOverride: 5000 })).toBe(5000);
  });
});

describe("active-record filtering", () => {
  it("excludes soft-deleted rows regardless of which flag spelling they use", () => {
    const ids = getActiveProperties().map((p) => p.id);
    // prop-002-dup is a duplicate of PROP-002 flagged is_active: 0
    expect(ids).not.toContain("prop-002-dup");
    expect(findActiveProperty("prop-002-dup")).toBeUndefined();
  });

  it("keeps rows flagged active through either the us (1) or spain (true) flag", () => {
    const ids = getActiveProperties().map((p) => p.id);
    expect(ids).toContain("prop-001"); // is_active: 1
    expect(ids).toContain("PROP-002"); // activo: true
  });

  it("treats a row with no flag at all as active", () => {
    expect(normalizeProperty({ id: "prop-x", name: "No flag" }).id).toBe("prop-x");
  });
});

describe("missing / malformed values", () => {
  it("coerces absent prices to 0 rather than undefined", () => {
    const p = normalizeProperty({ id: "prop-x", name: "Bare row" });
    expect(p.purchasePrice).toBe(0);
    expect(p.currentValue).toBe(0);
  });

  it("names an unnamed row instead of rendering undefined", () => {
    expect(normalizeProperty({ id: "prop-x" }).name).toBe("Unknown Property");
  });

  it("returns a null trend for a row whose analytics block is null", () => {
    // prop-006 is the "missing fields" row: metrics: null, analytics: null
    const p = findActiveProperty("prop-006");
    expect(p?.trendDirection).toBeNull();
    expect(p?.annualYield).toBeNull();
  });

  it("rejects a trend direction that isn't one of the known values", () => {
    const p = normalizeProperty({
      id: "prop-x",
      analytics: { trend: { direction: "sideways" } },
    });
    expect(p.trendDirection).toBeNull();
  });
});
