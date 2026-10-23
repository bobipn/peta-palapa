import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get } from '../api';
import { Badge, ErrorBox, Loading, PageHead, SimBadge, useApi } from '../components/ui';
import { TimeChart } from '../components/TimeChart';

const PRESETS: [string, number][] = [['1 jam', 60], ['6 jam', 360], ['1 hari', 1440]];

/** Graph set for one device; also embedded on the device detail page. */
export function DeviceGraphs({ deviceId }: { deviceId: string }) {
  const [ticks, setTicks] = useState(60);
  const [end, setEnd] = useState<number | null>(null);
  const m = useApi(() => get(`/api/devices/${deviceId}/metrics?ticks=${ticks}${end !== null ? `&endTick=${end}` : ''}`), [deviceId, ticks, end], end === null ? 5000 : 0);
  const data = m.data;
  const ts = useMemo(() => (data ? data.series.map((s: any) => s.tick) : []), [data]);
  if (m.error) return <ErrorBox error={m.error} />;
  if (!data) return <Loading what="Memuat grafik" />;
  const epoch = new Date(data.simTimeFrom).getTime() - data.fromTick * data.tickSeconds * 1000;
  const label = (t: number) => new Date(epoch + t * data.tickSeconds * 1000).toISOString().slice(5, 16).replace('T', ' ');
  const col = (k: string) => data.series.map((s: any) => s[k]);
  const pan = (dir: number) => setEnd(Math.max(ticks - 1, Math.min(data.currentTick, (end ?? data.currentTick) + dir * ticks)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <span className="small muted">Rentang:</span>
        {PRESETS.map(([l, t]) => <button key={t} className={`sm ${ticks === t ? 'primary' : ''}`} onClick={() => setTicks(t)}>{l}</button>)}
        <button className="sm" onClick={() => pan(-1)} title="Mundur">◀◀</button>
        <button className="sm" onClick={() => pan(1)} title="Maju" disabled={end === null}>▶▶</button>
        <button className="sm" onClick={() => setEnd(null)} disabled={end === null}>Live</button>
        <span className="small muted">From {new Date(data.simTimeFrom).toISOString().slice(0, 16).replace('T', ' ')} To {new Date(data.simTimeTo).toISOString().slice(0, 16).replace('T', ' ')} (sim) · availability {data.summary.availabilityPct === null ? '—' : `${data.summary.availabilityPct.toFixed(2)} %`}</span>
        <SimBadge />
      </div>
      <div className="grid g2">
        <div className="card"><TimeChart title={`${data.device.hostname} — Ping latency (RTT from NMS)`} ticks={ts} labels={label} unit="ms" series={[{ name: 'Latency', color: '#16a34a', values: col('ping_ms'), area: false }]} /></div>
        <div className="card"><TimeChart title={`${data.device.hostname} — Packet loss`} ticks={ts} labels={label} unit="%" yMax={100} series={[{ name: 'Pkt loss', color: '#dc2626', values: col('ping_loss_pct'), area: true }]} /></div>
        <div className="card"><TimeChart title={`${data.device.hostname} — CPU utilization`} ticks={ts} labels={label} unit="%" yMax={100} series={[{ name: 'CPU', color: '#6366f1', values: col('cpu_pct'), area: true }]} /></div>
        <div className="card"><TimeChart title={`${data.device.hostname} — Memory`} ticks={ts} labels={label} unit="%" yMax={100} series={[{ name: 'Memory', color: '#0ea5e9', values: col('mem_pct'), area: true }]} /></div>
        <div className="card"><TimeChart title={`${data.device.hostname} — Polling time`} ticks={ts} labels={label} unit="ms" series={[{ name: 'Poll', color: '#a855f7', values: col('poll_ms') }]} /></div>
        {data.interfaces.map((i: any) => {
          const byTick = new Map(i.series.map((p: any) => [p.tick, p]));
          return (
          <div className="card" key={i.id}>
            <TimeChart title={`${data.device.hostname} — Traffic ${i.name} (${i.kind})`} ticks={ts} labels={label} unit="bps"
              series={[
                { name: 'Inbound', color: '#22c55e', values: ts.map((t: number) => (byTick.get(t) as any)?.in ?? null), area: true },
                { name: 'Outbound', color: '#2563eb', values: ts.map((t: number) => (byTick.get(t) as any)?.out ?? null) },
              ]} />
            <div className="small muted">{i.description}</div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function PerformancePage() {
  const devs = useApi(() => get('/api/devices'), [], 10000);
  const [params, setParams] = useSearchParams();
  const sel = params.get('device') ?? 'eq-jkt';
  const [filter, setFilter] = useState('');
  const tree = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const d of devs.data ?? []) m.set(d.city, [...(m.get(d.city) ?? []), d]);
    return [...m];
  }, [devs.data]);
  return (
    <div className="stack">
      <PageHead title="Performance" sub="Grafik performa perangkat & interface (gaya RRD). Data sintetis dari simulator." />
      <ErrorBox error={devs.error} />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr)' }}>
        <div className="card tree">
          <input placeholder="Cari perangkat…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          {tree.map(([city, list]) => {
            const shown = list.filter((d) => !filter || d.hostname.toLowerCase().includes(filter.toLowerCase()) || city.toLowerCase().includes(filter.toLowerCase()));
            if (!shown.length) return null;
            return (
              <details key={city} open={shown.some((d) => d.id === sel) || !!filter}>
                <summary>{city}</summary>
                {shown.map((d) => (
                  <button key={d.id} className={`tree-item ${d.id === sel ? 'on' : ''}`} onClick={() => setParams({ device: d.id })}>
                    <span className={`dot ${d.reachable === false ? 'bad' : d.reachable ? 'ok' : ''}`} />{d.hostname}
                  </button>
                ))}
              </details>
            );
          })}
        </div>
        <div className="stack">
          {(() => {
            const d = devs.data?.find((x: any) => x.id === sel);
            return d ? (
              <div className="card row between">
                <div><strong>{d.hostname}</strong> <span className="muted small">{d.model} · {d.mgmt_ip} · {d.city}</span></div>
                <div className="row">{d.reachable === false ? <Badge v="DOWN" /> : <Badge v="UP" />}<Link to={`/devices/${d.id}`}>Detail perangkat →</Link></div>
              </div>
            ) : null;
          })()}
          <DeviceGraphs deviceId={sel} />
        </div>
      </div>
    </div>
  );
}
