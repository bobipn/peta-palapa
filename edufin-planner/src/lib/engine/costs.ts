import { CATEGORY_ORDER, makeComponent } from "./catalog";
import { resolveComponentInflation, schoolInflationKey } from "./inflation";
import { median } from "./tvm";
import type { TimelineRow } from "./educationPath";
import type {
  Assumptions,
  Child,
  Confidence,
  CostCategory,
  CostGroup,
  FeeComponent,
  FeeSchedule,
  Frequency,
  InflationKey,
  Level,
  LevelPlan,
  School,
  SchoolCategory,
  SchoolDatabase,
  VerificationStatus,
} from "./types";

export function emptyByCategory(): Record<CostCategory, number> {
  return Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<CostCategory, number>;
}

/** Annual amount of a recurring component (0 for one-time items). */
export function annualAmount(c: Pick<FeeComponent, "frequency" | "amount">, monthsBilled = 12): number {
  switch (c.frequency) {
    case "monthly":
      return c.amount * monthsBilled;
    case "semester":
      return c.amount * 2;
    case "annual":
      return c.amount;
    case "one_time":
      return 0;
  }
}

export function isActive(c: FeeComponent, includeOptionalCodes: string[] = []): boolean {
  if (c.excluded) return false;
  if (c.group !== "optional") return true;
  return c.included === true || includeOptionalCodes.includes(c.code) || includeOptionalCodes.includes(c.id);
}

/**
 * Keep one member per tier group (mutually exclusive alternatives such as UKT groups or
 * Putra/Putri uniforms): the family's choice, else a gender match, else the flagged default,
 * else the highest amount (conservative).
 */
export function resolveTiers(
  components: FeeComponent[],
  choices: Record<string, string> = {},
  gender?: "L" | "P",
): FeeComponent[] {
  const out: FeeComponent[] = [];
  const groups = new Map<string, FeeComponent[]>();
  for (const c of components) {
    if (!c.tierGroup) out.push(c);
    else {
      const list = groups.get(c.tierGroup) ?? [];
      list.push(c);
      groups.set(c.tierGroup, list);
    }
  }
  for (const [group, list] of groups) {
    const choice = choices[group];
    let pick = choice ? list.find((c) => c.id === choice || c.tierLabel === choice) : undefined;
    if (!pick && group === "gender" && gender) pick = list.find((c) => c.tierLabel === gender);
    if (!pick) pick = list.find((c) => c.tierDefault);
    if (!pick) pick = list.reduce((best, c) => (c.amount > best.amount ? c : best));
    out.push(pick);
  }
  return out;
}

export function appliesToGrade(c: Pick<FeeComponent, "fromGrade" | "toGrade">, grade: number): boolean {
  return grade >= (c.fromGrade ?? 1) && grade <= (c.toGrade ?? Number.POSITIVE_INFINITY);
}

export interface ScheduleSummary {
  entryOneTime: number;
  annualRecurring: number;
  annualOperational: number;
  annualOptional: number;
  /** Annual cost excluding one-time entry items. */
  annualTotal: number;
  /** First year at the level = annual + one-time entry items. */
  firstYearTotal: number;
  monthlyTuition: number;
  byCategoryAnnual: Record<CostCategory, number>;
  byCategoryEntry: Record<CostCategory, number>;
}

/**
 * Summary of a schedule as a first-year student would pay it (grade 1 of the level),
 * with tier alternatives resolved to their defaults.
 */
