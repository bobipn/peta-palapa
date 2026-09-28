"use client";

import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL, FEE_CATALOG, FREQUENCY_LABEL, LEVEL_LABEL, makeComponent, newId } from "@/lib/engine/catalog";
import type { ProjectedRow } from "@/lib/engine/costs";
import { pickSchedule, resolveTiers } from "@/lib/engine/costs";
import { ageToday, gradeIndexFromNational, levelSequence } from "@/lib/engine/educationPath";
import { INFLATION_LABEL } from "@/lib/engine/defaults";
import type { ChildResult } from "@/lib/engine/plan";
import type { Child, Explain, FeeComponent, Frequency, Level, LevelPlan, SchoolCategory, TargetEducation } from "@/lib/engine/types";
import { SCHOOL_CATEGORIES } from "@/lib/engine/types";
import { formatPct, formatRp, formatRpCompact } from "@/lib/format";
import { useDb, usePlan } from "@/lib/hooks";
import { emptyChild, useStore } from "@/lib/store";
import { childColorVar, nextColorIndex, VERIFICATION_LABEL, VERIFICATION_TONE } from "@/lib/ui-helpers";
import { ExplainButton } from "../Explain";
import { FeeScheduleTable, ProvenanceBox, SchoolPicker, scheduleLabel, schoolById } from "../SchoolBits";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, MoneyInput, NumberInput, PageHeader, Segmented, Select, Sheet, StatusPill, TextInput, Toggle } from "../ui";

const LEVEL_CHOICES: { value: string; label: string }[] = [
  { value: "none", label: "Belum sekolah" },
  { value: "TK", label: "TK" },
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "SMA", label: "SMA" },
  { value: "SMK", label: "SMK" },
  { value: "D3", label: "D3" },
  { value: "S1", label: "S1" },
];

function gradeOptions(level: Level): { value: string; label: string }[] {
  switch (level) {
    case "TK":
      return [
        { value: "1", label: "TK A" },
        { value: "2", label: "TK B" },
      ];
    case "SD":
      return [1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `Kelas ${g}` }));
    case "SMP":
      return [7, 8, 9].map((g) => ({ value: String(gradeIndexFromNational("SMP", g)), label: `Kelas ${g}` }));
    case "SMA":
    case "SMK":
      return [10, 11, 12].map((g) => ({ value: String(gradeIndexFromNational(level, g)), label: `Kelas ${g}` }));
    default:
      return [1, 2, 3, 4].map((g) => ({ value: String(g), label: `Tahun ${g}` }));
  }
}

