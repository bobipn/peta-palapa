import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { guard, guardAudited, idempotent, SESSION_COOKIE } from './app.js';
import { AppError, notFound } from '../lib/util.js';
import { PERMISSIONS } from '../domain/rbac.js';
import { ORDER_STATES, ORDER_STATE_LABEL, SERVICE_STATES } from '../domain/state-machines.js';
import { audit, getSettings, getSimState, simTimeOf, type Ctx } from '../modules/context.js';
import { login, logout } from '../modules/auth.js';
import { listLocations, nodeDetail, segmentDetail, topologyView } from '../modules/topology.js';
import { createQuote, getQuote, listQuotes, searchRoutes } from '../modules/quotes.js';
import { acceptQuote, assertCustomer, cancelOrder, getOrderDetail, listOrders, payOrder, terminateService } from '../modules/orders.js';
import { listSuborders, providerAssets, respondSuborder, updateOwnSegment, updateProviderSettings } from '../modules/providers.js';
import { ackAlarm, getIncident, getService, serviceLive, listAlarms, listIncidents, listServices, nocOverview, runServiceTests, slaSummary, telemetry } from '../modules/assurance.js';
import { ledger, markSettled, settlementSummary } from '../modules/settlement.js';
import { injectFaults, resetSimulation, restoreFault, runScenario, tick } from '../modules/simulation/engine.js';
import { FAULT_TARGET, FAULT_TYPES } from '../modules/simulation/adapter.js';
import { ContainerlabAdapter, MininetOpticalAdapter } from '../modules/simulation/external-stubs.js';
import { contractErrors, SONATA_INTEGRATION_STATUS, SonataProductOrderCreate, SonataMockSeller } from '../modules/sonata/sonata.js';
import { runOnce } from '../modules/orchestrator.js';
import { resetDemo } from '../db/seed.js';
import { isEgressGuardInstalled } from '../lib/egress.js';

const Id = Type.Object({ id: Type.String({ minLength: 1, maxLength: 80 }) });
const LocId = Type.String({ minLength: 1, maxLength: 20 });
const RouteSearch = Type.Object({
  aLocationId: LocId,
  bLocationId: LocId,
  bandwidthMbps: Type.Integer({ minimum: 1, maximum: 400_000 }),
  protection: Type.Union([Type.Literal('NONE'), Type.Literal('PROTECTED')]),
  slaProfileId: Type.Optional(Type.String()),
  productId: Type.Optional(Type.String()),
  objective: Type.Optional(Type.Union([Type.Literal('LATENCY'), Type.Literal('COST'), Type.Literal('BALANCED')])),
  excludeProviders: Type.Optional(Type.Array(Type.String(), { maxItems: 10 })),
});

