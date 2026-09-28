import { formatNumber, formatPct, formatRp, formatRpWords } from "../format";
import { historicalStats, representativeHistoricalRate, schoolInflationKey } from "./inflation";
import type { PlanResult } from "./plan";
import type { SchoolDatabase } from "./types";

export type AlertSeverity = "critical" | "warning" | "info" | "good";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  href?: string;
}

const ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function buildAlerts(plan: PlanResult, db: SchoolDatabase): Alert[] {
  const a = plan.assumptions;
  const out: Alert[] = [];
  const f = plan.funding;

  // 1. Funding status
  if (f.requirementNominal > 0) {
    if (f.status === "funding_gap") {
      out.push({
        id: "gap",
        severity: "critical",
        title: `Education funding gap ${formatRpWords(f.gapNominal)}`,
        detail: `Funded ratio ${formatPct(f.fundedRatio, 0)}. Investasi yang dibutuhkan ${formatRp(f.required.monthlyEquivalent)}/bulan.`,
        href: "/planning/",
      });
    } else if (f.status === "partially_funded") {
      out.push({
        id: "gap",
        severity: "warning",
        title: `Education partially funded — gap ${formatRpWords(f.gapNominal)}`,
        detail: `Funded ratio ${formatPct(f.fundedRatio, 0)}; kekurangan terjadi karena waktu pembayaran atau jumlah setoran.`,
        href: "/planning/",
      });
    } else {
      out.push({ id: "gap", severity: "good", title: "Education fully funded with the current plan", href: "/planning/" });
    }
  }

  // 2. Monthly investment below required
  if (f.required.monthlyEquivalent > 0 && f.plannedMonthly + 1 < f.required.monthlyEquivalent) {
    out.push({
      id: "below-required",
      severity: "warning",
      title: "Monthly education investment is below required level",
      detail: `Direncanakan ${formatRp(f.plannedMonthly)}/bulan vs dibutuhkan ${formatRp(f.required.monthlyEquivalent)}/bulan.`,
      href: "/planning/",
    });
  }

  // 3. Affordability pressure
  const t = a.affordabilityThresholds;
  const firstHigh = plan.affordability.rows.find((r) => r.ratio >= t[2]);
  if (firstHigh) {
    const severe = plan.affordability.rows.some((r) => r.ratio >= t[3]);
    out.push({
      id: "affordability",
      severity: severe ? "critical" : "warning",
      title: `Education expenses may exceed ${formatPct(t[2], 0)} of projected household income in ${firstHigh.ay}/${firstHigh.ay + 1}`,
      detail: plan.affordability.peak
        ? `Puncak ${formatPct(plan.affordability.peak.ratio)} pada TA ${plan.affordability.peak.ay}/${plan.affordability.peak.ay + 1}.`
        : undefined,
      href: "/planning/",
    });
  }

  // 4. Peak year
  const peakYear = plan.years.reduce<(typeof plan.years)[number] | null>((p, y) => (!p || y.total > p.total ? y : p), null);
  if (peakYear && peakYear.total > 0) {
    out.push({
      id: "peak",
      severity: "info",
      title: `Education expenses will peak in ${peakYear.ay}/${peakYear.ay + 1}`,
      detail: `${formatRp(peakYear.total)} untuk ${Object.keys(peakYear.byChild).length} anak pada tahun ajaran tersebut.`,
      href: "/planning/",
    });
  }

  // 5. Emergency fund
  const h = plan.health;
  if (Number.isFinite(h.emergencyMonths)) {
    if (h.emergencyMonths >= h.emergencyTargetMonths) {
      out.push({
        id: "emergency",
        severity: "good",
        title: `Emergency fund sufficient for ${Math.floor(h.emergencyMonths)} months`,
        detail: `Target ${h.emergencyTargetMonths} bulan pengeluaran.`,
        href: "/portfolio/",
      });
    } else {
      out.push({
        id: "emergency",
        severity: "warning",
        title: "Emergency fund is below target",
        detail: `${formatNumber(h.emergencyMonths, 1)} dari target ${h.emergencyTargetMonths} bulan pengeluaran.`,
        href: "/portfolio/",
      });
    }
  }

  // 6. Cash flow
  const cf = plan.cashflow;
  const preRetDeficit = cf.rows.find((r) => r.primaryWorking && r.flags.includes("deficit"));
  if (preRetDeficit) {
    out.push({
      id: "deficit",
      severity: "critical",
      title: `Cash flow turns negative in ${preRetDeficit.label}`,
      detail: "Pengeluaran + investasi terencana melebihi pendapatan; kekurangan ditarik dari kas/investasi.",
      href: "/portfolio/",
    });
  }
  if (cf.unfundedTotal > 0) {
    out.push({
      id: "unfunded",
      severity: "critical",
      title: `Unfunded deficit ${formatRpWords(cf.unfundedTotal)} over the projection`,
      detail: "Seluruh aset likuid habis; sisa kekurangan harus dibiayai utang atau pemotongan pengeluaran.",
      href: "/portfolio/",
    });
  }

  // 7. Retirement trade-off
  const r = cf.retirement;
  if (r.requiredCorpus > 0 && r.readiness < 1) {
    out.push({
      id: "retirement",
      severity: r.readiness < 0.5 || r.depletionAge !== null ? "critical" : "warning",
      title: "Education funding may compromise retirement target",
      detail: `Kesiapan dana pensiun ${formatPct(r.readiness, 0)}${r.depletionAge !== null ? `; aset diproyeksikan habis di usia ${r.depletionAge}` : ""}.`,
      href: "/planning/?tab=tradeoff",
    });
  }
  if (cf.retirementRaidAy !== null) {
    out.push({
      id: "ret-raid",
      severity: "warning",
      title: `Retirement fund drawn before retirement (${cf.retirementRaidAy}/${cf.retirementRaidAy + 1})`,
      href: "/portfolio/",
    });
  }

  // 8. Data quality for schools used in the plan
  const used = new Map<string, { schoolId: string; level: string; scheduleId?: string }>();
  for (const c of plan.children) {
    for (const [level, src] of Object.entries(c.sources)) {
      if (src?.kind === "school" && src.school) used.set(`${src.school.id}:${level}`, { schoolId: src.school.id, level, scheduleId: src.schedule?.id });
    }
  }
  for (const u of used.values()) {
    const school = db.schools.find((s) => s.id === u.schoolId);
    const sched = db.fees.find((x) => x.id === u.scheduleId);
    if (!school || !sched) continue;
    const checked = sched.provenance.lastVerified ?? sched.provenance.accessedDate ?? sched.provenance.dataDate;
    const age = checked ? monthsBetween(checked, a.planDate) : Infinity;
    if (age >= a.staleDataMonths || sched.provenance.verificationStatus === "outdated") {
      out.push({
        id: `stale-${sched.id}`,
        severity: "warning",
        title: `School cost data has not been verified for ${Number.isFinite(age) ? `${age} months` : "an unknown period"}`,
        detail: `${school.name} (${u.level}, TA ${sched.academicYear}).`,
        href: `/schools/?id=${school.id}`,
      });
    }
    // Tuition inflation vs assumption
    const hist = db.history.filter((p) => p.schoolId === school.id && p.level === u.level);
    const codes = [...new Set(hist.map((p) => p.componentCode))];
    for (const code of codes) {
      const stats = historicalStats(hist.filter((p) => p.componentCode === code));
      const rep = representativeHistoricalRate(stats);
      const key = schoolInflationKey(school, sched.level);
      if (rep && rep.rate > a.inflation[key] + 0.005) {
        out.push({
          id: `infl-${school.id}-${u.level}-${code}`,
          severity: "warning",
          title: "Tuition inflation exceeded assumption",
          detail: `${school.name}: ${rep.basis} ${formatPct(rep.rate)} vs asumsi ${formatPct(a.inflation[key])}.`,
          href: `/schools/?id=${school.id}`,
        });
      }
    }
  }

  for (const c of plan.children) {
    for (const [level, src] of Object.entries(c.sources)) {
      if (src?.incomplete) {
        out.push({
          id: `incomplete-${c.child.id}-${level}`,
          severity: "warning",
          title: `Fee schedule for ${c.child.name} — ${level} is incomplete`,
          detail: `${src.label}: sumber tidak memuat SPP/biaya rutin. Pilih jadwal lain atau tambahkan biaya rutin.`,
          href: "/children/",
        });
      }
    }
  }

  // 9. Plan completeness
  for (const m of plan.missingCosts) {
    out.push({
      id: `missing-${m.childId}-${m.level}`,
      severity: "warning",
      title: `No cost set for ${m.childName} — ${m.level}`,
      detail: "Kebutuhan dana understated sampai biaya jenjang ini diisi (pilih sekolah, input biaya, atau benchmark).",
      href: "/children/",
    });
  }
  const estimated = plan.children.flatMap((c) => Object.values(c.sources).filter((s) => s?.kind === "benchmark"));
  if (estimated.length) {
    out.push({
      id: "estimated",
      severity: "info",
      title: `${estimated.length} level(s) use estimated benchmark costs`,
      detail: "Benchmark = median database, ditandai Estimated. Ganti dengan sekolah spesifik untuk akurasi.",
      href: "/children/",
    });
  }

  return out.sort((x, y) => ORDER[x.severity] - ORDER[y.severity]);
}