export function ChildForm({ child, onChange }: { child: Child; onChange: (c: Child) => void }) {
  const cities = useStore((s) => s.masterData.cities);
  const set = (patch: Partial<Child>) => onChange({ ...child, ...patch });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nama anak">
        <TextInput value={child.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nama" />
      </Field>
      <Field label="Jenis kelamin">
        <Segmented
          ariaLabel="Jenis kelamin"
          value={child.gender}
          onChange={(v) => set({ gender: v })}
          options={[
            { value: "L", label: "Laki-laki" },
            { value: "P", label: "Perempuan" },
          ]}
        />
      </Field>
      <Field label="Tanggal lahir" hint={`Usia saat ini: ${ageToday(child.birthDate, today)} tahun`}>
        <TextInput type="date" value={child.birthDate} max={today} onChange={(e) => e.target.value && set({ birthDate: e.target.value })} />
      </Field>
      <Field label="Lokasi pendidikan (kota)">
        <Select value={child.educationLocation ?? ""} onChange={(v) => set({ educationLocation: v || undefined })} options={[{ value: "", label: "Sama dengan domisili" }, ...cities.map((c) => ({ value: c, label: c }))]} />
      </Field>
      <Field label="Jenjang saat ini (TA berjalan)">
        <Select
          value={child.currentLevel}
          onChange={(v) => set({ currentLevel: v as Child["currentLevel"], currentGrade: v === "none" ? undefined : 1 })}
          options={LEVEL_CHOICES}
        />
      </Field>
      {child.currentLevel !== "none" ? (
        <Field label="Kelas saat ini">
          <Select value={String(child.currentGrade ?? 1)} onChange={(v) => set({ currentGrade: Number(v) })} options={gradeOptions(child.currentLevel)} />
        </Field>
      ) : (
        <Field label="Target tahun masuk SD (opsional)" hint="Kosongkan untuk dihitung dari usia masuk SD">
          <NumberInput value={child.targetSdEntryYear ?? NaN} min={2020} max={2045} onChange={(v) => set({ targetSdEntryYear: v || undefined })} ariaLabel="Target tahun masuk SD" />
        </Field>
      )}
      <Field label="Sekolah saat ini">
        <TextInput value={child.currentSchoolName ?? ""} onChange={(e) => set({ currentSchoolName: e.target.value })} placeholder="Nama sekolah (opsional)" />
      </Field>
      <Field label="Target pendidikan">
        <Select
          value={child.targetEducation}
          onChange={(v) => set({ targetEducation: v as TargetEducation })}
          options={[
            { value: "SMA", label: "Sampai SMA/SMK" },
            { value: "D3", label: "Diploma (D3)" },
            { value: "S1", label: "Sarjana (S1)" },
            { value: "S2", label: "Magister (S2)" },
          ]}
        />
      </Field>
      <Field label="Jalur menengah atas">
        <Segmented ariaLabel="SMA atau SMK" value={child.secondaryTrack} onChange={(v) => set({ secondaryTrack: v })} options={[{ value: "SMA", label: "SMA" }, { value: "SMK", label: "SMK" }]} />
      </Field>
      {child.currentLevel === "none" ? (
        <Field label="TK">
          <Toggle checked={child.includeTK} onChange={(v) => set({ includeTK: v })} label="Masuk TK (2 tahun) sebelum SD" />
        </Field>
      ) : null}
      <Field label="Target sekolah">
        <TextInput value={child.targetSchoolName ?? ""} onChange={(e) => set({ targetSchoolName: e.target.value })} placeholder="mis. SMA incaran" />
      </Field>
      <Field label="Target universitas">
        <TextInput value={child.targetUniversityName ?? ""} onChange={(e) => set({ targetUniversityName: e.target.value })} placeholder="mis. UI — Ilmu Komputer" />
      </Field>
      <Field label="Target tahun masuk universitas (opsional)" hint="Diisi bila ada gap year">
        <NumberInput value={child.targetUniversityEntryYear ?? NaN} min={2026} max={2060} onChange={(v) => set({ targetUniversityEntryYear: v || undefined })} ariaLabel="Target tahun masuk universitas" />
      </Field>
    </div>
  );
}

function rowExplain(r: ProjectedRow, childName: string): Explain {
  return {
    title: `${childName} · ${r.level} ${r.gradeLabel} · TA ${r.ay}/${r.ay + 1}`,
    inputs: r.components.map((c) => ({
      label: `${c.label} (${FREQUENCY_LABEL[c.frequency]})`,
      value: `${formatRp(c.baseAnnual)} @ TA ${c.dataYear} → ${formatRp(c.amount)}`,
      note: `${INFLATION_LABEL[c.inflationKey]} ${formatPct(c.rate)}, n = ${c.n}${c.multiplier !== 1 ? `, × ${c.multiplier}` : ""}`,
    })),
    formula: "Biaya TA = Σ komponen: (nominal per periode × periode per tahun) × (1 + inflasi komponen)^(TA − tahun data)",
    substitution: r.components[0]
      ? `${r.components[0].label}: ${formatRp(r.components[0].baseAnnual)} × (1 + ${formatPct(r.components[0].rate)})^${r.components[0].n} = ${formatRp(r.components[0].amount)}`
      : undefined,
    assumptions: [
      "Biaya sekali (uang pangkal dll.) hanya dihitung pada tahun pertama jenjang.",
      "Komponen bulanan × 12 bulan; semester × 2.",
      `Sumber biaya: ${r.sourceLabel} (${VERIFICATION_LABEL[r.verification]}).`,
    ],
    result: formatRp(r.total),
  };
}

