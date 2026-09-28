"use client";

import { makeComponent, newId } from "./engine/catalog";
import type { Household } from "./engine/types";
import { useStore } from "./store";

/**
 * Fictional example family for exploring the app. All personal figures are made-up inputs
 * (not anyone's data); schools reference real records in the bundled database, whose fees keep
 * their own provenance. Family-specific extras (transport, pocket money, boarding) are example
 * inputs and are labelled as such.
 */
export function demoHousehold(): Household {
  const extra = (code: string, amount: number, label?: string) =>
    makeComponent(code, amount, { note: "Contoh input keluarga (bukan data sekolah)", ...(label ? { label } : {}) });
  return {
    id: newId("hh"),
    familyName: "Contoh (demo)",
    homeCity: "Kota Depok",
    primary: {
      id: newId("p"),
      name: "Budi (contoh)",
      age: 38,
      maritalStatus: "menikah",
      occupation: "Karyawan swasta",
      monthlyIncome: 32_000_000,
      incomeGrowth: 0.05,
      annualBonus: 64_000_000,
      otherMonthlyIncome: 0,
      retirementAge: 56,
      targetRetirementAge: 58,
      pensionMonthly: 0,
    },
    spouse: {
      id: newId("p"),
      name: "Sari (contoh)",
      age: 35,
      maritalStatus: "menikah",
      occupation: "Konsultan",
      monthlyIncome: 14_000_000,
      incomeGrowth: 0.04,
      annualBonus: 14_000_000,
      otherMonthlyIncome: 1_500_000,
      retirementAge: 56,
      targetRetirementAge: 56,
    },
    children: [
      {
        id: newId("c"),
        name: "Aditya",
        gender: "L",
        colorIndex: 0,
        birthDate: "2016-08-14",
        currentLevel: "SD",
        currentGrade: 4,
        currentSchoolName: "Nurul Fikri Islamic School",
        targetEducation: "S1",
        secondaryTrack: "SMA",
        includeTK: false,
        educationLocation: "Kota Depok",
        targetUniversityName: "Universitas Indonesia — Ilmu Komputer",
        levelPlans: {
          SD: { mode: "school", schoolId: "dpk-nurul-fikri-islamic-school", extraComponents: [extra("shuttle", 650_000), extra("pocket_money", 300_000)] },
          SMP: { mode: "school", schoolId: "dpk-nurul-fikri-islamic-school", extraComponents: [extra("pocket_money", 500_000)] },
          SMA: { mode: "school", schoolId: "dpk-sekolah-islam-dian-didaktika", extraComponents: [extra("pocket_money", 700_000), extra("tutoring", 1_200_000, "Bimbel persiapan kuliah")] },
          S1: {
            mode: "school",
            schoolId: "univ-ui",
            feeScheduleId: "univ-ui-s1-2026-4",
            extraComponents: [extra("transport", 800_000), extra("pocket_money", 1_500_000, "Uang saku & makan")],
          },
        },
      },
      {
        id: newId("c"),
        name: "Nadia",
        gender: "P",
        colorIndex: 1,
        birthDate: "2020-11-02",
        currentLevel: "TK",
        currentGrade: 2,
        currentSchoolName: "Nurul Fikri Islamic School",
        targetEducation: "S1",
        secondaryTrack: "SMA",
        includeTK: true,
        educationLocation: "Kota Depok",
        targetUniversityName: "IPB University — Agribisnis",
        levelPlans: {
          TK: { mode: "school", schoolId: "dpk-nurul-fikri-islamic-school" },
          SD: { mode: "school", schoolId: "dpk-nurul-fikri-islamic-school", extraComponents: [extra("shuttle", 650_000), extra("pocket_money", 300_000)] },
          SMP: { mode: "benchmark", benchmarkCategory: "Islamic", extraComponents: [extra("pocket_money", 500_000)] },
          SMA: { mode: "benchmark", extraComponents: [extra("pocket_money", 700_000)] },
          S1: {
            mode: "school",
            schoolId: "univ-ipb",
            feeScheduleId: "univ-ipb-s1-2026-5",
            extraComponents: [extra("living_cost", 3_500_000, "Kos & makan di Bogor")],
          },
        },
      },
      {
        id: newId("c"),
        name: "Raka",
        gender: "L",
        colorIndex: 2,
        birthDate: "2023-03-20",
        currentLevel: "none",
        targetEducation: "S1",
        secondaryTrack: "SMA",
        includeTK: true,
        educationLocation: "Kota Depok",
        targetUniversityName: "Universitas Indonesia — Manajemen",
        levelPlans: {
          TK: { mode: "school", schoolId: "dpk-nurul-fikri-islamic-school" },
          SD: { mode: "school", schoolId: "dpk-sekolah-islam-dian-didaktika", extraComponents: [extra("shuttle", 650_000)] },
          SMP: { mode: "benchmark", benchmarkCategory: "Islamic" },
          SMA: { mode: "benchmark" },
          S1: { mode: "school", schoolId: "univ-ui", feeScheduleId: "univ-ui-s1-2026-13", extraComponents: [extra("pocket_money", 1_500_000, "Uang saku & makan")] },
        },
      },
    ],
    expenses: [
      { id: newId("e"), category: "housing", label: "Rumah tangga, listrik, air, internet", monthlyAmount: 7_000_000 },
      { id: newId("e"), category: "food", label: "Makan keluarga", monthlyAmount: 8_000_000 },
      { id: newId("e"), category: "transportation", label: "Transportasi keluarga", monthlyAmount: 3_000_000 },
      { id: newId("e"), category: "healthcare", label: "Kesehatan", monthlyAmount: 1_200_000, growth: 0.06 },
      { id: newId("e"), category: "insurance", label: "Premi asuransi", monthlyAmount: 1_800_000, growth: 0 },
      { id: newId("e"), category: "lifestyle", label: "Gaya hidup & liburan", monthlyAmount: 4_000_000 },
      { id: newId("e"), category: "other", label: "Lain-lain", monthlyAmount: 1_500_000 },
    ],
    assets: [
      { id: newId("a"), type: "cash", label: "Tabungan", value: 25_000_000, assetClass: "cash" },
      { id: newId("a"), type: "emergency_fund", label: "Dana darurat (deposito)", value: 120_000_000, assetClass: "deposit" },
      { id: newId("a"), type: "education_fund", label: "Dana pendidikan (reksa dana campuran)", value: 150_000_000, assetClass: "mixed" },
      { id: newId("a"), type: "retirement_fund", label: "DPLK / dana pensiun", value: 180_000_000, assetClass: "mixed" },
      { id: newId("a"), type: "investment", label: "Reksa dana & SBN ritel", value: 90_000_000, assetClass: "bond" },
      { id: newId("a"), type: "property", label: "Rumah tinggal", value: 1_600_000_000, assetClass: "property" },
      { id: newId("a"), type: "vehicle", label: "Mobil", value: 250_000_000, growth: -0.1 },
    ],
    liabilities: [
      { id: newId("l"), type: "mortgage", label: "KPR", outstanding: 650_000_000, annualRate: 0.085, monthlyPayment: 6_500_000, remainingMonths: 144 },
      { id: newId("l"), type: "vehicle_loan", label: "Kredit mobil", outstanding: 90_000_000, annualRate: 0.06, monthlyPayment: 3_200_000, remainingMonths: 30 },
    ],
    educationPlan: { monthlyContribution: 5_000_000 },
    retirementPlan: { monthlyContribution: 3_000_000 },
    riskAnswers: { experience: 3, horizon: 4, incomeStability: 4, emergencyFund: 3, debtLevel: 3, lossTolerance: 3, objective: 4, liquidity: 3 },
  };
}

export function loadDemoHousehold() {
  const s = useStore.getState();
  s.setHousehold(() => demoHousehold());
  s.setOnboarded(true);
}
