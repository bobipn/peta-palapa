import type { Db } from '../../db/db.js';
import type { Clock } from '../../lib/util.js';
import { getSettings, getSimState, systemMeta, type Ctx } from '../context.js';
import { capacityConsistency } from '../capacity.js';
import type { AdapterStatus, FaultSpec, NetworkSimulationAdapter, ValidationResult, VirtualServiceSpec } from './adapter.js';
import { SimulationError } from './adapter.js';
import { computeNetState, injectFaults, providerFaultActive, resetSimulation, restoreFault, sampleService } from './engine.js';

/**
 * Mode A: deterministic service/network simulation. No packets are sent; all
 * results are computed from the inventory, the active faults and the seeded
 * telemetry model, and are labelled SIMULATED.
 */
export class DeterministicSimulationAdapter implements NetworkSimulationAdapter {
  constructor(private deps: { db: Db; clock: Clock; ctx: () => Ctx }) {}

  async status(): Promise<AdapterStatus> {
    return {
      name: 'Deterministic service/network simulation (Mode A)',
      mode: 'DETERMINISTIC',
      available: true,
      label: 'SIMULATED',
      detail: 'Rule-based + seeded synthetic metrics. No real packets, devices or optical physics.',
    };
  }

  async createVirtualService(spec: VirtualServiceSpec) {
    const { db, clock } = this.deps;
    if (await providerFaultActive(db, 'PROVISIONING_FAILURE', spec.providerIds)) {
      throw new SimulationError('PROVISIONING_FAILED', 'Simulated provisioning failure on a provider in the path (fault injected)', false);
    }
    const ns = await computeNetState(db);
    const down = spec.primarySegmentIds.filter((s) => ns.segDown.has(s));
    if (down.length) throw new SimulationError('PATH_DOWN', `Cannot provision over down segment(s): ${down.join(', ')}`, true);
    const settings = await getSettings(db);
    // Nodes are brought up one after another (simulated device boot + config push).
    const start = clock.now().getTime();
    const step = settings.provisioning_delay_s_per_node * 1000;
    const nodePlan = spec.nodeIds.map((nodeId, i) => ({ nodeId, readyAt: new Date(start + (i + 1) * step) }));
    return {
      handle: `vsvc-${spec.serviceId}`,
      readyAt: nodePlan.at(-1)?.readyAt ?? new Date(start),
      nodePlan,
    };
  }

  async activateService(handle: string) {
    const svc = await this.serviceByHandle(handle);
    const path = await this.primaryPath(svc.id);
    const ns = await computeNetState(this.deps.db);
    if (path.segment_ids.some((s: string) => ns.segDown.has(s))) throw new SimulationError('PATH_DOWN', 'Primary path is down; cannot activate', true);
  }

  async deactivateService(_handle: string) {
    /* Mode A keeps no per-service emulator state beyond the database. */
  }

  async getServiceStatus(handle: string) {
    const svc = await this.serviceByHandle(handle);
    return { handle, state: svc.state, activePath: svc.active_path, operStatus: svc.oper_status };
  }

