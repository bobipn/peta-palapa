/** Read models for the NOC v2 screens: device map, performance graphs, outages, alarm console. */
import type { Queryable } from '../db/db.js';
import type { Principal } from '../domain/rbac.js';
import { AppError, notFound } from '../lib/util.js';
import { audit, getSimState, simTimeOf, type Ctx, type Meta } from './context.js';
import { listDevices } from './netconfig.js';
import { injectFaults, restoreFault } from './simulation/engine.js';
import { NMS_NODE } from './simulation/noc.js';
import { listAlarms } from './assurance.js';

/** Logical device map: every device as a box, physical/logical links with current rates. */
export async function deviceMap(q: Queryable) {
  const sim = await getSimState(q);
  const devices = await listDevices(q);
  const metric = new Map((await q.query(`SELECT port_id, in_mbps, out_mbps, oper_status FROM port_metrics WHERE tick=$1`, [sim.tick])).rows.map((r) => [r.port_id, r]));
  const segs = (await q.query(`SELECT s.id, s.a_node_id, s.b_node_id, s.oper_status, s.provider_id, c.capacity_mbps FROM cable_segments s JOIN capacity_resources c ON c.segment_id=s.id ORDER BY s.id`)).rows;
  const ports = (await q.query(`SELECT id, equipment_id, name, kind, segment_id, peer_port_id, oper_status, admin_status, speed_mbps FROM ports`)).rows;
  const portById = new Map(ports.map((p) => [p.id, p]));
  const links: any[] = [];
  for (const s of segs) {
    const a = ports.find((p) => p.segment_id === s.id && p.equipment_id === `eq-${s.a_node_id.slice(3)}`);
    const m = a ? metric.get(a.id) : undefined;
    links.push({
      id: s.id, kind: 'CORE', a: `eq-${s.a_node_id.slice(3)}`, b: `eq-${s.b_node_id.slice(3)}`, aPort: a?.name, bPort: a?.peer_port_id ? portById.get(a.peer_port_id)?.name : null,
      status: s.oper_status, capacityMbps: s.capacity_mbps, inMbps: m?.in_mbps ?? 0, outMbps: m?.out_mbps ?? 0,
      utilisation: Math.max(m?.in_mbps ?? 0, m?.out_mbps ?? 0) / s.capacity_mbps, provider: s.provider_id,
    });
  }
  const seen = new Set<string>();
  for (const p of ports) {
    if (!p.peer_port_id || p.segment_id || seen.has(p.id)) continue;
    const peer = portById.get(p.peer_port_id);
    if (!peer) continue;
    seen.add(p.id); seen.add(peer.id);
    const m = metric.get(p.id) ?? metric.get(peer.id);
    const down = p.oper_status === 'DOWN' || peer.oper_status === 'DOWN';
    links.push({
      id: `${p.id}~${peer.id}`, kind: p.kind === 'MGMT' || peer.kind === 'MGMT' ? 'MGMT' : 'LOCAL', a: p.equipment_id, b: peer.equipment_id, aPort: p.name, bPort: peer.name,
      status: down ? 'DOWN' : 'UP', capacityMbps: Math.min(p.speed_mbps, peer.speed_mbps), inMbps: m?.in_mbps ?? 0, outMbps: m?.out_mbps ?? 0,
      utilisation: Math.max(m?.in_mbps ?? 0, m?.out_mbps ?? 0) / Math.max(1, Math.min(p.speed_mbps, peer.speed_mbps)),
    });
  }
  const nms = { id: 'nms', hostname: 'NMS-JKT (SIM)', role: 'NMS', city: 'Jakarta', location_id: 'jkt', node_id: NMS_NODE, reachable: true, mgmt_ip: '172.31.0.10/24' };
  links.push({ id: 'nms~jkt-sw', kind: 'MGMT', a: 'nms', b: 'eq-jkt-sw', aPort: 'eth0', bPort: 'GE0/0/24', status: 'UP', capacityMbps: 1000, inMbps: 2.1, outMbps: 0.6, utilisation: 0.002 });
  const locations = (await q.query(`SELECT id, city, lat, lon FROM locations ORDER BY id`)).rows;
  return { simulated: true, tick: sim.tick, simTime: simTimeOf(sim), devices: [nms, ...devices], links, locations };
}

