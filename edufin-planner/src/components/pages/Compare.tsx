"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { SCORE_WEIGHTS } from "@/lib/engine/affordability";
import { compareSchools, type ComparisonRow } from "@/lib/engine/analysis";
import { isActive } from "@/lib/engine/costs";
import { academicYearOf, levelSequence, nextEntryLevel } from "@/lib/engine/educationPath";
import type { CostCategory, Explain, FeeComponent, Level } from "@/lib/engine/types";
import { formatNumber, formatPct, formatRp, formatRpCompact } from "@/lib/format";
import { useAssumptions, useDb, useDeferredCompute } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { VERIFICATION_LABEL } from "@/lib/ui-helpers";
import { HBars } from "../charts";
import { ExplainButton } from "../Explain";
import { SchoolPicker } from "../SchoolBits";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, PageHeader, Select, StatusPill } from "../ui";

function scoreExplain(r: ComparisonRow, t: number[]): Explain {
  return {
    title: `Financial Affordability Score — ${r.school.name}`,
    inputs: [
      { label: "Rasio puncak biaya pendidikan / pendapatan", value: formatPct(r.peakRatio), note: `Sub-skor ${r.score.affordability.toFixed(0)} (bobot ${SCORE_WEIGHTS.affordability * 100}%)` },
      { label: "Investasi bulanan dibutuhkan", value: formatRp(r.requiredMonthly), note: `Sub-skor beban vs kapasitas ${r.score.burden.toFixed(0)} (bobot ${SCORE_WEIGHTS.burden * 100}%)` },
      { label: "Funded ratio rencana saat ini", value: formatPct(r.fundedRatio), note: `Sub-skor ${r.score.funding.toFixed(0)} (bobot ${SCORE_WEIGHTS.funding * 100}%)` },
    ],
    formula: "Score = 0,4 × S_rasio + 0,4 × S_beban + 0,2 × S_funding",
    substitution: `0,4 × ${r.score.affordability.toFixed(0)} + 0,4 × ${r.score.burden.toFixed(0)} + 0,2 × ${r.score.funding.toFixed(0)} = ${r.score.score}`,
    assumptions: [
      `S_rasio: 100 bila rasio < ${formatPct(t[0], 0)}, turun linier ke 75 (${formatPct(t[1], 0)}), 50 (${formatPct(t[2], 0)}), 25 (${formatPct(t[3], 0)}), 0 (${formatPct(t[3] + (t[3] - t[2]), 0)}).`,
      "S_beban: 100 bila kebutuhan ≤ 50% kapasitas menabung, 50 pada 100%, 0 pada ≥150%.",
      "S_funding: funded ratio (maks 100%).",
      "Seluruh rencana keluarga (semua anak) dihitung ulang dengan sekolah ini pada jenjang terpilih.",
      "Skor hanya mengukur keterjangkauan finansial — bukan kualitas akademik.",
    ],
    result: `${r.score.score} / 100`,
  };
}

/**
 * Amount for a cost bucket — or a label when the source lists no such component. "Rp0" would read as
 * "free", but usually the brochure simply does not mention the item (actual data ≠ missing data).
 */
function bucketCell(r: ComparisonRow, match: (c: FeeComponent) => boolean, amount: number, optionalCodes: string[]): string {
  if (!r.schedule) return "—";
  const listed = r.schedule.components.filter((c) => !c.excluded && match(c));
  if (!listed.length) return "tidak tercantum";
  if (amount === 0 && listed.every((c) => !isActive(c, optionalCodes))) return "opsional (tidak dipilih)";
  return formatRp(amount);
}

