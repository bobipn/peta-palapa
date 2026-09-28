import type { RiskAnswers, RiskProfileLevel } from "./types";

/**
 * Risk profile questionnaire (spec §12).
 * Separates ABILITY to bear risk (horizon, income stability, emergency fund, debt, liquidity)
 * from WILLINGNESS (experience, loss tolerance, objective). Standard practice: when the two
 * disagree, the more conservative one governs. The result is an analytical parameter only —
 * it does not guarantee any return and does not recommend specific products.
 */

export interface RiskQuestion {
  key: keyof RiskAnswers;
  dimension: "ability" | "willingness";
  question: string;
  options: { score: number; label: string }[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    key: "experience",
    dimension: "willingness",
    question: "Pengalaman investasi Anda",
    options: [
      { score: 1, label: "Belum pernah berinvestasi" },
      { score: 2, label: "Hanya tabungan / deposito" },
      { score: 3, label: "Reksa dana pasar uang / obligasi / SBN ritel" },
      { score: 4, label: "Reksa dana saham atau saham < 3 tahun" },
      { score: 5, label: "Saham / aset berisiko tinggi > 3 tahun" },
    ],
  },
  {
    key: "horizon",
    dimension: "ability",
    question: "Kapan sebagian besar dana ini akan dipakai?",
    options: [
      { score: 1, label: "< 1 tahun" },
      { score: 2, label: "1–3 tahun" },
      { score: 3, label: "3–5 tahun" },
      { score: 4, label: "5–10 tahun" },
      { score: 5, label: "> 10 tahun" },
    ],
  },
  {
    key: "incomeStability",
    dimension: "ability",
    question: "Stabilitas penghasilan keluarga",
    options: [
      { score: 1, label: "Sangat tidak stabil" },
      { score: 2, label: "Tidak menentu (komisi / freelance)" },
      { score: 3, label: "Cukup stabil" },
      { score: 4, label: "Stabil (karyawan tetap / ASN)" },
      { score: 5, label: "Sangat stabil, lebih dari satu sumber" },
    ],
  },
  {
    key: "emergencyFund",
    dimension: "ability",
    question: "Dana darurat yang tersedia",
    options: [
      { score: 1, label: "Tidak ada" },
      { score: 2, label: "< 3 bulan pengeluaran" },
      { score: 3, label: "3–6 bulan" },
      { score: 4, label: "6–12 bulan" },
      { score: 5, label: "> 12 bulan" },
    ],
  },
  {
    key: "debtLevel",
    dimension: "ability",
    question: "Cicilan utang terhadap penghasilan",
    options: [
      { score: 1, label: "> 50%" },
      { score: 2, label: "35–50%" },
      { score: 3, label: "20–35%" },
      { score: 4, label: "< 20%" },
      { score: 5, label: "Tidak ada utang" },
    ],
  },
  {
    key: "lossTolerance",
    dimension: "willingness",
    question: "Jika nilai investasi turun 20% dalam setahun, Anda akan…",
    options: [
      { score: 1, label: "Menjual semua" },
      { score: 2, label: "Menjual sebagian" },
      { score: 3, label: "Menahan dan khawatir" },
      { score: 4, label: "Menahan, menunggu pulih" },
      { score: 5, label: "Menambah investasi" },
    ],
  },
  {
    key: "objective",
    dimension: "willingness",
    question: "Tujuan utama investasi",
    options: [
      { score: 1, label: "Menjaga nilai pokok" },
      { score: 2, label: "Pendapatan stabil" },
      { score: 3, label: "Pertumbuhan moderat + pendapatan" },
      { score: 4, label: "Pertumbuhan jangka panjang" },
      { score: 5, label: "Pertumbuhan maksimal" },
    ],
  },
  {
    key: "liquidity",
    dimension: "ability",
    question: "Bagian dana yang mungkin dibutuhkan dalam 2 tahun",
    options: [
      { score: 1, label: "> 50%" },
      { score: 2, label: "25–50%" },
      { score: 3, label: "10–25%" },
      { score: 4, label: "< 10%" },
      { score: 5, label: "Tidak ada" },
    ],
  },
];

export const PROFILE_ORDER: RiskProfileLevel[] = ["conservative", "moderate", "balanced", "growth", "aggressive"];

export const PROFILE_LABEL: Record<RiskProfileLevel, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  balanced: "Balanced",
  growth: "Growth",
  aggressive: "Aggressive",
};