function LevelPlanEditor({ child, level, result }: { child: Child; level: Level; result?: ChildResult }) {
  const db = useDb();
  const homeCity = useStore((s) => s.household.homeCity);
  const setLevelPlan = useStore((s) => s.setLevelPlan);
  const plan: LevelPlan = child.levelPlans[level] ?? { mode: "none" };
  const set = (p: LevelPlan | undefined) => setLevelPlan(child.id, level, p);
  const src = result?.sources[level];
  const rows = result?.rows.filter((r) => r.level === level) ?? [];
  const schedules = plan.mode === "school" && plan.schoolId ? db.fees.filter((f) => f.schoolId === plan.schoolId && f.level === level && !f.archived) : [];
  const active = plan.mode === "school" && plan.schoolId ? pickSchedule(db, plan.schoolId, level, plan.feeScheduleId, child.gender) : undefined;
  const tierGroups = useMemo(() => {
    if (!active) return [];
    const groups = new Map<string, FeeComponent[]>();
    for (const c of active.components) if (c.tierGroup && !c.tierGroup.startsWith("gender")) groups.set(c.tierGroup, [...(groups.get(c.tierGroup) ?? []), c]);
    return [...groups.entries()];
  }, [active]);
  const chosen = active ? new Set(resolveTiers(active.components, plan.tierChoices, child.gender).map((c) => c.id)) : new Set<string>();
  const optional = active?.components.filter((c) => c.group === "optional" && !c.excluded) ?? [];
  const [showSchedule, setShowSchedule] = useState(false);
  const isUni = level === "D3" || level === "S1" || level === "S2";

  return (
    <Card>
      <CardHeader
        title={`${LEVEL_LABEL[level]}${rows.length ? ` · TA ${rows[0].ay}/${rows[0].ay + 1}–${rows[rows.length - 1].ay}/${rows[rows.length - 1].ay + 1}` : ""}`}
        subtitle={src ? src.label : "Belum ada biaya"}
        action={
          src ? (
            src.kind === "none" ? (
              <StatusPill tone="warning">Belum ditentukan</StatusPill>
            ) : (
              <StatusPill tone={VERIFICATION_TONE[src.verification]}>{VERIFICATION_LABEL[src.verification]}</StatusPill>
            )
          ) : null
        }
      />
      <CardBody className="flex flex-col gap-3">
        <Segmented
          ariaLabel="Sumber biaya"
          value={plan.mode}
          onChange={(mode) => set({ ...plan, mode })}
          options={[
            { value: "school", label: "Sekolah" },
            { value: "custom", label: "Input sendiri" },
            { value: "benchmark", label: "Benchmark" },
            { value: "none", label: "Kosong" },
          ]}
        />
        {plan.mode === "school" ? (
          <div className="flex flex-col gap-2">
            <SchoolPicker db={db} level={level} value={plan.schoolId} city={child.educationLocation || homeCity} onChange={(id) => set({ ...plan, schoolId: id || undefined, feeScheduleId: undefined, tierChoices: undefined })} />
            {schedules.length > 1 ? (
              <Field label={isUni ? "Program studi & jalur masuk" : "Program / jadwal biaya"} hint={isUni ? "Biaya universitas berbeda per program — pilih yang sesuai target." : undefined}>
                <Select
                  value={plan.feeScheduleId ?? active?.id ?? ""}
                  onChange={(v) => set({ ...plan, feeScheduleId: v || undefined, tierChoices: undefined })}
                  options={schedules
                    .slice()
                    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || (a.program ?? "").localeCompare(b.program ?? ""))
                    .map((f) => ({ value: f.id, label: scheduleLabel(f) }))}
                />
              </Field>
            ) : null}
            {tierGroups.map(([g, members]) => (
              <Field key={g} label={g === "ukt" ? "Kelompok UKT (ditentukan kampus dari kemampuan ekonomi)" : g === "ipi" ? "Kelompok IPI" : g === "bpif" ? "Kelompok BPIF" : g === "usp" ? "Grade USP" : "Pilihan kelas"} hint="Default = nilai tertinggi (konservatif)">
                <Select
                  value={members.find((m) => chosen.has(m.id))?.id ?? ""}
                  onChange={(v) => set({ ...plan, tierChoices: { ...(plan.tierChoices ?? {}), [g]: v } })}
                  options={members.map((m) => ({ value: m.id, label: `${m.label} — ${formatRp(m.amount)}` }))}
                />
              </Field>
            ))}
            {optional.length ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-medium text-ink-2">Biaya opsional</span>
                {optional.map((c) => (
                  <Toggle
                    key={c.id}
                    checked={(plan.includeOptionalCodes ?? []).includes(c.id)}
                    onChange={(v) => {
                      const cur = new Set(plan.includeOptionalCodes ?? []);
                      if (v) cur.add(c.id);
                      else cur.delete(c.id);
                      set({ ...plan, includeOptionalCodes: [...cur] });
                    }}
                    label={`${c.label} — ${formatRp(c.amount)} ${FREQUENCY_LABEL[c.frequency]}`}
                  />
                ))}
              </div>
            ) : null}
            {active ? (
              <div className="flex flex-col gap-2">
                <button type="button" className="self-start text-[0.78rem] font-medium text-accent-ink hover:underline" onClick={() => setShowSchedule((v) => !v)}>
                  {showSchedule ? "Sembunyikan rincian biaya & sumber" : "Lihat rincian biaya & sumber data"}
                </button>
                {showSchedule ? (
                  <>
                    <FeeScheduleTable schedule={active} />
                    <ProvenanceBox p={active.provenance} />
                  </>
                ) : null}
                {active.incomplete ? <p className="text-[0.78rem] text-ink-2">⚠︎ {active.notes}</p> : null}
              </div>
            ) : plan.schoolId ? (
              <p className="text-[0.8rem] text-ink-2">{schoolById(db, plan.schoolId)?.name} belum memiliki data biaya {level}. Gunakan “Input sendiri” atau tambahkan data di Admin.</p>
            ) : null}
          </div>
        ) : null}
        {plan.mode === "custom" ? <CustomComponentsEditor plan={plan} onChange={set} /> : null}
        {plan.mode === "benchmark" ? (
          <div className="flex flex-col gap-2">
            <Field label="Kategori benchmark" hint="Median jadwal biaya di database (Estimated) — bukan kuotasi sekolah tertentu.">
              <Select
                value={plan.benchmarkCategory ?? ""}
                onChange={(v) => set({ ...plan, benchmarkCategory: (v || undefined) as SchoolCategory | undefined })}
                options={[{ value: "", label: "Semua kategori" }, ...SCHOOL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
              />
            </Field>
            {src?.note ? <p className="text-[0.75rem] text-muted">{src.note}</p> : null}
          </div>
        ) : null}
        {plan.mode !== "none" ? (
          <ExtrasEditor
            items={plan.extraComponents ?? []}
            onChange={(extraComponents) => set({ ...plan, extraComponents })}
            hint={isUni ? "Tambahkan biaya hidup/kos, transport, laptop bila kuliah di luar kota." : "Biaya keluarga di luar tagihan sekolah: antar jemput, uang saku, les, dll."}
          />
        ) : null}
        {rows.length ? (
          <div className="scroll-x rounded-lg border border-line">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TA</th>
                  <th>Kelas</th>
                  <th>Usia</th>
                  <th className="num">Harga hari ini</th>
                  <th className="num">Proyeksi nominal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ay}>
                    <td>
                      {r.ay}/{String((r.ay + 1) % 100).padStart(2, "0")}
                      {r.isCurrent ? <span className="ml-1 text-[0.68rem] text-muted">berjalan</span> : null}
                    </td>
                    <td>{r.gradeLabel}</td>
                    <td>{r.age}</td>
                    <td className="num">{formatRp(r.todayTotal)}</td>
                    <td className="num font-medium">{formatRp(r.total)}</td>
                    <td>
                      <ExplainButton explain={rowExplain(r, child.name)} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "per bulan" },
  { value: "semester", label: "per semester" },
  { value: "annual", label: "per tahun" },
  { value: "one_time", label: "sekali (masuk jenjang)" },
];

function ComponentListEditor({ items, onChange, codes }: { items: FeeComponent[]; onChange: (v: FeeComponent[]) => void; codes: string[] }) {
  const [code, setCode] = useState(codes[0]);
  const byCode = new Map(FEE_CATALOG.map((e) => [e.code, e]));
  return (
    <div className="flex flex-col gap-2">
      {items.map((c, i) => (
        <div key={c.id} className="grid grid-cols-[1fr_9rem] gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_10rem_9.5rem_auto] sm:items-end">
          <Field label={CATEGORY_LABEL[c.category]}>
            <TextInput value={c.label} onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          </Field>
          <Field label="Nominal">
            <MoneyInput value={c.amount} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...x, amount: v } : x)))} ariaLabel={`Nominal ${c.label}`} />
          </Field>
          <Field label="Frekuensi">
            <Select value={c.frequency} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...x, frequency: v as Frequency } : x)))} options={FREQ_OPTIONS} />
          </Field>
          <Button variant="ghost" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Hapus ${c.label}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <Select value={code} onChange={setCode} options={codes.map((c) => ({ value: c, label: byCode.get(c)?.label ?? c }))} className="w-56" aria-label="Jenis biaya" />
        <Button size="sm" onClick={() => onChange([...items, makeComponent(code, 0, { id: newId("fc"), included: true })])}>
          <Plus className="h-4 w-4" /> Tambah biaya
        </Button>
      </div>
    </div>
  );
}