export function ComparePage() {
  const db = useDb();
  const a = useAssumptions();
  const household = useStore((s) => s.household);
  const compare = useStore((s) => s.compare);
  const setCompare = useStore((s) => s.setCompare);
  const toggle = useStore((s) => s.toggleCompareSchool);
  const childId = compare.childId ?? household.children[0]?.id;
  const child = household.children.find((c) => c.id === childId);
  const levels = child ? levelSequence(child) : [];
  const currentAy = academicYearOf(a.planDate);
  // Default to the next level the child will enter — the school decision still open.
  const nextEntry = child ? nextEntryLevel(child, a, currentAy) : undefined;
  const level: Level | undefined =
    compare.level && levels.includes(compare.level) ? compare.level : nextEntry ?? levels.find((l) => l !== "TK") ?? levels[0];
  const inLevelNow = !!child && child.currentLevel === level;
  const optionalCodes = (level && child?.levelPlans[level]?.includeOptionalCodes) || [];
  const cat = (r: ComparisonRow, cats: CostCategory[], withEntry = false) =>
    bucketCell(
      r,
      (c) => cats.includes(c.category) && (withEntry || c.frequency !== "one_time"),
      cats.reduce((t, k) => t + (r.summary?.byCategoryAnnual[k] ?? 0) + (withEntry ? r.summary?.byCategoryEntry[k] ?? 0 : 0), 0),
      optionalCodes,
    );
  const valid = compare.schoolIds.filter((id) => (level ? db.schools.find((s) => s.id === id)?.levels.includes(level) : false));
  const validKey = valid.join("|");
  const levelKey = level ?? "";
  const computed = useDeferredCompute(
    () => (childId && levelKey && validKey ? compareSchools(household, db, a, childId, levelKey as Level, validKey.split("|")) : []),
    [household, db, a, childId, levelKey, validKey],
  );
  const rows = computed ?? [];
  const ranked = [...rows].sort((x, y) => y.score.score - x.score.score);
  const t = a.affordabilityThresholds;

  const metric = (label: string, get: (r: ComparisonRow) => React.ReactNode) => (
    <tr key={label}>
      <th scope="row" className="whitespace-nowrap text-left text-ink-2">
        {label}
      </th>
      {rows.map((r) => (
        <td key={r.school.id} className="num">
          {get(r)}
        </td>
      ))}
    </tr>
  );
  const s = (r: ComparisonRow) => r.summary;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/schools/" className="inline-flex items-center gap-1 text-[0.85rem] text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Database sekolah
      </Link>
      <PageHeader
        title="School comparison"
        subtitle="Bandingkan maksimal 5 sekolah untuk satu anak & jenjang. Setiap sekolah dihitung dalam rencana keluarga lengkap: biaya masa depan, kebutuhan investasi, dan dampaknya pada arus kas."
      />
      {household.children.length === 0 ? (
        <Card>
          <EmptyState title="Tambahkan anak terlebih dulu" body="Perbandingan memakai jalur pendidikan anak untuk menghitung biaya masa depan." action={<Link href="/children/?new=1" className="text-accent-ink">Tambah anak</Link>} />
        </Card>
      ) : (
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Anak">
              <Select value={childId ?? ""} onChange={(v) => setCompare({ childId: v })} options={household.children.map((c) => ({ value: c.id, label: c.name || "Anak" }))} />
            </Field>
            <Field label="Jenjang">
              <Select value={level ?? ""} onChange={(v) => setCompare({ level: v as Level })} options={levels.map((l) => ({ value: l, label: l }))} />
            </Field>
            {level ? (
              <Field label={`Tambah sekolah (${valid.length}/5)`}>
                <SchoolPicker db={db} level={level} city={child?.educationLocation || household.homeCity} onChange={(id) => id && !compare.schoolIds.includes(id) && toggle(id)} />
              </Field>
            ) : null}
          </CardBody>
        </Card>
      )}

      {rows.length && inLevelNow ? (
        <StatusPill tone="warning">
          {child?.name || "Anak"} sedang di jenjang {level}: perbandingan menghitung sisa tahun jenjang ini seolah pindah sekolah, tanpa uang pangkal pindahan. Pilih jenjang berikutnya untuk keputusan sekolah lanjutan.
        </StatusPill>
      ) : null}
      {rows.length ? (
        <>
          <Card>
            <CardHeader title="Ranking — Financial Affordability Score" subtitle="0–100, makin tinggi makin terjangkau bagi keluarga Anda. Bukan penilaian kualitas akademik." />
            <CardBody>
              <HBars
                data={ranked.map((r) => ({ label: r.school.name, value: r.score.score, sub: `${formatRpCompact(r.levelTotalNominal)} total ${level}` }))}
                fmt={(v) => `${v}`}
                emphasize={ranked[0]?.school.name}
                domainMax={100}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {ranked.map((r) => (
                  <ExplainButton key={r.school.id} explain={scoreExplain(r, t)} label={`Skor ${r.school.name.slice(0, 18)}`} />
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Perbandingan biaya" subtitle="Harga pada tahun data sumber; biaya masa depan & total memakai asumsi inflasi rencana." />
            <CardBody>
              <div className="scroll-x rounded-lg border border-line">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      {rows.map((r) => (
                        <th key={r.school.id} className="num min-w-[9rem]">
                          <div className="flex items-start justify-end gap-1">
                            <span className="whitespace-normal text-right normal-case tracking-normal">{r.school.name}</span>
                            <button type="button" onClick={() => toggle(r.school.id)} aria-label={`Hapus ${r.school.name}`} className="rounded p-0.5 hover:bg-card-2">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metric("Data (TA · status)", (r) => (r.schedule ? `${r.schedule.academicYear} · ${VERIFICATION_LABEL[r.schedule.provenance.verificationStatus]}` : "tidak ada data"))}
                    {metric("Entry fee", (r) => bucketCell(r, (c) => c.frequency === "one_time", s(r)?.entryOneTime ?? 0, optionalCodes))}
                    {metric("Monthly tuition", (r) => bucketCell(r, (c) => c.category === "tuition", s(r)?.monthlyTuition ?? 0, optionalCodes))}
                    {metric("Annual fee", (r) => cat(r, ["annual"]))}
                    {metric("Transport", (r) => cat(r, ["transport"]))}
                    {metric("Meal", (r) => cat(r, ["meals"]))}
                    {metric("Books", (r) => cat(r, ["books"], true))}
                    {metric("Activities", (r) => cat(r, ["activities"]))}
                    {metric("Total annual cost", (r) => formatRp(s(r)?.annualTotal ?? 0))}
                    {metric(inLevelNow ? "Estimated future cost (TA berjalan)" : "Estimated future cost (tahun masuk)", (r) => (r.entryAy ? `${formatRp(r.firstYearFuture)} (TA ${r.entryAy}/${r.entryAy + 1})` : "—"))}
                    {metric(`Total education cost (${level})`, (r) => formatRp(r.levelTotalNominal))}
                    {metric("Kebutuhan dana keluarga (semua anak)", (r) => formatRpCompact(r.planRequirement))}
                    {metric("Required monthly investment", (r) => formatRp(r.requiredMonthly))}
                    {metric("Puncak rasio biaya/pendapatan", (r) => (r.peakAy ? `${formatPct(r.peakRatio)} (${r.peakAy})` : "—"))}
                    {metric("Kesiapan pensiun", (r) => formatPct(r.retirementReadiness, 0))}
                    {metric("Distance", (r) => (r.distanceKm !== null ? `${formatNumber(r.distanceKm, 1)} km` : "—"))}
                    {metric("Curriculum", (r) => r.school.curricula.join(", ") || "—")}
                    {metric("Boarding", (r) => (r.school.categories.includes("Boarding") ? "Ya" : "Tidak"))}
                    {metric("International program", (r) => (r.school.categories.some((c) => c === "International" || c === "IB" || c === "Cambridge") ? "Ya" : "Tidak"))}
                    {metric("Affordability score", (r) => <strong>{r.score.score}</strong>)}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[0.75rem] text-muted">
                “Tidak tercantum” = sumber tidak menyebut komponen itu (bukan berarti gratis); tanyakan ke sekolah. Biaya masa depan & total memakai rencana anak ini, termasuk komponen tambahan keluarga (mis. transport sendiri) yang tidak ada di brosur.{" "}
                Jarak memerlukan koordinat rumah & sekolah (belum tersedia di sebagian besar data). Skor tidak menilai mutu akademik, lingkungan, atau kecocokan anak — kunjungi sekolah dan periksa brosur resmi.
              </p>
            </CardBody>
          </Card>
        </>
      ) : child ? (
        <Card>
          <EmptyState
            title="Belum ada sekolah untuk dibandingkan"
            body={compare.schoolIds.length && !valid.length ? `Sekolah yang dipilih tidak menyediakan jenjang ${level}.` : "Pilih sekolah di atas atau tekan “Bandingkan” di database sekolah."}
          />
        </Card>
      ) : null}
      {compare.schoolIds.length ? (
        <div className="flex flex-wrap gap-1.5">
          {compare.schoolIds.map((id) => {
            const sc = db.schools.find((x) => x.id === id);
            return sc ? (
              <button key={id} type="button" onClick={() => toggle(id)} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[0.75rem] hover:bg-card-2">
                {sc.name} <X className="h-3 w-3" />
              </button>
            ) : null;
          })}
          {compare.schoolIds.length > valid.length ? <Badge>{compare.schoolIds.length - valid.length} tidak punya jenjang {level}</Badge> : null}
        </div>
      ) : null}
      <StatusPill tone="info">Jangan menentukan kualitas akademik hanya berdasarkan biaya.</StatusPill>
    </div>
  );
}
