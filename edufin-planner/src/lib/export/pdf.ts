"use client";

import type { ReportModel } from "../report";
import { formatPct, formatRpCompact } from "../format";

/** Standard PDF fonts use WinAnsi encoding: map characters it cannot draw. */
function pdfText(s: string): string {
  return s
    .replace(/−/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/Σ/g, "Sum ")
    .replace(/⚠︎?/g, "!")
    .replace(/[^\x00-\xFF–—‘’“”•…€]/g, "");
}

export async function downloadPdf(model: ReportModel) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;
  const ink: [number, number, number] = [11, 11, 11];
  const muted: [number, number, number] = [110, 108, 102];
  const blue: [number, number, number] = [42, 120, 214];
  type WithTable = { lastAutoTable?: { finalY: number } };

  const ensure = (need: number) => {
    if (y + need > H - 16) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size = 9.5, color = ink, bold = false, gap = 1.6) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(s), W - 2 * M) as string[];
    for (const line of lines) {
      ensure(size * 0.45 + gap);
      doc.text(line, M, y);
      y += size * 0.42 + gap * 0.6;
    }
    y += gap;
  };

  // Header
  doc.setFillColor(11, 11, 11);
  doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(pdfText(model.title), M, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(pdfText(`Keluarga ${model.familyName || "-"} · Valuasi ${model.planDate} · Dibuat ${model.generatedAt.slice(0, 10)} · EduFin Planner`), M, 19);
  y = 34;

  // KPI boxes
  const f = model.plan.funding;
  const kpis: [string, string][] = [
    ["Kebutuhan dana", formatRpCompact(f.requirementNominal)],
    ["Funding gap", formatRpCompact(f.gapNominal)],
    ["Investasi dibutuhkan/bln", formatRpCompact(f.required.monthlyEquivalent)],
    ["Kesiapan pensiun", formatPct(model.plan.cashflow.retirement.readiness, 0)],
  ];
  const bw = (W - 2 * M - 9) / 4;
  kpis.forEach(([k, v], i) => {
    const x = M + i * (bw + 3);
    doc.setDrawColor(220, 219, 212);
    doc.roundedRect(x, y, bw, 18, 2, 2, "S");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(pdfText(k), x + 3, y + 6);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ink);
    doc.text(pdfText(v), x + 3, y + 14);
    doc.setFont("helvetica", "normal");
  });
  y += 26;

  // Chart: education cost per academic year (single series)
  const years = model.plan.years.filter((yy) => yy.total > 0);
  if (years.length) {
    text("Biaya pendidikan per tahun ajaran (nominal, semua anak)", 9.5, ink, true);
    const ch = 42;
    const cw = W - 2 * M;
    const max = Math.max(...years.map((yy) => yy.total));
    const peak = years.reduce((p, yy) => (yy.total > p.total ? yy : p));
    ensure(ch + 12);
    doc.setDrawColor(195, 194, 183);
    doc.line(M, y + ch, M + cw, y + ch);
    const slot = cw / years.length;
    const bar = Math.min(6, slot * 0.7);
    years.forEach((yy, i) => {
      const h = (yy.total / max) * (ch - 4);
      const x = M + i * slot + (slot - bar) / 2;
      doc.setFillColor(...(yy.ay === peak.ay ? blue : ([157, 197, 244] as [number, number, number])));
      doc.rect(x, y + ch - h, bar, h, "F");
      if (i % Math.ceil(years.length / 10) === 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(...muted);
        doc.text(String(yy.ay), x + bar / 2, y + ch + 4, { align: "center" });
      }
    });
    doc.setFontSize(7);
    doc.setTextColor(...ink);
    doc.text(pdfText(`Puncak ${peak.ay}/${peak.ay + 1}: ${formatRpCompact(peak.total)}`), M + cw, y + 3, { align: "right" });
    y += ch + 10;
  }

  for (const s of model.sections) {
    ensure(16);
    y += 2;
    text(s.title, 12, ink, true, 1.2);
    for (const p of s.paragraphs) text(p, 9, ink);
    for (const b of s.bullets ?? []) text(`• ${b}`, 8.8, ink, false, 1.2);
    for (const t of s.tables ?? []) {
      if (t.caption) text(t.caption, 8.5, muted, true, 1);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [t.table.columns.map(pdfText)],
        body: t.table.rows.map((r) => r.map((c) => pdfText(String(c)))),
        styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.4, textColor: ink, lineColor: [225, 224, 217], lineWidth: 0.1, overflow: "linebreak" },
        headStyles: { fillColor: [243, 243, 239], textColor: [82, 81, 78], fontStyle: "bold" },
        columnStyles: Object.fromEntries((t.table.numeric ?? []).map((n, i) => [i, n ? { halign: "right" as const } : {}])),
        theme: "grid",
      });
      y = ((doc as unknown as WithTable).lastAutoTable?.finalY ?? y) + 5;
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(pdfText("Estimasi perencanaan — bukan nasihat keuangan/investasi. Return adalah asumsi, bukan jaminan. Biaya sekolah dapat berubah."), M, H - 8);
    doc.text(`${i} / ${pages}`, W - M, H - 8, { align: "right" });
  }
  doc.save(`EduFin-Report-${(model.familyName || "keluarga").replace(/\W+/g, "-")}-${model.planDate}.pdf`);
}
