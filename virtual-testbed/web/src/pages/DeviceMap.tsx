import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dt, get } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHead, SimBadge, Tabs, useApi } from '../components/ui';

const BOX = { w: 132, h: 40 };
const rate = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)}G` : `${m.toFixed(1)}M`);
const linkColor = (l: any) => (l.status === 'DOWN' ? '#dc2626' : l.kind === 'MGMT' ? '#6b7280' : l.utilisation >= 0.8 ? '#dc2626' : l.utilisation >= 0.5 ? '#eab308' : '#16a34a');

/**
 * Deterministic logical layout: each PoP is a cluster (OTN on top, PE and
 * management switch below) seeded from its rough geographic position, then
 * pushed apart until clusters no longer overlap. Logical, not geographic.
 */
function layout(locations: any[]) {
  const wrap = (lon: number) => (lon < -100 ? lon + 360 : lon);
  const pts = locations.map((l) => ({ id: l.id, x: (wrap(l.lon) - 100) * 18, y: (40 - l.lat) * 22 }));
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = (b.x - a.x) / 330, dy = (b.y - a.y) / 190;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          const push = (1 - d) / 2;
          const ux = d ? dx / d : 1, uy = d ? dy / d : 0;
          a.x -= ux * push * 330; a.y -= uy * push * 190;
          b.x += ux * push * 330; b.y += uy * push * 190;
        }
      }
    }
  }
  const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
  return new Map(pts.map((p) => [p.id, { x: p.x - minX + 220, y: p.y - minY + 80 }]));
}

function devicePos(d: any, centers: Map<string, { x: number; y: number }>) {
  const c = centers.get(d.location_id)!;
  if (d.role === 'NMS') return { x: c.x - 260, y: c.y - 10 };
  if (d.role === 'OTN') return { x: c.x, y: c.y };
  if (d.role === 'PE') return { x: c.x - 72, y: c.y + 70 };
  return { x: c.x + 72, y: c.y + 70 };
}

function Glyph({ role }: { role: string }) {
  if (role === 'SWITCH' || role === 'MGMT_SWITCH') return <g><rect x={-9} y={-5} width={18} height={10} rx={1.5} fill="#334155" /><path d="M-6,-1 h12 M-6,2 h12" stroke="#cbd5e1" strokeWidth={1.2} /></g>;
  if (role === 'NMS') return <g><rect x={-9} y={-7} width={18} height={12} rx={1.5} fill="#334155" /><rect x={-4} y={5} width={8} height={2} fill="#334155" /></g>;
  return <g><ellipse cx={0} cy={-3} rx={9} ry={3.5} fill="#475569" /><path d="M-9,-3 v6 a9,3.5 0 0 0 18,0 v-6" fill="#334155" /><path d="M-5,-3 h10" stroke="#e2e8f0" strokeWidth={1.2} /></g>;
}

export function DeviceMapPage() {
  const nav = useNavigate();
  const map = useApi(() => get('/api/device-map'), [], 5000);
  const outages = useApi(() => get('/api/outages'), [], 8000);
  const probes = useApi(() => get('/api/probes'), [], 8000);
  const [tab, setTab] = useState('Map');
  const [view, setView] = useState<{ x: number; y: number; k: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const locKey = map.data ? map.data.locations.map((l: any) => l.id).join() : '';
  const centers = useMemo(() => (map.data ? layout(map.data.locations) : new Map()), [locKey]);
  if (map.error) return <ErrorBox error={map.error} />;
  if (!map.data) return <Loading what="Memuat peta perangkat" />;
  const d = map.data;
  const pos = new Map(d.devices.map((x: any) => [x.id, devicePos(x, centers)]));
  const color = (x: any) => (x.role === 'NMS' ? '#64748b' : x.reachable === false || x.node_status === 'DOWN' ? '#dc2626' : x.reachable === undefined || x.reachable === null ? '#94a3b8' : x.active_alarms > 0 ? '#f59e0b' : '#22c55e');
  const W = Math.max(...[...pos.values()].map((p: any) => p.x)) + 260, H = Math.max(...[...pos.values()].map((p: any) => p.y)) + 160;
  const VW = W * 0.5, VH = H * 0.5;
  /** Zoom to a location cluster (default: Makassar, the middle of the Indonesian ring). */
  const focus = (loc: string, k = 1.1) => { const c: any = centers.get(loc) ?? { x: W / 2, y: H / 2 }; return { k, x: VW / (2 * k) - c.x, y: VH / (2 * k) - c.y - 30 }; };
  const fit = { x: 0, y: 0, k: 0.5 };
  const v = view ?? focus('mks');
  const setV = (nv: { x: number; y: number; k: number }) => setView(nv);
  const selDev = d.devices.find((x: any) => x.id === sel);
  const down = d.devices.filter((x: any) => x.reachable === false).length;

  const onWheel = (e: WheelEvent) => { const k = Math.max(0.2, Math.min(2.5, v.k * (e.deltaY < 0 ? 1.12 : 0.89))); setV({ ...v, k }); };
  const onDown = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent) => { if (drag.current) setV({ ...v, x: drag.current.vx + (e.clientX - drag.current.x) / v.k, y: drag.current.vy + (e.clientY - drag.current.y) / v.k }); };
  const onUp = () => { drag.current = null; };

  return (
    <div className="stack">
      <PageHead title="Device Map" sub={<>Peta logis perangkat & link (bukan geografis). Tick {d.tick} · {dt(d.simTime)} (sim) <SimBadge /></>}>
        <Badge v={`${d.devices.length - 1} devices`} tone="accent" /> <Badge v={`${down} down`} tone={down ? 'bad' : 'ok'} />
      </PageHead>
      <Tabs tabs={['Map', 'Devices', 'Outages', 'Probes', 'Links']} value={tab} onChange={setTab} />

      {tab === 'Map' ? (
        <div className="grid" style={{ gridTemplateColumns: selDev ? 'minmax(0, 1fr) 300px' : '1fr' }}>
          <div className="card" style={{ padding: 8 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <button className="sm" onClick={() => setV({ ...v, k: Math.min(2.5, v.k * 1.25) })}>＋</button>
              <button className="sm" onClick={() => setV({ ...v, k: Math.max(0.2, v.k / 1.25) })}>－</button>
              <button className="sm" onClick={() => setV(fit)}>Fit semua</button>
              <button className="sm" onClick={() => setV(focus('mks'))}>Indonesia</button>
              <button className="sm" onClick={() => setV(focus('hkg', 0.8))}>Asia</button>
              <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> label rx/tx</label>
              <span className="small muted">Seret untuk geser · scroll untuk zoom · klik perangkat untuk detail</span>
            </div>
            <div className="dude" onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
              <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Logical device map">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0 H0 V20" fill="none" stroke="var(--border)" strokeWidth="0.5" /></pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <g transform={`scale(${v.k}) translate(${v.x} ${v.y})`}>
                  {d.links.map((l: any) => {
                    const a: any = pos.get(l.a), b: any = pos.get(l.b);
                    if (!a || !b) return null;
                    const c = linkColor(l);
                    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                    return (
                      <g key={l.id}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={l.kind === 'CORE' ? 2.5 + Math.min(4, l.capacityMbps / 25000) : 1.5}
                          strokeDasharray={l.status === 'DOWN' ? '6 4' : l.kind === 'MGMT' ? '3 3' : undefined}>
                          <title>{`${l.aPort ?? ''} ⇄ ${l.bPort ?? ''} · ${l.status} · rx ${rate(l.inMbps)} / tx ${rate(l.outMbps)} · ${(l.utilisation * 100).toFixed(1)} %`}</title>
                        </line>
                        {showLabels && l.kind === 'CORE' ? (
                          <g transform={`translate(${mx} ${my})`}>
                            <rect x={-46} y={-11} width={92} height={22} rx={3} fill="var(--surface)" stroke={c} strokeWidth={0.8} opacity={0.92} />
                            <text y={-1} textAnchor="middle" fontSize={8.5} fill="var(--text)">rx {rate(l.inMbps)} tx {rate(l.outMbps)}</text>
                            <text y={8} textAnchor="middle" fontSize={7.5} fill="var(--muted)">{l.id.replace('seg-', '')} · {(l.utilisation * 100).toFixed(1)}%</text>
                          </g>
                        ) : null}
                      </g>
                    );
                  })}
                  {d.devices.map((x: any) => {
                    const p: any = pos.get(x.id);
                    const isSel = sel === x.id;
                    return (
                      <g key={x.id} transform={`translate(${p.x - BOX.w / 2} ${p.y - BOX.h / 2})`} style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); setSel(x.id === sel ? null : x.id); }} onDoubleClick={() => x.role !== 'NMS' && nav(`/devices/${x.id}`)}>
                        <rect width={BOX.w} height={BOX.h} rx={4} fill={color(x)} stroke={isSel ? 'var(--text)' : '#14532d'} strokeWidth={isSel ? 2.5 : 1} />
                        <g transform="translate(14 20)"><Glyph role={x.role === 'MGMT_SWITCH' ? 'SWITCH' : x.role} /></g>
                        <text x={28} y={16} fontSize={10} fontWeight={700} fill="#0b1220">{x.hostname}</text>
                        <text x={28} y={29} fontSize={8.5} fill="#0b1220">{(x.mgmt_ip ?? '').replace('/24', '')}{x.reachable && x.ping_ms !== null && x.ping_ms !== undefined ? ` · ${x.ping_ms.toFixed(1)}ms` : x.reachable === false ? ' · DOWN' : ''}</text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
            <div className="legend">
              <span><i style={{ background: '#22c55e' }} />up</span><span><i style={{ background: '#f59e0b' }} />up, ada alarm</span><span><i style={{ background: '#dc2626' }} />down / tak terjangkau</span>
              <span><i style={{ background: '#94a3b8' }} />belum dipoll</span><span>link: hijau &lt;50 % · kuning &lt;80 % · merah ≥80 % / putus-putus = down · titik-titik = manajemen</span>
            </div>
          </div>
          {selDev ? (
            <div className="card stack" style={{ gap: 8 }}>
              <div className="row between"><strong>{selDev.hostname}</strong><button className="sm ghost" onClick={() => setSel(null)}>✕</button></div>
              <table className="small"><tbody>
                <tr><td>Role / model</td><td>{selDev.role} · {selDev.model ?? '—'}</td></tr>
                <tr><td>Mgmt IP</td><td className="mono">{selDev.mgmt_ip ?? '—'}</td></tr>
                {selDev.loopback_ip ? <tr><td>Loopback</td><td className="mono">{selDev.loopback_ip}</td></tr> : null}
                <tr><td>Lokasi</td><td>{selDev.city}</td></tr>
                <tr><td>Status</td><td>{selDev.reachable === false ? <Badge v="DOWN" /> : <Badge v="UP" />}</td></tr>
                <tr><td>Ping / loss</td><td>{selDev.ping_ms !== null && selDev.ping_ms !== undefined ? `${selDev.ping_ms.toFixed(2)} ms` : '—'} / {selDev.ping_loss_pct ?? '—'} %</td></tr>
                <tr><td>CPU / mem</td><td>{selDev.cpu_pct !== null && selDev.cpu_pct !== undefined ? `${selDev.cpu_pct.toFixed(1)} % / ${selDev.mem_pct.toFixed(1)} %` : '—'}</td></tr>
                <tr><td>Port (down)</td><td>{selDev.ports ?? '—'} ({selDev.ports_down ?? 0})</td></tr>
                <tr><td>Layanan</td><td>{selDev.services ?? 0}</td></tr>
                <tr><td>Alarm aktif</td><td>{selDev.active_alarms ?? 0}</td></tr>
              </tbody></table>
              {selDev.role !== 'NMS' ? <div className="row"><Link className="btn" to={`/devices/${selDev.id}`}>Detail</Link><Link className="btn" to={`/performance?device=${selDev.id}`}>Grafik</Link></div> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'Devices' ? (
        <div className="card table-wrap"><table>
          <thead><tr><th>Status</th><th>Hostname</th><th>Role</th><th>Model / OS</th><th>Mgmt IP</th><th>Lokasi</th><th className="num">Ping</th><th className="num">CPU</th><th className="num">Port down</th><th className="num">Layanan</th><th className="num">Alarm</th></tr></thead>
          <tbody>{d.devices.filter((x: any) => x.role !== 'NMS').map((x: any) => (
            <tr key={x.id} className="click" onClick={() => nav(`/devices/${x.id}`)}>
              <td><span className={`dot ${x.reachable === false ? 'bad' : x.reachable ? 'ok' : ''}`} /></td>
              <td className="mono">{x.hostname}</td><td>{x.role}</td><td className="small">{x.model}<div className="muted">{x.os_version}</div></td>
              <td className="mono small">{x.mgmt_ip}</td><td>{x.city}</td>
              <td className="num">{x.ping_ms !== null && x.ping_ms !== undefined ? `${x.ping_ms.toFixed(1)} ms` : '—'}</td>
              <td className="num">{x.cpu_pct !== null && x.cpu_pct !== undefined ? `${x.cpu_pct.toFixed(0)} %` : '—'}</td>
              <td className="num">{x.ports_down}</td><td className="num">{x.services}</td><td className="num">{x.active_alarms}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}

      {tab === 'Outages' ? (
        <div className="card table-wrap">
          {!outages.data?.length ? <Empty>Belum ada outage perangkat. Jalankan skenario gangguan di Simulation Lab lalu majukan tick.</Empty> : (
            <table>
              <thead><tr><th>Perangkat</th><th>Role</th><th>Mulai (sim)</th><th>Selesai (sim)</th><th className="num">Durasi</th><th>Status</th></tr></thead>
              <tbody>{outages.data.map((o: any) => (
                <tr key={`${o.equipment_id}-${o.start_tick}`}><td className="mono"><Link to={`/devices/${o.equipment_id}`}>{o.hostname}</Link></td><td>{o.role}</td>
                  <td className="small">{dt(o.startedAt)} (t{o.start_tick})</td><td className="small">{o.endedAt ? dt(o.endedAt) : '—'}</td>
                  <td className="num">{Math.round(o.durationSeconds / 60)} min</td><td>{o.ongoing ? <Badge v="ONGOING" tone="bad" /> : <Badge v="RECOVERED" tone="ok" />}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === 'Probes' ? (
        <div className="card table-wrap"><table>
          <thead><tr><th>Perangkat</th><th>Mgmt IP</th><th>Lokasi</th><th>ping</th><th>snmp</th><th>ssh</th><th className="num">RTT</th><th className="num">Loss</th></tr></thead>
          <tbody>{(probes.data ?? []).map((p: any) => (
            <tr key={p.deviceId}><td className="mono">{p.hostname}</td><td className="mono small">{p.mgmtIp}</td><td>{p.city}</td>
              <td><Badge v={p.ping} /></td><td><Badge v={p.snmp} /></td><td><Badge v={p.ssh} /></td>
              <td className="num">{p.pingMs !== null && p.pingMs !== undefined ? `${p.pingMs.toFixed(2)} ms` : '—'}</td><td className="num">{p.lossPct ?? '—'} %</td></tr>
          ))}</tbody>
        </table><div className="small muted" style={{ marginTop: 6 }}>Probe disimulasikan dari NMS di Jakarta lewat jaringan manajemen in-band.</div></div>
      ) : null}

      {tab === 'Links' ? (
        <div className="card table-wrap"><table>
          <thead><tr><th>Link</th><th>Jenis</th><th>A</th><th>B</th><th>Status</th><th className="num">rx</th><th className="num">tx</th><th className="num">Kapasitas</th><th className="num">Utilisasi</th></tr></thead>
          <tbody>{d.links.map((l: any) => (
            <tr key={l.id}><td className="mono small">{l.id}</td><td>{l.kind}</td>
              <td className="small">{d.devices.find((x: any) => x.id === l.a)?.hostname} <span className="muted">{l.aPort}</span></td>
              <td className="small">{d.devices.find((x: any) => x.id === l.b)?.hostname} <span className="muted">{l.bPort}</span></td>
              <td><Badge v={l.status} /></td><td className="num">{rate(l.inMbps)}</td><td className="num">{rate(l.outMbps)}</td>
              <td className="num">{rate(l.capacityMbps)}</td><td className="num">{(l.utilisation * 100).toFixed(2)} %</td></tr>
          ))}</tbody>
        </table></div>
      ) : null}
    </div>
  );
}
