import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from '../config.js';
import { openDb, type Db } from '../db/db.js';
import { migrate } from '../db/migrate.js';
import { seed } from '../db/seed.js';
import { ensureInventoryV2 } from '../modules/netconfig.js';
import { installEgressGuard } from '../lib/egress.js';
import { AppError, systemClock, type Clock } from '../lib/util.js';
import { can, type Permission, type Principal } from '../domain/rbac.js';
import { audit, getSimState, systemMeta, type Ctx, type Meta } from '../modules/context.js';
import { resolveSession } from '../modules/auth.js';
import { DeterministicSimulationAdapter } from '../modules/simulation/deterministic.js';
import { recoverInterrupted, runOnce } from '../modules/orchestrator.js';
import { sweepTimeouts } from '../modules/orders.js';
import { tick } from '../modules/simulation/engine.js';
import { registerRoutes } from './routes.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | null;
    meta: Meta;
  }
}

export const SESSION_COOKIE = 'cring_sid';

export async function buildApp(config: AppConfig, opts: { clock?: Clock; db?: Db } = {}) {
  installEgressGuard(config.egressAllowlist);
  const clock = opts.clock ?? systemClock;
  const db = opts.db ?? (await openDb(config.databaseUrl));
  await migrate(db);
  const seeded = (await db.query(`SELECT count(*)::int AS n FROM organizations`)).rows[0].n > 0;
  if (!seeded) await seed(db, { clock, demoPassword: config.demoPassword });
  else await ensureInventoryV2(db, clock); // upgrades databases created before NOC v2

  const app = Fastify({
    logger: config.env === 'test' ? false : { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'body.password'] },
    trustProxy: config.trustProxy,
    genReqId: (req) => {
      const h = req.headers['x-request-id'];
      return typeof h === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(h) ? h : randomUUID();
    },
    bodyLimit: 256 * 1024,
  }).withTypeProvider<TypeBoxTypeProvider>();

  const ctx: Ctx = {
    db, clock, config,
    sim: undefined as never,
    log: { info: (o, m) => app.log.info(o, m), warn: (o, m) => app.log.warn(o, m), error: (o, m) => app.log.error(o, m) },
  };
  ctx.sim = new DeterministicSimulationAdapter({ db, clock, ctx: () => ctx });

  await app.register(cookie);
  await app.register(rateLimit, { max: config.rateLimitPerMinute, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'C-Ring Market Virtual Testbed API (SIMULATED)',
        version: '0.1.0',
        description:
          'Digital twin of a connectivity marketplace and its network. Every provider, cable, price and metric is SIMULATED. ' +
          'No call is made to real providers, devices, billing or payment systems. Mutating endpoints accept an Idempotency-Key header; every response carries X-Request-ID.',
      },
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE } } },
      security: [{ session: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  app.decorateRequest('principal', null);
  app.decorateRequest('meta', null as unknown as Meta);
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-ID', req.id);
    req.meta = { actor: null, correlationId: String(req.id), ip: req.ip };
    if (!req.url.startsWith('/api/')) return;
    req.principal = await resolveSession(ctx, req.cookies[SESSION_COOKIE]);
    req.meta.actor = req.principal;
    // CSRF defence-in-depth (cookies are SameSite=Lax): reject cross-origin mutations.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        const allowed = new Set([req.headers.host, ...String(req.headers['x-forwarded-host'] ?? '').split(',').map((s) => s.trim())].filter(Boolean));
        let originHost = '';
        try { originHost = new URL(origin).host; } catch { /* malformed or "null" origin */ }
        if (!allowed.has(originHost)) throw new AppError(403, 'CROSS_ORIGIN', 'Cross-origin request rejected');
      }
    }
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Simulation', 'true');
    if (!reply.getHeader('content-security-policy')) {
      reply.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
    }
    return payload;
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details ?? null, requestId: req.id } });
    if (err.validation) return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: err.message, details: err.validation, requestId: req.id } });
    if (err.statusCode === 429) return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: req.id } });
    if (err.code === '23514') return reply.status(409).send({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Operation would violate a capacity/integrity constraint', requestId: req.id } });
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal error', requestId: req.id } });
  });

  await registerRoutes(app, ctx);

  // SPA (built by Vite). API 404s stay JSON.
  const webDir = resolve(config.webDistDir);
  if (config.serveWeb && existsSync(webDir)) {
    await app.register(fastifyStatic, { root: webDir, prefix: '/', wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/mock/')) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
      return reply.type('text/html').sendFile('index.html');
    });
  }

  // Background loops (disabled in tests; tests drive them explicitly).
  const timers: NodeJS.Timeout[] = [];
  await recoverInterrupted(ctx);
  if (config.workerIntervalMs > 0) {
    let busy = false;
    timers.push(setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await sweepTimeouts(ctx, systemMeta('sweeper'));
        await runOnce(ctx);
      } catch (e) {
        app.log.error({ err: e }, 'worker loop error');
      } finally {
        busy = false;
      }
    }, config.workerIntervalMs));
  }
  if (config.autoTickMs > 0) {
    let busy = false;
    timers.push(setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        if ((await getSimState(db)).autoTick) await tick(ctx, systemMeta('auto-tick'), 1);
      } catch (e) {
        app.log.error({ err: e }, 'auto-tick error');
      } finally {
        busy = false;
      }
    }, config.autoTickMs));
  }
  app.addHook('onClose', async () => {
    timers.forEach(clearInterval);
    if (!opts.db) await db.close();
  });

  return { app, ctx };
}

