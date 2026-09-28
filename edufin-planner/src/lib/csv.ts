import Papa from "papaparse";
import { makeComponent } from "./engine/catalog";
import { summarizeComponents } from "./engine/costs";
import type { FeeSchedule, Level, School, SchoolDatabase, SourceType, VerificationStatus } from "./engine/types";
import { LEVELS } from "./engine/types";
import { parseAcademicYear, parseRupiah } from "./format";

/** Column order from the product spec (§23) plus optional provenance/identity columns. */
export const CSV_COLUMNS = [
  "school_id",
  "school_name",
  "city",
  "province",
  "level",
  "academic_year",
  "entry_fee",
  "monthly_tuition",
  "annual_fee",
  "transport_fee",
  "meal_fee",
  "book_fee",
  "activity_fee",
  "source",
  "source_date",
  "verification_status",
] as const;

export const CSV_OPTIONAL_COLUMNS = ["source_url", "program", "ownership", "categories", "district", "confidence", "source_type"] as const;

/** Frequency conventions for the flat CSV columns (documented in the Admin UI and README). */
export const CSV_COMPONENT_MAP: Record<string, { code: string; label: string; frequency: "one_time" | "monthly" | "annual" }> = {
  entry_fee: { code: "uang_pangkal", label: "Uang pangkal / entry fee", frequency: "one_time" },
  monthly_tuition: { code: "spp_monthly", label: "SPP bulanan", frequency: "monthly" },
  annual_fee: { code: "annual_fee", label: "Biaya tahunan / daftar ulang", frequency: "annual" },
  transport_fee: { code: "transport", label: "Transportasi (per bulan)", frequency: "monthly" },
  meal_fee: { code: "meals", label: "Makan / katering (per bulan)", frequency: "monthly" },
  book_fee: { code: "books", label: "Buku (per tahun)", frequency: "annual" },
  activity_fee: { code: "activity_fee", label: "Kegiatan (per tahun)", frequency: "annual" },
};

const STATUS_ALIASES: Record<string, VerificationStatus> = {
  verified: "verified",
  "partially verified": "partially_verified",
  partially_verified: "partially_verified",
  partial: "partially_verified",
  "user submitted": "user_submitted",
  user_submitted: "user_submitted",
  estimated: "estimated",
  estimate: "estimated",
  outdated: "outdated",
};

