import { useMemo, useState } from 'react';
import { get } from '../api';
import { LAND_PATH } from './basemap';
import { DEVICE_STYLE, DeviceBadge, DeviceGlyph, type DeviceState } from './DeviceIcon';
import { Badge, ErrorBox, Loading, SimBadge, useApi } from './ui';

const LINK_COLOR: Record<string, string> = {
  PLANNED: '#9ca3af', RESERVED: '#3b82f6', LINK_UP: '#84cc16', ACTIVE: '#16a34a', STANDBY: '#a855f7', DOWN: '#dc2626', OFF: '#6b7280',
};
const LINK_LABEL: Record<string, string> = {
  PLANNED: 'direncanakan', RESERVED: 'kapasitas dipesan', LINK_UP: 'link up', ACTIVE: 'aktif (trafik)', STANDBY: 'standby (proteksi)', DOWN: 'DOWN', OFF: 'off',
};
/** Packet-Tracer-style link light colour at each end of a link. */
const lightColor = (s: string) => (s === 'ACTIVE' || s === 'LINK_UP' || s === 'STANDBY' ? '#22c55e' : s === 'RESERVED' ? '#f59e0b' : '#ef4444');
const TERMINAL_OR_STABLE = ['ACTIVE', 'FAILED', 'DECOMMISSIONED'];

const wrapLon = (lon: number) => (lon < -100 ? lon + 360 : lon);

