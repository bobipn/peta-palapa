import { describe, expect, it } from "vitest";
import { classifyAffordability, affordabilityScore, ratioSubScore } from "./affordability";
import { buildAlerts } from "./alerts";
import { compareSchools, defaultScenarios, delayCost, recommendOptions, runScenarios, sensitivityGrid, tradeoff } from "./analysis";
import { makeComponent } from "./catalog";
import { benchmarkSource, projectRows, resolveCostSource, summarizeComponents } from "./costs";
import { academicYearOf, ageOnJuly1, buildTimeline, monthsUntilAyStart, naturalSdEntryYear } from "./educationPath";
import { historicalStats } from "./inflation";
import { runEducation, runPlan } from "./plan";
import { scoreRisk } from "./risk";
import { testAssumptions, testDb, testHousehold } from "./fixtures.test-helpers";

const A = testAssumptions();

describe("academic calendar", () => {
  it("AY starts in July", () => {
    expect(academicYearOf("2026-09-27")).toBe(2026);
    expect(academicYearOf("2026-06-30")).toBe(2025);
    expect(monthsUntilAyStart(2027, "2026-09-27")).toBe(10);
  });
  it("age on 1 July", () => {
    expect(ageOnJuly1("2020-07-01", 2026)).toBe(6);
    expect(ageOnJuly1("2020-07-02", 2026)).toBe(5);
    expect(naturalSdEntryYear("2022-05-01", 6)).toBe(2028);
    expect(naturalSdEntryYear("2022-09-01", 6)).toBe(2029);
  });
});

describe("education path", () => {
  const h = testHousehold();
  it("child currently in SD kelas 3 continues to S1", () => {
    const t = buildTimeline(h.children[0], A, 2026);
    expect(t.rows[0]).toMatchObject({ ay: 2026, level: "SD", gradeIndex: 3, isCurrent: true });
    expect(t.rows.find((r) => r.level === "SMP")).toMatchObject({ ay: 2030, gradeLabel: "Kelas 7", isLevelEntry: true });
    expect(t.rows.find((r) => r.level === "SMA")?.ay).toBe(2033);
    expect(t.universityEntryYear).toBe(2036);
    expect(t.rows.length).toBe(4 + 3 + 3 + 4);
    expect(t.graduationYear).toBe(2040);
  });
  it("not-yet-in-school child with TK", () => {
    const t = buildTimeline(h.children[1], A, 2026);
    expect(t.rows[0]).toMatchObject({ ay: 2026, level: "TK", gradeLabel: "TK A" });
    expect(t.sdEntryYear).toBe(2028);
    expect(t.rows.length).toBe(2 + 6 + 3 + 3 + 4);
  });
  it("university entry override inserts a gap year", () => {
    const c = { ...h.children[0], targetUniversityEntryYear: 2037 };
    const t = buildTimeline(c, A, 2026);
    expect(t.universityEntryYear).toBe(2037);
    expect(t.rows.some((r) => r.ay === 2036)).toBe(false);
  });
  it("warns when an early university target conflicts with the natural path", () => {
    const c = { ...h.children[0], targetUniversityEntryYear: 2030 };
    const t = buildTimeline(c, A, 2026);
    expect(t.universityEntryYear).toBe(2036);
    expect(t.warnings.length).toBe(1);
  });
});