  /** Activation / on-demand validation suite. Every result is marked simulated. */
  async runConnectivityTest(handle: string): Promise<ValidationResult[]> {
    const db = this.deps.db;
    const svc = await this.serviceByHandle(handle);
    const sla = (await db.query(`SELECT * FROM sla_profiles WHERE id=$1`, [svc.sla_profile_id])).rows[0];
    const paths = (await db.query(`SELECT * FROM service_paths WHERE service_id=$1 AND status <> 'RELEASED' ORDER BY created_at`, [svc.id])).rows;
    const primary = paths.find((p) => p.role === 'PRIMARY');
    const protection = paths.find((p) => p.role === 'PROTECTION');
    const quote = (await db.query(`SELECT q.route FROM orders o JOIN quotes q ON q.id=o.quote_id WHERE o.id=$1`, [svc.order_id])).rows[0];
    const ns = await computeNetState(db);
    const sim = await getSimState(db);
    const settings = await getSettings(db);
    const out: ValidationResult[] = [];
    const r = (t: Omit<ValidationResult, 'simulated'>) => out.push({ ...t, simulated: true });

    const pathUp = (p: any) => !!p && p.segment_ids.every((s: string) => !ns.segDown.has(s)) && p.node_ids.every((n: string) => !ns.nodeDown.has(n));
    const reach = pathUp(primary);
    r({
      testName: 'ENDPOINT_REACHABILITY', status: reach ? 'PASS' : 'FAIL',
      input: { from: primary?.node_ids[0], to: primary?.node_ids.at(-1) }, threshold: null,
      result: { reachable: reach }, reason: reach ? 'All segments and nodes on the primary path are up' : 'A segment or node on the primary path is down',
    });

    const expected: string[] = quote?.route?.primary?.segmentIds ?? [];
    const contiguous = primary ? isContiguous(primary.node_ids, primary.segment_ids, await this.segEnds(primary.segment_ids)) : false;
    const pathOk = !!primary && JSON.stringify(primary.segment_ids) === JSON.stringify(expected) && contiguous;
    r({
      testName: 'EXPECTED_PATH', status: pathOk ? 'PASS' : 'FAIL',
      input: { expectedSegments: expected }, threshold: null, result: { actualSegments: primary?.segment_ids ?? [], contiguous },
      reason: pathOk ? 'Provisioned path matches quoted path and is contiguous A→B' : 'Provisioned path differs from quote or is not contiguous',
    });

    const rsv = (await db.query(`SELECT segment_id, mbps, role, status FROM reservations WHERE service_id=$1 AND status='COMMITTED'`, [svc.id])).rows;
    const cir = (primary?.segment_ids ?? []).every((s: string) => rsv.some((x) => x.segment_id === s && x.role === 'PRIMARY' && x.mbps >= svc.bandwidth_mbps));
    r({
      testName: 'BANDWIDTH_PROFILE', status: cir ? 'PASS' : 'FAIL',
      input: { bandwidthMbps: svc.bandwidth_mbps }, threshold: { committedMbpsPerSegment: svc.bandwidth_mbps },
      result: { committed: rsv.filter((x) => x.role === 'PRIMARY').map((x) => ({ segmentId: x.segment_id, mbps: x.mbps })) },
      reason: cir ? 'Committed capacity >= service bandwidth on every primary segment' : 'Missing or insufficient committed capacity on a primary segment',
    });

    if (reach && primary) {
      const s = await sampleService(db, svc, primary, ns, sim, settings);
      r({
        testName: 'LATENCY_THRESHOLD', status: (s.latencyMs ?? Infinity) <= sla.latency_ms ? 'PASS' : 'FAIL',
        input: { tick: sim.tick }, threshold: { latencyMs: sla.latency_ms }, result: { latencyMs: s.latencyMs },
        reason: `Simulated one-way latency ${s.latencyMs} ms vs target ${sla.latency_ms} ms`,
      });
      r({
        testName: 'PACKET_LOSS_THRESHOLD', status: (s.lossPct ?? Infinity) <= sla.loss_pct ? 'PASS' : 'FAIL',
        input: { tick: sim.tick }, threshold: { lossPct: sla.loss_pct }, result: { lossPct: s.lossPct },
        reason: `Simulated loss ${s.lossPct} % vs target ${sla.loss_pct} %`,
      });
    } else {
      for (const t of ['LATENCY_THRESHOLD', 'PACKET_LOSS_THRESHOLD']) {
        r({ testName: t, status: 'NOT_RUN', input: {}, threshold: null, result: null, reason: 'Skipped: endpoints not reachable' });
      }
    }

    if (svc.protection === 'PROTECTED') {
      const pOk = pathUp(protection) && (protection?.segment_ids ?? []).every((s: string) => rsv.some((x) => x.segment_id === s && x.role === 'PROTECTION'));
      r({
        testName: 'PROTECTION_PATH_STATUS', status: pOk ? 'PASS' : 'FAIL',
        input: { protectionSegments: protection?.segment_ids ?? [] }, threshold: null, result: { up: pathUp(protection), reserved: pOk },
        reason: pOk ? 'Protection path is up and its capacity is committed' : 'Protection path down or capacity not committed',
      });
    } else {
      r({ testName: 'PROTECTION_PATH_STATUS', status: 'NOT_RUN', input: {}, threshold: null, result: null, reason: 'Service ordered without protection' });
    }

    const handoff = (await db.query(`SELECT c.role, c.s_vlan, c.c_vlan, p.name AS port, e.hostname FROM service_configs c JOIN equipment e ON e.id=c.equipment_id LEFT JOIN ports p ON p.id=c.port_id
                                      WHERE c.service_id=$1 AND c.status='APPLIED' AND c.role <> 'TRANSIT' ORDER BY c.role`, [svc.id])).rows;
    const handoffOk = handoff.length === 2 && handoff.every((h) => h.port);
    r({
      testName: 'HANDOFF_CONFIG', status: handoffOk ? 'PASS' : 'FAIL',
      input: {}, threshold: { endpoints: 2 }, result: { handoff },
      reason: handoffOk ? `UNI ports ${handoff.map((h) => `${h.hostname} ${h.port}`).join(' / ')}${handoff[0].s_vlan ? `, S-VLAN ${handoff[0].s_vlan}` : ''} configured` : 'Customer handoff (UNI port / VLAN) not configured on both ends',
    });
    const testNet = (await db.query(`SELECT address, description FROM ip_allocations WHERE service_id=$1 AND status='ALLOCATED' LIMIT 1`, [svc.id])).rows[0];
    if (testNet && reach && primary) {
      const s = await sampleService(db, svc, primary, ns, sim, settings);
      const rtt = s.latencyMs !== null ? Math.round(s.latencyMs * 2 * 1000) / 1000 : null;
      const [, aIp, bIp] = /A=([\d.]+) B=([\d.]+)/.exec(testNet.description) ?? [];
      r({
        testName: 'CE_TEST_PING', status: rtt !== null ? 'PASS' : 'FAIL',
        input: { from: aIp, to: bIp, subnet: testNet.address, count: 5 }, threshold: { lossPct: 0 }, result: { rttMs: rtt, lossPct: 0 },
        reason: rtt !== null ? `5/5 replies from ${bIp}, RTT ${rtt} ms (simulated ping across the L2 circuit)` : 'No reply',
      });
    } else {
      r({ testName: 'CE_TEST_PING', status: 'NOT_RUN', input: {}, threshold: null, result: null, reason: testNet ? 'Skipped: endpoints not reachable' : 'No CE test subnet allocated' });
    }

    const drift = await capacityConsistency(db);
    r({
      testName: 'RESERVATION_CONSISTENCY', status: drift.length === 0 ? 'PASS' : 'FAIL',
      input: {}, threshold: { driftSegments: 0 }, result: { driftSegments: drift },
      reason: drift.length === 0 ? 'Capacity counters equal the sum of active reservations on every segment' : 'Capacity counters drift from reservations',
    });
    return out;
  }