export async function registerRoutes(fastify: FastifyInstance, ctx: Ctx) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const tags = (t: string) => ({ tags: [t] });

  // ------------------------------------------------------------------ meta
  app.get('/api/health', { schema: { ...tags('meta'), security: [] } }, async (req) => {
    await ctx.db.query('SELECT 1');
    const https = req.protocol === 'https';
    return {
      status: 'ok', db: ctx.db.kind, simulated: true, time: ctx.clock.now().toISOString(),
      checks: {
        requestProtocol: req.protocol,
        cookieSecure: ctx.config.cookieSecure,
        trustProxy: ctx.config.trustProxy,
        sessionCookieUsable: https || !ctx.config.cookieSecure,
        hint: https || !ctx.config.cookieSecure ? null : 'COOKIE_SECURE=true but this request is not HTTPS: browsers drop the session cookie. Open the site via https:// (and keep TRUST_PROXY=true behind cPanel), or set COOKIE_SECURE=false for plain-http testing.',
      },
    };
  });

  app.get('/api/meta', { schema: { ...tags('meta'), security: [] } }, async () => ({
    product: 'C-Ring Market Digital Twin & Virtual Network Testbed',
    simulated: true,
    disclaimer: 'All providers, cables, capacities, prices, payments and metrics are SIMULATED. No production integration.',
    orderStates: ORDER_STATES.map((s) => ({ state: s, label: ORDER_STATE_LABEL[s] })),
    serviceStates: SERVICE_STATES,
    faultTypes: FAULT_TYPES.map((t) => ({ type: t, targets: FAULT_TARGET[t] })),
    permissions: PERMISSIONS,
  }));

  // ------------------------------------------------------------------ auth
  app.post('/api/auth/login', {
    schema: { ...tags('auth'), security: [], body: Type.Object({ email: Type.String({ maxLength: 200 }), password: Type.String({ maxLength: 200 }) }) },
    config: { rateLimit: { max: ctx.config.loginRateLimitPerMinute, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const r = await login(ctx, req.meta, req.body.email, req.body.password);
    reply.setCookie(SESSION_COOKIE, r.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: ctx.config.cookieSecure, expires: r.expires });
    return { user: r.principal, expiresAt: r.expires };
  });
  app.post('/api/auth/logout', { schema: tags('auth') }, async (req, reply) => {
    await logout(ctx, req.meta, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
  app.get('/api/auth/me', { schema: tags('auth') }, async (req) => {
    if (!req.principal) throw new AppError(401, 'UNAUTHENTICATED', 'Login required');
    return { user: req.principal };
  });

  // ------------------------------------------------------------------ catalog & topology
  app.get('/api/locations', { schema: tags('catalog'), preHandler: guard('catalog:read') }, async () => listLocations(ctx.db));
  app.get('/api/products', { schema: tags('catalog'), preHandler: guard('catalog:read') }, async () => (await ctx.db.query(`SELECT * FROM products ORDER BY code`)).rows);
  app.get('/api/sla-profiles', { schema: tags('catalog'), preHandler: guard('catalog:read') }, async () => (await ctx.db.query(`SELECT * FROM sla_profiles ORDER BY latency_ms`)).rows);
  app.put('/api/sla-profiles/:id', {
    schema: { ...tags('catalog'), params: Id, body: Type.Object({
      latencyMs: Type.Number({ exclusiveMinimum: 0, maximum: 1000 }), jitterMs: Type.Number({ exclusiveMinimum: 0, maximum: 500 }),
      lossPct: Type.Number({ minimum: 0, maximum: 100 }), availabilityPct: Type.Number({ minimum: 90, maximum: 100 }),
    }) },
    preHandler: guardAudited(ctx, 'catalog:write'),
  }, async (req) => {
    const b = req.body;
    const r = await ctx.db.query(`UPDATE sla_profiles SET latency_ms=$2, jitter_ms=$3, loss_pct=$4, availability_pct=$5 WHERE id=$1 RETURNING *`, [req.params.id, b.latencyMs, b.jitterMs, b.lossPct, b.availabilityPct]);
    if (!r.rows[0]) throw notFound('SLA profile');
    await audit(ctx.db, ctx, req.meta, { action: 'sla_profile.update', entityType: 'sla_profile', entityId: req.params.id, details: b });
    return r.rows[0];
  });

  app.get('/api/topology', { schema: tags('network'), preHandler: guard('topology:read') }, async (req) => topologyView(ctx.db, req.principal!));
  app.get('/api/topology/nodes/:id', { schema: { ...tags('network'), params: Id }, preHandler: guard('topology:read') }, async (req) => nodeDetail(ctx.db, req.params.id));
  app.get('/api/topology/segments/:id', { schema: { ...tags('network'), params: Id }, preHandler: guard('topology:read') }, async (req) => segmentDetail(ctx.db, req.params.id, req.principal!));

  app.post('/api/routes/search', { schema: { ...tags('marketplace'), body: RouteSearch }, preHandler: guard('routes:search') }, async (req) => searchRoutes(ctx.db, req.body));

  // ------------------------------------------------------------------ quotes & orders
  app.post('/api/quotes', {
    schema: { ...tags('marketplace'), body: Type.Composite([RouteSearch, Type.Object({
      productId: Type.String(), slaProfileId: Type.String(), termMonths: Type.Integer({ minimum: 1, maximum: 120 }), routeSignature: Type.Optional(Type.String({ maxLength: 2000 })),
    })]) },
    preHandler: guardAudited(ctx, 'quotes:create'),
  }, async (req, reply) => idempotent(ctx, req, reply, 'quotes.create', async () => ({ status: 201, body: await createQuote(ctx, req.meta, req.body) })));
  app.get('/api/quotes', { schema: tags('marketplace'), preHandler: guard('quotes:read') }, async (req) => listQuotes(ctx.db, req.principal!));
  app.get('/api/quotes/:id', { schema: { ...tags('marketplace'), params: Id }, preHandler: guard('quotes:read') }, async (req) => getQuote(ctx.db, req.principal!, req.params.id));
  app.post('/api/quotes/:id/accept', { schema: { ...tags('marketplace'), params: Id }, preHandler: guardAudited(ctx, 'orders:create') }, async (req, reply) =>
    idempotent(ctx, req, reply, 'quotes.accept', async () => {
      assertCustomer(req.principal!);
      const id = await acceptQuote(ctx, req.meta, req.params.id);
      return { status: 201, body: await getOrderDetail(ctx.db, req.principal!, id) };
    }));

  app.get('/api/orders', { schema: tags('orders'), preHandler: guard('orders:read') }, async (req) => listOrders(ctx.db, req.principal!));
  app.get('/api/orders/:id', { schema: { ...tags('orders'), params: Id }, preHandler: guard('orders:read') }, async (req) => getOrderDetail(ctx.db, req.principal!, req.params.id));
  app.post('/api/orders/:id/pay', { schema: { ...tags('orders'), params: Id, description: 'SIMULATED checkout. No payment gateway is called.' }, preHandler: guardAudited(ctx, 'orders:pay') }, async (req, reply) =>
    idempotent(ctx, req, reply, 'orders.pay', async () => ({ status: 200, body: await payOrder(ctx, req.meta, req.params.id) })));
  app.post('/api/orders/:id/cancel', { schema: { ...tags('orders'), params: Id, body: Type.Optional(Type.Object({ reason: Type.Optional(Type.String({ maxLength: 500 })) })) }, preHandler: guardAudited(ctx, 'orders:cancel') }, async (req) =>
    cancelOrder(ctx, req.meta, req.params.id, req.body?.reason));

  // ------------------------------------------------------------------ provider portal
  app.get('/api/provider/suborders', { schema: tags('provider'), preHandler: guard('orders:read') }, async (req) => {
    if (!['PROVIDER', 'ADMIN', 'NOC', 'COMMERCIAL', 'AUDITOR'].includes(req.principal!.role)) throw new AppError(403, 'FORBIDDEN', 'Not allowed');
    return listSuborders(ctx.db, req.principal!);
  });
  app.post('/api/provider/suborders/:id/respond', {
    schema: { ...tags('provider'), params: Id, body: Type.Object({ decision: Type.Union([Type.Literal('ACCEPT'), Type.Literal('REJECT'), Type.Literal('CLARIFY')]), note: Type.Optional(Type.String({ maxLength: 1000 })) }) },
    preHandler: guardAudited(ctx, 'suborders:respond'),
  }, async (req) => respondSuborder(ctx, req.meta, req.params.id, req.body.decision, req.body.note));
  app.get('/api/provider/assets', { schema: tags('provider'), preHandler: guard('provider:assets:write') }, async (req) => providerAssets(ctx.db, req.principal!));
  app.patch('/api/provider/segments/:id', {
    schema: { ...tags('provider'), params: Id, body: Type.Object({ pricePerGbpsMonth: Type.Optional(Type.Integer({ minimum: 0 })), adminStatus: Type.Optional(Type.Union([Type.Literal('UP'), Type.Literal('DOWN')])) }) },
    preHandler: guardAudited(ctx, 'provider:assets:write'),
  }, async (req) => updateOwnSegment(ctx, req.meta, req.params.id, req.body));
  app.patch('/api/provider/settings', { schema: { ...tags('provider'), body: Type.Object({ autoAccept: Type.Optional(Type.Boolean()) }) }, preHandler: guardAudited(ctx, 'provider:assets:write') }, async (req) =>
    updateProviderSettings(ctx, req.meta, req.body));

  // ------------------------------------------------------------------ services & provisioning
  app.get('/api/services', { schema: tags('services'), preHandler: guard('services:read') }, async (req) => listServices(ctx.db, req.principal!));
  app.get('/api/services/:id', { schema: { ...tags('services'), params: Id }, preHandler: guard('services:read') }, async (req) => getService(ctx.db, req.principal!, req.params.id));
  app.get('/api/services/:id/telemetry', {
    schema: { ...tags('services'), params: Id, querystring: Type.Object({ fromTick: Type.Optional(Type.Integer({ minimum: 0 })), toTick: Type.Optional(Type.Integer({ minimum: 0 })) }) },
    preHandler: guard('services:read'),
  }, async (req) => telemetry(ctx.db, req.principal!, req.params.id, req.query.fromTick, req.query.toTick));
  app.get('/api/services/:id/live', { schema: { ...tags('services'), params: Id, description: 'Per-node/per-link provisioning & activation state (SIMULATED)' }, preHandler: guard('services:read') }, async (req) =>
    serviceLive(ctx, req.principal!, req.params.id));
  app.post('/api/services/:id/tests', { schema: { ...tags('services'), params: Id }, preHandler: guardAudited(ctx, 'services:test') }, async (req) => runServiceTests(ctx, req.meta, req.principal!, req.params.id));
  app.post('/api/services/:id/terminate', { schema: { ...tags('services'), params: Id }, preHandler: guardAudited(ctx, 'services:terminate') }, async (req) => {
    await terminateService(ctx, req.meta, req.params.id);
    return { ok: true };
  });

  app.get('/api/provisioning/workflows', { schema: tags('provisioning'), preHandler: guard('provisioning:read') }, async () =>
    (await ctx.db.query(`SELECT w.*, o.state AS order_state, s.name AS service_name,
       (SELECT count(*)::int FROM provisioning_tasks t WHERE t.workflow_id=w.id AND t.state='DONE') AS done_tasks,
       (SELECT count(*)::int FROM provisioning_tasks t WHERE t.workflow_id=w.id) AS total_tasks,
       (SELECT type FROM provisioning_tasks t WHERE t.workflow_id=w.id AND t.state IN ('PENDING','RUNNING','WAITING') ORDER BY seq LIMIT 1) AS current_task
     FROM provisioning_workflows w JOIN orders o ON o.id=w.order_id LEFT JOIN services s ON s.id=w.service_id ORDER BY w.created_at DESC LIMIT 200`)).rows);
  app.get('/api/provisioning/workflows/:id', { schema: { ...tags('provisioning'), params: Id }, preHandler: guard('provisioning:read') }, async (req) => {
    const wf = (await ctx.db.query(`SELECT * FROM provisioning_workflows WHERE id=$1`, [req.params.id])).rows[0];
    if (!wf) throw notFound('Workflow');
    const tasks = (await ctx.db.query(`SELECT * FROM provisioning_tasks WHERE workflow_id=$1 ORDER BY seq`, [wf.id])).rows;
    const events = (await ctx.db.query(`SELECT * FROM domain_events WHERE aggregate_type='workflow' AND aggregate_id=$1 ORDER BY id`, [wf.id])).rows;
    return { workflow: wf, tasks, events };
  });
  app.post('/api/provisioning/run', { schema: { ...tags('provisioning'), description: 'Run the workflow scheduler once (normally runs in the background).' }, preHandler: guardAudited(ctx, 'simulation:control') }, async () => ({ processed: await runOnce(ctx) }));

  // ------------------------------------------------------------------ assurance
  app.get('/api/noc/overview', { schema: tags('assurance'), preHandler: guard('assurance:read') }, async (req) => nocOverview(ctx.db, req.principal!));
  app.get('/api/sla/summary', { schema: tags('assurance'), preHandler: guard('assurance:read') }, async (req) => slaSummary(ctx.db, req.principal!));
  app.get('/api/alarms', { schema: { ...tags('assurance'), querystring: Type.Object({ state: Type.Optional(Type.Union([Type.Literal('ACTIVE'), Type.Literal('CLEARED')])) }) }, preHandler: guard('assurance:read') }, async (req) =>
    listAlarms(ctx.db, req.principal!, req.query.state));
  app.post('/api/alarms/:id/ack', { schema: { ...tags('assurance'), params: Id }, preHandler: guardAudited(ctx, 'alarms:ack') }, async (req) => {
    await ackAlarm(ctx, req.meta, req.params.id);
    return { ok: true };
  });
  app.get('/api/incidents', { schema: tags('assurance'), preHandler: guard('assurance:read') }, async (req) => listIncidents(ctx.db, req.principal!));
  app.get('/api/incidents/:id', { schema: { ...tags('assurance'), params: Id }, preHandler: guard('assurance:read') }, async (req) => getIncident(ctx.db, req.principal!, req.params.id));

  // ------------------------------------------------------------------ simulation lab
  app.get('/api/simulation/state', { schema: tags('simulation'), preHandler: guard('simulation:read') }, async () => {
    const s = await getSimState(ctx.db);
    const faults = (await ctx.db.query(`SELECT * FROM injected_faults ORDER BY created_at DESC LIMIT 100`)).rows;
    return { ...s, simTime: simTimeOf(s), adapter: await ctx.sim.status(), faults, label: 'SIMULATED' };
  });
  app.get('/api/simulation/scenarios', { schema: tags('simulation'), preHandler: guard('simulation:read') }, async () => (await ctx.db.query(`SELECT * FROM simulation_scenarios ORDER BY code`)).rows);
  app.post('/api/simulation/tick', { schema: { ...tags('simulation'), body: Type.Object({ count: Type.Integer({ minimum: 1, maximum: 1440 }) }) }, preHandler: guardAudited(ctx, 'simulation:control') }, async (req) =>
    tick(ctx, req.meta, req.body.count));
  app.post('/api/simulation/faults', {
    schema: { ...tags('simulation'), body: Type.Object({
      type: Type.Union(FAULT_TYPES.map((t) => Type.Literal(t))),
      targetType: Type.Union(['SEGMENT', 'NODE', 'PORT', 'PROVIDER', 'SERVICE', 'GLOBAL'].map((t) => Type.Literal(t))),
      targetId: Type.Optional(Type.Union([Type.String({ maxLength: 80 }), Type.Null()])),
      params: Type.Optional(Type.Object({ addMs: Type.Optional(Type.Number({ minimum: 0, maximum: 5000 })), addPct: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })) })),
    }) },
    preHandler: guardAudited(ctx, 'simulation:control'),
  }, async (req, reply) => {
    const b = req.body;
    const r = await injectFaults(ctx, req.meta, [{ type: b.type as any, targetType: b.targetType as any, targetId: b.targetId ?? null, params: b.params }]);
    return reply.status(201).send(r);
  });
  app.post('/api/simulation/faults/:id/restore', { schema: { ...tags('simulation'), params: Id }, preHandler: guardAudited(ctx, 'simulation:control') }, async (req) => restoreFault(ctx, req.meta, req.params.id));
  app.post('/api/simulation/scenarios/:code/run', { schema: { ...tags('simulation'), params: Type.Object({ code: Type.String({ maxLength: 60 }) }) }, preHandler: guardAudited(ctx, 'simulation:control') }, async (req, reply) =>
    reply.status(201).send(await runScenario(ctx, req.meta, req.params.code)));
  app.post('/api/simulation/reset', { schema: { ...tags('simulation'), description: 'Clears faults, telemetry, alarms and incidents; sim clock -> 0. Orders/services kept.' }, preHandler: guardAudited(ctx, 'simulation:control') }, async (req) => {
    await resetSimulation(ctx, req.meta);
    return { ok: true, tick: 0 };
  });
  app.patch('/api/simulation/settings', { schema: { ...tags('simulation'), body: Type.Object({ autoTick: Type.Boolean() }) }, preHandler: guardAudited(ctx, 'simulation:control') }, async (req) => {
    await ctx.db.query(`UPDATE simulation_state SET auto_tick=$1 WHERE id=1`, [req.body.autoTick]);
    await audit(ctx.db, ctx, req.meta, { action: 'simulation.settings', details: req.body });
    return getSimState(ctx.db);
  });

  // ------------------------------------------------------------------ settlement
  app.get('/api/settlement/summary', { schema: tags('settlement'), preHandler: guard('settlement:read') }, async (req) => settlementSummary(ctx.db, req.principal!));
  app.get('/api/settlement/ledger', { schema: tags('settlement'), preHandler: guard('settlement:read') }, async (req) => ledger(ctx.db, req.principal!));
  app.post('/api/settlement/orders/:id/settle', { schema: { ...tags('settlement'), params: Id, description: 'Marks entries SETTLED_SIMULATED. No money moves.' }, preHandler: guardAudited(ctx, 'settlement:write') }, async (req) =>
    markSettled(ctx, req.meta, req.params.id));

  // ------------------------------------------------------------------ settings, audit, admin
  app.get('/api/settings', { schema: tags('admin'), preHandler: guard('settings:read') }, async () => getSettings(ctx.db));
  app.put('/api/settings/:key', { schema: { ...tags('admin'), params: Type.Object({ key: Type.String({ maxLength: 60 }) }), body: Type.Object({ value: Type.Unknown() }) }, preHandler: guardAudited(ctx, 'settings:write') }, async (req) => {
    const allowed = Object.keys(await getSettings(ctx.db));
    if (!allowed.includes(req.params.key)) throw notFound('Setting');
    validateSetting(req.params.key, req.body.value);
    await ctx.db.query(`UPDATE platform_settings SET value=$2, updated_at=$3, updated_by=$4 WHERE key=$1`, [req.params.key, JSON.stringify(req.body.value), ctx.clock.now(), req.principal!.userId]);
    await audit(ctx.db, ctx, req.meta, { action: 'settings.update', entityType: 'setting', entityId: req.params.key, details: { value: req.body.value } });
    return getSettings(ctx.db);
  });
  app.get('/api/audit', { schema: { ...tags('admin'), querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })) }) }, preHandler: guard('audit:read') }, async (req) =>
    (await ctx.db.query(`SELECT * FROM audit_events ORDER BY id DESC LIMIT $1`, [req.query.limit ?? 300])).rows);
  app.get('/api/events', {
    schema: { ...tags('admin'), querystring: Type.Object({ aggregateType: Type.Optional(Type.String()), aggregateId: Type.Optional(Type.String()), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })) }) },
    preHandler: guard('audit:read'),
  }, async (req) =>
    (await ctx.db.query(`SELECT * FROM domain_events WHERE ($1::text IS NULL OR aggregate_type=$1) AND ($2::text IS NULL OR aggregate_id=$2) ORDER BY id DESC LIMIT $3`, [
      req.query.aggregateType ?? null, req.query.aggregateId ?? null, req.query.limit ?? 300,
    ])).rows);
  app.get('/api/users', { schema: tags('admin'), preHandler: guard('users:read') }, async () =>
    (await ctx.db.query(`SELECT id, email, display_name, role, org_id, active FROM users ORDER BY role, email`)).rows);
  app.post('/api/admin/reset-demo', { schema: { ...tags('admin'), description: 'Truncates demo data and re-seeds. Schema and migration history are kept.' }, preHandler: guardAudited(ctx, 'admin:reset') }, async (req, reply) => {
    await resetDemo(ctx.db, { clock: ctx.clock, demoPassword: ctx.config.demoPassword });
    await audit(ctx.db, ctx, { ...req.meta, actor: null }, { action: 'admin.reset_demo', details: { by: req.principal!.email } });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true, note: 'All sessions were cleared by the reset; log in again.' };
  });

  // ------------------------------------------------------------------ integrations
  app.get('/api/integrations', { schema: tags('integrations'), preHandler: guard('integrations:read') }, async () => ({
    egressGuard: isEgressGuardInstalled() ? 'ACTIVE (default-deny outbound fetch)' : 'NOT INSTALLED',
    simulators: [await ctx.sim.status(), await new ContainerlabAdapter().status(), await new MininetOpticalAdapter().status()],
    sonata: SONATA_INTEGRATION_STATUS,
    payment: { mode: 'SIMULATED', connection: 'NOT CONNECTED', note: 'No payment gateway; checkout only flips a flag.' },
    billing: { mode: 'SIMULATED ledger', connection: 'NOT CONNECTED' },
  }));
  app.get('/api/integrations/sonata/orders/:id', { schema: { ...tags('integrations'), params: Id }, preHandler: guard('integrations:read') }, async (req) => {
    const msgs = (await ctx.db.query(`SELECT * FROM sonata_messages WHERE order_id=$1 ORDER BY created_at`, [req.params.id])).rows;
    return { mode: 'MOCK', conformance: SONATA_INTEGRATION_STATUS.conformance, messages: msgs };
  });

  // Local mock Seller endpoint (illustrative contract). Never forwards anywhere.
  app.post('/mock/sonata/productOrder', {
    schema: { ...tags('integrations'), description: 'MOCK Sonata seller (illustrative, no conformance claim). Validates the illustrative contract and returns acknowledged.', body: Type.Unknown() },
    preHandler: guard('integrations:read'),
  }, async (req, reply) => {
    const errors = contractErrors(SonataProductOrderCreate, req.body);
    if (errors.length) return reply.status(422).send({ mode: 'MOCK', errors });
    const body = await ctx.db.tx((q) => new SonataMockSeller().createProductOrder(q, 'prv-alpha', req.body as any, null as any, ctx.clock.now()));
    return reply.status(201).send({ mode: 'MOCK', ...body });
  });
}

function validateSetting(key: string, v: any) {
  const bad = (m: string) => { throw new AppError(422, 'INVALID_SETTING', m); };
  switch (key) {
    case 'platform_fee':
      if (typeof v?.rate !== 'number' || v.rate < 0 || v.rate >= 0.5) bad('platform_fee.rate must be in [0, 0.5)');
      if (!['GROSS', 'WHOLESALE'].includes(v?.basis)) bad('platform_fee.basis must be GROSS or WHOLESALE');
      if (typeof v?.note !== 'string') bad('platform_fee.note is required (state that the basis is DEMO/unagreed)');
      break;
    case 'tax':
      if (typeof v?.rate !== 'number' || v.rate < 0 || v.rate > 0.5) bad('tax.rate must be in [0, 0.5]');
      break;
    case 'currency':
      if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) bad('currency must be an ISO-4217 code');
      break;
    case 'protection_revertive':
      if (typeof v !== 'boolean') bad('must be boolean');
      break;
    default:
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100_000) bad(`${key} must be a non-negative number`);
  }
}
