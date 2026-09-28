import { formatPct, formatRp } from "../format";
import { BAND_LABEL, classifyAffordability, type AffordabilityBand } from "./affordability";
import { runCashflow, monthlyDebtServiceToday, monthlyIncomeToday, monthlyLivingToday, type CashflowResult } from "./cashflow";
import { emptyByCategory, projectRows, resolveCostSource, type CostSource, type ProjectedRow } from "./costs";
import { academicYearOf, buildTimeline, monthsUntilAyStart, type Timeline } from "./educationPath";
import { analyzeFunding, requiredContribution, type FundingResult, type Withdrawal } from "./funding";
import { realReturn } from "./tvm";
import type {
  Assumptions,
  Child,
  CostCategory,
  Explain,
  Household,
  InflationKey,
  Level,
  LevelPlan,
  SchoolDatabase,
} from "./types";

export interface PlanModifiers {
  inflationOverride?: Partial<Record<InflationKey, number>>;
  /** Sets the education, retirement and general portfolio returns. */
  returnOverride?: number;
  incomeMultiplier?: number;
  schoolFeeMultiplier?: number;
  eduDelayMonths?: number;
  eduMonthlyOverride?: number;
  eduStepUpOverride?: number;
  retMonthlyOverride?: number;
  levelPlanOverrides?: { childId: string; level: Level; plan: LevelPlan }[];
}

export function applyModifiers(a: Assumptions, mods: PlanModifiers = {}): Assumptions {
  const out: Assumptions = {
    ...a,
    inflation: { ...a.inflation, ...(mods.inflationOverride ?? {}) },
    returns: { ...a.returns },
  };
  if (mods.returnOverride !== undefined) {
    out.returns.education = mods.returnOverride;
    out.returns.retirement = mods.returnOverride;
    out.returns.general = mods.returnOverride;
  }
  return out;
}

export interface ChildResult {
  child: Child;
  timeline: Timeline;
  rows: ProjectedRow[];
  sources: Partial<Record<Level, CostSource>>;
  totalNominal: number;
  futureNominal: number;
  currentAyCost: number;
  /** Future path priced at today's (current AY) prices. */
  todayPriceTotal: number;
}

export interface YearAggregate {
  ay: number;
  total: number;
  byChild: Record<string, number>;
  levelByChild: Record<string, Level>;
  byCategory: Record<CostCategory, number>;
  income: number;
  ratio: number | null;
  band: AffordabilityBand | null;
}

export interface EducationResult {
  planDate: string;
  currentAy: number;
  assumptions: Assumptions;
  children: ChildResult[];
  years: YearAggregate[];
  withdrawals: Withdrawal[];
  currentAyCost: number;
  currentAyRemaining: number;
  totals: {
    nominal: number;
    future: number;
    todayPrice: number;
    byCategory: Record<CostCategory, number>;
  };
  missingCosts: { childId: string; childName: string; level: Level }[];
  warnings: string[];
  eduMonthly: number;
  eduDelayMonths: number;
  eduStepUp: number;
}

function effectiveChild(child: Child, mods: PlanModifiers): Child {
  const overrides = (mods.levelPlanOverrides ?? []).filter((o) => o.childId === child.id);
  if (!overrides.length) return child;
  const levelPlans = { ...child.levelPlans };
  for (const o of overrides) levelPlans[o.level] = o.plan;
  return { ...child, levelPlans };
}

