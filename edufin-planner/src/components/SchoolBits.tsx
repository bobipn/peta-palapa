"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL, FREQUENCY_LABEL, GROUP_LABEL } from "@/lib/engine/catalog";
import { resolveTiers, summarizeComponents } from "@/lib/engine/costs";
import type { FeeComponent, FeeSchedule, Level, Provenance, School, SchoolDatabase } from "@/lib/engine/types";
import { formatDate, formatRp, formatRpCompact } from "@/lib/format";
import { CONFIDENCE_LABEL, SOURCE_TYPE_LABEL, VERIFICATION_LABEL, VERIFICATION_TONE } from "@/lib/ui-helpers";
import { Badge, Select, StatusPill, TextInput } from "./ui";

export function VerificationPill({ p }: { p: Pick<Provenance, "verificationStatus"> }) {
  return <StatusPill tone={VERIFICATION_TONE[p.verificationStatus]}>{VERIFICATION_LABEL[p.verificationStatus]}</StatusPill>;
}

export function ProvenanceBox({ p, compact }: { p: Provenance; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-card-2/50 p-3 text-[0.78rem]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <VerificationPill p={p} />
        <Badge>{CONFIDENCE_LABEL[p.confidence]}</Badge>
        <Badge>{SOURCE_TYPE_LABEL[p.sourceType] ?? p.sourceType}</Badge>
        {p.academicYearInferred ? <Badge>TA disimpulkan</Badge> : null}
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-ink-2">
        <dt className="text-muted">Sumber</dt>
        <dd className="min-w-0 text-ink">{p.source}</dd>
        {p.sourceUrl ? (
          <>
            <dt className="text-muted">Source URL</dt>
            <dd className="min-w-0 truncate">
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                {p.sourceUrl.replace(/^https?:\/\//, "").slice(0, 70)}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            </dd>
          </>
        ) : null}
        <dt className="text-muted">Tahun ajaran</dt>
        <dd>{p.academicYear}</dd>
        <dt className="text-muted">Data date</dt>
        <dd>{p.dataDate ? formatDate(p.dataDate) : "tidak tercantum"}</dd>
        <dt className="text-muted">Diakses</dt>
        <dd>{formatDate(p.accessedDate)}</dd>
        <dt className="text-muted">Last verified</dt>
        <dd>{p.lastVerified ? formatDate(p.lastVerified) : "belum diverifikasi"}</dd>
        {!compact && p.notes ? (
          <>
            <dt className="text-muted">Catatan</dt>
            <dd className="leading-snug">{p.notes}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export function scheduleLabel(f: FeeSchedule): string {
  return `${f.program ?? f.level} · TA ${f.academicYear}${f.incomplete ? " · tidak lengkap" : ""}`;
}

/** Fee schedule components grouped A–D, with tiers, exclusions and verbatim evidence. */
export function FeeScheduleTable({ schedule, showVerbatim }: { schedule: FeeSchedule; showVerbatim?: boolean }) {
  const resolved = new Set(resolveTiers(schedule.components).map((c) => c.id));
  const groups = ["entry", "recurring", "operational", "optional"] as const;
  const sum = summarizeComponents(schedule.components, schedule.monthsBilled ?? 12);
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const items = schedule.components.filter((c) => c.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <h4 className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">{GROUP_LABEL[g]}</h4>
            <div className="scroll-x rounded-lg border border-line">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th>Kategori</th>
                    <th>Frekuensi</th>
                    <th className="num">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <ComponentRow key={c.id} c={c} counted={resolved.has(c.id)} showVerbatim={showVerbatim} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-3 gap-2 text-[0.78rem]">
        <div className="rounded-lg bg-card-2 p-2">
          <div className="text-muted">Uang masuk (sekali)</div>
          <div className="tnum font-semibold">{formatRp(sum.entryOneTime)}</div>
        </div>
        <div className="rounded-lg bg-card-2 p-2">
          <div className="text-muted">Biaya tahunan</div>
          <div className="tnum font-semibold">{formatRp(sum.annualTotal)}</div>
        </div>
        <div className="rounded-lg bg-card-2 p-2">
          <div className="text-muted">Tahun pertama</div>
          <div className="tnum font-semibold">{formatRp(sum.firstYearTotal)}</div>
        </div>
      </div>
      <p className="text-[0.72rem] text-muted">
        Ringkasan untuk siswa kelas awal pada TA {schedule.academicYear}; alternatif bertingkat (mis. UKT) memakai nilai tertinggi kecuali dipilih lain di rencana anak. Biaya opsional tidak dihitung kecuali dipilih.
      </p>
    </div>
  );
}

function ComponentRow({ c, counted, showVerbatim }: { c: FeeComponent; counted: boolean; showVerbatim?: boolean }) {
  const [open, setOpen] = useState(false);
  const muted = c.excluded || !counted || (c.group === "optional" && !c.included);
  return (
    <>
      <tr className={muted ? "text-muted" : undefined}>
        <td className="min-w-[12rem]">
          <button type="button" className="text-left hover:underline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {c.label}
          </button>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {c.tierGroup ? <Badge>{counted ? "dipakai (alternatif)" : "alternatif"}</Badge> : null}
            {c.excluded ? <Badge>tidak dijumlahkan</Badge> : null}
            {c.estimated ? <Badge>estimasi</Badge> : null}
            {c.frequencyInferred ? <Badge>frekuensi disimpulkan</Badge> : null}
            {c.fromGrade && c.fromGrade > 1 ? <Badge>mulai kelas ke-{c.fromGrade}</Badge> : null}
            {c.toGrade ? <Badge>s.d. tahun ke-{c.toGrade}</Badge> : null}
            {c.group === "optional" ? <Badge>opsional</Badge> : null}
          </div>
        </td>
        <td>{CATEGORY_LABEL[c.category]}</td>
        <td className="whitespace-nowrap">{FREQUENCY_LABEL[c.frequency]}</td>
        <td className="num">
          {formatRp(c.amount)}
          {c.amountMin !== undefined && c.amountMax !== undefined ? (
            <div className="text-[0.7rem] text-muted">
              rentang {formatRpCompact(c.amountMin)}–{formatRpCompact(c.amountMax)}
            </div>
          ) : null}
        </td>
      </tr>
      {open || showVerbatim ? (
        <tr>
          <td colSpan={4} className="bg-card-2/50 text-[0.75rem] text-ink-2">
            {c.verbatim ? (
              <p>
                <span className="text-muted">Kutipan sumber: </span>“{c.verbatim}”
              </p>
            ) : null}
            {c.note ? <p className="mt-1">{c.note}</p> : null}
            {c.excludedReason ? <p className="mt-1">Tidak dijumlahkan: {c.excludedReason}</p> : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Searchable school picker filtered by level (and optionally city). */
export function SchoolPicker({
  db,
  level,
  value,
  onChange,
  city,
}: {
  db: SchoolDatabase;
  level: Level;
  value?: string;
  onChange: (schoolId: string) => void;
  city?: string;
}) {
  const [q, setQ] = useState("");
  const [onlyCity, setOnlyCity] = useState(Boolean(city));
  const options = useMemo(() => {
    const withFees = new Set(db.fees.filter((f) => f.level === level && !f.archived).map((f) => f.schoolId));
    return db.schools
      .filter((s) => !s.archived && s.levels.includes(level))
      .filter((s) => !onlyCity || !city || s.location.city === city)
      .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => Number(withFees.has(b.id)) - Number(withFees.has(a.id)) || a.name.localeCompare(b.name))
      .map((s) => ({ s, hasFees: withFees.has(s.id) }));
  }, [db, level, q, onlyCity, city]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama sekolah…" className="min-w-0 flex-1" aria-label="Cari sekolah" />
        {city ? (
          <label className="flex items-center gap-1.5 text-[0.78rem] text-ink-2">
            <input type="checkbox" checked={onlyCity} onChange={(e) => setOnlyCity(e.target.checked)} className="accent-[var(--accent)]" />
            Hanya {city}
          </label>
        ) : null}
      </div>
      <Select
        value={value ?? ""}
        onChange={onChange}
        aria-label="Pilih sekolah"
        options={[
          { value: "", label: options.length ? "— pilih sekolah —" : "Tidak ada sekolah yang cocok" },
          ...options.map(({ s, hasFees }) => ({ value: s.id, label: `${s.name} · ${s.location.city}${hasFees ? "" : " (belum ada data biaya)"}` })),
        ]}
      />
    </div>
  );
}

export function schoolById(db: SchoolDatabase, id?: string): School | undefined {
  return id ? db.schools.find((s) => s.id === id) : undefined;
}
