import { Link } from 'react-router-dom';
import { bw, dt, get, idr } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, ErrorBox, Kpi, Loading, PageHead, SimBadge, useApi } from '../components/ui';
import { TopologyMap } from '../components/TopologyMap';

const WALKTHROUGH: Record<string, string[]> = {
  CUSTOMER: [
    'Marketplace → pick A/B endpoints, bandwidth, SLA, protection → Search routes',
    'Compare candidate routes and providers → Request quote → Accept quote',
    'Pay (simulated) → watch the order timeline move through provider acceptance, reservation, provisioning and testing',
    'Services → open the active service to see its path, activation tests and SLA charts',
  ],
  NOC: [
    'Network Topology → inspect segments, capacity and provider ownership',
    'Simulation Lab → run "Fiber cut" or "Primary route failure with protection" and advance ticks',
    'Alarms & Incidents → follow the incident timeline (protection switch / reroute / restoration)',
    'SLA & Monitoring → breaches, availability and outage classification',
  ],
  PROVIDER: [
    'Cable Owners → review sub-orders for your segments and accept/reject them',
    'Adjust DEMO wholesale prices or toggle auto-accept',
    'Revenue & Settlement → see only your allocations',
  ],
};

export function OverviewPage() {
  const { user } = useAuth();
  const assurance = hasRole(user, 'ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'CUSTOMER');
  const topoRole = hasRole(user, 'ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'COMMERCIAL');
  const ov = useApi(() => (assurance ? get('/api/noc/overview') : Promise.resolve(null)), [], 5000);
  const topo = useApi(() => (topoRole ? get('/api/topology') : Promise.resolve(null)), [], 8000);
  const orders = useApi(() => get('/api/orders'), [], 8000);
  const settle = useApi(() => (hasRole(user, 'ADMIN', 'COMMERCIAL', 'AUDITOR') ? get('/api/settlement/summary') : Promise.resolve(null)), []);
  const o = ov.data;
  const walkthrough = WALKTHROUGH[user.role] ?? WALKTHROUGH.NOC;
  return (
    <div className="stack">
      <PageHead title="Overview" sub={<>Global service and network status <SimBadge /></>}>
        {o ? <span className="small muted">Sim tick {o.sim.tick} · {dt(o.sim.simTime)} (sim clock) · seed {o.sim.seed}</span> : null}
      </PageHead>
      <ErrorBox error={ov.error} />
      {o ? (
        <div className="kpis">
          <Kpi label="Active services" value={o.services.active} sub={`${o.services.provisioning} in provisioning`} />
          <Kpi label="Services UP" value={o.services.up} tone="ok" sub={`${o.services.degraded} degraded`} />
          <Kpi label="Services DOWN" value={o.services.down} tone={o.services.down ? 'bad' : undefined} sub={`${o.services.onProtection} on protection/reroute`} />
          <Kpi label="SLA compliant" value={`${o.sla.compliant}/${o.sla.measured}`} sub={`${o.sla.openBreaches} open breaches`} tone={o.sla.openBreaches ? 'warn' : undefined} />
          <Kpi label="Active alarms" value={o.alarms.active} tone={o.alarms.bySeverity[0].n ? 'bad' : undefined} sub={o.alarms.bySeverity.filter((s: any) => s.n).map((s: any) => `${s.n} ${s.severity.toLowerCase()}`).join(' · ') || 'none'} />
          <Kpi label="Open incidents" value={o.incidents.open} tone={o.incidents.open ? 'warn' : undefined} sub={`${o.incidents.customersImpacted} customers impacted`} />
          {o.network.capacityMbps !== null ? <Kpi label="Network utilisation" value={`${(o.network.utilisation * 100).toFixed(1)} %`} sub={`${bw(o.network.reservedMbps)} of ${bw(o.network.capacityMbps)}`} /> : null}
          <Kpi label="Segments down / degraded" value={`${o.network.segmentsDown} / ${o.network.segmentsDegraded}`} tone={o.network.segmentsDown ? 'bad' : undefined} sub={`${o.network.segments} spans modelled`} />
        </div>
      ) : assurance ? <Loading /> : null}

      {settle.data ? (
        <div className="kpis">
          <Kpi label="Monthly customer charges" value={idr(settle.data.monthlyRecurring.customerCharges)} sub="SIMULATED ledger" />
          <Kpi label="Provider allocations" value={idr(settle.data.monthlyRecurring.providerAllocations)} />
          <Kpi label="Platform fees" value={idr(settle.data.monthlyRecurring.platformFees)} sub={`${settle.data.feeConfig.rate * 100}% ${settle.data.feeConfig.basis} — DEMO basis`} />
          <Kpi label="Ledger balanced" value={settle.data.balanced ? 'Yes' : 'No'} tone={settle.data.balanced ? 'ok' : 'bad'} />
        </div>
      ) : null}

      <div className="grid g3" style={{ gridTemplateColumns: topo.data ? '2fr 1fr' : '1fr 1fr' }}>
        {topo.data ? (
          <div className="card">
            <div className="row between"><h2>Network</h2><Link to="/topology">Open topology →</Link></div>
            <TopologyMap topo={topo.data} />
          </div>
        ) : null}
        <div className="stack">
          <div className="card">
            <h2>Demo walkthrough</h2>
            <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
              {walkthrough.map((w) => <li key={w} style={{ marginBottom: 6 }}>{w}</li>)}
            </ol>
          </div>
          <div className="card">
            <div className="row between"><h2>Recent orders</h2><Link to="/orders">All →</Link></div>
            {orders.data?.length ? (
              <table>
                <tbody>
                  {orders.data.slice(0, 6).map((r: any) => (
                    <tr key={r.id}>
                      <td><Link to={`/orders/${r.id}`} className="mono">{r.id}</Link><div className="small muted">{r.a_location_id.toUpperCase()} ⇄ {r.b_location_id.toUpperCase()} · {bw(r.bandwidth_mbps)}</div></td>
                      <td><Badge v={r.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="muted small">No orders yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
