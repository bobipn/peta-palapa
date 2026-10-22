/**
 * End-to-end workflow scenarios A–H from the build brief, executed through the
 * HTTP API (fastify.inject) with a manual clock and a manually driven scheduler.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, drive, login, makeEnv, placeOrder, type Api, type TestEnv } from './helpers.js';
import { capacityConsistency, reserve } from '../src/modules/capacity.js';
import { resetDemo } from '../src/db/seed.js';
import { tick } from '../src/modules/simulation/engine.js';
import { systemMeta } from '../src/modules/context.js';
import { runOnce } from '../src/modules/orchestrator.js';

let env: TestEnv;
let custA: Api, custB: Api, noc: Api, admin: Api, alpha: Api, bravo: Api, delta: Api, auditor: Api, commercial: Api;

async function loginAll() {
  custA = api(env, await login(env, 'customer.a@demo.local'));
  custB = api(env, await login(env, 'customer.b@demo.local'));
  noc = api(env, await login(env, 'noc@demo.local'));
  admin = api(env, await login(env, 'admin@demo.local'));
  alpha = api(env, await login(env, 'alpha@demo.local'));
  bravo = api(env, await login(env, 'bravo@demo.local'));
  delta = api(env, await login(env, 'delta@demo.local'));
  auditor = api(env, await login(env, 'auditor@demo.local'));
  commercial = api(env, await login(env, 'commercial@demo.local'));
}

async function fresh() {
  await resetDemo(env.ctx.db, { clock: env.clock, demoPassword: 'test-password' });
  await loginAll();
}

beforeAll(async () => {
  env = await makeEnv();
  await loginAll();
});
afterAll(async () => env.close());

describe('Scenario A — successful order Jakarta–Ternate 1 Gbps', () => {
  it('quotes, pays, reserves, provisions, validates and activates', async () => {
    await fresh();
    const { orderId, serviceId, quote } = await placeOrder(custA, { a: 'jkt', b: 'tte', mbps: 1000, sla: 'sla-domestic' });
    expect(quote.route.primary.segmentIds.length).toBeGreaterThan(1);
    expect(quote.price_monthly).toBeGreaterThan(0);

    expect(await drive(env, orderId)).toBe('ACTIVE');
    const d = (await custA.get(`/api/orders/${orderId}`)).body;
    const transitions = d.events.filter((e: any) => e.type === 'ORDER_STATE_CHANGED').map((e: any) => e.payload.to);
    expect(transitions).toEqual(['CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED', 'PROVISIONING', 'TESTING', 'ACTIVE']);
    expect(d.order.sonata.state).toBe('completed');

    const s = (await custA.get(`/api/services/${serviceId}`)).body;
    expect(s.service.state).toBe('ACTIVE');
    expect(s.service.oper_status).toBe('UP');
    const tests = s.tests.filter((t: any) => t.status === 'FAIL');
    expect(tests).toEqual([]);
    expect(s.tests.map((t: any) => t.test_name)).toEqual(expect.arrayContaining(['ENDPOINT_REACHABILITY', 'EXPECTED_PATH', 'BANDWIDTH_PROFILE', 'LATENCY_THRESHOLD', 'PACKET_LOSS_THRESHOLD', 'RESERVATION_CONSISTENCY']));
    expect(s.tests.every((t: any) => t.simulated)).toBe(true);

    const rsv = (await env.ctx.db.query(`SELECT * FROM reservations WHERE order_id=$1`, [orderId])).rows;
    expect(rsv.length).toBe(quote.route.primary.segmentIds.length);
    expect(rsv.every((r) => r.status === 'COMMITTED' && r.mbps === 1000)).toBe(true);
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);

    // Workflow tasks carry state, attempts, correlation id and idempotency key.
    const wf = (await noc.get(`/api/provisioning/workflows`)).body.find((w: any) => w.order_id === orderId);
    const detail = (await noc.get(`/api/provisioning/workflows/${wf.id}`)).body;
    expect(detail.workflow.state).toBe('COMPLETED');
    for (const t of detail.tasks) {
      expect(t.state).toBe('DONE');
      expect(t.attempts).toBeGreaterThanOrEqual(1);
      expect(t.correlation_id).toBeTruthy();
      expect(t.idempotency_key).toBe(`${wf.id}:${t.type}`);
    }
  });

  it('idempotent payment retry does not double-charge', async () => {
    const q = await custA.post('/api/quotes', { aLocationId: 'jkt', bLocationId: 'sin', bandwidthMbps: 500, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-regional', termMonths: 12 });
    const o = await custA.post(`/api/quotes/${q.body.id}/accept`, {}, { 'idempotency-key': 'acc-1' });
    const o2 = await custA.post(`/api/quotes/${q.body.id}/accept`, {}, { 'idempotency-key': 'acc-1' });
    expect(o2.status).toBe(201);
    expect(o2.headers['idempotent-replayed']).toBe('true');
    expect(o2.body.order.id).toBe(o.body.order.id);
    const p1 = await custA.post(`/api/orders/${o.body.order.id}/pay`, {}, { 'idempotency-key': 'pay-1' });
    const p2 = await custA.post(`/api/orders/${o.body.order.id}/pay`, {}, { 'idempotency-key': 'pay-1' });
    expect(p1.status).toBe(200);
    expect(p2.body.paymentRef).toBe(p1.body.paymentRef);
    const n = (await env.ctx.db.query(`SELECT count(*)::int n FROM domain_events WHERE aggregate_id=$1 AND type='PAYMENT_SIMULATED'`, [o.body.order.id])).rows[0].n;
    expect(n).toBe(1);
  });
});

describe('Scenario B — multi-provider route Bali–Tokyo', () => {
  it('creates provider sub-orders and allocates revenue per configuration', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'bal', b: 'tyo', mbps: 1000, sla: 'sla-regional' });
    expect(await drive(env, orderId)).toBe('ACTIVE');
    const d = (await custA.get(`/api/orders/${orderId}`)).body;
    expect(d.subOrders.length).toBeGreaterThan(1);
    expect(d.subOrders.every((s: any) => s.state === 'ACCEPTED')).toBe(true);

    const svc = (await custA.get(`/api/services/${serviceId}`)).body;
    const primary = svc.paths.find((p: any) => p.role === 'PRIMARY');
    expect(primary.node_ids[0]).toBe('nd-bal');
    expect(primary.node_ids.at(-1)).toBe('nd-tyo');

    const ledger = (await commercial.get('/api/settlement/ledger')).body.filter((l: any) => l.order_id === orderId && l.period !== 'ONE_TIME');
    const charge = ledger.find((l: any) => l.entry_type === 'CUSTOMER_CHARGE').amount;
    const fee = ledger.find((l: any) => l.entry_type === 'PLATFORM_FEE').amount;
    const allocs = ledger.filter((l: any) => l.entry_type === 'PROVIDER_ALLOCATION');
    expect(allocs.length).toBe(d.subOrders.length);
    for (const s of d.subOrders) expect(allocs.find((a: any) => a.party_id === s.provider_id).amount).toBe(s.wholesale_monthly);
    expect(charge).toBe(allocs.reduce((a: number, x: any) => a + x.amount, 0) + fee);
    expect(Math.abs(fee - charge * 0.1)).toBeLessThanOrEqual(1); // GROSS basis, 10 % demo
    expect((await commercial.get('/api/settlement/summary')).body.balanced).toBe(true);

    // Each provider only sees its own allocation.
    const echo = api(env, await login(env, 'echo@demo.local'));
    const echoLedger = (await echo.get('/api/settlement/ledger')).body;
    expect(echoLedger.every((l: any) => l.party_id === 'prv-echo')).toBe(true);

    // Sonata mock messages were produced per provider and are labelled MOCK.
    const sonata = (await noc.get(`/api/integrations/sonata/orders/${orderId}`)).body;
    expect(sonata.messages.length).toBe(d.subOrders.length);
    expect(sonata.messages.every((m: any) => m.adapter_mode === 'MOCK' && m.request.path.startsWith('/mefApi/sonata/productOrderingManagement/v11'))).toBe(true);
  });
});

describe('Scenario C — insufficient capacity', () => {
  it('rejects with a reason and offers a valid lower-bandwidth alternative', async () => {
    await fresh();
    const r = await custA.post('/api/quotes', { aLocationId: 'jkt', bLocationId: 'tte', bandwidthMbps: 20_000, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-domestic', termMonths: 12 });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('ROUTE_INSUFFICIENT_CAPACITY');
    expect(r.body.error.details.maxFeasibleMbps).toBe(10_000);
    expect(r.body.error.details.alternatives[0]).toMatchObject({ kind: 'LOWER_BANDWIDTH', bandwidthMbps: 10_000 });
    // The alternative is actually orderable.
    const ok = await custA.post('/api/quotes', { aLocationId: 'jkt', bLocationId: 'tte', bandwidthMbps: 10_000, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-domestic', termMonths: 12 });
    expect(ok.status).toBe(201);
  });

  it('never overbooks under concurrent reservations', async () => {
    await fresh();
    const attempt = () => env.ctx.db.tx((q) => reserve(q, { segments: [{ segmentId: 'seg-kdi-tte', role: 'PRIMARY' }], mbps: 6000, status: 'COMMITTED', now: env.clock.now() })).then(() => 'ok', (e) => e.code);
    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r === 'ok').length).toBe(1);
    expect(results.filter((r) => r === 'INSUFFICIENT_CAPACITY').length).toBe(2);
    const c = (await env.ctx.db.query(`SELECT reserved_mbps FROM capacity_resources WHERE segment_id='seg-kdi-tte'`)).rows[0];
    expect(c.reserved_mbps).toBe(6000);
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
  });

  it('a second order that no longer fits fails at reservation and leaves no residue', async () => {
    await fresh();
    // Two customers quote 8 Gbps over the same 10 Gbps bottleneck before either pays.
    const qa = await custA.post('/api/quotes', { aLocationId: 'kdi', bLocationId: 'tte', bandwidthMbps: 8000, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-domestic', termMonths: 12, excludeProviders: [] });
    const qb = await custB.post('/api/quotes', { aLocationId: 'kdi', bLocationId: 'tte', bandwidthMbps: 8000, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-domestic', termMonths: 12 });
    expect(qa.body.route.primary.segmentIds).toEqual(['seg-kdi-tte']);
    expect(qb.body.route.primary.segmentIds).toEqual(['seg-kdi-tte']);
    const oa = (await custA.post(`/api/quotes/${qa.body.id}/accept`)).body.order.id;
    const ob = (await custB.post(`/api/quotes/${qb.body.id}/accept`)).body.order.id;
    await custA.post(`/api/orders/${oa}/pay`);
    await custB.post(`/api/orders/${ob}/pay`);
    const [sa, sb] = [await drive(env, oa), await drive(env, ob)];
    expect([sa, sb].sort()).toEqual(['ACTIVE', 'FAILED']);
    const failed = sa === 'FAILED' ? oa : ob;
    const d = (await admin.get(`/api/orders/${failed}`)).body;
    expect(d.order.state_reason).toMatch(/ROUTE_NO_LONGER_FEASIBLE|INSUFFICIENT_CAPACITY/);
    expect(d.order.payment_status).toBe('REFUNDED_SIMULATED');
    expect((await env.ctx.db.query(`SELECT reserved_mbps FROM capacity_resources WHERE segment_id='seg-kdi-tte'`)).rows[0].reserved_mbps).toBe(8000);
  });
});

describe('Scenario D — fiber cut on an active service', () => {
  it('protected service switches to protection; incident mitigated, then resolved', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'tte', mbps: 1000, protection: 'PROTECTED', sla: 'sla-domestic' });
    expect(await drive(env, orderId)).toBe('ACTIVE');
    const svc0 = (await noc.get(`/api/services/${serviceId}`)).body;
    const primary = svc0.paths.find((p: any) => p.role === 'PRIMARY');
    const protection = svc0.paths.find((p: any) => p.role === 'PROTECTION');
    expect(protection).toBeTruthy();
    const cutSeg = primary.segment_ids[0];

    const f = await noc.post('/api/simulation/faults', { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: cutSeg });
    expect(f.status).toBe(201);
    const svc1 = (await noc.get(`/api/services/${serviceId}`)).body.service;
    expect(svc1.active_path).toBe('PROTECTION');
    expect(svc1.oper_status).toBe('UP');

    const alarms = (await noc.get('/api/alarms?state=ACTIVE')).body;
    expect(alarms.find((a: any) => a.type === 'LOS' && a.entity_id === cutSeg)).toBeTruthy();
    expect(alarms.find((a: any) => a.type === 'ON_PROTECTION' && a.entity_id === serviceId)).toBeTruthy();
    const inc = (await noc.get(`/api/incidents/${f.body.incidentId}`)).body;
    expect(inc.incident.impacted_services).toContain(serviceId);
    expect(inc.incident.impacted_customers).toContain('cus-a');
    expect(inc.incident.state).toBe('MITIGATED');
    expect(inc.events.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['FAULT_INJECTED', 'PROTECTION_SWITCH', 'ALARM_RAISED', 'MITIGATED']));
    // Customer sees the incident affecting them.
    expect((await custA.get('/api/incidents')).body.map((i: any) => i.id)).toContain(f.body.incidentId);
    expect((await custB.get('/api/incidents')).body.map((i: any) => i.id)).not.toContain(f.body.incidentId);

    await noc.post('/api/simulation/tick', { count: 3 });
    const tel = (await noc.get(`/api/services/${serviceId}/telemetry`)).body.samples;
    expect(tel.every((s: any) => s.state !== 'DOWN' && s.active_path === 'PROTECTION')).toBe(true);

    await noc.post(`/api/simulation/faults/${f.body.faultIds[0]}/restore`);
    const inc2 = (await noc.get(`/api/incidents/${f.body.incidentId}`)).body;
    expect(inc2.incident.state).toBe('RESOLVED');
    expect((await noc.get('/api/alarms?state=ACTIVE')).body.find((a: any) => a.type === 'LOS')).toBeFalsy();
  });

  it('unprotected service is rerouted after restoration delay and reverts after repair', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'sin', mbps: 1000, sla: 'sla-regional' });
    expect(await drive(env, orderId)).toBe('ACTIVE');
    const primary = (await noc.get(`/api/services/${serviceId}`)).body.paths.find((p: any) => p.role === 'PRIMARY');
    await noc.post('/api/simulation/tick', { count: 2 });
    const f = await noc.post('/api/simulation/faults', { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: primary.segment_ids[0] });
    let svc = (await noc.get(`/api/services/${serviceId}`)).body.service;
    expect(svc.oper_status).toBe('DOWN');
    expect(svc.reroute_ready_tick).not.toBeNull();
    expect((await noc.get('/api/alarms?state=ACTIVE')).body.find((a: any) => a.type === 'SERVICE_DOWN' && a.entity_id === serviceId)).toBeTruthy();

    await noc.post('/api/simulation/tick', { count: 3 });
    svc = (await noc.get(`/api/services/${serviceId}`)).body.service;
    expect(svc.active_path).toBe('REROUTE');
    expect(svc.oper_status).not.toBe('DOWN');
    const inc = (await noc.get(`/api/incidents/${f.body.incidentId}`)).body;
    const restored = inc.restorations.find((r: any) => r.serviceId === serviceId);
    expect(restored.seconds).toBeGreaterThan(0);
    expect(inc.events.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['SERVICE_DOWN', 'REROUTE_STARTED', 'SERVICE_RESTORED']));
    const sla = (await custA.get(`/api/services/${serviceId}`)).body.sla;
    expect(sla.providerOutageSeconds).toBeGreaterThan(0);
    expect(sla.availabilityPct).toBeLessThan(100);

    await noc.post(`/api/simulation/faults/${f.body.faultIds[0]}/restore`);
    svc = (await noc.get(`/api/services/${serviceId}`)).body.service;
    expect(svc.active_path).toBe('PRIMARY');
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
    const rer = (await env.ctx.db.query(`SELECT count(*)::int n FROM reservations WHERE service_id=$1 AND role='REROUTE' AND status<>'RELEASED'`, [serviceId])).rows[0].n;
    expect(rer).toBe(0);
  });
});

describe('Scenario E — provisioning failure after reservation', () => {
  it('rolls back: releases capacity, cancels sub-orders, refunds, order FAILED', async () => {
    await fresh();
    await noc.post('/api/simulation/scenarios/PROVISIONING_FAILURE_ALPHA/run');
    const before = (await env.ctx.db.query(`SELECT sum(reserved_mbps)::bigint s FROM capacity_resources`)).rows[0].s;
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'tte', mbps: 1000, sla: 'sla-domestic' });
    expect(await drive(env, orderId)).toBe('FAILED');
    const d = (await admin.get(`/api/orders/${orderId}`)).body;
    const transitions = d.events.filter((e: any) => e.type === 'ORDER_STATE_CHANGED').map((e: any) => e.payload.to);
    expect(transitions).toEqual(['CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED', 'PROVISIONING', 'FAILED']);
    expect(d.order.state_reason).toMatch(/PROVISIONING_FAILED/);
    expect(d.order.payment_status).toBe('REFUNDED_SIMULATED');
    expect(d.subOrders.every((s: any) => s.state === 'CANCELLED')).toBe(true);
    expect(d.workflow.state).toBe('COMPENSATED');
    expect(d.workflow.tasks.filter((t: any) => t.is_compensation).map((t: any) => t.type)).toEqual(['DEPROVISION_VIRTUAL', 'RELEASE_CAPACITY', 'CANCEL_SUBORDERS', 'REFUND_PAYMENT_SIMULATED', 'FINALIZE_ORDER']);
    const after = (await env.ctx.db.query(`SELECT sum(reserved_mbps)::bigint s FROM capacity_resources`)).rows[0].s;
    expect(after).toBe(before);
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
    expect((await admin.get(`/api/services/${serviceId}`)).body.service.state).toBe('FAILED');
    expect((await env.ctx.db.query(`SELECT count(*)::int n FROM settlement_ledger WHERE order_id=$1 AND status <> 'VOID'`, [orderId])).rows[0].n).toBe(0);
  });

  it('provider rejection -> REJECTED with compensation', async () => {
    await fresh();
    const { orderId } = await placeOrder(custA, { a: 'kdi', b: 'syd', mbps: 1000, sla: 'sla-regional' });
    await drive(env, orderId, ['PROVIDER_ACCEPTANCE'], 10).catch(() => undefined);
    const subs = (await delta.get('/api/provider/suborders')).body.filter((s: any) => s.order_id === orderId);
    expect(subs.length).toBe(1); // Delta sees only its own sub-order
    const rej = await delta.post(`/api/provider/suborders/${subs[0].id}/respond`, { decision: 'REJECT', note: 'No spare port (DEMO)' });
    expect(rej.status).toBe(200);
    expect(await drive(env, orderId)).toBe('REJECTED');
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
    expect((await env.ctx.db.query(`SELECT count(*)::int n FROM reservations WHERE order_id=$1 AND status<>'RELEASED'`, [orderId])).rows[0].n).toBe(0);
  });

  it('provider API timeout -> acceptance deadline -> FAILED (not stuck)', async () => {
    await fresh();
    await noc.post('/api/simulation/scenarios/PROVIDER_API_TIMEOUT_BRAVO/run');
    const { orderId } = await placeOrder(custA, { a: 'jkt', b: 'sin', mbps: 1000, sla: 'sla-regional' });
    // createProductOrder to Bravo times out -> retries with backoff -> fails.
    expect(await drive(env, orderId)).toBe('FAILED');
    const d = (await admin.get(`/api/orders/${orderId}`)).body;
    expect(d.order.state_reason).toMatch(/timed out|TIMEOUT/i);
    const t = d.workflow.tasks.find((x: any) => x.type === 'CREATE_SUBORDERS');
    expect(t.attempts).toBe(3);
  });

  it('customer cancel during provider acceptance compensates to CANCELLED', async () => {
    await fresh();
    const { orderId } = await placeOrder(custA, { a: 'kdi', b: 'syd', mbps: 1000, sla: 'sla-regional' });
    await drive(env, orderId, ['PROVIDER_ACCEPTANCE'], 10).catch(() => undefined);
    const c = await custA.post(`/api/orders/${orderId}/cancel`, { reason: 'changed plans' });
    expect(c.status).toBe(200);
    expect(await drive(env, orderId)).toBe('CANCELLED');
    expect(await capacityConsistency(env.ctx.db)).toEqual([]);
  });
});

describe('Scenario F — SLA breach and recovery', () => {
  it('flags latency breach, records duration and clears after recovery', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'mks', mbps: 1000, sla: 'sla-domestic' });
    expect(await drive(env, orderId)).toBe('ACTIVE');
    const primary = (await noc.get(`/api/services/${serviceId}`)).body.paths.find((p: any) => p.role === 'PRIMARY');
    expect(primary.segment_ids).toEqual(['seg-jkt-mks']);
    await noc.post('/api/simulation/tick', { count: 3 });
    const run = await noc.post('/api/simulation/scenarios/LATENCY_BREACH_JKT_MKS/run');
    await noc.post('/api/simulation/tick', { count: 5 });
    let s = (await noc.get(`/api/services/${serviceId}`)).body;
    expect(s.service.oper_status).toBe('DEGRADED');
    const open = s.sla.breaches.find((b: any) => b.metric === 'LATENCY' && b.open);
    expect(open).toBeTruthy();
    expect(open.peak_value).toBeGreaterThan(30);
    expect((await noc.get('/api/alarms?state=ACTIVE')).body.find((a: any) => a.type === 'SLA_BREACH_LATENCY' && a.entity_id === serviceId)).toBeTruthy();

    await noc.post(`/api/simulation/faults/${run.body.faultIds[0]}/restore`);
    await noc.post('/api/simulation/tick', { count: 2 });
    s = (await noc.get(`/api/services/${serviceId}`)).body;
    expect(s.service.oper_status).toBe('UP');
    const closed = s.sla.breaches.find((b: any) => b.metric === 'LATENCY');
    expect(closed.open).toBe(false);
    expect(closed.durationSeconds).toBe(5 * 60);
    expect(s.sla.availabilityPct).toBe(100); // degraded is not unavailable
    expect(s.sla.degradedSeconds).toBe(5 * 60);
    expect((await noc.get('/api/alarms?state=ACTIVE')).body.find((a: any) => a.type === 'SLA_BREACH_LATENCY')).toBeFalsy();
  });

  it('scheduled maintenance is excluded from availability', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'btm', b: 'sin', mbps: 1000, sla: 'sla-regional' });
    expect(await drive(env, orderId)).toBe('ACTIVE');
    await env.ctx.db.query(`UPDATE services SET auto_reroute=false WHERE id=$1`, [serviceId]);
    await noc.post('/api/simulation/tick', { count: 4 });
    const m = await noc.post('/api/simulation/scenarios/MAINTENANCE_BTM_SIN/run');
    await noc.post('/api/simulation/tick', { count: 3 });
    await noc.post(`/api/simulation/faults/${m.body.faultIds[0]}/restore`);
    await noc.post('/api/simulation/tick', { count: 3 });
    const sla = (await custA.get(`/api/services/${serviceId}`)).body.sla;
    expect(sla.maintenanceSeconds).toBe(3 * 60);
    expect(sla.providerOutageSeconds).toBe(0);
    expect(sla.availabilityPct).toBe(100);
  });
});

describe('Scenario G — RBAC', () => {
  it('isolates customers and providers and enforces roles on the backend', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'sin', mbps: 100, sla: 'sla-regional' });
    expect((await custB.get(`/api/orders/${orderId}`)).status).toBe(404);
    expect((await custB.get(`/api/services/${serviceId}`)).status).toBe(404);
    expect((await custB.post(`/api/orders/${orderId}/pay`)).status).toBe(404); // existence not leaked
    expect((await custB.post(`/api/orders/${orderId}/cancel`)).status).toBe(404);
    expect((await custB.get('/api/orders')).body.find((o: any) => o.id === orderId)).toBeFalsy();

    expect((await bravo.patch('/api/provider/segments/seg-jkt-sby', { pricePerGbpsMonth: 1 })).status).toBe(403);
    expect((await bravo.patch('/api/provider/segments/seg-jkt-btm', { pricePerGbpsMonth: 7_100_000 })).status).toBe(200);
    const topo = (await bravo.get('/api/topology')).body;
    expect(topo.segments.find((s: any) => s.id === 'seg-jkt-sby').capacityMbps).toBeNull();
    expect(topo.segments.find((s: any) => s.id === 'seg-jkt-btm').capacityMbps).toBe(100_000);

    expect((await custA.post('/api/simulation/faults', { type: 'FIBER_CUT', targetType: 'SEGMENT', targetId: 'seg-jkt-sin' })).status).toBe(403);
    expect((await custA.get('/api/topology')).status).toBe(403);
    expect((await auditor.post('/api/simulation/tick', { count: 1 })).status).toBe(403);
    expect((await auditor.get('/api/audit')).status).toBe(200);
    expect((await noc.post('/api/admin/reset-demo')).status).toBe(403);
    expect((await alpha.post('/api/quotes', {})).status).toBeGreaterThanOrEqual(400);

    const anon = await env.app.inject({ method: 'GET', url: '/api/orders' });
    expect(anon.statusCode).toBe(401);
    const denied = (await auditor.get('/api/audit')).body.filter((a: any) => a.outcome === 'DENIED');
    expect(denied.length).toBeGreaterThan(0);
    // Cross-origin mutation is refused even with a valid session.
    const xo = await env.app.inject({ method: 'POST', url: '/api/simulation/tick', payload: { count: 1 }, headers: { cookie: (await login(env, 'noc@demo.local')), origin: 'https://evil.example', host: 'localhost' } });
    expect(xo.statusCode).toBe(403);
  });
});

describe('Scenario H — repeatability', () => {
  async function scripted() {
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'tte', mbps: 1000, protection: 'PROTECTED', sla: 'sla-domestic' });
    await drive(env, orderId);
    const c2 = await placeOrder(custA, { a: 'jkt', b: 'mks', mbps: 1000, sla: 'sla-domestic' });
    await drive(env, c2.orderId);
    await tick(env.ctx, systemMeta('t'), 10);
    const f = await noc.post('/api/simulation/scenarios/CORRELATED_SULAWESI/run');
    await tick(env.ctx, systemMeta('t'), 10);
    for (const id of f.body.faultIds) await noc.post(`/api/simulation/faults/${id}/restore`);
    await tick(env.ctx, systemMeta('t'), 5);
    const samples = (await env.ctx.db.query(
      `SELECT s.name, t.tick, t.latency_ms, t.jitter_ms, t.loss_pct, t.throughput_mbps, t.state, t.outage_cause, t.active_path
       FROM telemetry_samples t JOIN services s ON s.id=t.service_id ORDER BY s.name, t.tick`)).rows;
    const alarms = (await env.ctx.db.query(`SELECT type, severity, entity_type, raised_tick, cleared_tick, state FROM alarms ORDER BY type, raised_tick, entity_type`)).rows;
    const incidents = (await env.ctx.db.query(`SELECT title, state, opened_tick, mitigated_tick, resolved_tick, jsonb_array_length(impacted_services) n FROM incidents ORDER BY opened_tick`)).rows;
    void serviceId;
    return JSON.stringify({ samples, alarms, incidents });
  }

  it('reset + rerun produces identical simulation output', async () => {
    await fresh();
    const a = await scripted();
    await fresh();
    const b = await scripted();
    expect(b).toBe(a);
    expect(JSON.parse(a).samples.length).toBeGreaterThan(40);
  });
});

describe('Live provisioning view (per-node device state)', () => {
  it('brings nodes up one by one: PENDING (red) -> BOOTING -> CONFIGURED -> ACTIVE (green); fault -> DOWN', async () => {
    await fresh();
    const { orderId, serviceId } = await placeOrder(custA, { a: 'jkt', b: 'tte', mbps: 1000, sla: 'sla-domestic' });
    let live = (await custA.get(`/api/services/${serviceId}/live`)).body;
    expect(live.nodes.length).toBeGreaterThan(2);
    expect(live.nodes.every((n: any) => n.state === 'PENDING')).toBe(true);
    expect(live.links.every((l: any) => ['PLANNED', 'RESERVED'].includes(l.state))).toBe(true);

    for (let i = 0; i < 30 && live.serviceState !== 'PROVISIONING'; i++) {
      await runOnce(env.ctx);
      env.clock.advance(1000);
      live = (await custA.get(`/api/services/${serviceId}/live`)).body;
    }
    void orderId;
    expect(live.nodes.filter((n: any) => n.state === 'BOOTING').length).toBe(1);
    const seen = new Set<string>();
    for (let i = 0; i < 30 && live.serviceState !== 'ACTIVE'; i++) {
      live.nodes.forEach((n: any) => seen.add(n.state));
      // Node bring-up is strictly ordered: no PENDING node may precede a CONFIGURED one.
      const order = live.nodes.map((n: any) => n.state);
      const firstPending = order.indexOf('PENDING');
      if (firstPending >= 0) expect(order.slice(firstPending).every((s: string) => s === 'PENDING')).toBe(true);
      env.clock.advance(1000);
      await runOnce(env.ctx);
      live = (await custA.get(`/api/services/${serviceId}/live`)).body;
    }
    expect([...seen]).toEqual(expect.arrayContaining(['BOOTING', 'CONFIGURED']));
    expect(live.serviceState).toBe('ACTIVE');
    expect(live.nodes.every((n: any) => n.state === 'ACTIVE')).toBe(true);
    expect(live.links.every((l: any) => l.state === 'ACTIVE')).toBe(true);
    expect(live.progress).toMatchObject({ pct: 100 });

    await noc.post('/api/simulation/faults', { type: 'NODE_DOWN', targetType: 'NODE', targetId: live.nodes[1].id });
    live = (await custA.get(`/api/services/${serviceId}/live`)).body;
    expect(live.nodes[1].state).toBe('DOWN');
    expect(live.links.some((l: any) => l.state === 'DOWN')).toBe(true);
    expect((await custB.get(`/api/services/${serviceId}/live`)).status).toBe(404);

    const topo = (await noc.get('/api/topology')).body;
    expect(topo.nodes.find((n: any) => n.id === 'nd-jkt').active_services).toBeGreaterThanOrEqual(0);
  });
});
