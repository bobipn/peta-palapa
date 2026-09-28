/**
 * EduFin Planner — domain types.
 *
 * Conventions used throughout the engine:
 * - Money is IDR (Rupiah), stored as plain numbers (no cents).
 * - Rates are decimals: 0.07 = 7% per year (effective annual).
 * - An academic year (tahun ajaran, "AY") is identified by its start year:
 *   2026 = TA 2026/2027, running July 2026 – June 2027.
 */

// ---------------------------------------------------------------------------
// Education levels
// ---------------------------------------------------------------------------

export const LEVELS = ["TK", "SD", "SMP", "SMA", "SMK", "D3", "S1", "S2"] as const;
export type Level = (typeof LEVELS)[number];

export const SCHOOL_LEVELS: Level[] = ["TK", "SD", "SMP", "SMA", "SMK"];
export const UNIVERSITY_LEVELS: Level[] = ["D3", "S1", "S2"];

export type TargetEducation = "SMA" | "D3" | "S1" | "S2";
export type SecondaryTrack = "SMA" | "SMK";

// ---------------------------------------------------------------------------
// Schools & fees
// ---------------------------------------------------------------------------

export const SCHOOL_CATEGORIES = [
  "Negeri",
  "Swasta",
  "Nasional",
  "Nasional Plus",
  "International",
  "Boarding",
  "Islamic",
  "Kristen",
  "Katolik",
  "Montessori",
  "Cambridge",
  "IB",
  "STEM-oriented",
  "Sekolah Alam",
] as const;
export type SchoolCategory = (typeof SCHOOL_CATEGORIES)[number];

export type Ownership = "negeri" | "swasta";

