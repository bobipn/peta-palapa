"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { newId } from "./engine/catalog";
import { defaultAssumptions, todayIso } from "./engine/defaults";
import type {
  AssetItem,
  Assumptions,
  Child,
  ExpenseItem,
  FeeHistoryPoint,
  FeeSchedule,
  Household,
  LevelPlan,
  LiabilityItem,
  Level,
  Person,
  RiskAnswers,
  School,
  SchoolDatabase,
} from "./engine/types";

export const SCHEMA_VERSION = 1;

export function emptyPerson(name = ""): Person {
  return {
    id: newId("p"),
    name,
    age: 35,
    maritalStatus: "menikah",
    occupation: "",
    monthlyIncome: 0,
    incomeGrowth: 0.05,
    annualBonus: 0,
    otherMonthlyIncome: 0,
    retirementAge: 56,
    targetRetirementAge: 56,
  };
}

export function emptyHousehold(): Household {
  return {
    id: newId("hh"),
    familyName: "",
    homeCity: "Kota Depok",
    primary: emptyPerson(),
    children: [],
    expenses: [],
    assets: [],
    liabilities: [],
    educationPlan: { monthlyContribution: 0 },
    retirementPlan: { monthlyContribution: 0 },
  };
}

export function emptyChild(): Child {
  return {
    id: newId("c"),
    name: "",
    gender: "L",
    birthDate: "2020-01-01",
    currentLevel: "none",
    targetEducation: "S1",
    secondaryTrack: "SMA",
    includeTK: true,
    levelPlans: {},
  };
}

/** Admin/user edits layered over the bundled seed database. */
export interface DbOverlay {
  schools: School[];
  fees: FeeSchedule[];
  history: FeeHistoryPoint[];
  removedFeeIds: string[];
}

export interface MasterData {
  cities: string[];
  curricula: string[];
}

export type ThemePref = "system" | "light" | "dark";

interface State {
  schemaVersion: number;
  onboarded: boolean;
  household: Household;
  assumptions: Assumptions;
  pinPlanDate: boolean;
  overlay: DbOverlay;
  masterData: MasterData;
  compare: { childId?: string; level?: Level; schoolIds: string[] };
  theme: ThemePref;
  lastSyncedAt?: string;
  /** Reference data fetched from Supabase (not persisted; refreshed each session). */
  cloudDb?: SchoolDatabase;
}

interface Actions {
  setOnboarded(v: boolean): void;
  setHousehold(fn: (h: Household) => Household): void;
  updatePerson(role: "primary" | "spouse", patch: Partial<Person>): void;
  setSpouse(enabled: boolean): void;
  upsertChild(child: Child): void;
  removeChild(id: string): void;
  setLevelPlan(childId: string, level: Level, plan: LevelPlan | undefined): void;
  upsertExpense(e: ExpenseItem): void;
  removeExpense(id: string): void;
  upsertAsset(a: AssetItem): void;
  removeAsset(id: string): void;
  upsertLiability(l: LiabilityItem): void;
  removeLiability(id: string): void;
  setRiskAnswers(patch: Partial<RiskAnswers>): void;
  setAssumptions(patch: Partial<Assumptions>): void;
  resetAssumptions(): void;
  setPinPlanDate(v: boolean): void;
  upsertSchool(s: School): void;
  upsertFee(f: FeeSchedule): void;
  removeFee(id: string): void;
  addHistory(points: FeeHistoryPoint[]): void;
  setMasterData(patch: Partial<MasterData>): void;
  setCompare(patch: Partial<State["compare"]>): void;
  toggleCompareSchool(id: string): void;
  setTheme(t: ThemePref): void;
  setCloudDb(db: SchoolDatabase | undefined): void;
  replaceAll(data: Partial<State>): void;
  resetAll(): void;
}

export type AppState = State & Actions;

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = [...list];
  copy[i] = item;
  return copy;
};