  async readMetrics(handle: string, fromTick: number, toTick: number) {
    const svc = await this.serviceByHandle(handle);
    return (await this.deps.db.query(`SELECT * FROM telemetry_samples WHERE service_id=$1 AND tick BETWEEN $2 AND $3 ORDER BY tick`, [svc.id, fromTick, toTick])).rows;
  }

  async injectFault(spec: FaultSpec, actorId: string | null) {
    const ctx = this.deps.ctx();
    const r = await injectFaults(ctx, { ...systemMeta(`adapter-${Date.now()}`), actor: null }, [spec], spec.groupId);
    void actorId;
    return { faultIds: r.faultIds, incidentId: r.incidentId };
  }

  async restoreFault(faultId: string) {
    await restoreFault(this.deps.ctx(), systemMeta(`adapter-${Date.now()}`), faultId);
  }

  async resetScenario() {
    await resetSimulation(this.deps.ctx(), systemMeta(`adapter-${Date.now()}`));
  }

  private async serviceByHandle(handle: string) {
    const svc = (await this.deps.db.query(`SELECT * FROM services WHERE sim_handle=$1`, [handle])).rows[0];
    if (!svc) throw new SimulationError('UNKNOWN_HANDLE', `No virtual service ${handle}`);
    return svc;
  }
  private async primaryPath(serviceId: string) {
    return (await this.deps.db.query(`SELECT * FROM service_paths WHERE service_id=$1 AND role='PRIMARY' ORDER BY created_at LIMIT 1`, [serviceId])).rows[0];
  }
  private async segEnds(ids: string[]) {
    const rows = (await this.deps.db.query(`SELECT id, a_node_id, b_node_id FROM cable_segments WHERE id = ANY($1)`, [ids])).rows;
    return new Map(rows.map((r) => [r.id, [r.a_node_id, r.b_node_id] as [string, string]]));
  }
}

export function isContiguous(nodeIds: string[], segIds: string[], ends: Map<string, [string, string]>) {
  if (nodeIds.length !== segIds.length + 1) return false;
  return segIds.every((s, i) => {
    const e = ends.get(s);
    if (!e) return false;
    const [x, y] = [nodeIds[i], nodeIds[i + 1]];
    return (e[0] === x && e[1] === y) || (e[0] === y && e[1] === x);
  });
}
