import { Link, useParams } from 'react-router-dom';
import { bw, dt, get, idr, post } from '../api';
import { useAuth } from '../App';
import { ProvisioningLiveView } from '../components/ProvisioningLiveView';
import { Badge, Empty, ErrorBox, Loading, PageHead, PathChain, SimBadge, Timeline, useAction, useApi } from '../components/ui';

const FLOW = ['PENDING_PAYMENT', 'CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED', 'PROVISIONING', 'TESTING', 'ACTIVE'];
const CANCELLABLE = ['PENDING_PAYMENT', 'CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED'];

export function OrdersPage() {
  const orders = useApi(() => get('/api/orders'), [], 4000);
  return (
    <div className="stack">
      <PageHead title="Orders" sub="Business order lifecycle (separate from network service state)"><SimBadge /></PageHead>
      <ErrorBox error={orders.error} />
      <div className="card table-wrap">
        {!orders.data ? <Loading /> : !orders.data.length ? <Empty>No orders yet. Customers create them from the Marketplace.</Empty> : (
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Route</th><th className="num">Bandwidth</th><th className="num">Price / mo</th><th>State</th><th>Sonata (illustrative)</th><th>Created</th></tr></thead>
            <tbody>
              {orders.data.map((o: any) => (
                <tr key={o.id}>
                  <td><Link className="mono" to={`/orders/${o.id}`}>{o.id}</Link></td>
                  <td className="small">{o.customer_name}</td>
                  <td>{o.a_location_id.toUpperCase()} ⇄ {o.b_location_id.toUpperCase()} {o.protection === 'PROTECTED' ? <Badge v="1+1" tone="info" /> : null}</td>
                  <td className="num">{bw(o.bandwidth_mbps)}</td>
                  <td className="num">{idr(o.price_monthly)}</td>
                  <td><Badge v={o.state} /><div className="small muted">{o.state_label}</div></td>
                  <td className="small mono">{o.sonata.state}{o.sonata.verified ? '' : ' (unverified)'}</td>
                  <td className="small">{dt(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const d = useApi(() => get(`/api/orders/${id}`), [id], 2500);
  const act = useAction();
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const { order, quote, subOrders, events, service, workflow } = d.data;
  const failedAt = ['FAILED', 'REJECTED', 'CANCELLED'].includes(order.state)
    ? [...events].reverse().find((e: any) => e.type === 'ORDER_STATE_CHANGED' && e.payload.to === order.state)?.payload.from
    : null;
  const pay = () => act.run(async () => { await post(`/api/orders/${id}/pay`, {}, true); d.reload(); });
  const cancel = () => act.run(async () => { await post(`/api/orders/${id}/cancel`, { reason: 'Cancelled from UI' }); d.reload(); });

  return (
    <div className="stack">
      <PageHead title={`Order ${order.id}`} sub={<>{order.customer_name} · {bw(order.bandwidth_mbps)} · {order.protection === 'PROTECTED' ? '1+1 protected' : 'unprotected'} <SimBadge /></>}>
        {user.role === 'CUSTOMER' && order.state === 'PENDING_PAYMENT' ? <button className="primary" onClick={pay} disabled={act.busy}>Pay {idr(order.price_monthly + order.setup_fee)} (SIMULATED)</button> : null}
        {['CUSTOMER', 'ADMIN'].includes(user.role) && CANCELLABLE.includes(order.state) ? <button className="danger" onClick={cancel} disabled={act.busy}>Cancel order</button> : null}
        {service ? <Link className="btn" to={`/services/${service.id}`}>Service →</Link> : null}
      </PageHead>
      <ErrorBox error={act.error} />
      <div className="card stack">
        <div className="row between">
          <div><Badge v={order.state} /> <strong>{order.state_label}</strong>{order.state_reason ? <span className="muted"> — {order.state_reason}</span> : null}</div>
          <span className="small mono muted">Sonata state (illustrative): {order.sonata.state}{order.sonata.verified ? '' : ' — unverified mapping'}</span>
        </div>
        <div className="stepper">
          {FLOW.map((s, i) => {
            const cur = FLOW.indexOf(order.state);
            const fail = failedAt ? FLOW.indexOf(failedAt) : -1;
            const cls = fail >= 0
              ? (i < fail ? 'done' : i === fail ? 'fail' : '')
              : order.state === 'ACTIVE' || i < cur ? 'done' : i === cur ? 'current' : '';
            return <div key={s} className={`step ${cls}`}>{s.replace(/_/g, ' ')}</div>;
          })}
        </div>
        {order.state === 'PENDING_PAYMENT' && order.deadline_at ? <div className="small muted">Payment window closes {dt(order.deadline_at)} — the order is auto-cancelled after that.</div> : null}
        <div className="small muted">Payment: <Badge v={order.payment_status} /> {order.payment_ref ? <span className="mono">{order.payment_ref}</span> : null} — no real money moves.</div>
      </div>

      {service && order.state !== 'PENDING_PAYMENT' ? (
        <div className="card"><ProvisioningLiveView serviceId={service.id} /></div>
      ) : null}

      <div className="grid g2">
        <div className="card stack">
          <h2>Route & price</h2>
          <div><span className="small muted">Primary</span><PathChain segments={quote.route.primary.segmentIds} /></div>
          {quote.route.protection ? <div><span className="small muted">Protection</span><PathChain segments={quote.route.protection.segmentIds} /></div> : null}
          {quote.price_monthly !== undefined ? <div>{idr(quote.price_monthly)}/month · setup {idr(quote.setup_fee)} · term {quote.term_months} months</div> : null}
          <h3>Provider sub-orders</h3>
          {subOrders.length ? (
            <table>
              <thead><tr><th>Provider</th><th>Segments</th><th className="num">Wholesale</th><th>State</th></tr></thead>
              <tbody>{subOrders.map((s: any) => (
                <tr key={s.id}><td>{s.provider_name}</td><td className="mono small">{s.segment_ids.join(', ')}</td><td className="num">{idr(s.wholesale_monthly)}</td><td><Badge v={s.state} />{s.response_note ? <div className="small muted">{s.response_note}</div> : null}</td></tr>
              ))}</tbody>
            </table>
          ) : <div className="small muted">Created after payment.</div>}
        </div>
        <div className="card">
          <h2>Event history</h2>
          <Timeline items={[...events].reverse().map((e: any) => ({
            key: e.id,
            tone: /FAIL|REJECT|ROLLBACK|TIMED/.test(e.type + JSON.stringify(e.payload)) ? 'bad' : e.payload?.to === 'ACTIVE' ? 'ok' : undefined,
            title: <><strong>{e.type.replace(/_/g, ' ')}</strong>{e.payload?.to ? <> → <Badge v={e.payload.to} /></> : null}{e.payload?.reason ? <span className="muted"> {e.payload.reason}</span> : null}</>,
            meta: <>{dt(e.occurred_at)} · actor {e.actor_id} · corr <span className="mono">{String(e.correlation_id).slice(0, 12)}</span></>,
          }))} />
        </div>
      </div>

      {workflow?.tasks?.length ? (
        <div className="card">
          <div className="row between"><h2>Orchestration workflow</h2><Link to={`/provisioning/${workflow.id}`}>Details →</Link></div>
          <TaskTable tasks={workflow.tasks} />
        </div>
      ) : null}
    </div>
  );
}

export function TaskTable({ tasks }: { tasks: any[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Task</th><th>State</th><th className="num">Attempts</th><th>Started</th><th>Finished</th><th>Result / error</th></tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td className="small">{t.seq}</td>
              <td className="mono">{t.type}{t.is_compensation ? <> <Badge v="compensation" tone="warn" /></> : null}</td>
              <td><Badge v={t.state} /></td>
              <td className="num">{t.attempts}/{t.max_attempts}</td>
              <td className="small">{dt(t.started_at)}</td>
              <td className="small">{dt(t.finished_at)}</td>
              <td className="small">{t.error ? <span style={{ color: 'var(--bad)' }}>{t.error}</span> : t.result ? <span className="mono">{JSON.stringify(t.result).slice(0, 140)}</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
