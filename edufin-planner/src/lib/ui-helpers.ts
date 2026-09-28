import type { Child, VerificationStatus, Confidence } from "./engine/types";
import type { Tone } from "@/components/ui";

export function childColorVar(child: Child, index: number): string {
  const slot = ((child.colorIndex ?? index) % 8) + 1;
  return `--series-${slot}`;
}

/** Lowest color slot not used by existing children. */
export function nextColorIndex(children: Child[]): number {
  const used = new Set(children.map((c, i) => c.colorIndex ?? i));
  for (let i = 0; i < 8; i++) if (!used.has(i)) return i;
  return children.length % 8;
}

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  partially_verified: "Partially Verified",
  user_submitted: "User Submitted",
  estimated: "Estimated",
  outdated: "Outdated",
};

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "good",
  partially_verified: "info",
  user_submitted: "neutral",
  estimated: "warning",
  outdated: "serious",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Keyakinan tinggi",
  medium: "Keyakinan sedang",
  low: "Keyakinan rendah",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  official_school_website: "Situs resmi sekolah",
  official_brochure_pdf: "Brosur resmi",
  official_social_media: "Media sosial resmi",
  official_university_website: "Situs resmi kampus",
  official_decree_pdf: "SK / peraturan resmi",
  official_admission_site: "Situs penerimaan resmi",
  government: "Pemerintah",
  news_media: "Media berita",
  education_portal_aggregator: "Portal agregator",
  blog: "Blog",
  user: "Input pengguna",
  assumption: "Asumsi",
};
