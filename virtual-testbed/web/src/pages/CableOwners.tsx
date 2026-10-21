import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, bw, dt, get, idr, km, post } from '../api';
import { useAuth } from '../App';
import { Badge, Bar, ErrorBox, Loading, PageHead, SimBadge, useAction, useApi } from '../components/ui';

export function CableOwnersPage() {
  const { user } = useAuth();
  return user.role === 'PROVIDER' ? <ProviderPortal /> : <OwnersOverview />;
}

function SubordersTable({ rows, canRespond, onDone }: { rows: any[]; canRespond: boolean; onDone: () => void }) {
  const act = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const respond = (id: string, decision: string) => act.run(async () => {
    await post(`/api/provider/suborders/${id}/respond`, { decision, note: notes[id] || (decision === 'ACCEPT' ? undefined : 'See note') });
    onDone();
  });
  if (!rows.length) return <div className="muted small">No sub-orders.</div>;
  return (
    <div className="table-wrap">
      <ErrorBox error={act.error} />
      <table>
        <thead><tr><th>Sub-order</th><th>Order</th><th>Customer / route</th><th>Segments</th><th className="num">Wholesale / mo</th><th>State</th><th>Deadline</th>{canRespond ? <th>Action</th> : null}</tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.id}<div className="small muted">{s.provider_name}</div></td>
              <td><Link className="mono" to={`/orders/${s.order_id}`}>{s.order_id}</Link><div><Badge v={s.order_state} /></div></td>
              <td className="small">{s.customer_name}<div className="muted">{s.a_location_id.toUpperCase()} ⇄ {s.b_location_id.toUpperCase()} · {bw(s.bandwidth_mbps)}</div></td>
              <td className="small mono">{s.segment_ids.join(', ')}</td>
              <td className="num">{idr(s.wholesale_monthly)}</td>
              <td><Badge v={s.state} />{s.response_note ? <div className="small muted">{s.response_note}</div> : null}</td>
              <td className="small">{dt(s.deadline_at)}</td>
              {canRespond ? (
                <td>
                  {['PENDING', 'CLARIFICATION_REQUESTED'].includes(s.state) ? (
                    <div className="stack" style={{ gap: 4 }}>
                      <input placeholder="Note / reason" value={notes[s.id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} />
                      <div className="row">
                        <button className="sm primary" disabled={act.busy} onClick={() => respond(s.id, 'ACCEPT')}>Accept</button>
                        <button className="sm danger" disabled={act.busy} onClick={() => respond(s.id, 'REJECT')}>Reject</button>
                        <button className="sm" disabled={act.busy} onClick={() => respond(s.id, 'CLARIFY')}>Clarify</button>
                      </div>
                    </div>
                  ) : '—'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProviderPortal() {
  const assets = useApi(() => get('/api/provider/assets'), [], 8000);
  const subs = useApi(() => get('/api/provider/suborders'), [], 4000);
  const settle = useApi(() => get('/api/settlement/summary'), [], 10000);
  const act = useAction();
  const [prices, setPrices] = useState<Record<string, string>>({});
  if (assets.error) return <ErrorBox error={assets.error} />;
  if (!assets.data) return <Loading />;
  const p = assets.data.provider;
  const savePrice = (id: string) => act.run(async () => {
    await api('PATCH', `/api/provider/segments/${id}`, { pricePerGbpsMonth: Number(prices[id]) });
    assets.reload();
  });
  const toggleAuto = () => act.run(async () => { await api('PATCH', '/api/provider/settings', { autoAccept: !p.auto_accept }); assets.reload(); });
  const pending = (subs.data ?? []).filter((s: any) => ['PENDING', 'CLARIFICATION_REQUESTED'].includes(s.state)).length;
  return (
    <div className="stack">
      <PageHead title={p.name} sub="Cable-owner portal — your assets, sub-orders and settlement only"><SimBadge /></PageHead>
      <ErrorBox error={act.error} />
      <div className="kpis">
        <div className="kpi"><div className="label">Segments owned</div><div className="value">{assets.data.segments.length}</div></div>
        <div className="kpi"><div className="label">Services on your assets</div><div className="value">{assets.data.services.length}</div></div>
        <div className={`kpi ${pending ? 'warn' : ''}`}><div className="label">Sub-orders awaiting you</div><div className="value">{pending}</div></div>
        <div className="kpi"><div className="label">Monthly allocation (est.)</div><div className="value" style={{ fontSize: 18 }}>{idr(settle.data?.providerAllocations?.[0]?.amount ?? 0)}</div><div className="sub">SIMULATED ledger</div></div>
        <div className="kpi"><div className="label">Auto-accept policy</div><div className="value" style={{ fontSize: 18 }}>{p.auto_accept ? 'ON' : 'OFF'}</div><button className="sm" onClick={toggleAuto} disabled={act.busy}>Toggle</button></div>
      </div>
      <div className="card"><h2>Sub-order inbox</h2><SubordersTable rows={subs.data ?? []} canRespond onDone={() => subs.reload()} /></div>
      <div className="card">
        <h2>Your segments</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Segment</th><th>System</th><th className="num">Length</th><th>Status</th><th style={{ width: 160 }}>Utilisation</th><th className="num">Services</th><th>Wholesale price / Gbps-month (DEMO)</th></tr></thead>
            <tbody>
              {assets.data.segments.map((s: any) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td className="small">{s.cable_system_name}</td>
                  <td className="num">{km(s.length_km)}</td>
                  <td><Badge v={s.oper_status} /> {s.admin_status === 'DOWN' ? <Badge v="ADMIN DOWN" tone="bad" /> : null}</td>
                  <td><Bar value={s.reserved_mbps / s.capacity_mbps} /><div className="small muted">{bw(s.reserved_mbps)} / {bw(s.capacity_mbps)}</div></td>
                  <td className="num">{s.services}</td>
                  <td>
                    <div className="row">
                      <input style={{ width: 130 }} type="number" min={0} placeholder={String(s.price_per_gbps_month)} value={prices[s.id] ?? ''} onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value })} />
                      <button className="sm" disabled={!prices[s.id] || act.busy} onClick={() => savePrice(s.id)}>Save</button>
                    </div>
                    <div className="small muted">current {idr(s.price_per_gbps_month)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Services traversing your assets</h2>
        {assets.data.services.length ? (
          <table><tbody>{assets.data.services.map((s: any) => (
            <tr key={s.id + s.role}><td><Link to={`/services/${s.id}`}>{s.name}</Link></td><td><Badge v={s.role} /></td><td><Badge v={s.oper_status} /></td><td>{bw(s.bandwidth_mbps)}</td></tr>
          ))}</tbody></table>
        ) : <div className="muted small">None yet.</div>}
      </div>
    </div>
  );
}

function OwnersOverview() {
  const topo = useApi(() => get('/api/topology'), [], 10000);
  const subs = useApi(() => get('/api/provider/suborders'), [], 5000);
  if (topo.error) return <ErrorBox error={topo.error} />;
  if (!topo.data) return <Loading />;
  return (
    <div className="stack">
      <PageHead title="Cable Owners" sub="Fictional DEMO providers and their simulated assets"><SimBadge /></PageHead>
      <div className="grid g3">
        {topo.data.providers.map((p: any) => {
          const segs = topo.data.segments.filter((s: any) => s.providerId === p.id);
          const cap = segs.reduce((a: number, s: any) => a + (s.capacityMbps ?? 0), 0);
          const res = segs.reduce((a: number, s: any) => a + (s.reservedMbps ?? 0), 0);
          return (
            <div key={p.id} className="card">
              <div className="row between"><h2 style={{ margin: 0 }}>{p.name}</h2><Badge v={p.code} tone="accent" /></div>
              <div className="small muted">{segs.length} spans · {km(segs.reduce((a: number, s: any) => a + s.lengthKm, 0))} · auto-accept {p.auto_accept ? 'on' : 'off'}</div>
              <div style={{ marginTop: 8 }}><Bar value={cap ? res / cap : 0} /></div>
              <div className="small muted">{bw(res)} reserved of {bw(cap)}</div>
              <div className="small" style={{ marginTop: 6 }}>{segs.filter((s: any) => s.operStatus !== 'UP').map((s: any) => <span key={s.id}><Badge v={s.operStatus} /> <span className="mono">{s.id}</span> </span>)}</div>
            </div>
          );
        })}
      </div>
      <div className="card"><h2>All provider sub-orders</h2><SubordersTable rows={subs.data ?? []} canRespond={false} onDone={() => subs.reload()} /></div>
    </div>
  );
}
