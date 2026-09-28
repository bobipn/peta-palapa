"use client";

import clsx from "clsx";
import { Table2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatAxisCompact, formatPct, formatRp } from "@/lib/format";
import { Card, CardHeader } from "./ui";

// ---------------------------------------------------------------------------
// Theme colors resolved from CSS custom properties (follows light/dark switches)
// ---------------------------------------------------------------------------

const VARS = [
  "--card",
  "--ink",
  "--ink-2",
  "--muted",
  "--grid",
  "--axis",
  "--deemph",
  "--good",
  "--warning",
  "--serious",
  "--critical",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
  "--series-6",
  "--series-7",
  "--series-8",
  "--seq-100",
  "--seq-200",
  "--seq-300",
  "--seq-400",
  "--seq-500",
  "--seq-600",
  "--seq-700",
] as const;

export type ChartColors = Record<(typeof VARS)[number], string>;

const FALLBACK: ChartColors = {
  "--card": "#fcfcfb",
  "--ink": "#0b0b0b",
  "--ink-2": "#52514e",
  "--muted": "#7a7872",
  "--grid": "#e1e0d9",
  "--axis": "#c3c2b7",
  "--deemph": "#c9c7bf",
  "--good": "#0ca30c",
  "--warning": "#fab219",
  "--serious": "#ec835a",
  "--critical": "#d03b3b",
  "--series-1": "#2a78d6",
  "--series-2": "#eb6834",
  "--series-3": "#1baf7a",
  "--series-4": "#eda100",
  "--series-5": "#e87ba4",
  "--series-6": "#008300",
  "--series-7": "#4a3aa7",
  "--series-8": "#e34948",
  "--seq-100": "#cde2fb",
  "--seq-200": "#9ec5f4",
  "--seq-300": "#6da7ec",
  "--seq-400": "#3987e5",
  "--seq-500": "#256abf",
  "--seq-600": "#184f95",
  "--seq-700": "#0d366b",
};

function readColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const out = { ...FALLBACK };
  for (const v of VARS) {
    const val = cs.getPropertyValue(v).trim();
    if (val) out[v] = val;
  }
  return out;
}

export function useChartColors(): ChartColors {
  const [c, setC] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    const update = () => setC(readColors());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return c;
}

export const seriesVar = (i: number) => `--series-${(i % 8) + 1}` as keyof ChartColors;

/** Sequential blue ramp step for a 0–1 magnitude. */
export function seqColor(c: ChartColors, t: number): string {
  const steps: (keyof ChartColors)[] = ["--seq-100", "--seq-200", "--seq-300", "--seq-400", "--seq-500", "--seq-600", "--seq-700"];
  const i = Math.max(0, Math.min(steps.length - 1, Math.round(t * (steps.length - 1))));
  return c[steps[i]];
}

/** Ink or white for text placed inside a filled cell. */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0b0b0b";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0b0b0b" : "#ffffff";
}

// ---------------------------------------------------------------------------
// Chart card with legend + table view (every chart has a table twin)
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string;
  color: string;
  shape?: "rect" | "line";
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-2" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={clsx("inline-block", i.shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")}
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface TableSpec {
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, ReactNode>[];
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  action,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: TableSpec;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-1">
            {action}
            {table ? (
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-pressed={showTable}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.72rem] font-medium",
                  showTable ? "bg-card-2 text-ink" : "text-ink-2 hover:bg-card-2",
                )}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden />
                Tabel
              </button>
            ) : null}
          </div>
        }
      />
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {legend ? (
          <div className="mb-3">
            <Legend items={legend} />
          </div>
        ) : null}
        {showTable && table ? <DataTable spec={table} /> : children}
        {footer ? <div className="mt-3 text-[0.75rem] text-muted">{footer}</div> : null}
      </div>
    </Card>
  );
}

export function DataTable({ spec, maxHeight = 360 }: { spec: TableSpec; maxHeight?: number }) {
  return (
    <div className="scroll-x overflow-y-auto rounded-lg border border-line" style={{ maxHeight }}>
      <table className="data-table">
        <thead className="sticky top-0">
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} className={c.numeric ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i}>
              {spec.columns.map((c) => (
                <td key={c.key} className={c.numeric ? "num" : undefined}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip: value leads, label follows, line keys
// ---------------------------------------------------------------------------

type Fmt = (v: number) => string;

function TooltipBox({
  title,
  rows,
  footer,
}: {
  title: ReactNode;
  rows: { label: string; value: string; color?: string }[];
  footer?: ReactNode;
}) {
  return (
    <div className="card min-w-[10rem] px-3 py-2 text-[0.75rem] shadow-lg" role="status">
      <div className="mb-1 font-medium text-ink-2">{title}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color ? <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: r.color }} /> : null}
              {r.label}
            </span>
            <span className="tnum font-semibold text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-1 border-t border-line pt-1 text-muted">{footer}</div> : null}
    </div>
  );
}

