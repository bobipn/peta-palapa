/**
 * Mode A network/assurance engine: fault state -> element status -> service
 * impact (protection switch / reroute / down) -> alarms -> incidents -> telemetry & SLA.
 *
 * Design: `recompute()` is idempotent and derives everything from the set of
 * ACTIVE faults plus current service paths, so it can run after every fault
 * change and on every tick without drifting. Alarms are reconciled (desired vs
 * actual) rather than appended. All timestamps here are on the SIMULATION clock
 * (ticks), so a reset + replay reproduces the same results.
 */
import type { Queryable } from '../../db/db.js';
import { badRequest, newId, notFound } from '../../lib/util.js';
import { computeRoutes } from '../../domain/routing.js';
import { serviceSample, type SegmentState } from '../../domain/telemetry-model.js';
import { breachesOf } from '../../domain/sla.js';
import { audit, emitEvent, getSettings, getSimState, simTimeOf, type Ctx, type Meta, type Settings, type SimState } from '../context.js';
import { release, reserve } from '../capacity.js';
import { loadGraph } from '../topology.js';
import { FAULT_TARGET, FAULT_TYPES, type FaultSpec, type FaultType } from './adapter.js';
import { servicePortDependencies } from '../netconfig.js';
import { alarmContext, recordNocMetrics, unreachableDevices } from './noc.js';

interface FaultRow {
  id: string;
  type: FaultType;
  target_type: string;
  target_id: string | null;
  params: Record<string, any>;
  state: string;
  group_id: string;
  injected_tick: number;
}

export interface NetState {
  faults: FaultRow[];
  segDown: Map<string, 'PROVIDER_NETWORK' | 'SCHEDULED_MAINTENANCE'>;
  segDegraded: Set<string>;
  addLatency: Map<string, number>;
  addLoss: Map<string, number>;
  nodeDown: Set<string>;
  portDown: Set<string>;
  customerSideDown: Set<string>;
  /** fault id -> data-plane segments it affects */
  faultSegments: Map<string, Set<string>>;
}

const FAULT_META: Record<FaultType, { severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'INFO'; alarm: string; title: string }> = {
  FIBER_CUT: { severity: 'CRITICAL', alarm: 'LOS', title: 'Fiber cut' },
  NODE_DOWN: { severity: 'CRITICAL', alarm: 'NODE_UNREACHABLE', title: 'Node / PoP down' },
  PORT_DOWN: { severity: 'MAJOR', alarm: 'PORT_DOWN', title: 'Port down' },
  CAPACITY_EXHAUSTION: { severity: 'MAJOR', alarm: 'CAPACITY_EXHAUSTED', title: 'Capacity exhaustion' },
  HIGH_LATENCY: { severity: 'MINOR', alarm: 'HIGH_LATENCY', title: 'High latency' },
  PACKET_LOSS: { severity: 'MAJOR', alarm: 'PACKET_LOSS', title: 'Packet loss' },
  PROVIDER_API_TIMEOUT: { severity: 'WARNING', alarm: 'PROVIDER_API_UNREACHABLE', title: 'Provider API timeout' },
  PROVISIONING_FAILURE: { severity: 'WARNING', alarm: 'PROVISIONING_DEGRADED', title: 'Provisioning failure' },
  SCHEDULED_MAINTENANCE: { severity: 'INFO', alarm: 'MAINTENANCE', title: 'Scheduled maintenance' },
  CUSTOMER_SIDE_OUTAGE: { severity: 'MINOR', alarm: 'CUSTOMER_SIDE_DOWN', title: 'Customer-side outage' },
};
const SERVICE_ALARMS = ['SERVICE_DOWN', 'ON_PROTECTION', 'ON_REROUTE', 'DEVICE_UNREACHABLE'];
const MANAGED_ALARMS = new Set([...Object.values(FAULT_META).map((m) => m.alarm), ...SERVICE_ALARMS]);

// ------------------------------------------------------------------ state

export async function computeNetState(q: Queryable): Promise<NetState> {
  const faults = (await q.query<FaultRow>(`SELECT * FROM injected_faults WHERE state='ACTIVE' ORDER BY created_at, id`)).rows;
  const ns: NetState = {
    faults, segDown: new Map(), segDegraded: new Set(), addLatency: new Map(), addLoss: new Map(),
    nodeDown: new Set(), portDown: new Set(), customerSideDown: new Set(), faultSegments: new Map(),
  };
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const f of faults) {
    const segs = new Set<string>();
    if (f.target_type === 'SEGMENT' && f.target_id) segs.add(f.target_id);
    if (f.type === 'NODE_DOWN' && f.target_id) {
      ns.nodeDown.add(f.target_id);
      for (const r of (await q.query(`SELECT id FROM cable_segments WHERE a_node_id=$1 OR b_node_id=$1`, [f.target_id])).rows) segs.add(r.id);
      for (const r of (await q.query(`SELECT p.id FROM ports p JOIN equipment e ON e.id=p.equipment_id WHERE e.node_id=$1`, [f.target_id])).rows) ns.portDown.add(r.id);
    }
    if (f.type === 'PORT_DOWN' && f.target_id) {
      ns.portDown.add(f.target_id);
      const p = (await q.query(`SELECT segment_id FROM ports WHERE id=$1`, [f.target_id])).rows[0];
      if (p?.segment_id) segs.add(p.segment_id);
    }
    if (f.type === 'CUSTOMER_SIDE_OUTAGE' && f.target_id) ns.customerSideDown.add(f.target_id);
    ns.faultSegments.set(f.id, segs);
    for (const s of segs) {
      switch (f.type) {
        case 'FIBER_CUT': case 'NODE_DOWN': case 'PORT_DOWN':
          ns.segDown.set(s, 'PROVIDER_NETWORK'); break;
        case 'SCHEDULED_MAINTENANCE':
          if (!ns.segDown.has(s)) ns.segDown.set(s, 'SCHEDULED_MAINTENANCE'); break;
        case 'HIGH_LATENCY':
          add(ns.addLatency, s, Number(f.params.addMs ?? 30)); ns.segDegraded.add(s); break;
        case 'PACKET_LOSS':
          add(ns.addLoss, s, Number(f.params.addPct ?? 1)); ns.segDegraded.add(s); break;
        case 'CAPACITY_EXHAUSTION':
          ns.segDegraded.add(s); break;
      }
    }
  }
  return ns;
}

