/** Formatting helpers (Indonesian locale: "." thousands, "," decimals). */

const intFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const dec1Fmt = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const dec2Fmt = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const MINUS = "−";

export function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  if (digits === 0) return intFmt.format(Math.round(n));
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** Rp7.500.000 */
export function formatRp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n);
  const s = `Rp${intFmt.format(Math.abs(r))}`;
  return r < 0 ? `${MINUS}${s}` : s;
}

/** Compact: Rp1,8 M (miliar) · Rp420 jt · Rp750 rb */
export function formatRpCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  const scaled = (v: number) => (v >= 100 ? intFmt.format(Math.round(v)) : dec1Fmt.format(v));
  let out: string;
  if (abs >= 1e12) out = `Rp${dec2Fmt.format(abs / 1e12)} T`;
  else if (abs >= 1e9) out = `Rp${dec2Fmt.format(abs / 1e9)} M`;
  else if (abs >= 1e6) out = `Rp${scaled(abs / 1e6)} jt`;
  else if (abs >= 1e3) out = `Rp${scaled(abs / 1e3)} rb`;
  else out = `Rp${intFmt.format(Math.round(abs))}`;
  return sign + out;
}

/** Long form for sentences: Rp1,8 miliar · Rp420 juta */
export function formatRpWords(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  let out: string;
  if (abs >= 1e12) out = `Rp${dec2Fmt.format(abs / 1e12)} triliun`;
  else if (abs >= 1e9) out = `Rp${dec2Fmt.format(abs / 1e9)} miliar`;
  else if (abs >= 1e6) out = `Rp${dec1Fmt.format(abs / 1e6)} juta`;
  else out = `Rp${intFmt.format(Math.round(abs))}`;
  return sign + out;
}

/** 0.07 → "7,0%" */
export function formatPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return "—";
  const v = x * 100;
  const s = new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    Math.abs(v),
  );
  return `${v < 0 ? MINUS : ""}${s}%`;
}

/** Axis ticks: 1,8 M · 420 jt (no currency prefix). */
export function formatAxisCompact(n: number): string {
  const s = formatRpCompact(n);
  return s.replace("Rp", "");
}

export function academicYearLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

export function parseAcademicYear(label: string): number | null {
  const m = /^(\d{4})\s*[/\-–]\s*(\d{2,4})$/.exec(label.trim());
  if (m) return Number(m[1]);
  const single = /^(\d{4})$/.exec(label.trim());
  return single ? Number(single[1]) : null;
}

/** Parse "Rp50.000.000", "50.000.000", "50000000", "7,5 jt", "1,2 M" → number. Returns null if unparseable. */
export function parseRupiah(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = input.trim().toLowerCase();
  if (s === "") return null;
  s = s.replace(/rp\.?/g, "").replace(/\s+/g, "");
  let mult = 1;
  // Longer words first; single-letter suffixes must not be the tail of another word ("jt" ≠ "t").
  const suffixes: [RegExp, number][] = [
    [/(juta|jt)$/, 1e6],
    [/(ribu|rb|(?<![a-z])k)$/, 1e3],
    [/(miliar|milyar|(?<![a-z])m)$/, 1e9],
    [/(triliun|(?<![a-z])t)$/, 1e12],
  ];
  for (const [re, m] of suffixes) {
    if (re.test(s)) {
      mult = m;
      s = s.replace(re, "");
      break;
    }
  }
  if (mult === 1) {
    // Plain amount: "." and "," are thousand separators unless the tail looks like decimals ",5"
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  } else {
    // Scaled: "7,5" or "7.5" are decimals
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s) * mult;
  return Number.isFinite(v) ? Math.round(v) : null;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