describe("costs & projection", () => {
  const h = testHousehold();
  it("annualises and inflates per component (spec formula)", () => {
    const child = h.children[1];
    const src = resolveCostSource(child, "SD", child.levelPlans.SD, testDb, A, 2026, h.homeCity);
    expect(src.kind).toBe("school");
    const rows = projectRows(buildTimeline(child, A, 2026).rows.filter((r) => r.level === "SD"), () => src, A, 2026);
    const first = rows[0];
    expect(first.ay).toBe(2028);
    // private school inflation parameter, n = 2: (25jt + 1.75jt×12 + 3jt) × (1 + i)²
    const expected = (25_000_000 + 1_750_000 * 12 + 3_000_000) * (1 + A.inflation.privateSchool) ** 2;
    expect(first.total).toBeCloseTo(expected, 2);
    expect(rows[1].oneTimeTotal).toBe(0); // uang pangkal only at level entry
  });
  it("international schools use the international inflation parameter, older data inflates from its own year", () => {
    const child = { ...h.children[1], levelPlans: { SD: { mode: "school" as const, schoolId: "s-beta" } } };
    const src = resolveCostSource(child, "SD", child.levelPlans.SD, testDb, A, 2026, h.homeCity);
    expect(src.schoolKey).toBe("internationalSchool");
    const rows = projectRows([{ childId: "x", ay: 2028, level: "SD", gradeIndex: 1, gradeLabel: "Kelas 1", isLevelEntry: true, age: 6, isCurrent: false }], () => src, A, 2026);
    const tuition = rows[0].components.find((c) => c.code === "tuition_fee")!;
    expect(tuition.n).toBe(3); // 2028 − 2025
    expect(tuition.amount).toBeCloseTo(105_000_000 * 1.08 ** 3, 2);
    // optional boarding excluded by default
    expect(rows[0].components.some((c) => c.code === "boarding")).toBe(false);
  });
  it("grade-limited components apply only to their grades (fromGrade/toGrade)", () => {
    const child = h.children[1];
    const extra = makeComponent("other", 5_000_000, { id: "tour-4-6", label: "Study tour kelas 4–6", group: "operational", frequency: "annual", fromGrade: 4, toGrade: 6 });
    const db2 = { ...testDb, fees: testDb.fees.map((f) => (f.schoolId === "s-alpha" && f.level === "SD" ? { ...f, components: [...f.components, extra] } : f)) };
    const src = resolveCostSource(child, "SD", child.levelPlans.SD, db2, A, 2026, h.homeCity);
    const rows = projectRows(buildTimeline(child, A, 2026).rows.filter((r) => r.level === "SD"), () => src, A, 2026);
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.components.some((c) => c.label === extra.label)).toBe(r.gradeIndex >= 4);
  });
  it("benchmark is a median of non-estimated schedules and labelled Estimated", () => {
    const b = benchmarkSource(testDb, { level: "SD", city: "Kota Depok" }, A, 2026);
    expect(b.kind).toBe("benchmark");
    expect(b.verification).toBe("estimated");
    expect(b.benchmarkCount).toBe(3);
    const entry = b.components.find((c) => c.component.code === "uang_pangkal")!.component.amount;
    // median of alpha 25jt, gamma 12jt, beta 70jt×1.08 → 25jt
    expect(entry).toBe(25_000_000);
  });
  it("summary splits groups", () => {
    const s = summarizeComponents([makeComponent("uang_pangkal", 10), makeComponent("spp_monthly", 1), makeComponent("transport", 2), makeComponent("boarding", 5)]);
    expect(s.entryOneTime).toBe(10);
    expect(s.annualRecurring).toBe(12);
    expect(s.annualOperational).toBe(24);
    expect(s.annualOptional).toBe(0);
    expect(s.firstYearTotal).toBe(46);
  });
  it("flags levels without costs", () => {
    const hh = testHousehold();
    hh.children[0].levelPlans = {};
    const edu = runEducation(hh, testDb, A);
    expect(edu.missingCosts.filter((m) => m.childId === "c1").map((m) => m.level)).toEqual(["SD", "SMP", "SMA", "S1"]);
  });
});

describe("historical inflation (spec §6 example)", () => {
  it("computes growth statistics", () => {
    const s = historicalStats(testDb.history);
    expect(s.yoy.map((y) => +y.rate.toFixed(4))).toEqual([0.0909, 0.1167, 0.1194]);
    expect(s.oneYear).toBeCloseTo(0.1194, 4);
    expect(s.cagr3).toBeCloseTo(0.108918, 5);
    expect(s.cagr5).toBeNull();
    expect(s.median).toBeCloseTo(0.1167, 4);
    expect(s.min).toBeCloseTo(0.0909, 4);
    expect(s.max).toBeCloseTo(0.1194, 4);
  });
  it("annualises gaps and marks insufficient data", () => {
    const s = historicalStats([testDb.history[0], testDb.history[3]]);
    expect(s.yoy[0].annualized).toBe(true);
    expect(s.oneYear).toBeNull();
    expect(historicalStats([testDb.history[0]]).sufficient).toBe(false);
  });
});

