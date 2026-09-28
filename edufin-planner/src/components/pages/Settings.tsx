"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ASSUMPTION_NOTES, INFLATION_LABEL, RETURN_LABEL, todayIso } from "@/lib/engine/defaults";
import { PROFILE_LABEL, PROFILE_ORDER } from "@/lib/engine/risk";
import type { Assumptions, InflationKey } from "@/lib/engine/types";
import { REFERENCES } from "@/lib/data/seed";
import { formatDate } from "@/lib/format";
import { loadDemoHousehold } from "@/lib/demo";
import { downloadText } from "@/lib/csv";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useAuth, signOut } from "@/lib/supabase/auth";
import { pullFromCloud, pushToCloud } from "@/lib/supabase/sync";
import { SCHEMA_VERSION, useStore, type ThemePref } from "@/lib/store";
import { DISCLAIMER_EN, DISCLAIMER_ID } from "../AppShell";
import { Button, Card, CardBody, CardHeader, Field, NumberInput, PageHeader, PercentInput, Segmented, Select, StatusPill, Toggle } from "../ui";

function AssumptionsCard() {
  const a = useStore((s) => s.assumptions);
  const set = useStore((s) => s.setAssumptions);
  const reset = useStore((s) => s.resetAssumptions);
  const pin = useStore((s) => s.pinPlanDate);
  const setPin = useStore((s) => s.setPinPlanDate);
  const t = a.affordabilityThresholds;
  const setT = (i: number, v: number) => {
    const next = [...t] as Assumptions["affordabilityThresholds"];
    next[i] = v;
    set({ affordabilityThresholds: next });
  };
  return (
    <Card>
      <CardHeader
        title="Asumsi perencanaan"
        subtitle="Semua parameter dapat diubah. Setiap output menampilkan asumsi yang dipakai pada “Cara hitung”."
        action={
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Default
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <Field label="Tanggal valuasi rencana" hint={pin ? "Dikunci" : "Mengikuti tanggal hari ini"}>
            <input type="date" className="field" value={a.planDate} disabled={!pin} onChange={(e) => e.target.value && set({ planDate: e.target.value })} />
          </Field>
          <Field label="Kunci tanggal">
            <Toggle checked={pin} onChange={setPin} label="Pakai tanggal tetap (untuk laporan)" />
          </Field>
        </section>
        <section>
          <h3 className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Inflasi</h3>
          <div className="grid gap-3 sm:grid-cols-5">
            {(Object.keys(INFLATION_LABEL) as InflationKey[]).map((k) => (
              <Field key={k} label={INFLATION_LABEL[k]}>
                <PercentInput value={a.inflation[k]} onChange={(v) => set({ inflation: { ...a.inflation, [k]: v } })} min={-5} max={30} ariaLabel={INFLATION_LABEL[k]} />
              </Field>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Return (asumsi, bukan jaminan)</h3>
          <div className="grid gap-3 sm:grid-cols-5">
            {(Object.keys(RETURN_LABEL) as (keyof Assumptions["returns"])[]).map((k) => (
              <Field key={k} label={RETURN_LABEL[k]}>
                <PercentInput value={a.returns[k]} onChange={(v) => set({ returns: { ...a.returns, [k]: v } })} min={-10} max={30} ariaLabel={RETURN_LABEL[k]} />
              </Field>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {(["conservative", "base", "optimistic"] as const).map((k) => (
              <Field key={k} label={`Skenario menabung: ${k}`}>
                <PercentInput value={a.savingScenarios[k]} onChange={(v) => set({ savingScenarios: { ...a.savingScenarios, [k]: v } })} min={0} max={30} ariaLabel={k} />
              </Field>
            ))}
            <Field label="Frekuensi investasi">
              <Select
                value={String(a.contributionFrequency)}
                onChange={(v) => set({ contributionFrequency: Number(v) as 12 | 4 | 1 })}
                options={[
                  { value: "12", label: "Bulanan" },
                  { value: "4", label: "Kuartalan" },
                  { value: "1", label: "Tahunan" },
                ]}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {PROFILE_ORDER.map((p) => (
              <Field key={p} label={`Return profil ${PROFILE_LABEL[p]}`}>
                <PercentInput value={a.profileReturns[p]} onChange={(v) => set({ profileReturns: { ...a.profileReturns, [p]: v } })} min={0} max={30} ariaLabel={`Return ${p}`} />
              </Field>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Ambang affordability (biaya pendidikan / pendapatan)</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            {["Very comfortable <", "Healthy <", "Moderate <", "High <"].map((l, i) => (
              <Field key={l} label={l}>
                <PercentInput value={t[i]} onChange={(v) => setT(i, v)} min={1} max={100} ariaLabel={l} />
              </Field>
            ))}
          </div>
          <p className="mt-1 text-[0.72rem] text-muted">Konvensi aplikasi, bukan standar universal perencanaan keuangan.</p>
        </section>
        <section className="grid gap-3 sm:grid-cols-4">
          <Field label="Batas Partially Funded" hint="Funded ratio minimum">
            <PercentInput value={a.partialFundingThreshold} onChange={(v) => set({ partialFundingThreshold: v })} min={0} max={100} ariaLabel="Batas partially funded" />
          </Field>
          <Field label="Target dana darurat">
            <NumberInput value={a.emergencyFundTargetMonths} min={0} max={36} onChange={(v) => set({ emergencyFundTargetMonths: v })} suffix="bulan" ariaLabel="Target dana darurat" />
          </Field>
          <Field label="Harapan hidup (perencanaan)">
            <NumberInput value={a.lifeExpectancy} min={60} max={105} onChange={(v) => set({ lifeExpectancy: v })} suffix="tahun" ariaLabel="Harapan hidup" />
          </Field>
          <Field label="Kebutuhan hidup saat pensiun">
            <PercentInput value={a.retirementExpenseRatio} onChange={(v) => set({ retirementExpenseRatio: v })} min={20} max={150} ariaLabel="Rasio pensiun" />
          </Field>
          <Field label="Horizon proyeksi minimum">
            <NumberInput value={a.projectionYears} min={30} max={70} onChange={(v) => set({ projectionYears: Math.max(30, v) })} suffix="tahun" ariaLabel="Horizon" />
          </Field>
          <Field label="Alert data belum diverifikasi">
            <NumberInput value={a.staleDataMonths} min={1} max={60} onChange={(v) => set({ staleDataMonths: v })} suffix="bulan" ariaLabel="Batas data lama" />
          </Field>
          <Field label="Usia masuk SD (per 1 Juli)">
            <NumberInput value={a.sdEntryAge} min={5} max={8} onChange={(v) => set({ sdEntryAge: v })} suffix="tahun" ariaLabel="Usia masuk SD" />
          </Field>
          <Field label="Surplus tak teralokasi → investasi">
            <PercentInput value={a.surplusInvestShare} onChange={(v) => set({ surplusInvestShare: v })} min={0} max={100} ariaLabel="Surplus ke investasi" />
          </Field>
        </section>
        <section>
          <h3 className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">Dasar asumsi default</h3>
          <ul className="space-y-1.5 text-[0.78rem] text-ink-2">
            {ASSUMPTION_NOTES.map((n) => (
              <li key={n.key}>• {n.text}</li>
            ))}
          </ul>
        </section>
      </CardBody>
    </Card>
  );
}

function ReferencesCard() {
  return (
    <Card>
      <CardHeader title="Data sources — referensi makro & kebijakan" subtitle={`Diteliti ${formatDate(REFERENCES.inflationSeries[0]?.source.accessedDate)}. Nilai terbaru perlu verifikasi langsung ke sumber.`} />
      <CardBody className="flex flex-col gap-4 text-[0.8rem]">
        <div>
          <h3 className="mb-1 font-semibold">Suku bunga & yield (pembanding return)</h3>
          <ul className="space-y-1 text-ink-2">
            {REFERENCES.marketRates.map((m) => (
              <li key={m.indicator}>
                {m.indicator === "bi_rate" ? "BI-Rate" : m.indicator === "sbn_10y_yield" ? "Yield SBN 10 tahun" : "Tingkat bunga penjaminan LPS (bank umum, rupiah)"}: <strong>{m.valuePct.toLocaleString("id-ID")}%</strong> per {formatDate(m.asOf)} —{" "}
                <a href={m.source.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                  {m.source.publisher}
                </a>
                {m.note ? <span className="block text-[0.72rem] text-muted">{m.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Kebijakan biaya sekolah negeri</h3>
          <ul className="space-y-1.5 text-ink-2">
            {REFERENCES.policies.map((p, i) => (
              <li key={i}>
                {p.summary}{" "}
                <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                  ({p.source.publisher ?? "sumber"})
                </a>
                {p.statusAsOf2026 ? <span className="block text-[0.72rem] text-muted">Status 2026: {p.statusAsOf2026}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Klaim “inflasi biaya pendidikan” di media (opini, bukan statistik)</h3>
          <ul className="space-y-1 text-ink-2">
            {REFERENCES.estimates.map((e, i) => (
              <li key={i}>
                {e.who}: {e.claim}{" "}
                <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                  (sumber)
                </a>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

function DataCard() {
  const state = useStore();
  const replaceAll = useStore((s) => s.replaceAll);
  const resetAll = useStore((s) => s.resetAll);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [msg, setMsg] = useState<string | null>(null);
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const backup = () => {
    const { schemaVersion, onboarded, household, assumptions, pinPlanDate, overlay, masterData, compare, theme: th } = state;
    downloadText(`edufin-backup-${todayIso()}.json`, JSON.stringify({ app: "edufin-planner", schemaVersion, onboarded, household, assumptions, pinPlanDate, overlay, masterData, compare, theme: th }, null, 2), "application/json");
  };
  return (
    <Card>
      <CardHeader title="Data & tampilan" />
      <CardBody className="flex flex-col gap-4 text-[0.85rem]" >
        <div id="data" className="flex flex-col gap-2">
          <span className="font-medium">Penyimpanan</span>
          {supabaseEnabled ? (
            auth.session ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="good">Tersambung: {auth.email}</StatusPill>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await pushToCloud();
                      setMsg("Rencana tersimpan ke cloud.");
                    } catch (e) {
                      setMsg(`Gagal sinkron: ${(e as Error).message}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Simpan ke cloud
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await pullFromCloud();
                      setMsg(ok ? "Rencana dimuat dari cloud." : "Belum ada rencana di cloud.");
                    } catch (e) {
                      setMsg(`Gagal memuat: ${(e as Error).message}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Muat dari cloud
                </Button>
                <Button size="sm" variant="ghost" onClick={() => signOut()}>
                  Keluar
                </Button>
              </div>
            ) : (
              <Link href="/login/" className="text-accent-ink hover:underline">
                Masuk (email / Google) untuk sinkronisasi antar perangkat
              </Link>
            )
          ) : (
            <p className="text-ink-2">Mode lokal — data hanya di browser ini. Hubungkan Supabase (lihat README) untuk akun & sinkronisasi.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={backup}>
            <Download className="h-4 w-4" /> Backup JSON
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[0.8rem] font-medium hover:bg-card-2">
            <Upload className="h-4 w-4" /> Pulihkan backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  if (data.app !== "edufin-planner" || typeof data.household !== "object") throw new Error("Bukan file backup EduFin Planner");
                  if ((data.schemaVersion ?? 0) > SCHEMA_VERSION) throw new Error("Backup dibuat oleh versi aplikasi yang lebih baru");
                  replaceAll({ onboarded: !!data.onboarded, household: data.household, assumptions: { ...state.assumptions, ...data.assumptions }, pinPlanDate: !!data.pinPlanDate, overlay: data.overlay ?? state.overlay, masterData: data.masterData ?? state.masterData });
                  setMsg("Backup dipulihkan.");
                } catch (err) {
                  setMsg(`Gagal memulihkan: ${(err as Error).message}`);
                }
              }}
            />
          </label>
          <Button size="sm" onClick={() => (confirm("Ganti data dengan keluarga contoh?") ? (loadDemoHousehold(), setMsg("Keluarga contoh dimuat.")) : null)}>
            Muat keluarga contoh
          </Button>
          <Button size="sm" variant="danger" onClick={() => (confirm("Hapus semua data di browser ini?") ? (resetAll(), setMsg("Data dihapus.")) : null)}>
            Hapus semua data
          </Button>
        </div>
        {msg ? <StatusPill tone="info">{msg}</StatusPill> : null}
        <div className="flex items-center gap-3">
          <span className="font-medium">Tema</span>
          <Segmented<ThemePref>
            ariaLabel="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "Sistem" },
              { value: "light", label: "Terang" },
              { value: "dark", label: "Gelap" },
            ]}
          />
        </div>
      </CardBody>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Asumsi & Settings" subtitle="Parameter perencanaan, sumber data referensi, penyimpanan, dan disclaimer." />
      <AssumptionsCard />
      <ReferencesCard />
      <DataCard />
      <Card>
        <CardHeader title="Disclaimer" />
        <CardBody className="flex flex-col gap-2 text-[0.8rem] text-ink-2">
          <p>{DISCLAIMER_EN}</p>
          <p>{DISCLAIMER_ID}</p>
          <p>
            Metodologi mengikuti prinsip perencanaan keuangan yang lazim (time value of money, goal-based investing, analisis skenario & sensitivitas); rumus lengkap ada di tombol “Cara hitung” dan README.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
