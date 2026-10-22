import type { Queryable } from '../db/db.js';
import { scopeFor, type Principal } from '../domain/rbac.js';
import { availability } from '../domain/sla.js';
import { conflict, notFound } from '../lib/util.js';
import { audit, getSimState, simTimeOf, type Ctx, type Meta } from './context.js';
import { computeNetState } from './simulation/engine.js';

/** Service visibility: customer -> own; provider -> services crossing its assets; staff -> all. */
function serviceScope(who: Principal, alias = 'sv', p = 1) {
  const s = scopeFor(who);
  if (s.customerId) return { sql: `${alias}.customer_id = $${p}`, params: [s.customerId] };
  if (s.providerId)
    return {
      sql: `EXISTS (SELECT 1 FROM service_paths sp JOIN cable_segments cs ON sp.segment_ids ? cs.id WHERE sp.service_id=${alias}.id AND cs.provider_id=$${p})`,
      params: [s.providerId],
    };
  return { sql: 'TRUE', params: [] as unknown[] };
}

export async function listServices(q: Queryable, who: Principal) {
  const sc = serviceScope(who);
  return (await q.query(
    `SELECT sv.*, sp.name AS sla_name, c.name AS customer_name, o.state AS order_state
     FROM services sv JOIN sla_profiles sp ON sp.id=sv.sla_profile_id JOIN customers c ON c.id=sv.customer_id JOIN orders o ON o.id=sv.order_id
     WHERE ${sc.sql} ORDER BY sv.created_at DESC`, sc.params)).rows;
}

export async function getService(q: Queryable, who: Principal, id: string) {
  const sc = serviceScope(who, 'sv', 2);
  const svc = (await q.query(
    `SELECT sv.*, sp.name AS sla_name, sp.latency_ms AS sla_latency_ms, sp.jitter_ms AS sla_jitter_ms, sp.loss_pct AS sla_loss_pct, sp.availability_pct AS sla_availability_pct, sp.note AS sla_note
     FROM services sv JOIN sla_profiles sp ON sp.id=sv.sla_profile_id WHERE sv.id=$1 AND ${sc.sql}`, [id, ...sc.params])).rows[0];
  if (!svc) throw notFound('Service');
  const paths = (await q.query(`SELECT * FROM service_paths WHERE service_id=$1 ORDER BY created_at`, [id])).rows;
  const tests = (await q.query(`SELECT * FROM service_tests WHERE service_id=$1 ORDER BY executed_at DESC, test_name LIMIT 60`, [id])).rows;
  const events = (await q.query(`SELECT * FROM domain_events WHERE aggregate_type='service' AND aggregate_id=$1 ORDER BY id DESC LIMIT 100`, [id])).rows;
  const alarms = (await q.query(`SELECT * FROM alarms WHERE entity_type='SERVICE' AND entity_id=$1 ORDER BY raised_tick DESC LIMIT 50`, [id])).rows;
  return { service: svc, paths, tests, events, alarms, sla: await slaForService(q, svc) };
}

async function slaForService(q: Queryable, svc: any) {
  const sim = await getSimState(q);
  const fromTick = svc.activated_sim_tick ?? 0;
  const samples = (await q.query(`SELECT tick, interval_s, state, outage_cause FROM telemetry_samples WHERE service_id=$1 ORDER BY tick`, [svc.id])).rows;
  const report = availability(
    samples.map((s) => ({ tick: s.tick, intervalS: s.interval_s, state: s.state, outageCause: s.outage_cause })),
    { fromTick: fromTick + 1, toTick: Math.max(sim.tick, fromTick + 1), tickSeconds: sim.tickSeconds },
    svc.sla_availability_pct ?? 99.9,
  );
  const breaches = (await q.query(`SELECT * FROM sla_breaches WHERE service_id=$1 ORDER BY started_tick DESC`, [svc.id])).rows.map((b) => ({
    ...b,
    open: b.ended_tick === null,
    durationSeconds: ((b.ended_tick ?? sim.tick) - b.started_tick) * sim.tickSeconds,
  }));
  return { ...report, breaches, simulated: true, note: 'Availability excludes scheduled maintenance and customer-side outage; time without samples is reported as noDataSeconds.' };
}

