import { BAND_LABEL } from "./engine/affordability";
import { buildAlerts, type Alert } from "./engine/alerts";
import { defaultScenarios, runScenarios, tradeoff, type ScenarioOutcome, type TradeoffResult } from "./engine/analysis";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "./engine/catalog";
import { ASSUMPTION_NOTES, INFLATION_LABEL, RETURN_LABEL } from "./engine/defaults";
import { FUNDING_STATUS_LABEL } from "./engine/funding";
import { runPlan, type PlanResult } from "./engine/plan";
import { ILLUSTRATIVE_ALLOCATION, PROFILE_LABEL, scoreRisk, type RiskResult } from "./engine/risk";
import type { Assumptions, Household, InflationKey, SchoolDatabase } from "./engine/types";
import { REFERENCES } from "./data/seed";
import { formatDate, formatNumber, formatPct, formatRp, formatRpWords } from "./format";
import { SOURCE_TYPE_LABEL, VERIFICATION_LABEL } from "./ui-helpers";

export interface ReportTable {
  columns: string[];
  rows: (string | number)[][];
  numeric?: boolean[];
}

export interface ReportSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tables?: { caption?: string; table: ReportTable }[];
}

export interface ReportModel {
  title: string;
  familyName: string;
  generatedAt: string;
  planDate: string;
  sections: ReportSection[];
  plan: PlanResult;
  scenarios: ScenarioOutcome[];
  trade: TradeoffResult;
  risk: RiskResult;
  alerts: Alert[];
  sources: { school: string; level: string; academicYear: string; status: string; source: string; url: string; accessed: string }[];
}

const ay = (y: number) => `${y}/${y + 1}`;

export function buildRecommendations(plan: PlanResult, trade: TradeoffResult, risk: RiskResult): string[] {
  const out: string[] = [];
  const f = plan.funding;
  const h = plan.health;
  if (h.emergencyMonths < h.emergencyTargetMonths) {
    const need = (h.emergencyTargetMonths - h.emergencyMonths) * h.monthlyExpensesTotal;
    out.push(
      `Pertimbangkan melengkapi dana darurat ke ${h.emergencyTargetMonths} bulan (kurang ± ${formatRpWords(need)}) sebelum menambah porsi investasi berisiko; saat ini ${formatNumber(h.emergencyMonths, 1)} bulan.`,
    );
  }
  if (f.gapNominal > 0) {
    const level = f.requiredLevel.monthlyEquivalent;
    out.push(
      `Menutup funding gap pendidikan ${formatRpWords(f.gapNominal)}: (a) investasi ${formatRp(level)}/bulan tetap, atau mulai ${formatRp(f.requiredStepUp.monthlyEquivalent)}/bulan lalu naik ${formatPct(f.requiredStepUp.stepUp)}/tahun${
        f.schedule.stepUp ? "" : " (ilustrasi kenaikan setoran mengikuti gaji)"
      }; (b) tambahan dana hari ini ${formatRpWords(f.additionalLumpSumToday)} dengan investasi tetap ${formatRp(f.plannedMonthly)}/bulan; (c) meninjau pilihan sekolah (lihat Opsi A/B/C) — kombinasi ketiganya juga mungkin.`,
    );
    if (f.required.monthlyEquivalent > h.savingsCapacity && h.savingsCapacity > 0) {
      out.push(
        `Kebutuhan investasi ${formatRp(f.required.monthlyEquivalent)}/bulan melebihi kapasitas menabung saat ini ${formatRp(h.savingsCapacity)}/bulan — gap tidak realistis ditutup hanya dengan menabung; pertimbangkan penyesuaian sekolah atau pengeluaran.`,
      );
    }
  } else if (f.requirementNominal > 0) {
    out.push(`Rencana investasi pendidikan saat ini (${formatRp(f.plannedMonthly)}/bulan) cukup menutup semua pembayaran pada asumsi dasar; tinjau ulang tiap tahun.`);
  }
  const peak = plan.affordability.peak;
  if (peak && peak.ratio >= plan.assumptions.affordabilityThresholds[2]) {
    out.push(
      `Beban pendidikan memuncak ${formatPct(peak.ratio)} dari pendapatan pada TA ${ay(peak.ay)} (${BAND_LABEL[peak.band]}). Menyiapkan uang pangkal tahun itu lebih awal akan mengurangi tekanan arus kas.`,
    );
  }
  const r = plan.cashflow.retirement;
  if (r.requiredCorpus > 0 && r.readiness < 1) {
    out.push(
      `Kesiapan pensiun ${formatPct(r.readiness, 0)}. Bandingkan strategi di bagian Trade-off: memprioritaskan pendidikan menurunkan kesiapan pensiun menjadi ${formatPct(trade.strategies[0]?.retReadiness ?? 0, 0)}, strategi seimbang ${formatPct(trade.strategies[1]?.retReadiness ?? 0, 0)}.`,
    );
  }
  if (plan.children.some((c) => Object.values(c.sources).some((s) => s?.kind === "benchmark" || s?.verification === "partially_verified" || s?.verification === "outdated"))) {
    out.push("Sebagian biaya memakai benchmark atau data yang belum terverifikasi penuh — konfirmasi jadwal biaya resmi ke sekolah sebelum mendaftar.");
  }
  if (!risk.complete) out.push("Lengkapi kuesioner profil risiko agar asumsi return dapat dikaitkan dengan profil (analitis, bukan rekomendasi produk).");
  out.push("Asumsi inflasi dan return adalah parameter, bukan jaminan. Gunakan tab Skenario & Sensitivitas untuk melihat rentang hasil.");
  return out;
}

