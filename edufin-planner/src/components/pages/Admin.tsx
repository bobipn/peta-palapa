"use client";

import { Archive, ArchiveRestore, CheckCircle2, Download, FileUp, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { csvTemplate, CSV_COLUMNS, CSV_COMPONENT_MAP, CSV_OPTIONAL_COLUMNS, downloadText, exportDbCsv, parseImport, type ImportRow } from "@/lib/csv";
import { historyPointsFromSchedule } from "@/lib/engine/costs";
import { INFLATION_LABEL, RETURN_LABEL, todayIso } from "@/lib/engine/defaults";
import type { Assumptions, FeeSchedule, InflationKey, Level, School } from "@/lib/engine/types";
import { LEVELS } from "@/lib/engine/types";
import { formatDate, formatRp } from "@/lib/format";
import { useDb } from "@/lib/hooks";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";
import { useStore } from "@/lib/store";
import { VERIFICATION_LABEL } from "@/lib/ui-helpers";
import { summarizeComponents } from "@/lib/engine/costs";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, NumberInput, PageHeader, PercentInput, StatusPill, Tabs, TextInput } from "../ui";
import { SchoolEditorSheet } from "./SchoolEditor";

type Tab = "schools" | "import" | "verify" | "assumptions" | "master";

function monthsSince(iso: string | undefined, today: string) {
  if (!iso) return Infinity;
  const [y, m] = iso.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  return (ty - y) * 12 + (tm - m);
}

