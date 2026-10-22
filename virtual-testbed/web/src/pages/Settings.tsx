import { useState } from 'react';
import { api, get } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, ErrorBox, Loading, PageHead, SimBadge, Tabs, useAction, useApi } from '../components/ui';

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, 'ADMIN');
  const [tab, setTab] = useState('Platform');
  const settings = useApi(() => get('/api/settings'), []);
  const slas = useApi(() => get('/api/sla-profiles'), []);
  const integ = useApi(() => (hasRole(user, 'ADMIN', 'NOC', 'AUDITOR', 'COMMERCIAL') ? get('/api/integrations') : Promise.resolve(null)), []);
  const users = useApi(() => (hasRole(user, 'ADMIN', 'AUDITOR') ? get('/api/users') : Promise.resolve(null)), []);
  const act = useAction();
  const [fee, setFee] = useState<{ rate: string; basis: string } | null>(null);
  const [edit, setEdit] = useState<Record<string, any>>({});

  const saveFee = () => act.run(async () => {
    const cur = settings.data.platform_fee;
    await api('PUT', '/api/settings/platform_fee', { value: { ...cur, rate: Number(fee!.rate), basis: fee!.basis } });
    setFee(null);
    settings.reload();
  });
  const saveNum = (key: string, v: unknown) => act.run(async () => { await api('PUT', `/api/settings/${key}`, { value: v }); settings.reload(); });
  const saveSla = (id: string) => act.run(async () => { await api('PUT', `/api/sla-profiles/${id}`, edit[id]); setEdit({ ...edit, [id]: undefined }); slas.reload(); });

  return (
    <div className="stack">
      <PageHead title="Settings" sub={isAdmin ? 'Platform configuration (DEMO values)' : 'Read-only for your role'}><SimBadge /></PageHead>
      <ErrorBox error={act.error} />
      <Tabs tabs={['Platform', 'SLA profiles', 'Integrations', 'Users']} value={tab} onChange={setTab} />
      {tab === 'Platform' ? (!settings.data ? <Loading /> : (
        <div className="grid g2">
          <div className="card stack">
            <h2>Platform fee</h2>
            <div>Rate <strong>{settings.data.platform_fee.rate * 100}%</strong> on <strong>{settings.data.platform_fee.basis}</strong></div>
            <div className="small muted">{settings.data.platform_fee.note}</div>
            {isAdmin ? (fee ? (
              <div className="row">
                <input type="number" step="0.01" min={0} max={0.49} value={fee.rate} onChange={(e) => setFee({ ...fee, rate: e.target.value })} style={{ width: 90 }} />
                <select value={fee.basis} onChange={(e) => setFee({ ...fee, basis: e.target.value })}><option>GROSS</option><option>WHOLESALE</option></select>
                <button className="primary sm" onClick={saveFee} disabled={act.busy}>Save</button><button className="sm" onClick={() => setFee(null)}>Cancel</button>
              </div>
            ) : <div><button className="sm" onClick={() => setFee({ rate: String(settings.data.platform_fee.rate), basis: settings.data.platform_fee.basis })}>Edit</button></div>) : null}
            <div className="small muted">Changes apply to new quotes only; existing quotes keep their priced breakdown.</div>
          </div>
          <div className="card">
            <h2>Timeouts & simulation parameters</h2>
            <table><tbody>
              {['quote_validity_hours', 'payment_timeout_minutes', 'provider_acceptance_timeout_minutes', 'hold_ttl_minutes', 'provisioning_delay_s_per_node', 'reroute_ticks', 'protection_switch_ms', 'node_processing_ms'].map((k) => (
                <tr key={k}><td className="mono small">{k}</td><td className="num">
                  {isAdmin ? <input type="number" defaultValue={settings.data[k]} style={{ width: 100 }} onBlur={(e) => Number(e.target.value) !== settings.data[k] && saveNum(k, Number(e.target.value))} /> : settings.data[k]}
                </td></tr>
              ))}
              <tr><td className="mono small">protection_revertive</td><td className="num">{isAdmin ? <input type="checkbox" checked={settings.data.protection_revertive} onChange={(e) => saveNum('protection_revertive', e.target.checked)} /> : String(settings.data.protection_revertive)}</td></tr>
              <tr><td className="mono small">tax</td><td className="num small">{settings.data.tax.rate * 100}% {settings.data.tax.label} — {settings.data.tax.note}</td></tr>
              <tr><td className="mono small">currency</td><td className="num">{settings.data.currency}</td></tr>
            </tbody></table>
          </div>
        </div>
      )) : null}

      {tab === 'SLA profiles' ? (!slas.data ? <Loading /> : (
        <div className="card table-wrap">
          <div className="alert warn" style={{ marginBottom: 10 }}>DEMO SLA profiles — not commercial commitments.</div>
          <table>
            <thead><tr><th>Profile</th><th className="num">Latency ms (one-way)</th><th className="num">Jitter ms</th><th className="num">Loss %</th><th className="num">Availability %</th>{isAdmin ? <th></th> : null}</tr></thead>
            <tbody>{slas.data.map((s: any) => {
              const e = edit[s.id];
              const cell = (k: string, v: number) => e ? <input type="number" step="any" value={e[k]} onChange={(ev) => setEdit({ ...edit, [s.id]: { ...e, [k]: Number(ev.target.value) } })} style={{ width: 90 }} /> : v;
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="num">{cell('latencyMs', s.latency_ms)}</td>
                  <td className="num">{cell('jitterMs', s.jitter_ms)}</td>
                  <td className="num">{cell('lossPct', s.loss_pct)}</td>
                  <td className="num">{cell('availabilityPct', s.availability_pct)}</td>
                  {isAdmin ? <td>{e ? <><button className="sm primary" onClick={() => saveSla(s.id)}>Save</button> <button className="sm" onClick={() => setEdit({ ...edit, [s.id]: undefined })}>Cancel</button></> : <button className="sm" onClick={() => setEdit({ ...edit, [s.id]: { latencyMs: s.latency_ms, jitterMs: s.jitter_ms, lossPct: s.loss_pct, availabilityPct: s.availability_pct } })}>Edit</button>}</td> : null}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )) : null}

      {tab === 'Integrations' ? (!integ.data ? <Loading /> : (
        <div className="grid g2">
          <div className="card stack">
            <h2>Network simulators</h2>
            {integ.data.simulators.map((s: any) => (
              <div key={s.mode}><Badge v={s.label} tone={s.available ? 'warn' : 'neutral'} /> <strong>{s.name}</strong><div className="small muted">{s.detail}</div></div>
            ))}
            <div className="small"><Badge v="EGRESS" tone="accent" /> {integ.data.egressGuard}</div>
          </div>
          <div className="card stack">
            <h2>MEF/Mplify LSO Sonata</h2>
            <div><Badge v={integ.data.sonata.mode} tone="warn" /> <Badge v={integ.data.sonata.connection} tone="neutral" /></div>
            <table><tbody>{Object.entries(integ.data.sonata).filter(([k]) => !['mode', 'connection'].includes(k)).map(([k, v]) => <tr key={k}><td className="small muted">{k}</td><td className="small">{String(v)}</td></tr>)}</tbody></table>
            <div className="small muted">Sonata is a business order API between operators; it does not configure optical or packet equipment.</div>
            <h3>Payment & billing</h3>
            <div className="small"><Badge v={integ.data.payment.mode} tone="warn" /> {integ.data.payment.connection} — {integ.data.payment.note}</div>
            <div className="small"><Badge v={integ.data.billing.mode} tone="warn" /> {integ.data.billing.connection}</div>
          </div>
        </div>
      )) : null}

      {tab === 'Users' ? (users.data ? (
        <div className="card table-wrap"><table>
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Organisation</th><th>Active</th></tr></thead>
          <tbody>{users.data.map((u: any) => <tr key={u.id}><td className="mono small">{u.email}</td><td>{u.display_name}</td><td><Badge v={u.role} tone="accent" /></td><td className="mono small">{u.org_id}</td><td>{u.active ? 'yes' : 'no'}</td></tr>)}</tbody>
        </table><div className="small muted" style={{ marginTop: 8 }}>All demo users share the operator-configured DEMO_PASSWORD. No production identities.</div></div>
      ) : <div className="alert info">User list is visible to Admin and Auditor roles.</div>) : null}
    </div>
  );
}