export function summarizeComponents(
  components: FeeComponent[],
  monthsBilled = 12,
  includeOptionalCodes: string[] = [],
  grade = 1,
): ScheduleSummary {
  const s: ScheduleSummary = {
    entryOneTime: 0,
    annualRecurring: 0,
    annualOperational: 0,
    annualOptional: 0,
    annualTotal: 0,
    firstYearTotal: 0,
    monthlyTuition: 0,
    byCategoryAnnual: emptyByCategory(),
    byCategoryEntry: emptyByCategory(),
  };
  for (const c of resolveTiers(components)) {
    if (!isActive(c, includeOptionalCodes)) continue;
    if (!appliesToGrade(c, grade)) continue;
    if (c.frequency === "one_time") {
      s.entryOneTime += c.amount;
      s.byCategoryEntry[c.category] += c.amount;
      continue;
    }
    const annual = annualAmount(c, monthsBilled);
    s.byCategoryAnnual[c.category] += annual;
    if (c.group === "recurring" || c.group === "entry") s.annualRecurring += annual;
    else if (c.group === "operational") s.annualOperational += annual;
    else s.annualOptional += annual;
    if (c.category === "tuition") s.monthlyTuition += annual / 12;
  }
  s.annualTotal = s.annualRecurring + s.annualOperational + s.annualOptional;
  s.firstYearTotal = s.annualTotal + s.entryOneTime;
  return s;
}

// ---------------------------------------------------------------------------
// Cost sources
// ---------------------------------------------------------------------------

export interface SourcedComponent {
  component: FeeComponent;
  /** Academic-year start the price refers to. */
  dataYear: number;
  origin: "schedule" | "extra" | "custom" | "benchmark";
}

export interface CostSource {
  kind: "school" | "custom" | "benchmark" | "none";
  level: Level;
  school?: School;
  schedule?: FeeSchedule;
  components: SourcedComponent[];
  schoolKey: InflationKey;
  monthsBilled: number;
  verification: VerificationStatus;
  confidence: Confidence;
  label: string;
  note: string;
  benchmarkCount?: number;
  incomplete?: boolean;
}

export function ayStartOf(label: string): number {
  return Number(label.slice(0, 4));
}

/** Latest non-archived schedule for a school & level (optionally a specific id). */
export function pickSchedule(
  db: SchoolDatabase,
  schoolId: string,
  level: Level,
  scheduleId?: string,
  gender?: "L" | "P",
): FeeSchedule | undefined {
  const candidates = db.fees.filter((f) => f.schoolId === schoolId && f.level === level && !f.archived);
  if (scheduleId) {
    const exact = candidates.find((f) => f.id === scheduleId);
    if (exact) return exact;
  }
  if (!candidates.length) return undefined;
  // Prefer complete schedules (with tuition) — an incomplete newer brochure must not understate costs.
  const complete = candidates.filter((f) => !f.incomplete);
  const pool = complete.length ? complete : candidates;
  const latest = Math.max(...pool.map((f) => ayStartOf(f.academicYear)));
  const current = pool.filter((f) => ayStartOf(f.academicYear) === latest);
  const genderWord = gender === "P" ? /putri/i : gender === "L" ? /putra/i : null;
  const other = gender === "P" ? /putra/i : gender === "L" ? /putri/i : null;
  if (genderWord && other) {
    const match = current.find((f) => genderWord.test(f.program ?? "") && !other.test(f.program ?? ""));
    if (match) return match;
  }
  return current.find((f) => f.primary) ?? current[0];
}

export interface BenchmarkQuery {
  level: Level;
  city?: string;
  category?: SchoolCategory;
}

/**
 * Benchmark = median of database schedules for a level (and city/category when enough matches),
 * each normalised to the current academic year with its own school-type inflation rate.
 * Always labelled "Estimated": it is a derived statistic, not a quote from one school.
 */