function makeTooltip(opts: { fmt: Fmt; labelFmt?: (l: unknown) => ReactNode; showTotal?: boolean; names?: Record<string, string> }) {
  return function ChartTooltip(props: TooltipContentProps) {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p) => typeof p.value === "number")
      .map((p) => ({
        label: opts.names?.[String(p.dataKey)] ?? String(p.name ?? p.dataKey),
        value: opts.fmt(p.value as number),
        color: (p.color as string) ?? (p.payload?.fill as string),
      }))
      .reverse();
    const total = payload.reduce((s, p) => s + (typeof p.value === "number" ? p.value : 0), 0);
    return (
      <TooltipBox
        title={opts.labelFmt ? opts.labelFmt(label) : String(label)}
        rows={rows}
        footer={opts.showTotal && rows.length > 1 ? `Total ${opts.fmt(total)}` : undefined}
      />
    );
  };
}

// ---------------------------------------------------------------------------
// Stacked bars (e.g. education cost per academic year, stacked by child)
// ---------------------------------------------------------------------------

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
}

export function StackedBars({
  data,
  xKey,
  series,
  height = 260,
  fmt = formatRp,
  labelFmt,
  highlightX,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  series: SeriesSpec[];
  height?: number;
  fmt?: Fmt;
  labelFmt?: (l: unknown) => ReactNode;
  highlightX?: string | number;
}) {
  const c = useChartColors();
  // Round only the top-most non-zero segment of each column (data end), square at the baseline.
  const withTop = data.map((d) => {
    let top: string | null = null;
    for (const s of series) if (Number(d[s.key]) > 0) top = s.key;
    return { ...d, __top: top };
  });
  const names = Object.fromEntries(series.map((s) => [s.key, s.label]));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={withTop} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={c["--grid"]} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: c["--axis"] }} tick={{ fill: c["--muted"], fontSize: 11 }} minTickGap={8} />
          <YAxis tickFormatter={(v: number) => formatAxisCompact(v)} tickLine={false} axisLine={false} width={60} tick={{ fill: c["--muted"], fontSize: 11 }} />
          <Tooltip cursor={{ fill: c["--grid"], opacity: 0.35 }} content={makeTooltip({ fmt, labelFmt, showTotal: true, names })} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              maxBarSize={24}
              stroke={c["--card"]}
              strokeWidth={1}
              isAnimationActive={false}
              shape={(p: unknown) => {
                const props = p as { x: number; y: number; width: number; height: number; fill: string; payload: { __top: string | null } & Record<string, unknown> };
                const { x, y, width, height: h, fill, payload } = props;
                if (!h || h <= 0) return <g />;
                const isTop = payload.__top === s.key;
                const r = isTop ? Math.min(4, width / 2, h) : 0;
                const dim = highlightX !== undefined && payload[xKey] !== highlightX;
                const d = `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + h} Z`;
                return <path d={d} fill={fill} opacity={dim ? 0.55 : 1} stroke={c["--card"]} strokeWidth={1} />;
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed bars (e.g. free cash flow per year; negative uses the critical tone)
// ---------------------------------------------------------------------------

export function SignedBars({
  data,
  xKey,
  yKey,
  label,
  height = 240,
  fmt = formatRp,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  yKey: string;
  label: string;
  height?: number;
  fmt?: Fmt;
}) {
  const c = useChartColors();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={c["--grid"]} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: c["--axis"] }} tick={{ fill: c["--muted"], fontSize: 11 }} minTickGap={8} />
          <YAxis tickFormatter={(v: number) => formatAxisCompact(v)} tickLine={false} axisLine={false} width={60} tick={{ fill: c["--muted"], fontSize: 11 }} />
          <ReferenceLine y={0} stroke={c["--axis"]} />
          <Tooltip cursor={{ fill: c["--grid"], opacity: 0.35 }} content={makeTooltip({ fmt, names: { [yKey]: label } })} />
          <Bar dataKey={yKey} name={label} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={Number(d[yKey]) < 0 ? c["--critical"] : c["--series-1"]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lines & areas
// ---------------------------------------------------------------------------

export function Lines({
  data,
  xKey,
  series,
  height = 260,
  fmt = formatRp,
  labelFmt,
  yFmt = formatAxisCompact,
  references,
  area,
}: {
  data: Record<string, number | string | null>[];
  xKey: string;
  series: SeriesSpec[];
  height?: number;
  fmt?: Fmt;
  labelFmt?: (l: unknown) => ReactNode;
  yFmt?: (v: number) => string;
  references?: { y: number; label: string }[];
  area?: boolean;
}) {
  const c = useChartColors();
  const names = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const common = (
    <>
      <CartesianGrid vertical={false} stroke={c["--grid"]} />
      <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: c["--axis"] }} tick={{ fill: c["--muted"], fontSize: 11 }} minTickGap={16} />
      <YAxis tickFormatter={yFmt} tickLine={false} axisLine={false} width={60} tick={{ fill: c["--muted"], fontSize: 11 }} />
      <Tooltip cursor={{ stroke: c["--axis"], strokeWidth: 1 }} content={makeTooltip({ fmt, labelFmt, names })} />
      {references?.map((r) => (
        <ReferenceLine
          key={r.label}
          y={r.y}
          stroke={c["--axis"]}
          label={{ value: r.label, position: "insideTopRight", fill: c["--muted"], fontSize: 10 }}
        />
      ))}
    </>
  );
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {common}
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, stroke: c["--card"], strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {common}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: c["--card"], strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars (single series; emphasis on one row)
// ---------------------------------------------------------------------------

export function HBars({
  data,
  fmt = formatRp,
  emphasize,
  tone,
  domainMax,
}: {
  data: { label: string; value: number; sub?: string }[];
  fmt?: Fmt;
  emphasize?: string;
  tone?: (value: number) => "neutral" | "critical" | "good";
  /** Fixed scale end (e.g. 100 for a 0–100 score); defaults to the largest value. */
  domainMax?: number;
}) {
  const c = useChartColors();
  const max = domainMax ?? Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => {
        const t = tone?.(d.value) ?? "neutral";
        const color = t === "critical" ? c["--critical"] : t === "good" ? c["--good"] : emphasize && d.label !== emphasize ? c["--deemph"] : c["--series-1"];
        return (
          <li key={d.label} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 text-[0.8rem]" title={`${d.label}: ${fmt(d.value)}`}>
            <span className="truncate text-ink-2">
              {d.label}
              {d.sub ? <span className="block truncate text-[0.7rem] text-muted">{d.sub}</span> : null}
            </span>
            <span className="h-3.5 w-full rounded-r-[4px]" style={{ background: "transparent" }}>
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: color, minWidth: d.value ? 2 : 0 }}
              />
            </span>
            <span className="tnum text-right font-medium text-ink">{fmt(d.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Waterfall: contribution of each cost category to the total (spec §17)
// ---------------------------------------------------------------------------

export function Waterfall({ items, total, fmt = formatRp }: { items: { label: string; value: number }[]; total: number; fmt?: Fmt }) {
  const c = useChartColors();
  const data = items.filter((i) => i.value > 0);
  const rows = data.reduce<{ label: string; value: number; start: number; end: number }[]>((acc, d) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    return [...acc, { ...d, start, end: start + d.value }];
  }, []);
  const cumulative = rows.length ? rows[rows.length - 1].end : 0;
  const max = Math.max(total, cumulative, 1);
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label="Waterfall biaya pendidikan per kategori">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-3 text-[0.8rem]" title={`${r.label}: ${fmt(r.value)} (${formatPct(r.value / max)})`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="relative h-4 w-full">
            <span
              className="absolute top-0 h-full rounded-[3px]"
              style={{ left: `${(r.start / max) * 100}%`, width: `max(2px, ${(r.value / max) * 100}%)`, background: c["--series-1"] }}
            />
          </span>
          <span className="tnum w-24 text-right text-ink">
            {fmt(r.value)} <span className="text-[0.7rem] text-muted">{formatPct(r.value / max, 0)}</span>
          </span>
        </div>
      ))}
      <div className="mt-1 grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-3 border-t border-line pt-2 text-[0.8rem]">
        <span className="font-semibold text-ink">Total</span>
        <span className="relative h-4 w-full">
          <span className="absolute left-0 top-0 h-full w-full rounded-[3px]" style={{ background: c["--seq-600"] }} />
        </span>
        <span className="tnum w-24 text-right font-semibold text-ink">{fmt(total)}</span>
      </div>
    </div>
  );
}
