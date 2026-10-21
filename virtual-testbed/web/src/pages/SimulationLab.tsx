import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dt, get, post } from '../api';
import { hasRole, useAuth } from '../App';
import { Badge, ErrorBox, Loading, PageHead, SimBadge, useAction, useApi } from '../components/ui';

export function SimulationLabPage() {
  const { user } = useAuth();
  const canControl = hasRole(user, 'ADMIN', 'NOC');
  const st = useApi(() => get('/api/simulation/state'), [], 2500);
  const scen = useApi(() => get('/api/simulation/scenarios'), []);
  const meta = useApi(() => get('/api/meta'), []);
  const topo = useApi(() => get('/api/topology'), []);
  const services = useApi(() => get('/api/services'), [], 10000);
  const act = useAction();
  const [lastRun, setLastRun] = useState<any>(null);
  const [fault, setFault] = useState({ type: 'FIBER_CUT', targetId: '', addMs: 30, addPct: 1 });

  const types: { type: string; targets: string[] }[] = meta.data?.faultTypes ?? [];
  const targetType = types.find((t) => t.type === fault.type)?.targets[0] ?? 'SEGMENT';
  const targets: { id: string; label: string }[] = !topo.data ? [] :
    targetType === 'SEGMENT' ? topo.data.segments.map((s: any) => ({ id: s.id, label: s.id })) :
    targetType === 'NODE' ? topo.data.nodes.map((n: any) => ({ id: n.id, label: n.name })) :
    targetType === 'PROVIDER' ? topo.data.providers.map((p: any) => ({ id: p.id, label: p.name })) :
    targetType === 'SERVICE' ? (services.data ?? []).filter((s: any) => s.state === 'ACTIVE').map((s: any) => ({ id: s.id, label: s.name })) :
    targetType === 'PORT' ? topo.data.segments.flatMap((s: any) => [s.aNodeId, s.bNodeId].map((n: string) => ({ id: `pt-${n.replace('nd-', '')}-${s.id}`, label: `${n.replace('nd-', '').toUpperCase()} port → ${s.id}` }))) : [];

  const doTick = (count: number) => act.run(async () => { await post('/api/simulation/tick', { count }); st.reload(); });
  const doScenario = (code: string) => act.run(async () => { setLastRun(await post(`/api/simulation/scenarios/${code}/run`)); st.reload(); });
  const doInject = () => act.run(async () => {
    const params = fault.type === 'HIGH_LATENCY' ? { addMs: fault.addMs } : fault.type === 'PACKET_LOSS' ? { addPct: fault.addPct } : undefined;
    setLastRun(await post('/api/simulation/faults', { type: fault.type, targetType, targetId: fault.targetId || targets[0]?.id, params }));
    st.reload();
  });
  const doRestore = (id: string) => act.run(async () => { await post(`/api/simulation/faults/${id}/restore`); st.reload(); });
  const restoreAll = () => act.run(async () => { for (const f of st.data.faults.filter((x: any) => x.state === 'ACTIVE')) await post(`/api/simulation/faults/${f.id}/restore`); st.reload(); });
  const doReset = () => act.run(async () => { if (confirm('Reset simulation (faults, telemetry, alarms, incidents, clock)? Orders and services are kept.')) { await post('/api/simulation/reset'); st.reload(); } });
  const doResetDemo = () => act.run(async () => { if (confirm('Full demo reset: delete ALL demo data and re-seed? You will be logged out.')) { await post('/api/admin/reset-demo'); location.href = '/'; } });
  const toggleAuto = () => act.run(async () => { await api('PATCH', '/api/simulation/settings', { autoTick: !st.data.autoTick }); st.reload(); });
  const runWorker = () => act.run(async () => { await post('/api/provisioning/run'); });

  if (st.error) return <ErrorBox error={st.error} />;
  if (!st.data) return <Loading />;
  const s = st.data;
  const active = s.faults.filter((f: any) => f.state === 'ACTIVE');
  return (
    <div className="stack">
      <PageHead title="Simulation Lab" sub="Fault injection and clock control. Only affects the simulated environment."><SimBadge /></PageHead>
      <ErrorBox error={act.error} />
      {!canControl ? <div className="alert info">Read-only view for your role.</div> : null}
      <div className="grid g3">
        <div className="card stack">
          <h2>Simulation clock</h2>
          <div><span style={{ fontSize: 28, fontWeight: 700 }}>t = {s.tick}</span> <span className="muted">· {dt(s.simTime)} (sim)</span></div>
          <div className="small muted">1 tick = {s.tickSeconds} s · seed {s.seed} · mode {s.mode} · auto-tick {s.autoTick ? 'ON' : 'OFF'}</div>
          {canControl ? (
            <div className="row">
              <button onClick={() => doTick(1)} disabled={act.busy}>+1 tick</button>
              <button onClick={() => doTick(10)} disabled={act.busy}>+10</button>
              <button onClick={() => doTick(60)} disabled={act.busy}>+60 (1 h)</button>
              <button onClick={toggleAuto} disabled={act.busy}>{s.autoTick ? 'Pause auto-tick' : 'Resume auto-tick'}</button>
              <button onClick={runWorker} disabled={act.busy} title="Normally runs every second in the background">Run workflow worker</button>
            </div>
          ) : null}
        </div>
        <div className="card stack">
          <h2>Simulator adapter</h2>
          <div><Badge v={s.adapter.label} tone="warn" /> <strong>{s.adapter.name}</strong></div>
          <div className="small muted">{s.adapter.detail}</div>
          <div className="small">Mode B (Containerlab / Mininet-Optical): optional, not connected — see Settings → Integrations.</div>
        </div>
        <div className="card stack">
          <h2>Reset</h2>
          <div className="small muted">Reset the simulation to replay a scenario with identical, seeded results.</div>
          {canControl ? <div className="row"><button onClick={restoreAll} disabled={act.busy || !active.length}>Restore all faults</button><button className="danger" onClick={doReset} disabled={act.busy}>Reset simulation</button></div> : null}
          {hasRole(user, 'ADMIN') ? <button className="danger" onClick={doResetDemo} disabled={act.busy}>Full demo reset (re-seed)</button> : null}
        </div>
      </div>

      {lastRun ? (
        <div className="alert info">Injected {lastRun.faultIds.length} fault(s). {lastRun.incidentId ? <Link to={`/incidents/${lastRun.incidentId}`}>Open incident {lastRun.incidentId} →</Link> : null}</div>
      ) : null}

      <div className="grid g2">
        <div className="card">
          <h2>Scenarios</h2>
          <div className="table-wrap"><table>
            <tbody>{scen.data?.map((x: any) => (
              <tr key={x.code}>
                <td><strong>{x.name}</strong><div className="small muted">{x.description}</div><div className="small mono muted">{x.steps.map((st: any) => `${st.type}@${st.targetId}`).join(' + ')}</div></td>
                <td>{canControl ? <button className="sm" onClick={() => doScenario(x.code)} disabled={act.busy}>Run</button> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="stack">
          {canControl ? (
            <div className="card stack">
              <h2>Custom fault</h2>
              <div className="form-grid">
                <label className="f">Type<select value={fault.type} onChange={(e) => setFault({ ...fault, type: e.target.value, targetId: '' })}>{types.map((t) => <option key={t.type} value={t.type}>{t.type}</option>)}</select></label>
                <label className="f">Target ({targetType.toLowerCase()})<select value={fault.targetId} onChange={(e) => setFault({ ...fault, targetId: e.target.value })}>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
                {fault.type === 'HIGH_LATENCY' ? <label className="f">Add latency (ms)<input type="number" min={0} value={fault.addMs} onChange={(e) => setFault({ ...fault, addMs: Number(e.target.value) })} /></label> : null}
                {fault.type === 'PACKET_LOSS' ? <label className="f">Add loss (%)<input type="number" min={0} max={100} step={0.1} value={fault.addPct} onChange={(e) => setFault({ ...fault, addPct: Number(e.target.value) })} /></label> : null}
                <button className="primary" onClick={doInject} disabled={act.busy || !targets.length}>Inject</button>
              </div>
            </div>
          ) : null}
          <div className="card">
            <h2>Faults ({active.length} active)</h2>
            {!s.faults.length ? <div className="small muted">None.</div> : (
              <table><tbody>{s.faults.map((f: any) => (
                <tr key={f.id}>
                  <td className="mono small">{f.type}</td>
                  <td className="mono small">{f.target_id ?? 'GLOBAL'}</td>
                  <td><Badge v={f.state} /></td>
                  <td className="small">tick {f.injected_tick}→{f.restored_tick ?? 'now'}</td>
                  <td>{canControl && f.state === 'ACTIVE' ? <button className="sm" onClick={() => doRestore(f.id)} disabled={act.busy}>Restore</button> : null}</td>
                </tr>
              ))}</tbody></table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
