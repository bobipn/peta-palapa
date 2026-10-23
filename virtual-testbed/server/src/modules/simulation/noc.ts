/**
 * NOC v2 simulation helpers: management-network (DCN) reachability from the
 * NMS, alarm enrichment (code / source / location, NMS-console style) and the
 * per-tick device & interface performance samples. All values are SIMULATED and
 * derived deterministically from (seed, tick, inventory, faults).
 */
import type { Queryable } from '../../db/db.js';
import { seededUnit } from '../../lib/util.js';
import { demandFactor } from '../../domain/telemetry-model.js';
import type { SimState } from '../context.js';
import type { NetState } from './engine.js';

/** The simulated NMS polls everything from the Jakarta PoP. */
export const NMS_NODE = 'nd-jkt';
/** Keep this many ticks of device/port metrics (24 h of simulated time at 60 s/tick). */
export const METRICS_RETENTION_TICKS = 1440;

export const ALARM_CODES: Record<string, number> = {
  LOS: 3001, NODE_UNREACHABLE: 3002, PORT_DOWN: 3003, DEVICE_UNREACHABLE: 3004, CAPACITY_EXHAUSTED: 3010,
  HIGH_LATENCY: 3011, PACKET_LOSS: 3012, PROVIDER_API_UNREACHABLE: 4001, PROVISIONING_DEGRADED: 4002,
  MAINTENANCE: 5001, CUSTOMER_SIDE_DOWN: 6001, SERVICE_DOWN: 7001, ON_PROTECTION: 7002, ON_REROUTE: 7003,
  SLA_BREACH_LATENCY: 7101, SLA_BREACH_JITTER: 7102, SLA_BREACH_LOSS: 7103,
};

/** Nodes the NMS can reach in-band over up spans, with round-trip time (ms) from the NMS. */
export async function dcnReachability(q: Queryable, ns: NetState) {
  const segs = (await q.query(`SELECT id, a_node_id, b_node_id, base_latency_ms FROM cable_segments WHERE admin_status='UP'`)).rows
    .filter((s) => !ns.segDown.has(s.id) && !ns.nodeDown.has(s.a_node_id) && !ns.nodeDown.has(s.b_node_id));
  const adj = new Map<string, { to: string; ms: number }[]>();
  for (const s of segs) {
    const ms = s.base_latency_ms + (ns.addLatency.get(s.id) ?? 0);
    adj.set(s.a_node_id, [...(adj.get(s.a_node_id) ?? []), { to: s.b_node_id, ms }]);
    adj.set(s.b_node_id, [...(adj.get(s.b_node_id) ?? []), { to: s.a_node_id, ms }]);
  }
  const dist = new Map<string, number>();
  if (!ns.nodeDown.has(NMS_NODE)) dist.set(NMS_NODE, 0);
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null, best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) { best = d; u = n; }
    if (u === null) break;
    done.add(u);
    for (const e of adj.get(u) ?? []) if (best + e.ms < (dist.get(e.to) ?? Infinity)) dist.set(e.to, best + e.ms);
  }
  return { rttMs: new Map([...dist].map(([n, d]) => [n, 2 * d])), reachable: new Set(dist.keys()) };
}

/** Devices the NMS cannot manage although their node is up (DCN isolation or mgmt port down). */
export async function unreachableDevices(q: Queryable, ns: NetState) {
  const { reachable } = await dcnReachability(q, ns);
  const devs = (await q.query(`SELECT e.id, e.hostname, e.node_id, (SELECT p.id FROM ports p WHERE p.equipment_id=e.id AND p.kind='MGMT' ORDER BY p.id LIMIT 1) AS mgmt_port
                               FROM equipment e WHERE e.hostname IS NOT NULL ORDER BY e.id`)).rows;
  return devs.filter((d) => !ns.nodeDown.has(d.node_id) && (!reachable.has(d.node_id) || (d.mgmt_port && ns.portDown.has(d.mgmt_port))));
}