async function applyElementStatus(q: Queryable, ns: NetState) {
  await q.query(
    `UPDATE cable_segments SET oper_status = CASE WHEN id = ANY($1) THEN 'DOWN' WHEN id = ANY($2) THEN 'DEGRADED' ELSE 'UP' END`,
    [[...ns.segDown.keys()], [...ns.segDegraded]],
  );
  await q.query(`UPDATE nodes SET oper_status = CASE WHEN id = ANY($1) THEN 'DOWN' ELSE 'UP' END`, [[...ns.nodeDown]]);
  await q.query(`UPDATE ports SET oper_status = CASE WHEN id = ANY($1) THEN 'DOWN' ELSE 'UP' END`, [[...ns.portDown]]);
}

// ------------------------------------------------------------------ incidents

async function incidentForGroup(q: Queryable, group: string) {
  return (await q.query(`SELECT * FROM incidents WHERE fault_group=$1 ORDER BY opened_tick DESC LIMIT 1`, [group])).rows[0] ?? null;
}

async function timeline(q: Queryable, incidentId: string, tick: number, kind: string, message: string, data: unknown = {}) {
  await q.query(`INSERT INTO incident_events (incident_id, tick, kind, message, data) VALUES ($1,$2,$3,$4,$5)`, [incidentId, tick, kind, message, JSON.stringify(data)]);
}

async function addImpact(q: Queryable, incidentId: string, field: 'impacted_services' | 'impacted_providers' | 'impacted_customers', ids: string[]) {
  if (ids.length === 0) return;
  const row = (await q.query(`SELECT ${field} AS v FROM incidents WHERE id=$1`, [incidentId])).rows[0];
  const merged = [...new Set([...(row?.v ?? []), ...ids])].sort();
  await q.query(`UPDATE incidents SET ${field}=$2 WHERE id=$1`, [incidentId, JSON.stringify(merged)]);
}

/** Incidents (by fault) that affect any of the given segments. */
function faultsTouching(ns: NetState, segIds: string[], serviceId: string, portDeps: string[] = []): FaultRow[] {
  return ns.faults.filter((f) => {
    if (f.type === 'CUSTOMER_SIDE_OUTAGE') return f.target_id === serviceId;
    if (f.type === 'PORT_DOWN' && f.target_id && portDeps.includes(f.target_id)) return true;
    const fs = ns.faultSegments.get(f.id);
    return !!fs && segIds.some((s) => fs.has(s));
  });
}

// ------------------------------------------------------------------ service impact

interface PathRow { id: string; role: 'PRIMARY' | 'PROTECTION' | 'REROUTE'; segment_ids: string[]; node_ids: string[]; status: string; }

async function setPathStatus(q: Queryable, svcId: string, active: 'PRIMARY' | 'PROTECTION' | 'REROUTE') {
  await q.query(
    `UPDATE service_paths SET status = CASE WHEN role=$2 THEN 'ACTIVE' ELSE 'STANDBY' END
     WHERE service_id=$1 AND status IN ('ACTIVE','STANDBY') `,
    [svcId, active],
  );
}

async function dropReroute(q: Queryable, ctx: Ctx, svcId: string, reason: string) {
  await release(q, { serviceId: svcId, role: 'REROUTE' }, reason, ctx.clock.now());
  await q.query(`UPDATE service_paths SET status='RELEASED' WHERE service_id=$1 AND role='REROUTE' AND status <> 'RELEASED'`, [svcId]);
  await q.query(`UPDATE services SET reroute_ready_tick=NULL WHERE id=$1`, [svcId]);
}

