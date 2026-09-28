#!/usr/bin/env node
/**
 * Builds the bundled school database (src/lib/data/schools.seed.json) and the macro references
 * (src/lib/data/references.json) from the provenance records in data/research/*.json.
 *
 * Principles
 * - Never invent a number. Every amount comes from a research record that carries its source URL,
 *   access date, academic year and a verbatim snippet.
 * - Transformations are conservative and always written onto the component
 *   (note / excludedReason / estimated / frequencyInferred / tier*, fromGrade/toGrade).
 * - Alternatives (UKT groups, Putra/Putri, class type) become tiers: only one member is summed.
 * - Printed totals and conditional charges are kept for transparency but excluded from sums.
 *
 * Usage: node scripts/build-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/research", f), "utf8"));
const CURRENT_AY = 2026; // research date 2026-09-27 → TA 2026/2027
const SKS_PER_SEMESTER = 20; // assumption for per-SKS rates (UIKA fee decree: semester 1 = 20 SKS)

const OFFICIAL = new Set([
  "official_school_website",
  "official_brochure_pdf",
  "official_social_media",
  "official_university_website",
  "official_decree_pdf",
  "official_admission_site",
]);

// Catalog subset needed to classify components (kept in sync with src/lib/engine/catalog.ts).
const CATALOG = {
  registration_fee: ["entry", "general"],
  form_fee: ["entry", "general"],
  uang_pangkal: ["entry", "general"],
  deposit: ["entry", "general"],
  initial_uniform: ["uniform", "general"],
  initial_books: ["books", "education"],
  equipment: ["other", "general"],
  device_laptop: ["technology", "general"],
  spp_monthly: ["tuition", "school"],
  tuition_fee: ["tuition", "school"],
  semester_fee: ["tuition", "school"],
  annual_fee: ["annual", "school"],
  activity_fee: ["activities", "school"],
  technology_fee: ["technology", "school"],
  lab_fee: ["annual", "school"],
  library_fee: ["annual", "school"],
  exam_fee: ["annual", "school"],
  extracurricular: ["activities", "school"],
  transport: ["transport", "general"],
  shuttle: ["transport", "general"],
  meals: ["meals", "general"],
  books: ["books", "education"],
  uniform: ["uniform", "general"],
  boarding: ["boarding", "school"],
  exchange_program: ["activities", "school"],
  study_tour: ["activities", "school"],
  other: ["other", "general"],
};

const warnings = [];

function normAY(label) {
  const s = String(label ?? "");
  let m = /(\d{4})\s*[/\-–]\s*(\d{2,4})/.exec(s);
  if (m) return { ay: `${m[1]}/${Number(m[1]) + 1}`, start: Number(m[1]) };
  m = /(\d{4})/.exec(s);
  if (m) return { ay: `${m[1]}/${Number(m[1]) + 1}`, start: Number(m[1]), intakeOnly: true };
  return null;
}

function slug(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

function displayName(name) {
  const stripped = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return stripped.length >= 6 ? stripped : name;
}

const clip = (s, n = 260) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? undefined);

function classify(name, freq, group) {
  const n = name.toLowerCase();
  if (/total pembayaran|^total\b|^jumlah\b|subtotal/.test(n)) return "__total";
  if (/uang pangkal|dana pengembangan|development|uang gedung|building|\bdpp\b|dppos|infa[qk]|investasi pendidikan|biaya masuk|entrance|admission|sumbangan pembangunan|\bdsp\b|\bsps\b|\bipi\b|\bbpif\b|\busp\b|uang masuk|biaya pmb|dana pendidikan|sarana|biaya awal masuk/.test(n))
    return "uang_pangkal";
  if (/formulir|\bform\b|application fee|seleksi|psikotes|observasi|tes masuk/.test(n)) return "form_fee";
  if (/daftar ulang|re-?registration|dana tahunan|annual fee|uang tahunan|biaya tahunan|iuran tahunan|annual development/.test(n)) return "annual_fee";
  if (/pendaftaran|registration|\bupm\b/.test(n)) return "registration_fee";
  if (/spp|tuition|\bukt\b|\bbpp\b|iuran bulanan|uang sekolah|biaya pendidikan bulanan|biaya semester|\bsks\b|biaya uas/.test(n)) {
    if (freq === "monthly") return "spp_monthly";
    if (freq === "semester") return /uas/.test(n) ? "exam_fee" : "semester_fee";
    return "tuition_fee";
  }
  if (/seragam|uniform/.test(n)) return group === "entry" ? "initial_uniform" : "uniform";
  if (/buku|book|literatur|kitab/.test(n)) return group === "entry" ? "initial_books" : "books";
  if (/asrama|boarding|dormitory|mondok|\bphh\b/.test(n)) return "boarding";
  if (/katering|catering|makan|meal|snack|lunch/.test(n)) return "meals";
  if (/antar jemput|jemputan|shuttle|transport|\bbus\b/.test(n)) return "shuttle";
  if (/laptop|ipad|tablet|device|chromebook|gadget/.test(n)) return "device_laptop";
  if (/teknologi|technology|\bict\b|platform/.test(n)) return "technology_fee";
  if (/praktikum|\blab\b|laborator/.test(n)) return "lab_fee";
  if (/perpustakaan|library/.test(n)) return "library_fee";
  if (/ujian|exam|\buts\b|assessment|checkpoint/.test(n)) return "exam_fee";
  if (/ekstra|ekskul|extracurricular/.test(n)) return "extracurricular";
  if (/study tour|field trip|outing|immersion|umro?h|luar negeri|exchange/.test(n)) return group === "optional" ? "exchange_program" : "study_tour";
  if (/kegiatan|activity|kesiswaan|osis|program pembelajaran|keterampilan|pengembangan \(1 tahun\)|biaya pengembangan/.test(n)) return "activity_fee";
  if (/deposit|jaminan/.test(n)) return "deposit";
  if (/peralatan|perlengkapan|equipment|kasur|lemari/.test(n)) return "equipment";
  return "other";
}

const GRADE_OFFSET = { TK: 0, SD: 0, SMP: 6, SMA: 9, SMK: 9, D3: 0, S1: 0, S2: 0 };

function gradeRange(name, notes, level) {
  const text = `${name} ${notes ?? ""}`;
  const off = GRADE_OFFSET[level] ?? 0;
  let m = /kelas\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/i.exec(name);
  if (m) return { fromGrade: Number(m[1]) - off, toGrade: Number(m[2]) - off };
  m = /mulai kelas\s*(\d{1,2})/i.exec(text);
  if (m) return { fromGrade: Number(m[1]) - off };
  if (/mulai tahun ke-?\s*2|tahun berikutnya|second year|tahun ke-?\s*2\)|mulai tahun kedua|from the second year/i.test(text)) return { fromGrade: 2 };
  return {};
}

function resolveFrequency(c, group, isUniversity) {
  const f = c.frequency;
  const n = c.name.toLowerCase();
  if (/tahun pertama|first year only/.test(n)) return { frequency: "one_time", inferred: f !== "one_time" };
  if (f === "one_time" || f === "monthly" || f === "semester" || f === "annual") return { frequency: f };
  if (f === "first_semester_only") return { frequency: "one_time" };
  if (f === "per_sks") return { frequency: "semester", perSks: true };
  if (f === "conditional" || f === "first_year_entry_total") return { frequency: "one_time", exclude: true };
  // Not stated by the source: infer conservatively and flag it.
  if (group === "entry" || c.category === "other") return { frequency: "one_time", inferred: true };
  if (group === "recurring") {
    if (/spp|bulan|monthly/.test(n)) return { frequency: "monthly", inferred: true };
    if (isUniversity) return { frequency: "semester", inferred: true };
    return { frequency: "annual", inferred: true };
  }
  if (group === "operational") return { frequency: "monthly", inferred: true };
  if (/asrama|boarding/.test(n)) return { frequency: "monthly", inferred: true };
  return { frequency: "one_time", inferred: true };
}

const GROUPS = new Set(["entry", "recurring", "operational", "optional"]);

function mapComponents(raw, { level, isUniversity, schoolName, scheduleId }) {
  const hasPerSks = raw.some((c) => c.frequency === "per_sks");
  const out = raw.map((c, i) => {
    const group = GROUPS.has(c.category) ? c.category : c.frequency === "one_time" ? "entry" : "recurring";
    const fr = resolveFrequency(c, group, isUniversity);
    let code = classify(c.name, fr.frequency, group);
    const amountRaw = c.amount ?? c.amount_max ?? c.amount_min ?? null;
    const notes = [];
    if (c.notes) notes.push(c.notes);
    const comp = {
      id: `${scheduleId}-c${i + 1}`,
      code: code === "__total" ? "other" : code,
      label: c.name,
      group,
      category: (CATALOG[code] ?? CATALOG.other)[0],
      frequency: fr.frequency,
      amount: amountRaw ?? 0,
      inflation: group === "entry" || group === "recurring" ? "school" : (CATALOG[code] ?? CATALOG.other)[1],
      verbatim: clip(c.verbatim),
    };
    if (group === "entry" && comp.category === "tuition") comp.category = "entry";
    if (c.amount === null && (c.amount_min !== null || c.amount_max !== null)) {
      comp.amountMin = c.amount_min ?? undefined;
      comp.amountMax = c.amount_max ?? undefined;
      notes.push(`Sumber memberi rentang ${c.amount_min ?? "?"}–${c.amount_max ?? "?"}; perencanaan memakai nilai tertinggi (konservatif).`);
    }
    if (fr.inferred) {
      comp.frequencyInferred = true;
      notes.push(`Frekuensi tidak dinyatakan sumber; diasumsikan ${fr.frequency === "one_time" ? "sekali saat masuk" : fr.frequency === "monthly" ? "bulanan" : fr.frequency === "semester" ? "per semester" : "tahunan"}.`);
    }
    if (fr.perSks) {
      comp.amount = (amountRaw ?? 0) * SKS_PER_SEMESTER;
      comp.estimated = true;
      comp.code = /uas/i.test(c.name) ? "exam_fee" : "semester_fee";
      comp.category = /uas/i.test(c.name) ? "annual" : "tuition";
      comp.label = `${c.name} × ${SKS_PER_SEMESTER} SKS (estimasi)`;
      notes.push(`Estimasi = tarif Rp${amountRaw} per SKS × ${SKS_PER_SEMESTER} SKS/semester (asumsi beban SKS, bukan angka sumber).`);
    }
    if (code === "__total") {
      comp.excluded = true;
      comp.excludedReason = "Baris total tercetak di sumber — tidak dijumlahkan; komponen dihitung satu per satu.";
    }
    if (fr.exclude) {
      comp.excluded = true;
      comp.excludedReason = comp.excludedReason ?? "Biaya bersyarat / bukan biaya rutin — ditampilkan untuk transparansi, tidak dijumlahkan.";
    }
    if (amountRaw === null && !comp.excluded) {
      comp.excluded = true;
      comp.excludedReason = "Nominal tidak dinyatakan sumber.";
    }
    if (/dwiwarna/i.test(schoolName) && /daftar ulang/i.test(c.name)) {
      comp.excluded = true;
      comp.excludedReason = "Sumber tidak menjelaskan hubungan Daftar Ulang dengan Uang Pangkal (mungkin bagian darinya) — tidak dijumlahkan agar tidak dihitung ganda.";
    }
    if (hasPerSks && /semester\s*i\b/i.test(c.name) && /sks|uas/i.test(c.name)) {
      comp.excluded = true;
      comp.excludedReason = `Sudah tercakup dalam estimasi per-SKS × ${SKS_PER_SEMESTER} SKS/semester (nilai semester I sama dengan tarif × 20 SKS).`;
    }
    // Installments over N months (e.g. "payable monthly for 36 months")
    const inst = /(\d{2,3})\s*(bulan|months)/i.exec(c.notes ?? "");
    if (group === "entry" && fr.frequency === "monthly" && inst) comp.toGrade = Math.ceil(Number(inst[1]) / 12);
    Object.assign(comp, gradeRange(c.name, c.notes, level));
    // Tiers (mutually exclusive alternatives)
    const nm = c.name;
    if (/\bputra\b/i.test(nm) || /\bputri\b/i.test(nm)) {
      const base = nm.replace(/\([^)]*\)/g, "").replace(/\bputr[ai]\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
      comp.tierGroup = `gender:${base}`;
      comp.tierLabel = /\bputri\b/i.test(nm) ? "P" : "L";
    } else if (/^ukt\b/i.test(nm) && !/flat/i.test(nm) && /(\d+|\b[ivx]+\b)/i.test(nm.slice(3))) {
      comp.tierGroup = "ukt";
      comp.tierLabel = nm;
    } else if (/^ipi\b/i.test(nm) && /(\d|\b[ivx]+\b)/i.test(nm.slice(3)) && !/\(kki\)|\(iuran/i.test(nm)) {
      comp.tierGroup = "ipi";
      comp.tierLabel = nm;
    } else if (/^bpif\s+[ivx]+$/i.test(nm.trim())) {
      comp.tierGroup = "bpif";
      comp.tierLabel = nm;
    } else if (/^usp grade/i.test(nm)) {
      comp.tierGroup = "usp";
      comp.tierLabel = nm;
    } else if (/\(kelas (reguler|eksekutif)\)/i.test(nm)) {
      comp.tierGroup = "kelas";
      comp.tierLabel = /reguler/i.test(nm) ? "Reguler" : "Eksekutif";
      if (/reguler/i.test(nm)) comp.tierDefault = true;
    }
    if (group === "optional") comp.included = false;
    if (notes.length) comp.note = clip(notes.join(" "), 420);
    return comp;
  });
  // A "gender" tier with only one member is not an alternative.
  const counts = {};
  for (const c of out) if (c.tierGroup) counts[c.tierGroup] = (counts[c.tierGroup] ?? 0) + 1;
  for (const c of out) if (c.tierGroup && counts[c.tierGroup] < 2) {
    delete c.tierGroup;
    delete c.tierLabel;
    delete c.tierDefault;
  }
  return out;
}

function provenanceOf(fee, ayInfo, extraNote) {
  const src = fee.source;
  const official = OFFICIAL.has(src.source_type);
  const inferred = !!fee.academic_year_inferred || !!ayInfo.intakeOnly && false;
  let status;
  let confidence;
  const notes = [];
  if (ayInfo.start <= CURRENT_AY - 2) {
    status = "outdated";
    confidence = official ? "medium" : "low";
    notes.push(`Tahun ajaran ${ayInfo.ay} sudah ≥2 tahun lalu; dipakai sebagai data historis.`);
  } else if (official && src.evidence === "curl_verbatim" && !fee.academic_year_inferred) {
    status = "verified";
    confidence = "high";
  } else if (official) {
    status = "partially_verified";
    confidence = "medium";
    if (src.evidence === "curl_image_transcription") notes.push("Angka dibaca dari gambar/scan resmi secara visual — perlu dicek ulang manusia.");
    if (fee.academic_year_inferred) notes.push("Tahun ajaran disimpulkan dari tanggal publikasi.");
  } else if (src.source_type === "news_media") {
    status = "partially_verified";
    confidence = fee.academic_year_inferred ? "low" : "medium";
    notes.push("Sumber sekunder (media) — belum dicocokkan dengan dokumen resmi sekolah.");
  } else {
    status = "partially_verified";
    confidence = "low";
    notes.push("Sumber sekunder (blog/agregator) — keyakinan rendah.");
  }
  if (src.evidence_detail) notes.push(src.evidence_detail);
  if (extraNote) notes.push(extraNote);
  return {
    source: [src.publisher, src.title].filter(Boolean).join(" — "),
    sourceUrl: src.url,
    sourceType: OFFICIAL.has(src.source_type) || ["news_media", "education_portal_aggregator", "blog", "government"].includes(src.source_type) ? src.source_type : "education_portal_aggregator",
    dataDate: src.published_date ?? undefined,
    academicYear: ayInfo.ay,
    academicYearInferred: !!fee.academic_year_inferred || undefined,
    accessedDate: src.accessed_date,
    lastVerified: status === "verified" ? src.accessed_date : undefined,
    verificationStatus: status,
    confidence,
    evidence: src.evidence === "curl_image_transcription" ? "manual" : src.evidence,
    notes: clip(notes.join(" "), 600),
  };
}

const PRIMARY_PENALTY = /inklusi|inclusion|internal|alumni|pindahan|transfer|eksekutif|putri|sibling|kerjasama|\bbud\b|internasional|international|\bkki\b|asing|mandiri|talenta|osis/i;

/** A schedule without any tuition-type charge for a first-year student cannot stand in for a full year. */
function markCompleteness(fees) {
  for (const f of fees) {
    const ok = f.components.some(
      (c) => !c.excluded && c.group !== "optional" && c.category === "tuition" && (c.fromGrade ?? 1) <= 1,
    ) || f.components.some((c) => !c.excluded && c.group === "recurring" && c.frequency !== "one_time" && (c.fromGrade ?? 1) <= 1);
    if (!ok) {
      f.incomplete = true;
      f.notes = "Jadwal tidak memuat SPP/biaya rutin tahun pertama — tidak dipakai sebagai default; lengkapi bila memilih jadwal ini.";
    }
  }
}

