import { describe, expect, it } from "vitest";
import {
  additionalLumpSum,
  analyzeFunding,
  ILLUSTRATIVE_STEP_UP,
  contributionMonths,
  pvOfContributions,
  pvOfWithdrawals,
  requiredContribution,
  simpleGoalPayment,
  simulateFund,
  type Withdrawal,
} from "./funding";
import { futureValue, fvAnnuity, monthlyRate } from "./tvm";

const w = (month: number, amount: number, ay = 2027): Withdrawal => ({ month, amount, ay, label: `TA ${ay}` });

describe("contribution schedule", () => {
  it("monthly, quarterly and annual timings", () => {
    expect(contributionMonths({ periodsPerYear: 12, delayMonths: 0, endMonth: 3 })).toEqual([1, 2, 3]);
    expect(contributionMonths({ periodsPerYear: 4, delayMonths: 0, endMonth: 12 })).toEqual([3, 6, 9, 12]);
    expect(contributionMonths({ periodsPerYear: 1, delayMonths: 36, endMonth: 60 })).toEqual([48, 60]);
  });
});

describe("fund simulation", () => {
  it("single withdrawal equals FV of lump sum + FV of annuity", () => {
    const rm = monthlyRate(0.08);
    const sim = simulateFund(10_000_000, [w(24, 1e12)], { amountPerPeriod: 1_000_000, periodsPerYear: 12, delayMonths: 0, endMonth: 24 }, 0.08);
    const expected = futureValue(10_000_000, rm, 24) + fvAnnuity(1_000_000, rm, 24);
    expect(sim.events[0].balanceBefore).toBeCloseTo(expected, 2);
    expect(sim.totalPaid).toBeCloseTo(expected, 2);
    expect(sim.totalShortfall).toBeCloseTo(1e12 - expected, 0);
  });

  it("never goes negative and records partial payments", () => {
    const sim = simulateFund(5, [w(1, 10), w(2, 10)], { amountPerPeriod: 0, periodsPerYear: 12, delayMonths: 0, endMonth: 2 }, 0);
    expect(sim.events.map((e) => e.paid)).toEqual([5, 0]);
    expect(sim.totalShortfall).toBe(15);
    expect(Math.min(...sim.balances)).toBeGreaterThanOrEqual(0);
  });
});

