/** NOC v2: inventory, IPAM/VLAN, service network config, interface admin, DCN reachability, metrics, alarm console. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, drive, login, makeEnv, placeOrder, type Api, type TestEnv } from './helpers.js';
import { resetDemo } from '../src/db/seed.js';
import { ensureInventoryV2 } from '../src/modules/netconfig.js';
import { capacityConsistency } from '../src/modules/capacity.js';

let env: TestEnv;
let custA: Api, custB: Api, noc: Api, auditor: Api;

async function fresh() {
  await resetDemo(env.ctx.db, { clock: env.clock, demoPassword: 'test-password' });
  custA = api(env, await login(env, 'customer.a@demo.local'));
  custB = api(env, await login(env, 'customer.b@demo.local'));
  noc = api(env, await login(env, 'noc@demo.local'));
  auditor = api(env, await login(env, 'auditor@demo.local'));
}
async function activeOrder(c: Api, a: string, b: string, mbps = 1000, sla = 'sla-regional', product = 'prd-epl') {
  const o = await placeOrder(c, { a, b, mbps, sla, product });
  const state = await drive(env, o.orderId);
  return { ...o, state };
}

beforeAll(async () => { env = await makeEnv(); });
afterAll(async () => env.close());

describe('device inventory & address plan', () => {
  it('has OTN + PE + management switch per PoP with management IPs, loopbacks and VLAN 99', async () => {
    await fresh();
    const devs = (await noc.get('/api/devices')).body;
    expect(devs.length).toBe(19 * 3);
    expect(devs.filter((d: any) => d.role === 'PE').every((d: any) => /^172\.31\.\d+\.12\/24$/.test(d.mgmt_ip) && /^10\.255\.0\.\d+\/32$/.test(d.loopback_ip))).toBe(true);
    const ipam = (await noc.get('/api/ipam')).body;
    expect(ipam.pools.map((p: any) => p.id).sort()).toEqual(['pool-ctest', 'pool-lo', 'pool-mgmt']);
    expect(ipam.pools.find((p: any) => p.id === 'pool-mgmt').used).toBe(57);
    const vlans = (await noc.get('/api/vlans')).body;
    expect(vlans.filter((v: any) => v.vlan_id === 99 && v.kind === 'MGMT').length).toBe(38);
    expect((await custA.get('/api/devices')).status).toBe(403);
    expect((await auditor.get('/api/devices')).status).toBe(200);
  });
});

describe('service network configuration', () => {
  it('allocates UNI port + unique S-VLAN + /30 test subnet, renders config, and releases on termination', async () => {
    await fresh();
    const s1 = await activeOrder(custA, 'jkt', 'sin');
    expect(s1.state).toBe('ACTIVE');
    const n1 = (await custA.get(`/api/services/${s1.serviceId}/network`)).body;
    expect(n1.handoff).toHaveLength(2);
    expect(n1.handoff[0]).toMatchObject({ end: 'A', device: 'JKT-PE-01', port: '10GE0/1/1', sVlan: 1001 });
    expect(n1.testSubnet).toBe('10.240.0.0/30');
    expect(n1.configs).toEqual([]); // customers see handoff only, not device configs
    const s2 = await activeOrder(custB, 'jkt', 'sin');
    const n2 = (await custB.get(`/api/services/${s2.serviceId}/network`)).body;
    expect(n2.handoff[0]).toMatchObject({ port: '10GE0/1/2', sVlan: 1002 });
    expect(n2.testSubnet).toBe('10.240.0.4/30');
    const full = (await noc.get(`/api/services/${s1.serviceId}/network`)).body;
    expect(full.configs.some((c: any) => c.role === 'TRANSIT')).toBe(true);
    const tests = (await custA.get(`/api/services/${s1.serviceId}`)).body.tests;
    expect(tests.find((t: any) => t.test_name === 'HANDOFF_CONFIG').status).toBe('PASS');
    expect(tests.find((t: any) => t.test_name === 'CE_TEST_PING').status).toBe('PASS');
    const cfg = await env.app.inject({ method: 'GET', url: '/api/devices/eq-jkt-pe/config', headers: { cookie: (await login(env, 'noc@demo.local')) } });
    expect(cfg.body).toContain('SIMULATED RUNNING CONFIG');
    expect(cfg.body).toContain('s-vlan 1001');
    expect(cfg.body).toContain('hostname JKT-PE-01');

    expect((await custA.post(`/api/services/${s1.serviceId}/terminate`)).status).toBe(200);
    const after = (await noc.get(`/api/services/${s1.serviceId}/network`)).body;
    expect(after.handoff).toEqual([]);
    expect(after.vlans.every((v: any) => v.status === 'RELEASED')).toBe(true);
    const s3 = await activeOrder(custA, 'jkt', 'sin');
    const n3 = (await custA.get(`/api/services/${s3.serviceId}/network`)).body;
    expect(n3.handoff[0]).toMatchObject({ port: '10GE0/1/1', sVlan: 1001 }); // freed resources are reused
    expect(n3.testSubnet).toBe('10.240.0.0/30');
  });

  it('fails cleanly with compensation when a PE runs out of UNI ports', async () => {
    await fresh();
    for (let i = 0; i < 8; i++) expect((await activeOrder(custA, 'kdi', 'tte', 100, 'sla-domestic')).state).toBe('ACTIVE');
    const ninth = await activeOrder(custA, 'kdi', 'tte', 100, 'sla-domestic');
    expect(ninth.state).toBe('FAILED');
    const d = (await custA.get(`/api/orders/${ninth.orderId}`)).body;
    expect(d.order.state_reason).toMatch(/NO_FREE_UNI_PORT/);
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
    const leftovers = (await env.ctx.db.query(`SELECT count(*)::int n FROM service_configs WHERE service_id=$1 AND status='APPLIED'`, [ninth.serviceId])).rows[0].n;
    expect(leftovers).toBe(0);
  });

  it('back-fills config for services activated before NOC v2', async () => {
    await fresh();
    const s = await activeOrder(custA, 'jkt', 'sin');
    await env.ctx.db.query(`DELETE FROM service_configs WHERE service_id=$1`, [s.serviceId]);
    await env.ctx.db.query(`DELETE FROM vlan_allocations WHERE service_id=$1`, [s.serviceId]);
    await env.ctx.db.query(`DELETE FROM ip_allocations WHERE service_id=$1`, [s.serviceId]);
    await ensureInventoryV2(env.ctx.db, env.clock);
    const n = (await custA.get(`/api/services/${s.serviceId}/network`)).body;
    expect(n.handoff).toHaveLength(2);
  });
});

describe('interface admin, DCN reachability and metrics', () => {
  it('shutting the customer UNI port takes the service down with an enriched PORT_DOWN alarm; no shutdown restores it', async () => {
    await fresh();
    const s = await activeOrder(custA, 'jkt', 'sin');
    const port = 'pt-jkt-pe-uni1';
    expect((await auditor.post(`/api/devices/eq-jkt-pe/ports/${port}/admin`, { status: 'DOWN' })).status).toBe(403);
    expect((await noc.post(`/api/devices/eq-jkt-pe/ports/${port}/admin`, { status: 'DOWN' })).status).toBe(200);
    let svc = (await custA.get(`/api/services/${s.serviceId}`)).body.service;
    expect(svc.oper_status).toBe('DOWN');
    const alarms = (await noc.get('/api/alarms?state=ACTIVE')).body;
    const pd = alarms.find((a: any) => a.type === 'PORT_DOWN');
    expect(pd).toMatchObject({ source_name: 'JKT-PE-01', code: 3003 });
    expect(pd.location_info).toContain('10GE0/1/1');
    expect((await noc.get('/api/devices/eq-jkt-pe')).body.ports.find((p: any) => p.id === port).admin_status).toBe('DOWN');
    await noc.post(`/api/devices/eq-jkt-pe/ports/${port}/admin`, { status: 'UP' });
    svc = (await custA.get(`/api/services/${s.serviceId}`)).body.service;
    expect(svc.oper_status).toBe('UP');
  });

  it('records device and interface metrics per tick and detects DCN isolation as outages', async () => {
    await fresh();
    const s = await activeOrder(custA, 'jkt', 'tte', 1000, 'sla-domestic');
    await noc.post('/api/simulation/tick', { count: 5 });
    const m = (await noc.get('/api/devices/eq-jkt/metrics?ticks=60')).body;
    expect(m.series.length).toBe(5);
    expect(m.series.every((x: any) => x.reachable && x.cpu_pct > 0 && x.ping_ms >= 0)).toBe(true);
    expect(m.summary.ping).toMatchObject({ min: expect.any(Number), max: expect.any(Number) });
    const tte = (await noc.get('/api/devices/eq-tte/metrics?ticks=60')).body;
    const line = tte.interfaces.find((i: any) => i.kind === 'LINE' && i.series.some((p: any) => p.in > 0));
    expect(line).toBeTruthy(); // the service's traffic shows up on Ternate's line port
    void s;

    // Isolate Ternate from the NMS: cut both spans into TTE (node itself stays up).
    await noc.post('/api/simulation/faults', { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-kdi-tte' });
    await noc.post('/api/simulation/faults', { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-mdo-tte' });
    await noc.post('/api/simulation/tick', { count: 3 });
    const un = (await noc.get('/api/alarms?state=ACTIVE')).body.filter((a: any) => a.type === 'DEVICE_UNREACHABLE');
    expect(un.map((a: any) => a.source_name).sort()).toEqual(['TTE-MSW-01', 'TTE-OTN-01', 'TTE-PE-01']);
    const out = (await noc.get('/api/outages')).body.filter((o: any) => o.hostname.startsWith('TTE-'));
    expect(out.length).toBe(3);
    expect(out.every((o: any) => o.ongoing && o.ticks === 3)).toBe(true);
    const probes = (await noc.get('/api/probes')).body.find((p: any) => p.hostname === 'TTE-PE-01');
    expect(probes.ping).toBe('DOWN');
    const map = (await noc.get('/api/device-map')).body;
    expect(map.devices.find((d: any) => d.id === 'eq-tte-pe').reachable).toBe(false);
    expect(map.links.find((l: any) => l.id === 'seg-kdi-tte').status).toBe('DOWN');
  });
});

describe('alarm console', () => {
  it('bulk acknowledge, comment, manual clear (re-raised while the condition persists), stats and CSV export', async () => {
    await fresh();
    const f = await noc.post('/api/simulation/scenarios/FIBER_CUT_JKT_MKS/run');
    const active = (await noc.get('/api/alarms?state=ACTIVE')).body;
    const los = active.find((a: any) => a.type === 'LOS');
    expect(los).toMatchObject({ code: 3001, occurrence: 1 });
    expect(los.location_info).toMatch(/OTS:1/);

    expect((await custA.post('/api/alarms/ack', { ids: [los.id] })).status).toBe(403);
    expect((await noc.post('/api/alarms/ack', { ids: active.map((a: any) => a.id) })).body.acknowledged).toBe(active.length);
    const c = await noc.post(`/api/alarms/${los.id}/comments`, { text: 'Patroli dikirim (simulasi)' });
    expect(c.body.at(-1)).toMatchObject({ text: 'Patroli dikirim (simulasi)', author_id: 'noc@demo.local' });
    const detail = (await noc.get(`/api/alarms/${los.id}`)).body;
    expect(detail.alarm.acked_by).toBe('noc@demo.local');
    expect(detail.comments).toHaveLength(1);

    expect((await noc.post(`/api/alarms/${los.id}/clear`)).status).toBe(200);
    await noc.post('/api/simulation/tick', { count: 1 });
    const again = (await noc.get('/api/alarms?state=ACTIVE')).body.find((a: any) => a.type === 'LOS');
    expect(again.id).not.toBe(los.id);
    expect(again.occurrence).toBe(2);

    const stats = (await noc.get('/api/alarms/stats')).body;
    expect(stats.activeBySeverity.find((s: any) => s.severity === 'CRITICAL').n).toBeGreaterThan(0);
    const csv = await env.app.inject({ method: 'GET', url: '/api/alarms/export.csv', headers: { cookie: (await login(env, 'noc@demo.local')) } });
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.body.split('\n')[1]).toContain('severity,alarm_code,name');
    await noc.post(`/api/simulation/faults/${f.body.faultIds[0]}/restore`);
  });
});
