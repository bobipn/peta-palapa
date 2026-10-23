import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dt, get, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Empty, ErrorBox, Loading, PageHead, SimBadge, Tabs, Timeline, useAction, useApi } from '../components/ui';

const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];
type SortKey = 'severity' | 'code' | 'raised_tick' | 'type' | 'source_name' | 'occurrence';

export function AlarmsPage() {
  const { user } = useAuth();
  const canAct = hasRole(user, 'ADMIN', 'NOC');
  const [tab, setTab] = useState('Current Alarms');
  const [auto, setAuto] = useState(true);
  const state = tab === 'Current Alarms' ? 'ACTIVE' : tab === 'Alarm Logs' ? 'CLEARED' : null;
  const alarms = useApi(() => (state ? get(`/api/alarms?state=${state}`) : Promise.resolve([])), [state, auto], auto ? 3000 : 0);
  const incidents = useApi(() => get('/api/incidents'), [], 5000);
  const stats = useApi(() => get('/api/alarms/stats'), [auto], auto ? 5000 : 0);
  const sim = useApi(() => (hasRole(user, 'ADMIN', 'NOC', 'AUDITOR') ? get('/api/simulation/state') : Promise.resolve(null)), [], 10000);
  const act = useAction();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sevFilter, setSevFilter] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'raised_tick', dir: -1 });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const f = q.toLowerCase();
    const list = (alarms.data ?? []).filter((a: any) => (!sevFilter || a.severity === sevFilter) && (!f || [a.type, a.source_name, a.location_info, a.message, a.code].join(' ').toLowerCase().includes(f)));
    const rank = (a: any) => (sort.key === 'severity' ? SEVERITIES.indexOf(a.severity) : a[sort.key] ?? '');
    return [...list].sort((a: any, b: any) => (rank(a) > rank(b) ? 1 : rank(a) < rank(b) ? -1 : 0) * sort.dir);
  }, [alarms.data, sevFilter, q, sort]);
  const simLabel = (t: number) => (sim.data ? new Date(new Date(sim.data.simTime).getTime() - (sim.data.tick - t) * sim.data.tickSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19) : `tick ${t}`);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ack = (ids: string[]) => act.run(async () => { await post('/api/alarms/ack', { ids }); setSel(new Set()); alarms.reload(); stats.reload(); });
  const clear = (ids: string[]) => act.run(async () => { for (const id of ids) await post(`/api/alarms/${id}/clear`).catch(() => undefined); setSel(new Set()); alarms.reload(); });
  const comment = (ids: string[]) => act.run(async () => {
    const text = prompt('Komentar untuk alarm terpilih:');
    if (!text) return;
    for (const id of ids) await post(`/api/alarms/${id}/comments`, { text });
    alarms.reload();
  });
  const head = (key: SortKey, label: string) => (
    <th className="click-th" onClick={() => setSort({ key, dir: sort.key === key ? (-sort.dir as 1 | -1) : -1 })}>{label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</th>
  );
  const counters = stats.data?.activeBySeverity ?? [];

  return (
    <div className="stack">
      <PageHead title="Alarms & Incidents" sub="Alarm console: alarm direkonsiliasi dari state gangguan simulasi; insiden mengelompokkan gangguan berkorelasi.">
        <SimBadge />
        <div className="sev-counters" role="group" aria-label="Active alarms by severity">
          {counters.filter((c: any) => c.severity !== 'INFO').map((c: any) => (
            <button key={c.severity} className={`sev sev-${c.severity} ${sevFilter === c.severity ? 'on' : ''}`} title={`${c.n} aktif, ${c.unacked} belum di-ack — klik untuk filter`}
              onClick={() => { setTab('Current Alarms'); setSevFilter(sevFilter === c.severity ? null : c.severity); }}>{c.n}</button>
          ))}
        </div>
      </PageHead>
      <ErrorBox error={alarms.error ?? act.error} />
      <Tabs tabs={['Current Alarms', 'Alarm Logs', 'Statistics', 'Incidents']} value={tab} onChange={(t) => { setTab(t); setSel(new Set()); }} />

      {state ? (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="row">
              <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto Refresh</label>
              <input placeholder="Quick filter (nama, sumber, lokasi, kode)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
              {sevFilter ? <button className="sm" onClick={() => setSevFilter(null)}>Severity: {sevFilter} ✕</button> : null}
              <span className="small muted">{rows.length} alarm</span>
            </div>
            <div className="row">
              <a className="btn" href={`/api/alarms/export.csv?state=${state}`}>Export CSV</a>
              {canAct && state === 'ACTIVE' ? <>
                <button onClick={() => comment([...sel])} disabled={!sel.size || act.busy}>Comment</button>
                <button onClick={() => clear([...sel])} disabled={!sel.size || act.busy} title="Clear manual; akan muncul lagi bila kondisinya masih ada">Clear</button>
                <button className="primary" onClick={() => ack([...sel])} disabled={!sel.size || act.busy}>Acknowledge ({sel.size})</button>
              </> : null}
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 620 }}>
            <table className="alarm-table">
              <thead><tr>
                <th><input type="checkbox" aria-label="Pilih semua" checked={rows.length > 0 && rows.every((a: any) => sel.has(a.id))} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((a: any) => a.id)) : new Set())} /></th>
                {canAct && state === 'ACTIVE' ? <th>Operation</th> : null}
                {head('severity', 'Severity')}{head('code', 'Alarm ID')}{head('raised_tick', state === 'ACTIVE' ? 'Last Occurred (sim)' : 'Raised → Cleared (sim)')}{head('type', 'Name')}{head('source_name', 'Alarm Source')}<th>Location Info</th>{head('occurrence', 'Occ.')}<th>Ack</th>
              </tr></thead>
              <tbody>{rows.map((a: any) => (
                <tr key={a.id} className={sel.has(a.id) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Pilih ${a.type}`} /></td>
                  {canAct && state === 'ACTIVE' ? <td className="nowrap">
                    <button className="icon-btn" title="Acknowledge" onClick={() => ack([a.id])} disabled={a.acknowledged}>✔</button>
                    <button className="icon-btn" title="Comment" onClick={() => comment([a.id])}>✎</button>
                    <button className="icon-btn" title="Clear" onClick={() => clear([a.id])}>⌫</button>
                    <button className="icon-btn" title="Detail" onClick={() => setOpen(a.id)}>⋯</button>
                  </td> : null}
                  <td><span className={`sev sev-${a.severity}`}>{a.severity[0] + a.severity.slice(1).toLowerCase()}</span></td>
                  <td className="num">{a.code ?? '—'}</td>
                  <td className="nowrap small">{simLabel(a.raised_tick)}{a.cleared_tick !== null ? <div className="muted">→ {simLabel(a.cleared_tick)}</div> : null}</td>
                  <td><button className="linkish mono" onClick={() => setOpen(a.id)}>{a.type}</button></td>
                  <td className={`small ${a.severity === 'CRITICAL' && a.state === 'ACTIVE' ? 'crit-text' : ''}`}>{a.entity_type === 'SERVICE' ? <Link to={`/services/${a.entity_id}`}>{a.source_name ?? a.entity_id}</Link> : a.source_name ?? a.entity_id}</td>
                  <td className={`small mono ${a.severity === 'CRITICAL' && a.state === 'ACTIVE' ? 'crit-text' : ''}`}>{a.location_info ?? '-'}</td>
                  <td className="num">{a.occurrence ?? 1}</td>
                  <td className="small">{a.acknowledged ? <span title={a.acked_by ?? ''}>✔ {a.acked_by?.split('@')[0] ?? ''}</span> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length ? <Empty>{state === 'ACTIVE' ? 'Tidak ada alarm aktif. Jalankan skenario di Simulation Lab.' : 'Belum ada riwayat alarm.'}</Empty> : null}
          </div>
        </div>
      ) : null}

      {tab === 'Statistics' && stats.data ? (
        <div className="grid g3">
          <div className="card"><h3>Aktif per severity</h3><table><tbody>{stats.data.activeBySeverity.map((s: any) => <tr key={s.severity}><td><span className={`sev sev-${s.severity}`}>{s.severity}</span></td><td className="num">{s.n}</td><td className="small muted">{s.unacked} belum di-ack</td></tr>)}</tbody></table></div>
          <div className="card"><h3>Per jenis alarm (semua)</h3><table><tbody>{stats.data.byType.map((s: any) => <tr key={s.key}><td className="mono small">{s.key}</td><td className="num">{s.n}</td></tr>)}</tbody></table></div>
          <div className="card"><h3>Sumber terbanyak</h3><table><tbody>{stats.data.bySource.map((s: any) => <tr key={s.key}><td className="mono small">{s.key}</td><td className="num">{s.n}</td></tr>)}</tbody></table></div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>Alarm per jam (waktu simulasi)</h3>
            {stats.data.perSimHour.length ? <div className="hbars">{stats.data.perSimHour.map((h: any) => {
              const max = Math.max(...stats.data.perSimHour.map((x: any) => x.n));
              return <div key={h.hour} className="hbar" title={`jam ke-${h.hour}: ${h.n}`}><span style={{ height: `${(h.n / max) * 100}%` }} /><small>{h.hour}</small></div>;
            })}</div> : <Empty>Belum ada data.</Empty>}
          </div>
        </div>
      ) : null}

      {tab === 'Incidents' ? (
        <div className="card">
          {!incidents.data ? <Loading /> : !incidents.data.length ? <Empty>No incidents. Inject a fault in the Simulation Lab.</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Incident</th><th>Severity</th><th>State</th><th>Opened / mitigated / resolved (tick)</th><th className="num">Services</th><th className="num">Customers</th><th>Providers</th></tr></thead>
              <tbody>{incidents.data.map((i: any) => (
                <tr key={i.id}>
                  <td><Link to={`/incidents/${i.id}`}>{i.title}</Link><div className="small mono muted">{i.id}</div></td>
                  <td><Badge v={i.severity} /></td><td><Badge v={i.state} /></td>
                  <td className="small">{i.opened_tick} / {i.mitigated_tick ?? '—'} / {i.resolved_tick ?? '—'}</td>
                  <td className="num">{i.impacted_services.length}</td><td className="num">{i.impacted_customers.length}</td>
                  <td className="small">{i.impacted_providers.join(', ')}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ) : null}

      {open ? <AlarmDrawer id={open} onClose={() => setOpen(null)} canAct={canAct} onChanged={() => alarms.reload()} /> : null}
    </div>
  );
}

function AlarmDrawer({ id, onClose, canAct, onChanged }: { id: string; onClose: () => void; canAct: boolean; onChanged: () => void }) {
  const d = useApi(() => get(`/api/alarms/${id}`), [id], 4000);
  const act = useAction();
  const [text, setText] = useState('');
  if (!d.data) return null;
  const a = d.data.alarm;
  const send = () => act.run(async () => { await post(`/api/alarms/${id}/comments`, { text }); setText(''); d.reload(); onChanged(); });
  return (
    <div className="drawer" role="dialog" aria-label="Alarm detail">
      <div className="row between"><h2 style={{ margin: 0 }}>{a.type}</h2><button className="sm ghost" onClick={onClose}>✕</button></div>
      <div className="row"><span className={`sev sev-${a.severity}`}>{a.severity}</span><Badge v={a.state} />{a.acknowledged ? <Badge v={`ACK ${a.acked_by ?? ''}`} tone="neutral" /> : null}<SimBadge /></div>
      <table className="small"><tbody>
        <tr><td>Alarm ID</td><td>{a.code}</td></tr>
        <tr><td>Sumber</td><td className="mono">{a.source_name}</td></tr>
        <tr><td>Lokasi</td><td className="mono">{a.location_info}</td></tr>
        <tr><td>Pesan</td><td>{a.message}</td></tr>
        <tr><td>Kemunculan</td><td>{a.occurrence}</td></tr>
        <tr><td>Muncul (sim)</td><td>{dt(a.raised_at)} (tick {a.raised_tick})</td></tr>
        <tr><td>Clear (sim)</td><td>{a.cleared_at ? `${dt(a.cleared_at)}${a.cleared_by ? ` oleh ${a.cleared_by}` : ' (otomatis)'}` : '—'}</td></tr>
        <tr><td>Insiden</td><td>{a.incident_id ? <Link to={`/incidents/${a.incident_id}`}>{a.incident_id}</Link> : '—'}</td></tr>
      </tbody></table>
      <h3>Komentar</h3>
      {d.data.comments.length ? d.data.comments.map((c: any) => <div key={c.id} className="small comment"><strong>{c.author_id}</strong> · {dt(c.created_at)}<div>{c.text}</div></div>) : <div className="small muted">Belum ada komentar.</div>}
      {canAct ? <div className="row"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis komentar…" style={{ flex: 1 }} /><button className="sm primary" onClick={send} disabled={!text || act.busy}>Kirim</button></div> : null}
    </div>
  );
}

const TONE: Record<string, string> = { FAULT_INJECTED: 'bad', SERVICE_DOWN: 'bad', SLA_BREACH: 'warn', PROTECTION_SWITCH: 'warn', REROUTE_STARTED: 'warn', ALARM_RAISED: 'warn', SERVICE_RESTORED: 'ok', MITIGATED: 'ok', FAULT_CLEARED: 'ok', RESOLVED: 'ok', REVERTED_TO_PRIMARY: 'ok' };

export function IncidentDetailPage() {
  const { id } = useParams();
  const d = useApi(() => get(`/api/incidents/${id}`), [id], 3000);
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const { incident: i, events, alarms, faults, restorations, tickSeconds } = d.data;
  return (
    <div className="stack">
      <PageHead title={i.title} sub={<><span className="mono">{i.id}</span> · root cause: {i.root_cause} <SimBadge /></>}>
        <Badge v={i.severity} /><Badge v={i.state} />
      </PageHead>
      <div className="grid g3">
        <div className="card"><h3>Impacted services</h3>{i.impacted_services.length ? i.impacted_services.map((s: string) => <div key={s}><Link className="mono" to={`/services/${s}`}>{s}</Link></div>) : <div className="muted small">None (no service traverses the faulted element)</div>}</div>
        <div className="card"><h3>Impacted customers / providers</h3><div className="small">{i.impacted_customers.join(', ') || '—'}</div><div className="small muted">{i.impacted_providers.join(', ') || '—'}</div></div>
        <div className="card">
          <h3>Restoration</h3>
          {restorations.length ? restorations.map((r: any) => <div key={r.serviceId + r.tick} className="small"><span className="mono">{r.serviceId}</span>: {r.seconds < 1 ? `${r.seconds * 1000} ms (protection switch)` : `${r.seconds} s`} @ tick {r.tick}</div>) : <div className="small muted">No restoration recorded.</div>}
          <div className="small muted">1 tick = {tickSeconds} s simulated</div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><h2>Timeline</h2><Timeline items={events.map((e: any) => ({ key: e.id, tone: TONE[e.kind], title: <><strong>{e.kind.replace(/_/g, ' ')}</strong> <span className="muted">{e.message}</span></>, meta: <>tick {e.tick} · {dt(e.sim_time)} (sim)</> }))} /></div>
        <div className="stack">
          <div className="card"><h2>Faults</h2><table><tbody>{faults.map((f: any) => <tr key={f.id}><td className="mono small">{f.type}</td><td className="mono small">{f.target_id}</td><td><Badge v={f.state} /></td><td className="small">tick {f.injected_tick}→{f.restored_tick ?? 'now'}</td></tr>)}</tbody></table></div>
          <div className="card"><h2>Correlated alarms</h2>{alarms.length ? <table><tbody>{alarms.map((a: any) => <tr key={a.id}><td><Badge v={a.severity} /></td><td className="mono small">{a.type}</td><td className="small">{a.entity_id}</td><td><Badge v={a.state} /></td></tr>)}</tbody></table> : <Empty>None</Empty>}</div>
        </div>
      </div>
    </div>
  );
}