function SchoolsAdmin() {
  const db = useDb();
  const upsertSchool = useStore((s) => s.upsertSchool);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<School | null | "new">(null);
  const list = db.schools.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q.toLowerCase()));
  return (
    <Card>
      <CardHeader
        title="Sekolah & kampus"
        subtitle="Add / edit school, add / update tuition, archive."
        action={
          <Button size="sm" variant="primary" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" /> Add school
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-3">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau ID…" aria-label="Cari sekolah" />
        <div className="scroll-x max-h-[560px] overflow-y-auto rounded-lg border border-line">
          <table className="data-table">
            <thead className="sticky top-0">
              <tr>
                <th>School ID</th>
                <th>Nama</th>
                <th>Kota</th>
                <th>Jenjang</th>
                <th className="num">Jadwal biaya</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const n = db.fees.filter((f) => f.schoolId === s.id).length;
                return (
                  <tr key={s.id} className={s.archived ? "text-muted" : undefined}>
                    <td className="font-mono text-[0.7rem]">{s.id}</td>
                    <td className="min-w-[12rem]">{s.name}</td>
                    <td>{s.location.city}</td>
                    <td>{s.levels.join(", ")}</td>
                    <td className="num">{n}</td>
                    <td>{s.archived ? <Badge>Diarsipkan</Badge> : <Badge>{s.origin === "seed" ? "Riset" : s.origin === "admin" ? "Admin" : "User"}</Badge>}</td>
                    <td className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => upsertSchool({ ...s, archived: !s.archived })} aria-label={s.archived ? "Pulihkan" : "Arsipkan"}>
                        {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
      {edit ? <SchoolEditorSheet open admin school={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} /> : null}
    </Card>
  );
}

function ImportAdmin() {
  const db = useDb();
  const upsertSchool = useStore((s) => s.upsertSchool);
  const upsertFee = useStore((s) => s.upsertFee);
  const addHistory = useStore((s) => s.addHistory);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const valid = rows?.filter((r) => !r.errors.length) ?? [];
  const commit = () => {
    for (const r of valid) {
      if (r.school) upsertSchool(r.school);
      if (r.schedule) {
        upsertFee(r.schedule);
        addHistory(historyPointsFromSchedule(r.schedule));
      }
    }
    setDone(`${valid.length} baris diimpor (${valid.filter((r) => r.action === "update").length} update, ${valid.filter((r) => r.action === "create").length} baru).`);
    setRows(null);
    setText("");
  };
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Upload CSV / bulk update" subtitle="Baris dengan school_id + level + academic_year (+ program) yang sama akan meng-update jadwal yang ada." />
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadText("edufin-template.csv", csvTemplate())}>
              <Download className="h-4 w-4" /> Template CSV
            </Button>
            <Button size="sm" onClick={() => downloadText(`edufin-schools-${todayIso()}.csv`, exportDbCsv(db))}>
              <Download className="h-4 w-4" /> Export database CSV
            </Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[0.8rem] font-medium hover:bg-card-2">
              <FileUp className="h-4 w-4" /> Pilih file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setText(await f.text());
                }}
              />
            </label>
          </div>
          <textarea className="field min-h-[140px] font-mono text-[0.75rem]" value={text} onChange={(e) => setText(e.target.value)} placeholder="…atau tempel isi CSV di sini" aria-label="Isi CSV" />
          <div className="flex gap-2">
            <Button variant="primary" disabled={!text.trim()} onClick={() => setRows(parseImport(text, db, todayIso()))}>
              Validasi & pratinjau
            </Button>
          </div>
          {done ? <StatusPill tone="good">{done}</StatusPill> : null}
          <details className="text-[0.75rem] text-ink-2">
            <summary className="cursor-pointer font-medium">Format kolom</summary>
            <p className="mt-1">
              Wajib: {CSV_COLUMNS.join(", ")}. Opsional: {CSV_OPTIONAL_COLUMNS.join(", ")}.
            </p>
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(CSV_COMPONENT_MAP).map(([k, v]) => (
                <li key={k}>
                  {k} → {v.label} ({v.frequency === "one_time" ? "sekali" : v.frequency === "monthly" ? "per bulan" : "per tahun"})
                </li>
              ))}
              <li>verification_status: verified | partially_verified | user_submitted | estimated | outdated. “verified” wajib source_url.</li>
              <li>Baris tanpa source ditolak: setiap angka harus dapat ditelusuri ke sumbernya.</li>
            </ul>
          </details>
        </CardBody>
      </Card>
      {rows ? (
        <Card>
          <CardHeader
            title={`Pratinjau: ${valid.length} valid, ${rows.length - valid.length} ditolak`}
            action={
              <Button variant="primary" size="sm" disabled={!valid.length} onClick={commit}>
                Impor {valid.length} baris
              </Button>
            }
          />
          <CardBody>
            <div className="scroll-x max-h-[480px] overflow-y-auto rounded-lg border border-line">
              <table className="data-table">
                <thead className="sticky top-0">
                  <tr>
                    <th>Baris</th>
                    <th>Sekolah</th>
                    <th>Jenjang · TA</th>
                    <th className="num">Tahun pertama</th>
                    <th>Aksi</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <td className="num">{r.line}</td>
                      <td>{r.school?.name ?? r.raw.school_name}</td>
                      <td>
                        {r.schedule ? `${r.schedule.level} · ${r.schedule.academicYear}` : `${r.raw.level ?? ""} · ${r.raw.academic_year ?? ""}`}
                      </td>
                      <td className="num">{r.schedule ? formatRp(summarizeComponents(r.schedule.components).firstYearTotal) : "—"}</td>
                      <td>{r.errors.length ? <StatusPill tone="critical">Ditolak</StatusPill> : <StatusPill tone="good">{r.action === "update" ? "Update" : "Baru"}</StatusPill>}</td>
                      <td className="text-[0.75rem]">
                        {[...r.errors, ...r.warnings].map((e) => (
                          <div key={e}>{e}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function VerifyAdmin() {
  const db = useDb();
  const upsertFee = useStore((s) => s.upsertFee);
  const staleMonths = useStore((s) => s.assumptions.staleDataMonths);
  const today = todayIso();
  const [filter, setFilter] = useState<"queue" | "stale" | "outdated">("queue");
  const schools = new Map(db.schools.map((s) => [s.id, s]));
  const list = db.fees.filter((f) => {
    if (f.archived) return false;
    if (filter === "queue") return f.provenance.verificationStatus !== "verified" && f.provenance.verificationStatus !== "outdated";
    if (filter === "outdated") return f.provenance.verificationStatus === "outdated";
    return monthsSince(f.provenance.lastVerified ?? f.provenance.accessedDate, today) >= staleMonths;
  });
  const setStatus = (f: FeeSchedule, patch: Partial<FeeSchedule["provenance"]>, extra: Partial<FeeSchedule> = {}) =>
    upsertFee({ ...f, ...extra, provenance: { ...f.provenance, ...patch } });
  return (
    <Card>
      <CardHeader
        title="Verify data"
        subtitle="Cocokkan angka dengan dokumen resmi sebelum menandai Verified. Verifikasi mencatat tanggal (last verified)."
        action={
          filter === "outdated" && list.length ? (
            <Button size="sm" onClick={() => list.forEach((f) => setStatus(f, {}, { archived: true }))}>
              <Archive className="h-4 w-4" /> Arsipkan semua ({list.length})
            </Button>
          ) : null
        }
      />
      <CardBody className="flex flex-col gap-3">
        <Tabs
          tabs={[
            { value: "queue", label: "Perlu verifikasi" },
            { value: "stale", label: `Belum dicek ≥${staleMonths} bln` },
            { value: "outdated", label: "Outdated" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {list.length === 0 ? (
          <EmptyState title="Tidak ada item" />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.slice(0, 150).map((f) => (
              <li key={f.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-[0.8rem]">
                  <div className="font-medium">
                    {schools.get(f.schoolId)?.name} · {f.level} · {f.program} · TA {f.academicYear}
                  </div>
                  <div className="text-ink-2">
                    {VERIFICATION_LABEL[f.provenance.verificationStatus]} · {f.provenance.source.slice(0, 80)} · diakses {formatDate(f.provenance.accessedDate)}
                  </div>
                  {f.provenance.sourceUrl ? (
                    <a href={f.provenance.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-accent-ink hover:underline">
                      Buka sumber
                    </a>
                  ) : (
                    <span className="text-[0.75rem] text-muted">Tanpa URL — tidak bisa diverifikasi</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    disabled={!f.provenance.sourceUrl}
                    onClick={() => setStatus(f, { verificationStatus: "verified", lastVerified: today, confidence: "high" })}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Verified
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(f, { verificationStatus: "partially_verified", lastVerified: today })}>
                    Partial
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(f, { verificationStatus: "outdated" })}>
                    Outdated
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(f, {}, { archived: true })} aria-label="Arsipkan">
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function AssumptionsAdmin() {
  const a = useStore((s) => s.assumptions);
  const set = useStore((s) => s.setAssumptions);
  return (
    <Card>
      <CardHeader title="Manage inflation assumptions" subtitle="Berlaku untuk semua proyeksi di perangkat/akun ini." />
      <CardBody className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(INFLATION_LABEL) as InflationKey[]).map((k) => (
          <Field key={k} label={INFLATION_LABEL[k]}>
            <PercentInput value={a.inflation[k]} onChange={(v) => set({ inflation: { ...a.inflation, [k]: v } })} min={-5} max={30} ariaLabel={INFLATION_LABEL[k]} />
          </Field>
        ))}
        {(Object.keys(RETURN_LABEL) as (keyof Assumptions["returns"])[]).map((k) => (
          <Field key={k} label={RETURN_LABEL[k]}>
            <PercentInput value={a.returns[k]} onChange={(v) => set({ returns: { ...a.returns, [k]: v } })} min={-10} max={30} ariaLabel={RETURN_LABEL[k]} />
          </Field>
        ))}
      </CardBody>
    </Card>
  );
}

function ListEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="flex flex-col gap-2">
        <ul className="flex flex-wrap gap-1.5">
          {items.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[0.78rem]">
              {c}
              <button type="button" onClick={() => onChange(items.filter((x) => x !== c))} aria-label={`Hapus ${c}`} className="rounded p-0.5 hover:bg-card-2">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tambah…" aria-label={`Tambah ${title}`} />
          <Button
            onClick={() => {
              if (draft.trim() && !items.includes(draft.trim())) onChange([...items, draft.trim()]);
              setDraft("");
            }}
          >
            Tambah
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function MasterAdmin() {
  const md = useStore((s) => s.masterData);
  const setMd = useStore((s) => s.setMasterData);
  const a = useStore((s) => s.assumptions);
  const set = useStore((s) => s.setAssumptions);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ListEditor title="Manage cities" items={md.cities} onChange={(cities) => setMd({ cities })} />
      <ListEditor title="Manage curriculum" items={md.curricula} onChange={(curricula) => setMd({ curricula })} />
      <Card className="lg:col-span-2">
        <CardHeader title="Manage education levels" subtitle="Durasi (tahun) per jenjang dan usia masuk SD." />
        <CardBody className="grid gap-3 sm:grid-cols-5">
          {(LEVELS as readonly Level[]).map((l) => (
            <Field key={l} label={l}>
              <NumberInput value={a.levelDurations[l]} min={1} max={8} onChange={(v) => set({ levelDurations: { ...a.levelDurations, [l]: Math.max(1, v) } })} suffix="tahun" ariaLabel={`Durasi ${l}`} />
            </Field>
          ))}
          <Field label="Usia masuk SD (per 1 Juli)">
            <NumberInput value={a.sdEntryAge} min={5} max={8} onChange={(v) => set({ sdEntryAge: v })} suffix="tahun" ariaLabel="Usia masuk SD" />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}

export function AdminPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "schools";
  const auth = useAuth();
  const canAdmin = !supabaseEnabled || auth.role === "admin";
  const tabs = useMemo(
    () => [
      { value: "schools" as Tab, label: "Sekolah" },
      { value: "import" as Tab, label: "Import CSV" },
      { value: "verify" as Tab, label: "Verifikasi" },
      { value: "assumptions" as Tab, label: "Asumsi inflasi" },
      { value: "master" as Tab, label: "Master data" },
    ],
    [],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Admin dashboard"
        subtitle={
          supabaseEnabled
            ? "Mode cloud: perubahan data sekolah hanya untuk role admin (ditegakkan oleh Row Level Security di database)."
            : "Mode lokal: perubahan tersimpan di browser ini sebagai lapisan di atas database riset bawaan (data asli tidak diubah)."
        }
      />
      {!canAdmin ? (
        <Card>
          <EmptyState title="Akses admin diperlukan" body="Masuk dengan akun ber-role admin untuk mengelola data sekolah." />
        </Card>
      ) : (
        <>
          <Tabs tabs={tabs} value={tab} onChange={(v) => router.replace(`/admin/?tab=${v}`, { scroll: false })} />
          {tab === "schools" ? <SchoolsAdmin /> : null}
          {tab === "import" ? <ImportAdmin /> : null}
          {tab === "verify" ? <VerifyAdmin /> : null}
          {tab === "assumptions" ? <AssumptionsAdmin /> : null}
          {tab === "master" ? <MasterAdmin /> : null}
        </>
      )}
    </div>
  );
}
