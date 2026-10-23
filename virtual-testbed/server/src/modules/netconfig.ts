/**
 * NOC v2 — device inventory, IP address management (IPAM), VLAN allocation and
 * per-service network configuration. Everything here is SIMULATED:
 *  - device models, hostnames and serials are fictional ("SIM-…");
 *  - the address plan uses private ranges chosen for the demo (172.31.0.0/16
 *    management, 10.255.0.0/24 loopbacks, 10.240.0.0/16 customer test /30s) and
 *    is not any operator's real plan;
 *  - rendered configuration is vendor-neutral pseudo-CLI for illustration; it is
 *    never pushed anywhere and is not valid for any real device OS.
 *
 * Allocation safety: VLANs, UNI ports and IPs are guarded by partial unique
 * indexes (see migration 003), so concurrent allocations cannot double-assign.
 */
import type { Db, Queryable } from '../db/db.js';
import type { Principal } from '../domain/rbac.js';
import { AppError, newId, notFound, type Clock } from '../lib/util.js';
import { scopeFor } from '../domain/rbac.js';
import { SimulationError } from './simulation/adapter.js';

export const UNI_PORTS_PER_PE = 8;
export const S_VLAN_RANGE: [number, number] = [1001, 3999];
export const MGMT_VLAN = 99;

const up = (loc: string) => loc.toUpperCase();
export const peId = (loc: string) => `eq-${loc}-pe`;
export const swId = (loc: string) => `eq-${loc}-sw`;
export const otnId = (loc: string) => `eq-${loc}`;
const locOfNode = (nodeId: string) => nodeId.replace(/^nd-/, '');

// ------------------------------------------------------------------ inventory bootstrap

/**
 * Creates the v2 inventory (PE router + management switch per PoP, extra
 * ports, address plan, management VLAN) if it does not exist yet, then
 * back-fills network config for ACTIVE services provisioned before v2.
 * Idempotent; runs at startup and after every demo seed.
 */
