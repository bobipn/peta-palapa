import { describe, expect, it } from "vitest";
import {
  cagr,
  futureValue,
  fvAnnuity,
  median,
  monthlyRate,
  paymentForTarget,
  presentValue,
  pvAnnuity,
  pvGrowingAnnuity,
  realReturn,
} from "./tvm";

describe("time value of money", () => {
  it("matches the spec example: Rp7.500.000 × 1.07^5 ≈ Rp10.519.000", () => {
    expect(futureValue(7_500_000, 0.07, 5)).toBeCloseTo(10_519_137.98, 1);
  });

  it("matches the spec example: Rp60 juta × 1.07^5", () => {
    expect(futureValue(60_000_000, 0.07, 5)).toBeCloseTo(84_153_103.84, 1);
  });

  it("PV is the inverse of FV", () => {
    expect(presentValue(futureValue(1_000_000, 0.08, 10), 0.08, 10)).toBeCloseTo(1_000_000, 6);
  });

  it("annuity factors agree with spreadsheet FV/PV (end of period)", () => {
    // Excel: =FV(0.5%,12,-100) = 1233.556
    expect(fvAnnuity(100, 0.005, 12)).toBeCloseTo(1233.5562, 3);
    // Excel: =PV(0.5%,12,-100) = 1161.8932
    expect(pvAnnuity(100, 0.005, 12)).toBeCloseTo(1161.8932, 3);
    // annuity due multiplies by (1 + r)
    expect(fvAnnuity(100, 0.005, 12, true)).toBeCloseTo(1233.5562 * 1.005, 3);
  });

  it("zero-rate annuity is a plain sum", () => {
    expect(fvAnnuity(100, 0, 12)).toBe(1200);
    expect(pvAnnuity(100, 0, 12)).toBe(1200);
  });

  it("payment for a target reproduces the target", () => {
    const r = 0.006;
    const n = 120;
    const pmt = paymentForTarget(500_000_000, 50_000_000, r, n);
    const fv = futureValue(50_000_000, r, n) + fvAnnuity(pmt, r, n);
    expect(fv).toBeCloseTo(500_000_000, 0);
    expect(paymentForTarget(10, 100, 0.01, 12)).toBe(0);
  });

  it("monthly rate compounds back to the annual rate", () => {
    expect(Math.pow(1 + monthlyRate(0.08), 12) - 1).toBeCloseTo(0.08, 12);
  });

  it("CAGR of the spec's SPP history 5.5 → 7.5 juta over 3 years", () => {
    expect(cagr(5_500_000, 7_500_000, 3)).toBeCloseTo(0.108918, 5);
    expect(cagr(0, 1, 1)).toBeNaN();
  });

  it("real return uses the Fisher relation, not subtraction", () => {
    expect(realReturn(0.08, 0.04)).toBeCloseTo(0.038462, 6);
    expect(realReturn(0.08, 0.04)).not.toBeCloseTo(0.04, 3);
  });

  it("growing annuity PV matches a brute-force sum", () => {
    const first = 100_000_000;
    const r = 0.06;
    const g = 0.035;
    const n = 20;
    let brute = 0;
    for (let t = 0; t < n; t++) brute += (first * Math.pow(1 + g, t)) / Math.pow(1 + r, t); // due
    expect(pvGrowingAnnuity(first, r, g, n, true)).toBeCloseTo(brute, 0);
    let bruteEq = 0;
    for (let t = 0; t < n; t++) bruteEq += (first * Math.pow(1.05, t)) / Math.pow(1.05, t);
    expect(pvGrowingAnnuity(first, 0.05, 0.05, n, true)).toBeCloseTo(bruteEq, 0);
  });

  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