/** Education side only (fast): timelines, projected costs, withdrawals. Used by sensitivity grids. */
export function runEducation(h: Household, db: SchoolDatabase, base: Assumptions, mods: PlanModifiers = {}): EducationResult {
  const a = applyModifiers(base, mods);
  const planDate = a.planDate;
  const currentAy = academicYearOf(planDate);
  const warnings: string[] = [];
  const missingCosts: EducationResult["missingCosts"] = [];
  const children: ChildResult[] = [];
  const byAy = new Map<number, YearAggregate>();
  const totalsByCategory = emptyByCategory();

  for (const raw of h.children) {
    const child = effectiveChild(raw, mods);
    const timeline = buildTimeline(child, a, currentAy);
    warnings.push(...timeline.warnings.map((w) => `${child.name}: ${w}`));
    const sources: Partial<Record<Level, CostSource>> = {};
    const rows = projectRows(
      timeline.rows,
      (level) => {
        const src = resolveCostSource(child, level, child.levelPlans[level], db, a, currentAy, h.homeCity);
        sources[level] = src;
        if (src.kind === "none" && src.components.length === 0) {
          missingCosts.push({ childId: child.id, childName: child.name, level });
        }
        return src;
      },
      a,
      currentAy,
      { schoolFeeMultiplier: mods.schoolFeeMultiplier },
    );
    let totalNominal = 0;
    let futureNominal = 0;
    let currentAyCost = 0;
    let todayPriceTotal = 0;
    for (const r of rows) {
      totalNominal += r.total;
      if (r.ay > currentAy) {
        futureNominal += r.total;
        todayPriceTotal += r.todayTotal;
      } else currentAyCost += r.total;
      for (const [k, v] of Object.entries(r.byCategory)) totalsByCategory[k as CostCategory] += v;
      let agg = byAy.get(r.ay);
      if (!agg) {
        agg = { ay: r.ay, total: 0, byChild: {}, levelByChild: {}, byCategory: emptyByCategory(), income: 0, ratio: null, band: null };
        byAy.set(r.ay, agg);
      }
      agg.total += r.total;
      agg.byChild[child.id] = (agg.byChild[child.id] ?? 0) + r.total;
      agg.levelByChild[child.id] = r.level;
      for (const [k, v] of Object.entries(r.byCategory)) agg.byCategory[k as CostCategory] += v;
    }
    children.push({ child, timeline, rows, sources, totalNominal, futureNominal, currentAyCost, todayPriceTotal });
  }

  const years = [...byAy.values()].sort((x, y) => x.ay - y.ay);
  const withdrawals: Withdrawal[] = years
    .filter((y) => y.ay > currentAy && y.total > 0)
    .map((y) => ({
      ay: y.ay,
      month: monthsUntilAyStart(y.ay, planDate),
      amount: y.total,
      label: `TA ${y.ay}/${y.ay + 1}`,
    }));

  // Current academic year: one-time items were due in July; the recurring part is spread over remaining months.
  const currentRows = children.flatMap((c) => c.rows.filter((r) => r.ay === currentAy));
  const currentAyCost = currentRows.reduce((s, r) => s + r.total, 0);
  const currentRecurring = currentRows.reduce((s, r) => s + r.total - r.oneTimeTotal, 0);
  const remainingMonths = Math.max(0, monthsUntilAyStart(currentAy + 1, planDate) - 1);
  const currentAyRemaining = (currentRecurring * remainingMonths) / 12;

  const totals = {
    nominal: children.reduce((s, c) => s + c.totalNominal, 0),
    future: children.reduce((s, c) => s + c.futureNominal, 0),
    todayPrice: children.reduce((s, c) => s + c.todayPriceTotal, 0),
    byCategory: totalsByCategory,
  };

  return {
    planDate,
    currentAy,
    assumptions: a,
    children,
    years,
    withdrawals,
    currentAyCost,
    currentAyRemaining,
    totals,
    missingCosts,
    warnings,
    eduMonthly: mods.eduMonthlyOverride ?? h.educationPlan.monthlyContribution,
    eduDelayMonths: mods.eduDelayMonths ?? h.educationPlan.contributionDelayMonths ?? 0,
    eduStepUp: mods.eduStepUpOverride ?? h.educationPlan.stepUp ?? 0,
  };
}

export function educationFundValue(h: Household): number {
  return h.assets.filter((x) => x.type === "education_fund").reduce((s, x) => s + x.value, 0);
}

export function fundingFor(edu: EducationResult, h: Household): FundingResult {
  const a = edu.assumptions;
  return analyzeFunding({
    withdrawals: edu.withdrawals,
    currentFund: educationFundValue(h),
    plannedMonthly: edu.eduMonthly,
    annualReturn: a.returns.education,
    generalInflation: a.inflation.general,
    periodsPerYear: a.contributionFrequency,
    delayMonths: edu.eduDelayMonths,
    partialThreshold: a.partialFundingThreshold,
    stepUp: edu.eduStepUp,
  });
}