/** Source (NE) name and location string for an alarm, in the style of an NMS alarm list. */
export async function alarmContext(q: Queryable, type: string, entityType: string, entityId: string) {
  let source = entityId;
  let location = '-';
  if (entityType === 'SEGMENT') {
    const r = (await q.query(`SELECT s.id, e.hostname, p.name AS port, s.b_node_id FROM cable_segments s JOIN equipment e ON e.node_id=s.a_node_id AND e.role='OTN'
                               LEFT JOIN ports p ON p.segment_id=s.id AND p.equipment_id=e.id WHERE s.id=$1`, [entityId])).rows[0];
    if (r) { source = r.hostname; location = `0-Shelf-1-${r.port ?? 'LINE'}(IN/OUT to ${r.b_node_id.replace('nd-', '').toUpperCase()})-OTS:1 [${r.id}]`; }
  } else if (entityType === 'NODE') {
    const r = (await q.query(`SELECT hostname FROM equipment WHERE node_id=$1 AND role='OTN'`, [entityId])).rows[0];
    if (r) { source = r.hostname; location = 'NE (all boards)'; }
  } else if (entityType === 'PORT') {
    const r = (await q.query(`SELECT e.hostname, p.name, p.kind FROM ports p JOIN equipment e ON e.id=p.equipment_id WHERE p.id=$1`, [entityId])).rows[0];
    if (r) { source = r.hostname; location = `0-Shelf-1-${r.name}(${r.kind})`; }
  } else if (entityType === 'DEVICE') {
    const r = (await q.query(`SELECT hostname, mgmt_ip FROM equipment WHERE id=$1`, [entityId])).rows[0];
    if (r) { source = r.hostname; location = `DCN mgmt ${r.mgmt_ip ?? ''}`; }
  } else if (entityType === 'PROVIDER') {
    const r = (await q.query(`SELECT name FROM providers WHERE id=$1`, [entityId])).rows[0];
    if (r) { source = r.name; location = 'Order interface (Sonata MOCK)'; }
  } else if (entityType === 'SERVICE') {
    const r = (await q.query(`SELECT s.name, c.s_vlan, e.hostname, p.name AS port FROM services s
       LEFT JOIN service_configs c ON c.service_id=s.id AND c.role='A_END' AND c.status='APPLIED' LEFT JOIN equipment e ON e.id=c.equipment_id LEFT JOIN ports p ON p.id=c.port_id
       WHERE s.id=$1`, [entityId])).rows[0];
    if (r) { source = r.hostname ?? r.name; location = `${r.name}${r.port ? ` · ${r.port}` : ''}${r.s_vlan ? ` · S-VLAN ${r.s_vlan}` : ''}`; }
  }
  const occ = (await q.query(`SELECT count(*)::int AS n FROM alarms WHERE type=$1 AND entity_type=$2 AND entity_id=$3`, [type, entityType, entityId])).rows[0].n + 1;
  return { code: ALARM_CODES[type] ?? 9000, source, location, occurrence: occ };
}

/**
 * Per-tick device & interface samples (SIMULATED):
 *  device: reachable from NMS, ping RTT = 2 x in-band latency + noise, occasional
 *          small loss spikes, CPU/memory = base + load from services + diurnal + noise.
 *  port:   traffic = sum of throughput of active services crossing it this tick.
 */
