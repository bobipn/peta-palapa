import { useState } from 'react';
import { dt, get } from '../api';
import { Badge, ErrorBox, Loading, PageHead, Tabs, useApi } from '../components/ui';

export function AuditPage() {
  const [tab, setTab] = useState('Audit trail');
  const [filter, setFilter] = useState('');
  const audit = useApi(() => get('/api/audit?limit=500'), [], 6000);
  const events = useApi(() => get('/api/events?limit=500'), [], 6000);
  const f = filter.toLowerCase();
  const match = (o: any) => !f || JSON.stringify(o).toLowerCase().includes(f);
  return (
    <div className="stack">
      <PageHead title="Audit Logs" sub="Who did what (audit trail) and what happened (domain event log). Secrets and passwords are never logged." />
      <div className="card">
        <div className="row between">
          <Tabs tabs={['Audit trail', 'Domain events']} value={tab} onChange={setTab} />
          <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {tab === 'Audit trail' ? (
          audit.error ? <ErrorBox error={audit.error} /> : !audit.data ? <Loading /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Outcome</th><th>Details</th><th>Request</th></tr></thead>
              <tbody>{audit.data.filter(match).map((a: any) => (
                <tr key={a.id}>
                  <td className="small nowrap">{dt(a.occurred_at)}</td>
                  <td className="small">{a.actor_id}<div className="muted">{a.actor_role}</div></td>
                  <td className="mono small">{a.action}</td>
                  <td className="small">{a.entity_type}<div className="mono">{a.entity_id}</div></td>
                  <td><Badge v={a.outcome} tone={a.outcome === 'ALLOWED' ? 'ok' : 'bad'} /></td>
                  <td className="mono small">{JSON.stringify(a.details).slice(0, 120)}</td>
                  <td className="mono small muted">{String(a.request_id).slice(0, 10)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )
        ) : events.error ? <ErrorBox error={events.error} /> : !events.data ? <Loading /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Time</th><th>Aggregate</th><th>Event</th><th>Payload</th><th>Sim tick</th><th>Actor</th></tr></thead>
            <tbody>{events.data.filter(match).map((e: any) => (
              <tr key={e.id}>
                <td className="small">{e.id}</td>
                <td className="small nowrap">{dt(e.occurred_at)}</td>
                <td className="small">{e.aggregate_type}<div className="mono">{e.aggregate_id}</div></td>
                <td className="mono small">{e.type}</td>
                <td className="mono small">{JSON.stringify(e.payload).slice(0, 140)}</td>
                <td className="small">{e.sim_tick ?? '—'}</td>
                <td className="small">{e.actor_id}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
