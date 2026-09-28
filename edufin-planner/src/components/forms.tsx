"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { newId } from "@/lib/engine/catalog";
import type { AssetItem, AssetType, ExpenseCategory, ExpenseItem, LiabilityItem, LiabilityType, MaritalStatus, Person } from "@/lib/engine/types";
import { formatRp } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button, Field, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "./ui";

export const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "menikah", label: "Menikah" },
  { value: "lajang", label: "Lajang" },
  { value: "cerai_hidup", label: "Cerai hidup" },
  { value: "cerai_mati", label: "Cerai mati" },
];

export function PersonForm({ person, onChange, title }: { person: Person; onChange: (p: Partial<Person>) => void; title?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {title ? <h3 className="text-[0.9rem] font-semibold">{title}</h3> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama">
          <TextInput value={person.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Nama" />
        </Field>
        <Field label="Usia">
          <NumberInput value={person.age} min={17} max={90} onChange={(v) => onChange({ age: v })} suffix="tahun" ariaLabel="Usia" />
        </Field>
        <Field label="Status pernikahan">
          <Select value={person.maritalStatus} onChange={(v) => onChange({ maritalStatus: v as MaritalStatus })} options={MARITAL_OPTIONS} />
        </Field>
        <Field label="Pekerjaan">
          <TextInput value={person.occupation} onChange={(e) => onChange({ occupation: e.target.value })} placeholder="mis. Karyawan swasta" />
        </Field>
        <Field label="Penghasilan bulanan (take-home)" hint="Contoh input: 25.000.000 atau 25 jt">
          <MoneyInput value={person.monthlyIncome} onChange={(v) => onChange({ monthlyIncome: v })} ariaLabel="Penghasilan bulanan" />
        </Field>
        <Field label="Penghasilan tahunan (otomatis)" hint="Bulanan × 12 + bonus + pendapatan tambahan × 12">
          <div className="field tnum bg-card-2">{formatRp(person.monthlyIncome * 12 + person.annualBonus + person.otherMonthlyIncome * 12)}</div>
        </Field>
        <Field label="Pertumbuhan penghasilan / tahun">
          <PercentInput value={person.incomeGrowth} onChange={(v) => onChange({ incomeGrowth: v })} min={-20} max={30} ariaLabel="Pertumbuhan penghasilan" />
        </Field>
        <Field label="Bonus / THR per tahun">
          <MoneyInput value={person.annualBonus} onChange={(v) => onChange({ annualBonus: v })} ariaLabel="Bonus tahunan" />
        </Field>
        <Field label="Pendapatan tambahan / bulan" hint="Sewa, usaha sampingan (tetap berlanjut saat pensiun)">
          <MoneyInput value={person.otherMonthlyIncome} onChange={(v) => onChange({ otherMonthlyIncome: v })} ariaLabel="Pendapatan tambahan" />
        </Field>
        <Field label="Usia pensiun (perusahaan/aturan)">
          <NumberInput value={person.retirementAge} min={40} max={80} onChange={(v) => onChange({ retirementAge: v })} suffix="tahun" ariaLabel="Usia pensiun" />
        </Field>
        <Field label="Target usia pensiun" hint="Dipakai proyeksi: penghasilan kerja berhenti di usia ini">
          <NumberInput value={person.targetRetirementAge} min={40} max={80} onChange={(v) => onChange({ targetRetirementAge: v })} suffix="tahun" ariaLabel="Target usia pensiun" />
        </Field>
        <Field label="Perkiraan pensiun bulanan (nilai hari ini)" hint="Opsional: manfaat pensiun/JHT anuitas">
          <MoneyInput value={person.pensionMonthly ?? 0} onChange={(v) => onChange({ pensionMonthly: v })} ariaLabel="Pensiun bulanan" />
        </Field>
      </div>
      {person.targetRetirementAge > person.retirementAge ? (
        <p className="text-[0.75rem] text-ink-2">Catatan: target pensiun melebihi usia pensiun perusahaan — pastikan penghasilan tetap tersedia.</p>
      ) : null}
    </div>
  );
}

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  housing: "Rumah / housing",
  food: "Makan / food",
  transportation: "Transportasi",
  healthcare: "Kesehatan",
  insurance: "Asuransi",
  lifestyle: "Gaya hidup",
  other: "Lainnya",
};

export function ExpenseEditor({ autoFocusNew }: { autoFocusNew?: boolean }) {
  const expenses = useStore((s) => s.household.expenses);
  const upsert = useStore((s) => s.upsertExpense);
  const remove = useStore((s) => s.removeExpense);
  const [draftCat, setDraftCat] = useState<ExpenseCategory>("housing");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.78rem] text-ink-2">Pengeluaran rumah tangga bulanan <strong>di luar biaya pendidikan</strong> (biaya sekolah dihitung dari rencana tiap anak) dan di luar cicilan utang.</p>
      <ul className="flex flex-col gap-2">
        {expenses.map((e) => (
          <li key={e.id} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[10rem_1fr_11rem_7rem_auto] sm:items-end">
            <Field label="Kategori">
              <Select value={e.category} onChange={(v) => upsert({ ...e, category: v as ExpenseCategory })} options={Object.entries(EXPENSE_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Keterangan">
              <TextInput value={e.label} onChange={(ev) => upsert({ ...e, label: ev.target.value })} />
            </Field>
            <Field label="Per bulan">
              <MoneyInput value={e.monthlyAmount} onChange={(v) => upsert({ ...e, monthlyAmount: v })} ariaLabel={`Jumlah ${e.label}`} />
            </Field>
            <Field label="Kenaikan/th" hint="kosong = inflasi umum">
              <PercentInput value={e.growth} onChange={(v) => upsert({ ...e, growth: v })} onClear={() => upsert({ ...e, growth: undefined })} min={-10} max={30} ariaLabel="Kenaikan" placeholder="auto" />
            </Field>
            <Button variant="ghost" onClick={() => remove(e.id)} aria-label={`Hapus ${e.label}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Tambah pengeluaran" className="w-48">
          <Select value={draftCat} onChange={(v) => setDraftCat(v as ExpenseCategory)} options={Object.entries(EXPENSE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Button
          autoFocus={autoFocusNew}
          onClick={() => upsert({ id: newId("e"), category: draftCat, label: EXPENSE_LABEL[draftCat], monthlyAmount: 0 } satisfies ExpenseItem)}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>
    </div>
  );
}

export const ASSET_LABEL: Record<AssetType, string> = {
  cash: "Kas / tabungan",
  emergency_fund: "Dana darurat",
  education_fund: "Dana pendidikan",
  retirement_fund: "Dana pensiun (DPLK/JHT)",
  investment: "Investasi umum",
  property: "Properti",
  vehicle: "Kendaraan",
  other: "Aset lain",
};

export function AssetEditor({ autoFocusNew }: { autoFocusNew?: boolean }) {
  const assets = useStore((s) => s.household.assets);
  const upsert = useStore((s) => s.upsertAsset);
  const remove = useStore((s) => s.removeAsset);
  const [draft, setDraft] = useState<AssetType>("education_fund");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.78rem] text-ink-2">
        Aset berlabel <strong>Dana pendidikan</strong> menjadi dana awal pendidikan; <strong>Dana pensiun</strong> untuk analisis pensiun. Properti tumbuh sesuai isian (default = inflasi umum), kendaraan terdepresiasi (default −10%/th).
      </p>
      <ul className="flex flex-col gap-2">
        {assets.map((a) => (
          <li key={a.id} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[11rem_1fr_11rem_7rem_auto] sm:items-end">
            <Field label="Jenis">
              <Select value={a.type} onChange={(v) => upsert({ ...a, type: v as AssetType })} options={Object.entries(ASSET_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Keterangan">
              <TextInput value={a.label} onChange={(e) => upsert({ ...a, label: e.target.value })} />
            </Field>
            <Field label="Nilai saat ini">
              <MoneyInput value={a.value} onChange={(v) => upsert({ ...a, value: v })} ariaLabel={`Nilai ${a.label}`} />
            </Field>
            <Field label="Tumbuh/th" hint={a.type === "property" || a.type === "vehicle" || a.type === "other" ? "opsional" : "pakai asumsi return"}>
              <PercentInput value={a.growth} onChange={(v) => upsert({ ...a, growth: v })} onClear={() => upsert({ ...a, growth: undefined })} min={-50} max={50} ariaLabel="Pertumbuhan aset" placeholder="auto" />
            </Field>
            <Button variant="ghost" onClick={() => remove(a.id)} aria-label={`Hapus ${a.label}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Tambah aset" className="w-52">
          <Select value={draft} onChange={(v) => setDraft(v as AssetType)} options={Object.entries(ASSET_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Button autoFocus={autoFocusNew} onClick={() => upsert({ id: newId("a"), type: draft, label: ASSET_LABEL[draft], value: 0 } satisfies AssetItem)}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>
    </div>
  );
}

export const LIABILITY_LABEL: Record<LiabilityType, string> = {
  mortgage: "KPR",
  vehicle_loan: "Kredit kendaraan",
  credit_card: "Kartu kredit",
  personal_loan: "Pinjaman pribadi",
  other: "Utang lain",
};

export function LiabilityEditor() {
  const items = useStore((s) => s.household.liabilities);
  const upsert = useStore((s) => s.upsertLiability);
  const remove = useStore((s) => s.removeLiability);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((l) => (
          <li key={l.id} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[9rem_1fr_10rem_6.5rem_10rem_6.5rem_auto] sm:items-end">
            <Field label="Jenis">
              <Select value={l.type} onChange={(v) => upsert({ ...l, type: v as LiabilityType })} options={Object.entries(LIABILITY_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Keterangan">
              <TextInput value={l.label} onChange={(e) => upsert({ ...l, label: e.target.value })} />
            </Field>
            <Field label="Sisa pokok">
              <MoneyInput value={l.outstanding} onChange={(v) => upsert({ ...l, outstanding: v })} ariaLabel="Sisa pokok" />
            </Field>
            <Field label="Bunga/th">
              <PercentInput value={l.annualRate} onChange={(v) => upsert({ ...l, annualRate: v })} min={0} max={60} ariaLabel="Bunga" />
            </Field>
            <Field label="Cicilan/bulan">
              <MoneyInput value={l.monthlyPayment} onChange={(v) => upsert({ ...l, monthlyPayment: v })} ariaLabel="Cicilan" />
            </Field>
            <Field label="Sisa tenor">
              <NumberInput value={l.remainingMonths} min={0} max={480} onChange={(v) => upsert({ ...l, remainingMonths: v })} suffix="bln" ariaLabel="Sisa tenor" />
            </Field>
            <Button variant="ghost" onClick={() => remove(l.id)} aria-label={`Hapus ${l.label}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          onClick={() =>
            upsert({ id: newId("l"), type: "mortgage", label: "KPR", outstanding: 0, annualRate: 0.09, monthlyPayment: 0, remainingMonths: 120 } satisfies LiabilityItem)
          }
        >
          <Plus className="h-4 w-4" /> Tambah utang
        </Button>
      </div>
    </div>
  );
}
