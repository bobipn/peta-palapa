import { Link } from 'react-router-dom';
import { dt, get, idr, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Empty, ErrorBox, Kpi, Loading, PageHead, SimBadge, useAction, useApi } from '../components/ui';

export function SettlementPage() {
  const { user } = useAuth();
  const sum = useApi(() => get('/api/settlement/summary'), [], 6000);
  const led = useApi(() => get('/api/settlement/ledger'), [], 6000);
  const act = useAction();
  const settle = (orderId: string) => act.run(async () => { await post(`/api/settlement/orders/${orderId}/settle`); led.reload(); sum.reload(); });
  if (sum.error) return <ErrorBox error={sum.error} />;
  if (!sum.data) return <Loading />;
  const s = sum.data;
  const pendingOrders = [...new Set((led.data ?? []).filter((l: any) => l.status === 'PENDING').map((l: any) => l.order_id))];
  return (
    <div className="stack">
      <PageHead title="Revenue & Settlement" sub="Simulated ledger. No invoice is issued and no money moves."><SimBadge /></PageHead>
      <div className="alert warn">
        Platform fee: <strong>{s.feeConfig.rate * 100}% on {s.feeConfig.basis}</strong> — DEMO configuration. {s.feeConfig.note}
      </div>
      <ErrorBox error={act.error} />
      <div className="kpis">
        {s.monthlyRecurring ? (
          <>
            <Kpi label="Customer charges / month" value={idr(s.monthlyRecurring.customerCharges)} />
            <Kpi label="Provider allocations / month" value={idr(s.monthlyRecurring.providerAllocations)} />
            <Kpi label="Platform fees / month" value={idr(s.monthlyRecurring.platformFees)} />
            <Kpi label="Ledger balanced" value={s.balanced ? 'Yes' : 'No'} tone={s.balanced ? 'ok' : 'bad'} sub="charges = allocations + fees" />
          </>
        ) : null}
        <Kpi label="Entries pending / settled" value={`${s.pending} / ${s.settled}`} />
      </div>
      <div className="card">
        <h2>Provider allocations</h2>
        {s.providerAllocations.length ? <table><tbody>{s.providerAllocations.map((p: any) => <tr key={p.providerId}><td>{p.providerName}</td><td className="num">{idr(p.amount)} / month</td></tr>)}</tbody></table> : <Empty>No active services yet.</Empty>}
      </div>
      <div className="card table-wrap">
        <div className="row between"><h2>Ledger</h2>{hasRole(user, 'ADMIN', 'COMMERCIAL') && pendingOrders.length ? <span className="small muted">{pendingOrders.length} order(s) pending settlement</span> : null}</div>
        {!led.data ? <Loading /> : !led.data.length ? <Empty>Ledger entries are created when a service is activated.</Empty> : (
          <table>
            <thead><tr><th>Order</th><th>Period</th><th>Entry</th><th>Party</th><th className="num">Amount</th><th>Status</th><th>Created</th>{hasRole(user, 'ADMIN', 'COMMERCIAL') ? <th></th> : null}</tr></thead>
            <tbody>{led.data.map((l: any, i: number) => (
              <tr key={l.id}>
                <td><Link className="mono small" to={`/orders/${l.order_id}`}>{l.order_id}</Link></td>
                <td className="small">{l.period}</td>
                <td className="mono small">{l.entry_type}</td>
                <td className="small">{l.party_type}{l.party_id ? <div className="mono muted">{l.party_id}</div> : null}</td>
                <td className="num">{idr(l.amount)}</td>
                <td><Badge v={l.status} /></td>
                <td className="small">{dt(l.created_at)}</td>
                {hasRole(user, 'ADMIN', 'COMMERCIAL') ? <td>{l.status === 'PENDING' && led.data.findIndex((x: any) => x.order_id === l.order_id) === i ? <button className="sm" onClick={() => settle(l.order_id)} disabled={act.busy}>Mark settled (sim)</button> : null}</td> : null}
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
