"use client";

import { ArrowRight, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BAND_LABEL, BAND_TONE } from "@/lib/engine/affordability";
import type { AlertSeverity } from "@/lib/engine/alerts";
import { FUNDING_STATUS_LABEL } from "@/lib/engine/funding";
import { formatNumber, formatPct, formatRp, formatRpCompact, formatRpWords } from "@/lib/format";
import { useAlerts, usePlan } from "@/lib/hooks";
import { loadDemoHousehold } from "@/lib/demo";
import { useStore } from "@/lib/store";
import { childColorVar } from "@/lib/ui-helpers";
import { ChartCard, StackedBars, useChartColors } from "../charts";
import { ExplainButton } from "../Explain";
import { EducationHeatmap } from "../heatmaps";
import { Button, Card, CardBody, CardHeader, Stat, StatusPill, ToneIcon, type Tone } from "../ui";

const SEVERITY_TONE: Record<AlertSeverity, Tone> = { critical: "critical", warning: "warning", info: "info", good: "good" };

function Welcome() {
  const loadDemo = () => loadDemoHousehold();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-page">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Sekolah mana yang bisa Anda pilih tanpa merusak kesehatan keuangan keluarga dan target pensiun?
          </h1>
          <p className="text-[0.95rem] text-ink-2">
            EduFin Planner mengubah data biaya sekolah menjadi keputusan: biaya saat ini → biaya masa depan → arus kas → funding gap →
            investasi yang dibutuhkan → trade-off dengan dana pensiun. Setiap angka bisa dibuka rumus, asumsi, dan sumber datanya.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/onboarding/" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[0.875rem] font-medium text-white hover:brightness-110">
              Mulai profil keluarga <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Button onClick={loadDemo}>
              <Sparkles className="h-4 w-4" aria-hidden /> Coba dengan keluarga contoh
            </Button>
            <Link href="/schools/" className="inline-flex h-10 items-center rounded-[10px] px-4 text-[0.875rem] font-medium text-ink-2 hover:bg-card-2">
              Lihat database sekolah
            </Link>
          </div>
          <p className="text-[0.75rem] text-muted">
            Keluarga contoh memakai data fiktif (bukan data pribadi siapa pun) dan sekolah dari database. Data Anda tersimpan di browser ini kecuali Anda masuk ke akun cloud.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const household = useStore((s) => s.household);
  const onboarded = useStore((s) => s.onboarded);
  const plan = usePlan();
  const alerts = useAlerts(plan);
  const c = useChartColors();

  const chart = useMemo(() => {
    const kids = plan.children.map((cr, i) => ({ id: cr.child.id, name: cr.child.name || `Anak ${i + 1}`, color: c[childColorVar(cr.child, i) as keyof typeof c] }));
    const data = plan.years.map((y) => {
      const row: Record<string, number | string> = { ay: `${y.ay}/${String((y.ay + 1) % 100).padStart(2, "0")}` };
      for (const k of kids) row[k.id] = Math.round(y.byChild[k.id] ?? 0);
      return row;
    });
    return { kids, data };
  }, [plan, c]);

  if (!onboarded && household.children.length === 0 && household.primary.monthlyIncome === 0) return <Welcome />;

  const f = plan.funding;
  const h = plan.health;
  const statusTone: Tone = f.status === "fully_funded" ? "good" : f.status === "partially_funded" ? "warning" : "critical";
  const peak = plan.affordability.peak;
  const r = plan.cashflow.retirement;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Dashboard rencana pendidikan keluarga</h1>
      {/* Hero */}
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone}>{FUNDING_STATUS_LABEL[f.status]}</StatusPill>
              <span className="text-[0.8rem] text-ink-2">
                {household.familyName ? `Keluarga ${household.familyName}` : "Rencana keluarga"} · {plan.children.length} anak · TA berjalan {plan.currentAy}/{plan.currentAy + 1}
              </span>
            </div>
            <p className="text-[0.85rem] text-ink-2">{f.status === "fully_funded" ? "Kebutuhan dana pendidikan tertutup rencana saat ini" : "Education funding gap (nominal)"}</p>
            <p className="text-[2.6rem] font-semibold leading-none tracking-tight sm:text-[3.2rem]">
              {f.status === "fully_funded" ? formatRpWords(f.requirementNominal) : formatRpWords(f.gapNominal)}
            </p>
            <p className="mt-2 text-[0.85rem] text-ink-2">
              {f.status === "fully_funded"
                ? `Total kebutuhan ${plan.withdrawals.length} tahun ajaran mendatang.`
                : `dari kebutuhan ${formatRpWords(f.requirementNominal)} · butuh investasi ${formatRp(f.required.monthlyEquivalent)}/bulan (rencana ${formatRp(f.plannedMonthly)}/bulan)`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ExplainButton explain={f.explains.gap} label="Cara hitung gap" />
            <Link href="/planning/" className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-line-strong px-3 text-[0.8rem] font-medium hover:bg-card-2">
              Detail rencana <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        {/* Decision pipeline (core product principle) */}
        <div className="scroll-x border-t border-line">
          <ol className="flex min-w-max divide-x divide-[var(--line)] text-[0.75rem]">
            {[
              { k: "School cost (harga hari ini)", v: formatRpCompact(plan.totals.todayPrice) },
              { k: "Future cost (nominal)", v: formatRpCompact(plan.totals.future) },
              { k: "Cash flow bebas / bulan", v: formatRpCompact(h.savingsCapacity) },
              { k: "Funding gap", v: formatRpCompact(f.gapNominal) },
              { k: "Required investment", v: `${formatRpCompact(f.required.monthlyEquivalent)}/bln` },
              { k: "Kesiapan pensiun", v: formatPct(r.readiness, 0) },
            ].map((s, i) => (
              <li key={s.k} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-muted">
                  {i + 1}. {s.k}
                </span>
                <span className="tnum text-[0.95rem] font-semibold text-ink">{s.v}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* Key alerts */}
      {alerts.length ? (
        <Card>
          <CardHeader title="Key alerts" subtitle="Diurutkan dari risiko tertinggi. Buka untuk detail." />
          <CardBody>
            <ul className="flex flex-col divide-y divide-[var(--line)]">
              {alerts.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link href={a.href ?? "/"} className="flex items-start gap-3 py-2.5 hover:opacity-80">
                    <ToneIcon tone={SEVERITY_TONE[a.severity]} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[0.875rem] font-medium text-ink">{a.title}</span>
                      {a.detail ? <span className="block text-[0.78rem] text-ink-2">{a.detail}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* Education KPIs */}
      <section aria-label="Education" className="flex flex-col gap-2">
        <h2 className="px-1 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Education</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Total education requirement" value={formatRpCompact(f.requirementNominal)} sub={`PV ${formatRpCompact(f.requirementPv)}`} action={<ExplainButton explain={f.explains.requirement} compact />} />
          <Stat label="Current education fund" value={formatRpCompact(f.currentFund)} sub="Aset berlabel dana pendidikan" />
          <Stat label="Projected education fund" value={formatRpCompact(f.coveredByCurrentFund + f.coveredByContributions)} sub="Biaya yang tertutup dana + investasi" action={<ExplainButton explain={f.explains.ratio} compact />} />
          <Stat label="Funding gap" value={formatRpCompact(f.gapNominal)} tone={statusTone} sub={FUNDING_STATUS_LABEL[f.status]} action={<ExplainButton explain={f.explains.gap} compact />} />
          <Stat
            label="Required monthly investment"
            value={formatRpCompact(f.required.monthlyEquivalent)}
            sub={`Rencana ${formatRpCompact(f.plannedMonthly)}/bln`}
            action={<ExplainButton explain={f.explains.required} compact />}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>

      {/* Family financial health */}
      <section aria-label="Family financial health" className="flex flex-col gap-2">
        <h2 className="px-1 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Family financial health</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Net worth" value={formatRpCompact(h.netWorth)} sub={`Aset ${formatRpCompact(h.totalAssets)} · utang ${formatRpCompact(h.totalLiabilities)}`} />
          <Stat label="Income / bulan" value={formatRpCompact(h.monthlyIncome)} sub="Termasuk bonus/THR disetahunkan" />
          <Stat label="Expense / bulan" value={formatRpCompact(h.monthlyExpensesTotal)} sub={`Hidup ${formatRpCompact(h.monthlyLiving)} · sekolah ${formatRpCompact(h.monthlyEducationNow)}`} />
          <Stat label="Debt service / bulan" value={formatRpCompact(h.monthlyDebt)} sub={`DSR ${formatPct(h.debtToIncome, 0)}`} tone={h.debtToIncome > 0.35 ? "warning" : undefined} />
          <Stat label="Savings rate" value={formatPct(h.savingsRate, 0)} sub={`Kapasitas ${formatRpCompact(h.savingsCapacity)}/bln`} tone={h.savingsRate < 0 ? "critical" : undefined} />
          <Stat
            label="Emergency fund"
            value={Number.isFinite(h.emergencyMonths) ? `${formatNumber(h.emergencyMonths, 1)} bln` : "—"}
            sub={`Target ${h.emergencyTargetMonths} bln · ${formatRpCompact(h.emergencyFund)}`}
            tone={h.emergencyMonths >= h.emergencyTargetMonths ? "good" : "warning"}
          />
          <Stat label="Education fund" value={formatRpCompact(h.educationFund)} />
          <Stat
            label="Retirement fund"
            value={formatRpCompact(h.retirementFund)}
            sub={`Kesiapan ${formatPct(r.readiness, 0)} saat usia ${household.primary.targetRetirementAge}`}
            tone={r.readiness >= 1 ? "good" : r.readiness >= 0.6 ? "warning" : "critical"}
            action={<ExplainButton explain={r.explain} compact />}
          />
        </div>
      </section>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Biaya pendidikan per tahun ajaran"
          subtitle={
            peak
              ? `Nominal, semua anak. Puncak beban ${formatPct(peak.ratio)} dari pendapatan pada TA ${peak.ay}/${peak.ay + 1} (${BAND_LABEL[peak.band]}).`
              : "Nominal, semua anak."
          }
          legend={chart.kids.map((k) => ({ label: k.name, color: k.color }))}
          table={{
            columns: [{ key: "ay", label: "TA" }, ...chart.kids.map((k) => ({ key: k.id, label: k.name, numeric: true })), { key: "total", label: "Total", numeric: true }],
            rows: chart.data.map((d) => ({
              ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "number" ? formatRp(v) : v])),
              total: formatRp(chart.kids.reduce((s, k) => s + Number(d[k.id] ?? 0), 0)),
            })),
          }}
          footer={peak ? <StatusPill tone={BAND_TONE[peak.band]}>Affordability puncak: {BAND_LABEL[peak.band]}</StatusPill> : null}
        >
          {chart.data.length ? (
            <StackedBars data={chart.data} xKey="ay" series={chart.kids.map((k) => ({ key: k.id, label: k.name, color: k.color }))} highlightX={peak ? `${peak.ay}/${String((peak.ay + 1) % 100).padStart(2, "0")}` : undefined} />
          ) : (
            <p className="py-10 text-center text-[0.85rem] text-ink-2">Tambahkan anak untuk melihat proyeksi.</p>
          )}
        </ChartCard>
        <Card className="lg:col-span-2">
          <CardHeader title="Saving scenarios" subtitle="Investasi bulanan yang dibutuhkan pada 3 asumsi return (bukan jaminan)." />
          <CardBody>
            <ul className="flex flex-col gap-3">
              {plan.savingScenarios.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-[0.875rem] font-medium">{s.label}</span>
                    <span className="block text-[0.75rem] text-muted">Return {formatPct(s.rate)} / tahun</span>
                  </span>
                  <span className="tnum text-[1rem] font-semibold">{formatRp(s.monthly)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-card-2 p-3 text-[0.78rem] text-ink-2">
              Return riil dana pendidikan: {formatPct(plan.realReturns.realVsGeneral, 2)} vs inflasi umum, {formatPct(plan.realReturns.realVsEducation, 2)} vs inflasi pendidikan.{" "}
              <ExplainButton explain={plan.realReturns.explain} label="Rumus" />
            </div>
          </CardBody>
        </Card>
      </div>

      <ChartCard title="Education expense heatmap" subtitle="Tahun × anak × jenjang × biaya tahunan — lihat tahun dengan beban tertinggi.">
        <EducationHeatmap years={plan.years} kids={chart.kids} currentAy={plan.currentAy} />
      </ChartCard>

      {plan.warnings.length ? (
        <Card>
          <CardHeader title="Catatan data" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-[0.8rem] text-ink-2">
              {plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
