"use client";

import { FileDown, FileSpreadsheet, Printer, Table2 } from "lucide-react";
import { useState } from "react";
import { downloadText, exportDbCsv, toCsv } from "@/lib/csv";
import { buildReport, type ReportModel } from "@/lib/report";
import { useAssumptions, useDb, useDeferredCompute } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { StatusPill, Button, Card, CardBody, PageHeader, EmptyState } from "../ui";
import { StackedBars, useChartColors } from "../charts";
import { childColorVar } from "@/lib/ui-helpers";

function Section({ s }: { s: ReportModel["sections"][number] }) {
  return (
    <section className="card print:border-0 print:shadow-none" id={s.id}>
      <div className="px-5 pb-5 pt-4">
        <h2 className="mb-2 text-[1.05rem] font-semibold">{s.title}</h2>
        {s.paragraphs.map((p, i) => (
          <p key={i} className="mb-2 text-[0.85rem] leading-relaxed text-ink-2">
            {p}
          </p>
        ))}
        {s.bullets?.length ? (
          <ul className="mb-2 list-disc space-y-1 pl-5 text-[0.85rem] text-ink-2">
            {s.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}
        {s.tables?.map((t, i) => (
          <div key={i} className="mt-3">
            {t.caption ? <div className="mb-1 text-[0.75rem] font-semibold text-muted">{t.caption}</div> : null}
            <div className="scroll-x rounded-lg border border-line">
              <table className="data-table">
                <thead>
                  <tr>
                    {t.table.columns.map((c, j) => (
                      <th key={c} className={t.table.numeric?.[j] ? "num" : undefined}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.table.rows.map((r, k) => (
                    <tr key={k}>
                      {r.map((c, j) => (
                        <td key={j} className={t.table.numeric?.[j] ? "num" : undefined}>
                          {typeof c === "string" && /^https?:\/\//.test(c) ? (
                            <a href={c} target="_blank" rel="noopener noreferrer" className="break-all text-accent-ink hover:underline">
                              {c.replace(/^https?:\/\//, "").slice(0, 48)}
                            </a>
                          ) : (
                            c
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReportPage() {
  const household = useStore((s) => s.household);
  const db = useDb();
  const a = useAssumptions();
  const c = useChartColors();
  const model = useDeferredCompute(() => buildReport(household, db, a), [household, db, a]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!household.children.length && !household.primary.monthlyIncome) {
    return (
      <Card>
        <EmptyState title="Belum ada data untuk laporan" body="Isi profil keluarga atau muat keluarga contoh di Settings." />
      </Card>
    );
  }
  if (!model) return <p className="text-[0.85rem] text-ink-2">Menyusun laporan…</p>;

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(`${label} gagal: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  const kids = model.plan.children.map((cr, i) => ({ id: cr.child.id, name: cr.child.name, color: c[childColorVar(cr.child, i) as keyof typeof c] }));
  const data = model.plan.years.map((y) => ({ ay: String(y.ay), ...Object.fromEntries(kids.map((k) => [k.id, Math.round(y.byChild[k.id] ?? 0)])) }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Family Financial Planning Report"
        subtitle={`Keluarga ${model.familyName || "-"} · valuasi ${model.planDate}. 17 bagian: ringkasan sampai sumber data & disclaimer.`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="primary" disabled={!!busy} onClick={() => run("PDF", async () => (await import("@/lib/export/pdf")).downloadPdf(model))}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button disabled={!!busy} onClick={() => run("Excel", async () => (await import("@/lib/export/excel")).downloadExcel(model, household, db, a))}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                run("CSV", () => {
                  const rows = model.plan.children.flatMap((cr) =>
                    cr.rows.flatMap((r) =>
                      r.components.map((comp) => ({
                        child: cr.child.name,
                        academic_year: `${r.ay}/${r.ay + 1}`,
                        level: r.level,
                        grade: r.gradeLabel,
                        component: comp.label,
                        category: comp.category,
                        frequency: comp.frequency,
                        base_annual: Math.round(comp.baseAnnual),
                        data_year: comp.dataYear,
                        inflation_key: comp.inflationKey,
                        inflation_rate: comp.rate,
                        n: comp.n,
                        projected_cost: Math.round(comp.amount),
                        source: r.sourceLabel,
                        verification: r.verification,
                      })),
                    ),
                  );
                  downloadText(`edufin-education-timeline-${model.planDate}.csv`, toCsv(rows));
                })
              }
            >
              <Table2 className="h-4 w-4" /> CSV timeline
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                run("CSV", () =>
                  downloadText(
                    `edufin-cashflow-${model.planDate}.csv`,
                    toCsv(
                      model.plan.cashflow.rows.map((r) => ({
                        academic_year: r.label,
                        age_primary: r.agePrimary,
                        income: Math.round(r.income),
                        living_expenses: Math.round(r.livingExpenses),
                        debt_service: Math.round(r.debtService),
                        education_cost: Math.round(r.educationCost),
                        education_from_fund: Math.round(r.educationFromFund),
                        education_from_cashflow: Math.round(r.educationFromCashflow),
                        free_cash_flow: Math.round(r.fcf),
                        investment_return: Math.round(r.investmentReturn),
                        ending_portfolio: Math.round(r.endInvestable),
                        liabilities: Math.round(r.liabilities),
                        net_worth: Math.round(r.netWorth),
                        flags: r.flags.join("|"),
                      })),
                    ),
                  ),
                )
              }
            >
              <Table2 className="h-4 w-4" /> CSV cash flow
            </Button>
            <Button disabled={!!busy} onClick={() => run("CSV", () => downloadText(`edufin-schools-${model.planDate}.csv`, exportDbCsv(db)))}>
              <Table2 className="h-4 w-4" /> CSV sekolah
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak
            </Button>
          </div>
        }
      />
      {busy ? <StatusPill tone="info">Membuat {busy}…</StatusPill> : null}
      {err ? <StatusPill tone="critical">{err}</StatusPill> : null}
      <Card>
        <CardBody>
          <div className="mb-2 text-[0.8rem] font-semibold text-ink-2">Biaya pendidikan per tahun ajaran (nominal)</div>
          <StackedBars data={data} xKey="ay" series={kids.map((k) => ({ key: k.id, label: k.name, color: k.color }))} height={220} />
        </CardBody>
      </Card>
      {model.sections.map((s) => (
        <Section key={s.id} s={s} />
      ))}
    </div>
  );
}
