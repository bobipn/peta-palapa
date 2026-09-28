"use client";

import { ArrowLeft, ExternalLink, GitCompareArrows, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { COMPONENT_HISTORY_LABEL } from "@/lib/engine/catalog";
import { summarizeComponents } from "@/lib/engine/costs";
import { explainHistorical, historicalStats, representativeHistoricalRate, schoolInflationKey } from "@/lib/engine/inflation";
import { INFLATION_LABEL } from "@/lib/engine/defaults";
import type { FeeHistoryPoint, Level, School, SchoolDatabase, VerificationStatus } from "@/lib/engine/types";
import { LEVELS, SCHOOL_CATEGORIES } from "@/lib/engine/types";
import { formatPct, formatRp, formatRpCompact } from "@/lib/format";
import { useAssumptions, useDb } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { VERIFICATION_LABEL } from "@/lib/ui-helpers";
import { Lines, useChartColors } from "../charts";
import { ExplainButton } from "../Explain";
import { FeeScheduleTable, ProvenanceBox, VerificationPill } from "../SchoolBits";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Select, TextInput } from "../ui";
import { SchoolEditorSheet } from "./SchoolEditor";

function latestSchedules(db: SchoolDatabase, schoolId: string) {
  const byLevel = new Map<Level, (typeof db.fees)[number]>();
  for (const f of db.fees) {
    if (f.schoolId !== schoolId || f.archived || f.incomplete) continue;
    const cur = byLevel.get(f.level);
    if (!cur || f.academicYear > cur.academicYear || (f.academicYear === cur.academicYear && f.primary && !cur.primary)) byLevel.set(f.level, f);
  }
  return byLevel;
}

function bestStatus(db: SchoolDatabase, schoolId: string): VerificationStatus | null {
  const order: VerificationStatus[] = ["verified", "partially_verified", "user_submitted", "estimated", "outdated"];
  let best: VerificationStatus | null = null;
  for (const f of db.fees) if (f.schoolId === schoolId && !f.archived) if (best === null || order.indexOf(f.provenance.verificationStatus) < order.indexOf(best)) best = f.provenance.verificationStatus;
  return best;
}