async function evaluateServices(q: Queryable, ctx: Ctx, meta: Meta, ns: NetState, sim: SimState, settings: Settings) {
  const services = (await q.query(`SELECT * FROM services WHERE state='ACTIVE' ORDER BY id`)).rows;
  for (const svc of services) {
    const paths = (await q.query<PathRow>(`SELECT * FROM service_paths WHERE service_id=$1 AND status <> 'RELEASED' ORDER BY created_at`, [svc.id])).rows;
    const primary = paths.find((p) => p.role === 'PRIMARY');
    const protection = paths.find((p) => p.role === 'PROTECTION');
    let reroute = paths.find((p) => p.role === 'REROUTE');
    const up = (p?: PathRow) => !!p && p.segment_ids.every((s) => !ns.segDown.has(s)) && p.node_ids.every((n) => !ns.nodeDown.has(n));
    const allSegs = paths.flatMap((p) => p.segment_ids);
    const portDeps = await servicePortDependencies(q, svc.id);
    const touching = faultsTouching(ns, allSegs, svc.id, portDeps);
    const incidents: any[] = [];
    for (const f of touching) {
      const inc = await incidentForGroup(q, f.group_id);
      if (inc && inc.state !== 'RESOLVED') incidents.push(inc);
    }
    for (const inc of incidents) {
      await addImpact(q, inc.id, 'impacted_services', [svc.id]);
      await addImpact(q, inc.id, 'impacted_customers', [svc.customer_id]);
    }
    const note = async (kind: string, message: string, data: unknown = {}) => {
      for (const inc of incidents) await timeline(q, inc.id, sim.tick, kind, message, { serviceId: svc.id, ...((data as object) ?? {}) });
      await emitEvent(q, ctx, meta, { aggregateType: 'service', aggregateId: svc.id, type: kind, payload: { message, ...((data as object) ?? {}) }, simTick: sim.tick });
    };
    const prevOper: string = svc.oper_status;
    let active: 'PRIMARY' | 'PROTECTION' | 'REROUTE' = svc.active_path ?? 'PRIMARY';
    let oper: 'UP' | 'DOWN' = 'UP';
    let downSince: number | null = svc.down_since_tick;

    const goDown = async (why: string) => {
      oper = 'DOWN';
      if (prevOper !== 'DOWN') {
        downSince = sim.tick;
        await note('SERVICE_DOWN', `${svc.name} is DOWN: ${why}`);
      }
    };
    const restored = async (how: string, switchMs?: number) => {
      oper = 'UP';
      if (prevOper === 'DOWN' && downSince !== null) {
        const secs = switchMs !== undefined ? switchMs / 1000 : (sim.tick - downSince) * sim.tickSeconds;
        await note('SERVICE_RESTORED', `${svc.name} restored via ${how}`, { restorationSeconds: secs });
      }
      downSince = null;
    };

    if (portDeps.some((p) => ns.portDown.has(p))) {
      await goDown('customer handoff (UNI) or PE uplink port down');
    } else if (ns.customerSideDown.has(svc.id)) {
      await goDown('customer-side outage (excluded from provider SLA)');
    } else if (reroute && reroute.status === 'PLANNED') {
      if (up(primary)) {
        await dropReroute(q, ctx, svc.id, 'primary repaired before reroute completed');
        active = 'PRIMARY';
        await setPathStatus(q, svc.id, active);
        await restored('primary path (repaired before reroute completed)');
      } else if (!up(reroute)) {
        await dropReroute(q, ctx, svc.id, 'reroute path failed');
        reroute = undefined;
        await attemptReroute();
      } else if (svc.reroute_ready_tick !== null && sim.tick >= svc.reroute_ready_tick) {
        await q.query(`UPDATE service_paths SET status='ACTIVE' WHERE id=$1`, [reroute.id]);
        await q.query(`UPDATE service_paths SET status='STANDBY' WHERE service_id=$1 AND role <> 'REROUTE' AND status='ACTIVE'`, [svc.id]);
        await q.query(`UPDATE services SET reroute_ready_tick=NULL WHERE id=$1`, [svc.id]);
        active = 'REROUTE';
        await restored('restoration reroute');
      } else {
        oper = 'DOWN';
      }
    } else {
      const current = active === 'PRIMARY' ? primary : active === 'PROTECTION' ? protection : reroute;
      if (up(current)) {
        if (active === 'REROUTE' && up(primary)) {
          await dropReroute(q, ctx, svc.id, 'primary repaired — reverting');
          active = 'PRIMARY';
          await setPathStatus(q, svc.id, active);
          await note('REVERTED_TO_PRIMARY', `${svc.name} reverted from reroute to primary path`);
        } else if (active === 'PROTECTION' && settings.protection_revertive && up(primary)) {
          active = 'PRIMARY';
          await setPathStatus(q, svc.id, active);
          await note('REVERTED_TO_PRIMARY', `${svc.name} reverted from protection to primary (revertive mode)`);
        }
        if (prevOper === 'DOWN') await restored(`${active.toLowerCase()} path`);
      } else if (active !== 'PROTECTION' && up(protection)) {
        if (active === 'REROUTE') await dropReroute(q, ctx, svc.id, 'switched to protection');
        active = 'PROTECTION';
        await setPathStatus(q, svc.id, active);
        await note('PROTECTION_SWITCH', `${svc.name} switched to protection path in ${settings.protection_switch_ms} ms (simulated)`, { switchMs: settings.protection_switch_ms });
        if (prevOper === 'DOWN') await restored('protection path', settings.protection_switch_ms);
      } else if (active === 'PROTECTION' && up(primary)) {
        active = 'PRIMARY';
        await setPathStatus(q, svc.id, active);
        await note('PROTECTION_SWITCH', `${svc.name} protection path failed; switched back to primary`);
        if (prevOper === 'DOWN') await restored('primary path', settings.protection_switch_ms);
      } else {
        if (active === 'REROUTE') await dropReroute(q, ctx, svc.id, 'reroute path failed');
        await attemptReroute();
      }
    }

    await q.query(`UPDATE services SET oper_status = CASE WHEN $2='DOWN' THEN 'DOWN' WHEN oper_status='DEGRADED' AND $2='UP' THEN 'DEGRADED' ELSE $2 END,
                   active_path=$3, down_since_tick=$4 WHERE id=$1`, [svc.id, oper, active, downSince]);

    async function attemptReroute() {
      if (!svc.auto_reroute) return goDown('active path failed; service has no protection and auto-reroute is off');
      const already = (await q.query(`SELECT 1 FROM service_paths WHERE service_id=$1 AND role='REROUTE' AND status='PLANNED'`, [svc.id])).rows.length > 0;
      if (already) { oper = 'DOWN'; return; }
      const topo = await loadGraph(q);
      // Capacity this service already holds can be reused by its own reroute.
      const own = new Set((await q.query(`SELECT segment_id FROM reservations WHERE service_id=$1 AND status='COMMITTED'`, [svc.id])).rows.map((r) => r.segment_id));
      for (const s of topo.segments) if (own.has(s.id)) s.availableMbps += svc.bandwidth_mbps;
      const from = primary?.node_ids[0];
      const to = primary?.node_ids[primary.node_ids.length - 1];
      const res = from && to
        ? computeRoutes(topo, { fromNode: from, toNode: to, bandwidthMbps: svc.bandwidth_mbps, protection: 'NONE', nodeProcessingMs: settings.node_processing_ms })
        : null;
      const cand = res?.feasible ? res.candidates[0].primary : null;
      if (!cand) {
        await goDown(`no restoration path with ${svc.bandwidth_mbps} Mbps (${res?.reason ?? 'unknown'})`);
        return;
      }
      const fresh = cand.segmentIds.filter((s) => !own.has(s));
      if (fresh.length) {
        await reserve(q, { segments: fresh.map((segmentId) => ({ segmentId, role: 'REROUTE' })), mbps: svc.bandwidth_mbps, orderId: svc.order_id, serviceId: svc.id, status: 'COMMITTED', now: ctx.clock.now() });
      }
      await q.query(
        `INSERT INTO service_paths (id, service_id, role, segment_ids, node_ids, latency_ms, length_km, status, created_at) VALUES ($1,$2,'REROUTE',$3,$4,$5,$6,'PLANNED',$7)`,
        [newId('sp'), svc.id, JSON.stringify(cand.segmentIds), JSON.stringify(cand.nodeIds), cand.latencyMs, cand.lengthKm, ctx.clock.now()],
      );
      const ready = sim.tick + settings.reroute_ticks;
      await q.query(`UPDATE services SET reroute_ready_tick=$2 WHERE id=$1`, [svc.id, ready]);
      await goDown('active path failed; restoration reroute in progress');
      await note('REROUTE_STARTED', `${svc.name}: restoration reroute via ${cand.segmentIds.join(' > ')} (ready at tick ${ready})`, { path: cand.segmentIds, readyTick: ready });
    }
  }
}

