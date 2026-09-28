"use client";

import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRpCompact } from "@/lib/format";
import { useStore, emptyChild } from "@/lib/store";
import { nextColorIndex } from "@/lib/ui-helpers";
import { AssetEditor, ExpenseEditor, LiabilityEditor, PersonForm } from "../forms";
import { Button, Card, CardBody, CardHeader, Field, MoneyInput, PageHeader, PercentInput, Select, TextInput, Toggle } from "../ui";
import { ChildForm } from "./Children";

const STEPS = ["Keluarga", "Orang tua", "Pasangan", "Anak", "Pengeluaran", "Aset & utang", "Rencana investasi"] as const;

export function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const household = useStore((s) => s.household);
  const setHousehold = useStore((s) => s.setHousehold);
  const updatePerson = useStore((s) => s.updatePerson);
  const setSpouse = useStore((s) => s.setSpouse);
  const upsertChild = useStore((s) => s.upsertChild);
  const setOnboarded = useStore((s) => s.setOnboarded);
  const cities = useStore((s) => s.masterData.cities);
  const [openChild, setOpenChild] = useState<string | null>(household.children[0]?.id ?? null);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const finish = () => {
    setOnboarded(true);
    router.push("/");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Profil keluarga" subtitle="Isi secukupnya — semua bisa diubah nanti. Data tersimpan di browser ini (atau akun cloud bila masuk)." />
      <ol className="scroll-x flex gap-1.5" aria-label="Langkah onboarding">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={
                i === step
                  ? "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3 text-[0.78rem] font-medium text-page"
                  : "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 text-[0.78rem] text-ink-2 hover:bg-card-2"
              }
            >
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="tnum">{i + 1}</span>}
              {s}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader title={STEPS[step]} />
        <CardBody>
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama keluarga">
                <TextInput value={household.familyName} onChange={(e) => setHousehold((h) => ({ ...h, familyName: e.target.value }))} placeholder="mis. Keluarga Wibowo" />
              </Field>
              <Field label="Domisili">
                <Select value={household.homeCity} onChange={(v) => setHousehold((h) => ({ ...h, homeCity: v }))} options={[...new Set([household.homeCity, ...cities])].map((c) => ({ value: c, label: c }))} />
              </Field>
              <p className="text-[0.78rem] text-ink-2 sm:col-span-2">
                Database awal mencakup sekolah & kampus di Kota Depok, Kota Bogor, dan Kabupaten Bogor. Kota lain bisa ditambahkan di Admin.
              </p>
            </div>
          ) : null}
          {step === 1 ? <PersonForm person={household.primary} onChange={(p) => updatePerson("primary", p)} /> : null}
          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <Toggle checked={!!household.spouse} onChange={setSpouse} label="Tambahkan pasangan" />
              {household.spouse ? <PersonForm person={household.spouse} onChange={(p) => updatePerson("spouse", p)} /> : <p className="text-[0.8rem] text-ink-2">Lewati bila orang tua tunggal.</p>}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="flex flex-col gap-3">
              {household.children.map((c) => (
                <div key={c.id} className="rounded-xl border border-line">
                  <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left" onClick={() => setOpenChild(openChild === c.id ? null : c.id)} aria-expanded={openChild === c.id}>
                    <span className="font-medium">{c.name || "Anak baru"}</span>
                    <span className="text-[0.75rem] text-muted">{c.birthDate}</span>
                  </button>
                  {openChild === c.id ? (
                    <div className="border-t border-line p-3">
                      <ChildForm child={c} onChange={upsertChild} />
                    </div>
                  ) : null}
                </div>
              ))}
              <div>
                <Button
                  onClick={() => {
                    const c = { ...emptyChild(), colorIndex: nextColorIndex(household.children) };
                    upsertChild(c);
                    setOpenChild(c.id);
                  }}
                >
                  <Plus className="h-4 w-4" /> Tambah anak
                </Button>
              </div>
              <p className="text-[0.75rem] text-muted">Sekolah & biaya per jenjang diatur di halaman Children setelah onboarding.</p>
            </div>
          ) : null}
          {step === 4 ? <ExpenseEditor /> : null}
          {step === 5 ? (
            <div className="flex flex-col gap-6">
              <AssetEditor />
              <div>
                <h3 className="mb-2 text-[0.9rem] font-semibold">Utang</h3>
                <LiabilityEditor />
              </div>
            </div>
          ) : null}
          {step === 6 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Investasi pendidikan per bulan (rencana)">
                <MoneyInput value={household.educationPlan.monthlyContribution} onChange={(v) => setHousehold((h) => ({ ...h, educationPlan: { ...h.educationPlan, monthlyContribution: v } }))} ariaLabel="Investasi pendidikan" />
              </Field>
              <Field label="Kenaikan setoran per tahun" hint="0% = setoran tetap">
                <PercentInput value={household.educationPlan.stepUp ?? 0} onChange={(v) => setHousehold((h) => ({ ...h, educationPlan: { ...h.educationPlan, stepUp: v } }))} min={0} max={30} ariaLabel="Kenaikan setoran" />
              </Field>
              <Field label="Investasi pensiun per bulan (rencana)">
                <MoneyInput value={household.retirementPlan.monthlyContribution} onChange={(v) => setHousehold((h) => ({ ...h, retirementPlan: { monthlyContribution: v } }))} ariaLabel="Investasi pensiun" />
              </Field>
              <div className="rounded-lg bg-card-2 p-3 text-[0.8rem] text-ink-2">
                Dana pendidikan saat ini: {formatRpCompact(household.assets.filter((a) => a.type === "education_fund").reduce((s, a) => s + a.value, 0))} (aset berlabel “Dana pendidikan”).
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={prev} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Button>
        <div className="flex gap-2">
          <Link href="/" className="inline-flex h-10 items-center rounded-[10px] px-3 text-[0.85rem] text-ink-2 hover:bg-card-2">
            Nanti saja
          </Link>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Lanjut <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              Selesai <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
