import type { ComponentInflation, CostCategory, CostGroup, FeeComponent, Frequency, Level } from "./types";

/**
 * Fee component catalog — spec section 4 (A. Entry, B. Recurring, C. Operational, D. Optional).
 * `inflation` says which inflation parameter drives the item by default:
 *  school-charged fees follow the school-type rate; household purchases follow CPI.
 */
export interface CatalogEntry {
  code: string;
  label: string;
  labelEn: string;
  group: CostGroup;
  category: CostCategory;
  frequency: Frequency;
  inflation: ComponentInflation;
}

export const FEE_CATALOG: CatalogEntry[] = [
  // A. Initial / entry cost
  { code: "registration_fee", label: "Uang pendaftaran", labelEn: "Registration fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "form_fee", label: "Uang formulir", labelEn: "Form fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "uang_pangkal", label: "Uang pangkal", labelEn: "Entry fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "development_fee", label: "Development fee", labelEn: "Development fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "building_fee", label: "Uang gedung", labelEn: "Building fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "entrance_fee", label: "Entrance fee", labelEn: "Entrance fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "admission_fee", label: "Admission fee", labelEn: "Admission fee", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "deposit", label: "Deposit", labelEn: "Deposit", group: "entry", category: "entry", frequency: "one_time", inflation: "school" },
  { code: "initial_uniform", label: "Seragam awal", labelEn: "Uniform (initial)", group: "entry", category: "uniform", frequency: "one_time", inflation: "school" },
  { code: "initial_books", label: "Buku awal", labelEn: "Books (initial)", group: "entry", category: "books", frequency: "one_time", inflation: "school" },
  { code: "equipment", label: "Perlengkapan", labelEn: "Equipment", group: "entry", category: "other", frequency: "one_time", inflation: "school" },
  { code: "device_laptop", label: "Device / laptop", labelEn: "Device / laptop", group: "entry", category: "technology", frequency: "one_time", inflation: "general" },
  // B. Recurring cost
  { code: "spp_monthly", label: "SPP bulanan", labelEn: "Monthly tuition", group: "recurring", category: "tuition", frequency: "monthly", inflation: "school" },
  { code: "tuition_fee", label: "Tuition fee", labelEn: "Tuition fee", group: "recurring", category: "tuition", frequency: "annual", inflation: "school" },
  { code: "semester_fee", label: "Biaya semester / UKT", labelEn: "Semester fee", group: "recurring", category: "tuition", frequency: "semester", inflation: "school" },
  { code: "annual_fee", label: "Biaya tahunan / daftar ulang", labelEn: "Annual fee", group: "recurring", category: "annual", frequency: "annual", inflation: "school" },
  { code: "activity_fee", label: "Uang kegiatan", labelEn: "Activity fee", group: "recurring", category: "activities", frequency: "annual", inflation: "school" },
  { code: "technology_fee", label: "Technology fee", labelEn: "Technology fee", group: "recurring", category: "technology", frequency: "annual", inflation: "school" },
  { code: "lab_fee", label: "Biaya laboratorium", labelEn: "Lab fee", group: "recurring", category: "annual", frequency: "annual", inflation: "school" },
  { code: "library_fee", label: "Biaya perpustakaan", labelEn: "Library fee", group: "recurring", category: "annual", frequency: "annual", inflation: "school" },
  { code: "exam_fee", label: "Biaya ujian", labelEn: "Exam fee", group: "recurring", category: "annual", frequency: "annual", inflation: "school" },
  { code: "student_activity", label: "Kegiatan siswa / OSIS", labelEn: "Student activity", group: "recurring", category: "activities", frequency: "annual", inflation: "school" },
  { code: "extracurricular", label: "Ekstrakurikuler", labelEn: "Extracurricular", group: "recurring", category: "activities", frequency: "monthly", inflation: "school" },
  // C. Operational education cost
  { code: "transport", label: "Transportasi", labelEn: "Transportation", group: "operational", category: "transport", frequency: "monthly", inflation: "general" },
  { code: "shuttle", label: "Antar jemput", labelEn: "School shuttle", group: "operational", category: "transport", frequency: "monthly", inflation: "general" },
  { code: "meals", label: "Makan / katering", labelEn: "Meals", group: "operational", category: "meals", frequency: "monthly", inflation: "general" },
  { code: "pocket_money", label: "Uang saku", labelEn: "Pocket money", group: "operational", category: "meals", frequency: "monthly", inflation: "general" },
  { code: "books", label: "Buku", labelEn: "Books", group: "operational", category: "books", frequency: "annual", inflation: "education" },
  { code: "stationery", label: "Alat tulis", labelEn: "Stationery", group: "operational", category: "books", frequency: "annual", inflation: "general" },
  { code: "uniform", label: "Seragam", labelEn: "Uniform", group: "operational", category: "uniform", frequency: "annual", inflation: "general" },
  { code: "shoes", label: "Sepatu", labelEn: "Shoes", group: "operational", category: "uniform", frequency: "annual", inflation: "general" },
  { code: "laptop_tablet", label: "Laptop / tablet", labelEn: "Laptop / tablet", group: "operational", category: "technology", frequency: "annual", inflation: "general" },
  { code: "internet", label: "Internet", labelEn: "Internet", group: "operational", category: "technology", frequency: "monthly", inflation: "general" },
  { code: "tutoring", label: "Les / bimbel", labelEn: "Tutoring", group: "operational", category: "courses", frequency: "monthly", inflation: "education" },
  { code: "course", label: "Kursus", labelEn: "Course", group: "operational", category: "courses", frequency: "monthly", inflation: "education" },
  { code: "sports", label: "Olahraga", labelEn: "Sports", group: "operational", category: "activities", frequency: "monthly", inflation: "general" },
  { code: "music", label: "Musik", labelEn: "Music", group: "operational", category: "activities", frequency: "monthly", inflation: "education" },
  { code: "language", label: "Bahasa", labelEn: "Language course", group: "operational", category: "courses", frequency: "monthly", inflation: "education" },
  { code: "field_trip", label: "Field trip", labelEn: "Field trip", group: "operational", category: "activities", frequency: "annual", inflation: "school" },
  { code: "study_tour", label: "Study tour", labelEn: "Study tour", group: "operational", category: "activities", frequency: "annual", inflation: "school" },
  { code: "living_cost", label: "Biaya hidup (kos & makan)", labelEn: "Living cost", group: "operational", category: "boarding", frequency: "monthly", inflation: "general" },
  // D. Optional cost
  { code: "boarding", label: "Boarding / asrama", labelEn: "Boarding", group: "optional", category: "boarding", frequency: "monthly", inflation: "school" },
  { code: "dormitory", label: "Dormitory", labelEn: "Dormitory", group: "optional", category: "boarding", frequency: "monthly", inflation: "general" },
  { code: "international_program", label: "International program", labelEn: "International program", group: "optional", category: "tuition", frequency: "annual", inflation: "school" },
  { code: "exchange_program", label: "Exchange program", labelEn: "Exchange program", group: "optional", category: "activities", frequency: "one_time", inflation: "school" },
  { code: "competition", label: "Kompetisi", labelEn: "Competition", group: "optional", category: "activities", frequency: "annual", inflation: "education" },
  { code: "private_tutor", label: "Private tutor", labelEn: "Private tutor", group: "optional", category: "courses", frequency: "monthly", inflation: "education" },
  { code: "certification", label: "Sertifikasi", labelEn: "Certification", group: "optional", category: "courses", frequency: "annual", inflation: "education" },
  { code: "summer_program", label: "Summer program", labelEn: "Summer program", group: "optional", category: "activities", frequency: "annual", inflation: "education" },
  { code: "other", label: "Lainnya", labelEn: "Other", group: "optional", category: "other", frequency: "annual", inflation: "general" },
];

