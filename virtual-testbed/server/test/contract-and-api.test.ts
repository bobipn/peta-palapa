import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, login, makeEnv, type TestEnv } from './helpers.js';
import {
  contractErrors, SonataMockSeller, SonataProductOrderCreate, SonataProductOrderResponse, SonataRealAdapter, toSonataCreate,
  type CanonicalProviderOrder,
} from '../src/modules/sonata/sonata.js';
import { SONATA_STATE, ORDER_STATES } from '../src/domain/state-machines.js';
import { injectFaults } from '../src/modules/simulation/engine.js';
import { systemMeta } from '../src/modules/context.js';
import { ContainerlabAdapter, MininetOpticalAdapter } from '../src/modules/simulation/external-stubs.js';

const canonical: CanonicalProviderOrder = {
  platformOrderId: 'ord-1', subOrderId: 'sub-1', providerId: 'prv-alpha', buyerId: 'cus-a',
  items: [{ itemId: '1', action: 'add', productCode: 'EPL', bandwidthMbps: 1000, segmentIds: ['seg-jkt-sby'], aEnd: { locationId: 'jkt', nodeId: 'nd-jkt' }, bEnd: { locationId: 'sby', nodeId: 'nd-sby' }, termMonths: 12, quote: { quoteId: 'qt-1', quoteItemId: '1' } }],
};

let env: TestEnv;
beforeAll(async () => { env = await makeEnv(); });
afterAll(async () => env.close());

describe('Sonata mock adapter — contract tests (illustrative contract, no conformance claim)', () => {
  it('maps the canonical order to a request that satisfies the illustrative contract', () => {
    const body = toSonataCreate(canonical);
    expect(contractErrors(SonataProductOrderCreate, body)).toEqual([]);
    expect(body.productOrderItem[0].quoteItem).toEqual({ id: '1', quoteId: 'qt-1' }); // REA: ref requires [id, quoteId]
    expect(body.productOrderItem[0].action).toBe('add');
  });
  it('rejects requests violating the contract', () => {
    const bad: any = toSonataCreate(canonical);
    delete bad.productOrderItem[0].quoteItem.quoteId;
    bad.productOrderItem[0].product.place = [bad.productOrderItem[0].product.place[0]];
    const errs = contractErrors(SonataProductOrderCreate, bad);
    expect(errs.some((e) => e.includes('quoteId'))).toBe(true);
    expect(errs.some((e) => e.includes('place'))).toBe(true);
  });
  it('mock seller acknowledges valid orders with a contract-valid response and logs the message', async () => {
    const r = await env.ctx.db.tx((q) => new SonataMockSeller().createProductOrder(q, 'prv-alpha', toSonataCreate(canonical), null as any, env.clock.now()));
    expect(r.state).toBe('acknowledged');
    expect(contractErrors(SonataProductOrderResponse, r)).toEqual([]);
    const m = (await env.ctx.db.query(`SELECT * FROM sonata_messages ORDER BY created_at DESC LIMIT 1`)).rows[0];
    expect(m.adapter_mode).toBe('MOCK');
    expect(m.request.path).toBe('/mefApi/sonata/productOrderingManagement/v11/productOrder');
  });
  it('mock seller times out while a PROVIDER_API_TIMEOUT fault is active', async () => {
    await injectFaults(env.ctx, systemMeta('t'), [{ type: 'PROVIDER_API_TIMEOUT', targetType: 'PROVIDER', targetId: 'prv-alpha' }]);
    await expect(env.ctx.db.tx((q) => new SonataMockSeller().createProductOrder(q, 'prv-alpha', toSonataCreate(canonical), null as any, env.clock.now()))).rejects.toThrow(/timed out/);
  });
  it('real adapter is NOT CONNECTED by construction', () => {
    expect(() => new SonataRealAdapter()).toThrow(/NOT CONNECTED/);
  });
  it('state mapping only marks the REA-verified states as verified', () => {
    for (const s of ORDER_STATES) expect(SONATA_STATE[s]).toBeTruthy();
    const verified = new Set(Object.values(SONATA_STATE).filter((v) => v.verified).map((v) => v.state));
    expect([...verified].sort()).toEqual(['acknowledged', 'cancelled', 'completed', 'inProgress']);
  });
});

