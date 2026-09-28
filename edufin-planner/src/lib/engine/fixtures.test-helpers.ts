/**
 * Test-only fixtures. School names here are fictitious and exist only for unit tests.
 */
import { makeComponent } from "./catalog";
import { defaultAssumptions } from "./defaults";
import type { Assumptions, FeeSchedule, Household, Provenance, School, SchoolDatabase } from "./types";

const prov = (ay: string, status: Provenance["verificationStatus"] = "verified"): Provenance => ({
  source: "Test fixture",
  sourceType: "official_school_website",
  academicYear: ay,
  verificationStatus: status,
  confidence: "high",
  lastVerified: "2026-08-01",
});

const school = (id: string, name: string, ownership: School["ownership"], categories: School["categories"], levels: School["levels"], city = "Kota Depok"): School => ({
  id,
  name,
  ownership,
  categories,
  curricula: [],
  levels,
  location: { province: "Jawa Barat", city },
  isUniversity: levels.some((l) => l === "S1" || l === "D3" || l === "S2"),
  origin: "seed",
});

export const testDb: SchoolDatabase = {
  schools: [
    school("s-alpha", "Sekolah Alpha (fiktif)", "swasta", ["Swasta", "Nasional"], ["TK", "SD", "SMP", "SMA"]),
    school("s-beta", "Sekolah Beta (fiktif)", "swasta", ["Swasta", "International"], ["TK", "SD", "SMP", "SMA"]),
    school("s-gamma", "Sekolah Gamma (fiktif)", "swasta", ["Swasta", "Islamic"], ["SD", "SMP"]),
    school("u-delta", "Universitas Delta (fiktif)", "negeri", ["Negeri"], ["S1"]),
  ],
  fees: [
    ...(["TK", "SD", "SMP", "SMA"] as const).map(
      (level, i): FeeSchedule => ({
        id: `f-alpha-${level}`,
        schoolId: "s-alpha",
        level,
        academicYear: "2026/2027",
        components: [
          makeComponent("uang_pangkal", 20_000_000 + i * 5_000_000, { id: `a-up-${level}` }),
          makeComponent("spp_monthly", 1_500_000 + i * 250_000, { id: `a-spp-${level}` }),
          makeComponent("annual_fee", 3_000_000, { id: `a-an-${level}` }),
        ],
        provenance: prov("2026/2027"),
      }),
    ),
    ...(["TK", "SD", "SMP", "SMA"] as const).map(
      (level, i): FeeSchedule => ({
        id: `f-beta-${level}`,
        schoolId: "s-beta",
        level,
        academicYear: "2025/2026",
        components: [
          makeComponent("uang_pangkal", 60_000_000 + i * 10_000_000, { id: `b-up-${level}` }),
          makeComponent("tuition_fee", 90_000_000 + i * 15_000_000, { id: `b-tu-${level}` }),
          makeComponent("boarding", 5_000_000, { id: `b-bo-${level}` }),
        ],
        provenance: prov("2025/2026", "partially_verified"),
      }),
    ),
    {
      id: "f-gamma-SD",
      schoolId: "s-gamma",
      level: "SD",
      academicYear: "2026/2027",
      components: [makeComponent("uang_pangkal", 12_000_000), makeComponent("spp_monthly", 900_000)],
      provenance: prov("2026/2027"),
    },
    {
      id: "f-delta-S1",
      schoolId: "u-delta",
      level: "S1",
      academicYear: "2026/2027",
      components: [makeComponent("semester_fee", 10_000_000), makeComponent("living_cost", 3_000_000)],
      provenance: prov("2026/2027"),
    },
  ],
  history: [
    { id: "h1", schoolId: "s-alpha", level: "SD", componentCode: "spp_monthly", frequency: "monthly", academicYear: "2023/2024", amount: 5_500_000, provenance: prov("2023/2024") },
    { id: "h2", schoolId: "s-alpha", level: "SD", componentCode: "spp_monthly", frequency: "monthly", academicYear: "2024/2025", amount: 6_000_000, provenance: prov("2024/2025") },
    { id: "h3", schoolId: "s-alpha", level: "SD", componentCode: "spp_monthly", frequency: "monthly", academicYear: "2025/2026", amount: 6_700_000, provenance: prov("2025/2026") },
    { id: "h4", schoolId: "s-alpha", level: "SD", componentCode: "spp_monthly", frequency: "monthly", academicYear: "2026/2027", amount: 7_500_000, provenance: prov("2026/2027") },
  ],
};