export async function telemetry(q: Queryable, who: Principal, id: string, fromTick?: number, toTick?: number) {
  await getService(q, who, id);
  const sim = await getSimState(q);
  const to = toTick ?? sim.tick;
  const from = fromTick ?? Math.max(0, to - 240);
  const rows = (await q.query(`SELECT tick, sim_time, latency_ms, jitter_ms, loss_pct, throughput_mbps, state, outage_cause, breaches, active_path
     FROM telemetry_samples WHERE service_id=$1 AND tick BETWEEN $2 AND $3 ORDER BY tick`, [id, from, to])).rows;
  return { simulated: true, fromTick: from, toTick: to, samples: rows };
}

export async function slaSummary(q: Queryable, who: Principal) {
  const services = await listServices(q, who);
  const out = [];
  for (const s of services.filter((x) => ['ACTIVE', 'DECOMMISSIONED'].includes(x.state) && x.activated_sim_tick !== null)) {
    const full = (await q.query(`SELECT sv.*, sp.availability_pct AS sla_availability_pct FROM services sv JOIN sla_profiles sp ON sp.id=sv.sla_profile_id WHERE sv.id=$1`, [s.id])).rows[0];
    const sla = await slaForService(q, full);
    const last = (await q.query(`SELECT latency_ms, jitter_ms, loss_pct, throughput_mbps, state FROM telemetry_samples WHERE service_id=$1 ORDER BY tick DESC LIMIT 1`, [s.id])).rows[0] ?? null;
    out.push({ serviceId: s.id, name: s.name, customer: s.customer_name, state: s.state, operStatus: s.oper_status, activePath: s.active_path, slaName: s.sla_name, last, ...sla });
  }
  return out;
}

export async function listAlarms(q: Queryable, who: Principal, state?: string) {
  const all = (await q.query(`SELECT * FROM alarms WHERE ($1::text IS NULL OR state=$1) ORDER BY state, raised_tick DESC, created_at DESC LIMIT 500`, [state ?? null])).rows;
  if (who.role === 'CUSTOMER' || who.role === 'PROVIDER') {
    const visible = new Set((await listServices(q, who)).map((s) => s.id));
    const ownSegs = who.role === 'PROVIDER'
      ? new Set((await q.query(`SELECT id FROM cable_segments WHERE provider_id=$1`, [who.providerId])).rows.map((r) => r.id))
      : new Set<string>();
    return all.filter((a) => (a.entity_type === 'SERVICE' && visible.has(a.entity_id)) || (a.entity_type === 'SEGMENT' && ownSegs.has(a.entity_id)) || (a.entity_type === 'PROVIDER' && a.entity_id === who.providerId));
  }
  return all;
}

export async function ackAlarm(ctx: Ctx, meta: Meta, id: string) {
  return ctx.db.tx(async (q) => {
    const r = await q.query(`UPDATE alarms SET acknowledged=true WHERE id=$1 RETURNING id`, [id]);
    if (r.rows.length === 0) throw notFound('Alarm');
    await audit(q, ctx, meta, { action: 'alarm.ack', entityType: 'alarm', entityId: id });
  });
}

export async function listIncidents(q: Queryable, who: Principal) {
  const rows = (await q.query(`SELECT * FROM incidents ORDER BY opened_tick DESC, created_at DESC LIMIT 200`)).rows;
  if (who.role === 'CUSTOMER') return rows.filter((r) => (r.impacted_customers ?? []).includes(who.customerId));
  if (who.role === 'PROVIDER') return rows.filter((r) => (r.impacted_providers ?? []).includes(who.providerId));
  return rows;
}