// ------------------------------------------------------------------ alarms

async function reconcileAlarms(q: Queryable, ctx: Ctx, ns: NetState, sim: SimState) {
  type Desired = { type: string; severity: string; entityType: string; entityId: string; message: string; faultId: string | null; group: string | null };
  const desired: Desired[] = [];
  for (const f of ns.faults) {
    const m = FAULT_META[f.type];
    desired.push({
      type: m.alarm, severity: m.severity, entityType: f.target_type, entityId: f.target_id ?? 'GLOBAL',
      message: `${m.title} on ${f.target_type.toLowerCase()} ${f.target_id ?? '(all)'} [SIMULATED]`, faultId: f.id, group: f.group_id,
    });
  }
  const services = (await q.query(`SELECT s.id, s.name, s.oper_status, s.active_path, s.reroute_ready_tick FROM services s WHERE s.state='ACTIVE'`)).rows;
  for (const s of services) {
    if (s.oper_status === 'DOWN') desired.push({ type: 'SERVICE_DOWN', severity: 'CRITICAL', entityType: 'SERVICE', entityId: s.id, message: `${s.name} down${s.reroute_ready_tick !== null ? ' — reroute in progress' : ''}`, faultId: null, group: null });
    else if (s.active_path === 'PROTECTION') desired.push({ type: 'ON_PROTECTION', severity: 'MAJOR', entityType: 'SERVICE', entityId: s.id, message: `${s.name} running on protection path (no redundancy)`, faultId: null, group: null });
    else if (s.active_path === 'REROUTE') desired.push({ type: 'ON_REROUTE', severity: 'MAJOR', entityType: 'SERVICE', entityId: s.id, message: `${s.name} running on restoration reroute`, faultId: null, group: null });
  }
  for (const d of await unreachableDevices(q, ns)) {
    desired.push({ type: 'DEVICE_UNREACHABLE', severity: 'MAJOR', entityType: 'DEVICE', entityId: d.id, message: `${d.hostname}: NE communication lost (no management path from NMS) [SIMULATED]`, faultId: null, group: null });
  }
  const active = (await q.query(`SELECT * FROM alarms WHERE state='ACTIVE'`)).rows.filter((a) => MANAGED_ALARMS.has(a.type));
  const key = (t: string, et: string, eid: string) => `${t}|${et}|${eid}`;
  const want = new Map(desired.map((d) => [key(d.type, d.entityType, d.entityId), d]));
  const have = new Map(active.map((a) => [key(a.type, a.entity_type, a.entity_id), a]));
  for (const [k, a] of have) {
    if (!want.has(k)) await q.query(`UPDATE alarms SET state='CLEARED', cleared_tick=$2 WHERE id=$1`, [a.id, sim.tick]);
  }
  for (const [k, d] of want) {
    if (have.has(k)) continue;
    let incidentId: string | null = null;
    if (d.group) incidentId = (await incidentForGroup(q, d.group))?.id ?? null;
    else {
      // Attribute a service alarm to the open incident that impacts it.
      incidentId = (await q.query(`SELECT id FROM incidents WHERE state <> 'RESOLVED' AND impacted_services ? $1 ORDER BY opened_tick DESC LIMIT 1`, [d.entityId])).rows[0]?.id ?? null;
    }
    const id = newId('alm');
    const c = await alarmContext(q, d.type, d.entityType, d.entityId);
    await q.query(
      `INSERT INTO alarms (id, severity, type, entity_type, entity_id, message, state, raised_tick, incident_id, fault_id, created_at, code, source_name, location_info, occurrence)
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, d.severity, d.type, d.entityType, d.entityId, d.message, sim.tick, incidentId, d.faultId, ctx.clock.now(), c.code, c.source, c.location, c.occurrence],
    );
    if (incidentId) await timeline(q, incidentId, sim.tick, 'ALARM_RAISED', `${d.severity} ${d.type}: ${d.message}`, { alarmId: id });
  }
}

async function updateIncidents(q: Queryable, ns: NetState, sim: SimState) {
  const open = (await q.query(`SELECT * FROM incidents WHERE state <> 'RESOLVED'`)).rows;
  for (const inc of open) {
    const activeFaults = ns.faults.filter((f) => f.group_id === inc.fault_group).length;
    const impacted: string[] = inc.impacted_services ?? [];
    const down = impacted.length
      ? (await q.query(`SELECT count(*)::int AS n FROM services WHERE id = ANY($1) AND oper_status='DOWN' AND state='ACTIVE'`, [impacted])).rows[0].n
      : 0;
    if (down > 0 && inc.severity !== 'CRITICAL') await q.query(`UPDATE incidents SET severity='CRITICAL' WHERE id=$1`, [inc.id]);
    if (activeFaults === 0 && down === 0) {
      await q.query(`UPDATE incidents SET state='RESOLVED', resolved_tick=$2 WHERE id=$1`, [inc.id, sim.tick]);
      await timeline(q, inc.id, sim.tick, 'RESOLVED', 'All faults cleared and impacted services up');
    } else if (inc.state === 'OPEN' && activeFaults > 0 && down === 0 && impacted.length > 0) {
      await q.query(`UPDATE incidents SET state='MITIGATED', mitigated_tick=$2 WHERE id=$1`, [inc.id, sim.tick]);
      await timeline(q, inc.id, sim.tick, 'MITIGATED', 'Customer impact mitigated (protection/reroute) while fault persists');
    } else if (inc.state === 'MITIGATED' && down > 0) {
      await q.query(`UPDATE incidents SET state='OPEN' WHERE id=$1`, [inc.id]);
      await timeline(q, inc.id, sim.tick, 'REOPENED', 'Impacted service down again');
    }
  }
}

/** Derive all network-side consequences from the current fault set. Idempotent. */
export async function recompute(q: Queryable, ctx: Ctx, meta: Meta) {
  const ns = await computeNetState(q);
  const sim = await getSimState(q);
  const settings = await getSettings(q);
  await applyElementStatus(q, ns);
  await evaluateServices(q, ctx, meta, ns, sim, settings);
  await reconcileAlarms(q, ctx, ns, sim);
  await updateIncidents(q, ns, sim);
  return ns;
}

// ------------------------------------------------------------------ faults

async function assertTarget(q: Queryable, spec: FaultSpec) {
  if (!FAULT_TYPES.includes(spec.type)) throw badRequest('UNKNOWN_FAULT_TYPE', `Unknown fault type ${spec.type}`);
  if (!FAULT_TARGET[spec.type].includes(spec.targetType)) {
    throw badRequest('INVALID_FAULT_TARGET', `${spec.type} applies to ${FAULT_TARGET[spec.type].join('/')}, not ${spec.targetType}`);
  }
  const table: Record<string, string> = { SEGMENT: 'cable_segments', NODE: 'nodes', PORT: 'ports', PROVIDER: 'providers', SERVICE: 'services' };
  if (spec.targetType === 'GLOBAL') return;
  if (!spec.targetId) throw badRequest('TARGET_REQUIRED', 'targetId is required');
  const t = table[spec.targetType];
  const r = await q.query(`SELECT 1 FROM ${t} WHERE id=$1`, [spec.targetId]);
  if (r.rows.length === 0) throw notFound(`${spec.targetType} ${spec.targetId}`);
}

export async function injectFaults(ctx: Ctx, meta: Meta, specs: FaultSpec[], groupId?: string) {
  if (specs.length === 0) throw badRequest('NO_FAULTS', 'At least one fault is required');
  return ctx.db.tx(async (q) => {
    const sim = await getSimState(q);
    const group = groupId ?? newId('grp');
    const ids: string[] = [];
    let incident = await incidentForGroup(q, group);
    for (const spec of specs) {
      await assertTarget(q, spec);
      const id = newId('flt');
      await q.query(
        `INSERT INTO injected_faults (id, type, target_type, target_id, params, state, group_id, injected_tick, injected_by, created_at)
         VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8,$9)`,
        [id, spec.type, spec.targetType, spec.targetId, JSON.stringify(spec.params ?? {}), group, sim.tick, meta.actor?.userId ?? 'system', ctx.clock.now()],
      );
      if (spec.type === 'CAPACITY_EXHAUSTION') {
        const c = (await q.query(`SELECT capacity_mbps - reserved_mbps AS free FROM capacity_resources WHERE segment_id=$1`, [spec.targetId])).rows[0];
        if (c && c.free > 0) await reserve(q, { segments: [{ segmentId: spec.targetId!, role: 'FAULT' }], mbps: c.free, faultId: id, status: 'COMMITTED', now: ctx.clock.now() });
      }
      if (!incident) {
        incident = { id: newId('inc') };
        const m = FAULT_META[spec.type];
        const title = specs.length > 1 ? `Correlated failure: ${specs.length} faults (${specs.map((s) => s.targetId).join(', ')})` : `${m.title}: ${spec.targetId ?? 'global'}`;
        await q.query(
          `INSERT INTO incidents (id, title, severity, state, fault_group, opened_tick, root_cause, created_at) VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7)`,
          [incident.id, title, m.severity === 'INFO' ? 'WARNING' : m.severity, group, sim.tick, `Injected ${spec.type} (simulation)`, ctx.clock.now()],
        );
      }
      const providers = await providersOf(q, spec);
      await addImpact(q, incident.id, 'impacted_providers', providers);
      await timeline(q, incident.id, sim.tick, 'FAULT_INJECTED', `${spec.type} on ${spec.targetType} ${spec.targetId ?? '(global)'}`, { faultId: id, params: spec.params ?? {} });
      await emitEvent(q, ctx, meta, { aggregateType: 'fault', aggregateId: id, type: 'FAULT_INJECTED', payload: spec, simTick: sim.tick });
      await audit(q, ctx, meta, { action: 'simulation.fault.inject', entityType: 'fault', entityId: id, details: spec });
      ids.push(id);
    }
    await recompute(q, ctx, meta);
    return { faultIds: ids, incidentId: incident?.id ?? null, groupId: group };
  });
}

async function providersOf(q: Queryable, spec: FaultSpec): Promise<string[]> {
  if (spec.targetType === 'PROVIDER' && spec.targetId) return [spec.targetId];
  if (spec.targetType === 'SEGMENT') return (await q.query(`SELECT provider_id FROM cable_segments WHERE id=$1`, [spec.targetId])).rows.map((r) => r.provider_id);
  if (spec.targetType === 'NODE') return (await q.query(`SELECT DISTINCT provider_id FROM cable_segments WHERE a_node_id=$1 OR b_node_id=$1`, [spec.targetId])).rows.map((r) => r.provider_id);
  if (spec.targetType === 'PORT') return (await q.query(`SELECT s.provider_id FROM ports p JOIN cable_segments s ON s.id=p.segment_id WHERE p.id=$1`, [spec.targetId])).rows.map((r) => r.provider_id);
  return [];
}

export async function restoreFault(ctx: Ctx, meta: Meta, faultId: string) {
  return ctx.db.tx(async (q) => {
    const f = (await q.query(`SELECT * FROM injected_faults WHERE id=$1`, [faultId])).rows[0];
    if (!f) throw notFound('Fault');
    if (f.state !== 'ACTIVE') return { alreadyRestored: true };
    const sim = await getSimState(q);
    await q.query(`UPDATE injected_faults SET state='RESTORED', restored_tick=$2 WHERE id=$1`, [faultId, sim.tick]);
    await release(q, { faultId }, 'fault restored', ctx.clock.now());
    const inc = await incidentForGroup(q, f.group_id);
    if (inc) await timeline(q, inc.id, sim.tick, 'FAULT_CLEARED', `${f.type} on ${f.target_type} ${f.target_id ?? '(global)'} cleared`, { faultId });
    await emitEvent(q, ctx, meta, { aggregateType: 'fault', aggregateId: faultId, type: 'FAULT_RESTORED', simTick: sim.tick });
    await audit(q, ctx, meta, { action: 'simulation.fault.restore', entityType: 'fault', entityId: faultId });
    await recompute(q, ctx, meta);
    return { alreadyRestored: false };
  });
}

export async function runScenario(ctx: Ctx, meta: Meta, code: string) {
  const s = (await ctx.db.query(`SELECT * FROM simulation_scenarios WHERE code=$1`, [code])).rows[0];
  if (!s) throw notFound('Scenario');
  return injectFaults(ctx, meta, s.steps, newId(`grp-${code.toLowerCase().slice(0, 12)}`));
}

/** Whether a provider-scoped orchestration fault is active (used by provider/mock adapters). */
export async function providerFaultActive(q: Queryable, type: 'PROVIDER_API_TIMEOUT' | 'PROVISIONING_FAILURE', providerIds: string[]) {
  const r = await q.query(
    `SELECT target_id FROM injected_faults WHERE state='ACTIVE' AND type=$1 AND (target_type='GLOBAL' OR target_id = ANY($2))`,
    [type, providerIds],
  );
  return r.rows.length > 0;
}

// ------------------------------------------------------------------ telemetry tick

async function segmentStates(q: Queryable, ns: NetState): Promise<Map<string, SegmentState>> {
  const rows = (await q.query(`SELECT s.id, s.base_latency_ms, s.base_jitter_ms, s.base_loss_pct, c.capacity_mbps, c.reserved_mbps
                                FROM cable_segments s JOIN capacity_resources c ON c.segment_id=s.id`)).rows;
  return new Map(rows.map((r) => [r.id, {
    id: r.id,
    baseLatencyMs: r.base_latency_ms,
    baseJitterMs: r.base_jitter_ms,
    baseLossPct: r.base_loss_pct,
    utilisation: r.capacity_mbps > 0 ? r.reserved_mbps / r.capacity_mbps : 0,
    down: ns.segDown.has(r.id),
    downCause: ns.segDown.get(r.id) ?? 'NONE',
    addLatencyMs: ns.addLatency.get(r.id) ?? 0,
    addLossPct: ns.addLoss.get(r.id) ?? 0,
  } satisfies SegmentState]));
}

export async function sampleService(q: Queryable, svc: any, path: PathRow, ns: NetState, sim: SimState, settings: Settings, segStates?: Map<string, SegmentState>) {
  const segs = segStates ?? (await segmentStates(q, ns));
  return serviceSample({
    seed: sim.seed,
    tick: sim.tick,
    serviceKey: `${svc.a_location_id}:${svc.b_location_id}:${svc.bandwidth_mbps}`,
    bandwidthMbps: svc.bandwidth_mbps,
    pathSegments: path.segment_ids.map((id) => segs.get(id)!),
    nodeCount: path.node_ids.length,
    nodeProcessingMs: settings.node_processing_ms,
    tickSeconds: sim.tickSeconds,
  });
}

/** Tables rewritten or pruned every tick; vacuumed with a checkpoint every N ticks (PGlite only). */
const CHURN_TABLES = ['device_metrics', 'port_metrics', 'ports', 'equipment', 'simulation_state', 'services', 'cable_segments', 'nodes'];
const MAINTENANCE_EVERY_TICKS = 30;

/** Advance the simulation clock by `count` ticks, generating SIMULATED telemetry and SLA evaluation. */
export async function tick(ctx: Ctx, meta: Meta, count = 1) {
  if (count < 1 || count > 1440) throw badRequest('TICK_RANGE', 'count must be 1..1440');
  let last = 0;
  for (let i = 0; i < count; i++) {
    last = await ctx.db.tx(async (q) => {
      await q.query(`UPDATE simulation_state SET tick = tick + 1 WHERE id = 1`);
      const ns = await recompute(q, ctx, meta);
      const sim = await getSimState(q);
      const settings = await getSettings(q);
      const segs = await segmentStates(q, ns);
      const services = (await q.query(`SELECT s.*, p.latency_ms AS sla_latency, p.jitter_ms AS sla_jitter, p.loss_pct AS sla_loss, p.availability_pct AS sla_avail
        FROM services s JOIN sla_profiles p ON p.id = s.sla_profile_id WHERE s.state='ACTIVE' AND s.monitoring ORDER BY s.id`)).rows;
      const throughput = new Map<string, number>();
      for (const svc of services) {
        const path = (await q.query<PathRow>(`SELECT * FROM service_paths WHERE service_id=$1 AND role=$2 AND status <> 'RELEASED' ORDER BY created_at DESC LIMIT 1`, [svc.id, svc.active_path ?? 'PRIMARY'])).rows[0];
        if (!path) continue;
        let state: 'UP' | 'DOWN' | 'DEGRADED';
        let cause: 'NONE' | 'PROVIDER_NETWORK' | 'SCHEDULED_MAINTENANCE' | 'CUSTOMER_SIDE' = 'NONE';
        let m = { latencyMs: null as number | null, jitterMs: null as number | null, lossPct: null as number | null, throughputMbps: 0 };
        let breaches: string[] = [];
        if (ns.customerSideDown.has(svc.id)) {
          state = 'DOWN'; cause = 'CUSTOMER_SIDE';
        } else if (svc.oper_status === 'DOWN') {
          state = 'DOWN';
          const s = await sampleService(q, svc, path, ns, sim, settings, segs);
          cause = s.pathDown ? s.downCause : 'PROVIDER_NETWORK';
        } else {
          const s = await sampleService(q, svc, path, ns, sim, settings, segs);
          if (s.pathDown) { state = 'DOWN'; cause = s.downCause; }
          else {
            m = s;
            breaches = breachesOf(s, { latencyMs: svc.sla_latency, jitterMs: svc.sla_jitter, lossPct: svc.sla_loss, availabilityPct: svc.sla_avail });
            state = breaches.length ? 'DEGRADED' : 'UP';
          }
        }
        await q.query(
          `INSERT INTO telemetry_samples (service_id, tick, sim_time, interval_s, latency_ms, jitter_ms, loss_pct, throughput_mbps, state, outage_cause, breaches, active_path)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (service_id, tick) DO NOTHING`,
          [svc.id, sim.tick, simTimeOf(sim), sim.tickSeconds, m.latencyMs, m.jitterMs, m.lossPct, m.throughputMbps, state, cause, JSON.stringify(breaches), svc.active_path],
        );
        if (state !== 'DOWN') await q.query(`UPDATE services SET oper_status=$2 WHERE id=$1`, [svc.id, state]);
        throughput.set(svc.id, state === 'DOWN' ? 0 : m.throughputMbps);
        await trackBreaches(q, ctx, svc, breaches, m, sim);
      }
      await recordNocMetrics(q, ns, sim, throughput);
      return sim.tick;
    });
    if (last % MAINTENANCE_EVERY_TICKS === 0) {
      try {
        await ctx.db.maintain(CHURN_TABLES);
      } catch (e) {
        ctx.log.warn({ err: e }, 'db maintenance skipped');
      }
    }
  }
  return { tick: last };
}

async function trackBreaches(q: Queryable, ctx: Ctx, svc: any, breaches: string[], m: { latencyMs: number | null; jitterMs: number | null; lossPct: number | null }, sim: SimState) {
  const open = (await q.query(`SELECT * FROM sla_breaches WHERE service_id=$1 AND ended_tick IS NULL`, [svc.id])).rows;
  const value = (metric: string) => (metric === 'LATENCY' ? m.latencyMs : metric === 'JITTER' ? m.jitterMs : m.lossPct) ?? 0;
  const threshold = (metric: string) => (metric === 'LATENCY' ? svc.sla_latency : metric === 'JITTER' ? svc.sla_jitter : svc.sla_loss);
  for (const b of open) {
    if (!breaches.includes(b.metric)) {
      await q.query(`UPDATE sla_breaches SET ended_tick=$2 WHERE id=$1`, [b.id, sim.tick]);
      if (b.alarm_id) await q.query(`UPDATE alarms SET state='CLEARED', cleared_tick=$2 WHERE id=$1`, [b.alarm_id, sim.tick]);
      await emitEvent(q, ctx, { actor: null, correlationId: `tick-${sim.tick}` }, { aggregateType: 'service', aggregateId: svc.id, type: 'SLA_BREACH_ENDED', payload: { metric: b.metric, durationTicks: sim.tick - b.started_tick }, simTick: sim.tick });
    } else {
      await q.query(`UPDATE sla_breaches SET peak_value=GREATEST(peak_value,$2) WHERE id=$1`, [b.id, value(b.metric)]);
    }
  }
  for (const metric of breaches) {
    if (open.some((b) => b.metric === metric)) continue;
    const incident = (await q.query(`SELECT id FROM incidents WHERE state <> 'RESOLVED' AND impacted_services ? $1 ORDER BY opened_tick DESC LIMIT 1`, [svc.id])).rows[0]?.id ?? null;
    const alarmId = newId('alm');
    const c = await alarmContext(q, `SLA_BREACH_${metric}`, 'SERVICE', svc.id);
    await q.query(
      `INSERT INTO alarms (id, severity, type, entity_type, entity_id, message, state, raised_tick, incident_id, created_at, code, source_name, location_info, occurrence)
       VALUES ($1,'MAJOR',$2,'SERVICE',$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10,$11)`,
      [alarmId, `SLA_BREACH_${metric}`, svc.id, `${svc.name}: ${metric.toLowerCase()} ${value(metric)} above SLA ${threshold(metric)} [SIMULATED]`, sim.tick, incident, ctx.clock.now(), c.code, c.source, c.location, c.occurrence],
    );
    await q.query(`INSERT INTO sla_breaches (id, service_id, metric, threshold, peak_value, started_tick, alarm_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      newId('brc'), svc.id, metric, threshold(metric), value(metric), sim.tick, alarmId,
    ]);
    if (incident) await timeline(q, incident, sim.tick, 'SLA_BREACH', `${svc.name}: ${metric} breach started`, { serviceId: svc.id });
    await emitEvent(q, ctx, { actor: null, correlationId: `tick-${sim.tick}` }, { aggregateType: 'service', aggregateId: svc.id, type: 'SLA_BREACH_STARTED', payload: { metric, value: value(metric), threshold: threshold(metric) }, simTick: sim.tick });
  }
}

