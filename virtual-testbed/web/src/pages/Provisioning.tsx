import { Link, useParams } from 'react-router-dom';
import { dt, get } from '../api';
import { Badge, Bar, Empty, ErrorBox, Loading, PageHead, SimBadge, Timeline, useApi } from '../components/ui';
import { TaskTable } from './Orders';

export function ProvisioningPage() {
  const w = useApi(() => get('/api/provisioning/workflows'), [], 3000);
  return (
    <div className="stack">
      <PageHead title="Provisioning" sub="Orchestration workflows: persisted tasks with attempts, idempotency keys, timeouts and compensation"><SimBadge /></PageHead>
      <ErrorBox error={w.error} />
      <div className="card table-wrap">
        {!w.data ? <Loading /> : !w.data.length ? <Empty>No workflows yet. One starts when a customer pays for an order.</Empty> : (
          <table>
            <thead><tr><th>Workflow</th><th>Service</th><th>Order</th><th>State</th><th>Current task</th><th style={{ width: 160 }}>Progress</th><th>Failure</th><th>Updated</th></tr></thead>
            <tbody>{w.data.map((x: any) => (
              <tr key={x.id}>
                <td><Link className="mono" to={`/provisioning/${x.id}`}>{x.id}</Link></td>
                <td className="small">{x.service_name}</td>
                <td><Link className="mono small" to={`/orders/${x.order_id}`}>{x.order_id}</Link> <Badge v={x.order_state} /></td>
                <td><Badge v={x.state} /></td>
                <td className="mono small">{x.current_task ?? '—'}</td>
                <td><Bar value={x.done_tasks} max={x.total_tasks} /><div className="small muted">{x.done_tasks}/{x.total_tasks} tasks</div></td>
                <td className="small" style={{ color: 'var(--bad)' }}>{x.failure_reason ?? ''}</td>
                <td className="small">{dt(x.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function WorkflowDetailPage() {
  const { id } = useParams();
  const d = useApi(() => get(`/api/provisioning/workflows/${id}`), [id], 2500);
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const { workflow: w, tasks, events } = d.data;
  return (
    <div className="stack">
      <PageHead title={`Workflow ${w.id}`} sub={<>Order <Link className="mono" to={`/orders/${w.order_id}`}>{w.order_id}</Link> · correlation <span className="mono">{w.correlation_id}</span></>}>
        <Badge v={w.state} />
      </PageHead>
      {w.failure_reason ? <div className="alert err">Failure: {w.failure_reason} → outcome {w.outcome}</div> : null}
      <div className="card"><h2>Tasks</h2><TaskTable tasks={tasks} /></div>
      <div className="card">
        <h2>Idempotency keys</h2>
        <div className="small mono">{tasks.map((t: any) => <div key={t.id}>{t.idempotency_key}</div>)}</div>
      </div>
      <div className="card"><h2>Workflow events</h2>
        <Timeline items={[...events].reverse().map((e: any) => ({ key: e.id, tone: /FAIL|COMPENSATION/.test(e.type) ? 'bad' : /RETRY/.test(e.type) ? 'warn' : /COMPLETED|DONE/.test(e.type) ? 'ok' : undefined, title: <><strong>{e.type}</strong> <span className="mono small muted">{JSON.stringify(e.payload).slice(0, 160)}</span></>, meta: dt(e.occurred_at) }))} />
      </div>
    </div>
  );
}
