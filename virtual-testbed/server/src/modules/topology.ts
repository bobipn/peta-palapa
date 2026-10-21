import type { Queryable } from '../db/db.js';
import type { Topology } from '../domain/routing.js';
import type { Principal } from '../domain/rbac.js';
import { notFound } from '../lib/util.js';

export async function loadGraph(q: Queryable): Promise<Topology> {
  const nodes = (await q.query(`SELECT id, admin_status, oper_status FROM nodes ORDER BY id`)).rows.map((n) => ({
    id: n.id,
    up: n.admin_status === 'UP' && n.oper_status !== 'DOWN',
  }));
  const segs = (
    await q.query(`
      SELECT s.*, c.capacity_mbps, c.reserved_mbps, p.eligible
      FROM cable_segments s JOIN capacity_resources c ON c.segment_id = s.id JOIN providers p ON p.id = s.provider_id
      ORDER BY s.id`)
  ).rows;
  return {
    nodes,
    segments: segs.map((s) => ({
      id: s.id,
      a: s.a_node_id,
      b: s.b_node_id,
      providerId: s.provider_id,
      providerEligible: s.eligible,
      up: s.admin_status === 'UP' && s.oper_status !== 'DOWN',
      availableMbps: s.capacity_mbps - s.reserved_mbps,
      latencyMs: s.base_latency_ms,
      lengthKm: s.length_km,
      pricePerGbpsMonth: s.price_per_gbps_month,
      setupFee: s.setup_fee,
      srlg: s.srlg,
    })),
  };
}

export async function nodeForLocation(q: Queryable, locationId: string): Promise<string> {
  const r = await q.query(`SELECT n.id FROM nodes n JOIN pops p ON p.id = n.pop_id WHERE p.location_id = $1 ORDER BY n.id LIMIT 1`, [locationId]);
  if (!r.rows[0]) throw notFound(`Location ${locationId}`);
  return r.rows[0].id;
}

export async function listLocations(q: Queryable) {
  return (await q.query(`SELECT l.*, p.kind AS pop_kind, p.name AS pop_name FROM locations l LEFT JOIN pops p ON p.location_id = l.id ORDER BY l.city`)).rows;
}

/**
 * Topology for the UI. Providers see every span's geometry and status, but
 * capacity, price and reservations only for their own assets.
 */
export async function topologyView(q: Queryable, who: Principal) {
  const locations = await listLocations(q);
  const nodes = (await q.query(`SELECT n.*, p.location_id, p.kind AS pop_kind, p.name AS pop_name FROM nodes n JOIN pops p ON p.id = n.pop_id ORDER BY n.id`)).rows;
  const providers = (await q.query(`SELECT id, code, name, eligible, auto_accept, is_demo FROM providers ORDER BY code`)).rows;
  const systems = (await q.query(`SELECT * FROM cable_systems ORDER BY name`)).rows;
  const segs = (
    await q.query(`
      SELECT s.*, c.capacity_mbps, c.reserved_mbps,
        (SELECT count(*)::int FROM alarms a WHERE a.state='ACTIVE' AND a.entity_type='SEGMENT' AND a.entity_id = s.id) AS active_alarms
      FROM cable_segments s JOIN capacity_resources c ON c.segment_id = s.id ORDER BY s.id`)
  ).rows;
  const faults = (await q.query(`SELECT * FROM injected_faults WHERE state='ACTIVE' ORDER BY created_at`)).rows;
  const own = (pid: string) => who.role !== 'PROVIDER' || who.providerId === pid;
  return {
    simulated: true,
    label: 'SIMULATED TOPOLOGY — fictional providers and cable systems; straight lines are schematic, not cable routes',
    locations,
    nodes,
    providers,
    cableSystems: systems,
    segments: segs.map((s) => ({
      id: s.id,
      cableSystemId: s.cable_system_id,
      providerId: s.provider_id,
      aNodeId: s.a_node_id,
      bNodeId: s.b_node_id,
      lengthKm: s.length_km,
      baseLatencyMs: s.base_latency_ms,
      srlg: s.srlg,
      adminStatus: s.admin_status,
      operStatus: s.oper_status,
      activeAlarms: s.active_alarms,
      capacityMbps: own(s.provider_id) ? s.capacity_mbps : null,
      reservedMbps: own(s.provider_id) ? s.reserved_mbps : null,
      utilisation: own(s.provider_id) ? s.reserved_mbps / s.capacity_mbps : null,
      pricePerGbpsMonth: own(s.provider_id) ? s.price_per_gbps_month : null,
    })),
    activeFaults: faults,
  };
}

export async function nodeDetail(q: Queryable, id: string) {
  const node = (await q.query(`SELECT n.*, p.location_id, p.name AS pop_name, p.kind AS pop_kind FROM nodes n JOIN pops p ON p.id=n.pop_id WHERE n.id=$1`, [id])).rows[0];
  if (!node) throw notFound('Node');
  const equipment = (await q.query(`SELECT * FROM equipment WHERE node_id=$1`, [id])).rows;
  const ports = (await q.query(`SELECT p.* FROM ports p JOIN equipment e ON e.id=p.equipment_id WHERE e.node_id=$1 ORDER BY p.id`, [id])).rows;
  return { node, equipment, ports, simulated: true };
}

export async function segmentDetail(q: Queryable, id: string, who: Principal) {
  const s = (await q.query(`SELECT s.*, c.capacity_mbps, c.reserved_mbps, cs.name AS cable_system_name, cs.kind AS cable_kind
    FROM cable_segments s JOIN capacity_resources c ON c.segment_id=s.id JOIN cable_systems cs ON cs.id=s.cable_system_id WHERE s.id=$1`, [id])).rows[0];
  if (!s) throw notFound('Segment');
  const own = who.role !== 'PROVIDER' || who.providerId === s.provider_id;
  const channels = (await q.query(`SELECT * FROM optical_channels WHERE segment_id=$1 ORDER BY channel_no`, [id])).rows;
  const reservations = own
    ? (await q.query(`SELECT id, order_id, service_id, mbps, role, status, created_at FROM reservations WHERE segment_id=$1 AND status <> 'RELEASED' ORDER BY created_at`, [id])).rows
    : [];
  const services = (await q.query(
    `SELECT DISTINCT sv.id, sv.name, sv.oper_status, sp.role, sp.status FROM service_paths sp JOIN services sv ON sv.id = sp.service_id
     WHERE sp.segment_ids ? $1 AND sp.status IN ('ACTIVE','STANDBY') ORDER BY sv.id`, [id])).rows;
  const alarms = (await q.query(`SELECT * FROM alarms WHERE entity_type='SEGMENT' AND entity_id=$1 ORDER BY raised_tick DESC LIMIT 20`, [id])).rows;
  return {
    segment: { ...s, capacity_mbps: own ? s.capacity_mbps : null, reserved_mbps: own ? s.reserved_mbps : null, price_per_gbps_month: own ? s.price_per_gbps_month : null },
    opticalChannels: channels,
    reservations,
    services: who.role === 'PROVIDER' && !own ? [] : services,
    alarms,
    simulated: true,
  };
}
