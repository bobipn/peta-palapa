/**
 * RRD-style time-series graph: shared x axis (simulation ticks), area or line
 * series, optional threshold, and a Current / Average / Maximum / Minimum legend.
 * Null values render as gaps (device not polled / unreachable).
 */
export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  area?: boolean;
}

function stats(v: (number | null)[]) {
  const x = v.filter((n): n is number => n !== null && n !== undefined && Number.isFinite(n));
  if (!x.length) return null;
  return { cur: x.at(-1)!, avg: x.reduce((a, b) => a + b, 0) / x.length, max: Math.max(...x), min: Math.min(...x) };
}

const fmt = (n: number | undefined, unit: string) => {
  if (n === undefined) return '-nan';
  if (unit === 'bps') return n >= 1000 ? `${(n / 1000).toFixed(2)} Gb/s` : `${n.toFixed(2)} Mb/s`;
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)} ${unit}`;
};

export function TimeChart({ title, ticks, labels, series, unit, threshold, yMax, height = 190 }: {
  title: string; ticks: number[]; labels?: (t: number) => string; series: Series[]; unit: string; threshold?: number | null; yMax?: number; height?: number;
}) {
  const W = 520, H = height, P = { l: 46, r: 10, t: 22, b: 22 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null && v !== undefined);
  const top = yMax ?? Math.max(1e-6, ...all, threshold ?? 0) * 1.12;
  const n = Math.max(ticks.length, 2);
  const sx = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - (Math.min(v, top) / top) * (H - P.t - P.b);
  const pathOf = (vals: (number | null)[], area: boolean) => {
    const parts: string[] = [];
    let run: [number, number][] = [];
    const flush = () => {
      if (!run.length) return;
      const line = run.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
      parts.push(area ? `${line}L${run.at(-1)![0].toFixed(1)},${H - P.b}L${run[0][0].toFixed(1)},${H - P.b}Z` : line);
      run = [];
    };
    vals.forEach((v, i) => (v === null || v === undefined ? flush() : run.push([sx(i), sy(v)])));
    flush();
    return parts.join('');
  };
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const xLabelIdx = ticks.length > 1 ? [0, Math.floor((ticks.length - 1) / 3), Math.floor((2 * (ticks.length - 1)) / 3), ticks.length - 1] : [0];
  return (
    <div className="rrd">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <title>{title}</title>
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="var(--surface)" stroke="var(--border)" />
        <text x={W / 2} y={14} textAnchor="middle" fontSize="12.5" fontWeight={600} fill="var(--text)">{title}</text>
        {gridY.map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={sy(g)} y2={sy(g)} stroke="var(--border)" strokeDasharray="2 3" />
            <text x={P.l - 5} y={sy(g) + 3} fontSize="10.5" textAnchor="end" fill="var(--muted)">{unit === 'bps' ? (g >= 1000 ? `${(g / 1000).toFixed(1)}G` : `${g.toFixed(0)}M`) : g >= 10 ? g.toFixed(0) : g.toFixed(1)}</text>
          </g>
        ))}
        {series.map((s) => <path key={s.name} d={pathOf(s.values, !!s.area)} fill={s.area ? s.color : 'none'} fillOpacity={s.area ? 0.45 : 0} stroke={s.color} strokeWidth={1.4} />)}
        {threshold !== undefined && threshold !== null ? <line x1={P.l} x2={W - P.r} y1={sy(threshold)} y2={sy(threshold)} stroke="var(--bad)" strokeDasharray="5 3" /> : null}
        {ticks.length ? xLabelIdx.map((i) => (
          <text key={i} x={sx(i)} y={H - 8} fontSize="10.5" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} fill="var(--muted)">{labels ? labels(ticks[i]) : `t${ticks[i]}`}</text>
        )) : <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--muted)">no data — advance the simulation clock</text>}
      </svg>
      <div className="rrd-legend mono">
        {series.map((s) => {
          const st = stats(s.values);
          return (
            <div key={s.name} className="rrd-row">
              <span><i style={{ background: s.color }} />{s.name}:</span>
              <span>Cur {fmt(st?.cur, unit)}</span><span>Avg {fmt(st?.avg, unit)}</span><span>Max {fmt(st?.max, unit)}</span><span>Min {fmt(st?.min, unit)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