// ------------------------------------------------------------------ helpers for routes

export function guard(perm: Permission) {
  return async (req: FastifyRequest) => {
    if (!req.principal) throw new AppError(401, 'UNAUTHENTICATED', 'Login required');
    if (!can(req.principal.role, perm)) {
      throw new AppError(403, 'FORBIDDEN', `Role ${req.principal.role} lacks permission ${perm}`);
    }
  };
}

/** Denied attempts on sensitive mutations are audited (reads are not, to keep the log useful). */
export function guardAudited(ctx: Ctx, perm: Permission) {
  const g = guard(perm);
  return async (req: FastifyRequest) => {
    try {
      await g(req);
    } catch (e) {
      if (e instanceof AppError && e.status === 403) {
        await audit(ctx.db, ctx, req.meta, { action: `denied:${perm}`, outcome: 'DENIED', details: { method: req.method, url: req.url } });
      }
      throw e;
    }
  };
}

/**
 * Idempotency-Key support for POSTs: the first response is stored per
 * (user, route, key) and replayed for identical retries; reusing a key with a
 * different body is rejected.
 */
export async function idempotent<T>(ctx: Ctx, req: FastifyRequest, reply: FastifyReply, route: string, fn: () => Promise<{ status: number; body: T }>) {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !key) {
    const r = await fn();
    return reply.status(r.status).send(r.body);
  }
  if (key.length > 128) throw new AppError(400, 'BAD_IDEMPOTENCY_KEY', 'Idempotency-Key too long');
  const uid = req.principal?.userId ?? 'anon';
  const hash = createHash('sha256').update(JSON.stringify(req.body ?? {}) + req.url).digest('hex');
  const prev = (await ctx.db.query(`SELECT * FROM idempotency_keys WHERE user_id=$1 AND route=$2 AND key=$3`, [uid, route, key])).rows[0];
  if (prev) {
    if (prev.request_hash !== hash) throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was used with a different request');
    reply.header('Idempotent-Replayed', 'true');
    return reply.status(prev.status_code).send(prev.response);
  }
  const r = await fn();
  await ctx.db.query(`INSERT INTO idempotency_keys VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [uid, route, key, hash, r.status, JSON.stringify(r.body), ctx.clock.now()]);
  return reply.status(r.status).send(r.body);
}
