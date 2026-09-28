"use client";

import { useState } from "react";
import { formatPct, formatRp, formatRpCompact } from "@/lib/format";
import type { YearAggregate } from "@/lib/engine/plan";
import { seqColor, textOn, useChartColors } from "./charts";

/**
 * Education Expense Heatmap (spec §16): Year ↓ × Child → level + annual cost.
 * Sequential single-hue ramp (more = darker); the peak year is marked with text, not color alone.
 */
export function EducationHeatmap({
  years,
  kids,
  currentAy,
}: {
  years: YearAggregate[];
  kids: { id: string; name: string }[];
  currentAy: number;
}) {
  const c = useChartColors();
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...years.flatMap((y) => Object.values(y.byChild)));
  const peak = years.reduce<YearAggregate | null>((p, y) => (!p || y.total > p.total ? y : p), null);
  if (!years.length) return <p className="text-[0.85rem] text-ink-2">Belum ada proyeksi biaya — tambahkan anak dan jenjangnya.</p>;
  return (
    <div>
      <div className="scroll-x max-h-[520px] overflow-y-auto rounded-lg border border-line">
        <table className="w-full border-separate border-spacing-0 text-[0.75rem]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="border-b border-line px-2 py-2 text-left font-semibold text-ink-2">TA</th>
              {kids.map((ch) => (
                <th key={ch.id} className="border-b border-line px-2 py-2 text-left font-semibold text-ink-2">
                  {ch.name}
                </th>
              ))}
              <th className="border-b border-line px-2 py-2 text-right font-semibold text-ink-2">Total</th>
              <th className="border-b border-line px-2 py-2 text-right font-semibold text-ink-2">% pendapatan</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.ay}>
                <th scope="row" className="whitespace-nowrap border-b border-line px-2 py-1 text-left font-medium text-ink">
                  {y.ay}/{String((y.ay + 1) % 100).padStart(2, "0")}
                  {y.ay === currentAy ? <span className="ml-1 text-[0.65rem] text-muted">berjalan</span> : null}
                  {peak && y.ay === peak.ay ? <span className="ml-1 text-[0.65rem] font-semibold text-critical">puncak</span> : null}
                </th>
                {kids.map((ch) => {
                  const v = y.byChild[ch.id] ?? 0;
                  const lvl = y.levelByChild[ch.id];
                  const bg = v > 0 ? seqColor(c, 0.08 + 0.92 * (v / max)) : "transparent";
                  const id = `${y.ay}-${ch.id}`;
                  return (
                    <td
                      key={ch.id}
                      className="border-b border-l border-[var(--card)] px-0 py-0"
                      onMouseEnter={() => setHover(id)}
                      onMouseLeave={() => setHover(null)}
                      title={lvl ? `${ch.name} · ${lvl} · ${formatRp(v)}` : undefined}
                    >
                      {lvl ? (
                        <div
                          className="flex min-w-[5.5rem] items-center justify-between gap-2 px-2 py-1.5 outline-offset-[-2px]"
                          style={{ background: bg, color: textOn(bg), outline: hover === id ? `2px solid ${c["--ink"]}` : "none" }}
                        >
                          <span className="font-semibold">{lvl}</span>
                          <span className="tnum">{formatRpCompact(v).replace("Rp", "")}</span>
                        </div>
                      ) : (
                        <div className="px-2 py-1.5 text-muted">—</div>
                      )}
                    </td>
                  );
                })}
                <td className="tnum whitespace-nowrap border-b border-line px-2 py-1 text-right font-semibold text-ink">{formatRpCompact(y.total)}</td>
                <td className="tnum whitespace-nowrap border-b border-line px-2 py-1 text-right text-ink-2">{y.ratio !== null ? formatPct(y.ratio) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-muted" aria-hidden>
        <span>Rendah</span>
        <span className="flex h-2 w-28 overflow-hidden rounded-full">
          {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((t) => (
            <span key={t} className="h-full flex-1" style={{ background: seqColor(c, t) }} />
          ))}
        </span>
        <span>Tinggi (biaya tahunan per anak, nominal)</span>
      </div>
    </div>
  );
}

/** Sensitivity heatmap (spec §27): education inflation × investment return → required monthly investment. */
export function SensitivityHeatmap({
  inflations,
  returns,
  values,
  base,
}: {
  inflations: number[];
  returns: number[];
  values: number[][];
  base?: { inflation: number; ret: number };
}) {
  const c = useChartColors();
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  return (
    <div>
      <div className="scroll-x">
        <table className="w-full border-separate border-spacing-[2px] text-[0.75rem]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium text-ink-2">Inflasi ↓ / Return →</th>
              {returns.map((r) => (
                <th key={r} className="px-2 py-1 text-center font-semibold text-ink-2">
                  {formatPct(r, 0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inflations.map((inf, i) => (
              <tr key={inf}>
                <th scope="row" className="px-2 py-1 text-left font-semibold text-ink-2">
                  {formatPct(inf, 0)}
                </th>
                {returns.map((r, j) => {
                  const v = values[i][j];
                  const t = max > min ? (v - min) / (max - min) : 0.5;
                  const bg = seqColor(c, 0.1 + 0.9 * t);
                  const isBase = base && Math.abs(base.inflation - inf) < 1e-9 && Math.abs(base.ret - r) < 1e-9;
                  return (
                    <td
                      key={r}
                      className="tnum rounded-[4px] px-2 py-2 text-center font-medium"
                      style={{ background: bg, color: textOn(bg), outline: isBase ? `2px solid ${c["--ink"]}` : undefined, outlineOffset: -2 }}
                      title={`Inflasi ${formatPct(inf, 0)}, return ${formatPct(r, 0)}: ${formatRp(v)}/bulan`}
                    >
                      {formatRpCompact(v).replace("Rp", "")}
                      {isBase ? <span className="block text-[0.6rem] font-semibold">base</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.72rem] text-muted">
        Nilai = investasi bulanan yang dibutuhkan (Rp/bulan). Semakin gelap semakin besar. Baris menyetel semua jenis inflasi biaya pendidikan ke nilai yang sama.
      </p>
    </div>
  );
}
