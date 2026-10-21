import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api';

/** Fetch + optional polling. Returns data, error, reload. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setLoading(true);
    load();
    if (!pollMs) return;
    const t = setInterval(() => { if (!document.hidden) load(); }, pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading, reload: load, setData };
}

/** Run an action with busy + error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e as Error);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

const TONE: Record<string, string> = {
  ACTIVE: 'ok', UP: 'ok', PASS: 'ok', COMPLETED: 'ok', ACCEPTED: 'ok', RESOLVED: 'ok', SETTLED_SIMULATED: 'ok', DONE: 'ok', PAID_SIMULATED: 'ok', CLEARED: 'neutral',
  DEGRADED: 'warn', MITIGATED: 'warn', WAITING: 'warn', PENDING: 'warn', PENDING_PAYMENT: 'warn', CLARIFICATION_REQUESTED: 'warn', MAJOR: 'warn', MINOR: 'warn', WARNING: 'warn', COMPENSATING: 'warn', HELD: 'warn',
  DOWN: 'bad', FAIL: 'bad', FAILED: 'bad', REJECTED: 'bad', CRITICAL: 'bad', OPEN: 'bad', TIMED_OUT: 'bad', CANCELLED: 'neutral', COMPENSATED: 'neutral', VOID: 'neutral', REFUNDED_SIMULATED: 'neutral',
  NOT_RUN: 'neutral', SKIPPED: 'neutral', UNKNOWN: 'neutral', DECOMMISSIONED: 'neutral', DISCONNECTED: 'neutral', RELEASED: 'neutral', INFO: 'info', STANDBY: 'info',
  PROTECTION: 'info', REROUTE: 'warn', PRIMARY: 'accent', RUNNING: 'accent', PROVISIONING: 'accent', TESTING: 'accent', CONFIRMED: 'accent', PROVIDER_ACCEPTANCE: 'accent', RESOURCE_RESERVED: 'accent', COMMITTED: 'accent',
};

export function Badge({ v, tone, title }: { v: ReactNode; tone?: string; title?: string }) {
  const t = tone ?? (typeof v === 'string' ? TONE[v] : undefined) ?? 'neutral';
  return <span className={`badge b-${t}`} title={title}>{typeof v === 'string' ? v.replace(/_/g, ' ') : v}</span>;
}

export function SimBadge({ text = 'SIMULATED' }: { text?: string }) {
  return <span className="badge sim-badge" title="Synthetic data — not a real network, provider or measurement">{text}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function ErrorBox({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  const e = error as ApiError;
  return (
    <div className="alert err" role="alert">
      <strong>{e.code ?? 'Error'}</strong>: {e.message}
      {e.details?.alternatives?.length ? (
        <div className="small" style={{ marginTop: 4 }}>Alternatives: {e.details.alternatives.map((a: any) => a.description).join(' · ')}</div>
      ) : null}
    </div>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <div className="empty">{what}…</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="muted">{sub}</div> : null}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

export function Bar({ value, max = 1 }: { value: number; max?: number }) {
  const p = Math.max(0, Math.min(1, value / max));
  return <div className={`bar ${p >= 0.95 ? 'full' : p >= 0.8 ? 'hot' : ''}`} title={`${(p * 100).toFixed(1)} %`}><span style={{ width: `${p * 100}%` }} /></div>;
}

export function PathChain({ segments }: { segments: string[] }) {
  return (
    <div className="path-chain">
      {segments.map((s, i) => (
        <span key={s} className="row" style={{ gap: 4 }}>
          {i > 0 ? <span className="arrow">›</span> : null}
          <span className="hop">{s.replace(/^seg-/, '').toUpperCase()}</span>
        </span>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === value} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

/** Minimal SVG line chart with a threshold line; null values render as gaps (outage). */
export function LineChart({ points, threshold, unit, height = 160, label }: { points: { x: number; y: number | null }[]; threshold?: number | null; unit: string; height?: number; label: string }) {
  if (points.length === 0) return <Empty>No samples yet — advance the simulation clock.</Empty>;
  const W = 640, H = height, P = { l: 48, r: 10, t: 10, b: 22 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y).filter((y): y is number => y !== null);
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
  const yMax = Math.max(...ys, threshold ?? 0, 0.0001) * 1.15;
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - (y / yMax) * (H - P.t - P.b);
  const segs: string[] = [];
  let cur = '';
  for (const p of points) {
    if (p.y === null) { if (cur) segs.push(cur); cur = ''; continue; }
    cur += `${cur ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
  }
  if (cur) segs.push(cur);
  const gaps = points.filter((p) => p.y === null);
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2));
  return (
    <div className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <title>{label}</title>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={sy(yMax * f / 1.15)} y2={sy(yMax * f / 1.15)} stroke="var(--border)" strokeDasharray="2 3" />
            <text x={P.l - 6} y={sy(yMax * f / 1.15) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{fmt(yMax * f / 1.15)}</text>
          </g>
        ))}
        {gaps.map((g) => <rect key={g.x} x={sx(g.x) - 2} y={P.t} width={Math.max(3, (W - P.l - P.r) / points.length)} height={H - P.t - P.b} fill="var(--bad-soft)" />)}
        {threshold !== null && threshold !== undefined ? (
          <g>
            <line x1={P.l} x2={W - P.r} y1={sy(threshold)} y2={sy(threshold)} stroke="var(--bad)" strokeDasharray="5 4" />
            <text x={W - P.r} y={sy(threshold) - 4} textAnchor="end" fontSize="10" fill="var(--bad)">SLA {fmt(threshold)} {unit}</text>
          </g>
        ) : null}
        {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" />)}
        <text x={P.l} y={H - 6} fontSize="10" fill="var(--muted)">tick {x0}</text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">tick {x1}</text>
      </svg>
    </div>
  );
}

export function Timeline({ items }: { items: { key: string | number; tone?: string; title: ReactNode; meta?: ReactNode }[] }) {
  if (!items.length) return <Empty>No events.</Empty>;
  return (
    <ul className="timeline">
      {items.map((i) => (
        <li key={i.key} className={i.tone}>
          <div>{i.title}</div>
          {i.meta ? <div className="small muted">{i.meta}</div> : null}
        </li>
      ))}
    </ul>
  );
}
