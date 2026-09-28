"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BAND_LABEL, BAND_TONE } from "@/lib/engine/affordability";
import { defaultScenarios, delayCost, recommendOptions, runScenarios, sensitivityGrid, tradeoff } from "@/lib/engine/analysis";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/engine/catalog";
import { academicYearOf, levelSequence, nextEntryLevel } from "@/lib/engine/educationPath";
import { ASSUMPTION_NOTES, INFLATION_LABEL } from "@/lib/engine/defaults";
import { FUNDING_STATUS_LABEL, simpleGoalPayment } from "@/lib/engine/funding";
import { explainAffordability } from "@/lib/engine/plan";
import type { InflationKey, Level } from "@/lib/engine/types";
import { REFERENCES } from "@/lib/data/seed";
import { formatNumber, formatPct, formatRp, formatRpCompact } from "@/lib/format";
import { useAssumptions, useDb, useDeferredCompute, usePlan } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { childColorVar } from "@/lib/ui-helpers";
import { ChartCard, DataTable, HBars, Lines, StackedBars, useChartColors, Waterfall } from "../charts";
import { ExplainButton } from "../Explain";
import { EducationHeatmap, SensitivityHeatmap } from "../heatmaps";
import { Card, CardBody, CardHeader, Field, MoneyInput, NumberInput, PageHeader, PercentInput, Select, Stat, StatusPill, Tabs, type Tone } from "../ui";

type Tab = "cost" | "funding" | "scenarios" | "sensitivity" | "tradeoff" | "recommend" | "inflation";

const ayLabel = (ay: number) => `${ay}/${String((ay + 1) % 100).padStart(2, "0")}`;

function CostTab() {
  const plan = usePlan();
  const c = useChartColors();
  const kids = plan.children.map((cr, i) => ({ id: cr.child.id, name: cr.child.name || `Anak ${i + 1}`, color: c[childColorVar(cr.child, i) as keyof typeof c] }));
  const data = plan.years.map((y) => ({ ay: ayLabel(y.ay), ...Object.fromEntries(kids.map((k) => [k.id, Math.round(y.byChild[k.id] ?? 0)])) }));
  const t = plan.totals;
  const waterfall = CATEGORY_ORDER.map((k) => ({ label: CATEGORY_LABEL[k], value: t.byCategory[k] }));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Biaya pendidikan TA berjalan" value={formatRpCompact(plan.currentAyCost)} sub={`${ayLabel(plan.currentAy)} · semua anak`} />
        <Stat label="Total sampai lulus (nominal)" value={formatRpCompact(t.nominal)} sub="TA berjalan s.d. lulus" />
        <Stat label="Kebutuhan dana mendatang" value={formatRpCompact(plan.funding.requirementNominal)} sub={`Harga hari ini ${formatRpCompact(t.todayPrice)}`} action={<ExplainButton explain={plan.funding.explains.requirement} compact />} />
        <Stat label="Present value" value={formatRpCompact(plan.funding.requirementPv)} sub={`Nilai riil (uang hari ini) ${formatRpCompact(plan.funding.requirementReal)}`} action={<ExplainButton explain={plan.funding.explains.pv} compact />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Education cost waterfall"
          subtitle="Kontribusi tiap kategori terhadap total biaya (nominal, TA berjalan s.d. lulus)."
          table={{ columns: [{ key: "k", label: "Kategori" }, { key: "v", label: "Nominal", numeric: true }, { key: "p", label: "Porsi", numeric: true }], rows: waterfall.filter((w) => w.value > 0).map((w) => ({ k: w.label, v: formatRp(w.value), p: formatPct(w.value / Math.max(1, t.nominal)) })) }}
        >
          <Waterfall items={waterfall} total={t.nominal} fmt={formatRpCompact} />
        </ChartCard>
        <Card>
          <CardHeader title="Per anak" subtitle="Biaya saat ini vs biaya saat masuk nanti vs total sampai lulus." />
          <CardBody>
            <DataTable
              spec={{
                columns: [
                  { key: "n", label: "Anak" },
                  { key: "now", label: "TA berjalan", numeric: true },
                  { key: "today", label: "Harga hari ini", numeric: true },
                  { key: "fut", label: "Nominal mendatang", numeric: true },
                  { key: "tot", label: "Total", numeric: true },
                ],
                rows: plan.children.map((cr) => ({
                  n: cr.child.name,
                  now: formatRpCompact(cr.currentAyCost),
                  today: formatRpCompact(cr.todayPriceTotal),
                  fut: formatRpCompact(cr.futureNominal),
                  tot: formatRpCompact(cr.totalNominal),
                })),
              }}
            />
            <p className="mt-2 text-[0.75rem] text-muted">Selisih “harga hari ini” dan “nominal” = efek inflasi biaya pendidikan per komponen.</p>
          </CardBody>
        </Card>
      </div>
      <ChartCard
        title="Biaya per tahun ajaran"
        subtitle="Beban tahunan semua anak (nominal)."
        legend={kids.map((k) => ({ label: k.name, color: k.color }))}
        table={{
          columns: [{ key: "ay", label: "TA" }, ...kids.map((k) => ({ key: k.id, label: k.name, numeric: true })), { key: "r", label: "% pendapatan", numeric: true }],
          rows: plan.years.map((y) => ({ ay: ayLabel(y.ay), ...Object.fromEntries(kids.map((k) => [k.id, formatRp(y.byChild[k.id] ?? 0)])), r: y.ratio !== null ? formatPct(y.ratio) : "—" })),
        }}
      >
        <StackedBars data={data} xKey="ay" series={kids.map((k) => ({ key: k.id, label: k.name, color: k.color }))} />
      </ChartCard>
      <AffordabilityCard />
      <ChartCard title="Education expense heatmap" subtitle="Tahun × anak × jenjang × biaya tahunan.">
        <EducationHeatmap years={plan.years} kids={kids} currentAy={plan.currentAy} />
      </ChartCard>
    </div>
  );
}