export async function getIncident(q: Queryable, who: Principal, id: string) {
  const inc = (await listIncidents(q, who)).find((r) => r.id === id);
  if (!inc) throw notFound('Incident');
  const sim = await getSimState(q);
  const events = (await q.query(`SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY id`, [id])).rows.map((e) => ({ ...e, sim_time: simTimeOf(sim, e.tick) }));
  const alarms = (await q.query(`SELECT * FROM alarms WHERE incident_id=$1 ORDER BY raised_tick`, [id])).rows;
  const faults = (await q.query(`SELECT * FROM injected_faults WHERE group_id=$1 ORDER BY created_at`, [inc.fault_group])).rows;
  const restorations = events
    .filter((e) => e.kind === 'SERVICE_RESTORED' || (e.kind === 'PROTECTION_SWITCH' && e.data.switchMs !== undefined))
    .map((e) => ({ serviceId: e.data.serviceId, seconds: e.kind === 'PROTECTION_SWITCH' ? e.data.switchMs / 1000 : e.data.restorationSeconds, tick: e.tick, via: e.kind === 'PROTECTION_SWITCH' ? 'protection switch' : 'restoration' }));
  return { incident: inc, events, alarms, faults, restorations, tickSeconds: sim.tickSeconds, simulated: true };
}

export async function nocOverview(q: Queryable, who: Principal) {
  const services = await listServices(q, who);
  const sim = await getSimState(q);
  const count = (f: (s: any) => boolean) => services.filter(f).length;
  const util = (await q.query(`SELECT s.id, s.provider_id, s.oper_status, c.capacity_mbps, c.reserved_mbps FROM cable_segments s JOIN capacity_resources c ON c.segment_id=s.id`)).rows;
  const totalCap = util.reduce((a, r) => a + r.capacity_mbps, 0);
  const totalRes = util.reduce((a, r) => a + r.reserved_mbps, 0);
  const sla = await slaSummary(q, who);
  const alarms = await listAlarms(q, who, 'ACTIVE');
  const incidents = (await listIncidents(q, who)).filter((i) => i.state !== 'RESOLVED');
  const orders = (await q.query(`SELECT state, count(*)::int n FROM orders GROUP BY state`)).rows;
  const providerImpact = new Map<string, number>();
  for (const i of incidents) for (const p of i.impacted_providers ?? []) providerImpact.set(p, (providerImpact.get(p) ?? 0) + 1);
  return {
    simulated: true,
    sim: { tick: sim.tick, simTime: simTimeOf(sim), tickSeconds: sim.tickSeconds, seed: sim.seed, autoTick: sim.autoTick },
    services: {
      total: services.length,
      active: count((s) => s.state === 'ACTIVE'),
      provisioning: count((s) => ['DESIGNED', 'RESERVED', 'PROVISIONING', 'CONFIGURED', 'TESTING'].includes(s.state)),
      up: count((s) => s.state === 'ACTIVE' && s.oper_status === 'UP'),
      degraded: count((s) => s.state === 'ACTIVE' && s.oper_status === 'DEGRADED'),
      down: count((s) => s.state === 'ACTIVE' && s.oper_status === 'DOWN'),
      onProtection: count((s) => s.state === 'ACTIVE' && s.active_path !== 'PRIMARY'),
    },
    sla: {
      measured: sla.filter((s) => s.availabilityPct !== null).length,
      compliant: sla.filter((s) => s.met === true && !s.breaches.some((b: any) => b.open)).length,
      openBreaches: sla.reduce((a, s) => a + s.breaches.filter((b: any) => b.open).length, 0),
    },
    network: {
      segments: util.length,
      segmentsDown: util.filter((r) => r.oper_status === 'DOWN').length,
      segmentsDegraded: util.filter((r) => r.oper_status === 'DEGRADED').length,
      capacityMbps: who.role === 'CUSTOMER' ? null : totalCap,
      reservedMbps: who.role === 'CUSTOMER' ? null : totalRes,
      utilisation: who.role === 'CUSTOMER' ? null : totalCap ? totalRes / totalCap : 0,
    },
    alarms: {
      active: alarms.length,
      bySeverity: ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'].map((s) => ({ severity: s, n: alarms.filter((a) => a.severity === s).length })),
    },
    incidents: { open: incidents.length, customersImpacted: new Set(incidents.flatMap((i) => i.impacted_customers ?? [])).size, providerImpact: [...providerImpact].map(([providerId, n]) => ({ providerId, incidents: n })) },
    orders: who.role === 'CUSTOMER' || who.role === 'PROVIDER' ? null : orders,
  };
}