const initial = (): State => ({
  schemaVersion: SCHEMA_VERSION,
  onboarded: false,
  household: emptyHousehold(),
  assumptions: defaultAssumptions(),
  pinPlanDate: false,
  overlay: { schools: [], fees: [], history: [], removedFeeIds: [] },
  masterData: {
    cities: ["Kota Depok", "Kota Bogor", "Kabupaten Bogor"],
    curricula: ["Kurikulum Merdeka", "Kurikulum Nasional", "Cambridge", "IB", "Montessori", "Pesantren"],
  },
  compare: { schoolIds: [] },
  theme: "system",
});

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initial(),
      setOnboarded: (v) => set({ onboarded: v }),
      setHousehold: (fn) => set((s) => ({ household: fn(s.household) })),
      updatePerson: (role, patch) =>
        set((s) => {
          if (role === "primary") return { household: { ...s.household, primary: { ...s.household.primary, ...patch } } };
          const spouse = s.household.spouse ?? emptyPerson();
          return { household: { ...s.household, spouse: { ...spouse, ...patch } } };
        }),
      setSpouse: (enabled) =>
        set((s) => ({
          household: { ...s.household, spouse: enabled ? s.household.spouse ?? emptyPerson() : undefined },
        })),
      upsertChild: (child) => set((s) => ({ household: { ...s.household, children: upsert(s.household.children, child) } })),
      removeChild: (id) =>
        set((s) => ({
          household: { ...s.household, children: s.household.children.filter((c) => c.id !== id) },
          compare: s.compare.childId === id ? { schoolIds: s.compare.schoolIds } : s.compare,
        })),
      setLevelPlan: (childId, level, plan) =>
        set((s) => ({
          household: {
            ...s.household,
            children: s.household.children.map((c) => {
              if (c.id !== childId) return c;
              const levelPlans = { ...c.levelPlans };
              if (plan) levelPlans[level] = plan;
              else delete levelPlans[level];
              return { ...c, levelPlans };
            }),
          },
        })),
      upsertExpense: (e) => set((s) => ({ household: { ...s.household, expenses: upsert(s.household.expenses, e) } })),
      removeExpense: (id) =>
        set((s) => ({ household: { ...s.household, expenses: s.household.expenses.filter((x) => x.id !== id) } })),
      upsertAsset: (a) => set((s) => ({ household: { ...s.household, assets: upsert(s.household.assets, a) } })),
      removeAsset: (id) => set((s) => ({ household: { ...s.household, assets: s.household.assets.filter((x) => x.id !== id) } })),
      upsertLiability: (l) =>
        set((s) => ({ household: { ...s.household, liabilities: upsert(s.household.liabilities, l) } })),
      removeLiability: (id) =>
        set((s) => ({ household: { ...s.household, liabilities: s.household.liabilities.filter((x) => x.id !== id) } })),
      setRiskAnswers: (patch) =>
        set((s) => ({ household: { ...s.household, riskAnswers: { ...(s.household.riskAnswers ?? {}), ...patch } } })),
      setAssumptions: (patch) => set((s) => ({ assumptions: { ...s.assumptions, ...patch } })),
      resetAssumptions: () => set({ assumptions: defaultAssumptions() }),
      setPinPlanDate: (v) => set((s) => ({ pinPlanDate: v, assumptions: { ...s.assumptions, planDate: v ? s.assumptions.planDate : todayIso() } })),
      upsertSchool: (school) => set((s) => ({ overlay: { ...s.overlay, schools: upsert(s.overlay.schools, school) } })),
      upsertFee: (fee) =>
        set((s) => ({
          overlay: {
            ...s.overlay,
            fees: upsert(s.overlay.fees, fee),
            removedFeeIds: s.overlay.removedFeeIds.filter((x) => x !== fee.id),
          },
        })),
      removeFee: (id) =>
        set((s) => ({
          overlay: {
            ...s.overlay,
            fees: s.overlay.fees.filter((f) => f.id !== id),
            removedFeeIds: [...new Set([...s.overlay.removedFeeIds, id])],
          },
        })),
      addHistory: (points) =>
        set((s) => {
          let history = s.overlay.history;
          for (const p of points) history = upsert(history, p);
          return { overlay: { ...s.overlay, history } };
        }),
      setMasterData: (patch) => set((s) => ({ masterData: { ...s.masterData, ...patch } })),
      setCompare: (patch) => set((s) => ({ compare: { ...s.compare, ...patch } })),
      toggleCompareSchool: (id) =>
        set((s) => {
          const has = s.compare.schoolIds.includes(id);
          const ids = has ? s.compare.schoolIds.filter((x) => x !== id) : [...s.compare.schoolIds, id].slice(-5);
          return { compare: { ...s.compare, schoolIds: ids } };
        }),
      setTheme: (t) => set({ theme: t }),
      setCloudDb: (db) => set({ cloudDb: db }),
      replaceAll: (data) => set((s) => ({ ...s, ...data })),
      resetAll: () => set(initial()),
    }),
    {
      name: "edufin-planner",
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          // Private mode / blocked storage: fall back to memory so the app still works.
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        onboarded: s.onboarded,
        household: s.household,
        assumptions: s.assumptions,
        pinPlanDate: s.pinPlanDate,
        overlay: s.overlay,
        masterData: s.masterData,
        compare: s.compare,
        theme: s.theme,
        lastSyncedAt: s.lastSyncedAt,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const merged = { ...current, ...p };
        // New assumption keys added in later versions get their defaults.
        merged.assumptions = { ...defaultAssumptions(), ...(p.assumptions ?? {}) };
        if (!merged.pinPlanDate) merged.assumptions.planDate = todayIso();
        return merged;
      },
    },
  ),
);

/** Effective school database: bundled seed ⊕ cloud reference data ⊕ local edits (later layers win by id). */
export function mergeDb(seed: SchoolDatabase, overlay: DbOverlay, cloud?: SchoolDatabase): SchoolDatabase {
  const layers = cloud ? [seed, cloud] : [seed];
  const schools = new Map<string, SchoolDatabase["schools"][number]>();
  const fees = new Map<string, SchoolDatabase["fees"][number]>();
  const history = new Map<string, SchoolDatabase["history"][number]>();
  for (const l of layers) {
    for (const s of l.schools) schools.set(s.id, s);
    for (const f of l.fees) fees.set(f.id, f);
    for (const h of l.history) history.set(h.id, h);
  }
  for (const s of overlay.schools) schools.set(s.id, s);
  for (const f of overlay.fees) fees.set(f.id, f);
  for (const id of overlay.removedFeeIds) fees.delete(id);
  for (const h of overlay.history) history.set(h.id, h);
  return { schools: [...schools.values()], fees: [...fees.values()], history: [...history.values()] };
}
