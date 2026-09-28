"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FEE_CATALOG, GROUP_LABEL, makeComponent, newId } from "@/lib/engine/catalog";
import { historyPointsFromSchedule } from "@/lib/engine/costs";
import { todayIso } from "@/lib/engine/defaults";
import { academicYearOf } from "@/lib/engine/educationPath";
import type { Confidence, CostGroup, FeeComponent, FeeSchedule, Frequency, Level, Ownership, Provenance, School, SchoolCategory, SourceType, VerificationStatus } from "@/lib/engine/types";
import { LEVELS, SCHOOL_CATEGORIES } from "@/lib/engine/types";
import { useDb } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { SOURCE_TYPE_LABEL, VERIFICATION_LABEL } from "@/lib/ui-helpers";
import { Button, Field, MoneyInput, Segmented, Select, Sheet, TextInput } from "../ui";

const FREQ: { value: Frequency; label: string }[] = [
  { value: "one_time", label: "sekali" },
  { value: "monthly", label: "bulanan" },
  { value: "semester", label: "semester" },
  { value: "annual", label: "tahunan" },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function emptyProvenance(ay: string, admin: boolean): Provenance {
  return {
    source: "",
    sourceType: admin ? "official_school_website" : "user",
    academicYear: ay,
    verificationStatus: "user_submitted",
    confidence: "medium",
    accessedDate: todayIso(),
  };
}

function Chips<T extends string>({ all, value, onChange }: { all: readonly T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((x) => {
        const on = value.includes(x);
        return (
          <button
            key={x}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== x) : [...value, x])}
            className={on ? "rounded-full bg-ink px-2.5 py-1 text-[0.75rem] font-medium text-page" : "rounded-full border border-line-strong px-2.5 py-1 text-[0.75rem] text-ink-2 hover:bg-card-2"}
          >
            {x}
          </button>
        );
      })}
    </div>
  );
}