export interface SchoolLocation {
  province: string;
  city: string;
  district?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface School {
  id: string;
  name: string;
  foundation?: string;
  ownership: Ownership;
  /** Levels the institution offers. Universities use D3/S1/S2. */
  levels: Level[];
  categories: SchoolCategory[];
  curricula: string[];
  location: SchoolLocation;
  website?: string;
  isUniversity: boolean;
  archived?: boolean;
  /** Where the record came from. */
  origin: "seed" | "admin" | "user";
  notes?: string;
}

/** Group A–D from the product spec (section 4). */
export type CostGroup = "entry" | "recurring" | "operational" | "optional";

export type Frequency = "one_time" | "monthly" | "semester" | "annual";

/** Buckets used for totals, the waterfall and the comparison table. */
export type CostCategory =
  | "entry"
  | "tuition"
  | "annual"
  | "books"
  | "uniform"
  | "transport"
  | "meals"
  | "activities"
  | "technology"
  | "courses"
  | "boarding"
  | "other";

/**
 * Which inflation parameter drives a component:
 * - "school": the school-type rate (private / international / university / education)
 * - "education": the general education inflation parameter
 * - "general": general (CPI) inflation
 */
export type ComponentInflation = "school" | "education" | "general";

export interface FeeComponent {
  id: string;
  /** Catalog code (see catalog.ts); "custom" for free-form items. */
  code: string;
  label: string;
  group: CostGroup;
  category: CostCategory;
  frequency: Frequency;
  /** Amount per frequency period, IDR. For ranges the planner uses `amount` (set to max by default). */
  amount: number;
  amountMin?: number;
  amountMax?: number;
  inflation: ComponentInflation;
  /** Optional-group items are excluded unless the family opts in. */
  included?: boolean;
  /** Shown for transparency but never summed (e.g. a printed total row, a conditional charge). */
  excluded?: boolean;
  excludedReason?: string;
  /** Derived from source data with a stated assumption (e.g. rate per SKS × assumed SKS load). */
  estimated?: boolean;
  /** Frequency not stated by the source; the value used is an inference noted in `note`. */
  frequencyInferred?: boolean;
  /** Applies only from/to this grade within the level (1-based), e.g. "mulai kelas 2", "SPP kelas 4–6". */
  fromGrade?: number;
  toGrade?: number;
  /**
   * Mutually exclusive alternatives share a tierGroup (UKT groups, Putra/Putri uniforms, class type).
   * Only one member counts: the family's choice, else the member with tierDefault, else the highest amount.
   */
  tierGroup?: string;
  tierLabel?: string;
  tierDefault?: boolean;
  verbatim?: string;
  note?: string;
}

export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "user_submitted"
  | "estimated"
  | "outdated";

export type Confidence = "high" | "medium" | "low";

export type SourceType =
  | "official_school_website"
  | "official_brochure_pdf"
  | "official_social_media"
  | "official_university_website"
  | "official_decree_pdf"
  | "official_admission_site"
  | "government"
  | "news_media"
  | "education_portal_aggregator"
  | "blog"
  | "user"
  | "assumption";

export interface Provenance {
  /** Human-readable source name, e.g. publisher + title. */
  source: string;
  sourceUrl?: string;
  sourceType: SourceType;
  /** Publication date of the source (ISO yyyy-mm-dd) when known. */
  dataDate?: string;
  /** Academic year the figures apply to, e.g. "2026/2027". */
  academicYear: string;
  academicYearInferred?: boolean;
  /** When a person last checked the figure against the source (ISO date). */
  lastVerified?: string;
  accessedDate?: string;
  verificationStatus: VerificationStatus;
  confidence: Confidence;
  evidence?: "curl_verbatim" | "webfetch_summary" | "search_snippet_only" | "manual";
  notes?: string;
}

export interface FeeSchedule {
  id: string;
  schoolId: string;
  level: Level;
  /** Program / track, e.g. "Reguler", "Boarding", "S1 Kedokteran". */
  program?: string;
  academicYear: string;
  /** Months billed per year for monthly items (default 12). */
  monthsBilled?: number;
  components: FeeComponent[];
  provenance: Provenance;
  archived?: boolean;
  /** Representative schedule for the school/level/year when several programs exist. */
  primary?: boolean;
  /** Lacks first-year tuition/recurring charges (e.g. only a form fee was published). */
  incomplete?: boolean;
  notes?: string;
}

/** A single historical observation of one fee line (e.g. SPP per month). */
export interface FeeHistoryPoint {
  id: string;
  schoolId: string;
  level: Level;
  program?: string;
  componentCode: string;
  frequency: Frequency;
  academicYear: string;
  amount: number;
  provenance: Provenance;
}

export interface SchoolDatabase {
  schools: School[];
  fees: FeeSchedule[];
  history: FeeHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Family
// ---------------------------------------------------------------------------

export type MaritalStatus = "menikah" | "lajang" | "cerai_hidup" | "cerai_mati";

export interface Person {
  id: string;
  name: string;
  age: number;
  maritalStatus: MaritalStatus;
  occupation: string;
  /** Monthly base income (take-home), IDR. */
  monthlyIncome: number;
  /** Annual income growth (decimal). */
  incomeGrowth: number;
  /** Annual bonus / THR, IDR per year (today's value). */
  annualBonus: number;
  /** Other monthly income (rental, business), IDR. */
  otherMonthlyIncome: number;
  /** Employer / statutory retirement age. */
  retirementAge: number;
  /** Age the person wants to stop working (used by the projection). */
  targetRetirementAge: number;
  /** Expected pension income per month in today's money (optional). */
  pensionMonthly?: number;
}

export interface LevelPlan {
  /**
   * - "school": use a fee schedule from the school database
   * - "custom": family-entered costs (User Submitted)
   * - "benchmark": median of database schedules for the level/city (derived, labelled Estimated)
   * - "none": no cost assigned (flagged as a gap in the plan)
   */
  mode: "school" | "custom" | "benchmark" | "none";
  schoolId?: string;
  feeScheduleId?: string;
  customComponents?: FeeComponent[];
  /** For custom costs: academic year the entered prices refer to (defaults to current AY). */
  customAcademicYear?: number;
  customInflation?: InflationKey;
  /** Family-specific operational costs (transport, meals, les…) added on top of the schedule. */
  extraComponents?: FeeComponent[];
  /** Codes of optional components from the schedule the family opts into. */
  includeOptionalCodes?: string[];
  /** Benchmark filter: category to benchmark against (e.g. "International"). */
  benchmarkCategory?: SchoolCategory;
  /** Chosen member per tier group (component id), e.g. { ukt: "<id of UKT 5>" }. */
  tierChoices?: Record<string, string>;
}

export interface Child {
  id: string;
  name: string;
  /** Stable chart color slot (color follows the child, not their position in the list). */
  colorIndex?: number;
  gender: "L" | "P";
  birthDate: string; // ISO yyyy-mm-dd
  /** Level currently attended in the current academic year, or "none" if not yet in school. */
  currentLevel: Level | "none";
  /** Grade within the level, 1-based (TK A = 1, SD kelas 1 = 1, SMP kelas 7 = 1, SMA kelas 10 = 1). */
  currentGrade?: number;
  currentSchoolId?: string;
  currentSchoolName?: string;
  targetEducation: TargetEducation;
  secondaryTrack: SecondaryTrack;
  includeTK: boolean;
  includeS2?: boolean;
  educationLocation?: string;
  targetSchoolName?: string;
  targetUniversityName?: string;
  /** Override: academic-year start when the child enters SD. */
  targetSdEntryYear?: number;
  /** Override: academic-year start when the child enters university. */
  targetUniversityEntryYear?: number;
  levelPlans: Partial<Record<Level, LevelPlan>>;
}

export type ExpenseCategory =
  | "housing"
  | "food"
  | "transportation"
  | "healthcare"
  | "insurance"
  | "lifestyle"
  | "other";

export interface ExpenseItem {
  id: string;
  category: ExpenseCategory;
  label: string;
  monthlyAmount: number;
  /** Growth override (decimal). Default: general inflation. */
  growth?: number;
}

export type AssetType =
  | "cash"
  | "emergency_fund"
  | "education_fund"
  | "retirement_fund"
  | "investment"
  | "property"
  | "vehicle"
  | "other";

export type AssetClass =
  | "cash"
  | "deposit"
  | "money_market"
  | "bond"
  | "equity"
  | "mixed"
  | "gold"
  | "property"
  | "other";

export interface AssetItem {
  id: string;
  type: AssetType;
  label: string;
  value: number;
  assetClass?: AssetClass;
  /** Annual growth/return override (decimal). Property/vehicles use this for appreciation/depreciation. */
  growth?: number;
}

export type LiabilityType = "mortgage" | "vehicle_loan" | "credit_card" | "personal_loan" | "other";

export interface LiabilityItem {
  id: string;
  type: LiabilityType;
  label: string;
  outstanding: number;
  /** Annual interest rate (decimal). */
  annualRate: number;
  monthlyPayment: number;
  remainingMonths: number;
}

export interface EducationSavingsPlan {
  /** Planned monthly investment into the education fund. */
  monthlyContribution: number;
  /** Months from plan start before contributions begin (0 = next month). */
  contributionDelayMonths?: number;
  /** Annual increase of the monthly contribution (step-up), e.g. 0.05 to follow salary growth. */
  stepUp?: number;
}

export interface RetirementSavingsPlan {
  monthlyContribution: number;
}

export type RiskProfileLevel = "conservative" | "moderate" | "balanced" | "growth" | "aggressive";

export interface RiskAnswers {
  experience?: number;
  horizon?: number;
  incomeStability?: number;
  emergencyFund?: number;
  debtLevel?: number;
  lossTolerance?: number;
  objective?: number;
  liquidity?: number;
}

export interface Household {
  id: string;
  familyName: string;
  homeCity: string;
  homeLat?: number;
  homeLng?: number;
  primary: Person;
  spouse?: Person;
  children: Child[];
  expenses: ExpenseItem[];
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  educationPlan: EducationSavingsPlan;
  retirementPlan: RetirementSavingsPlan;
  riskAnswers?: RiskAnswers;
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export type InflationKey = "general" | "education" | "privateSchool" | "internationalSchool" | "university";

export interface Assumptions {
  /** Plan valuation date (ISO). Defaults to today. */
  planDate: string;
  inflation: Record<InflationKey, number>;
  returns: {
    education: number;
    retirement: number;
    postRetirement: number;
    general: number;
    cash: number;
  };
  /** Scenario returns for the monthly-saving calculator (spec §11). */
  savingScenarios: { conservative: number; base: number; optimistic: number };
  /** Contribution frequency per year: 12 monthly, 4 quarterly, 1 annual. */
  contributionFrequency: 12 | 4 | 1;
  sdEntryAge: number;
  levelDurations: Record<Level, number>;
  /** Affordability thresholds on education cost / household income (spec §15, configurable). */
  affordabilityThresholds: [number, number, number, number];
  /** Funded ratio at or above which a gap is "Partially Funded" (below → "Funding Gap"). */
  partialFundingThreshold: number;
  emergencyFundTargetMonths: number;
  lifeExpectancy: number;
  /** Living expenses in retirement as a share of pre-retirement living expenses. */
  retirementExpenseRatio: number;
  projectionYears: number;
  /** School data older than this (months since last verification) triggers an alert. */
  staleDataMonths: number;
  /** Share of unallocated monthly surplus invested in the general portfolio (rest stays in cash). */
  surplusInvestShare: number;
  /** Expected return by risk profile (analytical parameter, not a forecast). */
  profileReturns: Record<RiskProfileLevel, number>;
}

// ---------------------------------------------------------------------------
// Explainability
// ---------------------------------------------------------------------------

export interface ExplainInput {
  label: string;
  value: string;
  note?: string;
}

/** Every engine output can be opened with "How was this calculated?" */
export interface Explain {
  title: string;
  inputs: ExplainInput[];
  formula: string;
  substitution?: string;
  assumptions: string[];
  result: string;
  notes?: string[];
}