/** Illustrative asset-class mix per profile — for analysis only, not a product recommendation. */
export const ILLUSTRATIVE_ALLOCATION: Record<RiskProfileLevel, { cash: number; fixedIncome: number; equity: number }> = {
  conservative: { cash: 0.4, fixedIncome: 0.5, equity: 0.1 },
  moderate: { cash: 0.25, fixedIncome: 0.5, equity: 0.25 },
  balanced: { cash: 0.15, fixedIncome: 0.4, equity: 0.45 },
  growth: { cash: 0.1, fixedIncome: 0.25, equity: 0.65 },
  aggressive: { cash: 0.05, fixedIncome: 0.15, equity: 0.8 },
};

export function profileFromAverage(avg: number): RiskProfileLevel {
  if (avg < 1.8) return "conservative";
  if (avg < 2.6) return "moderate";
  if (avg < 3.4) return "balanced";
  if (avg < 4.2) return "growth";
  return "aggressive";
}

export interface RiskResult {
  complete: boolean;
  answered: number;
  totalScore: number;
  abilityAverage: number;
  willingnessAverage: number;
  ability: RiskProfileLevel;
  willingness: RiskProfileLevel;
  profile: RiskProfileLevel;
  governedBy: "ability" | "willingness" | "both";
}

export function scoreRisk(answers: RiskAnswers | undefined): RiskResult {
  const a = answers ?? {};
  const ability: number[] = [];
  const willingness: number[] = [];
  for (const q of RISK_QUESTIONS) {
    const v = a[q.key];
    if (typeof v !== "number") continue;
    (q.dimension === "ability" ? ability : willingness).push(v);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const abilityAverage = avg(ability);
  const willingnessAverage = avg(willingness);
  const ab = profileFromAverage(abilityAverage || 1);
  const wi = profileFromAverage(willingnessAverage || 1);
  const ia = PROFILE_ORDER.indexOf(ab);
  const iw = PROFILE_ORDER.indexOf(wi);
  return {
    complete: ability.length + willingness.length === RISK_QUESTIONS.length,
    answered: ability.length + willingness.length,
    totalScore: [...ability, ...willingness].reduce((s, x) => s + x, 0),
    abilityAverage,
    willingnessAverage,
    ability: ab,
    willingness: wi,
    profile: PROFILE_ORDER[Math.min(ia, iw)],
    governedBy: ia === iw ? "both" : ia < iw ? "ability" : "willingness",
  };
}

/** Suggested answers derived from the family's own data (the user can override them). */
export function suggestedAnswers(input: {
  emergencyMonths: number;
  debtToIncome: number;
  yearsToFirstMajorPayment: number | null;
}): Partial<RiskAnswers> {
  const e = input.emergencyMonths;
  const d = input.debtToIncome;
  const y = input.yearsToFirstMajorPayment;
  return {
    emergencyFund: e <= 0 ? 1 : e < 3 ? 2 : e < 6 ? 3 : e <= 12 ? 4 : 5,
    debtLevel: d <= 0 ? 5 : d < 0.2 ? 4 : d < 0.35 ? 3 : d <= 0.5 ? 2 : 1,
    horizon: y === null ? undefined : y < 1 ? 1 : y < 3 ? 2 : y < 5 ? 3 : y <= 10 ? 4 : 5,
  };
}

/** Goal-based horizon buckets: money needed sooner warrants lower risk, whatever the profile. */
export interface HorizonBucket {
  key: "short" | "medium" | "long";
  label: string;
  amountNominal: number;
  amountPv: number;
  note: string;
}

export function horizonBuckets(
  withdrawals: { month: number; amount: number }[],
  annualReturn: number,
): HorizonBucket[] {
  const rm = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const b = { short: [0, 0], medium: [0, 0], long: [0, 0] } as Record<HorizonBucket["key"], [number, number]>;
  for (const w of withdrawals) {
    const k: HorizonBucket["key"] = w.month <= 36 ? "short" : w.month <= 84 ? "medium" : "long";
    b[k][0] += w.amount;
    b[k][1] += w.amount / Math.pow(1 + rm, w.month);
  }
  return [
    { key: "short", label: "≤ 3 tahun", amountNominal: b.short[0], amountPv: b.short[1], note: "Umumnya ditempatkan pada instrumen likuid berisiko rendah." },
    { key: "medium", label: "3–7 tahun", amountNominal: b.medium[0], amountPv: b.medium[1], note: "Campuran pendapatan tetap dan pertumbuhan, disesuaikan profil." },
    { key: "long", label: "> 7 tahun", amountNominal: b.long[0], amountPv: b.long[1], note: "Ruang untuk porsi pertumbuhan lebih besar sesuai profil risiko." },
  ];
}