/** Time series for one device (ping/loss/CPU/mem/poll) and its traffic-bearing interfaces. */
export async function deviceMetrics(q: Queryable, id: string, ticks: number, endTick?: number) {
  const dev = (await q.query(`SELECT id, hostname FROM equipment WHERE id=$1`, [id])).rows[0];
  if (!dev) throw notFound('Device');
  const sim = await getSimState(q);
  const to = Math.min(endTick ?? sim.tick, sim.tick);
  const from = Math.max(0, to - ticks + 1);
  const series = (await q.query(`SELECT tick, reachable, ping_ms, ping_loss_pct, cpu_pct, mem_pct, poll_ms FROM device_metrics WHERE equipment_id=$1 AND tick BETWEEN $2 AND $3 ORDER BY tick`, [id, from, to])).rows;
  const ports = (await q.query(`SELECT id, name, kind, description, speed_mbps FROM ports WHERE equipment_id=$1 AND kind IN ('LINE','CLIENT','UPLINK','UNI') ORDER BY kind, name`, [id])).rows;
  const pm = (await q.query(`SELECT port_id, tick, in_mbps, out_mbps, oper_status FROM port_metrics WHERE port_id = ANY($1) AND tick BETWEEN $2 AND $3 ORDER BY tick`, [ports.map((p) => p.id), from, to])).rows;
  const stats = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null && x !== undefined);
    if (!v.length) return null;
    return { current: v.at(-1)!, avg: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v) };
  };
  return {
    simulated: true, device: dev, fromTick: from, toTick: to, currentTick: sim.tick, tickSeconds: sim.tickSeconds,
    simTimeFrom: simTimeOf(sim, from), simTimeTo: simTimeOf(sim, to),
    series,
    summary: {
      ping: stats(series.map((s) => s.ping_ms)), loss: stats(series.map((s) => s.ping_loss_pct)), cpu: stats(series.map((s) => s.cpu_pct)),
      mem: stats(series.map((s) => s.mem_pct)), poll: stats(series.map((s) => s.poll_ms)),
      availabilityPct: series.length ? (series.filter((s) => s.reachable).length / series.length) * 100 : null,
    },
    interfaces: ports.map((p) => {
      const rows = pm.filter((r) => r.port_id === p.id);
      return { ...p, series: rows.map((r) => ({ tick: r.tick, in: r.in_mbps, out: r.out_mbps, status: r.oper_status })), in: stats(rows.map((r) => r.in_mbps)), out: stats(rows.map((r) => r.out_mbps)) };
    }),
  };
}

/** Device outages = consecutive ticks in which the NMS could not reach the device. */
export async function outages(q: Queryable) {
  const sim = await getSimState(q);
  const rows = (await q.query(`
    SELECT x.equipment_id, e.hostname, e.role, min(x.tick) AS start_tick, max(x.tick) AS end_tick, count(*)::int AS ticks
    FROM (SELECT equipment_id, tick, tick - row_number() OVER (PARTITION BY equipment_id ORDER BY tick) AS grp FROM device_metrics WHERE NOT reachable) x
    JOIN equipment e ON e.id = x.equipment_id
    GROUP BY x.equipment_id, e.hostname, e.role, x.grp ORDER BY min(x.tick) DESC, e.hostname LIMIT 300`)).rows;
  return rows.map((r) => ({
    ...r, ongoing: r.end_tick === sim.tick, durationSeconds: r.ticks * sim.tickSeconds,
    startedAt: simTimeOf(sim, r.start_tick), endedAt: r.end_tick === sim.tick ? null : simTimeOf(sim, r.end_tick + 1),
  }));
}

/** Probe view per device (ping / SNMP / SSH-like management checks), derived from the last sample. */
export async function probes(q: Queryable) {
  const devs = await listDevices(q);
  return devs.map((d) => ({
    deviceId: d.id, hostname: d.hostname, role: d.role, city: d.city, mgmtIp: d.mgmt_ip,
    ping: d.reachable === null || d.reachable === undefined ? 'UNKNOWN' : d.reachable ? 'UP' : 'DOWN',
    snmp: d.reachable ? 'UP' : d.reachable === false ? 'DOWN' : 'UNKNOWN',
    ssh: d.reachable ? 'UP' : d.reachable === false ? 'DOWN' : 'UNKNOWN',
    pingMs: d.ping_ms, lossPct: d.ping_loss_pct,
  }));
}

/** Administratively shut / no-shut an interface. Modelled as a PORT_DOWN fault so it flows through the same engine. */
export async function setPortAdmin(ctx: Ctx, meta: Meta, deviceId: string, portId: string, status: 'UP' | 'DOWN') {
  const port = (await ctx.db.query(`SELECT * FROM ports WHERE id=$1 AND equipment_id=$2`, [portId, deviceId])).rows[0];
  if (!port) throw notFound('Port');
  if (['LOOPBACK', 'SVI'].includes(port.kind)) throw new AppError(422, 'PORT_NOT_SHUTTABLE', `${port.kind} interfaces cannot be shut in the demo`);
  const active = (await ctx.db.query(`SELECT id FROM injected_faults WHERE state='ACTIVE' AND type='PORT_DOWN' AND target_id=$1`, [portId])).rows;
  if (status === 'DOWN') {
    if (active.length) return { status: 'DOWN', alreadyDown: true };
    const r = await injectFaults(ctx, meta, [{ type: 'PORT_DOWN', targetType: 'PORT', targetId: portId, params: { reason: 'admin shutdown' } }]);
    await ctx.db.query(`UPDATE ports SET admin_status='DOWN' WHERE id=$1`, [portId]);
    await audit(ctx.db, ctx, meta, { action: 'device.port.shutdown', entityType: 'port', entityId: portId });
    return { status: 'DOWN', incidentId: r.incidentId };
  }
  for (const f of active) await restoreFault(ctx, meta, f.id);
  await ctx.db.query(`UPDATE ports SET admin_status='UP' WHERE id=$1`, [portId]);
  await audit(ctx.db, ctx, meta, { action: 'device.port.no_shutdown', entityType: 'port', entityId: portId });
  return { status: 'UP' };
}