function AffordabilityCard() {
  const plan = usePlan();
  const a = useAssumptions();
  const c = useChartColors();
  const t = a.affordabilityThresholds;
  const rows = plan.affordability.rows;
  const data = rows.map((r) => ({ ay: ayLabel(r.ay), v: +(r.ratio * 100).toFixed(2) }));
  const peak = plan.affordability.peak;
  const peakYear = peak ? plan.years.find((y) => y.ay === peak.ay) : undefined;
  return (
    <ChartCard
      title="Affordability ratio"
      subtitle={`Biaya pendidikan tahunan / pendapatan rumah tangga. Ambang dapat diubah di Asumsi (${t.map((x) => formatPct(x, 0)).join(" · ")}).`}
      action={peak && peakYear ? <ExplainButton explain={explainAffordability(peak.ay, peakYear.total, peakYear.income, peak.band, t)} compact /> : null}
      table={{ columns: [{ key: "ay", label: "TA" }, { key: "r", label: "Rasio", numeric: true }, { key: "b", label: "Kategori" }], rows: rows.map((r) => ({ ay: ayLabel(r.ay), r: formatPct(r.ratio), b: BAND_LABEL[r.band] })) }}
      footer={
        peak ? (
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={BAND_TONE[peak.band]}>
              Puncak {formatPct(peak.ratio)} ({ayLabel(peak.ay)}) · {BAND_LABEL[peak.band]}
            </StatusPill>
            {plan.affordability.average !== null ? <StatusPill tone="neutral">Rata-rata {formatPct(plan.affordability.average)}</StatusPill> : null}
          </div>
        ) : null
      }
    >
      {data.length ? (
        <Lines
          data={data}
          xKey="ay"
          series={[{ key: "v", label: "Rasio biaya/pendapatan", color: c["--series-1"] }]}
          fmt={(v) => `${formatNumber(v, 1)}%`}
          yFmt={(v) => `${v}%`}
          references={t.map((x, i) => ({ y: x * 100, label: ["very comfortable", "healthy", "moderate", "high"][i] + ` <${Math.round(x * 100)}%` }))}
          height={240}
        />
      ) : (
        <p className="text-[0.85rem] text-ink-2">Isi penghasilan untuk melihat rasio.</p>
      )}
    </ChartCard>
  );
}