function CustomComponentsEditor({ plan, onChange }: { plan: LevelPlan; onChange: (p: LevelPlan) => void }) {
  const codes = FEE_CATALOG.filter((e) => e.group === "entry" || e.group === "recurring").map((e) => e.code);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.78rem] text-ink-2">Masukkan biaya dari brosur/tagihan sekolah. Data ini ditandai <strong>User Submitted</strong>. Untuk sekolah negeri, SPP bisa diisi Rp0 dan biaya operasional ditambahkan di bawah.</p>
      <ComponentListEditor items={plan.customComponents ?? []} onChange={(customComponents) => onChange({ ...plan, customComponents })} codes={codes} />
    </div>
  );
}

function ExtrasEditor({ items, onChange, hint }: { items: FeeComponent[]; onChange: (v: FeeComponent[]) => void; hint: string }) {
  const codes = FEE_CATALOG.filter((e) => e.group === "operational" || e.group === "optional").map((e) => e.code);
  return (
    <details className="rounded-lg border border-line p-2.5" open={items.length > 0}>
      <summary className="cursor-pointer text-[0.82rem] font-medium">Biaya operasional keluarga ({items.length})</summary>
      <p className="mb-2 mt-1 text-[0.75rem] text-muted">{hint} Diinput dengan harga hari ini dan dinaikkan dengan inflasi komponen.</p>
      <ComponentListEditor items={items} onChange={onChange} codes={codes} />
    </details>
  );
}

