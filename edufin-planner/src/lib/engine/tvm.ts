/**
 * Time value of money primitives. All rates are effective per period unless noted.
 * These mirror the spreadsheet functions FV / PV / PMT so results can be audited in Excel.
 */

/** Effective periodic rate from an effective annual rate: (1 + r)^(1/p) − 1 */
export function periodicRate(annualRate: number, periodsPerYear: number): number {
  return Math.pow(1 + annualRate, 1 / periodsPerYear) - 1;
}

export function monthlyRate(annualRate: number): number {
  return periodicRate(annualRate, 12);
}

/** Future value of a present amount: PV × (1 + r)^n */
export function futureValue(presentValue: number, rate: number, periods: number): number {
  return presentValue * Math.pow(1 + rate, periods);
}

/** Present value of a future amount: FV / (1 + r)^n */
export function presentValue(future: number, rate: number, periods: number): number {
  return future / Math.pow(1 + rate, periods);
}

/** FV of a level annuity. `due` = payments at the start of each period. */
export function fvAnnuity(payment: number, rate: number, periods: number, due = false): number {
  if (periods <= 0) return 0;
  const base = rate === 0 ? payment * periods : (payment * (Math.pow(1 + rate, periods) - 1)) / rate;
  return due ? base * (1 + rate) : base;
}

/** PV of a level annuity. `due` = payments at the start of each period. */
export function pvAnnuity(payment: number, rate: number, periods: number, due = false): number {
  if (periods <= 0) return 0;
  const base = rate === 0 ? payment * periods : (payment * (1 - Math.pow(1 + rate, -periods))) / rate;
  return due ? base * (1 + rate) : base;
}

/**
 * Level payment (end of period) needed so that `pv0` plus payments grow to `target` after n periods.
 * Returns 0 when the lump sum alone already reaches the target.
 */
export function paymentForTarget(target: number, pv0: number, rate: number, periods: number): number {
  if (periods <= 0) return target > pv0 ? Infinity : 0;
  const remaining = target - futureValue(pv0, rate, periods);
  if (remaining <= 0) return 0;
  const factor = rate === 0 ? periods : (Math.pow(1 + rate, periods) - 1) / rate;
  return remaining / factor;
}

/** Compound annual growth rate between two observations `years` apart. */
export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return NaN;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Fisher relation: real = (1 + nominal) / (1 + inflation) − 1 */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/**
 * PV of a growing annuity with n annual payments; the first payment equals `firstPayment`.
 * `due` = payments at the start of each year (typical for retirement spending).
 */
export function pvGrowingAnnuity(
  firstPayment: number,
  rate: number,
  growth: number,
  periods: number,
  due = false,
): number {
  if (periods <= 0) return 0;
  let pv: number;
  if (Math.abs(rate - growth) < 1e-12) {
    pv = (firstPayment * periods) / (1 + rate);
  } else {
    pv = (firstPayment / (rate - growth)) * (1 - Math.pow((1 + growth) / (1 + rate), periods));
  }
  return due ? pv * (1 + rate) : pv;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function sum(values: number[]): number {
  let t = 0;
  for (const v of values) t += v;
  return t;
}
