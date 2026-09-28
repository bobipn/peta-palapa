import { describe, expect, it } from "vitest";
import { pickSchedule, resolveTiers, summarizeComponents } from "../engine/costs";
import { SEED_DB, REFERENCES } from "./seed";

const OFFICIAL = new Set([
  "official_school_website",
  "official_brochure_pdf",
  "official_social_media",
  "official_university_website",
  "official_decree_pdf",
  "official_admission_site",
]);

describe("seed database provenance invariants", () => {
  it("every schedule is traceable to a source", () => {
    for (const f of SEED_DB.fees) {
      expect(f.provenance.sourceUrl, f.id).toMatch(/^https?:\/\//);
      expect(f.provenance.academicYear, f.id).toMatch(/^\d{4}\/\d{4}$/);
      expect(f.provenance.accessedDate, f.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(SEED_DB.schools.some((s) => s.id === f.schoolId), f.id).toBe(true);
    }
  });

  it("only official sources are marked Verified", () => {
    for (const f of SEED_DB.fees) {
      if (f.provenance.verificationStatus === "verified") expect(OFFICIAL.has(f.provenance.sourceType), f.id).toBe(true);
    }
  });

  it("amounts are finite and non-negative; nothing is marked Estimated unless labelled", () => {
    for (const f of SEED_DB.fees) {
      for (const c of f.components) {
        expect(Number.isFinite(c.amount), `${f.id}/${c.label}`).toBe(true);
        expect(c.amount, `${f.id}/${c.label}`).toBeGreaterThanOrEqual(0);
        if (c.estimated) expect(c.label).toMatch(/estimasi/i);
      }
    }
  });

  it("tier groups have at least two alternatives and only one is summed", () => {
    for (const f of SEED_DB.fees) {
      const groups = new Map<string, number>();
      for (const c of f.components) if (c.tierGroup) groups.set(c.tierGroup, (groups.get(c.tierGroup) ?? 0) + 1);
      for (const [g, n] of groups) expect(n, `${f.id} ${g}`).toBeGreaterThanOrEqual(2);
      const resolved = resolveTiers(f.components);
      for (const g of groups.keys()) expect(resolved.filter((c) => c.tierGroup === g).length).toBe(1);
    }
  });

  it("first-year totals are within a plausible range (guards against double counting)", () => {
    const rows = SEED_DB.fees.map((f) => {
      const s = summarizeComponents(f.components, f.monthsBilled ?? 12);
      return { id: f.id, level: f.level, first: s.firstYearTotal, annual: s.annualTotal };
    });
    for (const r of rows) {
      expect(r.first, r.id).toBeLessThan(400_000_000);
    }
  });

  it("history points reference existing schools and have ≥ 2 years per series", () => {
    const series = new Map<string, Set<string>>();
    for (const h of SEED_DB.history) {
      expect(SEED_DB.schools.some((s) => s.id === h.schoolId)).toBe(true);
      const k = `${h.schoolId}|${h.level}|${h.componentCode}|${h.program ?? ""}`;
      const set = series.get(k) ?? new Set();
      set.add(h.academicYear);
      series.set(k, set);
    }
    expect(SEED_DB.history.length).toBeGreaterThan(0);
  });

  it("macro references carry sources", () => {
    expect(REFERENCES.inflationSeries.length).toBeGreaterThan(10);
    for (const r of [...REFERENCES.inflationSeries, ...REFERENCES.policies, ...REFERENCES.marketRates]) {
      expect(r.source.url).toMatch(/^https?:\/\//);
    }
  });

  it("Putra/Putri alternatives are never summed together", () => {
    for (const f of SEED_DB.fees) {
      const resolved = resolveTiers(f.components).filter((c) => !c.excluded);
      const putra = resolved.filter((c) => /\bputra\b/i.test(c.label));
      const putri = resolved.filter((c) => /\bputri\b/i.test(c.label));
      const sameKind = putra.some((a) => putri.some((b) => a.code === b.code));
      expect(sameKind, f.id).toBe(false);
    }
  });

  it("an incomplete newer schedule is not used as the default when a complete one exists", () => {
    for (const s of SEED_DB.schools) {
      for (const level of s.levels) {
        const all = SEED_DB.fees.filter((f) => f.schoolId === s.id && f.level === level);
        if (all.some((f) => !f.incomplete)) {
          const picked = pickSchedule(SEED_DB, s.id, level);
          expect(picked?.incomplete ?? false, `${s.id} ${level}`).toBe(false);
        }
      }
    }
  });
});
