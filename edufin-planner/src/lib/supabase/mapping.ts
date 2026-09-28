/**
 * Pure mapping between the domain model and the relational tables (supabase/migrations).
 * Kept free of I/O so it can be unit-tested (round trip) without a database.
 */
import type {
  AssetItem,
  Assumptions,
  Child,
  ExpenseItem,
  FeeComponent,
  FeeHistoryPoint,
  FeeSchedule,
  Household,
  Level,
  LevelPlan,
  LiabilityItem,
  Person,
  RiskAnswers,
  School,
  SchoolDatabase,
} from "../engine/types";

type Row = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deterministic UUID for ids that are not already UUIDs (stable across syncs). */
export function toUuid(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase();
  // Two 64-bit FNV-1a style hashes → 128 bits, formatted as a v4-shaped UUID.
  const hash = (seed: bigint) => {
    let h = seed;
    for (let i = 0; i < id.length; i++) {
      h ^= BigInt(id.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h.toString(16).padStart(16, "0");
  };
  const hex = hash(0xcbf29ce484222325n) + hash(0x84222325cbf29ce4n);
  const v = (parseInt(hex[16], 16) & 0x3) | 0x8;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${v.toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface FamilyRows {
  family: Row;
  parents: Row[];
  income: Row[];
  children: Row[];
  education_plans: Row[];
  education_expenses: Row[];
  expenses: Row[];
  assets: Row[];
  liabilities: Row[];
  investments: Row[];
  assumptions: Row;
  risk_profile: Row | null;
}

export function householdToRows(h: Household, a: Assumptions, pinPlanDate: boolean, onboarded: boolean): FamilyRows {
  const fid = toUuid(h.id);
  const people: [Person, "primary" | "spouse"][] = [[h.primary, "primary"], ...(h.spouse ? [[h.spouse, "spouse"] as [Person, "spouse"]] : [])];
  const parents = people.map(([p, role]) => ({
    id: toUuid(p.id),
    family_id: fid,
    role,
    name: p.name,
    age: p.age,
    marital_status: p.maritalStatus,
    occupation: p.occupation,
    retirement_age: p.retirementAge,
    target_retirement_age: p.targetRetirementAge,
  }));
  const income = people.flatMap(([p]) => {
    const pid = toUuid(p.id);
    return [
      { family_id: fid, parent_id: pid, kind: "salary", amount: p.monthlyIncome, frequency: "monthly", growth: p.incomeGrowth },
      { family_id: fid, parent_id: pid, kind: "bonus", amount: p.annualBonus, frequency: "annual", growth: p.incomeGrowth },
      { family_id: fid, parent_id: pid, kind: "other", amount: p.otherMonthlyIncome, frequency: "monthly", growth: null },
      { family_id: fid, parent_id: pid, kind: "pension", amount: p.pensionMonthly ?? 0, frequency: "monthly", growth: null },
    ];
  });
  const plans: Row[] = [];
  const planExpenses: Row[] = [];
  const children = h.children.map((c) => {
    const cid = toUuid(c.id);
    for (const [level, plan] of Object.entries(c.levelPlans) as [Level, LevelPlan][]) {
      if (!plan) continue;
      const pid = toUuid(`${c.id}:${level}`);
      plans.push({
        id: pid,
        family_id: fid,
        child_id: cid,
        level,
        mode: plan.mode,
        school_id: plan.schoolId ?? null,
        fee_id: plan.feeScheduleId ?? null,
        custom_academic_year: plan.customAcademicYear ?? null,
        custom_inflation: plan.customInflation ?? null,
        benchmark_category: plan.benchmarkCategory ?? null,
        include_optional: plan.includeOptionalCodes ?? [],
        tier_choices: plan.tierChoices ?? {},
      });
      const push = (list: FeeComponent[] | undefined, kind: "custom" | "extra") =>
        (list ?? []).forEach((comp, i) =>
          planExpenses.push({
            id: toUuid(comp.id),
            family_id: fid,
            plan_id: pid,
            kind,
            sort_order: i,
            code: comp.code,
            label: comp.label,
            cost_group: comp.group,
            category: comp.category,
            frequency: comp.frequency,
            amount: Math.round(comp.amount),
            inflation: comp.inflation,
            included: comp.included ?? null,
            note: comp.note ?? null,
          }),
        );
      push(plan.customComponents, "custom");
      push(plan.extraComponents, "extra");
    }
    return {
      id: cid,
      family_id: fid,
      name: c.name,
      gender: c.gender,
      birth_date: c.birthDate,
      color_index: c.colorIndex ?? null,
      current_level: c.currentLevel,
      current_grade: c.currentGrade ?? null,
      current_school_id: c.currentSchoolId ?? null,
      current_school_name: c.currentSchoolName ?? null,
      target_education: c.targetEducation,
      secondary_track: c.secondaryTrack,
      include_tk: c.includeTK,
      include_s2: !!c.includeS2,
      education_location: c.educationLocation ?? null,
      target_school_name: c.targetSchoolName ?? null,
      target_university_name: c.targetUniversityName ?? null,
      target_sd_entry_year: c.targetSdEntryYear ?? null,
      target_university_entry_year: c.targetUniversityEntryYear ?? null,
    };
  });
  return {
    family: { id: fid, family_name: h.familyName, home_city: h.homeCity, home_lat: h.homeLat ?? null, home_lng: h.homeLng ?? null, onboarded },
    parents,
    income,
    children,
    education_plans: plans,
    education_expenses: planExpenses,
    expenses: h.expenses.map((e) => ({ id: toUuid(e.id), family_id: fid, category: e.category, label: e.label, monthly_amount: Math.round(e.monthlyAmount), growth: e.growth ?? null })),
    assets: h.assets.map((x) => ({ id: toUuid(x.id), family_id: fid, type: x.type, label: x.label, value: Math.round(x.value), asset_class: x.assetClass ?? null, growth: x.growth ?? null })),
    liabilities: h.liabilities.map((l) => ({
      id: toUuid(l.id),
      family_id: fid,
      type: l.type,
      label: l.label,
      outstanding: Math.round(l.outstanding),
      annual_rate: l.annualRate,
      monthly_payment: Math.round(l.monthlyPayment),
      remaining_months: l.remainingMonths,
    })),
    investments: [
      { family_id: fid, goal: "education", monthly_contribution: Math.round(h.educationPlan.monthlyContribution), step_up: h.educationPlan.stepUp ?? 0, delay_months: h.educationPlan.contributionDelayMonths ?? 0 },
      { family_id: fid, goal: "retirement", monthly_contribution: Math.round(h.retirementPlan.monthlyContribution), step_up: 0, delay_months: 0 },
    ],
    assumptions: { family_id: fid, data: a, pin_plan_date: pinPlanDate },
    risk_profile: h.riskAnswers ? { family_id: fid, answers: h.riskAnswers } : null,
  };
}

const num = (v: unknown, d = 0) => (v === null || v === undefined || v === "" ? d : Number(v));
const optNum = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));
const optStr = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

export function rowsToHousehold(r: FamilyRows): { household: Household; assumptions?: Partial<Assumptions>; pinPlanDate: boolean; onboarded: boolean } {
  const incomeOf = (pid: string, kind: string) => r.income.find((i) => i.parent_id === pid && i.kind === kind);
  const person = (p: Row): Person => {
    const pid = String(p.id);
    const salary = incomeOf(pid, "salary");
    return {
      id: pid,
      name: String(p.name ?? ""),
      age: num(p.age, 35),
      maritalStatus: (p.marital_status as Person["maritalStatus"]) ?? "menikah",
      occupation: String(p.occupation ?? ""),
      monthlyIncome: num(salary?.amount),
      incomeGrowth: num(salary?.growth, 0.05),
      annualBonus: num(incomeOf(pid, "bonus")?.amount),
      otherMonthlyIncome: num(incomeOf(pid, "other")?.amount),
      pensionMonthly: optNum(incomeOf(pid, "pension")?.amount),
      retirementAge: num(p.retirement_age, 56),
      targetRetirementAge: num(p.target_retirement_age, 56),
    };
  };
  const primaryRow = r.parents.find((p) => p.role === "primary");
  const spouseRow = r.parents.find((p) => p.role === "spouse");
  const component = (e: Row): FeeComponent => ({
    id: String(e.id),
    code: String(e.code),
    label: String(e.label),
    group: e.cost_group as FeeComponent["group"],
    category: e.category as FeeComponent["category"],
    frequency: e.frequency as FeeComponent["frequency"],
    amount: num(e.amount),
    inflation: e.inflation as FeeComponent["inflation"],
    included: e.included === null || e.included === undefined ? undefined : Boolean(e.included),
    note: optStr(e.note),
  });
  const children: Child[] = r.children.map((c) => {
    const cid = String(c.id);
    const levelPlans: Child["levelPlans"] = {};
    for (const p of r.education_plans.filter((x) => x.child_id === cid)) {
      const pid = String(p.id);
      const exp = r.education_expenses.filter((e) => e.plan_id === pid).sort((x, y) => num(x.sort_order) - num(y.sort_order));
      const custom = exp.filter((e) => e.kind === "custom").map(component);
      const extra = exp.filter((e) => e.kind === "extra").map(component);
      levelPlans[p.level as Level] = {
        mode: p.mode as LevelPlan["mode"],
        schoolId: optStr(p.school_id),
        feeScheduleId: optStr(p.fee_id),
        customAcademicYear: optNum(p.custom_academic_year),
        customInflation: (p.custom_inflation as LevelPlan["customInflation"]) ?? undefined,
        benchmarkCategory: (p.benchmark_category as LevelPlan["benchmarkCategory"]) ?? undefined,
        includeOptionalCodes: (p.include_optional as string[]) ?? [],
        tierChoices: (p.tier_choices as Record<string, string>) ?? {},
        ...(custom.length ? { customComponents: custom } : {}),
        ...(extra.length ? { extraComponents: extra } : {}),
      };
    }
    return {
      id: cid,
      name: String(c.name ?? ""),
      gender: (c.gender as Child["gender"]) ?? "L",
      colorIndex: optNum(c.color_index),
      birthDate: String(c.birth_date),
      currentLevel: (c.current_level as Child["currentLevel"]) ?? "none",
      currentGrade: optNum(c.current_grade),
      currentSchoolId: optStr(c.current_school_id),
      currentSchoolName: optStr(c.current_school_name),
      targetEducation: (c.target_education as Child["targetEducation"]) ?? "S1",
      secondaryTrack: (c.secondary_track as Child["secondaryTrack"]) ?? "SMA",
      includeTK: Boolean(c.include_tk),
      includeS2: Boolean(c.include_s2),
      educationLocation: optStr(c.education_location),
      targetSchoolName: optStr(c.target_school_name),
      targetUniversityName: optStr(c.target_university_name),
      targetSdEntryYear: optNum(c.target_sd_entry_year),
      targetUniversityEntryYear: optNum(c.target_university_entry_year),
      levelPlans,
    };
  });
  const inv = (goal: string) => r.investments.find((i) => i.goal === goal);
  const household: Household = {
    id: String(r.family.id),
    familyName: String(r.family.family_name ?? ""),
    homeCity: String(r.family.home_city ?? "Kota Depok"),
    homeLat: optNum(r.family.home_lat),
    homeLng: optNum(r.family.home_lng),
    primary: primaryRow
      ? person(primaryRow)
      : { id: toUuid("primary"), name: "", age: 35, maritalStatus: "menikah", occupation: "", monthlyIncome: 0, incomeGrowth: 0.05, annualBonus: 0, otherMonthlyIncome: 0, retirementAge: 56, targetRetirementAge: 56 },
    spouse: spouseRow ? person(spouseRow) : undefined,
    children,
    expenses: r.expenses.map((e) => ({ id: String(e.id), category: e.category as ExpenseItem["category"], label: String(e.label ?? ""), monthlyAmount: num(e.monthly_amount), growth: optNum(e.growth) })),
    assets: r.assets.map((x) => ({ id: String(x.id), type: x.type as AssetItem["type"], label: String(x.label ?? ""), value: num(x.value), assetClass: (x.asset_class as AssetItem["assetClass"]) ?? undefined, growth: optNum(x.growth) })),
    liabilities: r.liabilities.map((l) => ({
      id: String(l.id),
      type: l.type as LiabilityItem["type"],
      label: String(l.label ?? ""),
      outstanding: num(l.outstanding),
      annualRate: num(l.annual_rate),
      monthlyPayment: num(l.monthly_payment),
      remainingMonths: num(l.remaining_months),
    })),
    educationPlan: {
      monthlyContribution: num(inv("education")?.monthly_contribution),
      stepUp: num(inv("education")?.step_up),
      contributionDelayMonths: num(inv("education")?.delay_months),
    },
    retirementPlan: { monthlyContribution: num(inv("retirement")?.monthly_contribution) },
    riskAnswers: (r.risk_profile?.answers as RiskAnswers) ?? undefined,
  };
  return {
    household,
    assumptions: (r.assumptions?.data as Partial<Assumptions>) ?? undefined,
    pinPlanDate: Boolean(r.assumptions?.pin_plan_date),
    onboarded: Boolean(r.family.onboarded),
  };
}

// ---------------------------------------------------------------------------
// School database rows → domain
// ---------------------------------------------------------------------------

export function rowsToSchoolDb(t: { schools: Row[]; levels: Row[]; fees: Row[]; components: Row[]; history: Row[] }): SchoolDatabase {
  const levels = new Map<string, Level[]>();
  for (const l of t.levels) levels.set(String(l.school_id), [...(levels.get(String(l.school_id)) ?? []), l.level as Level]);
  const comps = new Map<string, Row[]>();
  for (const c of t.components) comps.set(String(c.fee_id), [...(comps.get(String(c.fee_id)) ?? []), c]);
  const schools: School[] = t.schools.map((s) => {
    return {
      id: String(s.id),
      name: String(s.name),
      foundation: optStr(s.foundation),
      ownership: s.ownership as School["ownership"],
      levels: levels.get(String(s.id)) ?? [],
      categories: (s.categories as School["categories"]) ?? [],
      curricula: (s.curricula as string[]) ?? [],
      location: {
        province: String(s.province ?? "Jawa Barat"),
        city: String(s.city ?? ""),
        district: optStr(s.district),
        address: optStr(s.address),
        lat: optNum(s.latitude),
        lng: optNum(s.longitude),
      },
      website: optStr(s.website),
      isUniversity: Boolean(s.is_university),
      archived: Boolean(s.archived),
      origin: s.origin as School["origin"],
      notes: optStr(s.notes),
    };
  });
  const fees: FeeSchedule[] = t.fees.map((f) => ({
    id: String(f.id),
    schoolId: String(f.school_id),
    level: f.level as Level,
    program: optStr(f.program),
    academicYear: String(f.academic_year),
    monthsBilled: num(f.months_billed, 12),
    primary: Boolean(f.is_primary),
    incomplete: Boolean(f.incomplete),
    archived: Boolean(f.archived),
    notes: optStr(f.notes),
    components: (comps.get(String(f.id)) ?? [])
      .sort((a, b) => num(a.sort_order) - num(b.sort_order))
      .map((c) => ({
        id: String(c.id),
        code: String(c.code),
        label: String(c.label),
        group: c.cost_group as FeeComponent["group"],
        category: c.category as FeeComponent["category"],
        frequency: c.frequency as FeeComponent["frequency"],
        amount: num(c.amount),
        amountMin: optNum(c.amount_min),
        amountMax: optNum(c.amount_max),
        inflation: c.inflation as FeeComponent["inflation"],
        included: c.included === null || c.included === undefined ? undefined : Boolean(c.included),
        excluded: Boolean(c.excluded) || undefined,
        excludedReason: optStr(c.excluded_reason),
        estimated: Boolean(c.estimated) || undefined,
        frequencyInferred: Boolean(c.frequency_inferred) || undefined,
        fromGrade: optNum(c.from_grade),
        toGrade: optNum(c.to_grade),
        tierGroup: optStr(c.tier_group),
        tierLabel: optStr(c.tier_label),
        tierDefault: c.tier_default === null || c.tier_default === undefined ? undefined : Boolean(c.tier_default),
        verbatim: optStr(c.verbatim),
        note: optStr(c.note),
      })),
    provenance: {
      source: String(f.source),
      sourceUrl: optStr(f.source_url),
      sourceType: f.source_type as FeeSchedule["provenance"]["sourceType"],
      dataDate: optStr(f.data_date),
      academicYear: String(f.academic_year),
      academicYearInferred: Boolean(f.academic_year_inferred) || undefined,
      accessedDate: optStr(f.accessed_date),
      lastVerified: optStr(f.last_verified),
      verificationStatus: f.verification_status as FeeSchedule["provenance"]["verificationStatus"],
      confidence: f.data_confidence as FeeSchedule["provenance"]["confidence"],
      evidence: (f.evidence as FeeSchedule["provenance"]["evidence"]) ?? undefined,
      notes: optStr(f.provenance_notes),
    },
  }));
  const history: FeeHistoryPoint[] = t.history.map((h) => ({
    id: String(h.id),
    schoolId: String(h.school_id),
    level: h.level as Level,
    program: optStr(h.program),
    componentCode: String(h.component_code),
    frequency: h.frequency as FeeHistoryPoint["frequency"],
    academicYear: String(h.academic_year),
    amount: num(h.amount),
    provenance: {
      source: String(h.source),
      sourceUrl: optStr(h.source_url),
      sourceType: (h.source_type as FeeHistoryPoint["provenance"]["sourceType"]) ?? "user",
      dataDate: optStr(h.data_date),
      academicYear: String(h.academic_year),
      accessedDate: optStr(h.accessed_date),
      verificationStatus: h.verification_status as FeeHistoryPoint["provenance"]["verificationStatus"],
      confidence: h.data_confidence as FeeHistoryPoint["provenance"]["confidence"],
      notes: optStr(h.notes),
    },
  }));
  return { schools, fees, history };
}

export function scheduleToRows(f: FeeSchedule): { fee: Row; components: Row[] } {
  const p = f.provenance;
  return {
    fee: {
      id: f.id,
      school_id: f.schoolId,
      level: f.level,
      program: f.program ?? null,
      academic_year: f.academicYear,
      months_billed: f.monthsBilled ?? 12,
      is_primary: !!f.primary,
      incomplete: !!f.incomplete,
      archived: !!f.archived,
      notes: f.notes ?? null,
      source: p.source,
      source_url: p.sourceUrl ?? null,
      source_type: p.sourceType,
      data_date: p.dataDate ?? null,
      accessed_date: p.accessedDate ?? null,
      last_verified: p.lastVerified ?? null,
      verification_status: p.verificationStatus,
      data_confidence: p.confidence,
      evidence: p.evidence ?? null,
      provenance_notes: p.notes ?? null,
      academic_year_inferred: !!p.academicYearInferred,
    },
    components: f.components.map((c, i) => ({
      id: c.id,
      fee_id: f.id,
      sort_order: i,
      code: c.code,
      label: c.label,
      cost_group: c.group,
      category: c.category,
      frequency: c.frequency,
      amount: Math.round(c.amount),
      amount_min: c.amountMin ?? null,
      amount_max: c.amountMax ?? null,
      inflation: c.inflation,
      included: c.included ?? null,
      excluded: !!c.excluded,
      excluded_reason: c.excludedReason ?? null,
      estimated: !!c.estimated,
      frequency_inferred: !!c.frequencyInferred,
      from_grade: c.fromGrade ?? null,
      to_grade: c.toGrade ?? null,
      tier_group: c.tierGroup ?? null,
      tier_label: c.tierLabel ?? null,
      tier_default: c.tierDefault ?? null,
      verbatim: c.verbatim ?? null,
      note: c.note ?? null,
    })),
  };
}

export function schoolToRow(s: School): Row {
  return {
    id: s.id,
    name: s.name,
    foundation: s.foundation ?? null,
    ownership: s.ownership,
    is_university: s.isUniversity,
    categories: s.categories,
    curricula: s.curricula,
    province: s.location.province,
    city: s.location.city,
    district: s.location.district ?? null,
    address: s.location.address ?? null,
    latitude: s.location.lat ?? null,
    longitude: s.location.lng ?? null,
    website: s.website ?? null,
    origin: s.origin,
    archived: !!s.archived,
    notes: s.notes ?? null,
  };
}