describe("required contribution", () => {
  it("with a single payment equals the PMT formula", () => {
    const rm = monthlyRate(0.08);
    const req = requiredContribution(20_000_000, [w(60, 300_000_000)], 0.08, 12);
    const expected = (300_000_000 - futureValue(20_000_000, rm, 60)) / ((Math.pow(1 + rm, 60) - 1) / rm);
    expect(req.monthlyEquivalent).toBeCloseTo(expected, 2);
    expect(req.bindingIndex).toBe(0);
  });

  it("funds every payment exactly: simulating with the result leaves no shortfall", () => {
    const ws = [w(10, 80_000_000), w(22, 30_000_000, 2028), w(34, 32_000_000, 2029), w(70, 250_000_000, 2032)];
    const req = requiredContribution(15_000_000, ws, 0.07, 12);
    const sim = simulateFund(15_000_000, ws, { amountPerPeriod: req.perPeriod, periodsPerYear: 12, delayMonths: 0, endMonth: 70 }, 0.07);
    expect(sim.totalShortfall).toBeLessThan(1);
    // …and 1% less would leave a shortfall (minimality)
    const simLess = simulateFund(15_000_000, ws, { amountPerPeriod: req.perPeriod * 0.99, periodsPerYear: 12, delayMonths: 0, endMonth: 70 }, 0.07);
    expect(simLess.totalShortfall).toBeGreaterThan(1);
  });

  it("an early large payment can bind before the last one (PV method would under-fund)", () => {
    const ws = [w(12, 200_000_000), w(120, 10_000_000, 2036)];
    const req = requiredContribution(0, ws, 0.08, 12);
    expect(req.bindingIndex).toBe(0);
    // PV method: spread PV over all 120 months — strictly lower than what the early payment needs
    const rm = monthlyRate(0.08);
    const pvReq = pvOfWithdrawals(ws, 0.08);
    const pvMethod = pvReq / ((1 - Math.pow(1 + rm, -120)) / rm);
    expect(req.monthlyEquivalent).toBeGreaterThan(pvMethod);
  });

  it("quarterly contributions are reported per period and as a monthly equivalent", () => {
    const req = requiredContribution(0, [w(36, 100_000_000)], 0.06, 4);
    expect(req.monthlyEquivalent).toBeCloseTo((req.perPeriod * 4) / 12, 6);
    const sim = simulateFund(0, [w(36, 100_000_000)], { amountPerPeriod: req.perPeriod, periodsPerYear: 4, delayMonths: 0, endMonth: 36 }, 0.06);
    expect(sim.totalShortfall).toBeLessThan(1);
  });

  it("delayed start raises the requirement and flags payments before the first deposit", () => {
    const ws = [w(10, 50_000_000), w(60, 200_000_000, 2031)];
    const now = requiredContribution(0, ws, 0.08, 12, 0);
    const late = requiredContribution(0, ws, 0.08, 12, 36);
    expect(late.monthlyEquivalent).toBeGreaterThan(now.monthlyEquivalent);
    expect(late.unreachableShortfall).toBeCloseTo(50_000_000, 0);
  });

  it("pre-start shortfall is not charged again to later contributions (matches the simulation)", () => {
    // Fund 30 jt; 50 jt due at month 10 but deposits only start at month 37.
    const ws = [w(10, 50_000_000), w(46, 80_000_000, 2030), w(70, 120_000_000, 2032)];
    const req = requiredContribution(30_000_000, ws, 0.08, 12, 36);
    const grown = 30_000_000 * Math.pow(1 + monthlyRate(0.08), 10);
    expect(req.unreachableShortfall).toBeCloseTo(50_000_000 - grown, 0);
    const sched = { periodsPerYear: 12 as const, delayMonths: 36, endMonth: 70 };
    const sim = simulateFund(30_000_000, ws, { ...sched, amountPerPeriod: req.perPeriod }, 0.08);
    // Only the unavoidable pre-start part is short; every payment after the first deposit is met…
    expect(sim.totalShortfall).toBeCloseTo(req.unreachableShortfall, 0);
    // …and the amount is minimal: 1% less leaves a post-start payment short.
    const less = simulateFund(30_000_000, ws, { ...sched, amountPerPeriod: req.perPeriod * 0.99 }, 0.08);
    expect(less.totalShortfall - req.unreachableShortfall).toBeGreaterThan(1000);
  });

  it("a fund that covers the pre-start payments carries its remainder into the later constraints", () => {
    const ws = [w(10, 20_000_000), w(60, 200_000_000, 2031)];
    const req = requiredContribution(50_000_000, ws, 0.08, 12, 36);
    expect(req.unreachableShortfall).toBe(0);
    const sim = simulateFund(50_000_000, ws, { periodsPerYear: 12, delayMonths: 36, endMonth: 60, amountPerPeriod: req.perPeriod }, 0.08);
    expect(sim.totalShortfall).toBeLessThan(1);
    expect(sim.balances[60]).toBeLessThan(1); // exactly funded: nothing left over
  });

  it("PV identity holds for any start date: fund + PV(deposits) + PV(cash shortfall) − PV(surplus) = PV(requirement)", () => {
    const ws = [w(10, 60e6), w(22, 45e6, 2028), w(34, 240e6, 2029), w(46, 90e6, 2030), w(94, 300e6, 2034)];
    const rm = monthlyRate(0.08);
    for (const delay of [0, 12, 24, 36, 60]) {
      const req = requiredContribution(40e6, ws, 0.08, 12, delay);
      const schedule = { periodsPerYear: 12 as const, delayMonths: delay, endMonth: 94, amountPerPeriod: req.perPeriod };
      const sim = simulateFund(40e6, ws, schedule, 0.08);
      const pvSurplus = sim.balances[94] / Math.pow(1 + rm, 94);
      expect(40e6 + pvOfContributions(schedule, 0.08) + sim.shortfallPv - pvSurplus).toBeCloseTo(pvOfWithdrawals(ws, 0.08), 0);
      expect(sim.totalShortfall).toBeCloseTo(req.unreachableShortfall, 0);
    }
  });

  it("is zero when the current fund already covers everything", () => {
    const req = requiredContribution(1e12, [w(24, 100_000_000)], 0.05, 12);
    expect(req.perPeriod).toBe(0);
    expect(req.bindingIndex).toBeNull();
  });

  it("higher return lowers the requirement", () => {
    const ws = [w(30, 100e6), w(90, 300e6, 2033)];
    const lo = requiredContribution(0, ws, 0.04, 12).monthlyEquivalent;
    const hi = requiredContribution(0, ws, 0.12, 12).monthlyEquivalent;
    expect(hi).toBeLessThan(lo);
  });
});