export interface ImportRow {
  line: number;
  raw: Record<string, string>;
  errors: string[];
  warnings: string[];
  school?: School;
  schedule?: FeeSchedule;
  action?: "create" | "update";
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function csvTemplate(): string {
  const header = [...CSV_COLUMNS, ...CSV_OPTIONAL_COLUMNS].join(",");
  const example = [
    "",
    "Contoh Sekolah (hapus baris ini)",
    "Kota Depok",
    "Jawa Barat",
    "SD",
    "2026/2027",
    "25000000",
    "1500000",
    "3000000",
    "",
    "",
    "1200000",
    "1500000",
    "Brosur PPDB resmi 2026/2027",
    "2026-08-01",
    "user_submitted",
    "https://contoh.sch.id/ppdb",
    "Reguler",
    "swasta",
    "Islamic",
    "",
    "medium",
    "official_brochure_pdf",
  ].join(",");
  return `${header}\n${example}\n`;
}

export function parseImport(text: string, db: SchoolDatabase, today: string): ImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const rows: ImportRow[] = [];
  const missing = CSV_COLUMNS.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) {
    return [{ line: 1, raw: {}, errors: [`Kolom wajib tidak ditemukan: ${missing.join(", ")}`], warnings: [] }];
  }
  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const get = (k: string) => (raw[k] ?? "").trim();
    const name = get("school_name");
    const city = get("city");
    const level = get("level").toUpperCase() as Level;
    const ay = parseAcademicYear(get("academic_year"));
    const source = get("source");
    if (!name) errors.push("school_name kosong");
    if (!city) errors.push("city kosong");
    if (!LEVELS.includes(level)) errors.push(`level "${get("level")}" tidak dikenal (${LEVELS.join("/")})`);
    if (ay === null) errors.push(`academic_year "${get("academic_year")}" tidak valid (contoh 2026/2027)`);
    if (!source) errors.push("source kosong — setiap angka harus punya sumber (provenance)");
    const statusRaw = get("verification_status").toLowerCase();
    const status: VerificationStatus = statusRaw ? STATUS_ALIASES[statusRaw] ?? "user_submitted" : "user_submitted";
    if (statusRaw && !STATUS_ALIASES[statusRaw]) warnings.push(`verification_status "${statusRaw}" tidak dikenal → user_submitted`);
    const sourceUrl = get("source_url");
    if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) errors.push("source_url harus diawali http(s)://");
    if (status === "verified" && !sourceUrl) errors.push("Status verified memerlukan source_url dokumen resmi");
    const sourceDate = get("source_date");
    if (sourceDate && !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) warnings.push("source_date sebaiknya format YYYY-MM-DD");

    const components = [];
    for (const [col, spec] of Object.entries(CSV_COMPONENT_MAP)) {
      const v = get(col);
      if (!v) continue;
      const amount = parseRupiah(v);
      if (amount === null) errors.push(`${col} "${v}" bukan angka`);
      else if (amount < 0) errors.push(`${col} negatif`);
      else components.push(makeComponent(spec.code, amount, { label: spec.label, frequency: spec.frequency, id: `csv-${line}-${col}` }));
    }
    if (!components.length) errors.push("tidak ada kolom biaya yang terisi");
    if (errors.length) {
      rows.push({ line, raw, errors, warnings });
      return;
    }
    const schoolId = get("school_id") || `csv-${slug(name)}-${slug(city)}`;
    const existing = db.schools.find((s) => s.id === schoolId);
    const ownership = get("ownership").toLowerCase() === "negeri" ? "negeri" : existing?.ownership ?? "swasta";
    const cats = get("categories")
      .split(/[;|]/)
      .map((c) => c.trim())
      .filter(Boolean) as School["categories"];
    const school: School = existing
      ? { ...existing, levels: existing.levels.includes(level) ? existing.levels : [...existing.levels, level] }
      : {
          id: schoolId,
          name,
          ownership,
          levels: [level],
          categories: [ownership === "negeri" ? "Negeri" : "Swasta", ...cats],
          curricula: [],
          location: { province: get("province") || "Jawa Barat", city, district: get("district") || undefined },
          isUniversity: ["D3", "S1", "S2"].includes(level),
          origin: "admin",
        };
    const program = get("program") || undefined;
    const academicYear = `${ay}/${(ay as number) + 1}`;
    const scheduleId = `${schoolId}-${level.toLowerCase()}-${ay}-csv${program ? `-${slug(program)}` : ""}`;
    const prior = db.fees.find((f) => f.id === scheduleId);
    const schedule: FeeSchedule = {
      id: scheduleId,
      schoolId,
      level,
      program,
      academicYear,
      monthsBilled: 12,
      components,
      provenance: {
        source,
        sourceUrl: sourceUrl || undefined,
        sourceType: (get("source_type") as SourceType) || "user",
        dataDate: sourceDate || undefined,
        academicYear,
        accessedDate: today,
        lastVerified: status === "verified" ? today : undefined,
        verificationStatus: status,
        confidence: (["high", "medium", "low"].includes(get("confidence")) ? get("confidence") : "medium") as "high" | "medium" | "low",
        evidence: "manual",
        notes: "Diimpor dari CSV.",
      },
    };
    const sum = summarizeComponents(components);
    if (sum.firstYearTotal > 500_000_000) warnings.push("Total tahun pertama > Rp500 juta — periksa satuan (per bulan vs per tahun).");
    if (components.some((c) => c.code === "spp_monthly" && c.amount > 50_000_000)) warnings.push("SPP bulanan > Rp50 juta — mungkin angka tahunan?");
    rows.push({ line, raw, errors, warnings, school, schedule, action: prior ? "update" : "create" });
  });
  return rows;
}

/** Flatten the database back to the CSV layout (one row per schedule, main components only). */
export function exportDbCsv(db: SchoolDatabase): string {
  const schools = new Map(db.schools.map((s) => [s.id, s]));
  const header = [...CSV_COLUMNS, ...CSV_OPTIONAL_COLUMNS];
  const lines = [header.join(",")];
  for (const f of db.fees) {
    const s = schools.get(f.schoolId);
    if (!s) continue;
    const sum = summarizeComponents(f.components, f.monthsBilled ?? 12);
    const val: Record<string, string | number> = {
      school_id: s.id,
      school_name: s.name,
      city: s.location.city,
      province: s.location.province,
      level: f.level,
      academic_year: f.academicYear,
      entry_fee: Math.round(sum.entryOneTime),
      monthly_tuition: Math.round(sum.byCategoryAnnual.tuition / 12),
      annual_fee: Math.round(sum.byCategoryAnnual.annual),
      transport_fee: Math.round(sum.byCategoryAnnual.transport / 12),
      meal_fee: Math.round(sum.byCategoryAnnual.meals / 12),
      book_fee: Math.round(sum.byCategoryAnnual.books),
      activity_fee: Math.round(sum.byCategoryAnnual.activities),
      source: f.provenance.source,
      source_date: f.provenance.dataDate ?? "",
      verification_status: f.provenance.verificationStatus,
      source_url: f.provenance.sourceUrl ?? "",
      program: f.program ?? "",
      ownership: s.ownership,
      categories: s.categories.join(";"),
      district: s.location.district ?? "",
      confidence: f.provenance.confidence,
      source_type: f.provenance.sourceType,
    };
    lines.push(header.map((h) => csvCell(val[h])).join(","));
  }
  return lines.join("\n");
}

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