describe('API hardening', () => {
  it('OpenAPI document is generated and covers the main domains', async () => {
    const r = await env.app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(r.statusCode).toBe(200);
    const doc = r.json();
    expect(doc.openapi).toMatch(/^3\./);
    for (const p of ['/api/quotes', '/api/orders/{id}/pay', '/api/simulation/faults', '/api/provider/suborders/{id}/respond', '/api/settlement/ledger', '/api/noc/overview']) {
      expect(Object.keys(doc.paths)).toContain(p);
    }
  });
  it('every response carries X-Request-ID and propagates a client one', async () => {
    const r = await env.app.inject({ method: 'GET', url: '/api/health', headers: { 'x-request-id': 'client-req-12345' } });
    expect(r.headers['x-request-id']).toBe('client-req-12345');
    expect(r.headers['x-simulation']).toBe('true');
  });
  it('rejects reuse of an Idempotency-Key with a different body', async () => {
    const c = api(env, await login(env, 'customer.a@demo.local'));
    const body = { aLocationId: 'jkt', bLocationId: 'sin', bandwidthMbps: 100, protection: 'NONE', productId: 'prd-epl', slaProfileId: 'sla-regional', termMonths: 12 };
    const a = await c.post('/api/quotes', body, { 'idempotency-key': 'k1' });
    expect(a.status).toBe(201);
    const b = await c.post('/api/quotes', { ...body, bandwidthMbps: 200 }, { 'idempotency-key': 'k1' });
    expect(b.status).toBe(422);
    expect(b.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
  it('validates input', async () => {
    const c = api(env, await login(env, 'customer.a@demo.local'));
    const r = await c.post('/api/quotes', { aLocationId: 'jkt', bLocationId: 'sin', bandwidthMbps: -5, protection: 'MAYBE' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('wrong password is rejected and audited without leaking which part was wrong', async () => {
    const r = await env.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nobody@demo.local', password: 'x' } });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.message).toBe('Invalid email or password');
    const audits = (await env.ctx.db.query(`SELECT * FROM audit_events WHERE action='auth.login' AND outcome='DENIED'`)).rows;
    expect(audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(audits)).not.toContain('"password"');
  });
  it('session cookie is httpOnly + SameSite=Lax', async () => {
    const r = await env.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'noc@demo.local', password: 'test-password' } });
    const c = r.cookies.find((x) => x.name === 'cring_sid')!;
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe('Lax');
  });
  it('integration status is honest: MOCK / NOT CONNECTED / NOT AVAILABLE, egress guard on', async () => {
    const c = api(env, await login(env, 'admin@demo.local'));
    const r = (await c.get('/api/integrations')).body;
    expect(r.sonata.mode).toBe('MOCK');
    expect(r.sonata.connection).toBe('NOT CONNECTED');
    expect(r.payment.connection).toBe('NOT CONNECTED');
    expect(r.egressGuard).toMatch(/ACTIVE/);
    expect(r.simulators[0].label).toBe('SIMULATED');
    expect(r.simulators.slice(1).every((s: any) => s.available === false)).toBe(true);
    expect((await new ContainerlabAdapter().status()).available).toBe(false);
    expect((await new MininetOpticalAdapter().status()).available).toBe(false);
  });
  it('outbound fetch to non-allowlisted hosts is blocked', async () => {
    await expect(fetch('https://example.com/')).rejects.toThrow(/EGRESS_DENIED/);
  });
  it('settings validation refuses an undocumented fee basis', async () => {
    const c = api(env, await login(env, 'admin@demo.local'));
    const r = await c.put('/api/settings/platform_fee', { value: { rate: 0.1, basis: 'NET' } });
    expect(r.status).toBe(422);
  });
});

describe('login rate limit', () => {
  it('returns 429 after the configured number of attempts', async () => {
    const e = await makeEnv({ loginRateLimitPerMinute: 3 });
    try {
      const codes = [];
      for (let i = 0; i < 5; i++) codes.push((await e.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'x@y', password: 'z' } })).statusCode);
      expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
      expect(codes.slice(3)).toEqual([429, 429]);
    } finally {
      await e.close();
    }
  });
});
