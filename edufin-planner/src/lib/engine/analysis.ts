import { affordabilityScore, haversineKm, type ScoreParts } from "./affordability";
import { pickSchedule, projectRows, resolveCostSource, resolveTiers, summarizeComponents, type ScheduleSummary } from "./costs";
import { academicYearOf, buildTimeline } from "./educationPath";
import { requiredContribution, simulateFund } from "./funding";
import { runEducation, runPlan, educationFundValue, type PlanModifiers, type PlanResult } from "./plan";
import { formatPct } from "../format";
import type { Assumptions, FeeSchedule, Household, InflationKey, Level, School, SchoolDatabase } from "./types";

// ---------------------------------------------------------------------------
// Scenario analysis (spec §13)
// ---------------------------------------------------------------------------

export interface ScenarioDef {
  code: string;
  name: string;
  description: string;
  mods: PlanModifiers;
}

const EDU_KEYS: InflationKey[] = ["education", "privateSchool", "internationalSchool", "university"];

export function educationInflationOverride(rate: number): Partial<Record<InflationKey, number>> {
  return Object.fromEntries(EDU_KEYS.map((k) => [k, rate]));
}

export function defaultScenarios(): ScenarioDef[] {
  return [
    { code: "A", name: "Base Case", description: "Asumsi rencana Anda saat ini (default: inflasi pendidikan 6%, return 8%).", mods: {} },
    { code: "B", name: "High Inflation", description: "Semua inflasi biaya pendidikan 10% per tahun.", mods: { inflationOverride: educationInflationOverride(0.1) } },
    { code: "C", name: "Low Return", description: "Return investasi 5% per tahun (pendidikan, pensiun, umum).", mods: { returnOverride: 0.05 } },
    { code: "D", name: "Income Shock", description: "Penghasilan turun 20% permanen mulai sekarang.", mods: { incomeMultiplier: 0.8 } },
    { code: "E", name: "Premium School", description: "Biaya sekolah (uang masuk + SPP/tuition + biaya tahunan) naik 30%.", mods: { schoolFeeMultiplier: 1.3 } },
    { code: "F", name: "Delayed Saving", description: "Investasi pendidikan baru dimulai 3 tahun lagi.", mods: { eduDelayMonths: 36 } },
  ];
}

export interface ScenarioOutcome {
  def: ScenarioDef;
  requirementNominal: number;
  fundingGapNominal: number;
  fundingGapPv: number;
  status: PlanResult["funding"]["status"];
  requiredMonthly: number;
  retirementAvailable: number;
  retirementReadiness: number;
  depletionAge: number | null;
  minFcf: number;
  deficitYears: number;
  netWorthAtRetirement: number;
  netWorthEnd: number;
}

export function outcomeOf(def: ScenarioDef, p: PlanResult): ScenarioOutcome {
  // Working years only: after retirement a negative FCF is planned decumulation, not stress.
  const rows = p.cashflow.rows.filter((r) => !r.partial && r.primaryWorking);
  const atRet = p.cashflow.rows.find((r) => r.ay === p.cashflow.retirement.retirementAy) ?? p.cashflow.rows[p.cashflow.rows.length - 1];
  return {
    def,
    requirementNominal: p.funding.requirementNominal,
    fundingGapNominal: p.funding.gapNominal,
    fundingGapPv: p.funding.gapPv,
    status: p.funding.status,
    requiredMonthly: p.funding.required.monthlyEquivalent,
    retirementAvailable: p.cashflow.retirement.projectedAvailable,
    retirementReadiness: p.cashflow.retirement.readiness,
    depletionAge: p.cashflow.retirement.depletionAge,
    minFcf: rows.length ? Math.min(...rows.map((r) => r.fcf)) : 0,
    deficitYears: rows.filter((r) => r.flags.includes("deficit")).length,
    netWorthAtRetirement: atRet?.netWorth ?? 0,
    netWorthEnd: p.cashflow.rows[p.cashflow.rows.length - 1]?.netWorth ?? 0,
  };
}

export function runScenarios(h: Household, db: SchoolDatabase, a: Assumptions, defs = defaultScenarios()): ScenarioOutcome[] {
  return defs.map((d) => outcomeOf(d, runPlan(h, db, a, d.mods)));
}

// ---------------------------------------------------------------------------
// Sensitivity analysis (spec §27)
// ---------------------------------------------------------------------------

export interface SensitivityGrid {
  inflations: number[];
  returns: number[];
  /** values[i][j] = required monthly investment at inflations[i], returns[j]. */
  values: number[][];
}