export function ProvisioningLiveView({ serviceId, compact }: { serviceId: string; compact?: boolean }) {
  const [poll, setPoll] = useState(1000);
  const live = useApi(async () => {
    const d = await get(`/api/services/${serviceId}/live`);
    setPoll(TERMINAL_OR_STABLE.includes(d.serviceState) ? 4000 : 1000);
    return d;
  }, [serviceId, poll], poll);
  const [sel, setSel] = useState<string | null>(null);

  const geo = useMemo(() => {
    const d = live.data;
    if (!d) return null;
    const xs = d.nodes.map((n: any) => wrapLon(n.lon));
    const ys = d.nodes.map((n: any) => -n.lat);
    let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // Pad and enforce a minimum window so short domestic paths still show context.
    const padX = Math.max(2.5, (x1 - x0) * 0.18), padY = Math.max(2.5, (y1 - y0) * 0.25);
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    const minW = 12;
    if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
    const aspect = 0.55;
    if ((y1 - y0) < (x1 - x0) * aspect) { const c = (y0 + y1) / 2, h = (x1 - x0) * aspect; y0 = c - h / 2; y1 = c + h / 2; }
    const pos = new Map<string, { x: number; y: number }>(d.nodes.map((n: any) => [n.id, { x: wrapLon(n.lon), y: -n.lat }]));
    return { box: [x0, y0, x1 - x0, y1 - y0], u: (x1 - x0) / 100, pos };
  }, [live.data]);

  if (live.error) return <ErrorBox error={live.error} />;
  if (!live.data || !geo) return <Loading what="Memuat live view" />;
  const d = live.data;
  const u = geo.u;
  const selected = d.nodes.find((n: any) => n.id === sel);
  const aboveIds = new Set<string>();

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between">
        <div className="row">
          <strong>Live provisioning & activation</strong> <SimBadge />
          <Badge v={d.serviceState} /> {d.activePath ? <Badge v={d.activePath} /> : null}
        </div>
        <div className="row small">
          <span><strong>{d.progress.nodesUp}/{d.progress.nodesTotal}</strong> node menyala</span>
          <div className="bar" style={{ width: 160 }}><span style={{ width: `${d.progress.pct}%`, background: d.progress.pct === 100 ? 'var(--ok)' : 'var(--warn)' }} /></div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: compact ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="map live-map">
          <svg viewBox={geo.box.join(' ')} role="img" aria-label="Live provisioning map">
            <title>Status node dan link layanan (simulasi)</title>
            <rect x={geo.box[0]} y={geo.box[1]} width={geo.box[2]} height={geo.box[3]} fill="var(--sea)" />
            <path d={LAND_PATH} fill="var(--land)" stroke="var(--land-edge)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />

            {d.links.map((l: any) => {
              const a = geo.pos.get(l.aNodeId)!, b = geo.pos.get(l.bNodeId)!;
              const c = LINK_COLOR[l.state];
              const dash = l.state === 'PLANNED' || l.state === 'RESERVED' ? '6 5' : l.state === 'STANDBY' ? '8 4' : l.state === 'DOWN' ? '3 4' : undefined;
              const lt = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
              const pid = `lk-${l.id}`;
              return (
                <g key={l.id}>
                  <path id={pid} d={`M${a.x},${a.y} L${b.x},${b.y}`} stroke={c} strokeWidth={l.state === 'ACTIVE' ? 5 : 3.5} fill="none" strokeDasharray={dash} vectorEffect="non-scaling-stroke" strokeLinecap="round">
                    <title>{`${l.id} · ${l.provider} · ${LINK_LABEL[l.state]}`}</title>
                  </path>
                  {/* link lights at both ends, as in Packet Tracer */}
                  {[0.14, 0.86].map((t) => <circle key={t} cx={lt(t).x} cy={lt(t).y} r={0.9 * u} fill={lightColor(l.state)} stroke="#0b1220" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />)}
                  {l.state === 'ACTIVE' ? [0, 1].map((k) => (
                    <rect key={k} width={1.8 * u} height={1.2 * u} x={-0.9 * u} y={-0.6 * u} rx={0.2 * u} fill="#fde047" stroke="#713f12" strokeWidth={0.5} vectorEffect="non-scaling-stroke">
                      <animateMotion dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" keyPoints={k ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                        <mpath href={`#${pid}`} />
                      </animateMotion>
                    </rect>
                  )) : null}
                  {l.state === 'DOWN' ? <text x={lt(0.5).x} y={lt(0.5).y} fontSize={3 * u} textAnchor="middle" dominantBaseline="middle" fontWeight="700" style={{ fill: '#dc2626' }}>✕</text> : null}
                </g>
              );
            })}

            {d.nodes.map((n: any, i: number) => {
              const p = geo.pos.get(n.id)!;
              const st = DEVICE_STYLE[n.state as DeviceState];
              const s = (u * 5) / 40;
              const label = n.city.replace(' (Denpasar)', '');
              const crowded = d.nodes.slice(0, i).some((m: any) => {
                const q = geo.pos.get(m.id)!;
                return Math.abs(q.x - p.x) < 10 * u && Math.abs(q.y - p.y) < 7 * u && !aboveIds.has(m.id);
              });
              if (crowded) aboveIds.add(n.id);
              const ly = crowded ? -8.2 * u : 3.3 * u;
              return (
                <g key={n.id}>
                  <DeviceGlyph x={p.x} y={p.y} scale={s} state={n.state} selected={sel === n.id} onClick={() => setSel(sel === n.id ? null : n.id)}
                    title={`${n.city} — ${n.device.model} · ${st.label}`} />
                  <g transform={`translate(${p.x} ${p.y + ly})`} pointerEvents="none">
                    <rect x={-label.length * 0.62 * u - 1.2 * u} y={-1.4 * u} width={label.length * 1.24 * u + 2.4 * u} height={2.8 * u} rx={0.6 * u} fill="var(--surface)" stroke={st.led} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.95} />
                    <text fontSize={1.9 * u} textAnchor="middle" dominantBaseline="middle" fontWeight={600} style={{ stroke: 'none', fill: 'var(--text)' }}>{label}</text>
                    <text y={2.9 * u} fontSize={1.6 * u} textAnchor="middle" dominantBaseline="middle" fontWeight={700} style={{ fill: st.body, stroke: 'var(--surface)', strokeWidth: 0.35 * u, paintOrder: 'stroke' }}>
                      ● {st.label}{n.state === 'BOOTING' && n.secondsToReady ? ` ${n.secondsToReady}s` : ''}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          <div className="legend">
            {(['PENDING', 'BOOTING', 'CONFIGURED', 'TESTING', 'ACTIVE', 'DOWN'] as DeviceState[]).map((k) => (
              <span key={k}><DeviceBadge state={k} size={26} /> {DEVICE_STYLE[k].label}</span>
            ))}
            <span><i style={{ background: '#22c55e', width: 8, height: 8, borderRadius: 8 }} />link light hijau = up</span>
            <span><i style={{ background: '#ef4444', width: 8, height: 8, borderRadius: 8 }} />merah = belum/terputus</span>
            <span>Peta: Natural Earth (public domain). Garis antar kota skematik, bukan jalur kabel.</span>
          </div>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Perangkat</th><th>Kota / node</th><th>Status</th></tr></thead>
              <tbody>
                {d.nodes.map((n: any, i: number) => (
                  <tr key={n.id} className="click" onClick={() => setSel(n.id)} style={sel === n.id ? { outline: '2px solid var(--accent)', outlineOffset: -2 } : undefined}>
                    <td><DeviceBadge state={n.state} /></td>
                    <td><strong>{i + 1}. {n.city}</strong><div className="small muted mono">{n.name}</div></td>
                    <td>
                      <span className="badge" style={{ background: DEVICE_STYLE[n.state as DeviceState].body, color: '#fff' }}>{DEVICE_STYLE[n.state as DeviceState].label}</span>
                      {n.state === 'BOOTING' ? <div className="small muted">online ±{n.secondsToReady} dtk</div> : null}
                      {n.roles.length ? <div className="small muted">{n.roles.join(' + ').toLowerCase()}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <div className="card" style={{ padding: 12 }}>
              <div className="row"><DeviceBadge state={selected.state} size={44} /><div><strong>{selected.city}</strong><div className="small muted">{selected.popName} · {selected.popKind}</div></div></div>
              <table className="small" style={{ marginTop: 6 }}><tbody>
                <tr><td>Perangkat</td><td className="mono">{selected.device.model} ({selected.device.vendor})</td></tr>
                <tr><td>Status</td><td>{DEVICE_STYLE[selected.state as DeviceState].label}</td></tr>
                <tr><td>Jalur</td><td>{selected.roles.join(', ') || '—'}{selected.onActivePath ? ' · membawa trafik' : ''}</td></tr>
                <tr><td>Siap (jadwal)</td><td>{selected.readyAt ? new Date(selected.readyAt).toLocaleTimeString('id-ID') : 'belum dijadwalkan'}</td></tr>
              </tbody></table>
            </div>
          ) : <div className="small muted">Klik perangkat di peta atau tabel untuk detail.</div>}
          <div className="small muted">{d.note}</div>
        </div>
      </div>
    </div>
  );
}
