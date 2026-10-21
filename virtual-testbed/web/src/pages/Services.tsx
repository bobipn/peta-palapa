import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bw, dt, get, ms, pct, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Empty, ErrorBox, Kpi, LineChart, Loading, PageHead, PathChain, SimBadge, Tabs, Timeline, useAction, useApi } from '../components/ui';
import { TopologyMap } from '../components/TopologyMap';

export function ServicesPage() {
  const s = useApi(() => get('/api/services'), [], 4000);
  return (
    <div className="stack">
      <PageHead title="Services" sub="Network service inventory (service state is separate from order state)"><SimBadge /></PageHead>
      <ErrorBox error={s.error} />
      <div className="card table-wrap">
        {!s.data ? <Loading /> : !s.data.length ? <Empty>No services yet.</Empty> : (
          <table>
            <thead><tr><th>Service</th><th>Customer</th><th>State</th><th>Operational</th><th>Active path</th><th>SLA profile</th><th className="num">Bandwidth</th></tr></thead>
            <tbody>
              {s.data.map((x: any) => (
                <tr key={x.id}>
                  <td><Link to={`/services/${x.id}`}>{x.name}</Link><div className="small mono muted">{x.id}</div></td>
                  <td className="small">{x.customer_name}</td>
                  <td><Badge v={x.state} /></td>
                  <td><Badge v={x.oper_status} />{x.reroute_ready_tick !== null ? <div className="small muted">reroute ready @ tick {x.reroute_ready_tick}</div> : null}</td>
                  <td>{x.active_path ? <Badge v={x.active_path} /> : '—'}</td>
                  <td className="small">{x.sla_name}</td>
                  <td className="num">{bw(x.bandwidth_mbps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ServiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const d = useApi(() => get(`/api/services/${id}`), [id], 4000);
  const tel = useApi(() => get(`/api/services/${id}/telemetry`), [id], 4000);
  const topo = useApi(() => (hasRole(user, 'ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'COMMERCIAL') ? get('/api/topology') : Promise.resolve(null)), [], 8000);
  const [tab, setTab] = useState('Monitoring');
  const act = useAction();
  const highlight = useMemo(() => {
    if (!d.data) return undefined;
    const p = (role: string) => d.data.paths.find((x: any) => x.role === role && x.status !== 'RELEASED')?.segment_ids ?? [];
    return { primary: p('PRIMARY'), protection: p('PROTECTION'), reroute: p('REROUTE'), active: d.data.service.active_path };
  }, [d.data]);
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const { service: s, paths, tests, events, alarms, sla } = d.data;
  const samples = tel.data?.samples ?? [];
  const lastRun = tests[0]?.run_id;
  const runTests = () => act.run(async () => { await post(`/api/services/${id}/tests`); d.reload(); });
  const terminate = () => act.run(async () => { if (confirm('Terminate this simulated service and release its capacity?')) { await post(`/api/services/${id}/terminate`); d.reload(); } });

  return (
    <div className="stack">
      <PageHead title={s.name} sub={<><span className="mono">{s.id}</span> · order <Link className="mono" to={`/orders/${s.order_id}`}>{s.order_id}</Link> <SimBadge /></>}>
        {hasRole(user, 'ADMIN', 'NOC') && s.sim_handle ? <button onClick={runTests} disabled={act.busy}>Run validation suite</button> : null}
        {hasRole(user, 'CUSTOMER', 'ADMIN') && s.state === 'ACTIVE' ? <button className="danger" onClick={terminate} disabled={act.busy}>Terminate</button> : null}
      </PageHead>
      <ErrorBox error={act.error} />
      <div className="kpis">
        <Kpi label="Service state" value={<Badge v={s.state} />} sub={`activated ${dt(s.activated_at)}`} />
        <Kpi label="Operational" value={<Badge v={s.oper_status} />} sub={s.active_path ? `on ${s.active_path.toLowerCase()} path` : undefined} />
        <Kpi label="Availability (sim window)" value={sla.availabilityPct === null ? '—' : `${sla.availabilityPct.toFixed(3)} %`} tone={sla.met === false ? 'bad' : sla.met ? 'ok' : undefined} sub={`target ${s.sla_availability_pct} % (DEMO)`} />
        <Kpi label="Open SLA breaches" value={sla.breaches.filter((b: any) => b.open).length} tone={sla.breaches.some((b: any) => b.open) ? 'warn' : undefined} sub={`${sla.breaches.length} total`} />
        <Kpi label="Last latency" value={ms(samples.at(-1)?.latency_ms)} sub={`target ≤ ${s.sla_latency_ms} ms one-way`} />
        <Kpi label="Last loss" value={pct(samples.at(-1)?.loss_pct, 4)} sub={`target ≤ ${s.sla_loss_pct} %`} />
      </div>

      <Tabs tabs={['Monitoring', 'Path', 'Activation tests', 'Events & alarms']} value={tab} onChange={setTab} />

      {tab === 'Monitoring' ? (
        <div className="stack">
          <div className="grid g2">
            <div className="card"><h3>One-way latency (ms)</h3><LineChart label="latency" unit="ms" threshold={s.sla_latency_ms} points={samples.map((x: any) => ({ x: x.tick, y: x.latency_ms }))} /></div>
            <div className="card"><h3>Packet loss (%)</h3><LineChart label="loss" unit="%" threshold={s.sla_loss_pct} points={samples.map((x: any) => ({ x: x.tick, y: x.loss_pct }))} /></div>
            <div className="card"><h3>Jitter (ms)</h3><LineChart label="jitter" unit="ms" threshold={s.sla_jitter_ms} points={samples.map((x: any) => ({ x: x.tick, y: x.jitter_ms }))} /></div>
            <div className="card"><h3>Throughput (Mbps, synthetic demand)</h3><LineChart label="throughput" unit="Mbps" threshold={s.bandwidth_mbps} points={samples.map((x: any) => ({ x: x.tick, y: x.state === 'DOWN' ? null : x.throughput_mbps }))} /></div>
          </div>
          <div className="card">
            <h3>Availability accounting</h3>
            <table><tbody>
              <tr><td>Measured window</td><td>{Math.round(sla.measuredSeconds / 60)} min (sim) · no data {Math.round(sla.noDataSeconds / 60)} min (simulator downtime)</td></tr>
              <tr><td>Provider / network outage</td><td>{sla.providerOutageSeconds} s — counts against SLA</td></tr>
              <tr><td>Scheduled maintenance</td><td>{sla.maintenanceSeconds} s — excluded</td></tr>
              <tr><td>Customer-side outage</td><td>{sla.customerSideSeconds} s — excluded</td></tr>
              <tr><td>Degraded (performance breach)</td><td>{sla.degradedSeconds} s — available but out of SLA thresholds</td></tr>
            </tbody></table>
            <div className="small muted" style={{ marginTop: 6 }}>{sla.note} {s.sla_note}</div>
            {sla.breaches.length ? (
              <table style={{ marginTop: 10 }}>
                <thead><tr><th>Breach</th><th className="num">Threshold</th><th className="num">Peak</th><th>Ticks</th><th className="num">Duration</th></tr></thead>
                <tbody>{sla.breaches.map((b: any) => <tr key={b.id}><td><Badge v={b.metric} tone="warn" /> {b.open ? <Badge v="OPEN" /> : null}</td><td className="num">{b.threshold}</td><td className="num">{b.peak_value.toFixed(3)}</td><td>{b.started_tick} → {b.ended_tick ?? 'now'}</td><td className="num">{b.durationSeconds} s</td></tr>)}</tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'Path' ? (
        <div className="grid g2">
          <div className="card stack">
            {paths.map((p: any) => (
              <div key={p.id}>
                <div className="row"><Badge v={p.role} /> <Badge v={p.status} /> <span className="small muted">{ms(p.latency_ms)} · {Math.round(p.length_km)} km</span></div>
                <PathChain segments={p.segment_ids} />
              </div>
            ))}
          </div>
          <div className="card">{topo.data ? <TopologyMap topo={topo.data} highlight={highlight} /> : <div className="small muted">Map not available for your role; the path list shows the segments.</div>}</div>
        </div>
      ) : null}

      {tab === 'Activation tests' ? (
        <div className="card table-wrap">
          {!tests.length ? <Empty>Not run yet.</Empty> : (
            <table>
              <thead><tr><th>Run</th><th>Test</th><th>Result</th><th>Threshold</th><th>Observed</th><th>Reason</th><th>Executed</th></tr></thead>
              <tbody>{tests.map((t: any) => (
                <tr key={t.id} style={t.run_id === lastRun ? undefined : { opacity: 0.6 }}>
                  <td className="mono small">{t.run_id.slice(-8)}</td>
                  <td className="mono">{t.test_name}</td>
                  <td><Badge v={t.status} /> <Badge v="SIMULATED" tone="warn" /></td>
                  <td className="mono small">{t.threshold ? JSON.stringify(t.threshold) : '—'}</td>
                  <td className="mono small">{t.result ? JSON.stringify(t.result).slice(0, 120) : '—'}</td>
                  <td className="small">{t.reason}</td>
                  <td className="small">{dt(t.executed_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === 'Events & alarms' ? (
        <div className="grid g2">
          <div className="card"><h2>Service events</h2><Timeline items={events.map((e: any) => ({ key: e.id, tone: /DOWN|BREACH_STARTED/.test(e.type) ? 'bad' : /RESTORED|ENDED|ACTIVATED/.test(e.type) ? 'ok' : /SWITCH|REROUTE/.test(e.type) ? 'warn' : undefined, title: <><strong>{e.type.replace(/_/g, ' ')}</strong> <span className="muted">{e.payload?.message ?? ''}</span></>, meta: <>{e.sim_tick !== null ? `sim tick ${e.sim_tick} · ` : ''}{dt(e.occurred_at)}</> }))} /></div>
          <div className="card"><h2>Alarms</h2>{alarms.length ? <table><tbody>{alarms.map((a: any) => <tr key={a.id}><td><Badge v={a.severity} /></td><td className="mono small">{a.type}</td><td className="small">{a.message}</td><td><Badge v={a.state} /></td><td className="small">tick {a.raised_tick}{a.cleared_tick !== null ? `→${a.cleared_tick}` : ''}</td></tr>)}</tbody></table> : <Empty>No alarms.</Empty>}</div>
        </div>
      ) : null}
    </div>
  );
}