describe("integrated plan", () => {
  const h = testHousehold();
  const plan = runPlan(h, testDb, A);

  it("produces future withdrawals from next AY on, current AY handled by cash flow", () => {
    expect(plan.withdrawals[0].ay).toBe(2027);
    expect(plan.withdrawals.every((w) => w.month >= 1)).toBe(true);
    expect(plan.currentAyRemaining).toBeGreaterThan(0);
    expect(plan.totals.nominal).toBeCloseTo(plan.totals.future + plan.currentAyCost, 2);
  });

  it("funding with the required monthly amount leaves no education shortfall in the cash-flow engine", () => {
    const req = plan.funding.required.monthlyEquivalent;
    const p2 = runPlan(h, testDb, A, { eduMonthlyOverride: req * 1.0001 });
    expect(p2.funding.gapNominal).toBeLessThan(1);
    const fromCash = p2.cashflow.rows.filter((r) => !r.partial).reduce((s, r) => s + r.educationFromCashflow, 0);
    expect(fromCash).toBeLessThan(10);
  });

  it("cash-flow rows reconcile: Δportfolio = FCF + return − education withdrawal (+ unfunded)", () => {
    for (const r of plan.cashflow.rows) {
      const delta = r.endInvestable - r.beginInvestable;
      expect(delta).toBeCloseTo(r.fcf + r.investmentReturn - r.educationFromFund + r.unfundedDeficit, 0);
      expect(r.netWorth).toBeCloseTo(r.totalAssets - r.liabilities, 0);
    }
  });

  it("projects at least 30 years and stops employment income at retirement", () => {
    expect(plan.cashflow.rows.length).toBeGreaterThanOrEqual(30);
    const retRow = plan.cashflow.rows.find((r) => r.agePrimary === 56)!;
    expect(retRow.primaryWorking).toBe(false);
    expect(plan.cashflow.rows.find((r) => r.agePrimary === 55)!.primaryWorking).toBe(true);
  });

  it("affordability rows and peak", () => {
    expect(plan.affordability.rows.length).toBeGreaterThan(0);
    const peak = plan.affordability.peak!;
    expect(peak.ratio).toBe(Math.max(...plan.affordability.rows.map((r) => r.ratio)));
  });

  it("saving scenarios are ordered by return", () => {
    const [c, b, o] = plan.savingScenarios;
    expect(c.monthly).toBeGreaterThan(b.monthly);
    expect(b.monthly).toBeGreaterThan(o.monthly);
  });

  it("alerts include a funding status and are sorted by severity", () => {
    const alerts = buildAlerts(plan, testDb);
    expect(alerts.some((x) => x.id === "gap")).toBe(true);
    const order = { critical: 0, warning: 1, info: 2, good: 3 } as const;
    for (let i = 1; i < alerts.length; i++) expect(order[alerts[i].severity]).toBeGreaterThanOrEqual(order[alerts[i - 1].severity]);
    // Alpha SD history CAGR 10.9% > 8% private-school assumption
    expect(alerts.some((x) => x.title === "Tuition inflation exceeded assumption")).toBe(true);
  });
});

