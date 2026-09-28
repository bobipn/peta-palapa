import { clamp } from "./tvm";

export type AffordabilityBand = "very_comfortable" | "healthy" | "moderate" | "high" | "aggressive";

export const BAND_LABEL: Record<AffordabilityBand, string> = {
  very_comfortable: "Very comfortable",
  healthy: "Healthy",
  moderate: "Moderate pressure",
  high: "High pressure",
  aggressive: "Financially aggressive",
};

export type Tone = "good" | "warning" | "serious" | "critical" | "info" | "neutral";

export const BAND_TONE: Record<AffordabilityBand, Tone> = {
  very_comfortable: "good",
  healthy: "good",
  moderate: "warning",
  high: "serious",
  aggressive: "critical",
};

/**
 * Education cost / household income, bucketed with configurable thresholds (spec §15).
 * The default thresholds (10/20/30/40%) are a planning convention in this app, not a universal standard.
 */
export function classifyAffordability(ratio: number, t: [number, number, number, number]): AffordabilityBand {
  if (ratio < t[0]) return "very_comfortable";
  if (ratio < t[1]) return "healthy";
  if (ratio < t[2]) return "moderate";
  if (ratio < t[3]) return "high";
  return "aggressive";
}

/** Piecewise-linear 0–100 sub-score for a cost-to-income ratio. */
export function ratioSubScore(ratio: number, t: [number, number, number, number]): number {
  const pts: [number, number][] = [
    [0, 100],
    [t[0], 100],
    [t[1], 75],
    [t[2], 50],
    [t[3], 25],
    [t[3] + (t[3] - t[2]), 0],
  ];
  if (ratio <= 0) return 100;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (ratio <= x1) return x1 === x0 ? y1 : y0 + ((ratio - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0;
}

/** Sub-score for required saving as a share of monthly saving capacity. */
export function burdenSubScore(required: number, capacity: number): number {
  if (required <= 0) return 100;
  if (capacity <= 0) return 0;
  const q = required / capacity;
  if (q <= 0.5) return 100;
  if (q <= 1) return 100 - ((q - 0.5) / 0.5) * 50;
  if (q <= 1.5) return 50 - ((q - 1) / 0.5) * 50;
  return 0;
}

export const SCORE_WEIGHTS = { affordability: 0.4, burden: 0.4, funding: 0.2 } as const;

export interface ScoreParts {
  affordability: number;
  burden: number;
  funding: number;
  score: number;
}

/** Financial Affordability Score 0–100 (financial fit only — says nothing about academic quality). */
export function affordabilityScore(input: {
  peakRatio: number;
  requiredMonthly: number;
  capacityMonthly: number;
  fundedRatio: number;
  thresholds: [number, number, number, number];
}): ScoreParts {
  const affordability = ratioSubScore(input.peakRatio, input.thresholds);
  const burden = burdenSubScore(input.requiredMonthly, input.capacityMonthly);
  const funding = clamp(input.fundedRatio, 0, 1) * 100;
  const score =
    SCORE_WEIGHTS.affordability * affordability + SCORE_WEIGHTS.burden * burden + SCORE_WEIGHTS.funding * funding;
  return { affordability, burden, funding, score: Math.round(score) };
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