export function benchmarkSource(db: SchoolDatabase, q: BenchmarkQuery, a: Assumptions, currentAy: number): CostSource {
  const schools = new Map(db.schools.map((s) => [s.id, s]));
  const eligible = (useCity: boolean) =>
    db.fees.filter((f) => {
      if (f.archived || f.level !== q.level) return false;
      const s = schools.get(f.schoolId);
      if (!s || s.archived) return false;
      if (f.provenance.verificationStatus === "estimated") return false; // never benchmark on estimates
      if (f.incomplete) return false;
      if (q.category && !s.categories.includes(q.category)) return false;
      if (useCity && q.city && s.location.city !== q.city) return false;
      return true;
    });
  const onePerSchool = (fees: FeeSchedule[]) => {
    const best = new Map<string, FeeSchedule>();
    for (const f of fees) {
      const cur = best.get(f.schoolId);
      const newer = !cur || ayStartOf(f.academicYear) > ayStartOf(cur.academicYear);
      const samePrimary = cur && ayStartOf(f.academicYear) === ayStartOf(cur.academicYear) && f.primary && !cur.primary;
      if (newer || samePrimary) best.set(f.schoolId, f);
    }
    return [...best.values()];
  };
  let matches = onePerSchool(eligible(true));
  let scope = q.city ? `di ${q.city}` : "";
  if (matches.length < 3 && q.city) {
    matches = onePerSchool(eligible(false));
    scope = "(semua kota di database)";
  }
  if (matches.length === 0) {
    return noneSource(q.level, "Tidak ada data sekolah untuk benchmark jenjang ini.");
  }
  const entry: number[] = [];
  const recurring: number[] = [];
  const operational: number[] = [];
  let swasta = 0;
  for (const f of matches) {
    const s = schools.get(f.schoolId)!;
    if (s.ownership === "swasta") swasta += 1;
    const key = schoolInflationKey(s, f.level);
    const n = currentAy - ayStartOf(f.academicYear);
    const factor = Math.pow(1 + a.inflation[key], n);
    const sum = summarizeComponents(f.components, f.monthsBilled ?? 12);
    entry.push(sum.entryOneTime * factor);
    recurring.push(sum.annualRecurring * factor);
    operational.push(sum.annualOperational * Math.pow(1 + a.inflation.general, n));
  }
  const privateMajority = swasta * 2 >= matches.length;
  const key: InflationKey =
    q.level === "D3" || q.level === "S1" || q.level === "S2"
      ? "university"
      : q.category === "International" || q.category === "IB"
        ? "internationalSchool"
        : privateMajority
          ? "privateSchool"
          : "education";
  const comps: SourcedComponent[] = [];
  const push = (code: string, amount: number, frequency: Frequency, group?: CostGroup) => {
    if (amount > 0)
      comps.push({
        component: makeComponent(code, Math.round(amount), { frequency, ...(group ? { group } : {}), note: "Median benchmark" }),
        dataYear: currentAy,
        origin: "benchmark",
      });
  };
  push("uang_pangkal", median(entry), "one_time");
  push("tuition_fee", median(recurring), "annual");
  push("other", median(operational.filter((v) => v > 0)) || 0, "annual", "operational");
  const catLabel = q.category ? ` ${q.category}` : "";
  return {
    kind: "benchmark",
    level: q.level,
    components: comps,
    schoolKey: key,
    monthsBilled: 12,
    verification: "estimated",
    confidence: matches.length >= 5 ? "medium" : "low",
    label: `Benchmark median ${matches.length} sekolah${catLabel} ${scope}`.trim(),
    note: `Median dari ${matches.length} jadwal biaya di database (bukan kuotasi satu sekolah), dinormalisasi ke TA ${currentAy}/${currentAy + 1}.`,
    benchmarkCount: matches.length,
  };
}

function noneSource(level: Level, note: string): CostSource {
  return {
    kind: "none",
    level,
    components: [],
    schoolKey: "education",
    monthsBilled: 12,
    verification: "estimated",
    confidence: "low",
    label: "Biaya belum ditentukan",
    note,
  };
}

