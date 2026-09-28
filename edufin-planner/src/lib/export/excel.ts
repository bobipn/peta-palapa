"use client";

import { FREQUENCY_LABEL, CATEGORY_LABEL } from "../engine/catalog";
import { INFLATION_LABEL, RETURN_LABEL } from "../engine/defaults";
import type { Assumptions, InflationKey } from "../engine/types";
import type { ReportModel } from "../report";
import { sensitivityGrid } from "../engine/analysis";
import type { Household, SchoolDatabase } from "../engine/types";

const NAME: Record<InflationKey, string> = {
  general: "InflasiUmum",
  education: "InflasiPendidikan",
  privateSchool: "InflasiSwasta",
  internationalSchool: "InflasiInternasional",
  university: "InflasiPT",
};

/**
 * Excel workbook with live, auditable formulas:
 * Timeline!P = annual base × scenario multiplier × (1 + inflation)^(AY − data year),
 * inflation cells reference named assumptions (edit Asumsi → everything recalculates),
 * Per TA uses SUMIFS over the timeline, Funding discounts each payment with (1 + r_m)^−m.
 */
export async function downloadExcel(model: ReportModel, household: Household, db: SchoolDatabase, a: Assumptions) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EduFin Planner";
  wb.created = new Date(model.generatedAt);
  const money = '"Rp"#,##0;[Red]-"Rp"#,##0';
  const pct = "0.00%";
  const head = (ws: import("exceljs").Worksheet, cols: { header: string; key: string; width: number }[]) => {
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3EF" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const plan = model.plan;
  const f = plan.funding;

  // Summary
  const sum = wb.addWorksheet("Ringkasan");
  sum.columns = [{ width: 44 }, { width: 26 }];
  sum.addRow([model.title]).font = { bold: true, size: 14 };
  sum.addRow([`Keluarga ${model.familyName || "-"}`, `Valuasi ${model.planDate}`]);
  sum.addRow([]);
  const kv: [string, number | string, string?][] = [
    ["Kebutuhan dana pendidikan (nominal)", f.requirementNominal, money],
    ["Present value kebutuhan", f.requirementPv, money],
    ["Dana pendidikan saat ini", f.currentFund, money],
    ["Investasi pendidikan direncanakan / bulan", f.plannedMonthly, money],
    ["Funding gap (nominal)", f.gapNominal, money],
    ["Funded ratio", f.fundedRatio, pct],
    ["Investasi dibutuhkan / bulan", f.required.monthlyEquivalent, money],
    ["Tambahan dana hari ini (alternatif)", f.additionalLumpSumToday, money],
    ["Net worth hari ini", plan.health.netWorth, money],
    ["Kesiapan pensiun", plan.cashflow.retirement.readiness, pct],
    ["Status", f.status],
  ];
  for (const [k, v, fmt] of kv) {
    const r = sum.addRow([k, v]);
    if (fmt) r.getCell(2).numFmt = fmt;
  }
  sum.addRow([]);
  sum.addRow(["Estimasi perencanaan — bukan nasihat keuangan/investasi. Return adalah asumsi, bukan jaminan."]).font = { italic: true, color: { argb: "FF6E6C66" } };

  // Assumptions with named cells
  const as = wb.addWorksheet("Asumsi");
  head(as, [
    { header: "Parameter", key: "k", width: 40 },
    { header: "Nilai", key: "v", width: 14 },
    { header: "Nama (dipakai rumus)", key: "n", width: 24 },
  ]);
  let row = 2;
  for (const k of Object.keys(NAME) as InflationKey[]) {
    as.addRow({ k: INFLATION_LABEL[k], v: a.inflation[k], n: NAME[k] });
    as.getCell(`B${row}`).numFmt = pct;
    wb.definedNames.add(`Asumsi!$B$${row}`, NAME[k]);
    row++;
  }
  for (const k of Object.keys(RETURN_LABEL) as (keyof Assumptions["returns"])[]) {
    const n = `Return_${k}`;
    as.addRow({ k: RETURN_LABEL[k], v: a.returns[k], n });
    as.getCell(`B${row}`).numFmt = pct;
    wb.definedNames.add(`Asumsi!$B$${row}`, n);
    row++;
  }
  as.addRow({ k: "Tanggal valuasi", v: plan.planDate });
  as.addRow({ k: "TA berjalan (tahun mulai)", v: plan.currentAy, n: "TA_Berjalan" });
  wb.definedNames.add(`Asumsi!$B$${row + 1}`, "TA_Berjalan");

  // Timeline with formulas
  const tl = wb.addWorksheet("Timeline");
  head(tl, [
    { header: "Anak", key: "a", width: 14 },
    { header: "TA", key: "b", width: 8 },
    { header: "Jenjang", key: "c", width: 8 },
    { header: "Kelas", key: "d", width: 10 },
    { header: "Komponen", key: "e", width: 34 },
    { header: "Kategori", key: "f", width: 16 },
    { header: "Frekuensi", key: "g", width: 18 },
    { header: "Nominal per periode", key: "h", width: 16 },
    { header: "Periode/tahun", key: "i", width: 12 },
    { header: "Nominal tahunan (data)", key: "j", width: 18 },
    { header: "Tahun data", key: "k", width: 10 },
    { header: "Kunci inflasi", key: "l", width: 20 },
    { header: "Inflasi", key: "m", width: 9 },
    { header: "n", key: "n", width: 6 },
    { header: "Pengali", key: "o", width: 8 },
    { header: "Biaya proyeksi", key: "p", width: 18 },
    { header: "Nilai engine (cek)", key: "q", width: 18 },
    { header: "Sumber", key: "r", width: 40 },
  ]);
  let r = 2;
  for (const c of plan.children) {
    for (const pr of c.rows) {
      for (const comp of pr.components) {
        const periods =
          comp.frequency === "one_time" ? 1 : comp.baseAmount > 0 ? Math.round(comp.baseAnnual / comp.baseAmount) : comp.frequency === "monthly" ? 12 : comp.frequency === "semester" ? 2 : 1;
        tl.addRow({
          a: c.child.name,
          b: pr.ay,
          c: pr.level,
          d: pr.gradeLabel,
          e: comp.label,
          f: CATEGORY_LABEL[comp.category],
          g: FREQUENCY_LABEL[comp.frequency],
          h: comp.baseAmount,
          i: periods,
          j: { formula: `H${r}*I${r}`, result: comp.baseAnnual },
          k: comp.dataYear,
          l: INFLATION_LABEL[comp.inflationKey],
          m: { formula: NAME[comp.inflationKey], result: comp.rate },
          n: { formula: `B${r}-K${r}`, result: comp.n },
          o: comp.multiplier,
          p: { formula: `J${r}*O${r}*(1+M${r})^N${r}`, result: comp.amount },
          q: comp.amount,
          r: pr.sourceLabel,
        });
        for (const col of ["H", "J", "P", "Q"]) tl.getCell(`${col}${r}`).numFmt = money;
        tl.getCell(`M${r}`).numFmt = pct;
        r++;
      }
    }
  }
  const lastTl = r - 1;

  // Per academic year (SUMIFS over the timeline)
  const py = wb.addWorksheet("Per TA");
  const kids = plan.children.map((c) => c.child.name);
  head(py, [{ header: "TA", key: "ay", width: 10 }, ...kids.map((k, i) => ({ header: k, key: `k${i}`, width: 18 })), { header: "Total", key: "t", width: 18 }]);
  plan.years.forEach((y, i) => {
    const rr = i + 2;
    const cells: Record<string, unknown> = { ay: y.ay };
    kids.forEach((k, j) => {
      const col = String.fromCharCode(66 + j);
      cells[`k${j}`] = { formula: `SUMIFS(Timeline!$P$2:$P$${lastTl},Timeline!$B$2:$B$${lastTl},$A${rr},Timeline!$A$2:$A$${lastTl},${col}$1)`, result: y.byChild[plan.children[j].child.id] ?? 0 };
    });
    const lastCol = String.fromCharCode(65 + kids.length);
    cells.t = { formula: `SUM(B${rr}:${lastCol}${rr})`, result: y.total };
    py.addRow(cells);
    for (let j = 0; j <= kids.length; j++) py.getCell(rr, j + 2).numFmt = money;
  });

  // Funding: PV of each withdrawal
  const fu = wb.addWorksheet("Funding");
  fu.columns = [{ width: 14 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }];
  fu.addRow(["Return dana pendidikan", { formula: "Return_education", result: a.returns.education }]).getCell(2).numFmt = pct;
  fu.addRow(["Return bulanan r_m", { formula: "(1+B1)^(1/12)-1", result: Math.pow(1 + a.returns.education, 1 / 12) - 1 }]).getCell(2).numFmt = "0.0000%";
  fu.addRow([]);
  const hdr = fu.addRow(["TA", "Bulan dari valuasi (m)", "Pembayaran (nominal)", "PV = W/(1+r_m)^m", "Dibayar dana (simulasi)"]);
  hdr.font = { bold: true };
  const start = 5;
  f.simulation.events.forEach((e, i) => {
    const rr = start + i;
    const w = f.withdrawals.find((x) => x.ay === e.ay);
    fu.addRow([e.ay, e.month, w?.amount ?? e.amount, { formula: `C${rr}/(1+$B$2)^B${rr}`, result: e.amount / Math.pow(1 + Math.pow(1 + a.returns.education, 1 / 12) - 1, e.month) }, e.paid]);
    for (const col of ["C", "D", "E"]) fu.getCell(`${col}${rr}`).numFmt = money;
  });
  const end = start + f.simulation.events.length - 1;
  const tot = fu.addRow(["Total", "", { formula: `SUM(C${start}:C${end})`, result: f.requirementNominal }, { formula: `SUM(D${start}:D${end})`, result: f.requirementPv }, { formula: `SUM(E${start}:E${end})`, result: f.coveredByCurrentFund + f.coveredByContributions }]);
  tot.font = { bold: true };
  for (const col of ["C", "D", "E"]) fu.getCell(`${col}${end + 1}`).numFmt = money;
  fu.addRow([]);
  const g = fu.addRow(["Funding gap", "", { formula: `C${end + 1}-E${end + 1}`, result: f.gapNominal }]);
  g.getCell(3).numFmt = money;
  fu.addRow(["Investasi dibutuhkan / bulan (engine, no-shortfall)", "", f.required.monthlyEquivalent]).getCell(3).numFmt = money;
  fu.addRow(["Metode PV / bulan (pembanding)", "", f.required.pvMethodMonthly]).getCell(3).numFmt = money;

  // Cash flow
  const cf = wb.addWorksheet("Cash Flow");
  head(cf, [
    { header: "TA", key: "ay", width: 10 },
    { header: "Usia", key: "age", width: 6 },
    { header: "Pendapatan", key: "inc", width: 16 },
    { header: "Pengeluaran hidup", key: "liv", width: 16 },
    { header: "Cicilan", key: "debt", width: 14 },
    { header: "Pendidikan dari kas", key: "educf", width: 16 },
    { header: "FCF", key: "fcf", width: 16 },
    { header: "Imbal hasil", key: "ret", width: 16 },
    { header: "Penarikan dana pendidikan", key: "wd", width: 18 },
    { header: "Portofolio awal", key: "beg", width: 18 },
    { header: "Portofolio akhir", key: "end", width: 18 },
    { header: "Rekonsiliasi (harus 0)", key: "chk", width: 16 },
    { header: "Net worth", key: "nw", width: 18 },
  ]);
  plan.cashflow.rows.forEach((x, i) => {
    const rr = i + 2;
    cf.addRow({
      ay: x.label,
      age: x.agePrimary,
      inc: x.income,
      liv: x.livingExpenses,
      debt: x.debtService,
      educf: x.educationFromCashflow,
      fcf: { formula: `C${rr}-D${rr}-E${rr}-F${rr}`, result: x.fcf },
      ret: x.investmentReturn,
      wd: x.educationFromFund,
      beg: x.beginInvestable,
      end: x.endInvestable,
      chk: { formula: `ROUND(J${rr}+G${rr}+H${rr}-I${rr}+${Math.round(x.unfundedDeficit)}-K${rr},0)`, result: 0 },
      nw: x.netWorth,
    });
    for (let c = 3; c <= 13; c++) if (c !== 12) cf.getCell(rr, c).numFmt = money;
  });

  // Scenarios & sensitivity
  const sc = wb.addWorksheet("Skenario");
  head(sc, [
    { header: "Skenario", key: "s", width: 26 },
    { header: "Deskripsi", key: "d", width: 50 },
    { header: "Funding gap", key: "g", width: 16 },
    { header: "Investasi/bln", key: "m", width: 16 },
    { header: "Kesiapan pensiun", key: "r", width: 14 },
    { header: "Net worth saat pensiun", key: "nw", width: 18 },
  ]);
  model.scenarios.forEach((s, i) => {
    sc.addRow({ s: `${s.def.code} ${s.def.name}`, d: s.def.description, g: s.fundingGapNominal, m: s.requiredMonthly, r: s.retirementReadiness, nw: s.netWorthAtRetirement });
    sc.getCell(`C${i + 2}`).numFmt = money;
    sc.getCell(`D${i + 2}`).numFmt = money;
    sc.getCell(`E${i + 2}`).numFmt = pct;
    sc.getCell(`F${i + 2}`).numFmt = money;
  });
  const grid = sensitivityGrid(household, db, a);
  const se = wb.addWorksheet("Sensitivitas");
  se.addRow(["Investasi bulanan dibutuhkan: inflasi pendidikan (baris) × return (kolom)"]).font = { bold: true };
  se.addRow(["", ...grid.returns]);
  grid.inflations.forEach((inf, i) => se.addRow([inf, ...grid.values[i]]));
  se.getRow(2).eachCell((c, n) => {
    if (n > 1) c.numFmt = pct;
  });
  for (let i = 0; i < grid.inflations.length; i++) {
    se.getCell(i + 3, 1).numFmt = pct;
    for (let j = 0; j < grid.returns.length; j++) se.getCell(i + 3, j + 2).numFmt = money;
  }
  se.columns.forEach((c) => (c.width = 16));

  // Sources
  const so = wb.addWorksheet("Sumber Data");
  head(so, [
    { header: "Sekolah", key: "s", width: 34 },
    { header: "Jenjang", key: "l", width: 8 },
    { header: "TA", key: "y", width: 11 },
    { header: "Status", key: "st", width: 18 },
    { header: "Sumber", key: "src", width: 50 },
    { header: "URL", key: "u", width: 50 },
    { header: "Diakses", key: "acc", width: 12 },
  ]);
  model.sources.forEach((s, i) => {
    so.addRow({ s: s.school, l: s.level, y: s.academicYear, st: s.status, src: s.source, u: s.url ? { text: s.url, hyperlink: s.url } : "", acc: s.accessed });
    if (s.url) so.getCell(`F${i + 2}`).font = { color: { argb: "FF1C5CAB" }, underline: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `EduFin-Plan-${(model.familyName || "keluarga").replace(/\W+/g, "-")}-${model.planDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