export function testAssumptions(): Assumptions {
  return defaultAssumptions("2026-09-27");
}

export function testHousehold(): Household {
  return {
    id: "hh",
    familyName: "Keluarga Uji",
    homeCity: "Kota Depok",
    primary: {
      id: "p1",
      name: "Ayah",
      age: 38,
      maritalStatus: "menikah",
      occupation: "Karyawan",
      monthlyIncome: 30_000_000,
      incomeGrowth: 0.05,
      annualBonus: 30_000_000,
      otherMonthlyIncome: 0,
      retirementAge: 56,
      targetRetirementAge: 56,
    },
    spouse: {
      id: "p2",
      name: "Ibu",
      age: 35,
      maritalStatus: "menikah",
      occupation: "Karyawan",
      monthlyIncome: 15_000_000,
      incomeGrowth: 0.05,
      annualBonus: 15_000_000,
      otherMonthlyIncome: 0,
      retirementAge: 56,
      targetRetirementAge: 56,
    },
    children: [
      {
        id: "c1",
        name: "Anak 1",
        gender: "L",
        birthDate: "2018-08-10",
        currentLevel: "SD",
        currentGrade: 3,
        targetEducation: "S1",
        secondaryTrack: "SMA",
        includeTK: false,
        levelPlans: {
          SD: { mode: "school", schoolId: "s-alpha" },
          SMP: { mode: "school", schoolId: "s-alpha" },
          SMA: { mode: "school", schoolId: "s-alpha" },
          S1: { mode: "school", schoolId: "u-delta" },
        },
      },
      {
        id: "c2",
        name: "Anak 2",
        gender: "P",
        birthDate: "2022-05-01",
        currentLevel: "none",
        targetEducation: "S1",
        secondaryTrack: "SMA",
        includeTK: true,
        levelPlans: {
          TK: { mode: "school", schoolId: "s-alpha" },
          SD: { mode: "school", schoolId: "s-alpha" },
          SMP: { mode: "school", schoolId: "s-alpha" },
          SMA: { mode: "benchmark" },
          S1: { mode: "school", schoolId: "u-delta" },
        },
      },
    ],
    expenses: [
      { id: "e1", category: "housing", label: "Rumah", monthlyAmount: 6_000_000 },
      { id: "e2", category: "food", label: "Makan", monthlyAmount: 7_000_000 },
      { id: "e3", category: "transportation", label: "Transport", monthlyAmount: 2_500_000 },
      { id: "e4", category: "lifestyle", label: "Gaya hidup", monthlyAmount: 3_000_000 },
    ],
    assets: [
      { id: "a1", type: "emergency_fund", label: "Dana darurat", value: 90_000_000 },
      { id: "a2", type: "education_fund", label: "Dana pendidikan", value: 100_000_000 },
      { id: "a3", type: "retirement_fund", label: "DPLK", value: 150_000_000 },
      { id: "a4", type: "investment", label: "Reksa dana", value: 50_000_000 },
      { id: "a5", type: "property", label: "Rumah", value: 1_200_000_000 },
    ],
    liabilities: [
      { id: "l1", type: "mortgage", label: "KPR", outstanding: 400_000_000, annualRate: 0.09, monthlyPayment: 5_000_000, remainingMonths: 120 },
    ],
    educationPlan: { monthlyContribution: 4_000_000 },
    retirementPlan: { monthlyContribution: 3_000_000 },
  };
}