export async function recordNocMetrics(q: Queryable, ns: NetState, sim: SimState, throughput: Map<string, number>) {
  const { rttMs, reachable } = await dcnReachability(q, ns);
  const unreach = new Set((await unreachableDevices(q, ns)).map((d) => d.id));
  const devs = (await q.query(`SELECT e.id, e.role, e.node_id, (SELECT count(DISTINCT c.service_id)::int FROM service_configs c WHERE c.equipment_id=e.id AND c.status='APPLIED') AS svc
                               FROM equipment e WHERE e.hostname IS NOT NULL ORDER BY e.id`)).rows;
  const hours = ((sim.tick * sim.tickSeconds) / 3600) % 24;
  const diurnal = 0.5 + 0.5 * Math.sin(((hours - 8) / 24) * 2 * Math.PI);
  const dv: unknown[] = [];
  const dRows: string[] = [];
  for (const d of devs) {
    const u = (k: string) => seededUnit(sim.seed, `${d.id}:${k}:${sim.tick}`);
    const ok = !ns.nodeDown.has(d.node_id) && reachable.has(d.node_id) && !unreach.has(d.id);
    const base = d.role === 'OTN' ? 12 : d.role === 'PE' ? 8 : 4;
    const cpu = ok ? Math.min(99, base + d.svc * 1.5 + diurnal * 6 + u('c') * 4 + (u('s') > 0.985 ? 25 : 0)) : null;
    const mem = ok ? Math.min(98, (d.role === 'OTN' ? 38 : d.role === 'PE' ? 46 : 22) + d.svc * 0.6 + u('m') * 2) : null;
    const ping = ok ? (rttMs.get(d.node_id) ?? 0) + 0.3 + u('p') * 0.8 + (u('q') > 0.97 ? u('r') * 15 : 0) : null;
    const loss = !ok ? 100 : u('l') > 0.97 ? Math.round(u('k') * 3 * 100) / 100 : 0;
    const poll = ok ? 180 + (ping ?? 0) * 3 + u('t') * 60 : null;
    const i = dv.length;
    dRows.push(`($${i + 1},$${i + 2},$${i + 3},$${i + 4},$${i + 5},$${i + 6},$${i + 7},$${i + 8})`);
    dv.push(d.id, sim.tick, ok, ping, loss, cpu, mem, poll);
  }
  if (dRows.length) await q.query(`INSERT INTO device_metrics (equipment_id, tick, reachable, ping_ms, ping_loss_pct, cpu_pct, mem_pct, poll_ms) VALUES ${dRows.join(',')} ON CONFLICT DO NOTHING`, dv);

  // Port traffic from active services.
  const active = (await q.query(`SELECT sp.service_id, sp.segment_ids FROM service_paths sp JOIN services s ON s.id=sp.service_id WHERE s.state='ACTIVE' AND sp.status='ACTIVE'`)).rows;
  const segLoad = new Map<string, number>();
  for (const a of active) for (const sId of a.segment_ids as string[]) segLoad.set(sId, (segLoad.get(sId) ?? 0) + (throughput.get(a.service_id) ?? 0));
  const ends = (await q.query(`SELECT c.service_id, c.port_id, c.equipment_id FROM service_configs c JOIN services s ON s.id=c.service_id WHERE s.state='ACTIVE' AND c.status='APPLIED' AND c.role <> 'TRANSIT'`)).rows;
  const portLoad = new Map<string, number>();
  for (const e of ends) {
    const t = throughput.get(e.service_id) ?? 0;
    const loc = e.equipment_id.replace(/^eq-/, '').replace(/-pe$/, '');
    portLoad.set(e.port_id, (portLoad.get(e.port_id) ?? 0) + t);
    for (const p of [`pt-${loc}-pe-up1`, `pt-${loc}-otn-c1`]) portLoad.set(p, (portLoad.get(p) ?? 0) + t);
  }
  const ports = (await q.query(`SELECT id, kind, segment_id, oper_status FROM ports WHERE kind IN ('LINE','CLIENT','UPLINK','UNI','MGMT') ORDER BY id`)).rows;
  const pv: unknown[] = [];
  const pRows: string[] = [];
  for (const p of ports) {
    const down = ns.portDown.has(p.id) || (p.segment_id && ns.segDown.has(p.segment_id));
    let load = p.kind === 'LINE' ? segLoad.get(p.segment_id) ?? 0 : p.kind === 'MGMT' ? 0.4 + seededUnit(sim.seed, `${p.id}:mg:${sim.tick}`) * 0.6 : portLoad.get(p.id) ?? 0;
    if (down) load = 0;
    const a = seededUnit(sim.seed, `${p.id}:in:${sim.tick}`), b = seededUnit(sim.seed, `${p.id}:out:${sim.tick}`);
    const i = pv.length;
    pRows.push(`($${i + 1},$${i + 2},$${i + 3},$${i + 4},$${i + 5})`);
    pv.push(p.id, sim.tick, down ? 'DOWN' : 'UP', Math.round(load * (0.96 + a * 0.04) * 100) / 100, Math.round(load * (0.9 + b * 0.08) * 100) / 100);
  }
  if (pRows.length) await q.query(`INSERT INTO port_metrics (port_id, tick, oper_status, in_mbps, out_mbps) VALUES ${pRows.join(',')} ON CONFLICT DO NOTHING`, pv);

  if (sim.tick % 60 === 0) {
    await q.query(`DELETE FROM device_metrics WHERE tick < $1`, [sim.tick - METRICS_RETENTION_TICKS]);
    await q.query(`DELETE FROM port_metrics WHERE tick < $1`, [sim.tick - METRICS_RETENTION_TICKS]);
  }
}

export { demandFactor };