function FundingTab() {
  const plan = usePlan();
  const a = useAssumptions();
  const c = useChartColors();
  const household = useStore((s) => s.household);
  const setHousehold = useStore((s) => s.setHousehold);
  const f = plan.funding;
  const tone: Tone = f.status === "fully_funded" ? "good" : f.status === "partially_funded" ? "warning" : "critical";
  const coverage = f.simulation.events.map((e) => ({ ay: ayLabel(e.ay), paid: Math.round(e.paid), gap: Math.round(e.shortfall) }));
  const startMonth = f.simulation.balances.length;
  const balance = Array.from({ length: Math.ceil(startMonth / 12) }, (_, i) => ({ t: `+${i} th`, v: Math.round(f.simulation.balances[Math.min(i * 12, startMonth - 1)] ?? 0) }));
  const setPlan = (patch: Partial<typeof household.educationPlan>) => setHousehold((h) => ({ ...h, educationPlan: { ...h.educationPlan, ...patch } }));
  const [goal, setGoal] = useState({ currentFund: f.currentFund, targetFutureValue: 500_000_000, yearsRemaining: 10, annualReturn: a.returns.education, periodsPerYear: 12 as 12 | 4 | 1 });
  const simple = simpleGoalPayment(goal);
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Education funding gap" subtitle="Kebutuhan − dibayar dari dana saat ini − dibayar dari investasi rutin = gap (simulasi bulanan)." action={<StatusPill tone={tone}>{FUNDING_STATUS_LABEL[f.status]}</StatusPill>} />
        <CardBody className="flex flex-col gap-4">
          <HBars
            data={[
              { label: "Education requirement", value: f.requirementNominal },
              { label: "Dari dana saat ini (+ imbal hasil)", value: f.coveredByCurrentFund },
              { label: "Dari investasi rutin (+ imbal hasil)", value: f.coveredByContributions },
              { label: "Funding gap", value: f.gapNominal },
            ]}
            fmt={formatRpCompact}
            tone={() => "neutral"}
          />
          <div className="flex flex-wrap gap-2">
            <ExplainButton explain={f.explains.gap} label="Cara hitung gap" />
            <ExplainButton explain={f.explains.ratio} label="Funded ratio" />
            <ExplainButton explain={f.explains.pv} label="Present value" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Required monthly investment" value={formatRp(f.required.monthlyEquivalent)} sub={f.required.stepUp ? `naik ${formatPct(f.required.stepUp)}/tahun` : "setoran tetap (level)"} action={<ExplainButton explain={f.explains.required} compact />} />
            {f.required.stepUp ? (
              <Stat label="Jika level (tanpa kenaikan)" value={formatRp(f.requiredLevel.monthlyEquivalent)} sub={`Metode PV: ${formatRp(f.required.pvMethodMonthly)}/bln`} />
            ) : (
              <Stat
                label={`Jika setoran naik ${formatPct(f.requiredStepUp.stepUp, 0)}/tahun`}
                value={formatRp(f.requiredStepUp.monthlyEquivalent)}
                sub={`setoran tahun pertama (ilustrasi) · metode PV level ${formatRp(f.required.pvMethodMonthly)}/bln`}
              />
            )}
            <Stat label="Atau tambahan dana hari ini" value={formatRp(f.additionalLumpSumToday)} sub={`dengan investasi ${formatRp(f.plannedMonthly)}/bln`} />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Rencana investasi pendidikan" subtitle="Ubah untuk melihat dampaknya langsung di seluruh aplikasi." />
        <CardBody className="grid gap-3 sm:grid-cols-4">
          <Field label="Investasi per bulan">
            <MoneyInput value={household.educationPlan.monthlyContribution} onChange={(v) => setPlan({ monthlyContribution: v })} ariaLabel="Investasi pendidikan per bulan" />
          </Field>
          <Field label="Kenaikan setoran / tahun" hint="mis. mengikuti kenaikan gaji">
            <PercentInput value={household.educationPlan.stepUp ?? 0} onChange={(v) => setPlan({ stepUp: v })} min={0} max={30} ariaLabel="Kenaikan setoran" />
          </Field>
          <Field label="Mulai setelah" hint="0 = bulan depan">
            <NumberInput value={household.educationPlan.contributionDelayMonths ?? 0} min={0} max={240} onChange={(v) => setPlan({ contributionDelayMonths: v })} suffix="bulan" ariaLabel="Penundaan" />
          </Field>
          <Field label="Dana pendidikan saat ini" hint="Diubah lewat Portfolio → Aset">
            <div className="field tnum bg-card-2">{formatRp(f.currentFund)}</div>
          </Field>
        </CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Pembayaran per tahun ajaran"
          subtitle="Bagian yang dibayar dana pendidikan vs kekurangan (harus ditutup arus kas)."
          legend={[
            { label: "Dibayar dari dana", color: c["--series-1"] },
            { label: "Kekurangan", color: c["--critical"] },
          ]}
          table={{ columns: [{ key: "ay", label: "TA" }, { key: "paid", label: "Dibayar dana", numeric: true }, { key: "gap", label: "Kekurangan", numeric: true }], rows: coverage.map((x) => ({ ay: x.ay, paid: formatRp(x.paid), gap: formatRp(x.gap) })) }}
        >
          <StackedBars data={coverage} xKey="ay" series={[{ key: "paid", label: "Dibayar dari dana", color: c["--series-1"] }, { key: "gap", label: "Kekurangan", color: c["--critical"] }]} />
        </ChartCard>
        <ChartCard title="Saldo dana pendidikan" subtitle="Setelah setoran, imbal hasil, dan penarikan tiap Juli." table={{ columns: [{ key: "t", label: "Waktu" }, { key: "v", label: "Saldo", numeric: true }], rows: balance.map((b) => ({ t: b.t, v: formatRp(b.v) })) }}>
          <Lines data={balance} xKey="t" series={[{ key: "v", label: "Saldo dana", color: c["--series-1"] }]} area />
        </ChartCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly saving scenarios" subtitle="Kebutuhan investasi pada 3 asumsi return. Tidak ada rekomendasi produk tanpa profil risiko." />
          <CardBody>
            <DataTable
              spec={{
                columns: [
                  { key: "k", label: "Skenario" },
                  { key: "r", label: "Return", numeric: true },
                  { key: "m", label: "Per bulan", numeric: true },
                ],
                rows: plan.savingScenarios.map((s) => ({ k: s.label, r: formatPct(s.rate), m: formatRp(s.monthly) })),
              }}
            />
            <p className="mt-2 text-[0.75rem] text-muted">Frekuensi investasi: {a.contributionFrequency === 12 ? "bulanan" : a.contributionFrequency === 4 ? "kuartalan" : "tahunan"} (ubah di Asumsi). Return adalah asumsi, bukan jaminan.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Kalkulator target tunggal" subtitle="Input: dana saat ini, target nilai masa depan, sisa tahun, return, frekuensi." action={<ExplainButton explain={simple.explain} compact />} />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Dana saat ini">
              <MoneyInput value={goal.currentFund} onChange={(v) => setGoal({ ...goal, currentFund: v })} ariaLabel="Dana saat ini" />
            </Field>
            <Field label="Target future value">
              <MoneyInput value={goal.targetFutureValue} onChange={(v) => setGoal({ ...goal, targetFutureValue: v })} ariaLabel="Target" />
            </Field>
            <Field label="Sisa waktu">
              <NumberInput value={goal.yearsRemaining} min={1} max={40} onChange={(v) => setGoal({ ...goal, yearsRemaining: Math.max(1, v) })} suffix="tahun" ariaLabel="Sisa waktu" />
            </Field>
            <Field label="Expected return">
              <PercentInput value={goal.annualReturn} onChange={(v) => setGoal({ ...goal, annualReturn: v })} min={0} max={30} ariaLabel="Return" />
            </Field>
            <Field label="Frekuensi investasi">
              <Select value={String(goal.periodsPerYear)} onChange={(v) => setGoal({ ...goal, periodsPerYear: Number(v) as 12 | 4 | 1 })} options={[{ value: "12", label: "Bulanan" }, { value: "4", label: "Kuartalan" }, { value: "1", label: "Tahunan" }]} />
            </Field>
            <div className="rounded-lg bg-card-2 p-3">
              <div className="text-[0.75rem] text-muted">Required investment</div>
              <div className="tnum text-[1.1rem] font-semibold">{formatRp(simple.perPeriod)} / periode</div>
              <div className="text-[0.75rem] text-ink-2">≈ {formatRp(simple.monthlyEquivalent)}/bulan</div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ScenariosTab() {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const out = useDeferredCompute(() => ({ sc: runScenarios(household, db, a, defaultScenarios()), delay: delayCost(household, db, a) }), [household, db, a]);
  if (!out) return <p className="text-[0.85rem] text-ink-2">Menghitung skenario…</p>;
  const base = out.sc[0];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Scenario analysis" subtitle="Setiap skenario menjalankan ulang seluruh rencana (biaya, dana pendidikan, arus kas, pensiun, net worth)." />
        <CardBody>
          <div className="scroll-x rounded-lg border border-line">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Skenario</th>
                  <th className="num">Funding gap</th>
                  <th className="num">Investasi/bln</th>
                  <th className="num">Dana pensiun tersedia</th>
                  <th className="num">Kesiapan pensiun</th>
                  <th className="num">FCF terendah (masa kerja)</th>
                  <th className="num">Tahun defisit</th>
                  <th className="num">Net worth saat pensiun</th>
                </tr>
              </thead>
              <tbody>
                {out.sc.map((s) => (
                  <tr key={s.def.code}>
                    <td className="min-w-[14rem]">
                      <div className="font-medium">
                        {s.def.code} — {s.def.name}
                      </div>
                      <div className="text-[0.72rem] text-muted">{s.def.description}</div>
                    </td>
                    <td className="num">
                      {formatRpCompact(s.fundingGapNominal)}
                      {s.def.code !== "A" ? <Delta v={s.fundingGapNominal - base.fundingGapNominal} bad /> : null}
                    </td>
                    <td className="num">
                      {formatRpCompact(s.requiredMonthly)}
                      {s.def.code !== "A" ? <Delta v={s.requiredMonthly - base.requiredMonthly} bad /> : null}
                    </td>
                    <td className="num">{formatRpCompact(s.retirementAvailable)}</td>
                    <td className="num">{formatPct(s.retirementReadiness, 0)}</td>
                    <td className="num">{formatRpCompact(s.minFcf)}</td>
                    <td className="num">{s.deficitYears}</td>
                    <td className="num">{formatRpCompact(s.netWorthAtRetirement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard className="lg:col-span-2" title="Funding gap per skenario" subtitle="Base case disorot; skenario lain untuk konteks.">
          <HBars data={out.sc.map((s) => ({ label: `${s.def.code} ${s.def.name}`, value: s.fundingGapNominal }))} fmt={formatRpCompact} emphasize={`A ${base.def.name}`} />
        </ChartCard>
        <Card className="lg:col-span-3">
          <CardHeader title="Biaya menunda menabung" subtitle="Investasi bulanan yang dibutuhkan bila mulai lebih lambat (pertanyaan 13)." />
          <CardBody>
            <DataTable
              spec={{
                columns: [
                  { key: "d", label: "Mulai menabung" },
                  { key: "m", label: "Per bulan", numeric: true },
                  { key: "u", label: "Tunai sebelum mulai", numeric: true },
                  { key: "b", label: "Penentu setoran" },
                  { key: "s", label: "Sisa di akhir", numeric: true },
                ],
                rows: out.delay.map((d) => ({
                  d: d.delayYears === 0 ? "Bulan depan" : `${d.delayYears} tahun lagi`,
                  m: formatRp(d.monthly),
                  u: d.unreachable ? formatRpCompact(d.unreachable) : "—",
                  b: d.bindingAy !== null ? ayLabel(d.bindingAy) : "—",
                  s: formatRpCompact(d.surplus),
                })),
              }}
            />
            <p className="mt-2 text-[0.75rem] text-muted">
              Per bulan = setoran minimum agar setiap pembayaran setelah setoran pertama tertutup. Pembayaran sebelum setoran pertama yang tidak tertutup dana saat ini harus dibayar tunai dan tidak dibebankan ke setoran — karena itu angka per bulan bisa turun bila pembayaran besar jatuh sebelum mulai. Setoran ditentukan pembayaran tersulit (“penentu”); tahun-tahun sesudahnya bisa berlebih (“sisa di akhir”, nominal) — hitung ulang tiap tahun untuk menyesuaikan. Biaya nyata menunda: beban bulanan lebih tinggi dan kebutuhan tunai di depan.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Delta({ v, bad }: { v: number; bad?: boolean }) {
  if (Math.abs(v) < 1) return null;
  const worse = bad ? v > 0 : v < 0;
  return (
    <div className={`text-[0.7rem] ${worse ? "text-critical" : "text-good-ink"}`}>
      {v > 0 ? "+" : "−"}
      {formatRpCompact(Math.abs(v))}
    </div>
  );
}

function SensitivityTab() {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const grid = useDeferredCompute(() => sensitivityGrid(household, db, a), [household, db, a]);
  if (!grid) return <p className="text-[0.85rem] text-ink-2">Menghitung matriks…</p>;
  const baseInf = grid.inflations.find((x) => Math.abs(x - a.inflation.education) < 1e-9);
  const baseRet = grid.returns.find((x) => Math.abs(x - a.returns.education) < 1e-9);
  return (
    <ChartCard
      title="Sensitivity analysis — required monthly investment"
      subtitle="Baris: inflasi biaya pendidikan (diterapkan ke semua jenis sekolah). Kolom: return investasi. Sel bertanda base = asumsi Anda bila tepat di grid."
      table={{
        columns: [{ key: "i", label: "Inflasi \\ Return" }, ...grid.returns.map((r) => ({ key: String(r), label: formatPct(r, 0), numeric: true }))],
        rows: grid.inflations.map((inf, i) => ({ i: formatPct(inf, 0), ...Object.fromEntries(grid.returns.map((r, j) => [String(r), formatRp(grid.values[i][j])])) })),
      }}
    >
      <SensitivityHeatmap inflations={grid.inflations} returns={grid.returns} values={grid.values} base={baseInf !== undefined && baseRet !== undefined ? { inflation: baseInf, ret: baseRet } : undefined} />
    </ChartCard>
  );
}

function TradeoffTab() {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const c = useChartColors();
  const t = useDeferredCompute(() => tradeoff(household, db, a), [household, db, a]);
  if (!t) return <p className="text-[0.85rem] text-ink-2">Menghitung trade-off…</p>;
  const data = t.strategies.map((s) => ({ k: s.label.replace("Prioritize", "Prioritas").replace("Balanced Education + Retirement", "Seimbang"), edu: Math.round(Math.min(2, s.eduFundedRatio) * 100), ret: Math.round(Math.min(2, s.retReadiness) * 100) }));
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Retirement vs education trade-off"
          subtitle={`Anggaran investasi ${formatRp(t.budget)}/bulan (${t.budgetSource === "planned" ? "rencana pendidikan + pensiun Anda" : t.budgetSource === "capacity" ? "kapasitas menabung saat ini" : "belum ada"}). Kebutuhan: pendidikan ${formatRp(t.eduRequired)}, pensiun ${formatRp(t.retRequired)} per bulan.`}
        />
        <CardBody className="flex flex-col gap-3">
          {t.bothFundable ? (
            <StatusPill tone="good">Anggaran cukup untuk kedua tujuan — ketiga strategi mendanai penuh.</StatusPill>
          ) : (
            <StatusPill tone="warning">Anggaran belum cukup untuk kedua tujuan — pilihan alokasi menentukan tujuan mana yang kurang.</StatusPill>
          )}
          <div className="scroll-x rounded-lg border border-line">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Strategi</th>
                  <th className="num">Pendidikan/bln</th>
                  <th className="num">Pensiun/bln</th>
                  <th className="num">Funded ratio pendidikan</th>
                  <th className="num">Funding gap pendidikan</th>
                  <th className="num">Kesiapan pensiun</th>
                  <th className="num">Gap dana pensiun</th>
                  <th className="num">Net worth saat pensiun</th>
                </tr>
              </thead>
              <tbody>
                {t.strategies.map((s) => (
                  <tr key={s.key}>
                    <td className="font-medium">{s.label}</td>
                    <td className="num">{formatRpCompact(s.eduMonthly)}</td>
                    <td className="num">{formatRpCompact(s.retMonthly)}</td>
                    <td className="num">{formatPct(s.eduFundedRatio, 0)}</td>
                    <td className="num">{formatRpCompact(s.eduGapNominal)}</td>
                    <td className="num">{formatPct(s.retReadiness, 0)}</td>
                    <td className="num">{formatRpCompact(s.retGap)}</td>
                    <td className="num">{formatRpCompact(s.netWorthAtRetirement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[0.75rem] text-muted">
            Tujuannya melihat konsekuensi pilihan, bukan sekadar “menabung lebih banyak”. Kesiapan pensiun memasukkan investasi umum & kas di atas dana darurat pada usia pensiun.
          </p>
        </CardBody>
      </Card>
      <ChartCard
        title="Tingkat pendanaan per strategi"
        legend={[
          { label: "Pendidikan (funded ratio)", color: c["--series-1"] },
          { label: "Pensiun (kesiapan)", color: c["--series-2"] },
        ]}
        table={{ columns: [{ key: "k", label: "Strategi" }, { key: "edu", label: "Pendidikan %", numeric: true }, { key: "ret", label: "Pensiun %", numeric: true }], rows: data.map((d) => ({ ...d, edu: `${d.edu}%`, ret: `${d.ret}%` })) }}
      >
        <GroupedBars data={data} />
      </ChartCard>
    </div>
  );
}

function GroupedBars({ data }: { data: { k: string; edu: number; ret: number }[] }) {
  const c = useChartColors();
  const max = Math.max(100, ...data.flatMap((d) => [d.edu, d.ret]));
  return (
    <div className="flex flex-col gap-4">
      {data.map((d) => (
        <div key={d.k} className="flex flex-col gap-1">
          <div className="text-[0.8rem] font-medium">{d.k}</div>
          {(["edu", "ret"] as const).map((key) => (
            <div key={key} className="grid grid-cols-[1fr_3.5rem] items-center gap-2">
              <div className="relative h-3 w-full rounded-r-[4px]">
                <div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(d[key] / max) * 100}%`, background: key === "edu" ? c["--series-1"] : c["--series-2"] }} />
                <div className="absolute inset-y-[-3px] w-px" style={{ left: `${(100 / max) * 100}%`, background: c["--axis"] }} aria-hidden />
              </div>
              <span className="tnum text-right text-[0.78rem]">{d[key]}%</span>
            </div>
          ))}
        </div>
      ))}
      <p className="text-[0.72rem] text-muted">Garis vertikal = 100% (terdanai penuh). Nilai di atas 200% dipotong pada tampilan.</p>
    </div>
  );
}

function RecommendTab() {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const [childId, setChildId] = useState(household.children[0]?.id ?? "");
  const child = household.children.find((c) => c.id === childId);
  const levels = child ? levelSequence(child) : [];
  const [level, setLevel] = useState<Level | "">("");
  const lvl = (
    level && levels.includes(level) ? level : (child && nextEntryLevel(child, a, academicYearOf(a.planDate))) || levels.find((l) => l !== "TK")
  ) as Level | undefined;
  const rec = useDeferredCompute(() => (child && lvl ? recommendOptions(household, db, a, child.id, lvl) : null), [household, db, a, childId, lvl]);
  if (!household.children.length) return <p className="text-[0.85rem] text-ink-2">Tambahkan anak untuk melihat rekomendasi.</p>;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Anak">
            <Select value={childId} onChange={setChildId} options={household.children.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Jenjang">
            <Select value={lvl ?? ""} onChange={(v) => setLevel(v as Level)} options={levels.map((l) => ({ value: l, label: l }))} />
          </Field>
        </CardBody>
      </Card>
      {!rec ? (
        <p className="text-[0.85rem] text-ink-2">Menyusun opsi…</p>
      ) : rec.options.length === 0 ? (
        <p className="text-[0.85rem] text-ink-2">{rec.note}</p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {rec.options.map((o) => (
              <Card key={o.key}>
                <CardHeader title={o.title} subtitle={o.rationale} />
                <CardBody className="flex flex-col gap-2 text-[0.82rem]">
                  <Link href={`/schools/?id=${o.row.school.id}`} className="text-[0.95rem] font-semibold hover:underline">
                    {o.row.school.name}
                  </Link>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <dt className="text-muted">Total {lvl}</dt>
                    <dd className="tnum text-right">{formatRpCompact(o.row.levelTotalNominal)}</dd>
                    <dt className="text-muted">Investasi/bln</dt>
                    <dd className="tnum text-right">{formatRpCompact(o.row.requiredMonthly)}</dd>
                    <dt className="text-muted">Funded ratio</dt>
                    <dd className="tnum text-right">{formatPct(o.row.fundedRatio, 0)}</dd>
                    <dt className="text-muted">Puncak beban</dt>
                    <dd className="tnum text-right">{formatPct(o.row.peakRatio)}</dd>
                    <dt className="text-muted">Kesiapan pensiun</dt>
                    <dd className="tnum text-right">{formatPct(o.row.retirementReadiness, 0)}</dd>
                    <dt className="text-muted">Affordability score</dt>
                    <dd className="tnum text-right font-semibold">{o.row.score.score}</dd>
                  </dl>
                </CardBody>
              </Card>
            ))}
          </div>
          <p className="text-[0.78rem] text-ink-2">
            {rec.note} Kandidat: {rec.candidates} sekolah dengan data biaya {lvl} di {child?.educationLocation || household.homeCity}.
          </p>
        </>
      )}
    </div>
  );
}

function InflationTab() {
  const a = useAssumptions();
  const setAssumptions = useStore((s) => s.setAssumptions);
  const plan = usePlan();
  const series = REFERENCES.inflationSeries.filter((s) => s.series.includes("national"));
  const years = [...new Set(series.map((s) => s.period))].sort();
  const val = (name: string, p: string) => series.find((s) => s.series === name && s.period === p);
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Education inflation engine" subtitle="Inflasi terpisah per jenis biaya. Future Cost = Current Cost × (1 + inflasi)^n." />
        <CardBody className="grid gap-3 sm:grid-cols-5">
          {(Object.keys(INFLATION_LABEL) as InflationKey[]).map((k) => (
            <Field key={k} label={INFLATION_LABEL[k]}>
              <PercentInput value={a.inflation[k]} onChange={(v) => setAssumptions({ inflation: { ...a.inflation, [k]: v } })} min={-5} max={30} ariaLabel={INFLATION_LABEL[k]} />
            </Field>
          ))}
        </CardBody>
        <CardBody>
          <ul className="space-y-1.5 text-[0.78rem] text-ink-2">
            {ASSUMPTION_NOTES.map((n) => (
              <li key={n.key}>• {n.text}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Real vs nominal return" action={<ExplainButton explain={plan.realReturns.explain} compact />} />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Stat label="Nominal return (dana pendidikan)" value={formatPct(plan.realReturns.nominal)} />
          <Stat label="Real return vs inflasi umum" value={formatPct(plan.realReturns.realVsGeneral, 2)} />
          <Stat label="Real return vs inflasi pendidikan" value={formatPct(plan.realReturns.realVsEducation, 2)} tone={plan.realReturns.realVsEducation < 0 ? "critical" : undefined} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Data referensi inflasi (nasional, Desember yoy)" subtitle="Headline: Bank Indonesia. Kelompok Pendidikan: media yang mengutip BPS. Bukan asumsi aplikasi — hanya pembanding." />
        <CardBody>
          <DataTable
            spec={{
              columns: [
                { key: "p", label: "Periode" },
                { key: "h", label: "Inflasi umum", numeric: true },
                { key: "e", label: "Kelompok pendidikan", numeric: true },
                { key: "s", label: "Sumber" },
              ],
              rows: years.map((p) => {
                const h = val("headline_cpi_national", p);
                const e = val("education_group_national", p);
                return {
                  p,
                  h: h ? `${h.valuePct.toLocaleString("id-ID")}%` : "—",
                  e: e ? `${e.valuePct.toLocaleString("id-ID")}%` : "—",
                  s: (
                    <span className="flex flex-col gap-0.5">
                      {h ? (
                        <a className="text-accent-ink hover:underline" href={h.source.url} target="_blank" rel="noopener noreferrer">
                          {h.source.publisher ?? "Sumber"}
                        </a>
                      ) : null}
                      {e ? (
                        <a className="text-accent-ink hover:underline" href={e.source.url} target="_blank" rel="noopener noreferrer">
                          {e.source.publisher ?? "Sumber"}
                        </a>
                      ) : null}
                    </span>
                  ),
                };
              }),
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export function PlanningPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "cost";
  const tabs: { value: Tab; label: string }[] = useMemo(
    () => [
      { value: "cost", label: "Biaya" },
      { value: "funding", label: "Funding" },
      { value: "scenarios", label: "Skenario" },
      { value: "sensitivity", label: "Sensitivitas" },
      { value: "tradeoff", label: "Pensiun vs pendidikan" },
      { value: "recommend", label: "Rekomendasi" },
      { value: "inflation", label: "Inflasi" },
    ],
    [],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Planning" subtitle="School Cost → Future Cost → Cash Flow → Funding Gap → Required Investment → Financial Decision." />
      <Tabs tabs={tabs} value={tab} onChange={(v) => router.replace(`/planning/?tab=${v}`, { scroll: false })} className="no-print" />
      {tab === "cost" ? <CostTab /> : null}
      {tab === "funding" ? <FundingTab /> : null}
      {tab === "scenarios" ? <ScenariosTab /> : null}
      {tab === "sensitivity" ? <SensitivityTab /> : null}
      {tab === "tradeoff" ? <TradeoffTab /> : null}
      {tab === "recommend" ? <RecommendTab /> : null}
      {tab === "inflation" ? <InflationTab /> : null}
    </div>
  );
}
