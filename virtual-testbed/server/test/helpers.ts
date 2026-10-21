import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/http/app.js';
import { resetDemo } from '../src/db/seed.js';
import { ManualClock } from '../src/lib/util.js';
import { runOnce } from '../src/modules/orchestrator.js';
import type { Ctx } from '../src/modules/context.js';

export const PW = 'test-password';

export interface TestEnv {
  app: FastifyInstance;
  ctx: Ctx;
  clock: ManualClock;
  close(): Promise<void>;
}

export async function makeEnv(overrides: Partial<ReturnType<typeof loadConfig>> = {}): Promise<TestEnv> {
  const clock = new ManualClock(new Date('2026-10-21T08:00:00Z'));
  const config = { ...loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv), databaseUrl: process.env.TEST_DATABASE_URL ?? 'pglite://memory', demoPassword: PW, loginRateLimitPerMinute: 10_000, ...overrides };
  const { app, ctx } = await buildApp(config, { clock });
  await resetDemo(ctx.db, { clock, demoPassword: PW });
  return { app, ctx, clock, close: () => app.close() };
}

export async function login(env: TestEnv, email: string) {
  const r = await env.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PW } });
  expect(r.statusCode, r.body).toBe(200);
  const c = r.cookies.find((x) => x.name === 'cring_sid')!;
  return `cring_sid=${c.value}`;
}

export function api(env: TestEnv, cookie: string) {
  const call = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
    const r = await env.app.inject({ method: method as any, url, payload: payload as any, headers: { cookie, ...headers } });
    let body: any = null;
    try { body = r.json(); } catch { body = r.body; }
    return { status: r.statusCode, body, headers: r.headers };
  };
  return {
    get: (u: string) => call('GET', u),
    post: (u: string, p?: unknown, h?: Record<string, string>) => call('POST', u, p ?? {}, h),
    patch: (u: string, p?: unknown) => call('PATCH', u, p ?? {}),
    put: (u: string, p?: unknown) => call('PUT', u, p ?? {}),
  };
}

export type Api = ReturnType<typeof api>;

/** Drive the workflow scheduler, advancing the manual clock 1s per step, until the order leaves transient states. */
export async function drive(env: TestEnv, orderId: string, until: string[] = ['ACTIVE', 'FAILED', 'REJECTED', 'CANCELLED'], maxSteps = 120) {
  for (let i = 0; i < maxSteps; i++) {
    await runOnce(env.ctx);
    const o = (await env.ctx.db.query(`SELECT state FROM orders WHERE id=$1`, [orderId])).rows[0];
    const wf = (await env.ctx.db.query(`SELECT state FROM provisioning_workflows WHERE order_id=$1`, [orderId])).rows[0];
    if (until.includes(o.state) && (!wf || ['COMPLETED', 'COMPENSATED', 'FAILED'].includes(wf.state))) return o.state as string;
    env.clock.advance(1000);
  }
  throw new Error(`order ${orderId} did not settle`);
}

/** Search -> quote -> accept -> pay. Returns ids. */
export async function placeOrder(c: Api, req: { a: string; b: string; mbps: number; protection?: 'NONE' | 'PROTECTED'; sla?: string; product?: string }) {
  const q = await c.post('/api/quotes', {
    aLocationId: req.a, bLocationId: req.b, bandwidthMbps: req.mbps, protection: req.protection ?? 'NONE',
    productId: req.product ?? 'prd-epl', slaProfileId: req.sla ?? 'sla-global', termMonths: 12,
  });
  expect(q.status, JSON.stringify(q.body)).toBe(201);
  const o = await c.post(`/api/quotes/${q.body.id}/accept`);
  expect(o.status, JSON.stringify(o.body)).toBe(201);
  const orderId = o.body.order.id;
  const p = await c.post(`/api/orders/${orderId}/pay`);
  expect(p.status, JSON.stringify(p.body)).toBe(200);
  return { quote: q.body, orderId, serviceId: p.body.serviceId as string };
}