function SchoolCard({ s, db }: { s: School; db: SchoolDatabase }) {
  const compare = useStore((st) => st.compare.schoolIds);
  const toggle = useStore((st) => st.toggleCompareSchool);
  const latest = latestSchedules(db, s.id);
  const status = bestStatus(db, s.id);
  const inCompare = compare.includes(s.id);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/schools/?id=${s.id}`} className="min-w-0 hover:underline">
          <div className="truncate text-[0.95rem] font-semibold">{s.name}</div>
          <div className="text-[0.75rem] text-ink-2">
            {s.location.city}
            {s.location.district ? ` · ${s.location.district}` : ""} · {s.levels.join(", ")}
          </div>
        </Link>
        {status ? <VerificationPill p={{ verificationStatus: status }} /> : <Badge>Belum ada biaya</Badge>}
      </div>
      <div className="flex flex-wrap gap-1">
        {s.categories.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>
      {latest.size ? (
        <ul className="grid grid-cols-2 gap-2 text-[0.75rem]">
          {[...latest.entries()].slice(0, 4).map(([lvl, f]) => {
            const sum = summarizeComponents(f.components, f.monthsBilled ?? 12);
            return (
              <li key={lvl} className="rounded-lg bg-card-2 px-2.5 py-2">
                <div className="text-muted">
                  {lvl} · TA {f.academicYear}
                </div>
                <div className="tnum font-semibold text-ink">{formatRpCompact(sum.firstYearTotal)} th. pertama</div>
                <div className="tnum text-ink-2">
                  masuk {formatRpCompact(sum.entryOneTime)} · {formatRpCompact(sum.annualTotal)}/th
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[0.78rem] text-ink-2">{s.isUniversity ? "Belum ada data biaya terverifikasi." : "Belum ada data biaya."}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={`/schools/?id=${s.id}`} className="inline-flex h-8 items-center rounded-[10px] border border-line-strong px-3 text-[0.8rem] font-medium hover:bg-card-2">
          Detail & sumber
        </Link>
        <Button size="sm" variant={inCompare ? "primary" : "secondary"} onClick={() => toggle(s.id)} disabled={!inCompare && compare.length >= 5}>
          <GitCompareArrows className="h-4 w-4" /> {inCompare ? "Dibandingkan" : "Bandingkan"}
        </Button>
      </div>
    </div>
  );
}

function HistoryCard({ school, points }: { school: School; points: FeeHistoryPoint[] }) {
  const a = useAssumptions();
  const c = useChartColors();
  const series = useMemo(() => {
    const m = new Map<string, FeeHistoryPoint[]>();
    for (const p of points) {
      const k = `${p.level} · ${COMPONENT_HISTORY_LABEL[p.componentCode] ?? p.componentCode}${school.isUniversity && p.program ? ` · ${p.program}` : ""}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()];
  }, [points, school.isUniversity]);
  if (!series.length) return null;
  return (
    <Card>
      <CardHeader
        title="Historical school cost"
        subtitle="Kenaikan biaya dari observasi bersumber. Jarak >1 tahun disetahunkan; komposisi biaya bisa berbeda antar tahun."
      />
      <CardBody className="flex flex-col gap-4">
        {series.map(([label, pts]) => {
          const stats = historicalStats(pts);
          const rep = representativeHistoricalRate(stats);
          const key = schoolInflationKey(school, pts[0].level);
          const data = stats.points.map((p) => ({ ay: `${p.year}/${String((p.year + 1) % 100).padStart(2, "0")}`, v: p.amount }));
          return (
            <div key={label} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[0.85rem] font-semibold">{label}</h3>
                <ExplainButton explain={explainHistorical(stats, label)} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[0.75rem] sm:grid-cols-6">
                {[
                  ["1-year growth", stats.oneYear],
                  ["3-year CAGR", stats.cagr3],
                  ["5-year CAGR", stats.cagr5],
                  ["Median", stats.median],
                  ["Minimum", stats.min],
                  ["Maximum", stats.max],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-card-2 px-2 py-1.5">
                    <div className="text-muted">{k as string}</div>
                    <div className="tnum font-semibold">{v === null ? "—" : formatPct(v as number)}</div>
                  </div>
                ))}
              </div>
              {data.length >= 2 ? <Lines data={data} xKey="ay" series={[{ key: "v", label, color: c["--series-1"] }]} height={160} /> : null}
              <p className="text-[0.75rem] text-ink-2">
                {rep
                  ? `${rep.basis} ${formatPct(rep.rate)} vs asumsi ${INFLATION_LABEL[key]} ${formatPct(a.inflation[key])} — ${rep.rate > a.inflation[key] ? "di atas asumsi" : "di bawah/sama dengan asumsi"}.`
                  : "Data historis belum cukup; proyeksi memakai asumsi (bukan data aktual)."}
              </p>
              <ul className="text-[0.72rem] text-muted">
                {stats.points.map((p) => {
                  const src = pts.find((x) => x.id === p.pointId)!;
                  return (
                    <li key={p.pointId}>
                      TA {p.year}/{p.year + 1}: {formatRp(p.amount)} — {VERIFICATION_LABEL[src.provenance.verificationStatus]} ·{" "}
                      {src.provenance.sourceUrl ? (
                        <a className="text-accent-ink hover:underline" href={src.provenance.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {src.provenance.source.slice(0, 60)}
                        </a>
                      ) : (
                        src.provenance.source
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function SchoolDetail({ id }: { id: string }) {
  const db = useDb();
  const school = db.schools.find((s) => s.id === id);
  const [editing, setEditing] = useState(false);
  const fees = useMemo(
    () => db.fees.filter((f) => f.schoolId === id).sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.level.localeCompare(b.level)),
    [db, id],
  );
  const [selected, setSelected] = useState<string | null>(null);
  if (!school) return <EmptyState title="Sekolah tidak ditemukan" action={<Link href="/schools/">Kembali</Link>} />;
  const active = fees.find((f) => f.id === selected) ?? fees.find((f) => !f.incomplete) ?? fees[0];
  const history = db.history.filter((h) => h.schoolId === id);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/schools/" className="inline-flex items-center gap-1 text-[0.85rem] text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Database sekolah
      </Link>
      <PageHeader
        title={school.name}
        subtitle={[school.foundation, school.location.address, school.location.district, school.location.city, school.location.province].filter(Boolean).join(" · ")}
        actions={
          <>
            {school.website ? (
              <a href={school.website.split(" ")[0]} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line-strong px-4 text-[0.875rem] font-medium hover:bg-card-2">
                Situs resmi <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <Button onClick={() => setEditing(true)}>Edit / tambah biaya</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        <Badge>ID {school.id}</Badge>
        <Badge>{school.ownership === "negeri" ? "Negeri" : "Swasta"}</Badge>
        {school.categories.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
        {school.curricula.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
        <Badge>{school.origin === "seed" ? "Data riset" : school.origin === "admin" ? "Admin" : "User submitted"}</Badge>
      </div>
      {school.notes ? <p className="text-[0.8rem] leading-relaxed text-ink-2">{school.notes}</p> : null}
      {fees.length ? (
        <Card>
          <CardHeader title="School cost database" subtitle="Pilih jenjang / program / tahun ajaran. Setiap jadwal membawa sumber dan status verifikasi." />
          <CardBody className="flex flex-col gap-3">
            <Select value={active?.id ?? ""} onChange={setSelected} options={fees.map((f) => ({ value: f.id, label: `${f.level} · ${f.program ?? ""} · TA ${f.academicYear} · ${VERIFICATION_LABEL[f.provenance.verificationStatus]}${f.incomplete ? " · tidak lengkap" : ""}` }))} aria-label="Pilih jadwal biaya" />
            {active ? (
              <>
                {active.incomplete ? <p className="text-[0.8rem] text-ink-2">⚠︎ {active.notes}</p> : null}
                <FeeScheduleTable schedule={active} />
                <ProvenanceBox p={active.provenance} />
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <EmptyState title="Belum ada data biaya" body="Tambahkan jadwal biaya dari brosur resmi (akan berstatus User Submitted sampai diverifikasi)." action={<Button onClick={() => setEditing(true)}>Tambah biaya</Button>} />
        </Card>
      )}
      <HistoryCard school={school} points={history} />
      {editing ? <SchoolEditorSheet open onClose={() => setEditing(false)} school={school} /> : null}
    </div>
  );
}

export function SchoolsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const isNew = params.get("new") === "1";
  const db = useDb();
  const compare = useStore((s) => s.compare.schoolIds);
  const cities = useMemo(() => [...new Set(db.schools.map((s) => s.location.city))].sort(), [db]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [level, setLevel] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const list = useMemo(() => {
    return db.schools
      .filter((s) => !s.archived)
      .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
      .filter((s) => !city || s.location.city === city)
      .filter((s) => !level || s.levels.includes(level as Level))
      .filter((s) => !cat || s.categories.includes(cat as School["categories"][number]))
      .filter((s) => !kind || (kind === "uni" ? s.isUniversity : !s.isUniversity))
      .filter((s) => !status || db.fees.some((f) => f.schoolId === s.id && f.provenance.verificationStatus === status))
      .sort((a, b) => Number(a.isUniversity) - Number(b.isUniversity) || a.location.city.localeCompare(b.location.city) || a.name.localeCompare(b.name));
  }, [db, q, city, level, cat, status, kind]);

  if (id) return <SchoolDetail id={id} />;
  const counts = {
    schools: db.schools.filter((s) => !s.isUniversity).length,
    unis: db.schools.filter((s) => s.isUniversity).length,
    fees: db.fees.length,
    verified: db.fees.filter((f) => f.provenance.verificationStatus === "verified").length,
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Schools"
        subtitle={`Database biaya sekolah & kampus Depok–Bogor: ${counts.schools} sekolah, ${counts.unis} perguruan tinggi, ${counts.fees} jadwal biaya (${counts.verified} Verified). Data aktual dan estimasi selalu diberi label.`}
        actions={
          <>
            <Link href="/schools/compare/" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line-strong px-4 text-[0.875rem] font-medium hover:bg-card-2">
              <GitCompareArrows className="h-4 w-4" /> Bandingkan ({compare.length}/5)
            </Link>
            <Button variant="primary" onClick={() => router.push("/schools/?new=1")}>
              <Plus className="h-4 w-4" /> Tambah sekolah
            </Button>
          </>
        }
      />
      <div className="no-print flex flex-wrap gap-2" role="search">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari sekolah…" className="w-full sm:w-56" aria-label="Cari" />
        <Select value={kind} onChange={setKind} className="w-auto" aria-label="Jenis" options={[{ value: "", label: "Sekolah & kampus" }, { value: "school", label: "Sekolah (TK–SMA/SMK)" }, { value: "uni", label: "Perguruan tinggi" }]} />
        <Select value={city} onChange={setCity} className="w-auto" aria-label="Kota" options={[{ value: "", label: "Semua kota" }, ...cities.map((c) => ({ value: c, label: c }))]} />
        <Select value={level} onChange={setLevel} className="w-auto" aria-label="Jenjang" options={[{ value: "", label: "Semua jenjang" }, ...LEVELS.map((l) => ({ value: l, label: l }))]} />
        <Select value={cat} onChange={setCat} className="w-auto" aria-label="Kategori" options={[{ value: "", label: "Semua kategori" }, ...SCHOOL_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <Select
          value={status}
          onChange={setStatus}
          className="w-auto"
          aria-label="Status verifikasi"
          options={[{ value: "", label: "Semua status" }, ...(Object.keys(VERIFICATION_LABEL) as VerificationStatus[]).map((v) => ({ value: v, label: VERIFICATION_LABEL[v] }))]}
        />
      </div>
      <p className="text-[0.75rem] text-muted">
        {list.length} hasil. <strong>Verified</strong> = angka dicocokkan dengan dokumen resmi; <strong>Partially Verified</strong> = sumber sekunder atau dibaca dari gambar; <strong>Outdated</strong> = TA ≥2 tahun lalu. Harga berubah — konfirmasi ke sekolah sebelum memutuskan.
      </p>
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <SchoolCard key={s.id} s={s} db={db} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="Tidak ada yang cocok" body="Ubah filter atau tambahkan sekolah baru." />
        </Card>
      )}
      {isNew ? <SchoolEditorSheet open onClose={() => router.push("/schools/")} /> : null}
    </div>
  );
}