export function buildReport(household: Household, db: SchoolDatabase, a: Assumptions, generatedAt = new Date().toISOString()): ReportModel {
  const plan = runPlan(household, db, a);
  const scenarios = runScenarios(household, db, a, defaultScenarios());
  const trade = tradeoff(household, db, a);
  const risk = scoreRisk(household.riskAnswers);
  const alerts = buildAlerts(plan, db);
  const f = plan.funding;
  const h = plan.health;
  const r = plan.cashflow.retirement;
  const p = household.primary;

  const usedFees = new Map<string, { school: string; level: string; fee: SchoolDatabase["fees"][number] }>();
  for (const c of plan.children)
    for (const [level, src] of Object.entries(c.sources)) if (src?.schedule && src.school) usedFees.set(src.schedule.id, { school: src.school.name, level, fee: src.schedule });
  const sources = [...usedFees.values()].map((u) => ({
    school: u.school,
    level: u.level,
    academicYear: u.fee.academicYear,
    status: VERIFICATION_LABEL[u.fee.provenance.verificationStatus],
    source: `${u.fee.provenance.source} (${SOURCE_TYPE_LABEL[u.fee.provenance.sourceType] ?? u.fee.provenance.sourceType})`,
    url: u.fee.provenance.sourceUrl ?? "",
    accessed: u.fee.provenance.accessedDate ?? "",
  }));

  const sections: ReportSection[] = [
    {
      id: "summary",
      title: "1. Executive Summary",
      paragraphs: [
        `Dengan kondisi keuangan saat ini, rencana pendidikan ${plan.children.length} anak berstatus ${FUNDING_STATUS_LABEL[f.status]}: kebutuhan dana mendatang ${formatRpWords(f.requirementNominal)} (nilai kini ${formatRpWords(f.requirementPv)}), dengan funding gap ${formatRpWords(f.gapNominal)}.`,
        `Investasi pendidikan yang dibutuhkan ${formatRp(f.required.monthlyEquivalent)}/bulan${f.required.stepUp ? ` (naik ${formatPct(f.required.stepUp)}/tahun)` : ""} dibanding rencana ${formatRp(f.plannedMonthly)}/bulan dan kapasitas menabung ${formatRp(h.savingsCapacity)}/bulan.`,
        `Kesiapan dana pensiun diproyeksikan ${formatPct(r.readiness, 0)} pada usia ${p.targetRetirementAge}. Net worth saat ini ${formatRpWords(h.netWorth)}.`,
      ],
      bullets: alerts.slice(0, 6).map((x) => `[${x.severity.toUpperCase()}] ${x.title}${x.detail ? ` — ${x.detail}` : ""}`),
    },
    {
      id: "family",
      title: "2. Family Profile",
      paragraphs: [`Keluarga ${household.familyName || "-"}, domisili ${household.homeCity}. Tanggal valuasi ${formatDate(plan.planDate)} (TA berjalan ${ay(plan.currentAy)}).`],
      tables: [
        {
          table: {
            columns: ["Anggota", "Usia", "Pekerjaan / jenjang", "Target"],
            rows: [
              [p.name || "Orang tua 1", p.age, p.occupation || "-", `Pensiun usia ${p.targetRetirementAge}`],
              ...(household.spouse ? [[household.spouse.name || "Pasangan", household.spouse.age, household.spouse.occupation || "-", `Pensiun usia ${household.spouse.targetRetirementAge}`]] : []),
              ...plan.children.map((c) => [
                c.child.name,
                c.rows[0]?.age ?? "-",
                c.child.currentLevel === "none" ? "Belum sekolah" : `${c.child.currentLevel} ${c.rows[0]?.gradeLabel ?? ""}`,
                `${c.child.targetEducation}${c.child.targetUniversityName ? ` — ${c.child.targetUniversityName}` : ""}`,
              ]),
            ],
          },
        },
      ],
    },
    {
      id: "income",
      title: "3. Income & Expense",
      paragraphs: [
        `Pendapatan rumah tangga ${formatRp(h.monthlyIncome)}/bulan (termasuk bonus disetahunkan). Pengeluaran hidup ${formatRp(h.monthlyLiving)}, cicilan ${formatRp(h.monthlyDebt)}, biaya sekolah berjalan ${formatRp(h.monthlyEducationNow)} per bulan. Savings rate ${formatPct(h.savingsRate, 0)}.`,
      ],
      tables: [
        {
          table: {
            columns: ["Pengeluaran", "Kategori", "Per bulan"],
            rows: household.expenses.map((e) => [e.label, e.category, formatRp(e.monthlyAmount)]),
            numeric: [false, false, true],
          },
        },
      ],
    },
    {
      id: "networth",
      title: "4. Current Net Worth",
      paragraphs: [`Total aset ${formatRp(h.totalAssets)}, total utang ${formatRp(h.totalLiabilities)}, net worth ${formatRp(h.netWorth)}. Dana darurat ${formatNumber(h.emergencyMonths, 1)} bulan (target ${h.emergencyTargetMonths}).`],
      tables: [
        {
          table: {
            columns: ["Aset / utang", "Jenis", "Nilai"],
            rows: [...household.assets.map((x) => [x.label, x.type, formatRp(x.value)]), ...household.liabilities.map((l) => [l.label, l.type, formatRp(-l.outstanding)])],
            numeric: [false, false, true],
          },
        },
      ],
    },
    {
      id: "objectives",
      title: "5. Education Objectives",
      paragraphs: ["Jalur pendidikan dan sumber biaya setiap jenjang."],
      tables: [
        {
          table: {
            columns: ["Anak", "Jenjang", "TA", "Sumber biaya", "Status data"],
            rows: plan.children.flatMap((c) =>
              Object.entries(c.sources).map(([lvl, s]) => {
                const rows = c.rows.filter((x) => x.level === lvl);
                return [c.child.name, lvl, rows.length ? `${ay(rows[0].ay)}–${ay(rows[rows.length - 1].ay)}` : "-", s?.label ?? "-", s ? (s.kind === "none" ? "Belum ada" : VERIFICATION_LABEL[s.verification]) : "-"];
              }),
            ),
          },
        },
      ],
    },
    {
      id: "school-cost",
      title: "6. School Cost Analysis",
      paragraphs: [
        `Biaya TA berjalan ${formatRp(plan.currentAyCost)}; total sampai lulus ${formatRp(plan.totals.nominal)} (nominal) atau ${formatRp(plan.totals.todayPrice + plan.currentAyCost)} dengan harga hari ini.`,
      ],
      tables: [
        {
          caption: "Kontribusi kategori biaya (waterfall)",
          table: {
            columns: ["Kategori", "Nominal", "Porsi"],
            rows: CATEGORY_ORDER.filter((k) => plan.totals.byCategory[k] > 0).map((k) => [CATEGORY_LABEL[k], formatRp(plan.totals.byCategory[k]), formatPct(plan.totals.byCategory[k] / Math.max(1, plan.totals.nominal))]),
            numeric: [false, true, true],
          },
        },
        {
          caption: "Biaya per tahun ajaran (semua anak)",
          table: {
            columns: ["TA", ...plan.children.map((c) => c.child.name), "Total", "% pendapatan"],
            rows: plan.years.map((y) => [ay(y.ay), ...plan.children.map((c) => (y.byChild[c.child.id] ? formatRp(y.byChild[c.child.id]) : "-")), formatRp(y.total), y.ratio !== null ? formatPct(y.ratio) : "-"]),
            numeric: [false, ...plan.children.map(() => true), true, true],
          },
        },
      ],
    },
    {
      id: "inflation",
      title: "7. Education Inflation",
      paragraphs: [
        "Future Cost = Current Cost × (1 + inflasi)^n, dengan inflasi terpisah per jenis biaya: biaya yang ditagih sekolah mengikuti inflasi jenis sekolah, pembelian rumah tangga mengikuti inflasi umum.",
        `Real return dana pendidikan ${formatPct(plan.realReturns.realVsGeneral, 2)} terhadap inflasi umum dan ${formatPct(plan.realReturns.realVsEducation, 2)} terhadap inflasi pendidikan (rumus Fisher).`,
      ],
      tables: [
        {
          table: {
            columns: ["Parameter", "Nilai"],
            rows: (Object.keys(INFLATION_LABEL) as InflationKey[]).map((k) => [INFLATION_LABEL[k], formatPct(a.inflation[k])]),
            numeric: [false, true],
          },
        },
      ],
    },
    {
      id: "requirement",
      title: "8. Education Funding Requirement",
      paragraphs: [
        `Kebutuhan dana TA ${ay(plan.currentAy + 1)} dan seterusnya: nominal ${formatRp(f.requirementNominal)}, present value ${formatRp(f.requirementPv)} (diskonto ${formatPct(a.returns.education)}), nilai uang hari ini ${formatRp(f.requirementReal)}.`,
        "Biaya satu tahun ajaran diasumsikan ditarik dari dana pendidikan pada awal tahun ajaran (Juli); biaya TA berjalan dibayar dari arus kas.",
      ],
    },
    {
      id: "gap",
      title: "9. Funding Gap",
      paragraphs: [
        `Kebutuhan ${formatRp(f.requirementNominal)} − dibayar dari dana saat ini ${formatRp(f.coveredByCurrentFund)} − dibayar dari investasi rutin ${formatRp(f.coveredByContributions)} = funding gap ${formatRp(f.gapNominal)} (PV ${formatRp(f.gapPv)}). Funded ratio ${formatPct(f.fundedRatio)} → ${FUNDING_STATUS_LABEL[f.status]}.`,
      ],
      tables: [
        {
          table: {
            columns: ["TA", "Kebutuhan", "Dibayar dana", "Kekurangan"],
            rows: f.simulation.events.map((e) => [ay(e.ay), formatRp(e.amount), formatRp(e.paid), formatRp(e.shortfall)]),
            numeric: [false, true, true, true],
          },
        },
      ],
    },
    {
      id: "monthly",
      title: "10. Monthly Investment Requirement",
      paragraphs: [
        `Investasi minimum agar setiap pembayaran tertutup saat jatuh tempo: ${formatRp(f.required.monthlyEquivalent)}/bulan${f.required.stepUp ? ` (naik ${formatPct(f.required.stepUp)}/tahun)` : ""}; tanpa kenaikan ${formatRp(f.requiredLevel.monthlyEquivalent)}/bulan; metode PV ${formatRp(f.required.pvMethodMonthly)}/bulan. Alternatif: tambahan dana hari ini ${formatRp(f.additionalLumpSumToday)}.`,
      ],
      tables: [
        {
          table: {
            columns: ["Skenario return", "Return", "Investasi per bulan"],
            rows: plan.savingScenarios.map((s) => [s.label, formatPct(s.rate), formatRp(s.monthly)]),
            numeric: [false, true, true],
          },
        },
      ],
    },
    {
      id: "scenarios",
      title: "11. Scenario Analysis",
      paragraphs: ["Setiap skenario menjalankan ulang seluruh rencana."],
      tables: [
        {
          table: {
            columns: ["Skenario", "Funding gap", "Investasi/bln", "Kesiapan pensiun", "FCF terendah", "Net worth saat pensiun"],
            rows: scenarios.map((s) => [`${s.def.code} ${s.def.name}`, formatRp(s.fundingGapNominal), formatRp(s.requiredMonthly), formatPct(s.retirementReadiness, 0), formatRp(s.minFcf), formatRp(s.netWorthAtRetirement)]),
            numeric: [false, true, true, true, true, true],
          },
        },
      ],
    },
    {
      id: "risk",
      title: "12. Risk Analysis",
      paragraphs: [
        risk.answered
          ? `Profil risiko (analitis): ${PROFILE_LABEL[risk.profile]} — kemampuan ${PROFILE_LABEL[risk.ability]}, kesediaan ${PROFILE_LABEL[risk.willingness]}; profil mengikuti yang lebih konservatif. Ilustrasi alokasi: kas ${formatPct(ILLUSTRATIVE_ALLOCATION[risk.profile].cash, 0)}, pendapatan tetap ${formatPct(ILLUSTRATIVE_ALLOCATION[risk.profile].fixedIncome, 0)}, saham ${formatPct(ILLUSTRATIVE_ALLOCATION[risk.profile].equity, 0)} (bukan rekomendasi produk).`
          : "Kuesioner profil risiko belum diisi.",
        `Risiko utama rencana: inflasi biaya sekolah di atas asumsi, return di bawah asumsi, dan penurunan penghasilan (lihat skenario B, C, D).`,
      ],
    },
    {
      id: "tradeoff",
      title: "13. Education vs Retirement Trade-off",
      paragraphs: [`Anggaran investasi ${formatRp(trade.budget)}/bulan; kebutuhan pendidikan ${formatRp(trade.eduRequired)}, pensiun ${formatRp(trade.retRequired)} per bulan.`],
      tables: [
        {
          table: {
            columns: ["Strategi", "Pendidikan/bln", "Pensiun/bln", "Funded ratio pendidikan", "Kesiapan pensiun"],
            rows: trade.strategies.map((s) => [s.label, formatRp(s.eduMonthly), formatRp(s.retMonthly), formatPct(s.eduFundedRatio, 0), formatPct(s.retReadiness, 0)]),
            numeric: [false, true, true, true, true],
          },
        },
      ],
    },
    { id: "recommendations", title: "14. Recommendations", paragraphs: ["Pertimbangan berbasis data rencana (bukan instruksi):"], bullets: buildRecommendations(plan, trade, risk) },
    {
      id: "assumptions",
      title: "15. Assumptions",
      paragraphs: ASSUMPTION_NOTES.map((n) => n.text),
      tables: [
        {
          table: {
            columns: ["Asumsi", "Nilai"],
            rows: [
              ...(Object.keys(INFLATION_LABEL) as InflationKey[]).map((k) => [INFLATION_LABEL[k], formatPct(a.inflation[k])]),
              ...(Object.keys(RETURN_LABEL) as (keyof Assumptions["returns"])[]).map((k) => [RETURN_LABEL[k], formatPct(a.returns[k])]),
              ["Usia masuk SD", `${a.sdEntryAge} tahun`],
              ["Harapan hidup", `${a.lifeExpectancy} tahun`],
              ["Kebutuhan hidup saat pensiun", formatPct(a.retirementExpenseRatio, 0)],
              ["Ambang affordability", a.affordabilityThresholds.map((x) => formatPct(x, 0)).join(" / ")],
              ["Target dana darurat", `${a.emergencyFundTargetMonths} bulan`],
            ],
          },
        },
      ],
    },
    {
      id: "sources",
      title: "16. Data Sources",
      paragraphs: [
        "Setiap angka biaya sekolah dapat ditelusuri ke sumbernya. Status: Verified = dicocokkan dengan dokumen resmi; Partially Verified = sumber sekunder atau dibaca dari gambar; Outdated = TA ≥ 2 tahun lalu.",
        `Referensi makro: ${REFERENCES.marketRates.map((m) => `${m.indicator} ${m.valuePct}% (${m.asOf}, ${m.source.publisher})`).join("; ")}.`,
      ],
      tables: [{ table: { columns: ["Sekolah", "Jenjang", "TA", "Status", "Sumber", "URL", "Diakses"], rows: sources.map((s) => [s.school, s.level, s.academicYear, s.status, s.source, s.url, s.accessed]) } }],
    },
    {
      id: "disclaimer",
      title: "17. Disclaimer",
      paragraphs: [
        "This application provides financial planning estimates and educational cost analysis. It is not a substitute for personalized financial, tax, legal, or investment advice. Investment returns are assumptions, not guarantees. School fees may change and actual costs may differ from projections.",
        "EduFin Planner tidak disertifikasi atau disahkan oleh CFA Institute maupun lembaga sertifikasi perencana keuangan mana pun.",
      ],
    },
  ];

  return {
    title: "Family Financial Planning Report",
    familyName: household.familyName,
    generatedAt,
    planDate: plan.planDate,
    sections,
    plan,
    scenarios,
    trade,
    risk,
    alerts,
    sources,
  };
}