export function sensitivityGrid(
  h: Household,
  db: SchoolDatabase,
  a: Assumptions,
  inflations = [0.03, 0.05, 0.07, 0.09, 0.11],
  returns = [0.04, 0.06, 0.08, 0.1, 0.12],
): SensitivityGrid {
  const fund = educationFundValue(h);
  const values = inflations.map((inf) => {
    const edu = runEducation(h, db, a, { inflationOverride: educationInflationOverride(inf) });
    return returns.map(
      (r) => requiredContribution(fund, edu.withdrawals, r, a.contributionFrequency, edu.eduDelayMonths, edu.eduStepUp).monthlyEquivalent,
    );
  });
  return { inflations, returns, values };
}

/** Cost of delay: required monthly investment if saving starts later (question 13). */
/**
 * Cost of starting later (spec question 13). For each delay:
 * - monthly: minimum deposit so every payment after the first deposit is met (strict, level or step-up);
 * - unreachable: payments before the first deposit the current fund cannot cover (cash needed up front);
 * - bindingAy: the payment that sets the deposit (a large payment soon after the start makes it high);
 * - surplus: fund left after the last payment — a deposit sized by an early payment over-funds later years.
 * In present-value terms (at the fund's return) deposits + cash − surplus always equal the requirement minus
 * the current fund, so the real costs of waiting are the higher monthly burden and the cash needed up front.
 */