// ------------------------------------------------------------------ reset

/**
 * Reset the simulation layer only: clears faults, telemetry, alarms, incidents,
 * breaches and reroutes, rewinds the sim clock to tick 0. Orders, services and
 * their committed capacity are kept. For a full re-seed use admin reset-demo.
 */
export async function resetSimulation(ctx: Ctx, meta: Meta) {
  await ctx.db.tx(async (q) => {
    const now = ctx.clock.now();
    await release(q, { role: 'FAULT' }, 'simulation reset', now);
    await release(q, { role: 'REROUTE' }, 'simulation reset', now);
    await q.query(`UPDATE service_paths SET status='RELEASED' WHERE role='REROUTE' AND status <> 'RELEASED'`);
    await q.query(`UPDATE service_paths SET status = CASE WHEN role='PRIMARY' THEN 'ACTIVE' ELSE 'STANDBY' END
                   WHERE status IN ('ACTIVE','STANDBY') AND service_id IN (SELECT id FROM services WHERE state='ACTIVE')`);
    await q.query(`UPDATE services SET active_path='PRIMARY', oper_status='UP', reroute_ready_tick=NULL, down_since_tick=NULL, activated_sim_tick=0 WHERE state='ACTIVE'`);
    for (const t of ['incident_events', 'sla_breaches', 'telemetry_samples']) await q.query(`DELETE FROM ${t}`);
    await q.query(`DELETE FROM device_metrics`);
    await q.query(`DELETE FROM port_metrics`);
    await q.query(`DELETE FROM alarm_comments`);
    await q.query(`DELETE FROM alarms`);
    await q.query(`DELETE FROM incidents`);
    await q.query(`DELETE FROM injected_faults`);
    await q.query(`UPDATE simulation_state SET tick = 0 WHERE id = 1`);
    await q.query(`UPDATE cable_segments SET oper_status='UP'`);
    await q.query(`UPDATE nodes SET oper_status='UP'`);
    await q.query(`UPDATE ports SET oper_status='UP'`);
    await emitEvent(q, ctx, meta, { aggregateType: 'simulation', aggregateId: 'state', type: 'SIMULATION_RESET', simTick: 0 });
    await audit(q, ctx, meta, { action: 'simulation.reset', entityType: 'simulation' });
  });
}
