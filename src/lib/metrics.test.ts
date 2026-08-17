import { describe, expect, it } from "vitest";
import { calculateNetCashflow, calculateRoi } from "@/lib/metrics";

describe("calculateRoi", () => {
  it("computes the return against the purchase price", () => {
    // prop-001: 185000 -> 215000
    expect(calculateRoi(215000, 185000)).toBeCloseTo(16.216, 3);
  });

  it("handles a loss", () => {
    // prop-003: bought at 510000, now worth 495000
    expect(calculateRoi(495000, 510000)).toBeCloseTo(-2.941, 3);
  });

  it("returns null for a zero purchase price instead of Infinity (BUGS.md #31)", () => {
    // The route used to emit this straight into JSON, where Infinity becomes null and
    // breaks the `roi: number` contract, and `NaN >= 0` fabricated a "down" trend arrow.
    expect(calculateRoi(112000, 0)).toBeNull();
    expect(calculateRoi(0, 0)).toBeNull();
  });

  it("returns null rather than propagating a non-finite input", () => {
    expect(calculateRoi(Number.NaN, 185000)).toBeNull();
    expect(calculateRoi(215000, Number.NaN)).toBeNull();
  });

  it("is zero when nothing has changed", () => {
    expect(calculateRoi(185000, 185000)).toBe(0);
  });
});

describe("calculateNetCashflow", () => {
  it("subtracts expenses from income", () => {
    expect(calculateNetCashflow(1550, 620)).toBe(930);
  });

  it("returns a negative figure for a loss-making property", () => {
    // prop-003: 3200 income against 3700 expenses
    expect(calculateNetCashflow(3200, 3700)).toBe(-500);
  });

  it("treats a zero-expense property as zero, not as missing data (BUGS.md #9)", () => {
    expect(calculateNetCashflow(0, 0)).toBe(0);
  });

  it("coerces non-finite inputs to zero instead of returning NaN", () => {
    expect(calculateNetCashflow(Number.NaN, 620)).toBe(-620);
    expect(calculateNetCashflow(1550, Number.NaN)).toBe(1550);
  });
});