describe("step-up contributions", () => {
  const ws = [w(10, 60e6), w(46, 90e6, 2030), w(94, 300e6, 2034), w(130, 350e6, 2037)];
  it("a step-up plan starts lower than a level plan and still funds every payment", () => {
    const level = requiredContribution(20e6, ws, 0.08, 12, 0, 0);
    const up = requiredContribution(20e6, ws, 0.08, 12, 0, 0.05);
    expect(up.monthlyEquivalent).toBeLessThan(level.monthlyEquivalent);
    const sim = simulateFund(20e6, ws, { amountPerPeriod: up.perPeriod, periodsPerYear: 12, delayMonths: 0, endMonth: 130, stepUp: 0.05 }, 0.08);
    expect(sim.totalShortfall).toBeLessThan(1);
  });
  it("the PV method never exceeds the strict no-shortfall requirement", () => {
    for (const g of [0, 0.03, 0.06]) {
      const r = requiredContribution(20e6, ws, 0.08, 12, 0, g);
      expect(r.pvMethodMonthly).toBeLessThanOrEqual(r.monthlyEquivalent + 1e-6);
    }
  });
});

describe("lump sum", () => {
  it("additional lump sum makes the plan whole", () => {
    const ws = [w(12, 100e6), w(48, 150e6, 2030)];
    const sched = { amountPerPeriod: 1_000_000, periodsPerYear: 12 as const, delayMonths: 0, endMonth: 48 };
    const extra = additionalLumpSum(10e6, ws, sched, 0.07);
    const sim = simulateFund(10e6 + extra, ws, sched, 0.07);
    expect(sim.totalShortfall).toBeLessThan(1);
  });
});

describe("analyzeFunding", () => {
  const base = {
    withdrawals: [w(10, 60e6), w(22, 40e6, 2028), w(70, 400e6, 2032)],
    currentFund: 50e6,
    plannedMonthly: 2_000_000,
    annualReturn: 0.08,
    generalInflation: 0.035,
    periodsPerYear: 12 as const,
    delayMonths: 0,
    partialThreshold: 0.75,
  };

  it("bridge identity: requirement = current fund part + contributions part + gap", () => {
    const f = analyzeFunding(base);
    expect(f.coveredByCurrentFund + f.coveredByContributions + f.gapNominal).toBeCloseTo(f.requirementNominal, 2);
    expect(f.status).not.toBe("fully_funded");
  });

  it("funding with the required amount produces Fully Funded", () => {
    const first = analyzeFunding(base);
    const f = analyzeFunding({ ...base, plannedMonthly: first.required.monthlyEquivalent + 1 });
    expect(f.status).toBe("fully_funded");
    expect(f.gapNominal).toBeLessThan(1);
    expect(f.fundedRatio).toBeGreaterThanOrEqual(0.999);
  });

  it("status thresholds", () => {
    const tiny = analyzeFunding({ ...base, plannedMonthly: 0, currentFund: 0 });
    expect(tiny.status).toBe("funding_gap");
    expect(tiny.fundedRatio).toBe(0);
  });

  it("level plan also reports an illustrative step-up alternative that starts lower and still funds everything", () => {
    const f = analyzeFunding(base);
    expect(f.required.stepUp).toBe(0);
    expect(f.requiredLevel).toBe(f.required);
    expect(f.requiredStepUp.stepUp).toBe(ILLUSTRATIVE_STEP_UP);
    expect(f.requiredStepUp.monthlyEquivalent).toBeLessThan(f.requiredLevel.monthlyEquivalent);
    const check = analyzeFunding({ ...base, plannedMonthly: f.requiredStepUp.monthlyEquivalent + 1, stepUp: ILLUSTRATIVE_STEP_UP });
    expect(check.gapNominal).toBeLessThan(1);
  });

  it("step-up plan reports its own requirement and the level comparison", () => {
    const f = analyzeFunding({ ...base, stepUp: 0.1 });
    expect(f.requiredStepUp).toBe(f.required);
    expect(f.requiredLevel.stepUp).toBe(0);
    expect(f.required.monthlyEquivalent).toBeLessThan(f.requiredLevel.monthlyEquivalent);
  });

  it("no future payments → fully funded with zero requirement", () => {
    const f = analyzeFunding({ ...base, withdrawals: [] });
    expect(f.requirementNominal).toBe(0);
    expect(f.status).toBe("fully_funded");
    expect(f.required.perPeriod).toBe(0);
  });
});

describe("simple single-goal calculator", () => {
  it("reaches the target", () => {
    const r = simpleGoalPayment({ currentFund: 10e6, targetFutureValue: 250e6, yearsRemaining: 8, annualReturn: 0.08, periodsPerYear: 12 });
    const rm = monthlyRate(0.08);
    const fv = futureValue(10e6, rm, 96) + fvAnnuity(r.perPeriod, rm, 96);
    expect(fv).toBeCloseTo(250e6, 0);
  });
});
