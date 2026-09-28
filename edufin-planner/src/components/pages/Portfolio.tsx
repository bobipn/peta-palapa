"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { horizonBuckets, ILLUSTRATIVE_ALLOCATION, PROFILE_LABEL, RISK_QUESTIONS, scoreRisk, suggestedAnswers } from "@/lib/engine/risk";
import type { RiskAnswers } from "@/lib/engine/types";
import { formatNumber, formatPct, formatRp, formatRpCompact } from "@/lib/format";
import { usePlan } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { ChartCard, DataTable, Lines, SignedBars, StackedBars, useChartColors } from "../charts";
import { ExplainButton } from "../Explain";
import { AssetEditor, ExpenseEditor, LiabilityEditor, PersonForm } from "../forms";
import { Button, Card, CardBody, CardHeader, Field, MoneyInput, PageHeader, PercentInput, Stat, StatusPill, Tabs, Toggle } from "../ui";

type Tab = "networth" | "cashflow" | "balance" | "risk" | "retirement";

function NetWorthTab() {
  const plan = usePlan();
  const age0 = useStore((s) => s.household.primary.age);
  const c = useChartColors();
  const rows = plan.cashflow.rows;
  const retAy = plan.cashflow.retirement.retirementAy;
  const data = [{ age: String(age0), nw: Math.round(plan.cashflow.startNetWorth) }, ...rows.map((r) => ({ age: String(r.agePrimary + 1), nw: Math.round(r.netWorth) }))];
  const edu = rows.filter((r) => !r.partial && r.educationCost > 0).map((r) => ({ age: String(r.agePrimary), edu: Math.round(r.educationCost) }));
  const toRetirement = rows.filter((r) => r.ay <= retAy);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net worth hari ini" value={formatRpCompact(plan.health.netWorth)} />
        <Stat label="Total aset" value={formatRpCompact(plan.health.totalAssets)} />
        <Stat label="Total utang" value={formatRpCompact(plan.health.totalLiabilities)} />
        <Stat label="Net worth saat pensiun" value={formatRpCompact(rows.find((r) => r.ay === retAy)?.netWorth ?? 0)} sub={`TA ${retAy}/${retAy + 1}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Net worth vs age" subtitle="Usia kepala keluarga di akhir tiap tahun ajaran (nominal)." table={{ columns: [{ key: "age", label: "Usia" }, { key: "nw", label: "Net worth", numeric: true }], rows: data.map((d) => ({ age: d.age, nw: formatRp(d.nw) })) }}>
          <Lines data={data} xKey="age" series={[{ key: "nw", label: "Net worth", color: c["--series-1"] }]} area />
        </ChartCard>
        <ChartCard title="Education cost vs age" subtitle="Biaya pendidikan semua anak per tahun ajaran." table={{ columns: [{ key: "age", label: "Usia" }, { key: "edu", label: "Biaya pendidikan", numeric: true }], rows: edu.map((d) => ({ age: d.age, edu: formatRp(d.edu) })) }}>
          <StackedBars data={edu} xKey="age" series={[{ key: "edu", label: "Biaya pendidikan", color: c["--series-1"] }]} />
        </ChartCard>
      </div>
      <Card>
        <CardHeader title="Net worth projection" subtitle="Sampai usia pensiun. Semua nilai nominal akhir tahun ajaran." />
        <CardBody>
          <DataTable
            spec={{
              columns: [
                { key: "ay", label: "TA" },
                { key: "age", label: "Usia", numeric: true },
                { key: "inc", label: "Income", numeric: true },
                { key: "exp", label: "Expenses", numeric: true },
                { key: "edu", label: "Education", numeric: true },
                { key: "debt", label: "Debt service", numeric: true },
                { key: "inv", label: "Investments", numeric: true },
                { key: "assets", label: "Assets", numeric: true },
                { key: "liab", label: "Liabilities", numeric: true },
                { key: "nw", label: "Net worth", numeric: true },
              ],
              rows: toRetirement.map((r) => ({
                ay: r.label + (r.partial ? "*" : ""),
                age: r.agePrimary,
                inc: formatRpCompact(r.income),
                exp: formatRpCompact(r.livingExpenses),
                edu: formatRpCompact(r.educationCost),
                debt: formatRpCompact(r.debtService),
                inv: formatRpCompact(r.endInvestable),
                assets: formatRpCompact(r.totalAssets),
                liab: formatRpCompact(r.liabilities),
                nw: formatRpCompact(r.netWorth),
              })),
            }}
            maxHeight={420}
          />
          <p className="mt-2 text-[0.72rem] text-muted">* TA berjalan: sisa bulan sampai Juni. Investments = kas + dana pendidikan + dana pensiun + investasi umum.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function CashflowTab({ newExpense }: { newExpense: boolean }) {
  const plan = usePlan();
  const rows = plan.cashflow.rows;
  const a = useStore((s) => s.assumptions);
  const setAssumptions = useStore((s) => s.setAssumptions);
  const fcf = rows.filter((r) => !r.partial).map((r) => ({ ay: r.label, fcf: Math.round(r.fcf - r.eduContribution - r.retContribution) }));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pendapatan / bulan" value={formatRpCompact(plan.health.monthlyIncome)} />
        <Stat label="Pengeluaran hidup / bulan" value={formatRpCompact(plan.health.monthlyLiving)} />
        <Stat label="Cicilan / bulan" value={formatRpCompact(plan.health.monthlyDebt)} />
        <Stat label="Kapasitas menabung / bulan" value={formatRpCompact(plan.health.savingsCapacity)} tone={plan.health.savingsCapacity < 0 ? "critical" : undefined} sub={`Rencana investasi ${formatRpCompact(plan.funding.plannedMonthly + plan.retMonthly)}/bln`} />
      </div>
      <Card>
        <CardHeader title="Pengeluaran rumah tangga" />
        <CardBody>
          <ExpenseEditor autoFocusNew={newExpense} />
        </CardBody>
      </Card>
      <ChartCard
        title="Surplus setelah investasi terencana"
        subtitle="FCF − setoran pendidikan − setoran pensiun per tahun ajaran. Negatif = menarik tabungan/investasi."
        table={{ columns: [{ key: "ay", label: "TA" }, { key: "fcf", label: "Surplus", numeric: true }], rows: fcf.map((x) => ({ ay: x.ay, fcf: formatRp(x.fcf) })) }}
      >
        <SignedBars data={fcf} xKey="ay" yKey="fcf" label="Surplus" />
      </ChartCard>
      <Card>
        <CardHeader title="Cash flow engine (≥30 tahun)" subtitle="Free Cash Flow + Investment Return − Education Withdrawal = perubahan portofolio. Nominal per tahun ajaran." />
        <CardBody className="flex flex-col gap-3">
          <Toggle
            checked={a.surplusInvestShare > 0}
            onChange={(v) => setAssumptions({ surplusInvestShare: v ? 1 : 0 })}
            label="Surplus yang tidak dialokasikan diinvestasikan ke portofolio umum (jika tidak, disimpan sebagai kas)"
          />
          <DataTable
            maxHeight={480}
            spec={{
              columns: [
                { key: "ay", label: "TA" },
                { key: "age", label: "Usia", numeric: true },
                { key: "inc", label: "Income", numeric: true },
                { key: "liv", label: "Living", numeric: true },
                { key: "debt", label: "Debt", numeric: true },
                { key: "eduCF", label: "Edu dari kas", numeric: true },
                { key: "fcf", label: "FCF", numeric: true },
                { key: "ret", label: "Investment return", numeric: true },
                { key: "wd", label: "Edu withdrawal", numeric: true },
                { key: "end", label: "Ending portfolio", numeric: true },
                { key: "flag", label: "Catatan" },
              ],
              rows: rows.map((r) => ({
                ay: r.label + (r.partial ? "*" : ""),
                age: r.agePrimary,
                inc: formatRpCompact(r.income),
                liv: formatRpCompact(r.livingExpenses),
                debt: formatRpCompact(r.debtService),
                eduCF: formatRpCompact(r.educationFromCashflow),
                fcf: formatRpCompact(r.fcf),
                ret: formatRpCompact(r.investmentReturn),
                wd: formatRpCompact(r.educationFromFund),
                end: formatRpCompact(r.endInvestable),
                flag: r.flags
                  .map((f) => ({ deficit: "defisit", retirement_raid: "tarik dana pensiun", education_raid: "tarik dana pendidikan", unfunded: "tidak terdanai" })[f])
                  .join(", "),
              })),
            }}
          />
          <p className="text-[0.72rem] text-muted">
            Asumsi: gaji & harga naik per tahun ajaran; penghasilan kerja berhenti di target usia pensiun; pengeluaran saat pensiun {formatPct(a.retirementExpenseRatio, 0)} dari sebelumnya; defisit ditarik dari kas → investasi umum → dana pensiun → dana pendidikan.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function BalanceTab({ newAsset }: { newAsset: boolean }) {
  const household = useStore((s) => s.household);
  const updatePerson = useStore((s) => s.updatePerson);
  const setSpouse = useStore((s) => s.setSpouse);
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Aset" subtitle="Termasuk dana pendidikan, dana pensiun, investasi, properti." />
        <CardBody>
          <AssetEditor autoFocusNew={newAsset} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Utang" />
        <CardBody>
          <LiabilityEditor />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Penghasilan" subtitle="Profil orang tua ada juga di onboarding." />
        <CardBody className="flex flex-col gap-5">
          <PersonForm person={household.primary} onChange={(p) => updatePerson("primary", p)} title="Orang tua 1" />
          <Toggle checked={!!household.spouse} onChange={setSpouse} label="Ada pasangan (spouse)" />
          {household.spouse ? <PersonForm person={household.spouse} onChange={(p) => updatePerson("spouse", p)} title="Pasangan" /> : null}
        </CardBody>
      </Card>
    </div>
  );
}

function RiskTab() {
  const plan = usePlan();
  const answers = useStore((s) => s.household.riskAnswers) ?? {};
  const setAnswers = useStore((s) => s.setRiskAnswers);
  const a = useStore((s) => s.assumptions);
  const setAssumptions = useStore((s) => s.setAssumptions);
  const result = scoreRisk(answers);
  const firstPayment = plan.withdrawals[0];
  const suggestions = suggestedAnswers({
    emergencyMonths: plan.health.emergencyMonths,
    debtToIncome: plan.health.debtToIncome,
    yearsToFirstMajorPayment: firstPayment ? firstPayment.month / 12 : null,
  });
  const alloc = ILLUSTRATIVE_ALLOCATION[result.profile];
  const buckets = useMemo(() => horizonBuckets(plan.withdrawals, a.returns.education), [plan.withdrawals, a.returns.education]);
  const profileReturn = a.profileReturns[result.profile];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Risk profile questionnaire" subtitle="Profil risiko hanya parameter analitis — bukan jaminan return dan bukan rekomendasi produk." />
        <CardBody className="flex flex-col gap-4">
          {RISK_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="flex flex-col gap-1.5">
              <legend className="text-[0.85rem] font-medium">
                {q.question} <span className="text-[0.72rem] font-normal text-muted">({q.dimension === "ability" ? "kemampuan" : "kesediaan"} menanggung risiko)</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => {
                  const on = answers[q.key] === o.score;
                  const suggested = suggestions[q.key as keyof RiskAnswers] === o.score;
                  return (
                    <button
                      key={o.score}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAnswers({ [q.key]: o.score })}
                      className={on ? "rounded-full bg-ink px-3 py-1.5 text-[0.78rem] font-medium text-page" : "rounded-full border border-line-strong px-3 py-1.5 text-[0.78rem] text-ink-2 hover:bg-card-2"}
                    >
                      {o.label}
                      {suggested && !on ? " · sesuai data" : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Profil: ${PROFILE_LABEL[result.profile]}`} subtitle={`${result.answered}/8 dijawab · skor ${result.totalScore}/40`} />
          <CardBody className="flex flex-col gap-3 text-[0.82rem]">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-card-2 p-3">
                <div className="text-muted">Kemampuan (ability)</div>
                <div className="font-semibold">{PROFILE_LABEL[result.ability]}</div>
                <div className="text-[0.72rem] text-muted">rata-rata {formatNumber(result.abilityAverage, 2)}</div>
              </div>
              <div className="rounded-lg bg-card-2 p-3">
                <div className="text-muted">Kesediaan (willingness)</div>
                <div className="font-semibold">{PROFILE_LABEL[result.willingness]}</div>
                <div className="text-[0.72rem] text-muted">rata-rata {formatNumber(result.willingnessAverage, 2)}</div>
              </div>
            </div>
            <p className="text-ink-2">
              {result.governedBy === "both" ? "Kemampuan dan kesediaan sejalan." : `Profil mengikuti yang lebih konservatif: ${result.governedBy === "ability" ? "kemampuan" : "kesediaan"} menanggung risiko.`}
            </p>
            <div>
              <div className="mb-1 text-muted">Ilustrasi alokasi kelas aset (analitis, bukan produk)</div>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                <span style={{ width: `${alloc.cash * 100}%`, background: "var(--seq-200)" }} />
                <span style={{ width: `${alloc.fixedIncome * 100}%`, background: "var(--seq-400)" }} />
                <span style={{ width: `${alloc.equity * 100}%`, background: "var(--seq-600)" }} />
              </div>
              <div className="mt-1 flex justify-between text-[0.72rem] text-ink-2">
                <span>Kas/pasar uang {formatPct(alloc.cash, 0)}</span>
                <span>Pendapatan tetap {formatPct(alloc.fixedIncome, 0)}</span>
                <span>Saham {formatPct(alloc.equity, 0)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-2">Asumsi return profil ini: {formatPct(profileReturn)}</span>
              <Button size="sm" onClick={() => setAssumptions({ returns: { ...a.returns, education: profileReturn } })} disabled={!result.complete}>
                Pakai sebagai return dana pendidikan
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Horizon kebutuhan dana pendidikan" subtitle="Goal-based: dana yang dibutuhkan lebih cepat umumnya ditempatkan lebih konservatif, apa pun profilnya." />
          <CardBody>
            <DataTable
              spec={{
                columns: [
                  { key: "h", label: "Horizon" },
                  { key: "n", label: "Nominal", numeric: true },
                  { key: "p", label: "PV", numeric: true },
                  { key: "x", label: "Catatan" },
                ],
                rows: buckets.map((b) => ({ h: b.label, n: formatRpCompact(b.amountNominal), p: formatRpCompact(b.amountPv), x: b.note })),
              }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function RetirementTab() {
  const plan = usePlan();
  const household = useStore((s) => s.household);
  const setHousehold = useStore((s) => s.setHousehold);
  const a = useStore((s) => s.assumptions);
  const setAssumptions = useStore((s) => s.setAssumptions);
  const r = plan.cashflow.retirement;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kebutuhan dana pensiun" value={formatRpCompact(r.requiredCorpus)} sub={`saat usia ${household.primary.targetRetirementAge} (TA ${r.retirementAy})`} action={<ExplainButton explain={r.explain} compact />} />
        <Stat label="Proyeksi dana tersedia" value={formatRpCompact(r.projectedAvailable)} sub={`dana pensiun ${formatRpCompact(r.projectedRetFund)}`} />
        <Stat label="Kesiapan" value={formatPct(r.readiness, 0)} tone={r.readiness >= 1 ? "good" : r.readiness >= 0.6 ? "warning" : "critical"} />
        <Stat label="Investasi pensiun dibutuhkan" value={`${formatRpCompact(r.requiredMonthly)}/bln`} sub={`rencana ${formatRpCompact(r.plannedMonthly)}/bln`} />
      </div>
      {r.depletionAge !== null ? <StatusPill tone="critical">Aset likuid diproyeksikan habis di usia {r.depletionAge}</StatusPill> : <StatusPill tone="good">Aset likuid bertahan sampai akhir horizon proyeksi</StatusPill>}
      <Card>
        <CardHeader title="Parameter pensiun" />
        <CardBody className="grid gap-3 sm:grid-cols-4">
          <Field label="Investasi pensiun / bulan">
            <MoneyInput value={household.retirementPlan.monthlyContribution} onChange={(v) => setHousehold((h) => ({ ...h, retirementPlan: { monthlyContribution: v } }))} ariaLabel="Investasi pensiun" />
          </Field>
          <Field label="Kebutuhan hidup saat pensiun" hint="% dari pengeluaran sebelum pensiun">
            <PercentInput value={a.retirementExpenseRatio} onChange={(v) => setAssumptions({ retirementExpenseRatio: v })} min={20} max={150} ariaLabel="Rasio kebutuhan pensiun" />
          </Field>
          <Field label="Return sebelum pensiun">
            <PercentInput value={a.returns.retirement} onChange={(v) => setAssumptions({ returns: { ...a.returns, retirement: v } })} min={0} max={30} ariaLabel="Return pensiun" />
          </Field>
          <Field label="Return setelah pensiun">
            <PercentInput value={a.returns.postRetirement} onChange={(v) => setAssumptions({ returns: { ...a.returns, postRetirement: v } })} min={0} max={30} ariaLabel="Return setelah pensiun" />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}

export function PortfolioPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "networth";
  const isNew = params.get("new");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portfolio" subtitle="Net worth, arus kas, aset & utang, profil risiko, dan kesiapan pensiun — semuanya terhubung dengan rencana pendidikan." />
      <Tabs
        className="no-print"
        tabs={[
          { value: "networth", label: "Net worth" },
          { value: "cashflow", label: "Cash flow" },
          { value: "balance", label: "Aset, utang & penghasilan" },
          { value: "risk", label: "Risk profile" },
          { value: "retirement", label: "Pensiun" },
        ]}
        value={tab}
        onChange={(v) => router.replace(`/portfolio/?tab=${v}`, { scroll: false })}
      />
      {tab === "networth" ? <NetWorthTab /> : null}
      {tab === "cashflow" ? <CashflowTab newExpense={isNew === "expense"} /> : null}
      {tab === "balance" ? <BalanceTab newAsset={isNew === "asset"} /> : null}
      {tab === "risk" ? <RiskTab /> : null}
      {tab === "retirement" ? <RetirementTab /> : null}
    </div>
  );
}