export function resolveCostSource(
  child: Child,
  level: Level,
  plan: LevelPlan | undefined,
  db: SchoolDatabase,
  a: Assumptions,
  currentAy: number,
  homeCity: string,
): CostSource {
  const extras: SourcedComponent[] = (plan?.extraComponents ?? []).map((c) => ({
    component: c,
    dataYear: currentAy,
    origin: "extra" as const,
  }));
  if (!plan || plan.mode === "none") {
    return noneSource(level, "Belum ada sekolah atau biaya untuk jenjang ini — kebutuhan dana akan understated.");
  }
  if (plan.mode === "school" && plan.schoolId) {
    const school = db.schools.find((s) => s.id === plan.schoolId);
    const schedule = pickSchedule(db, plan.schoolId, level, plan.feeScheduleId, child.gender);
    if (!school || !schedule) {
      const src = noneSource(
        level,
        school
          ? `${school.name} belum memiliki data biaya ${level} di database.`
          : "Sekolah tidak ditemukan di database.",
      );
      src.components = extras;
      src.school = school;
      return src;
    }
    const dataYear = ayStartOf(schedule.academicYear);
    const inc = plan.includeOptionalCodes ?? [];
    return {
      kind: "school",
      level,
      school,
      schedule,
      components: [
        ...resolveTiers(schedule.components, plan.tierChoices, child.gender)
          .filter((c) => isActive(c, inc))
          .map((c) => ({ component: c, dataYear, origin: "schedule" as const })),
        ...extras,
      ],
      schoolKey: schoolInflationKey(school, level),
      monthsBilled: schedule.monthsBilled ?? 12,
      verification: schedule.provenance.verificationStatus,
      confidence: schedule.provenance.confidence,
      label: `${school.name}${schedule.program ? ` · ${schedule.program}` : ""} · TA ${schedule.academicYear}`,
      note: schedule.incomplete
        ? `${schedule.provenance.source}. Jadwal tidak lengkap (tanpa SPP/biaya rutin) — biaya kemungkinan understated.`
        : schedule.provenance.source,
      incomplete: schedule.incomplete,
    };
  }
  if (plan.mode === "custom") {
    const dataYear = plan.customAcademicYear ?? currentAy;
    return {
      kind: "custom",
      level,
      components: [
        ...resolveTiers(plan.customComponents ?? [], plan.tierChoices, child.gender)
          .filter((c) => isActive(c))
          .map((c) => ({ component: c, dataYear, origin: "custom" as const })),
        ...extras,
      ],
      schoolKey: plan.customInflation ?? schoolInflationKey(undefined, level),
      monthsBilled: 12,
      verification: "user_submitted",
      confidence: "medium",
      label: "Biaya input keluarga",
      note: `Biaya dimasukkan pengguna (User Submitted), harga TA ${dataYear}/${dataYear + 1}.`,
    };
  }
  // benchmark
  const src = benchmarkSource(
    db,
    { level, city: child.educationLocation || homeCity, category: plan.benchmarkCategory },
    a,
    currentAy,
  );
  src.components = [...src.components, ...extras];
  return src;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export interface ProjectedComponent {
  code: string;
  label: string;
  group: CostGroup;
  category: CostCategory;
  frequency: Frequency;
  /** Price per frequency period in the data year. */
  baseAmount: number;
  /** Annualised (or one-time) amount in the data year. */
  baseAnnual: number;
  dataYear: number;
  inflationKey: InflationKey;
  rate: number;
  /** Years of inflation applied: AY − data year. */
  n: number;
  multiplier: number;
  /** Nominal cost in this academic year. */
  amount: number;
  /** Same basket at current-AY prices (no future inflation). */
  todayAmount: number;
}

export interface ProjectedRow extends TimelineRow {
  sourceKind: CostSource["kind"];
  sourceLabel: string;
  verification: VerificationStatus;
  confidence: Confidence;
  schoolId?: string;
  scheduleId?: string;
  components: ProjectedComponent[];
  total: number;
  todayTotal: number;
  oneTimeTotal: number;
  byCategory: Record<CostCategory, number>;
  byGroup: Record<CostGroup, number>;
}

export interface ProjectionModifiers {
  /** Multiplier on school-charged fees (entry + recurring groups). Scenario E. */
  schoolFeeMultiplier?: number;
}

export function projectRows(
  rows: TimelineRow[],
  sourceFor: (level: Level) => CostSource,
  a: Assumptions,
  currentAy: number,
  mods: ProjectionModifiers = {},
): ProjectedRow[] {
  const out: ProjectedRow[] = [];
  const cache = new Map<Level, CostSource>();
  for (const r of rows) {
    let src = cache.get(r.level);
    if (!src) {
      src = sourceFor(r.level);
      cache.set(r.level, src);
    }
    const comps: ProjectedComponent[] = [];
    for (const sc of src.components) {
      const c = sc.component;
      if (c.excluded) continue;
      if (c.frequency === "one_time" && !r.isLevelEntry) continue;
      if (c.frequency !== "one_time" && !appliesToGrade(c, r.gradeIndex)) continue;
      const key = resolveComponentInflation(c.inflation, src.schoolKey);
      const rate = a.inflation[key];
      const baseAnnual = c.frequency === "one_time" ? c.amount : annualAmount(c, src.monthsBilled);
      const multiplier =
        mods.schoolFeeMultiplier && (c.group === "entry" || c.group === "recurring") ? mods.schoolFeeMultiplier : 1;
      const n = r.ay - sc.dataYear;
      const nToday = currentAy - sc.dataYear;
      comps.push({
        code: c.code,
        label: c.label,
        group: c.group,
        category: c.category,
        frequency: c.frequency,
        baseAmount: c.amount,
        baseAnnual,
        dataYear: sc.dataYear,
        inflationKey: key,
        rate,
        n,
        multiplier,
        amount: baseAnnual * multiplier * Math.pow(1 + rate, n),
        todayAmount: baseAnnual * multiplier * Math.pow(1 + rate, nToday),
      });
    }
    const byCategory = emptyByCategory();
    const byGroup: Record<CostGroup, number> = { entry: 0, recurring: 0, operational: 0, optional: 0 };
    let total = 0;
    let todayTotal = 0;
    let oneTimeTotal = 0;
    for (const pc of comps) {
      byCategory[pc.category] += pc.amount;
      byGroup[pc.group] += pc.amount;
      total += pc.amount;
      todayTotal += pc.todayAmount;
      if (pc.frequency === "one_time") oneTimeTotal += pc.amount;
    }
    out.push({
      ...r,
      sourceKind: src.kind,
      sourceLabel: src.label,
      verification: src.verification,
      confidence: src.confidence,
      schoolId: src.school?.id,
      scheduleId: src.schedule?.id,
      components: comps,
      total,
      todayTotal,
      oneTimeTotal,
      byCategory,
      byGroup,
    });
  }
  return out;
}

/**
 * Historical observations derived from a schedule (for the school's fee-history series):
 * monthly SPP, semester fee/UKT, annual tuition and the total one-time entry fee, first-year student.
 */
export function historyPointsFromSchedule(f: FeeSchedule): import("./types").FeeHistoryPoint[] {
  const comps = resolveTiers(f.components).filter((c) => !c.excluded && (c.fromGrade ?? 1) <= 1 && c.group !== "optional");
  const lines: [string, Frequency, FeeComponent[]][] = [
    ["spp_monthly", "monthly", comps.filter((c) => c.code === "spp_monthly")],
    ["semester_fee", "semester", comps.filter((c) => c.code === "semester_fee" && !c.estimated)],
    ["tuition_fee", "annual", comps.filter((c) => c.code === "tuition_fee" && c.frequency === "annual")],
    ["uang_pangkal", "one_time", comps.filter((c) => c.code === "uang_pangkal" && c.frequency === "one_time")],
  ];
  const out: import("./types").FeeHistoryPoint[] = [];
  for (const [code, frequency, cs] of lines) {
    const amount = cs.reduce((s, c) => s + c.amount, 0);
    if (amount > 0)
      out.push({
        id: `${f.id}-h-${code}`,
        schoolId: f.schoolId,
        level: f.level,
        program: f.program,
        componentCode: code,
        frequency,
        academicYear: f.academicYear,
        amount,
        provenance: f.provenance,
      });
  }
  return out;
}