/** Validation shared by the editor and CSV import: every number needs provenance. */
export function validateSchedule(f: FeeSchedule): string[] {
  const errs: string[] = [];
  if (!/^\d{4}\/\d{4}$/.test(f.academicYear)) errs.push("Tahun ajaran harus berformat 2026/2027.");
  if (!f.provenance.source.trim()) errs.push("Sumber wajib diisi (nama dokumen/situs/brosur) — data tanpa provenance tidak disimpan.");
  if (f.provenance.sourceUrl && !/^https?:\/\//.test(f.provenance.sourceUrl)) errs.push("Source URL harus diawali http(s)://");
  if (!f.components.length) errs.push("Tambahkan minimal satu komponen biaya.");
  if (f.components.some((c) => !Number.isFinite(c.amount) || c.amount < 0)) errs.push("Nominal harus angka ≥ 0.");
  if (f.provenance.verificationStatus === "verified" && !f.provenance.sourceUrl) errs.push("Status Verified memerlukan Source URL dokumen resmi.");
  return errs;
}

export function SchoolEditorSheet({ open, onClose, school, admin = false }: { open: boolean; onClose: () => void; school?: School; admin?: boolean }) {
  const db = useDb();
  const cities = useStore((s) => s.masterData.cities);
  const curricula = useStore((s) => s.masterData.curricula);
  const upsertSchool = useStore((s) => s.upsertSchool);
  const upsertFee = useStore((s) => s.upsertFee);
  const addHistory = useStore((s) => s.addHistory);
  const currentAy = academicYearOf(todayIso());
  const [draft, setDraft] = useState<School>(
    () =>
      school ?? {
        id: "",
        name: "",
        ownership: "swasta",
        levels: ["SD"],
        categories: ["Swasta"],
        curricula: [],
        location: { province: "Jawa Barat", city: cities[0] ?? "Kota Depok" },
        isUniversity: false,
        origin: admin ? "admin" : "user",
      },
  );
  const existing = useMemo(() => (school ? db.fees.filter((f) => f.schoolId === school.id) : []), [db, school]);
  const [fee, setFee] = useState<FeeSchedule | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  /**
   * edit: admins correct a schedule in place (they own its provenance).
   * copy: non-admins never alter a sourced schedule — they save a new User Submitted copy with their own source.
   * nextYear: "update tuition" — a new schedule for the next academic year; the old one stays as history.
   */
  const startFee = (base?: FeeSchedule, mode: "edit" | "copy" | "nextYear" = "copy") => {
    const level = base?.level ?? draft.levels[0] ?? "SD";
    const startAy = base ? Number(base.academicYear.slice(0, 4)) + (mode === "nextYear" ? 1 : 0) : currentAy;
    const ay = `${startAy}/${startAy + 1}`;
    if (base && mode === "edit") {
      setFee(structuredClone(base));
      return;
    }
    setFee({
      id: newId("fee"),
      schoolId: draft.id,
      level,
      program: base ? `${base.program ?? "Reguler"}${mode === "copy" ? " (input pengguna)" : ""}` : "Reguler",
      academicYear: ay,
      monthsBilled: 12,
      components: base
        ? base.components.map((c) => ({ ...c, id: newId("fc"), verbatim: undefined }))
        : [makeComponent("uang_pangkal", 0), makeComponent("spp_monthly", 0)],
      provenance: emptyProvenance(ay, admin),
    });
  };

  const save = () => {
    const errs: string[] = [];
    if (!draft.name.trim()) errs.push("Nama sekolah wajib diisi.");
    if (!draft.levels.length) errs.push("Pilih minimal satu jenjang.");
    const id = draft.id || `${admin ? "adm" : "usr"}-${slug(draft.name)}-${newId("x").slice(0, 4)}`;
    const sch: School = {
      ...draft,
      id,
      categories: [...new Set([...(draft.categories.filter((c) => c !== "Negeri" && c !== "Swasta") as SchoolCategory[]), draft.ownership === "negeri" ? "Negeri" : "Swasta"] as SchoolCategory[])],
    };
    let f: FeeSchedule | null = null;
    if (fee) {
      f = { ...fee, schoolId: id, provenance: { ...fee.provenance, academicYear: fee.academicYear } };
      if (!admin) f.provenance = { ...f.provenance, verificationStatus: "user_submitted" };
      errs.push(...validateSchedule(f));
    }
    setErrors(errs);
    if (errs.length) return;
    upsertSchool(sch);
    if (f) {
      upsertFee(f);
      addHistory(historyPointsFromSchedule(f));
    }
    onClose();
  };

  const setComp = (i: number, patch: Partial<FeeComponent>) => fee && setFee({ ...fee, components: fee.components.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={school ? `Edit ${school.name}` : "Tambah sekolah"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {errors.length ? (
          <ul className="rounded-lg bg-critical-soft p-3 text-[0.8rem] text-ink" role="alert">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        ) : null}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama sekolah">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Nama yayasan">
            <TextInput value={draft.foundation ?? ""} onChange={(e) => setDraft({ ...draft, foundation: e.target.value || undefined })} />
          </Field>
          <Field label="Status">
            <Segmented ariaLabel="Negeri atau swasta" value={draft.ownership} onChange={(v) => setDraft({ ...draft, ownership: v as Ownership })} options={[{ value: "swasta", label: "Swasta" }, { value: "negeri", label: "Negeri" }]} />
          </Field>
          <Field label="Perguruan tinggi?">
            <Segmented ariaLabel="Perguruan tinggi" value={draft.isUniversity ? "y" : "n"} onChange={(v) => setDraft({ ...draft, isUniversity: v === "y" })} options={[{ value: "n", label: "Sekolah" }, { value: "y", label: "Universitas" }]} />
          </Field>
          <Field label="Jenjang" className="sm:col-span-2">
            <Chips all={LEVELS} value={draft.levels} onChange={(levels) => setDraft({ ...draft, levels })} />
          </Field>
          <Field label="Kategori" className="sm:col-span-2">
            <Chips all={SCHOOL_CATEGORIES.filter((c) => c !== "Negeri" && c !== "Swasta")} value={draft.categories} onChange={(categories) => setDraft({ ...draft, categories })} />
          </Field>
          <Field label="Kurikulum" className="sm:col-span-2">
            <Chips all={curricula} value={draft.curricula} onChange={(v) => setDraft({ ...draft, curricula: v })} />
          </Field>
          <Field label="Provinsi">
            <TextInput value={draft.location.province} onChange={(e) => setDraft({ ...draft, location: { ...draft.location, province: e.target.value } })} />
          </Field>
          <Field label="Kota / Kabupaten">
            <Select value={draft.location.city} onChange={(v) => setDraft({ ...draft, location: { ...draft.location, city: v } })} options={[...new Set([draft.location.city, ...cities])].map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Kecamatan">
            <TextInput value={draft.location.district ?? ""} onChange={(e) => setDraft({ ...draft, location: { ...draft.location, district: e.target.value || undefined } })} />
          </Field>
          <Field label="Alamat">
            <TextInput value={draft.location.address ?? ""} onChange={(e) => setDraft({ ...draft, location: { ...draft.location, address: e.target.value || undefined } })} />
          </Field>
          <Field label="Latitude">
            <TextInput inputMode="decimal" value={draft.location.lat ?? ""} onChange={(e) => setDraft({ ...draft, location: { ...draft.location, lat: e.target.value ? Number(e.target.value) : undefined } })} />
          </Field>
          <Field label="Longitude">
            <TextInput inputMode="decimal" value={draft.location.lng ?? ""} onChange={(e) => setDraft({ ...draft, location: { ...draft.location, lng: e.target.value ? Number(e.target.value) : undefined } })} />
          </Field>
          <Field label="Situs resmi" className="sm:col-span-2">
            <TextInput value={draft.website ?? ""} onChange={(e) => setDraft({ ...draft, website: e.target.value || undefined })} placeholder="https://" />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[0.9rem] font-semibold">Jadwal biaya</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => startFee()}>
                <Plus className="h-4 w-4" /> Jadwal baru
              </Button>
            </div>
          </div>
          {existing.length ? (
            <ul className="flex flex-col gap-1.5 text-[0.8rem]">
              {existing.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                  <span>
                    {f.level} · {f.program} · TA {f.academicYear} · {VERIFICATION_LABEL[f.provenance.verificationStatus]}
                  </span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startFee(f, admin ? "edit" : "copy")}>
                      {admin ? "Edit" : "Salin & ubah"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startFee(f, "nextYear")} title="Update tuition: salin ke TA berikutnya (jadwal lama tetap sebagai histori)">
                      <Copy className="h-3.5 w-3.5" /> TA berikutnya
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {fee ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Jenjang">
                  <Select value={fee.level} onChange={(v) => setFee({ ...fee, level: v as Level })} options={draft.levels.map((l) => ({ value: l, label: l }))} />
                </Field>
                <Field label="Program / jalur">
                  <TextInput value={fee.program ?? ""} onChange={(e) => setFee({ ...fee, program: e.target.value })} />
                </Field>
                <Field label="Tahun ajaran">
                  <TextInput value={fee.academicYear} onChange={(e) => setFee({ ...fee, academicYear: e.target.value })} placeholder="2026/2027" />
                </Field>
              </div>
              <ul className="flex flex-col gap-2">
                {fee.components.map((c, i) => (
                  <li key={c.id} className="grid grid-cols-2 gap-2 rounded-lg bg-card-2/60 p-2 sm:grid-cols-[1.2fr_1fr_9rem_7.5rem_9rem_auto] sm:items-end">
                    <Field label="Komponen">
                      <TextInput value={c.label} onChange={(e) => setComp(i, { label: e.target.value })} />
                    </Field>
                    <Field label="Jenis (katalog)">
                      <Select
                        value={c.code}
                        onChange={(code) => {
                          const e = FEE_CATALOG.find((x) => x.code === code);
                          setComp(i, e ? { code, category: e.category, group: e.group, inflation: e.inflation, frequency: e.frequency, label: c.label || e.label } : { code });
                        }}
                        options={FEE_CATALOG.map((e) => ({ value: e.code, label: e.label }))}
                      />
                    </Field>
                    <Field label="Kelompok">
                      <Select value={c.group} onChange={(g) => setComp(i, { group: g as CostGroup })} options={(Object.keys(GROUP_LABEL) as CostGroup[]).map((g) => ({ value: g, label: GROUP_LABEL[g] }))} />
                    </Field>
                    <Field label="Frekuensi">
                      <Select value={c.frequency} onChange={(v) => setComp(i, { frequency: v as Frequency })} options={FREQ} />
                    </Field>
                    <Field label="Nominal">
                      <MoneyInput value={c.amount} onChange={(v) => setComp(i, { amount: v })} ariaLabel={`Nominal ${c.label}`} />
                    </Field>
                    <Button variant="ghost" onClick={() => setFee({ ...fee, components: fee.components.filter((_, k) => k !== i) })} aria-label="Hapus komponen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div>
                <Button size="sm" onClick={() => setFee({ ...fee, components: [...fee.components, makeComponent("annual_fee", 0)] })}>
                  <Plus className="h-4 w-4" /> Komponen
                </Button>
              </div>
              <h4 className="text-[0.8rem] font-semibold text-ink-2">Provenance (wajib)</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Source" hint="Nama dokumen / situs / brosur">
                  <TextInput value={fee.provenance.source} onChange={(e) => setFee({ ...fee, provenance: { ...fee.provenance, source: e.target.value } })} />
                </Field>
                <Field label="Source URL">
                  <TextInput value={fee.provenance.sourceUrl ?? ""} onChange={(e) => setFee({ ...fee, provenance: { ...fee.provenance, sourceUrl: e.target.value || undefined } })} placeholder="https://" />
                </Field>
                <Field label="Jenis sumber">
                  <Select
                    value={fee.provenance.sourceType}
                    onChange={(v) => setFee({ ...fee, provenance: { ...fee.provenance, sourceType: v as SourceType } })}
                    options={Object.entries(SOURCE_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                </Field>
                <Field label="Data date (tanggal dokumen)">
                  <TextInput type="date" value={fee.provenance.dataDate ?? ""} onChange={(e) => setFee({ ...fee, provenance: { ...fee.provenance, dataDate: e.target.value || undefined } })} />
                </Field>
                {admin ? (
                  <>
                    <Field label="Verification status">
                      <Select
                        value={fee.provenance.verificationStatus}
                        onChange={(v) =>
                          setFee({
                            ...fee,
                            provenance: { ...fee.provenance, verificationStatus: v as VerificationStatus, lastVerified: v === "verified" ? todayIso() : fee.provenance.lastVerified },
                          })
                        }
                        options={(Object.keys(VERIFICATION_LABEL) as VerificationStatus[]).map((v) => ({ value: v, label: VERIFICATION_LABEL[v] }))}
                      />
                    </Field>
                    <Field label="Data confidence">
                      <Select
                        value={fee.provenance.confidence}
                        onChange={(v) => setFee({ ...fee, provenance: { ...fee.provenance, confidence: v as Confidence } })}
                        options={[
                          { value: "high", label: "Tinggi" },
                          { value: "medium", label: "Sedang" },
                          { value: "low", label: "Rendah" },
                        ]}
                      />
                    </Field>
                  </>
                ) : (
                  <p className="text-[0.75rem] text-muted sm:col-span-2">Data dari pengguna tersimpan sebagai <strong>User Submitted</strong> sampai diverifikasi admin.</p>
                )}
                <Field label="Catatan" className="sm:col-span-2">
                  <TextInput value={fee.provenance.notes ?? ""} onChange={(e) => setFee({ ...fee, provenance: { ...fee.provenance, notes: e.target.value || undefined } })} />
                </Field>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