export interface FamilyHealth {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyLiving: number;
  monthlyDebt: number;
  monthlyEducationNow: number;
  monthlyExpensesTotal: number;
  savingsCapacity: number;
  savingsRate: number;
  emergencyFund: number;
  emergencyMonths: number;
  emergencyTargetMonths: number;
  educationFund: number;
  retirementFund: number;
  debtToIncome: number;
}

export interface SavingScenario {
  key: "conservative" | "base" | "optimistic";
  label: string;
  rate: number;
  monthly: number;
}

export interface PlanResult extends EducationResult {
  funding: FundingResult;
  savingScenarios: SavingScenario[];
  cashflow: CashflowResult;
  health: FamilyHealth;
  affordability: {
    rows: { ay: number; ratio: number; band: AffordabilityBand }[];
    peak: { ay: number; ratio: number; band: AffordabilityBand } | null;
    average: number | null;
  };
  realReturns: { nominal: number; general: number; education: number; realVsGeneral: number; realVsEducation: number; explain: Explain };
  retMonthly: number;
}

export function runPlan(h: Household, db: SchoolDatabase, base: Assumptions, mods: PlanModifiers = {}): PlanResult {
  const edu = runEducation(h, db, base, mods);
  const a = edu.assumptions;
  const funding = fundingFor(edu, h);
  const savingScenarios: SavingScenario[] = (
    [
      ["conservative", "Conservative", a.savingScenarios.conservative],
      ["base", "Base", a.savingScenarios.base],
      ["optimistic", "Optimistic", a.savingScenarios.optimistic],
    ] as const
  ).map(([key, label, rate]) => ({
    key,
    label,
    rate,
    monthly: requiredContribution(educationFundValue(h), edu.withdrawals, rate, a.contributionFrequency, edu.eduDelayMonths, edu.eduStepUp)
      .monthlyEquivalent,
  }));

  const retMonthly = mods.retMonthlyOverride ?? h.retirementPlan.monthlyContribution;
  const cashflow = runCashflow({
    household: h,
    assumptions: a,
    currentAy: edu.currentAy,
    planDate: edu.planDate,
    educationByAy: new Map(edu.years.map((y) => [y.ay, y.total])),
    currentAyRemaining: edu.currentAyRemaining,
    withdrawals: edu.withdrawals,
    eduMonthly: edu.eduMonthly,
    eduDelayMonths: edu.eduDelayMonths,
    eduStepUp: edu.eduStepUp,
    retMonthly,
    incomeMultiplier: mods.incomeMultiplier,
  });

  // Affordability per academic year (education cost / household income).
  const incomeByAy = new Map(cashflow.rows.map((r) => [r.ay, r.months > 0 ? (r.income * 12) / r.months : 0]));
  const rows: PlanResult["affordability"]["rows"] = [];
  for (const y of edu.years) {
    const inc = y.ay === edu.currentAy ? monthlyIncomeToday(h) * (mods.incomeMultiplier ?? 1) * 12 : incomeByAy.get(y.ay) ?? 0;
    y.income = inc;
    if (inc > 0 && y.total > 0) {
      y.ratio = y.total / inc;
      y.band = classifyAffordability(y.ratio, a.affordabilityThresholds);
      rows.push({ ay: y.ay, ratio: y.ratio, band: y.band });
    }
  }
  const peak = rows.reduce<PlanResult["affordability"]["peak"]>((p, r) => (!p || r.ratio > p.ratio ? r : p), null);
  const average = rows.length ? rows.reduce((s, r) => s + r.ratio, 0) / rows.length : null;

  // Family financial health today
  const sum = (t: string[]) => h.assets.filter((x) => t.includes(x.type)).reduce((s, x) => s + x.value, 0);
  const totalAssets = h.assets.reduce((s, x) => s + x.value, 0);
  const totalLiabilities = h.liabilities.reduce((s, x) => s + x.outstanding, 0);
  const monthlyIncome = monthlyIncomeToday(h) * (mods.incomeMultiplier ?? 1);
  const monthlyLiving = monthlyLivingToday(h);
  const monthlyDebt = monthlyDebtServiceToday(h);
  const remainingMonths = Math.max(1, monthsUntilAyStart(edu.currentAy + 1, edu.planDate) - 1);
  const monthlyEducationNow = edu.currentAyRemaining / remainingMonths;
  const monthlyExpensesTotal = monthlyLiving + monthlyDebt + monthlyEducationNow;
  const emergencyFund = sum(["cash", "emergency_fund"]);
  const savingsCapacity = monthlyIncome - monthlyExpensesTotal;
  const health: FamilyHealth = {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
    monthlyIncome,
    monthlyLiving,
    monthlyDebt,
    monthlyEducationNow,
    monthlyExpensesTotal,
    savingsCapacity,
    savingsRate: monthlyIncome > 0 ? savingsCapacity / monthlyIncome : 0,
    emergencyFund,
    emergencyMonths: monthlyExpensesTotal > 0 ? emergencyFund / monthlyExpensesTotal : Infinity,
    emergencyTargetMonths: a.emergencyFundTargetMonths,
    educationFund: sum(["education_fund"]),
    retirementFund: sum(["retirement_fund"]),
    debtToIncome: monthlyIncome > 0 ? monthlyDebt / monthlyIncome : 0,
  };

  const nominal = a.returns.education;
  const realVsGeneral = realReturn(nominal, a.inflation.general);
  const realVsEducation = realReturn(nominal, a.inflation.education);
  const realReturns = {
    nominal,
    general: a.inflation.general,
    education: a.inflation.education,
    realVsGeneral,
    realVsEducation,
    explain: {
      title: "Real vs nominal return",
      inputs: [
        { label: "Nominal return dana pendidikan", value: formatPct(nominal) },
        { label: "Inflasi umum", value: formatPct(a.inflation.general) },
        { label: "Inflasi pendidikan", value: formatPct(a.inflation.education) },
      ],
      formula: "Real Return = (1 + Nominal Return) / (1 + Inflation) − 1",
      substitution: `(1 + ${formatPct(nominal)}) / (1 + ${formatPct(a.inflation.general)}) − 1 = ${formatPct(realVsGeneral, 2)}`,
      assumptions: ["Return adalah asumsi, bukan jaminan. Nominal − inflasi hanya pendekatan kasar; aplikasi memakai rumus Fisher."],
      result: `Riil vs inflasi umum ${formatPct(realVsGeneral, 2)} · riil vs inflasi pendidikan ${formatPct(realVsEducation, 2)}`,
    } satisfies Explain,
  };

  return {
    ...edu,
    funding,
    savingScenarios,
    cashflow,
    health,
    affordability: { rows, peak, average },
    realReturns,
    retMonthly,
  };
}

export function describeBand(ratio: number, band: AffordabilityBand): string {
  return `${formatPct(ratio)} — ${BAND_LABEL[band]}`;
}

export function explainAffordability(ay: number, cost: number, income: number, band: AffordabilityBand, t: number[]): Explain {
  return {
    title: `Affordability ratio TA ${ay}/${ay + 1}`,
    inputs: [
      { label: "Biaya pendidikan tahun ajaran (semua anak)", value: formatRp(cost) },
      { label: "Pendapatan rumah tangga tahun ajaran", value: formatRp(income) },
    ],
    formula: "Affordability Ratio = Annual Education Cost / Annual Household Income",
    substitution: `${formatRp(cost)} / ${formatRp(income)}`,
    assumptions: [
      `Ambang (dapat diubah): <${formatPct(t[0], 0)} very comfortable, <${formatPct(t[1], 0)} healthy, <${formatPct(t[2], 0)} moderate, <${formatPct(t[3], 0)} high, ≥${formatPct(t[3], 0)} aggressive.`,
      "Ambang ini konvensi perencanaan di aplikasi, bukan standar universal.",
    ],
    result: `${formatPct(cost / income)} — ${BAND_LABEL[band]}`,
  };
}
