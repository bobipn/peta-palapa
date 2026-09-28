"use client";

import { useEffect, useMemo, useState } from "react";
import { buildAlerts } from "./engine/alerts";
import { todayIso } from "./engine/defaults";
import { runPlan, type PlanModifiers, type PlanResult } from "./engine/plan";
import type { Assumptions, SchoolDatabase } from "./engine/types";
import { SEED_DB } from "./data/seed";
import { mergeDb, useStore } from "./store";

/** True once the persisted store has been read from localStorage (avoids hydration mismatches). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => setHydrated(true);
    if (useStore.persist.hasHydrated()) done();
    const unsub = useStore.persist.onFinishHydration(done);
    return unsub;
  }, []);
  return hydrated;
}

export function useDb(): SchoolDatabase {
  const overlay = useStore((s) => s.overlay);
  const cloud = useStore((s) => s.cloudDb);
  return useMemo(() => mergeDb(SEED_DB, overlay, cloud), [overlay, cloud]);
}

export function useAssumptions(): Assumptions {
  const a = useStore((s) => s.assumptions);
  const pinned = useStore((s) => s.pinPlanDate);
  return useMemo(() => (pinned ? a : { ...a, planDate: todayIso() }), [a, pinned]);
}

export function usePlan(mods?: PlanModifiers): PlanResult {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const key = JSON.stringify(mods ?? {});
  return useMemo(
    () => runPlan(household, db, a, mods),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [household, db, a, key],
  );
}

export function useAlerts(plan: PlanResult) {
  const db = useDb();
  return useMemo(() => buildAlerts(plan, db), [plan, db]);
}

/** Deferred heavy computation: renders the previous value while recomputing (keeps the frame). */
export function useDeferredCompute<T>(compute: () => T, deps: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setValue(compute()), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