// ------------------------------------------------------------------ alarm console

export async function ackAlarms(ctx: Ctx, meta: Meta, ids: string[]) {
  return ctx.db.tx(async (q) => {
    const r = await q.query(`UPDATE alarms SET acknowledged=true, acked_by=$2, acked_at=$3 WHERE id = ANY($1) AND NOT acknowledged RETURNING id`, [ids, meta.actor!.email, ctx.clock.now()]);
    await audit(q, ctx, meta, { action: 'alarm.ack', entityType: 'alarm', details: { ids, acknowledged: r.rows.length } });
    return { acknowledged: r.rows.length };
  });
}

/** Manual clear. If the underlying condition persists, the engine raises it again on the next recompute (as an NMS would). */
export async function clearAlarm(ctx: Ctx, meta: Meta, id: string) {
  return ctx.db.tx(async (q) => {
    const sim = await getSimState(q);
    const r = await q.query(`UPDATE alarms SET state='CLEARED', cleared_tick=$2, cleared_by=$3 WHERE id=$1 AND state='ACTIVE' RETURNING id`, [id, sim.tick, meta.actor!.email]);
    if (!r.rows.length) throw new AppError(409, 'ALARM_NOT_ACTIVE', 'Alarm is not active');
    await audit(q, ctx, meta, { action: 'alarm.clear', entityType: 'alarm', entityId: id });
    return { cleared: true, note: 'If the fault condition persists the alarm will be re-raised on the next tick.' };
  });
}

export async function addAlarmComment(ctx: Ctx, meta: Meta, id: string, text: string) {
  return ctx.db.tx(async (q) => {
    const a = (await q.query(`SELECT id FROM alarms WHERE id=$1`, [id])).rows[0];
    if (!a) throw notFound('Alarm');
    await q.query(`INSERT INTO alarm_comments (alarm_id, author_id, text, created_at) VALUES ($1,$2,$3,$4)`, [id, meta.actor!.email, text, ctx.clock.now()]);
    await audit(q, ctx, meta, { action: 'alarm.comment', entityType: 'alarm', entityId: id });
    return (await q.query(`SELECT * FROM alarm_comments WHERE alarm_id=$1 ORDER BY id`, [id])).rows;
  });
}

export async function alarmDetail(q: Queryable, who: Principal, id: string) {
  const a = (await listAlarms(q, who)).find((x) => x.id === id);
  if (!a) throw notFound('Alarm');
  const comments = (await q.query(`SELECT * FROM alarm_comments WHERE alarm_id=$1 ORDER BY id`, [id])).rows;
  const sim = await getSimState(q);
  return { alarm: { ...a, raised_at: simTimeOf(sim, a.raised_tick), cleared_at: a.cleared_tick !== null ? simTimeOf(sim, a.cleared_tick) : null }, comments };
}

export async function alarmStats(q: Queryable, who: Principal) {
  const all = await listAlarms(q, who);
  const sim = await getSimState(q);
  const active = all.filter((a) => a.state === 'ACTIVE');
  const count = <K extends string>(rows: any[], key: (r: any) => K) => {
    const m = new Map<K, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
  };
  const perHour = new Map<number, number>();
  for (const a of all) {
    const h = Math.floor((a.raised_tick * sim.tickSeconds) / 3600);
    perHour.set(h, (perHour.get(h) ?? 0) + 1);
  }
  return {
    simulated: true,
    activeBySeverity: ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'].map((s) => ({ severity: s, n: active.filter((a) => a.severity === s).length, unacked: active.filter((a) => a.severity === s && !a.acknowledged).length })),
    byType: count(all, (a) => a.type),
    bySource: count(all, (a) => a.source_name ?? a.entity_id).slice(0, 15),
    perSimHour: [...perHour].sort((a, b) => a[0] - b[0]).map(([hour, n]) => ({ hour, n })),
    total: all.length,
  };
}

export async function alarmsCsv(q: Queryable, who: Principal, state?: string) {
  const sim = await getSimState(q);
  const rows = await listAlarms(q, who, state);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['severity', 'alarm_code', 'name', 'occurrence', 'state', 'acknowledged', 'raised_sim_time', 'cleared_sim_time', 'source', 'location', 'message', 'incident'];
  const lines = rows.map((a) => [
    a.severity, a.code, a.type, a.occurrence, a.state, a.acknowledged, simTimeOf(sim, a.raised_tick).toISOString(),
    a.cleared_tick !== null ? simTimeOf(sim, a.cleared_tick).toISOString() : '', a.source_name, a.location_info, a.message, a.incident_id,
  ].map(esc).join(','));
  return `# SIMULATED alarms export\n${head.join(',')}\n${lines.join('\n')}\n`;
}
