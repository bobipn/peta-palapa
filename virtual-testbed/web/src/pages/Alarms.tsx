import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dt, get, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Empty, ErrorBox, Loading, PageHead, SimBadge, Tabs, Timeline, useAction, useApi } from '../components/ui';

export function AlarmsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Active alarms');
  const alarms = useApi(() => get(`/api/alarms${tab === 'Active alarms' ? '?state=ACTIVE' : ''}`), [tab], 3000);
  const incidents = useApi(() => get('/api/incidents'), [], 3000);
  const act = useAction();
  const ack = (id: string) => act.run(async () => { await post(`/api/alarms/${id}/ack`); alarms.reload(); });
  return (
    <div className="stack">
      <PageHead title="Alarms & Incidents" sub="Alarms are reconciled from the simulated fault state; incidents group correlated faults and their customer impact."><SimBadge /></PageHead>
      <ErrorBox error={alarms.error ?? act.error} />
      <div className="card">
        <h2>Incidents</h2>
        {!incidents.data ? <Loading /> : !incidents.data.length ? <Empty>No incidents. Inject a fault in the Simulation Lab.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Incident</th><th>Severity</th><th>State</th><th>Opened / mitigated / resolved (tick)</th><th className="num">Services</th><th className="num">Customers</th><th>Providers</th></tr></thead>
            <tbody>{incidents.data.map((i: any) => (
              <tr key={i.id}>
                <td><Link to={`/incidents/${i.id}`}>{i.title}</Link><div className="small mono muted">{i.id}</div></td>
                <td><Badge v={i.severity} /></td>
                <td><Badge v={i.state} /></td>
                <td className="small">{i.opened_tick} / {i.mitigated_tick ?? '—'} / {i.resolved_tick ?? '—'}</td>
                <td className="num">{i.impacted_services.length}</td>
                <td className="num">{i.impacted_customers.length}</td>
                <td className="small">{i.impacted_providers.join(', ')}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <Tabs tabs={['Active alarms', 'All alarms']} value={tab} onChange={setTab} />
        {!alarms.data ? <Loading /> : !alarms.data.length ? <Empty>No alarms.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Severity</th><th>Type</th><th>Entity</th><th>Message</th><th>State</th><th>Raised / cleared (tick)</th><th>Incident</th>{hasRole(user, 'ADMIN', 'NOC') ? <th>Ack</th> : null}</tr></thead>
            <tbody>{alarms.data.map((a: any) => (
              <tr key={a.id}>
                <td><Badge v={a.severity} /></td>
                <td className="mono small">{a.type}</td>
                <td className="small">{a.entity_type}<div className="mono">{a.entity_type === 'SERVICE' ? <Link to={`/services/${a.entity_id}`}>{a.entity_id}</Link> : a.entity_id}</div></td>
                <td className="small">{a.message}</td>
                <td><Badge v={a.state} />{a.acknowledged ? <Badge v="ACK" tone="neutral" /> : null}</td>
                <td className="small">{a.raised_tick} / {a.cleared_tick ?? '—'}</td>
                <td>{a.incident_id ? <Link className="mono small" to={`/incidents/${a.incident_id}`}>{a.incident_id}</Link> : '—'}</td>
                {hasRole(user, 'ADMIN', 'NOC') ? <td>{a.state === 'ACTIVE' && !a.acknowledged ? <button className="sm" onClick={() => ack(a.id)} disabled={act.busy}>Ack</button> : null}</td> : null}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
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