export function delayCost(h: Household, db: SchoolDatabase, a: Assumptions, delaysYears = [0, 1, 2, 3, 5]) {
  const edu = runEducation(h, db, a);
  const fund = educationFundValue(h);
  const ws = edu.withdrawals.filter((w) => w.amount > 0).sort((x, y) => x.month - y.month);
  const lastMonth = ws.length ? ws[ws.length - 1].month : 0;
  return delaysYears.map((y) => {
    const delay = y * 12;
    const req = requiredContribution(fund, ws, a.returns.education, a.contributionFrequency, delay, edu.eduStepUp);
    const sim = simulateFund(
      fund,
      ws,
      { amountPerPeriod: req.perPeriod, periodsPerYear: a.contributionFrequency, delayMonths: delay, endMonth: lastMonth, stepUp: edu.eduStepUp },
      a.returns.education,
    );
    return {
      delayYears: y,
      monthly: req.monthlyEquivalent,
      unreachable: req.unreachableShortfall,
      bindingAy: req.bindingIndex !== null ? ws[req.bindingIndex].ay : null,
      deposits: sim.totalContributed,
      surplus: sim.balances[sim.balances.length - 1] ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Retirement vs education trade-off (spec §19)
// ---------------------------------------------------------------------------

export interface TradeoffStrategy {
  key: "education" | "balanced" | "retirement";
  label: string;
  eduMonthly: number;
  retMonthly: number;
  eduStatus: PlanResult["funding"]["status"];
  eduFundedRatio: number;
  eduGapNominal: number;
  retReadiness: number;
  retGap: number;
  netWorthAtRetirement: number;
  depletionAge: number | null;
}

export interface TradeoffResult {
  budget: number;
  budgetSource: "planned" | "capacity" | "none";
  eduRequired: number;
  retRequired: number;
  strategies: TradeoffStrategy[];
  bothFundable: boolean;
}

export function tradeoff(h: Household, db: SchoolDatabase, a: Assumptions): TradeoffResult {
  const base = runPlan(h, db, a);
  const planned = h.educationPlan.monthlyContribution + h.retirementPlan.monthlyContribution;
  const capacity = Math.max(0, base.health.savingsCapacity);
  const budget = planned > 0 ? planned : capacity;
  const budgetSource: TradeoffResult["budgetSource"] = planned > 0 ? "planned" : capacity > 0 ? "capacity" : "none";
  const eduReq = base.funding.required.monthlyEquivalent;
  const retReq = base.cashflow.retirement.requiredMonthly;
  const split = (): [number, number] => {
    if (budget >= eduReq + retReq) {
      const extra = budget - eduReq - retReq;
      const tot = eduReq + retReq;
      return tot > 0 ? [eduReq + extra * (eduReq / tot), retReq + extra * (retReq / tot)] : [budget / 2, budget / 2];
    }
    const tot = eduReq + retReq;
    return tot > 0 ? [budget * (eduReq / tot), budget * (retReq / tot)] : [0, 0];
  };
  const plans: [TradeoffStrategy["key"], string, number, number][] = [
    ["education", "Prioritize Education", Math.min(budget, eduReq), budget - Math.min(budget, eduReq)],
    ["balanced", "Balanced Education + Retirement", ...split()],
    ["retirement", "Prioritize Retirement", budget - Math.min(budget, retReq), Math.min(budget, retReq)],
  ];
  const strategies = plans.map(([key, label, e, r]) => {
    const p = runPlan(h, db, a, { eduMonthlyOverride: e, retMonthlyOverride: r });
    const atRet = p.cashflow.rows.find((x) => x.ay === p.cashflow.retirement.retirementAy);
    return {
      key,
      label,
      eduMonthly: e,
      retMonthly: r,
      eduStatus: p.funding.status,
      eduFundedRatio: p.funding.fundedRatio,
      eduGapNominal: p.funding.gapNominal,
      retReadiness: p.cashflow.retirement.readiness,
      retGap: Math.max(0, p.cashflow.retirement.requiredCorpus - p.cashflow.retirement.projectedAvailable),
      netWorthAtRetirement: atRet?.netWorth ?? 0,
      depletionAge: p.cashflow.retirement.depletionAge,
    };
  });
  return { budget, budgetSource, eduRequired: eduReq, retRequired: retReq, strategies, bothFundable: budget >= eduReq + retReq };
}

// ---------------------------------------------------------------------------
// School comparison (spec §14) and recommendation options (spec §32)
// ---------------------------------------------------------------------------

export interface ComparisonRow {
  school: School;
  schedule?: FeeSchedule;
  summary?: ScheduleSummary;
  dataYear?: number;
  entryAy: number | null;
  firstYearFuture: number;
  levelTotalNominal: number;
  planRequirement: number;
  requiredMonthly: number;
  fundedRatio: number;
  peakRatio: number;
  peakAy: number | null;
  retirementReadiness: number;
  score: ScoreParts;
  distanceKm: number | null;
  hasData: boolean;
}

export function compareSchools(
  h: Household,
  db: SchoolDatabase,
  a: Assumptions,
  childId: string,
  level: Level,
  schoolIds: string[],
  limit = 5,
): ComparisonRow[] {
  const child = h.children.find((c) => c.id === childId);
  if (!child) return [];
  const rows: ComparisonRow[] = [];
  for (const id of schoolIds.slice(0, limit)) {
    const school = db.schools.find((s) => s.id === id);
    if (!school) continue;
    const schedule = pickSchedule(db, id, level, undefined, child.gender);
    const existing = child.levelPlans[level];
    const plan = runPlan(h, db, a, {
      levelPlanOverrides: [
        {
          childId,
          level,
          plan: { mode: "school", schoolId: id, extraComponents: existing?.extraComponents, includeOptionalCodes: existing?.includeOptionalCodes },
        },
      ],
    });
    const cr = plan.children.find((c) => c.child.id === childId);
    const levelRows = cr?.rows.filter((r) => r.level === level) ?? [];
    const entry = levelRows.find((r) => r.isLevelEntry) ?? levelRows[0];
    const capacity = Math.max(0, plan.health.savingsCapacity);
    const score = affordabilityScore({
      peakRatio: plan.affordability.peak?.ratio ?? 0,
      requiredMonthly: plan.funding.required.monthlyEquivalent,
      capacityMonthly: capacity,
      fundedRatio: plan.funding.fundedRatio,
      thresholds: a.affordabilityThresholds,
    });
    const lat = school.location.lat;
    const lng = school.location.lng;
    rows.push({
      school,
      schedule,
      // Same program, tier (gender) and optional items as the projection uses.
      summary: schedule
        ? summarizeComponents(
            resolveTiers(schedule.components, {}, child.gender),
            schedule.monthsBilled ?? 12,
            existing?.includeOptionalCodes ?? [],
          )
        : undefined,
      dataYear: schedule ? Number(schedule.academicYear.slice(0, 4)) : undefined,
      entryAy: entry?.ay ?? null,
      firstYearFuture: entry?.total ?? 0,
      levelTotalNominal: levelRows.reduce((s, r) => s + r.total, 0),
      planRequirement: plan.funding.requirementNominal,
      requiredMonthly: plan.funding.required.monthlyEquivalent,
      fundedRatio: plan.funding.fundedRatio,
      peakRatio: plan.affordability.peak?.ratio ?? 0,
      peakAy: plan.affordability.peak?.ay ?? null,
      retirementReadiness: plan.cashflow.retirement.readiness,
      score,
      distanceKm:
        lat !== undefined && lng !== undefined && h.homeLat !== undefined && h.homeLng !== undefined
          ? haversineKm(h.homeLat, h.homeLng, lat, lng)
          : null,
      hasData: !!schedule,
    });
  }
  return rows;
}

export interface RecommendationOption {
  key: "A" | "B" | "C";
  title: string;
  rationale: string;
  row: ComparisonRow;
}

/** Candidate level cost for ranking (education-only, fast). */
function levelCost(h: Household, db: SchoolDatabase, a: Assumptions, childId: string, level: Level, schoolId: string): number {
  const child = h.children.find((c) => c.id === childId)!;
  const currentAy = academicYearOf(a.planDate);
  const t = buildTimeline(child, a, currentAy);
  const rows = t.rows.filter((r) => r.level === level);
  const existing = child.levelPlans[level];
  const src = resolveCostSource(child, level, { mode: "school", schoolId, extraComponents: existing?.extraComponents }, db, a, currentAy, h.homeCity);
  return projectRows(rows, () => src, a, currentAy).reduce((s, r) => s + r.total, 0);
}

export function recommendOptions(
  h: Household,
  db: SchoolDatabase,
  a: Assumptions,
  childId: string,
  level: Level,
): { options: RecommendationOption[]; candidates: number; note: string } {
  const child = h.children.find((c) => c.id === childId);
  if (!child) return { options: [], candidates: 0, note: "Anak tidak ditemukan." };
  const city = child.educationLocation || h.homeCity;
  const withData = db.schools.filter(
    (s) => !s.archived && s.levels.includes(level) && !!pickSchedule(db, s.id, level),
  );
  const local = withData.filter((s) => s.location.city === city);
  const pool = local.length >= 2 ? local : withData;
  if (pool.length === 0) return { options: [], candidates: 0, note: `Belum ada data biaya ${level} di database.` };

  const costed = pool
    .map((s) => ({ s, cost: levelCost(h, db, a, childId, level, s.id) }))
    .sort((x, y) => x.cost - y.cost);
  const cheapest = costed[0];
  const targetId = child.levelPlans[level]?.mode === "school" ? child.levelPlans[level]?.schoolId : undefined;
  const premium = (targetId && costed.find((c) => c.s.id === targetId)) || costed[costed.length - 1];

  // Always include the cheapest and the premium candidate, then fill with the next cheapest (bounded for speed).
  const ids = [...new Set([cheapest.s.id, premium.s.id, ...costed.map((c) => c.s.id)])].slice(0, 12);
  const full = compareSchools(h, db, a, childId, level, ids, ids.length);
  const byId = new Map(full.map((r) => [r.school.id, r]));
  const healthyMax = a.affordabilityThresholds[1];
  const capacity = Math.max(0, runPlan(h, db, a).health.savingsCapacity);
  const a1 = byId.get(cheapest.s.id);
  // Balanced: a middle candidate (neither A nor C). Prefer the most expensive one whose required investment
  // fits the saving capacity and that does not push the family's peak burden above max(Healthy, A's peak)
  // — siblings can make the peak exceed "Healthy" whatever this child's school is.
  const middle = costed
    .map((c) => byId.get(c.s.id))
    .filter((r): r is ComparisonRow => !!r && r.school.id !== cheapest.s.id && r.school.id !== premium.s.id);
  const peakCap = Math.max(healthyMax, (a1?.peakRatio ?? 0) + 1e-9);
  const within = middle.filter((r) => r.peakRatio <= peakCap && r.requiredMonthly <= capacity);
  const balanced = within.length
    ? within.reduce((best, r) => (r.levelTotalNominal > best.levelTotalNominal ? r : best))
    : middle.length
      ? middle.reduce((best, r) => (r.score.score > best.score.score || (r.score.score === best.score.score && r.levelTotalNominal < best.levelTotalNominal) ? r : best))
      : undefined;

  const options: RecommendationOption[] = [];
  if (a1)
    options.push({
      key: "A",
      title: "Option A — Financially Conservative",
      rationale: "Total biaya jenjang terendah di antara kandidat dengan data biaya.",
      row: a1,
    });
  if (balanced)
    options.push({
      key: "B",
      title: "Option B — Balanced",
      rationale: within.length
        ? `Biaya tertinggi di antara kandidat tengah yang kebutuhan investasinya ≤ kapasitas menabung dan tidak menaikkan puncak beban pendidikan di atas ${formatPct(peakCap, 0)}.`
        : "Tidak ada kandidat tengah yang kebutuhan investasinya ≤ kapasitas menabung; ditampilkan kandidat tengah dengan Affordability Score tertinggi.",
      row: balanced,
    });
  const c1 = byId.get(premium.s.id);
  if (c1)
    options.push({
      key: "C",
      title: "Option C — Premium",
      rationale: targetId && premium.s.id === targetId ? "Sekolah target yang Anda pilih." : "Kandidat dengan total biaya tertinggi.",
      row: c1,
    });
  return {
    options,
    candidates: pool.length,
    note:
      "Pilihan disusun hanya dari sisi finansial. Biaya lebih tinggi tidak berarti kualitas akademik lebih baik — nilai kurikulum, jarak, dan kecocokan anak secara terpisah.",
  };
}
