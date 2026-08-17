import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent } from "@/lib/format";

describe("formatMoney", () => {
  it("uses a fixed locale so separators don't follow the browser (BUGS.md #6)", () => {
    // On an es-ES browser toLocaleString() with no locale produced "$215.000", which
    // reads as 215 dollars and change rather than 215 thousand.
    expect(formatMoney(215000, { showCents: false })).toBe("$215,000");
    expect(formatMoney(1875000)).toBe("$1,875,000.00");
  });

  it("puts the sign before the symbol (BUGS.md #21)", () => {
    expect(formatMoney(-500, { showCents: false })).toBe("-$500");
    expect(formatMoney(-500, { currency: "EUR" })).toBe("-€500.00");
  });

  it("honours the display currency", () => {
    expect(formatMoney(1000, { currency: "EUR", showCents: false })).toBe("€1,000");
  });

  it("renders a zero placeholder for absent or non-finite amounts", () => {
    expect(formatMoney(null)).toBe("$0.00");
    expect(formatMoney(undefined, { showCents: false })).toBe("$0");
    expect(formatMoney(Number.NaN)).toBe("$0.00");
  });

  it("respects the cents toggle", () => {
    expect(formatMoney(1234.56, { showCents: true })).toBe("$1,234.56");
    expect(formatMoney(1234.56, { showCents: false })).toBe("$1,235");
  });
});

describe("formatPercent", () => {
  it("renders N/A instead of NaN% for a metric with no data behind it", () => {
    expect(formatPercent(null)).toBe("N/A");
    expect(formatPercent(Number.NaN)).toBe("N/A");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("N/A");
  });

  it("formats a real percentage to one decimal", () => {
    expect(formatPercent(16.216)).toBe("16.2%");
    expect(formatPercent(-3.14)).toBe("-3.1%");
  });
});
