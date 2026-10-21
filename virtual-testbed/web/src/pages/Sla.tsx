import { Link } from 'react-router-dom';
import { bw, get, ms, pct } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, Bar, Empty, ErrorBox, Kpi, Loading, PageHead, SimBadge, useApi } from '../components/ui';

export function SlaPage() {
  const { user } = useAuth();
  const ov = useApi(() => get('/api/noc/overview'), [], 4000);
  const sla = useApi(() => get('/api/sla/summary'), [], 4000);
  const topo = useApi(() => (hasRole(user, 'ADMIN', 'NOC', 'AUDITOR', 'PROVIDER') ? get('/api/topology') : Promise.resolve(null)), [], 8000);
  const o = ov.data;
  return (
    <div className="stack">
      <PageHead title="SLA & Monitoring" sub="NOC view of service health. Metrics are synthetic and SLA values are DEMO targets, not commercial commitments."><SimBadge /></PageHead>
      <ErrorBox error={ov.error ?? sla.error} />
      {o ? (
        <div className="kpis">
          <Kpi label="Service inventory" value={o.services.total} sub={`${o.services.active} active · ${o.services.provisioning} provisioning`} />
          <Kpi label="UP / DEGRADED / DOWN" value={`${o.services.up} / ${o.services.degraded} / ${o.services.down}`} tone={o.services.down ? 'bad' : o.services.degraded ? 'warn' : 'ok'} />
          <Kpi label="SLA compliant" value={`${o.sla.compliant}/${o.sla.measured}`} sub={`${o.sla.openBreaches} open breaches`} />
          <Kpi label="Active alarms" value={o.alarms.active} tone={o.alarms.active ? 'warn' : undefined} />
          <Kpi label="Customers impacted" value={o.incidents.customersImpacted} sub={`${o.incidents.open} open incidents`} tone={o.incidents.customersImpacted ? 'bad' : undefined} />
          <Kpi label="Sim clock" value={`t=${o.sim.tick}`} sub={`${o.sim.tickSeconds}s per tick · auto ${o.sim.autoTick ? 'on' : 'off'}`} />
        </div>
      ) : <Loading />}
      <div className="card table-wrap">
        <h2>Per-service SLA</h2>
        {!sla.data ? <Loading /> : !sla.data.length ? <Empty>No activated services yet.</Empty> : (
          <table>
            <thead><tr><th>Service</th><th>Status</th><th>Path</th><th className="num">Availability</th><th className="num">Target</th><th className="num">Latency</th><th className="num">Jitter</th><th className="num">Loss</th><th className="num">Throughput</th><th>Breaches</th><th className="num">Outage (prov / maint / cust)</th></tr></thead>
            <tbody>{sla.data.map((s: any) => (
              <tr key={s.serviceId}>
                <td><Link to={`/services/${s.serviceId}`}>{s.name}</Link><div className="small muted">{s.customer} · {s.slaName}</div></td>
                <td><Badge v={s.operStatus} /></td>
                <td>{s.activePath ? <Badge v={s.activePath} /> : '—'}</td>
                <td className="num">{s.availabilityPct === null ? '—' : `${s.availabilityPct.toFixed(3)} %`} {s.met === false ? <Badge v="MISS" tone="bad" /> : null}</td>
                <td className="num">{s.targetPct} %</td>
                <td className="num">{ms(s.last?.latency_ms)}</td>
                <td className="num">{ms(s.last?.jitter_ms, 3)}</td>
                <td className="num">{pct(s.last?.loss_pct, 4)}</td>
                <td className="num">{s.last ? bw(Math.round(s.last.throughput_mbps)) : '—'}</td>
                <td>{s.breaches.filter((b: any) => b.open).map((b: any) => <Badge key={b.id} v={b.metric} tone="bad" />)}{!s.breaches.some((b: any) => b.open) ? <span className="small muted">{s.breaches.length} closed</span> : null}</td>
                <td className="num small">{s.providerOutageSeconds}s / {s.maintenanceSeconds}s / {s.customerSideSeconds}s</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {topo.data ? (
        <div className="grid g2">
          <div className="card">
            <h2>Link utilisation (top 12)</h2>
            <table><tbody>{[...topo.data.segments].filter((s: any) => s.utilisation !== null).sort((a: any, b: any) => b.utilisation - a.utilisation).slice(0, 12).map((s: any) => (
              <tr key={s.id}><td className="mono small">{s.id}</td><td style={{ width: '45%' }}><Bar value={s.utilisation} /></td><td className="num small">{(s.utilisation * 100).toFixed(1)} %</td><td><Badge v={s.operStatus} /></td></tr>
            ))}</tbody></table>
          </div>
          <div className="card">
            <h2>Provider impact (open incidents)</h2>
            {o?.incidents.providerImpact.length ? <table><tbody>{o.incidents.providerImpact.map((p: any) => <tr key={p.providerId}><td>{topo.data.providers.find((x: any) => x.id === p.providerId)?.name ?? p.providerId}</td><td className="num">{p.incidents} incident(s)</td></tr>)}</tbody></table> : <Empty>No provider impacted.</Empty>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