describe("scenarios, sensitivity, trade-off", () => {
  const h = testHousehold();
  const out = runScenarios(h, testDb, A, defaultScenarios());
  const by = Object.fromEntries(out.map((o) => [o.def.code, o]));

  it("stress scenarios move in the expected direction", () => {
    expect(by.B.requirementNominal).toBeGreaterThan(by.A.requirementNominal);
    expect(by.C.requiredMonthly).toBeGreaterThan(by.A.requiredMonthly);
    expect(by.D.retirementReadiness).toBeLessThanOrEqual(by.A.retirementReadiness);
    expect(by.D.minFcf).toBeLessThan(by.A.minFcf);
    expect(by.E.requirementNominal).toBeGreaterThan(by.A.requirementNominal);
    expect(by.F.requiredMonthly).toBeGreaterThan(by.A.requiredMonthly);
  });

  it("sensitivity grid is monotone", () => {
    const g = sensitivityGrid(h, testDb, A);
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        if (i < 4) expect(g.values[i + 1][j]).toBeGreaterThanOrEqual(g.values[i][j]);
        if (j < 4) expect(g.values[i][j + 1]).toBeLessThanOrEqual(g.values[i][j]);
      }
  });

  it("delaying raises the monthly requirement when no large payment falls before the start (fixture)", () => {
    // Not a general law: a payment that moves before the first deposit becomes cash-up-front instead
    // (see funding.test.ts), which can lower the monthly figure while raising the cash need.
    const d = delayCost(h, testDb, A);
    for (let i = 1; i < d.length; i++) expect(d[i].monthly).toBeGreaterThanOrEqual(d[i - 1].monthly);
    for (let i = 1; i < d.length; i++) expect(d[i].unreachable).toBeGreaterThanOrEqual(d[i - 1].unreachable);
  });

  it("trade-off strategies respect their priority", () => {
    const t = tradeoff(h, testDb, A);
    const [edu, bal, ret] = t.strategies;
    expect(edu.eduMonthly + edu.retMonthly).toBeCloseTo(t.budget, 2);
    expect(bal.eduMonthly + bal.retMonthly).toBeCloseTo(t.budget, 2);
    expect(edu.eduFundedRatio).toBeGreaterThanOrEqual(ret.eduFundedRatio);
    expect(ret.retReadiness).toBeGreaterThanOrEqual(edu.retReadiness - 1e-9);
  });
});

describe("comparison & recommendations", () => {
  const h = testHousehold();
  it("scores cheaper options at least as high", () => {
    const rows = compareSchools(h, testDb, A, "c2", "SD", ["s-alpha", "s-beta", "s-gamma"]);
    const s = Object.fromEntries(rows.map((r) => [r.school.id, r]));
    expect(s["s-gamma"].levelTotalNominal).toBeLessThan(s["s-alpha"].levelTotalNominal);
    expect(s["s-gamma"].score.score).toBeGreaterThanOrEqual(s["s-alpha"].score.score);
    expect(s["s-alpha"].score.score).toBeGreaterThanOrEqual(s["s-beta"].score.score);
  });
  it("recommendation options A/B/C", () => {
    const r = recommendOptions(h, testDb, A, "c2", "SD");
    expect(r.options.map((o) => o.key)).toEqual(["A", "B", "C"]);
    expect(r.options[0].row.school.id).toBe("s-gamma");
    expect(r.options[2].row.levelTotalNominal).toBeGreaterThanOrEqual(r.options[0].row.levelTotalNominal);
  });
});

describe("affordability & risk", () => {
  it("classifies with configurable thresholds", () => {
    const t: [number, number, number, number] = [0.1, 0.2, 0.3, 0.4];
    expect([0.05, 0.15, 0.25, 0.35, 0.45].map((x) => classifyAffordability(x, t))).toEqual([
      "very_comfortable",
      "healthy",
      "moderate",
      "high",
      "aggressive",
    ]);
    expect(classifyAffordability(0.15, [0.2, 0.3, 0.4, 0.5])).toBe("very_comfortable");
    expect(ratioSubScore(0.2, t)).toBe(75);
    expect(affordabilityScore({ peakRatio: 0.05, requiredMonthly: 0, capacityMonthly: 1, fundedRatio: 1, thresholds: t }).score).toBe(100);
  });
  it("risk profile: the more conservative of ability and willingness governs", () => {
    const all = (v: number) => ({ experience: v, horizon: v, incomeStability: v, emergencyFund: v, debtLevel: v, lossTolerance: v, objective: v, liquidity: v });
    expect(scoreRisk(all(5)).profile).toBe("aggressive");
    expect(scoreRisk(all(1)).profile).toBe("conservative");
    const mixed = scoreRisk({ ...all(5), experience: 1, lossTolerance: 1, objective: 1 });
    expect(mixed.profile).toBe("conservative");
    expect(mixed.governedBy).toBe("willingness");
    expect(scoreRisk({}).complete).toBe(false);
  });
});