export async function runServiceTests(ctx: Ctx, meta: Meta, who: Principal, id: string) {
  const { service } = await getService(ctx.db, who, id);
  if (!service.sim_handle) throw conflict('NOT_PROVISIONED', 'Service has no virtual instance yet');
  const results = await ctx.sim.runConnectivityTest(service.sim_handle);
  const runId = `run-${Date.now()}`;
  await ctx.db.tx(async (q) => {
    for (const r of results) {
      await q.query(
        `INSERT INTO service_tests (id, service_id, run_id, test_name, status, simulated, input, threshold, result, reason, executed_at) VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10)`,
        [`${runId}-${r.testName}`, id, runId, r.testName, r.status, JSON.stringify(r.input), r.threshold ? JSON.stringify(r.threshold) : null, r.result ? JSON.stringify(r.result) : null, r.reason, ctx.clock.now()],
      );
    }
    await audit(q, ctx, meta, { action: 'service.tests.run', entityType: 'service', entityId: id });
  });
  return { runId, results };
}

// ------------------------------------------------------------------ live provisioning view

export type LiveNodeState = 'PENDING' | 'BOOTING' | 'CONFIGURED' | 'TESTING' | 'ACTIVE' | 'STANDBY' | 'DOWN' | 'OFF';
export type LiveLinkState = 'PLANNED' | 'RESERVED' | 'LINK_UP' | 'ACTIVE' | 'STANDBY' | 'DOWN' | 'OFF';

/**
 * Per-node / per-link state of one service, derived on the server from the
 * persisted provisioning task (its node bring-up plan), the service lifecycle
 * and the active simulated faults. The UI only renders it.
 */
