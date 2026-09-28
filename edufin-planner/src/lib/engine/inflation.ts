import { INFLATION_LABEL } from "./defaults";
import { formatPct, formatRp } from "../format";
import { cagr, median } from "./tvm";
import type {
  Assumptions,
  ComponentInflation,
  Explain,
  FeeHistoryPoint,
  InflationKey,
  Level,
  School,
} from "./types";
import { UNIVERSITY_LEVELS } from "./types";

export function isUniversityLevel(level: Level): boolean {
  return UNIVERSITY_LEVELS.includes(level);
}

/** Which school-type inflation parameter applies to school-charged fees. */
export function schoolInflationKey(school: Pick<School, "ownership" | "categories"> | undefined, level: Level): InflationKey {
  if (isUniversityLevel(level)) return "university";
  if (!school) return "education";
  if (school.categories.includes("International") || school.categories.includes("IB")) return "internationalSchool";
  if (school.ownership === "swasta") return "privateSchool";
  return "education";
}

export function resolveComponentInflation(
  inflation: ComponentInflation,
  schoolKey: InflationKey,
): InflationKey {
  if (inflation === "school") return schoolKey;
  if (inflation === "education") return "education";
  return "general";
}

export function inflationRate(a: Assumptions, key: InflationKey): number {
  return a.inflation[key];
}

/** Future Cost = Current Cost × (1 + i)^n  (spec §7) */
export function inflate(amount: number, rate: number, years: number): number {
  return amount * Math.pow(1 + rate, years);
}

export function explainFutureCost(
  title: string,
  amount: number,
  rate: number,
  years: number,
  key: InflationKey,
  unit = "",
): Explain {
  const result = inflate(amount, rate, years);
  return {
    title,
    inputs: [
      { label: "Biaya saat ini", value: `${formatRp(amount)}${unit}` },
      { label: INFLATION_LABEL[key], value: formatPct(rate) },
      { label: "Jumlah tahun (n)", value: String(years) },
    ],
    formula: "Future Cost = Current Cost × (1 + inflasi)^n",
    substitution: `${formatRp(amount)} × (1 + ${formatPct(rate)})^${years}`,
    assumptions: [
      `${INFLATION_LABEL[key]} ${formatPct(rate)} per tahun (parameter yang dapat diubah).`,
      "Kenaikan biaya diterapkan per tahun ajaran (Juli).",
    ],
    result: `${formatRp(result)}${unit}`,
  };
}

// ---------------------------------------------------------------------------
// Historical school cost inflation (spec §6)
// ---------------------------------------------------------------------------

export interface YoyChange {
  fromYear: number;
  toYear: number;
  from: number;
  to: number;
  /** Annualized when the gap between observations is more than one year. */
  rate: number;
  annualized: boolean;
}

export interface HistoricalStats {
  points: { year: number; amount: number; pointId: string }[];
  yoy: YoyChange[];
  oneYear: number | null;
  cagr3: number | null;
  cagr5: number | null;
  /** CAGR over the full observed span. */
  cagrAll: number | null;
  spanYears: number;
  median: number | null;
  min: number | null;
  max: number | null;
  sufficient: boolean;
}

/**
 * Compute growth statistics from observations of a single fee line.
 * Duplicate years keep the observation with the highest confidence (then the latest verification).
 */
export function historicalStats(points: FeeHistoryPoint[]): HistoricalStats {
  const rank = { high: 3, medium: 2, low: 1 } as const;
  const byYear = new Map<number, FeeHistoryPoint>();
  for (const p of points) {
    const year = Number(p.academicYear.slice(0, 4));
    if (!Number.isFinite(year) || !(p.amount > 0)) continue;
    const prev = byYear.get(year);
    if (
      !prev ||
      rank[p.provenance.confidence] > rank[prev.provenance.confidence] ||
      (rank[p.provenance.confidence] === rank[prev.provenance.confidence] &&
        (p.provenance.lastVerified ?? "") > (prev.provenance.lastVerified ?? ""))
    ) {
      byYear.set(year, p);
    }
  }
  const sorted = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, p]) => ({ year, amount: p.amount, pointId: p.id }));

  const yoy: YoyChange[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const gap = b.year - a.year;
    yoy.push({
      fromYear: a.year,
      toYear: b.year,
      from: a.amount,
      to: b.amount,
      rate: gap === 1 ? b.amount / a.amount - 1 : cagr(a.amount, b.amount, gap),
      annualized: gap > 1,
    });
  }

  const latest = sorted[sorted.length - 1];
  const find = (year: number) => sorted.find((p) => p.year === year);
  const cagrN = (n: number): number | null => {
    if (!latest) return null;
    const start = find(latest.year - n);
    return start ? cagr(start.amount, latest.amount, n) : null;
  };
  const rates = yoy.map((y) => y.rate);
  const first = sorted[0];
  const spanYears = latest && first ? latest.year - first.year : 0;

  return {
    points: sorted,
    yoy,
    oneYear: (() => {
      const last = yoy[yoy.length - 1];
      return last && !last.annualized ? last.rate : null;
    })(),
    cagr3: cagrN(3),
    cagr5: cagrN(5),
    cagrAll: spanYears > 0 && first && latest ? cagr(first.amount, latest.amount, spanYears) : null,
    spanYears,
    median: rates.length ? median(rates) : null,
    min: rates.length ? Math.min(...rates) : null,
    max: rates.length ? Math.max(...rates) : null,
    sufficient: sorted.length >= 2,
  };
}

/**
 * The historical rate the app may compare against the assumption: prefer the longest standard
 * window available (5y, then 3y, then full span). Returns null when data is insufficient —
 * callers must then fall back to the assumption and label it as such.
 */
export function representativeHistoricalRate(stats: HistoricalStats): { rate: number; basis: string } | null {
  if (stats.cagr5 !== null) return { rate: stats.cagr5, basis: "CAGR 5 tahun" };
  if (stats.cagr3 !== null) return { rate: stats.cagr3, basis: "CAGR 3 tahun" };
  if (stats.cagrAll !== null) return { rate: stats.cagrAll, basis: `CAGR ${stats.spanYears} tahun` };
  return null;
}

export function explainHistorical(stats: HistoricalStats, label: string): Explain {
  const last = stats.yoy[stats.yoy.length - 1];
  return {
    title: `Inflasi historis — ${label}`,
    inputs: stats.points.map((p) => ({ label: `TA ${p.year}/${p.year + 1}`, value: formatRp(p.amount) })),
    formula:
      "Kenaikan tahunan = (Biaya tahun ini / Biaya tahun sebelumnya) − 1; CAGR n tahun = (Biaya akhir / Biaya awal)^(1/n) − 1",
    substitution: last
      ? `(${formatRp(last.to)} / ${formatRp(last.from)})${last.annualized ? `^(1/${last.toYear - last.fromYear})` : ""} − 1 = ${formatPct(last.rate)}`
      : undefined,
    assumptions: stats.sufficient
      ? ["Hanya observasi dengan sumber tercatat yang dipakai; jarak >1 tahun disetahunkan (annualized)."]
      : ["Data historis kurang dari 2 observasi — aplikasi memakai parameter asumsi, bukan data aktual."],
    result: stats.sufficient
      ? [
          stats.oneYear !== null ? `1 tahun: ${formatPct(stats.oneYear)}` : null,
          stats.cagr3 !== null ? `CAGR 3 th: ${formatPct(stats.cagr3)}` : null,
          stats.cagr5 !== null ? `CAGR 5 th: ${formatPct(stats.cagr5)}` : null,
          stats.median !== null ? `Median: ${formatPct(stats.median)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Data tidak cukup",
  };
}