function ChildDetail({ id }: { id: string }) {
  const router = useRouter();
  const child = useStore((s) => s.household.children.find((c) => c.id === id));
  const upsert = useStore((s) => s.upsertChild);
  const remove = useStore((s) => s.removeChild);
  const plan = usePlan();
  const result = plan.children.find((c) => c.child.id === id);
  if (!child) return <EmptyState title="Anak tidak ditemukan" action={<Link href="/children/">Kembali</Link>} />;
  const levels = levelSequence(child);
  const t = result?.timeline;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/children/" className="inline-flex items-center gap-1 text-[0.85rem] text-ink-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Semua anak
        </Link>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(`Hapus ${child.name || "anak ini"} dari rencana?`)) {
              remove(child.id);
              router.push("/children/");
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> Hapus
        </Button>
      </div>
      <PageHeader
        title={child.name || "Anak"}
        subtitle={
          t
            ? `SD mulai ${t.sdEntryYear ?? "—"} · kuliah mulai ${t.universityEntryYear ?? "—"} · lulus ${t.graduationYear ?? "—"} · total ${formatRpCompact(result?.totalNominal ?? 0)} (nominal)`
            : undefined
        }
      />
      {result?.timeline.warnings.length ? (
        <Card>
          <CardBody>
            <ul className="list-disc pl-5 text-[0.8rem] text-ink-2">
              {result.timeline.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Profil anak" />
        <CardBody>
          <ChildForm child={child} onChange={upsert} />
        </CardBody>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-[0.78rem] text-ink-2">Biaya TA berjalan</div>
          <div className="text-xl font-semibold">{formatRpCompact(result?.currentAyCost ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[0.78rem] text-ink-2">Sisa perjalanan, harga hari ini</div>
          <div className="text-xl font-semibold">{formatRpCompact(result?.todayPriceTotal ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[0.78rem] text-ink-2">Sisa perjalanan, nominal masa depan</div>
          <div className="text-xl font-semibold">{formatRpCompact(result?.futureNominal ?? 0)}</div>
        </div>
      </div>
      <h2 className="mt-2 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Rencana biaya per jenjang</h2>
      {levels.map((l) => (
        <LevelPlanEditor key={l} child={child} level={l} result={result} />
      ))}
    </div>
  );
}

function NewChildSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const children = useStore((s) => s.household.children);
  const upsert = useStore((s) => s.upsertChild);
  const router = useRouter();
  const [draft, setDraft] = useState<Child>(() => ({ ...emptyChild(), colorIndex: nextColorIndex(children) }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tambah anak"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            disabled={!draft.name.trim()}
            onClick={() => {
              upsert(draft);
              onClose();
              router.push(`/children/?id=${draft.id}`);
            }}
          >
            Simpan & atur biaya
          </Button>
        </>
      }
    >
      <ChildForm child={draft} onChange={setDraft} />
    </Sheet>
  );
}

export function ChildrenPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const isNew = params.get("new") === "1";
  const children = useStore((s) => s.household.children);
  const plan = usePlan();
  if (id) return <ChildDetail id={id} />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Children"
        subtitle="Profil dan jalur pendidikan setiap anak (mendukung ≥5 anak). Biaya tiap jenjang bisa dari database sekolah, input sendiri, atau benchmark."
        actions={
          <Button variant="primary" onClick={() => router.push("/children/?new=1")}>
            <Plus className="h-4 w-4" /> Tambah anak
          </Button>
        }
      />
      {children.length === 0 ? (
        <Card>
          <EmptyState title="Belum ada anak" body="Tambahkan anak untuk memproyeksikan biaya pendidikan dari sekolah saat ini sampai perguruan tinggi." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plan.children.map((cr, i) => {
            const c = cr.child;
            const missing = plan.missingCosts.filter((m) => m.childId === c.id).length;
            const seq = levelSequence(c);
            return (
              <Link key={c.id} href={`/children/?id=${c.id}`} className="card flex flex-col gap-3 p-4 hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: `var(${childColorVar(c, i)})` }} />
                    <div>
                      <div className="text-[1rem] font-semibold">{c.name || "(tanpa nama)"}</div>
                      <div className="text-[0.78rem] text-ink-2">
                        {ageToday(c.birthDate, plan.planDate)} tahun · {c.currentLevel === "none" ? "belum sekolah" : `${c.currentLevel} ${cr.rows[0]?.gradeLabel ?? ""}`} · target {c.targetEducation}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-1">
                  {seq.map((l) => {
                    const src = cr.sources[l];
                    const rows = cr.rows.filter((r) => r.level === l);
                    return (
                      <Badge key={l}>
                        {l} {rows[0]?.ay ?? ""}
                        {src?.kind === "none" ? " · ?" : src?.kind === "benchmark" ? " · est." : ""}
                      </Badge>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.78rem]">
                  <div>
                    <div className="text-muted">Total s.d. lulus (nominal)</div>
                    <div className="tnum text-[0.95rem] font-semibold">{formatRpCompact(cr.totalNominal)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Harga hari ini</div>
                    <div className="tnum text-[0.95rem] font-semibold">{formatRpCompact(cr.todayPriceTotal + cr.currentAyCost)}</div>
                  </div>
                </div>
                {missing ? <StatusPill tone="warning">{missing} jenjang belum ada biaya</StatusPill> : null}
              </Link>
            );
          })}
        </div>
      )}
      {isNew ? <NewChildSheet open onClose={() => router.push("/children/")} /> : null}
    </div>
  );
}
