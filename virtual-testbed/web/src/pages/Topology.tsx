import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bw, get, idr, km, ms } from '../api';
import { Badge, Bar, ErrorBox, Loading, PageHead, SimBadge, useApi } from '../components/ui';
import { TopologyMap } from '../components/TopologyMap';

export function TopologyPage() {
  const topo = useApi(() => get('/api/topology'), [], 5000);
  const services = useApi(() => get('/api/services'), [], 10000);
  const [sel, setSel] = useState<{ kind: 'node' | 'segment'; id: string } | null>(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [svcId, setSvcId] = useState('');
  const svc = useApi(() => (svcId ? get(`/api/services/${svcId}`) : Promise.resolve(null)), [svcId]);
  const detail = useApi(() => (!sel ? Promise.resolve(null) : get(sel.kind === 'node' ? `/api/topology/nodes/${sel.id}` : `/api/topology/segments/${sel.id}`)), [sel?.kind, sel?.id], 5000);

  const highlight = useMemo(() => {
    if (!svc.data) return undefined;
    const p = (role: string) => svc.data.paths.find((x: any) => x.role === role && x.status !== 'RELEASED')?.segment_ids ?? [];
    return { primary: p('PRIMARY'), protection: p('PROTECTION'), reroute: p('REROUTE'), active: svc.data.service.active_path };
  }, [svc.data]);

  if (topo.error) return <ErrorBox error={topo.error} />;
  if (!topo.data) return <Loading />;
  const t = topo.data;
  const shown = providerFilter ? { ...t, segments: t.segments.filter((s: any) => s.providerId === providerFilter) } : t;

  return (
    <div className="stack">
      <PageHead title="Network Topology" sub={t.label}><SimBadge text="SIMULATED TOPOLOGY" /></PageHead>
      <div className="card row">
        <label className="f">Provider<select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}><option value="">All providers</option>{t.providers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="f">Show service path<select value={svcId} onChange={(e) => setSvcId(e.target.value)}><option value="">—</option>{services.data?.filter((s: any) => s.state === 'ACTIVE').map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="small muted">{t.segments.length} spans · {t.nodes.length} nodes · {t.activeFaults.length} active fault(s)</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr)' }}>
        <div className="card"><TopologyMap topo={shown} highlight={highlight} selected={sel} onSelect={setSel} /></div>
        <div className="card">
          {!sel ? <div className="muted">Select a node or segment on the map to see details.</div> : detail.data ? (
            sel.kind === 'segment' ? <SegmentPanel d={detail.data} /> : <NodePanel d={detail.data} />
          ) : <Loading />}
        </div>
      </div>
      <div className="card">
        <h2>Segments & capacity</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Segment</th><th>Provider</th><th className="num">Length</th><th className="num">Base latency</th><th>Status</th><th style={{ width: 180 }}>Utilisation</th><th className="num">Reserved / capacity</th></tr></thead>
            <tbody>
              {shown.segments.map((s: any) => (
                <tr key={s.id} className="click" onClick={() => setSel({ kind: 'segment', id: s.id })}>
                  <td className="mono">{s.id}</td>
                  <td className="small">{t.providers.find((p: any) => p.id === s.providerId)?.name}</td>
                  <td className="num">{km(s.lengthKm)}</td>
                  <td className="num">{ms(s.baseLatencyMs)}</td>
                  <td><Badge v={s.operStatus} />{s.activeAlarms ? <> <Badge v={`${s.activeAlarms} alarm`} tone="bad" /></> : null}</td>
                  <td>{s.utilisation === null ? <span className="small muted">hidden (other owner)</span> : <Bar value={s.utilisation} />}</td>
                  <td className="num">{s.capacityMbps === null ? '—' : `${bw(s.reservedMbps)} / ${bw(s.capacityMbps)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SegmentPanel({ d }: { d: any }) {
  const s = d.segment;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between"><h2 className="mono" style={{ margin: 0 }}>{s.id}</h2><Badge v={s.oper_status} /></div>
      <table>
        <tbody>
          <tr><td>Cable system</td><td>{s.cable_system_name} <Badge v={s.cable_kind} tone="neutral" /></td></tr>
          <tr><td>Owner</td><td>{s.provider_id}</td></tr>
          <tr><td>Physical length</td><td>{km(s.length_km)} <span className="small muted">(synthetic)</span></td></tr>
          <tr><td>Base latency / jitter / loss</td><td>{ms(s.base_latency_ms, 3)} / {ms(s.base_jitter_ms, 3)} / {s.base_loss_pct} %</td></tr>
          <tr><td>Capacity</td><td>{s.capacity_mbps === null ? 'hidden' : `${bw(s.reserved_mbps)} reserved of ${bw(s.capacity_mbps)}`}</td></tr>
          <tr><td>Price</td><td>{s.price_per_gbps_month === null ? 'hidden' : `${idr(s.price_per_gbps_month)} / Gbps-month (DEMO)`}</td></tr>
          <tr><td>SRLG</td><td>{s.srlg ?? '—'}</td></tr>
        </tbody>
      </table>
      <div><h3>Optical channels <span className="small muted">(inventory placeholder, not modelled)</span></h3>
        <div className="small">{d.opticalChannels.map((c: any) => `#${c.channel_no} ${c.frequency_thz} THz ${bw(c.capacity_mbps)}`).join(' · ')}</div></div>
      <div><h3>Services on this span</h3>
        {d.services.length ? d.services.map((x: any) => <div key={x.id + x.role}><Link to={`/services/${x.id}`}>{x.name}</Link> <Badge v={x.role} /> <Badge v={x.status} /></div>) : <div className="small muted">None</div>}</div>
      {d.alarms.length ? <div><h3>Recent alarms</h3>{d.alarms.slice(0, 5).map((a: any) => <div key={a.id} className="small"><Badge v={a.severity} /> {a.type} <Badge v={a.state} /></div>)}</div> : null}
    </div>
  );
}

function NodePanel({ d }: { d: any }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between"><h2 style={{ margin: 0 }}>{d.node.name}</h2><Badge v={d.node.oper_status} /></div>
      <div className="small muted">{d.node.pop_name} · {d.node.pop_kind} · location {d.node.location_id}</div>
      <h3>Equipment</h3>
      {d.equipment.map((e: any) => <div key={e.id} className="small">{e.model} · vendor {e.vendor} · {e.kind}</div>)}
      <h3>Ports</h3>
      <table><tbody>{d.ports.map((p: any) => <tr key={p.id}><td className="mono">{p.id}</td><td>{bw(p.speed_mbps)}</td><td><Badge v={p.oper_status} /></td></tr>)}</tbody></table>
    </div>
  );
}