function markPrimary(fees) {
  const groups = new Map();
  for (const f of fees) {
    const k = `${f.schoolId}|${f.level}|${f.academicYear}`;
    const list = groups.get(k) ?? [];
    list.push(f);
    groups.set(k, list);
  }
  for (const list of groups.values()) {
    const preK = (f) => f.level === "TK" && /\bPG\b|playgroup|kelompok bermain|\bKB\b|pre-?k/i.test(f.program ?? "") && !/TK\s*A/i.test(f.program ?? "");
    const score = (f) =>
      (f.incomplete ? 0 : 1000) + (PRIMARY_PENALTY.test(f.program ?? "") || preK(f) ? 0 : 100) + Math.min(20, f.components.length);
    list.sort((a, b) => score(b) - score(a));
    list[0].primary = true;
  }
}

// ---------------------------------------------------------------------------
// K-12 schools
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  Christian: "Kristen",
  Catholic: "Katolik",
  Islamic: "Islamic",
  Boarding: "Boarding",
  Nasional: "Nasional",
  "Nasional Plus": "Nasional Plus",
  International: "International",
  IB: "IB",
  Cambridge: "Cambridge",
  Montessori: "Montessori",
  "STEM-oriented": "STEM-oriented",
  "Sekolah Alam": "Sekolah Alam",
};

