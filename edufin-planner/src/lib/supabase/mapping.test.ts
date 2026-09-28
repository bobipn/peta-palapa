import { describe, expect, it } from "vitest";
import { demoHousehold } from "../demo";
import { defaultAssumptions } from "../engine/defaults";
import { runPlan } from "../engine/plan";
import { SEED_DB } from "../data/seed";
import { householdToRows, rowsToHousehold, rowsToSchoolDb, scheduleToRows, schoolToRow, toUuid } from "./mapping";

describe("supabase mapping", () => {
  it("toUuid is stable and produces valid UUIDs", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(toUuid("hh-legacy-1")).toMatch(re);
    expect(toUuid("hh-legacy-1")).toBe(toUuid("hh-legacy-1"));
    expect(toUuid("hh-legacy-1")).not.toBe(toUuid("hh-legacy-2"));
    const u = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(toUuid(u)).toBe(u);
  });

  it("household → rows → household round trip gives the same plan", () => {
    const h = demoHousehold();
    const a = defaultAssumptions("2026-09-28");
    const rows = householdToRows(h, a, false, true);
    // Simulate the database: numeric columns come back as numbers/strings, ids are UUIDs.
    const back = rowsToHousehold(JSON.parse(JSON.stringify(rows)));
    expect(back.onboarded).toBe(true);
    expect(back.household.children).toHaveLength(3);
    const p1 = runPlan(h, SEED_DB, a);
    const p2 = runPlan(back.household, SEED_DB, { ...a, ...(back.assumptions ?? {}) });
    expect(p2.funding.requirementNominal).toBeCloseTo(p1.funding.requirementNominal, 0);
    expect(p2.funding.gapNominal).toBeCloseTo(p1.funding.gapNominal, 0);
    expect(p2.cashflow.retirement.requiredCorpus).toBeCloseTo(p1.cashflow.retirement.requiredCorpus, 0);
    expect(p2.health.netWorth).toBeCloseTo(p1.health.netWorth, 0);
  });

  it("school schedules survive the table mapping", () => {
    const f = SEED_DB.fees.find((x) => x.components.some((c) => c.tierGroup))!;
    const s = SEED_DB.schools.find((x) => x.id === f.schoolId)!;
    const { fee, components } = scheduleToRows(f);
    const db = rowsToSchoolDb({
      schools: [{ ...schoolToRow(s) }],
      levels: s.levels.map((level) => ({ school_id: s.id, level })),
      fees: [fee],
      components,
      history: [],
    });
    expect(db.fees[0].components.length).toBe(f.components.length);
    expect(db.fees[0].components.filter((c) => c.tierGroup).length).toBe(f.components.filter((c) => c.tierGroup).length);
    expect(db.fees[0].provenance.sourceUrl).toBe(f.provenance.sourceUrl);
    expect(db.schools[0].location.city).toBe(s.location.city);
  });
});