export async function ensureInventoryV2(db: Db, clock: Clock) {
  const has = (await db.query(`SELECT 1 FROM equipment WHERE role='PE' LIMIT 1`)).rows.length > 0;
  if (!has) {
    await db.tx(async (q) => {
      const now = clock.now();
      const pools = [
        ['pool-mgmt', 'Management (DCN) — SIMULATED', '172.31.0.0/16', 'MGMT', 24],
        ['pool-lo', 'Router loopbacks — SIMULATED', '10.255.0.0/24', 'LOOPBACK', 32],
        ['pool-ctest', 'Customer test subnets (/30) — SIMULATED', '10.240.0.0/16', 'CUSTOMER_TEST', 30],
      ] as const;
      for (const [id, name, cidr, purpose, len] of pools) {
        await q.query(`INSERT INTO ip_pools (id, name, cidr, purpose, prefix_len) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [id, name, cidr, purpose, len]);
      }
      const locs = (await q.query(`SELECT l.id FROM locations l JOIN pops p ON p.location_id=l.id ORDER BY l.id`)).rows.map((r) => r.id as string);
      let i = 0;
      for (const loc of locs) {
        i++;
        const L = up(loc);
        const mgmt = (host: number) => `172.31.${i}.${host}`;
        const ipAlloc = (pool: string, address: string, type: 'DEVICE' | 'PORT', id: string, desc: string) =>
          q.query(`INSERT INTO ip_allocations (id, pool_id, address, assigned_type, assigned_id, description, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'ALLOCATED',$7)`,
            [newId('ip'), pool, address, type, id, desc, now]);

        // OTN (existing equipment row from v1 seed)
        await q.query(`UPDATE equipment SET hostname=$2, role='OTN', mgmt_ip=$3, os_version='SIM-OTN-OS 4.2', serial=$4 WHERE id=$1`,
          [otnId(loc), `${L}-OTN-01`, `${mgmt(11)}/24`, `SIMO${String(i).padStart(4, '0')}`]);
        const lines = (await q.query(`SELECT p.id, p.segment_id, s.a_node_id, s.b_node_id FROM ports p JOIN cable_segments s ON s.id=p.segment_id WHERE p.equipment_id=$1 ORDER BY p.id`, [otnId(loc)])).rows;
        let k = 0;
        for (const ln of lines) {
          k++;
          const peer = locOfNode(ln.a_node_id === `nd-${loc}` ? ln.b_node_id : ln.a_node_id);
          await q.query(`UPDATE ports SET kind='LINE', mode='OPTICAL', name=$2, description=$3, peer_port_id=$4 WHERE id=$1`,
            [ln.id, `LINE-1/${k}/1`, `to ${up(peer)}-OTN-01 via ${ln.segment_id}`, `pt-${peer}-${ln.segment_id}`]);
        }
        const port = (id: string, eq: string, name: string, kind: string, mode: string, speed: number, desc: string, peer: string | null, ip: string | null) =>
          q.query(`INSERT INTO ports (id, equipment_id, name, segment_id, speed_mbps, admin_status, oper_status, kind, mode, description, peer_port_id, ip_address)
                   VALUES ($1,$2,$3,NULL,$4,'UP','UP',$5,$6,$7,$8,$9)`, [id, eq, name, speed, kind, mode, desc, peer, ip]);
        await port(`pt-${loc}-otn-c1`, otnId(loc), 'CLIENT-1/0/1', 'CLIENT', 'OPTICAL', 100_000, `to ${L}-PE-01 100GE0/0/1`, `pt-${loc}-pe-up1`, null);
        await port(`pt-${loc}-otn-mgmt`, otnId(loc), 'MGMT-0', 'MGMT', 'ROUTED', 1000, `to ${L}-MSW-01 GE0/0/2`, `pt-${loc}-sw-2`, `${mgmt(11)}/24`);
        await ipAlloc('pool-mgmt', `${mgmt(11)}/24`, 'DEVICE', otnId(loc), `${L}-OTN-01 management`);

        // PE router
        await q.query(`INSERT INTO equipment (id, node_id, model, vendor, kind, hostname, role, mgmt_ip, loopback_ip, os_version, serial)
                       VALUES ($1,$2,'SIM-PE-R8','SIMULATED','ROUTER',$3,'PE',$4,$5,'SIM-ROS 7.1',$6)`,
          [peId(loc), `nd-${loc}`, `${L}-PE-01`, `${mgmt(12)}/24`, `10.255.0.${i}/32`, `SIMR${String(i).padStart(4, '0')}`]);
        await port(`pt-${loc}-pe-up1`, peId(loc), '100GE0/0/1', 'UPLINK', 'TRUNK', 100_000, `to ${L}-OTN-01 CLIENT-1/0/1`, `pt-${loc}-otn-c1`, null);
        for (let u = 1; u <= UNI_PORTS_PER_PE; u++) {
          await port(`pt-${loc}-pe-uni${u}`, peId(loc), `10GE0/1/${u}`, 'UNI', 'ACCESS', 10_000, 'UNI — free', null, null);
        }
        await port(`pt-${loc}-pe-mgmt`, peId(loc), 'MEth0/0/0', 'MGMT', 'ROUTED', 1000, `to ${L}-MSW-01 GE0/0/1`, `pt-${loc}-sw-1`, `${mgmt(12)}/24`);
        await port(`pt-${loc}-pe-lo0`, peId(loc), 'LoopBack0', 'LOOPBACK', 'ROUTED', 0, 'router-id', null, `10.255.0.${i}/32`);
        await ipAlloc('pool-mgmt', `${mgmt(12)}/24`, 'DEVICE', peId(loc), `${L}-PE-01 management`);
        await ipAlloc('pool-lo', `10.255.0.${i}/32`, 'DEVICE', peId(loc), `${L}-PE-01 loopback`);

        // Management switch
        await q.query(`INSERT INTO equipment (id, node_id, model, vendor, kind, hostname, role, mgmt_ip, os_version, serial)
                       VALUES ($1,$2,'SIM-MSW-24','SIMULATED','SWITCH',$3,'MGMT_SWITCH',$4,'SIM-SWOS 2.8',$5)`,
          [swId(loc), `nd-${loc}`, `${L}-MSW-01`, `${mgmt(13)}/24`, `SIMS${String(i).padStart(4, '0')}`]);
        await port(`pt-${loc}-sw-1`, swId(loc), 'GE0/0/1', 'MGMT', 'ACCESS', 1000, `to ${L}-PE-01 MEth0/0/0`, `pt-${loc}-pe-mgmt`, null);
        await port(`pt-${loc}-sw-2`, swId(loc), 'GE0/0/2', 'MGMT', 'ACCESS', 1000, `to ${L}-OTN-01 MGMT-0`, `pt-${loc}-otn-mgmt`, null);
        await port(`pt-${loc}-sw-vlan99`, swId(loc), 'Vlanif99', 'SVI', 'ROUTED', 0, 'management SVI (gateway .1 SIMULATED)', null, `${mgmt(13)}/24`);
        await ipAlloc('pool-mgmt', `${mgmt(13)}/24`, 'DEVICE', swId(loc), `${L}-MSW-01 management`);

        for (const eq of [peId(loc), swId(loc)]) {
          await q.query(`INSERT INTO vlan_allocations (id, equipment_id, vlan_id, kind, description, status, created_at) VALUES ($1,$2,$3,'MGMT','DCN management','ALLOCATED',$4)`,
            [newId('vl'), eq, MGMT_VLAN, now]);
        }
      }
    });
  }
  // Back-fill: services activated before v2 get their handoff config now.
  const missing = (await db.query(`SELECT s.id FROM services s WHERE s.state='ACTIVE' AND NOT EXISTS (SELECT 1 FROM service_configs c WHERE c.service_id=s.id AND c.status='APPLIED')`)).rows;
  for (const m of missing) {
    try {
      await db.tx((q) => allocateServiceConfig(q, m.id, clock.now()));
    } catch {
      /* no free UNI port etc.; the service keeps running without a rendered config */
    }
  }
}

// ------------------------------------------------------------------ per-service allocation

function testSubnet(k: number) {
  const base = k * 4;
  const o3 = Math.floor(base / 256), o4 = base % 256;
  return { net: `10.240.${o3}.${o4}/30`, a: `10.240.${o3}.${o4 + 1}`, b: `10.240.${o3}.${o4 + 2}` };
}

/**
 * Allocate UNI ports, a common S-VLAN on both end PEs, a /30 test subnet and
 * render configs for every device on the service's paths. Must run inside a
 * transaction; throws SimulationError (non-retryable) when resources run out.
 */
export async function allocateServiceConfig(q: Queryable, serviceId: string, now: Date) {
  const existing = (await q.query(`SELECT count(*)::int n FROM service_configs WHERE service_id=$1 AND status='APPLIED'`, [serviceId])).rows[0].n;
  if (existing > 0) return { idempotentReplay: true };
  const svc = (await q.query(
    `SELECT s.*, c.name AS customer_name, pr.code AS product_code
     FROM services s JOIN customers c ON c.id=s.customer_id JOIN orders o ON o.id=s.order_id JOIN quotes qt ON qt.id=o.quote_id JOIN products pr ON pr.id=qt.product_id
     WHERE s.id=$1`, [serviceId])).rows[0];
  if (!svc) throw notFound('Service');
  const paths = (await q.query(`SELECT * FROM service_paths WHERE service_id=$1 AND role IN ('PRIMARY','PROTECTION') ORDER BY role`, [serviceId])).rows;
  const primary = paths.find((p) => p.role === 'PRIMARY');
  if (!primary) throw new SimulationError('NO_PATH', 'Service has no primary path');
  const aLoc = locOfNode(primary.node_ids[0]);
  const bLoc = locOfNode(primary.node_ids.at(-1));
  const isWave = svc.product_code === 'WAVE';

  const freeUni = async (loc: string) => (await q.query(
    `SELECT p.id, p.name FROM ports p WHERE p.equipment_id=$1 AND p.kind='UNI' AND p.admin_status='UP'
       AND NOT EXISTS (SELECT 1 FROM service_configs c WHERE c.port_id=p.id AND c.status='APPLIED' AND c.role <> 'TRANSIT')
     ORDER BY p.id LIMIT 1`, [peId(loc)])).rows[0];
  const uniA = await freeUni(aLoc);
  const uniB = await freeUni(bLoc);
  if (!uniA || !uniB) throw new SimulationError('NO_FREE_UNI_PORT', `No free customer handoff port on ${!uniA ? up(aLoc) : up(bLoc)}-PE-01 (${UNI_PORTS_PER_PE} UNI ports per PE in the demo)`);

  let sVlan: number | null = null;
  if (!isWave) {
    const used = new Set((await q.query(`SELECT vlan_id FROM vlan_allocations WHERE status='ALLOCATED' AND equipment_id = ANY($1)`, [[peId(aLoc), peId(bLoc)]])).rows.map((r) => r.vlan_id));
    for (let v = S_VLAN_RANGE[0]; v <= S_VLAN_RANGE[1]; v++) if (!used.has(v)) { sVlan = v; break; }
    if (sVlan === null) throw new SimulationError('VLAN_EXHAUSTED', 'No free S-VLAN common to both end PEs');
    for (const [loc, uni] of [[aLoc, uniA], [bLoc, uniB]] as const) {
      await q.query(`INSERT INTO vlan_allocations (id, equipment_id, port_id, vlan_id, kind, service_id, description, status, created_at) VALUES ($1,$2,$3,$4,'S_VLAN',$5,$6,'ALLOCATED',$7)`,
        [newId('vl'), peId(loc), uni.id, sVlan, serviceId, `${svc.name}`, now]);
    }
  }
  const cVlan = isWave ? null : svc.product_code === 'EVPL' ? '100' : 'all (port-based)';

  const usedNets = new Set((await q.query(`SELECT address FROM ip_allocations WHERE pool_id='pool-ctest' AND status='ALLOCATED'`)).rows.map((r) => r.address));
  let k = 0;
  while (usedNets.has(testSubnet(k).net)) k++;
  const tn = testSubnet(k);
  await q.query(`INSERT INTO ip_allocations (id, pool_id, address, assigned_type, assigned_id, service_id, description, status, created_at) VALUES ($1,'pool-ctest',$2,'SERVICE',$3,$3,$4,'ALLOCATED',$5)`,
    [newId('ip'), tn.net, serviceId, `${svc.name} CE test: A=${tn.a} B=${tn.b}`, now]);

  const bwM = svc.bandwidth_mbps;
  const header = (host: string) => `! SIMULATED CONFIG — illustrative only, not valid for any real device\n! device ${host}  service ${serviceId}\n`;
  for (const [role, loc, uni, ceIp] of [['A_END', aLoc, uniA, tn.a], ['B_END', bLoc, uniB, tn.b]] as const) {
    const host = `${up(loc)}-PE-01`;
    const cfg = header(host) + [
      `interface ${uni.name}`,
      ` description CUST:${svc.customer_name} SVC:${serviceId} ${svc.product_code} ${bwM}M`,
      ` mtu 9216`,
      isWave ? ` transceiver lambda-passthrough` : svc.product_code === 'EVPL' ? ` encapsulation dot1q ${cVlan} second-dot1q-push ${sVlan}` : ` encapsulation dot1q-tunnel s-vlan ${sVlan}`,
      ` service-policy input POLICE-${bwM}M`,
      ` no shutdown`,
      `!`,
      `l2vpn xconnect ${serviceId}`,
      ` member ${uni.name}${isWave ? '' : ` s-vlan ${sVlan}`}`,
      ` member 100GE0/0/1.${sVlan ?? 0}`,
      ` transport otn path ${primary.segment_ids.join(' > ')}`,
      paths.find((p) => p.role === 'PROTECTION') ? ` protection 1+1 path ${paths.find((p) => p.role === 'PROTECTION').segment_ids.join(' > ')}` : ` protection none (restoration reroute)`,
      `!`,
      `! CE test address (customer side, for activation ping): ${ceIp}/30`,
    ].join('\n');
    await q.query(`INSERT INTO service_configs (id, service_id, equipment_id, port_id, role, path_role, s_vlan, c_vlan, mtu, rendered_config, status, created_at) VALUES ($1,$2,$3,$4,$5,'PRIMARY',$6,$7,9216,$8,'APPLIED',$9)`,
      [newId('cfg'), serviceId, peId(loc), uni.id, role, sVlan, cVlan, cfg, now]);
    await q.query(`UPDATE ports SET description=$2 WHERE id=$1`, [uni.id, `UNI — ${svc.customer_name} ${serviceId}`]);
  }
  for (const p of paths) {
    for (let i = 0; i < p.node_ids.length; i++) {
      const loc = locOfNode(p.node_ids[i]);
      const west = i > 0 ? p.segment_ids[i - 1] : null;
      const east = i < p.segment_ids.length ? p.segment_ids[i] : null;
      const kind = !west || !east ? 'add-drop' : 'pass-through';
      const cfg = header(`${up(loc)}-OTN-01`) + [
        `odu-xconnect ${serviceId}-${p.role.toLowerCase()}`,
        ` type ${kind} odu ${bwM >= 10_000 ? 'ODU2' : 'ODUflex'} ${bwM}M`,
        west ? ` west line-port toward ${west}` : ` west client CLIENT-1/0/1 (to ${up(loc)}-PE-01)`,
        east ? ` east line-port toward ${east}` : ` east client CLIENT-1/0/1 (to ${up(loc)}-PE-01)`,
        ` path-role ${p.role.toLowerCase()}`,
        `!`,
      ].join('\n');
      await q.query(`INSERT INTO service_configs (id, service_id, equipment_id, port_id, role, path_role, s_vlan, c_vlan, mtu, rendered_config, status, created_at) VALUES ($1,$2,$3,NULL,'TRANSIT',$4,$5,NULL,NULL,$6,'APPLIED',$7)`,
        [newId('cfg'), serviceId, otnId(loc), p.role, sVlan, cfg, now]);
    }
  }
  return { aUni: uniA.name, bUni: uniB.name, sVlan, cVlan, testSubnet: tn };
}

/** Undo allocateServiceConfig. Idempotent. */
export async function releaseServiceConfig(q: Queryable, serviceId: string, now: Date) {
  const ports = (await q.query(`UPDATE service_configs SET status='REMOVED', removed_at=$2 WHERE service_id=$1 AND status='APPLIED' RETURNING port_id`, [serviceId, now])).rows;
  for (const p of ports) if (p.port_id) await q.query(`UPDATE ports SET description='UNI — free' WHERE id=$1`, [p.port_id]);
  await q.query(`UPDATE vlan_allocations SET status='RELEASED', released_at=$2 WHERE service_id=$1 AND status='ALLOCATED'`, [serviceId, now]);
  await q.query(`UPDATE ip_allocations SET status='RELEASED', released_at=$2 WHERE service_id=$1 AND status='ALLOCATED'`, [serviceId, now]);
  return ports.length;
}

/** Ports whose failure takes a service down: its UNI ports and the uplinks of its end PEs. */
export async function servicePortDependencies(q: Queryable, serviceId: string): Promise<string[]> {
  const rows = (await q.query(`SELECT port_id, equipment_id FROM service_configs WHERE service_id=$1 AND status='APPLIED' AND role <> 'TRANSIT'`, [serviceId])).rows;
  return rows.flatMap((r) => [r.port_id, `pt-${r.equipment_id.replace(/^eq-/, '').replace(/-pe$/, '')}-pe-up1`]);
}

// ------------------------------------------------------------------ read models

export async function serviceNetwork(q: Queryable, who: Principal, serviceId: string) {
  const scope = scopeFor(who);
  const svc = (await q.query(`SELECT id, customer_id, name FROM services WHERE id=$1`, [serviceId])).rows[0];
  if (!svc || (scope.customerId && svc.customer_id !== scope.customerId)) throw notFound('Service');
  const configs = (await q.query(
    `SELECT c.*, e.hostname, e.mgmt_ip, p.name AS port_name FROM service_configs c JOIN equipment e ON e.id=c.equipment_id LEFT JOIN ports p ON p.id=c.port_id
     WHERE c.service_id=$1 ORDER BY c.status, CASE c.role WHEN 'A_END' THEN 0 WHEN 'B_END' THEN 1 ELSE 2 END, c.path_role, c.created_at`, [serviceId])).rows;
  const vlans = (await q.query(`SELECT v.*, e.hostname FROM vlan_allocations v JOIN equipment e ON e.id=v.equipment_id WHERE v.service_id=$1 ORDER BY v.created_at`, [serviceId])).rows;
  const ips = (await q.query(`SELECT * FROM ip_allocations WHERE service_id=$1 ORDER BY created_at`, [serviceId])).rows;
  const isCustomer = who.role === 'CUSTOMER';
  return {
    simulated: true,
    handoff: configs.filter((c) => c.role !== 'TRANSIT' && c.status === 'APPLIED').map((c) => ({
      end: c.role === 'A_END' ? 'A' : 'B', device: c.hostname, port: c.port_name, sVlan: c.s_vlan, cVlan: c.c_vlan, mtu: c.mtu,
    })),
    testSubnet: ips.find((i) => i.status === 'ALLOCATED')?.address ?? null,
    testIps: ips.find((i) => i.status === 'ALLOCATED')?.description ?? null,
    vlans,
    configs: isCustomer ? [] : configs,
    note: 'SIMULATED address/VLAN plan and pseudo-CLI. Nothing is pushed to real equipment.',
  };
}

export async function listDevices(q: Queryable) {
  const t = (await q.query(`SELECT tick FROM simulation_state WHERE id=1`)).rows[0].tick;
  return (await q.query(
    `SELECT e.*, n.oper_status AS node_status, l.city, l.id AS location_id,
       m.reachable, m.ping_ms, m.ping_loss_pct, m.cpu_pct, m.mem_pct,
       (SELECT count(*)::int FROM ports p WHERE p.equipment_id=e.id) AS ports,
       (SELECT count(*)::int FROM ports p WHERE p.equipment_id=e.id AND p.oper_status='DOWN') AS ports_down,
       (SELECT count(DISTINCT c.service_id)::int FROM service_configs c WHERE c.equipment_id=e.id AND c.status='APPLIED') AS services,
       (SELECT count(*)::int FROM alarms a WHERE a.state='ACTIVE' AND a.source_name=e.hostname) AS active_alarms
     FROM equipment e JOIN nodes n ON n.id=e.node_id JOIN pops po ON po.id=n.pop_id JOIN locations l ON l.id=po.location_id
     LEFT JOIN device_metrics m ON m.equipment_id=e.id AND m.tick=$1
     WHERE e.hostname IS NOT NULL ORDER BY l.city, e.role`, [t])).rows;
}

export async function deviceDetail(q: Queryable, id: string) {
  const dev = (await listDevices(q)).find((d) => d.id === id);
  if (!dev) throw notFound('Device');
  const t = (await q.query(`SELECT tick FROM simulation_state WHERE id=1`)).rows[0].tick;
  const ports = (await q.query(
    `SELECT p.*, pm.in_mbps, pm.out_mbps,
       (SELECT string_agg(v.vlan_id::text, ',' ORDER BY v.vlan_id) FROM vlan_allocations v WHERE v.port_id=p.id AND v.status='ALLOCATED') AS vlans,
       (SELECT c.service_id FROM service_configs c WHERE c.port_id=p.id AND c.status='APPLIED' LIMIT 1) AS service_id,
       (SELECT f.id FROM injected_faults f WHERE f.state='ACTIVE' AND f.type='PORT_DOWN' AND f.target_id=p.id LIMIT 1) AS shutdown_fault_id
     FROM ports p LEFT JOIN port_metrics pm ON pm.port_id=p.id AND pm.tick=$2 WHERE p.equipment_id=$1 ORDER BY p.kind, p.name`, [id, t])).rows;
  const vlans = (await q.query(`SELECT v.*, p.name AS port_name, s.name AS service_name FROM vlan_allocations v LEFT JOIN ports p ON p.id=v.port_id LEFT JOIN services s ON s.id=v.service_id
     WHERE v.equipment_id=$1 AND v.status='ALLOCATED' ORDER BY v.vlan_id`, [id])).rows;
  const services = (await q.query(`SELECT DISTINCT s.id, s.name, s.state, s.oper_status, c.role, c.path_role FROM service_configs c JOIN services s ON s.id=c.service_id
     WHERE c.equipment_id=$1 AND c.status='APPLIED' ORDER BY s.name`, [id])).rows;
  const alarms = (await q.query(`SELECT * FROM alarms WHERE source_name=$1 ORDER BY state, raised_tick DESC LIMIT 50`, [dev.hostname])).rows;
  return { device: dev, ports, vlans, services, alarms, runningConfig: await renderRunningConfig(q, id), simulated: true };
}

export async function renderRunningConfig(q: Queryable, id: string) {
  const e = (await q.query(`SELECT * FROM equipment WHERE id=$1`, [id])).rows[0];
  if (!e) throw notFound('Device');
  const ports = (await q.query(`SELECT * FROM ports WHERE equipment_id=$1 ORDER BY kind, name`, [id])).rows;
  const vlans = (await q.query(`SELECT * FROM vlan_allocations WHERE equipment_id=$1 AND status='ALLOCATED' ORDER BY vlan_id`, [id])).rows;
  const svc = (await q.query(`SELECT rendered_config FROM service_configs WHERE equipment_id=$1 AND status='APPLIED' ORDER BY created_at`, [id])).rows;
  const out = [
    `! ===== SIMULATED RUNNING CONFIG — ${e.hostname} (${e.model}, ${e.os_version}) =====`,
    `! Illustrative pseudo-CLI generated by the virtual testbed. Not valid for any real device OS.`,
    `hostname ${e.hostname}`,
    `!`,
    ...(e.role === 'OTN' ? [] : vlans.filter((v) => v.kind !== 'C_VLAN').map((v) => `vlan ${v.vlan_id}\n name ${v.kind === 'MGMT' ? 'DCN-MGMT' : (v.description ?? 'svc').replace(/\s+/g, '_').slice(0, 32)}`)),
    `!`,
    ...ports.map((p) => [
      `interface ${p.name}`,
      p.description ? ` description ${p.description}` : null,
      p.ip_address ? ` ip address ${p.ip_address}` : null,
      p.mtu && p.kind !== 'LOOPBACK' && p.kind !== 'SVI' ? ` mtu ${p.mtu}` : null,
      p.mode === 'TRUNK' ? ` switchport mode trunk` : null,
      p.admin_status === 'DOWN' ? ` shutdown` : ` no shutdown`,
      `!`,
    ].filter(Boolean).join('\n')),
    ...(e.mgmt_ip ? [`ip route 0.0.0.0/0 ${e.mgmt_ip.replace(/\.\d+\/24$/, '.1')}   ! DCN default (SIMULATED)`, `snmp-server community ******** ro   ! placeholder`, `!`] : []),
    ...svc.map((s) => s.rendered_config.split('\n').filter((l: string) => !l.startsWith('! SIMULATED CONFIG') && !l.startsWith('! device ')).join('\n')),
  ];
  return out.join('\n');
}

export async function ipam(q: Queryable) {
  const pools = (await q.query(`SELECT * FROM ip_pools ORDER BY id`)).rows;
  const allocs = (await q.query(
    `SELECT a.*, COALESCE(e.hostname, s.name) AS assigned_name FROM ip_allocations a LEFT JOIN equipment e ON e.id=a.assigned_id LEFT JOIN services s ON s.id=a.assigned_id
     ORDER BY a.status, a.pool_id, a.address`)).rows;
  const capacity = (p: any) => {
    const hostBits = Number(p.cidr.split('/')[1]);
    return 2 ** (p.prefix_len - hostBits); // number of blocks of size prefix_len in the pool
  };
  return {
    simulated: true,
    pools: pools.map((p) => {
      const used = allocs.filter((a) => a.pool_id === p.id && a.status === 'ALLOCATED').length;
      return { ...p, used, capacity: capacity(p), utilisation: used / capacity(p) };
    }),
    allocations: allocs,
  };
}

export async function vlanTable(q: Queryable) {
  return (await q.query(
    `SELECT v.*, e.hostname, l.city, p.name AS port_name, s.name AS service_name FROM vlan_allocations v JOIN equipment e ON e.id=v.equipment_id
     JOIN nodes n ON n.id=e.node_id JOIN pops po ON po.id=n.pop_id JOIN locations l ON l.id=po.location_id
     LEFT JOIN ports p ON p.id=v.port_id LEFT JOIN services s ON s.id=v.service_id
     ORDER BY v.status, v.vlan_id, e.hostname`)).rows;
}

export function assertPortAdminChange(port: any, role: string) {
  if (!port) throw notFound('Port');
  if (['LOOPBACK', 'SVI'].includes(port.kind)) throw new AppError(422, 'PORT_NOT_SHUTTABLE', `${port.kind} interfaces cannot be shut in the demo`);
  if (!['ADMIN', 'NOC'].includes(role)) throw new AppError(403, 'FORBIDDEN', 'Only NOC/Admin can change port state');
}