const schools = [];
const fees = [];
const usedIds = new Set();

function uniqueId(base) {
  let id = base;
  let i = 2;
  while (usedIds.has(id)) id = `${base}-${i++}`;
  usedIds.add(id);
  return id;
}

for (const [file, prefix] of [
  ["depok.json", "dpk"],
  ["bogor.json", "bgr"],
]) {
  const data = read(file);
  for (const s of data.schools) {
    const id = uniqueId(`${prefix}-${slug(displayName(s.school_name))}`);
    const categories = new Set([s.ownership === "negeri" ? "Negeri" : "Swasta"]);
    for (const c of s.categories ?? []) {
      if (CATEGORY_MAP[c]) categories.add(CATEGORY_MAP[c]);
      else warnings.push(`Unmapped category "${c}" (${s.school_name})`);
    }
    schools.push({
      id,
      name: displayName(s.school_name),
      foundation: s.foundation ?? undefined,
      ownership: s.ownership === "negeri" ? "negeri" : "swasta",
      levels: s.levels_offered,
      categories: [...categories],
      curricula: s.curriculum ?? [],
      location: {
        province: data.province ?? "Jawa Barat",
        city: s.city,
        district: s.district ?? undefined,
        address: s.address ?? undefined,
        lat: s.latitude ?? undefined,
        lng: s.longitude ?? undefined,
      },
      website: s.official_website ?? undefined,
      isUniversity: false,
      origin: "seed",
      notes: clip([s.school_name !== displayName(s.school_name) ? `Nama lengkap di sumber: ${s.school_name}.` : null, s.notes].filter(Boolean).join(" "), 900),
    });
    s.fees.forEach((fee, k) => {
      const ayInfo = normAY(fee.academic_year_normalized ?? fee.academic_year);
      if (!ayInfo) {
        warnings.push(`Skipped fee with unparseable academic year "${fee.academic_year}" (${s.school_name})`);
        return;
      }
      const scheduleId = `${id}-${fee.level.toLowerCase()}-${ayInfo.start}-${k + 1}`;
      const components = mapComponents(fee.components, { level: fee.level, isUniversity: false, schoolName: s.school_name, scheduleId });
      fees.push({
        id: scheduleId,
        schoolId: id,
        level: fee.level,
        program: fee.grade_or_program ?? undefined,
        academicYear: ayInfo.ay,
        monthsBilled: 12,
        components,
        provenance: provenanceOf(fee, ayInfo, /sph/i.test(id) ? "Label tahun berbeda antar halaman (EN 2027/2028 vs ID 2026/2027) — tahun belum pasti." : undefined),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

const UNI_CITY = {
  UI: "Kota Depok",
  IPB: "Kabupaten Bogor",
  UG: "Kota Depok",
  PNJ: "Kota Depok",
  UPNVJ: "Kota Depok",
  UNIDA: "Kabupaten Bogor",
  UIKA: "Kota Bogor",
  "Unhan RI": "Kabupaten Bogor",
  UNPAK: "Kota Bogor",
  Tazkia: "Kabupaten Bogor",
};

const uni = read("universities.json");
for (const u of uni.universities) {
  const short = u.short_name ?? u.name;
  const id = uniqueId(`univ-${slug(short)}`);
  const negeri = /negeri|kedinasan/i.test(u.ownership);
  const levels = new Set();
  for (const f of u.fees) levels.add(f.degree === "D3" ? "D3" : "S1");
  schools.push({
    id,
    name: u.name,
    ownership: negeri ? "negeri" : "swasta",
    levels: levels.size ? [...levels] : ["S1"],
    categories: [negeri ? "Negeri" : "Swasta"],
    curricula: [],
    location: {
      province: u.province ?? "Jawa Barat",
      city: UNI_CITY[short] ?? u.city,
      address: u.address ?? undefined,
    },
    website: u.official_website ?? undefined,
    isUniversity: true,
    origin: "seed",
    notes: clip(
      [
        `Status: ${u.ownership}. Lokasi di sumber riset: ${u.city}.`,
        u.fees.length ? null : "Belum ada data biaya terverifikasi (lihat catatan riset).",
        u.notes,
      ]
        .filter(Boolean)
        .join(" "),
      1200,
    ),
  });
  u.fees.forEach((fee, k) => {
    const ayInfo = normAY(fee.academic_year);
    if (!ayInfo) {
      warnings.push(`Skipped fee with unparseable year "${fee.academic_year}" (${u.name})`);
      return;
    }
    const level = fee.degree === "D3" ? "D3" : "S1";
    const scheduleId = `${id}-${level.toLowerCase()}-${ayInfo.start}-${k + 1}`;
    const components = mapComponents(fee.components, { level, isUniversity: true, schoolName: u.name, scheduleId });
    const degreeNote = fee.degree === "D4" ? "Program D4 (Sarjana Terapan, 4 tahun) dicatat pada jenjang S1 di aplikasi." : null;
    fees.push({
      id: scheduleId,
      schoolId: id,
      level,
      program: `${fee.program}${fee.admission_track ? ` · ${fee.admission_track}` : ""}`,
      academicYear: ayInfo.ay,
      monthsBilled: 12,
      components,
      provenance: provenanceOf(
        fee,
        ayInfo,
        [
          ayInfo.intakeOnly ? `Sumber menyebut tahun masuk ${fee.academic_year}; dicatat sebagai TA ${ayInfo.ay}.` : null,
          degreeNote,
          short === "UG" ? "Situs resmi tidak dapat diakses; data dari media/agregator yang saling berbeda — keyakinan rendah." : null,
          fee.notes,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    });
    if (short === "UG") fees[fees.length - 1].provenance.confidence = "low";
  });
}

markCompleteness(fees);
markPrimary(fees);

// ---------------------------------------------------------------------------
// Historical observations (same school & level, primary schedules across years)
// ---------------------------------------------------------------------------

function tierDefaultAmounts(components) {
  const groups = new Map();
  const out = [];
  for (const c of components) {
    if (c.excluded) continue;
    if (!c.tierGroup) {
      out.push(c);
      continue;
    }
    const list = groups.get(c.tierGroup) ?? [];
    list.push(c);
    groups.set(c.tierGroup, list);
  }
  for (const list of groups.values()) out.push(list.find((c) => c.tierDefault) ?? list.reduce((a, b) => (b.amount > a.amount ? b : a)));
  return out;
}

const history = [];
const byKey = new Map();
for (const f of fees) {
  const school = schools.find((s) => s.id === f.schoolId);
  // Universities: compare the same programme + track across years; schools: primary schedules.
  if (!school.isUniversity && !f.primary) continue;
  const progKey = school.isUniversity ? (f.program ?? "").toLowerCase().replace(/\s+/g, " ") : "";
  const key = `${f.schoolId}|${f.level}|${progKey}`;
  const list = byKey.get(key) ?? [];
  list.push(f);
  byKey.set(key, list);
}
for (const [key, list] of byKey) {
  const years = new Set(list.map((f) => f.academicYear));
  if (years.size < 2) continue;
  for (const f of list) {
    const comps = tierDefaultAmounts(f.components).filter((c) => (c.fromGrade ?? 1) <= 1);
    const lines = [
      ["spp_monthly", "monthly", comps.filter((c) => c.code === "spp_monthly")],
      ["semester_fee", "semester", comps.filter((c) => c.code === "semester_fee" && !c.estimated)],
      ["tuition_fee", "annual", comps.filter((c) => c.code === "tuition_fee" && c.frequency === "annual")],
      ["uang_pangkal", "one_time", comps.filter((c) => c.code === "uang_pangkal" && c.frequency === "one_time")],
    ];
    for (const [code, frequency, cs] of lines) {
      if (!cs.length) continue;
      const amount = cs.reduce((s, c) => s + c.amount, 0);
      if (!(amount > 0)) continue;
      history.push({
        id: `${f.id}-h-${code}`,
        schoolId: f.schoolId,
        level: f.level,
        program: f.program,
        componentCode: code,
        frequency,
        academicYear: f.academicYear,
        amount,
        provenance: {
          ...f.provenance,
          notes: clip(
            [
              code === "uang_pangkal" ? "Total komponen uang masuk pada jadwal tersebut; komposisi dapat berbeda antar tahun." : null,
              `Diambil dari jadwal: ${f.program ?? "-"}.`,
              f.provenance.notes,
            ]
              .filter(Boolean)
              .join(" "),
            600,
          ),
        },
      });
    }
  }
  void key;
}
// Keep only series that have ≥ 2 distinct years per component
const seriesYears = new Map();
for (const h of history) {
  const k = `${h.schoolId}|${h.level}|${h.componentCode}|${h.program && schools.find((s) => s.id === h.schoolId).isUniversity ? h.program : ""}`;
  const set = seriesYears.get(k) ?? new Set();
  set.add(h.academicYear);
  seriesYears.set(k, set);
}
const historyFinal = history.filter((h) => {
  const k = `${h.schoolId}|${h.level}|${h.componentCode}|${h.program && schools.find((s) => s.id === h.schoolId).isUniversity ? h.program : ""}`;
  return (seriesYears.get(k)?.size ?? 0) >= 2;
});

// ---------------------------------------------------------------------------
// Macro references
// ---------------------------------------------------------------------------

const macro = read("macro.json");
const refSource = (s) => ({
  url: s.url,
  title: s.title ?? undefined,
  publisher: s.publisher ?? undefined,
  sourceType: s.source_type,
  publishedDate: s.published_date ?? null,
  accessedDate: s.accessed_date,
  evidence: s.evidence,
});
const references = {
  researchedAt: macro.researched_at,
  inflationSeries: macro.inflation_series.map((x) => ({
    series: x.series,
    period: x.period,
    valuePct: x.value_pct,
    baseYear: x.base_year ?? undefined,
    verbatim: clip(x.verbatim, 300),
    source: refSource(x.source),
  })),
  policies: macro.policies.map((x) => ({
    topic: x.topic,
    summary: x.summary,
    statusAsOf2026: x.status_as_of_2026 ?? undefined,
    verbatim: clip(x.verbatim, 400),
    source: refSource(x.source),
  })),
  marketRates: macro.market_rates.map((x) => ({
    indicator: x.indicator,
    asOf: x.as_of,
    valuePct: x.value_pct,
    verbatim: clip(x.verbatim, 400),
    note: x.note ?? x.source?.note ?? undefined,
    source: refSource(x.source),
  })),
  estimates: macro.education_inflation_estimates.map((x) => ({
    who: x.who,
    claim: x.claim,
    basis: x.basis ?? undefined,
    verbatim: clip(x.verbatim, 400),
    source: refSource(x.source),
  })),
  gaps: macro.gaps,
};

// ---------------------------------------------------------------------------
// Write + report
// ---------------------------------------------------------------------------

const db = { generatedAt: "2026-09-27", schools, fees, history: historyFinal };
fs.writeFileSync(path.join(ROOT, "src/lib/data/schools.seed.json"), JSON.stringify(db));
fs.writeFileSync(path.join(ROOT, "src/lib/data/references.json"), JSON.stringify(references));

const count = (xs, f) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
console.log(`schools: ${schools.length} (universities ${schools.filter((s) => s.isUniversity).length})`);
console.log(`fee schedules: ${fees.length}`, count(fees, (f) => f.provenance.verificationStatus));
console.log(`components: ${fees.reduce((s, f) => s + f.components.length, 0)}; excluded ${fees.reduce((s, f) => s + f.components.filter((c) => c.excluded).length, 0)}; estimated ${fees.reduce((s, f) => s + f.components.filter((c) => c.estimated).length, 0)}; inferred freq ${fees.reduce((s, f) => s + f.components.filter((c) => c.frequencyInferred).length, 0)}; tiered ${fees.reduce((s, f) => s + f.components.filter((c) => c.tierGroup).length, 0)}`);
console.log(`history points: ${historyFinal.length}; incomplete schedules: ${fees.filter((f) => f.incomplete).length}`);
console.log(`references: ${references.inflationSeries.length} inflation, ${references.policies.length} policies, ${references.marketRates.length} rates`);
if (warnings.length) console.log("warnings:\n  " + warnings.join("\n  "));