export async function serviceLive(ctx: Ctx, who: Principal, id: string) {
  const q = ctx.db;
  const { service: svc, paths } = await getService(q, who, id);
  const order = (await q.query(`SELECT id, state, state_reason FROM orders WHERE id=$1`, [svc.order_id])).rows[0];
  const wf = (await q.query(`SELECT id, state FROM provisioning_workflows WHERE service_id=$1 ORDER BY created_at DESC LIMIT 1`, [id])).rows[0];
  const prov = wf ? (await q.query(`SELECT state, result, started_at FROM provisioning_tasks WHERE workflow_id=$1 AND type='PROVISION_VIRTUAL'`, [wf.id])).rows[0] : null;
  const plan = new Map<string, number>(((prov?.result?.nodePlan ?? []) as { nodeId: string; readyAt: string }[]).map((p) => [p.nodeId, new Date(p.readyAt).getTime()]));
  const ns = await computeNetState(q);
  const now = ctx.clock.now().getTime();

  const live = paths.filter((p: any) => p.status !== 'RELEASED');
  const shown = live.length ? live : paths.filter((p: any) => p.role !== 'REROUTE');
  const activeRole = svc.active_path ?? 'PRIMARY';
  const activePath = shown.find((p: any) => p.role === activeRole) ?? shown.find((p: any) => p.role === 'PRIMARY');
  const carrying = new Set<string>(activePath?.node_ids ?? []);
  const carryingSegs = new Set<string>(activePath?.segment_ids ?? []);
  const nodeIds: string[] = [...new Set<string>(shown.flatMap((p: any) => p.node_ids))];
  const segIds: string[] = [...new Set<string>(shown.flatMap((p: any) => p.segment_ids))];

  const nodeRows = (await q.query(
    `SELECT n.id, n.name, n.role, p.kind AS pop_kind, p.name AS pop_name, l.id AS location_id, l.city, l.lat, l.lon, e.model, e.vendor
     FROM nodes n JOIN pops p ON p.id=n.pop_id JOIN locations l ON l.id=p.location_id LEFT JOIN equipment e ON e.node_id=n.id WHERE n.id = ANY($1)`, [nodeIds])).rows;
  const segRows = (await q.query(
    `SELECT s.id, s.a_node_id, s.b_node_id, s.length_km, pr.name AS provider_name FROM cable_segments s JOIN providers pr ON pr.id=s.provider_id WHERE s.id = ANY($1)`, [segIds])).rows;
  const committed = new Set((await q.query(`SELECT segment_id FROM reservations WHERE order_id=$1 AND status <> 'RELEASED'`, [svc.order_id])).rows.map((r) => r.segment_id));

  const pendingReady = [...plan.entries()].filter(([, t]) => t > now).sort((a, b) => a[1] - b[1]);
  const booting = pendingReady[0]?.[0] ?? null;

  const nodeState = (n: string): LiveNodeState => {
    switch (svc.state) {
      case 'ACTIVE':
        if (ns.nodeDown.has(n)) return 'DOWN';
        return carrying.has(n) ? 'ACTIVE' : 'STANDBY';
      case 'FAILED':
      case 'DECOMMISSIONED':
        return 'OFF';
      case 'CONFIGURED':
      case 'TESTING':
        return 'TESTING';
      case 'PROVISIONING': {
        const t = plan.get(n);
        if (t === undefined) return 'PENDING';
        if (t <= now) return 'CONFIGURED';
        return n === booting ? 'BOOTING' : 'PENDING';
      }
      default:
        return 'PENDING';
    }
  };
  const states = new Map(nodeIds.map((n) => [n, nodeState(n)]));
  const UP: LiveNodeState[] = ['CONFIGURED', 'TESTING', 'ACTIVE', 'STANDBY'];

  const links = segRows.map((s) => {
    const a = states.get(s.a_node_id)!, b = states.get(s.b_node_id)!;
    let state: LiveLinkState;
    if (['FAILED', 'DECOMMISSIONED'].includes(svc.state)) state = 'OFF';
    else if (ns.segDown.has(s.id)) state = 'DOWN';
    else if (svc.state === 'ACTIVE') state = carryingSegs.has(s.id) ? 'ACTIVE' : 'STANDBY';
    else if (UP.includes(a) && UP.includes(b)) state = 'LINK_UP';
    else state = committed.has(s.id) ? 'RESERVED' : 'PLANNED';
    const roles = shown.filter((p: any) => p.segment_ids.includes(s.id)).map((p: any) => p.role);
    return { id: s.id, aNodeId: s.a_node_id, bNodeId: s.b_node_id, lengthKm: s.length_km, provider: s.provider_name, roles, state };
  });

  const nodes = nodeIds.map((n) => {
    const r = nodeRows.find((x) => x.id === n)!;
    const t = plan.get(n);
    return {
      id: n, name: r.name, city: r.city, lat: r.lat, lon: r.lon, popKind: r.pop_kind, popName: r.pop_name,
      device: { model: r.model ?? 'SIM-OTN', vendor: r.vendor ?? 'SIMULATED', role: r.role },
      state: states.get(n)!,
      onActivePath: carrying.has(n),
      roles: shown.filter((p: any) => p.node_ids.includes(n)).map((p: any) => p.role),
      readyAt: t ? new Date(t).toISOString() : null,
      secondsToReady: t && t > now ? Math.ceil((t - now) / 1000) : 0,
    };
  });
  const up = nodes.filter((n) => UP.includes(n.state)).length;
  return {
    simulated: true,
    serviceId: id,
    serviceName: svc.name,
    serviceState: svc.state,
    operStatus: svc.oper_status,
    activePath: svc.active_path,
    order,
    workflowState: wf?.state ?? null,
    provisioningTask: prov ? { state: prov.state, startedAt: prov.started_at } : null,
    progress: { nodesUp: up, nodesTotal: nodes.length, pct: nodes.length ? Math.round((up / nodes.length) * 100) : 0 },
    nodes,
    links,
    serverTime: new Date(now).toISOString(),
    note: 'Node bring-up is simulated (Mode A): each device "boots" and receives configuration in sequence; no real equipment is touched.',
  };
}
