import type { Assumptions, InflationKey, Level, RiskProfileLevel } from "./types";

/**
 * Default planning assumptions. These are ASSUMPTIONS, not data: every one is editable in
 * Settings, and every output that uses one lists it under "Assumption" in its explanation.
 * Reference points that informed the defaults are documented in ASSUMPTION_NOTES.
 */
export const DEFAULT_LEVEL_DURATIONS: Record<Level, number> = {
  TK: 2,
  SD: 6,
  SMP: 3,
  SMA: 3,
  SMK: 3,
  D3: 3,
  S1: 4,
  S2: 2,
};

export const DEFAULT_INFLATION: Record<InflationKey, number> = {
  general: 0.035,
  education: 0.06,
  privateSchool: 0.07,
  internationalSchool: 0.08,
  university: 0.05,
};

/**
 * Why each default is what it is. Figures quoted here come from the bundled references
 * (data/research/macro.json) and the school database history; they inform — not replace —
 * the user's own assumptions.
 */
export const ASSUMPTION_NOTES: { key: string; text: string }[] = [
  {
    key: "general",
    text: "Inflasi umum 3,5%: sedikit di atas rata-rata inflasi IHK nasional Desember-yoy 2019–2025 sebesar 2,70% (data Bank Indonesia), sebagai margin kehati-hatian untuk horizon panjang.",
  },
  {
    key: "education",
    text: "Inflasi pendidikan 6% (base case spesifikasi). Catatan: inflasi kelompok Pendidikan BPS hanya 1,2–2,8% per tahun (2020–2025, dikutip media) karena didominasi biaya sekolah negeri; angka itu tidak mewakili kenaikan biaya sekolah swasta.",
  },
  {
    key: "privateSchool",
    text: "Sekolah swasta 7%: median CAGR SPP bulanan di database = 5,3%/tahun (8 sekolah Depok/Bogor, rentang 1,2–17%, sumber campuran resmi & media) ditambah margin. Gunakan data historis sekolah spesifik bila tersedia — aplikasi memberi alert bila historis sekolah melebihi asumsi.",
  },
  {
    key: "internationalSchool",
    text: "Sekolah internasional 8%: belum ada data multi-tahun di database (asumsi murni). Periksa jadwal biaya resmi sekolah.",
  },
  {
    key: "university",
    text: "Perguruan tinggi 5%: UKT & IPI PTN di database (UI, IPB) tidak berubah TA 2024/25–2026/27; kenaikan UKT bergantung kebijakan sehingga tetap diberi asumsi kenaikan.",
  },
  {
    key: "returns",
    text: "Return dana pendidikan 8% = base case spesifikasi (asumsi, bukan jaminan). Pembanding per 27 Sep 2026: BI-Rate 5,75% (23 Sep 2026), yield SBN 10 tahun 7,08% (Trading Economics, 25 Sep 2026), tingkat bunga penjaminan LPS 3,75% (1 Jul–30 Sep 2026). Return kas 3% ≈ bunga deposito setelah pajak.",
  },
  {
    key: "public",
    text: "SMA/SMK negeri Jawa Barat tidak memungut SPP sejak TA 2025/2026 (pernyataan Gubernur, Juli 2026) dan SD/SMP negeri dilarang memungut biaya satuan pendidikan (Permendikbud 44/2012). Putusan MK 3/PUU-XXII/2024 mewajibkan pendidikan dasar (SD–SMP) tanpa biaya termasuk swasta; menurut pemohon (JPPI, Mei 2026) belum dilaksanakan — belum ada laporan resmi implementasi. Perlu verifikasi berkala.",
  },
];

export const DEFAULT_PROFILE_RETURNS: Record<RiskProfileLevel, number> = {
  conservative: 0.05,
  moderate: 0.06,
  balanced: 0.07,
  growth: 0.085,
  aggressive: 0.1,
};

export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultAssumptions(planDate = todayIso()): Assumptions {
  return {
    planDate,
    inflation: { ...DEFAULT_INFLATION },
    returns: {
      education: 0.08,
      retirement: 0.08,
      postRetirement: 0.06,
      general: 0.07,
      cash: 0.03,
    },
    savingScenarios: { conservative: 0.05, base: 0.08, optimistic: 0.11 },
    contributionFrequency: 12,
    sdEntryAge: 6,
    levelDurations: { ...DEFAULT_LEVEL_DURATIONS },
    affordabilityThresholds: [0.1, 0.2, 0.3, 0.4],
    partialFundingThreshold: 0.75,
    emergencyFundTargetMonths: 6,
    lifeExpectancy: 80,
    retirementExpenseRatio: 0.7,
    projectionYears: 30,
    staleDataMonths: 12,
    surplusInvestShare: 0,
    profileReturns: { ...DEFAULT_PROFILE_RETURNS },
  };
}

export const INFLATION_LABEL: Record<InflationKey, string> = {
  general: "Inflasi umum (IHK)",
  education: "Inflasi pendidikan",
  privateSchool: "Inflasi sekolah swasta",
  internationalSchool: "Inflasi sekolah internasional",
  university: "Inflasi perguruan tinggi",
};

export const RETURN_LABEL: Record<keyof Assumptions["returns"], string> = {
  education: "Return dana pendidikan",
  retirement: "Return dana pensiun (sebelum pensiun)",
  postRetirement: "Return dana pensiun (setelah pensiun)",
  general: "Return investasi umum",
  cash: "Return kas / tabungan",
};