const byCode = new Map(FEE_CATALOG.map((e) => [e.code, e]));

export function catalogEntry(code: string): CatalogEntry | undefined {
  return byCode.get(code);
}

export const GROUP_LABEL: Record<CostGroup, string> = {
  entry: "A. Biaya masuk",
  recurring: "B. Biaya rutin sekolah",
  operational: "C. Biaya operasional",
  optional: "D. Biaya opsional",
};

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  entry: "Uang masuk",
  tuition: "SPP / tuition",
  annual: "Biaya tahunan",
  books: "Buku & alat tulis",
  uniform: "Seragam",
  transport: "Transportasi",
  meals: "Makan & uang saku",
  activities: "Kegiatan",
  technology: "Teknologi",
  courses: "Les & kursus",
  boarding: "Asrama / biaya hidup",
  other: "Lainnya",
};

/** Canonical order for waterfall / breakdown displays. */
export const CATEGORY_ORDER: CostCategory[] = [
  "tuition",
  "entry",
  "annual",
  "books",
  "uniform",
  "transport",
  "meals",
  "activities",
  "technology",
  "courses",
  "boarding",
  "other",
];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  one_time: "sekali (saat masuk jenjang)",
  monthly: "per bulan",
  semester: "per semester",
  annual: "per tahun",
};

export const LEVEL_LABEL: Record<Level, string> = {
  TK: "TK",
  SD: "SD",
  SMP: "SMP",
  SMA: "SMA",
  SMK: "SMK",
  D3: "D3",
  S1: "S1",
  S2: "S2",
};

/** RFC 4122 v4 id (crypto.randomUUID when available — insecure contexts fall back to Math.random). */
export function newId(_prefix = "id"): string {
  void _prefix;
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Build a component from a catalog code. Unknown codes become "other". */
export function makeComponent(code: string, amount: number, overrides: Partial<FeeComponent> = {}): FeeComponent {
  const e = catalogEntry(code) ?? catalogEntry("other")!;
  return {
    id: overrides.id ?? newId("fc"),
    code: e.code === "other" && code !== "other" ? code : e.code,
    label: overrides.label ?? e.label,
    group: overrides.group ?? e.group,
    category: overrides.category ?? e.category,
    frequency: overrides.frequency ?? e.frequency,
    inflation: overrides.inflation ?? e.inflation,
    amount,
    ...overrides,
  } as FeeComponent;
}

/** Labels for fee lines tracked in the historical cost series. */
export const COMPONENT_HISTORY_LABEL: Record<string, string> = {
  spp_monthly: "SPP bulanan",
  semester_fee: "UKT / biaya semester",
  tuition_fee: "Tuition tahunan",
  uang_pangkal: "Uang masuk (total)",
  annual_fee: "Biaya tahunan",
};
