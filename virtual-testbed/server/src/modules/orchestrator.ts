/**
 * Service orchestration workflow engine (MVP).
 *
 * - A workflow is an ordered list of persisted tasks. Every task records state,
 *   attempts, timestamps, result, error, correlation id and an idempotency key
 *   (`<workflow>:<type>`), so a crash/restart resumes instead of repeating work.
 * - Handlers return DONE / WAIT(until) / RETRY(backoff) / FAIL. A FAIL (or a
 *   cancel request) switches the workflow to compensation: reverse-order tasks
 *   that undo whatever was done (deprovision, release capacity, cancel
 *   sub-orders, refund simulated payment, finalise order state).
 * - Calls to the simulator / mock provider are made OUTSIDE DB transactions;
 *   their results are then written transactionally.
 * - Single-process scheduler: an in-process lock serialises `runOnce` and
 *   cancellation. Running several app instances would need row locking
 *   (SELECT ... FOR UPDATE SKIP LOCKED) or a message broker — see docs.
 */
import type { Queryable } from '../db/db.js';
import { newId } from '../lib/util.js';
import { ledgerLines, type PriceBreakdown } from '../domain/pricing.js';
import { canTransitionService, type OrderState, type ServiceState } from '../domain/state-machines.js';
import { audit, emitEvent, getSettings, getSimState, systemMeta, type Ctx, type Meta } from './context.js';
import { commitHolds, release, reserve } from './capacity.js';
import { loadGraph } from './topology.js';
import { allocateServiceConfig, releaseServiceConfig } from './netconfig.js';
import { transitionOrder } from './orders.js';
import { SimulationError } from './simulation/adapter.js';
import { providerFaultActive } from './simulation/engine.js';
import { SonataMockSeller, SonataTimeoutError, toSonataCreate, type CanonicalProviderOrder } from './sonata/sonata.js';

export const ACTIVATION_STEPS = [
  'VALIDATE_REQUEST', 'COMPUTE_ROUTE', 'RESERVE_CAPACITY', 'CREATE_SUBORDERS', 'AWAIT_PROVIDER_ACCEPTANCE',
  'COMMIT_RESERVATION', 'PROVISION_VIRTUAL', 'CONFIGURE_SERVICE', 'RUN_ACTIVATION_TESTS', 'ACTIVATE_SERVICE', 'START_MONITORING',
] as const;

type Outcome =
  | { kind: 'DONE'; result?: unknown }
  | { kind: 'WAIT'; until: Date; result?: unknown; note?: string }
  | { kind: 'RETRY'; error: string; delayMs?: number }
  | { kind: 'FAIL'; error: string; outcome?: OrderState };

const seller = new SonataMockSeller();

// ------------------------------------------------------------------ lock

let lockChain: Promise<unknown> = Promise.resolve();
export function withOrchestratorLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => undefined);
  return run;
}

// ------------------------------------------------------------------ creation

export async function createActivationWorkflow(q: Queryable, ctx: Ctx, meta: Meta, orderId: string, serviceId: string) {
  const id = newId('wf');
  const now = ctx.clock.now();
  await q.query(
    `INSERT INTO provisioning_workflows (id, order_id, service_id, state, correlation_id, created_at, updated_at) VALUES ($1,$2,$3,'RUNNING',$4,$5,$5)`,
    [id, orderId, serviceId, meta.correlationId, now],
  );
  let seq = 1;
  for (const type of ACTIVATION_STEPS) {
    await q.query(
      `INSERT INTO provisioning_tasks (id, workflow_id, seq, type, state, max_attempts, correlation_id, idempotency_key) VALUES ($1,$2,$3,$4,'PENDING',$5,$6,$7)`,
      [newId('tsk'), id, seq++, type, type === 'CREATE_SUBORDERS' || type === 'PROVISION_VIRTUAL' ? 3 : 1, meta.correlationId, `${id}:${type}`],
    );
  }
  await emitEvent(q, ctx, meta, { aggregateType: 'workflow', aggregateId: id, type: 'WORKFLOW_STARTED', payload: { orderId, serviceId, steps: ACTIVATION_STEPS } });
  return id;
}

/** Switch a workflow to compensation. Safe to call twice. */
export async function requestCompensation(q: Queryable, ctx: Ctx, meta: Meta, workflowId: string, reason: string, outcome: OrderState) {
  const wf = (await q.query(`SELECT * FROM provisioning_workflows WHERE id=$1 FOR UPDATE`, [workflowId])).rows[0];
  if (!wf || ['COMPENSATING', 'COMPENSATED', 'COMPLETED', 'FAILED'].includes(wf.state)) return;
  const tasks = (await q.query(`SELECT * FROM provisioning_tasks WHERE workflow_id=$1 ORDER BY seq`, [workflowId])).rows;
  const touched = (t: string) => tasks.some((x) => x.type === t && (x.state === 'DONE' || x.attempts > 0));
  const comp: string[] = [];
  if (touched('PROVISION_VIRTUAL')) comp.push('DEPROVISION_VIRTUAL');
  if (touched('RESERVE_CAPACITY')) comp.push('RELEASE_CAPACITY');
  if (touched('CREATE_SUBORDERS')) comp.push('CANCEL_SUBORDERS');
  comp.push('REFUND_PAYMENT_SIMULATED', 'FINALIZE_ORDER');
  await q.query(`UPDATE provisioning_tasks SET state='SKIPPED', finished_at=$2 WHERE workflow_id=$1 AND state IN ('PENDING','WAITING','RUNNING') AND NOT is_compensation`, [workflowId, ctx.clock.now()]);
  let seq = 100;
  for (const type of comp) {
    await q.query(
      `INSERT INTO provisioning_tasks (id, workflow_id, seq, type, is_compensation, state, max_attempts, correlation_id, idempotency_key)
       VALUES ($1,$2,$3,$4,true,'PENDING',3,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING`,
      [newId('tsk'), workflowId, seq++, type, wf.correlation_id, `${workflowId}:${type}`],
    );
  }
  await q.query(`UPDATE provisioning_workflows SET state='COMPENSATING', failure_reason=$2, outcome=$3, updated_at=$4 WHERE id=$1`, [workflowId, reason, outcome, ctx.clock.now()]);
  await emitEvent(q, ctx, meta, { aggregateType: 'workflow', aggregateId: workflowId, type: 'COMPENSATION_STARTED', payload: { reason, outcome, steps: comp } });
  await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: wf.order_id, type: 'ORDER_ROLLBACK_STARTED', payload: { reason, outcome } });
}

// ------------------------------------------------------------------ scheduler

/** Process every runnable workflow until each blocks or finishes. */
export function runOnce(ctx: Ctx) {
  return withOrchestratorLock(async () => {
    const wfs = (await ctx.db.query(`SELECT id FROM provisioning_workflows WHERE state IN ('RUNNING','WAITING','COMPENSATING') ORDER BY created_at`)).rows;
    for (const wf of wfs) await advance(ctx, wf.id);
    return wfs.length;
  });
}

/** Startup recovery: a task left RUNNING by a crash is retried (handlers are idempotent). */
export async function recoverInterrupted(ctx: Ctx) {
  await ctx.db.query(`UPDATE provisioning_tasks SET state='PENDING', error='recovered after restart' WHERE state='RUNNING'`);
}

async function advance(ctx: Ctx, workflowId: string) {
  for (let guard = 0; guard < 40; guard++) {
    const wf = (await ctx.db.query(`SELECT * FROM provisioning_workflows WHERE id=$1`, [workflowId])).rows[0];
    const compensating = wf.state === 'COMPENSATING';
    const task = (await ctx.db.query(
      `SELECT * FROM provisioning_tasks WHERE workflow_id=$1 AND is_compensation=$2 AND state IN ('PENDING','WAITING','RUNNING') ORDER BY seq LIMIT 1`,
      [workflowId, compensating])).rows[0];
    const meta = systemMeta(wf.correlation_id);
    const now = ctx.clock.now();
    if (!task) {
      const final = compensating ? 'COMPENSATED' : 'COMPLETED';
      await ctx.db.tx(async (q) => {
        await q.query(`UPDATE provisioning_workflows SET state=$2, updated_at=$3 WHERE id=$1`, [workflowId, final, now]);
        await emitEvent(q, ctx, meta, { aggregateType: 'workflow', aggregateId: workflowId, type: `WORKFLOW_${final}` });
      });
      return;
    }
    if (task.not_before && new Date(task.not_before) > now) {
      if (!compensating && wf.state !== 'WAITING') await ctx.db.query(`UPDATE provisioning_workflows SET state='WAITING', updated_at=$2 WHERE id=$1`, [workflowId, now]);
      return;
    }
    await ctx.db.query(
      `UPDATE provisioning_tasks SET state='RUNNING', attempts = attempts + CASE WHEN state='WAITING' THEN 0 ELSE 1 END, started_at=COALESCE(started_at,$2) WHERE id=$1`,
      [task.id, now],
    );
    const fresh = (await ctx.db.query(`SELECT * FROM provisioning_tasks WHERE id=$1`, [task.id])).rows[0];
    let out: Outcome;
    try {
      out = await HANDLERS[task.type](ctx, meta, wf, fresh);
    } catch (e: any) {
      out = e instanceof SimulationError
        ? e.retryable ? { kind: 'RETRY', error: `${e.code}: ${e.message}` } : { kind: 'FAIL', error: `${e.code}: ${e.message}` }
        : { kind: 'FAIL', error: e?.message ?? String(e) };
    }
    const stop = await ctx.db.tx(async (q) => {
      const at = ctx.clock.now();
      const ev = (type: string, payload: unknown) => emitEvent(q, ctx, meta, { aggregateType: 'workflow', aggregateId: workflowId, type, payload });
      switch (out.kind) {
        case 'DONE':
          await q.query(`UPDATE provisioning_tasks SET state='DONE', finished_at=$2, result=$3, error=NULL, not_before=NULL WHERE id=$1`, [task.id, at, JSON.stringify(out.result ?? {})]);
          if (!compensating) await q.query(`UPDATE provisioning_workflows SET state='RUNNING', updated_at=$2 WHERE id=$1`, [workflowId, at]);
          await ev('TASK_DONE', { task: task.type, seq: task.seq });
          return false;
        case 'WAIT':
          await q.query(`UPDATE provisioning_tasks SET state='WAITING', not_before=$2, result=COALESCE($3, result), error=$4 WHERE id=$1`, [
            task.id, out.until, out.result === undefined ? null : JSON.stringify(out.result), out.note ?? null,
          ]);
          if (!compensating) await q.query(`UPDATE provisioning_workflows SET state='WAITING', updated_at=$2 WHERE id=$1`, [workflowId, at]);
          return true;
        case 'RETRY':
          if (fresh.attempts < fresh.max_attempts) {
            const delay = (out.delayMs ?? 2000) * 2 ** (fresh.attempts - 1);
            await q.query(`UPDATE provisioning_tasks SET state='PENDING', error=$2, not_before=$3 WHERE id=$1`, [task.id, out.error, new Date(at.getTime() + delay)]);
            await ev('TASK_RETRY_SCHEDULED', { task: task.type, attempt: fresh.attempts, delayMs: delay, error: out.error });
            return true;
          }
          out = { kind: 'FAIL', error: `${out.error} (after ${fresh.attempts} attempts)` };
          return failTask(q, ctx, meta, wf, task, out, compensating);
        case 'FAIL':
          return failTask(q, ctx, meta, wf, task, out, compensating);
      }
    });
    if (stop) return;
  }
}

async function failTask(q: Queryable, ctx: Ctx, meta: Meta, wf: any, task: any, out: { error: string; outcome?: OrderState }, compensating: boolean) {
  await q.query(`UPDATE provisioning_tasks SET state='FAILED', finished_at=$2, error=$3 WHERE id=$1`, [task.id, ctx.clock.now(), out.error]);
  await emitEvent(q, ctx, meta, { aggregateType: 'workflow', aggregateId: wf.id, type: 'TASK_FAILED', payload: { task: task.type, error: out.error } });
  if (compensating) {
    // Compensation itself failed: stop and surface for manual intervention rather than loop.
    await q.query(`UPDATE provisioning_workflows SET state='FAILED', failure_reason=$2, updated_at=$3 WHERE id=$1`, [wf.id, `Compensation step ${task.type} failed: ${out.error}`, ctx.clock.now()]);
    await audit(q, ctx, meta, { action: 'workflow.compensation_failed', entityType: 'workflow', entityId: wf.id, outcome: 'ERROR', details: { task: task.type, error: out.error } });
    return true;
  }
  await requestCompensation(q, ctx, meta, wf.id, `${task.type} failed: ${out.error}`, out.outcome ?? 'FAILED');
  return false; // continue straight into compensation
}

// ------------------------------------------------------------------ helpers

async function loadOrder(q: Queryable, orderId: string) {
  const order = (await q.query(`SELECT * FROM orders WHERE id=$1`, [orderId])).rows[0];
  const quote = (await q.query(`SELECT * FROM quotes WHERE id=$1`, [order.quote_id])).rows[0];
  return { order, quote, breakdown: quote.breakdown as PriceBreakdown };
}

async function setServiceState(q: Queryable, serviceId: string, to: ServiceState) {
  const s = (await q.query(`SELECT state FROM services WHERE id=$1`, [serviceId])).rows[0];
  if (s.state === to) return;
  if (!canTransitionService(s.state, to)) throw new Error(`Invalid service transition ${s.state} -> ${to}`);
  await q.query(`UPDATE services SET state=$2 WHERE id=$1`, [serviceId, to]);
}

async function moveOrder(q: Queryable, ctx: Ctx, meta: Meta, orderId: string, to: OrderState, reason?: string) {
  const cur = (await q.query(`SELECT state FROM orders WHERE id=$1`, [orderId])).rows[0].state;
  if (cur !== to) await transitionOrder(q, ctx, meta, orderId, to, reason);
}

// ------------------------------------------------------------------ handlers

type Handler = (ctx: Ctx, meta: Meta, wf: any, task: any) => Promise<Outcome>;

const HANDLERS: Record<string, Handler> = {
  async VALIDATE_REQUEST(ctx, _m, wf) {
    const { order, quote } = await loadOrder(ctx.db, wf.order_id);
    if (order.payment_status !== 'PAID_SIMULATED') return { kind: 'FAIL', error: 'Order not paid' };
    if (!quote || quote.state !== 'ACCEPTED') return { kind: 'FAIL', error: 'Quote not accepted' };
    return { kind: 'DONE', result: { quoteId: quote.id } };
  },

  async COMPUTE_ROUTE(ctx, _m, wf) {
    // Re-validate the quoted route against current state (it may have changed since quoting).
    const { quote } = await loadOrder(ctx.db, wf.order_id);
    const topo = await loadGraph(ctx.db);
    const seg = new Map(topo.segments.map((s) => [s.id, s]));
    const nodeUp = new Map(topo.nodes.map((n) => [n.id, n.up]));
    const already = new Set((await ctx.db.query(`SELECT segment_id FROM reservations WHERE order_id=$1 AND status<>'RELEASED'`, [wf.order_id])).rows.map((r) => r.segment_id));
    const problems: string[] = [];
    for (const p of [quote.route.primary, quote.route.protection].filter(Boolean)) {
      for (const id of p.segmentIds) {
        const s = seg.get(id)!;
        if (!s.up) problems.push(`${id} down`);
        else if (!already.has(id) && s.availableMbps < quote.bandwidth_mbps) problems.push(`${id} has ${s.availableMbps} Mbps free`);
      }
      for (const n of p.nodeIds) if (!nodeUp.get(n)) problems.push(`${n} down`);
    }
    if (problems.length) return { kind: 'FAIL', error: `ROUTE_NO_LONGER_FEASIBLE: ${problems.join('; ')} — re-quote required` };
    return { kind: 'DONE', result: { route: quote.route.signature } };
  },

  async RESERVE_CAPACITY(ctx, _m, wf) {
    const existing = (await ctx.db.query(`SELECT count(*)::int n FROM reservations WHERE order_id=$1 AND status <> 'RELEASED'`, [wf.order_id])).rows[0].n;
    if (existing > 0) return { kind: 'DONE', result: { idempotentReplay: true } };
    const { quote } = await loadOrder(ctx.db, wf.order_id);
    const settings = await getSettings(ctx.db);
    try {
      const ids = await ctx.db.tx(async (q) => {
        const now = ctx.clock.now();
        return reserve(q, {
          segments: [
            ...quote.route.primary.segmentIds.map((segmentId: string) => ({ segmentId, role: 'PRIMARY' as const })),
            ...(quote.route.protection?.segmentIds ?? []).map((segmentId: string) => ({ segmentId, role: 'PROTECTION' as const })),
          ],
          mbps: quote.bandwidth_mbps, orderId: wf.order_id, serviceId: wf.service_id, status: 'HELD',
          expiresAt: new Date(now.getTime() + settings.hold_ttl_minutes * 60_000), now,
        });
      });
      return { kind: 'DONE', result: { reservations: ids, status: 'HELD' } };
    } catch (e: any) {
      return { kind: 'FAIL', error: `${e.code ?? 'RESERVE_FAILED'}: ${e.message}` };
    }
  },

  async CREATE_SUBORDERS(ctx, meta, wf) {
    const { order, quote, breakdown } = await loadOrder(ctx.db, wf.order_id);
    const settings = await getSettings(ctx.db);
    const now = ctx.clock.now();
    await ctx.db.tx(async (q) => {
      for (const p of breakdown.providers) {
        await q.query(
          `INSERT INTO provider_suborders (id, order_id, provider_id, state, segment_ids, wholesale_monthly, setup_fee, deadline_at, created_at)
           VALUES ($1,$2,$3,'PENDING',$4,$5,$6,$7,$8) ON CONFLICT (order_id, provider_id) DO NOTHING`,
          [newId('sub'), order.id, p.providerId, JSON.stringify(p.segmentIds), p.wholesaleMonthly, p.setupFee,
            new Date(now.getTime() + settings.provider_acceptance_timeout_minutes * 60_000), now],
        );
      }
      await moveOrder(q, ctx, meta, order.id, 'PROVIDER_ACCEPTANCE', `${breakdown.providers.length} provider sub-order(s) issued`);
    });
    // Send each sub-order through the (mock) Sonata seller interface.
    const subs = (await ctx.db.query(`SELECT * FROM provider_suborders WHERE order_id=$1 ORDER BY provider_id`, [order.id])).rows;
    const svc = (await ctx.db.query(`SELECT * FROM services WHERE id=$1`, [wf.service_id])).rows[0];
    for (const sub of subs) {
      const sent = (await ctx.db.query(`SELECT 1 FROM sonata_messages WHERE order_id=$1 AND provider_id=$2 AND response->>'status'='201'`, [order.id, sub.provider_id])).rows.length;
      if (sent) continue;
      const canonical: CanonicalProviderOrder = {
        platformOrderId: order.id, subOrderId: sub.id, providerId: sub.provider_id, buyerId: order.customer_id,
        items: [{
          itemId: '1', action: 'add', productCode: (await ctx.db.query(`SELECT code FROM products WHERE id=$1`, [quote.product_id])).rows[0].code,
          bandwidthMbps: order.bandwidth_mbps, segmentIds: sub.segment_ids,
          aEnd: { locationId: svc.a_location_id, nodeId: quote.route.primary.nodeIds[0] },
          bEnd: { locationId: svc.b_location_id, nodeId: quote.route.primary.nodeIds.at(-1) },
          termMonths: quote.term_months, quote: { quoteId: quote.id, quoteItemId: '1' },
        }],
      };
      try {
        await ctx.db.tx((q) => seller.createProductOrder(q, sub.provider_id, toSonataCreate(canonical), order.id, ctx.clock.now()));
      } catch (e) {
        if (e instanceof SonataTimeoutError) return { kind: 'RETRY', error: e.message, delayMs: 2000 };
        throw e;
      }
    }
    return { kind: 'DONE', result: { subOrders: subs.map((s) => s.id), channel: 'SONATA MOCK' } };
  },

  async AWAIT_PROVIDER_ACCEPTANCE(ctx, _m, wf) {
    const now = ctx.clock.now();
    const subs = (await ctx.db.query(`SELECT ps.*, p.auto_accept, p.acceptance_delay_s FROM provider_suborders ps JOIN providers p ON p.id=ps.provider_id WHERE order_id=$1`, [wf.order_id])).rows;
    const autoMeta: Meta = { actor: null, correlationId: wf.correlation_id };
    let nextWake = new Date(now.getTime() + 1000);
    for (const s of subs.filter((x) => x.state === 'PENDING' && x.auto_accept)) {
      const due = new Date(new Date(s.created_at).getTime() + s.acceptance_delay_s * 1000);
      if (await providerFaultActive(ctx.db, 'PROVIDER_API_TIMEOUT', [s.provider_id])) continue; // unreachable: no response
      if (due <= now) {
        await ctx.db.tx(async (q) => {
          await q.query(`UPDATE provider_suborders SET state='ACCEPTED', responded_at=$2, responded_by='system:auto-accept', response_note='Auto-accepted by DEMO provider policy' WHERE id=$1 AND state='PENDING'`, [s.id, now]);
          await emitEvent(q, ctx, autoMeta, { aggregateType: 'order', aggregateId: wf.order_id, type: 'SUBORDER_ACCEPTED', payload: { subOrderId: s.id, providerId: s.provider_id, by: 'auto-accept' } });
        });
        s.state = 'ACCEPTED';
      } else if (due < nextWake) nextWake = due;
    }
    const rejected = subs.find((s) => s.state === 'REJECTED');
    if (rejected) return { kind: 'FAIL', error: `Provider ${rejected.provider_id} rejected: ${rejected.response_note ?? 'no reason given'}`, outcome: 'REJECTED' };
    const late = subs.filter((s) => s.state !== 'ACCEPTED' && new Date(s.deadline_at) <= now);
    if (late.length) {
      await ctx.db.query(`UPDATE provider_suborders SET state='TIMED_OUT' WHERE id = ANY($1)`, [late.map((s) => s.id)]);
      return { kind: 'FAIL', error: `PROVIDER_ACCEPTANCE_TIMEOUT: no response from ${late.map((s) => s.provider_id).join(', ')} before deadline` };
    }
    if (subs.every((s) => s.state === 'ACCEPTED')) return { kind: 'DONE', result: { accepted: subs.length } };
    const pending = subs.filter((s) => s.state !== 'ACCEPTED');
    const deadline = new Date(Math.min(...pending.map((s) => new Date(s.deadline_at).getTime())));
    return { kind: 'WAIT', until: deadline < nextWake ? deadline : nextWake, note: `Waiting for ${pending.map((s) => `${s.provider_id} (${s.state})`).join(', ')}` };
  },

  async COMMIT_RESERVATION(ctx, meta, wf) {
    return ctx.db.tx(async (q) => {
      const n = await commitHolds(q, wf.order_id);
      const committed = (await q.query(`SELECT count(*)::int n FROM reservations WHERE order_id=$1 AND status='COMMITTED'`, [wf.order_id])).rows[0].n;
      if (n === 0 && committed === 0) return { kind: 'FAIL', error: 'HOLD_LOST: capacity hold expired before commit' } as Outcome;
      await moveOrder(q, ctx, meta, wf.order_id, 'RESOURCE_RESERVED');
      await setServiceState(q, wf.service_id, 'RESERVED');
      return { kind: 'DONE', result: { committed } } as Outcome;
    });
  },

  async PROVISION_VIRTUAL(ctx, meta, wf, task) {
    if (task.result?.readyAt) {
      return new Date(task.result.readyAt) <= ctx.clock.now() ? { kind: 'DONE', result: task.result } : { kind: 'WAIT', until: new Date(task.result.readyAt) };
    }
    const { quote, breakdown } = await loadOrder(ctx.db, wf.order_id);
    const providerIds = breakdown.providers.map((p) => p.providerId);
    if (await providerFaultActive(ctx.db, 'PROVIDER_API_TIMEOUT', providerIds)) return { kind: 'RETRY', error: 'PROVIDER_API_TIMEOUT during provisioning (simulated)' };
    await ctx.db.tx(async (q) => {
      await moveOrder(q, ctx, meta, wf.order_id, 'PROVISIONING');
      await setServiceState(q, wf.service_id, 'PROVISIONING');
    });
    const r = await ctx.sim.createVirtualService({
      serviceId: wf.service_id, bandwidthMbps: quote.bandwidth_mbps,
      primarySegmentIds: quote.route.primary.segmentIds, protectionSegmentIds: quote.route.protection?.segmentIds ?? null, providerIds,
      nodeIds: [...new Set<string>([...quote.route.primary.nodeIds, ...(quote.route.protection?.nodeIds ?? [])])],
    });
    await ctx.db.query(`UPDATE services SET sim_handle=$2 WHERE id=$1`, [wf.service_id, r.handle]);
    const result = {
      handle: r.handle, readyAt: r.readyAt.toISOString(), adapter: (await ctx.sim.status()).mode,
      nodePlan: r.nodePlan.map((n) => ({ nodeId: n.nodeId, readyAt: n.readyAt.toISOString() })),
    };
    return r.readyAt <= ctx.clock.now() ? { kind: 'DONE', result } : { kind: 'WAIT', until: r.readyAt, result, note: 'Simulated provisioning delay' };
  },

  async CONFIGURE_SERVICE(ctx, _m, wf) {
    const svc = (await ctx.db.query(`SELECT sim_handle FROM services WHERE id=$1`, [wf.service_id])).rows[0];
    await ctx.sim.activateService(svc.sim_handle);
    // Customer handoff (UNI port), S-VLAN, CE test subnet and per-device config.
    const net = await ctx.db.tx(async (q) => {
      const r = await allocateServiceConfig(q, wf.service_id, ctx.clock.now());
      await setServiceState(q, wf.service_id, 'CONFIGURED');
      return r;
    });
    return { kind: 'DONE', result: { handle: svc.sim_handle, network: net } };
  },

  async RUN_ACTIVATION_TESTS(ctx, meta, wf) {
    await ctx.db.tx(async (q) => {
      await moveOrder(q, ctx, meta, wf.order_id, 'TESTING');
      await setServiceState(q, wf.service_id, 'TESTING');
    });
    const svc = (await ctx.db.query(`SELECT sim_handle FROM services WHERE id=$1`, [wf.service_id])).rows[0];
    const results = await ctx.sim.runConnectivityTest(svc.sim_handle);
    const runId = newId('run');
    await ctx.db.tx(async (q) => {
      for (const r of results) {
        await q.query(
          `INSERT INTO service_tests (id, service_id, run_id, test_name, status, simulated, input, threshold, result, reason, executed_at) VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10)`,
          [newId('tst'), wf.service_id, runId, r.testName, r.status, JSON.stringify(r.input), r.threshold ? JSON.stringify(r.threshold) : null, r.result ? JSON.stringify(r.result) : null, r.reason, ctx.clock.now()],
        );
      }
    });
    const failed = results.filter((r) => r.status === 'FAIL');
    if (failed.length) return { kind: 'FAIL', error: `ACTIVATION_TESTS_FAILED: ${failed.map((f) => `${f.testName} (${f.reason})`).join('; ')}` };
    return { kind: 'DONE', result: { runId, pass: results.filter((r) => r.status === 'PASS').length, notRun: results.filter((r) => r.status === 'NOT_RUN').length } };
  },

  async ACTIVATE_SERVICE(ctx, meta, wf) {
    const { order, breakdown } = await loadOrder(ctx.db, wf.order_id);
    const sim = await getSimState(ctx.db);
    await ctx.db.tx(async (q) => {
      const now = ctx.clock.now();
      await setServiceState(q, wf.service_id, 'ACTIVE');
      await q.query(`UPDATE services SET oper_status='UP', active_path='PRIMARY', activated_at=$2, activated_sim_tick=$3 WHERE id=$1`, [wf.service_id, now, sim.tick]);
      await q.query(`UPDATE service_paths SET status = CASE WHEN role='PRIMARY' THEN 'ACTIVE' ELSE 'STANDBY' END WHERE service_id=$1 AND status='PLANNED'`, [wf.service_id]);
      await moveOrder(q, ctx, meta, order.id, 'ACTIVE', 'Activation tests passed');
      const period = now.toISOString().slice(0, 7);
      for (const l of ledgerLines(breakdown, order.customer_id)) {
        await q.query(
          `INSERT INTO settlement_ledger (id, order_id, period, entry_type, party_type, party_id, amount, currency, status, basis, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9,$10)`,
          [newId('led'), order.id, l.entryType === 'SETUP_CHARGE' ? 'ONE_TIME' : period, l.entryType, l.partyType, l.partyId, l.amount, order.currency,
            JSON.stringify({ fee: breakdown.fee, taxRate: breakdown.taxRate, note: 'SIMULATED ledger; fee basis is DEMO configuration' }), now],
        );
      }
      await emitEvent(q, ctx, meta, { aggregateType: 'service', aggregateId: wf.service_id, type: 'SERVICE_ACTIVATED', payload: { orderId: order.id }, simTick: sim.tick });
    });
    return { kind: 'DONE', result: { activatedAtTick: sim.tick } };
  },

  async START_MONITORING(ctx, meta, wf) {
    await ctx.db.tx(async (q) => {
      await q.query(`UPDATE services SET monitoring=true WHERE id=$1`, [wf.service_id]);
      await emitEvent(q, ctx, meta, { aggregateType: 'service', aggregateId: wf.service_id, type: 'MONITORING_STARTED' });
    });
    return { kind: 'DONE' };
  },

  // ----------------------------- compensation (idempotent) -----------------------------

  async DEPROVISION_VIRTUAL(ctx, _m, wf) {
    const svc = (await ctx.db.query(`SELECT sim_handle FROM services WHERE id=$1`, [wf.service_id])).rows[0];
    if (svc?.sim_handle) await ctx.sim.deactivateService(svc.sim_handle);
    const removed = await ctx.db.tx((q) => releaseServiceConfig(q, wf.service_id, ctx.clock.now()));
    return { kind: 'DONE', result: { handle: svc?.sim_handle ?? null, configsRemoved: removed } };
  },

  async RELEASE_CAPACITY(ctx, _m, wf) {
    const n = await ctx.db.tx((q) => release(q, { orderId: wf.order_id }, `compensation: ${wf.failure_reason ?? 'rollback'}`, ctx.clock.now()));
    return { kind: 'DONE', result: { released: n } };
  },

  async CANCEL_SUBORDERS(ctx, meta, wf) {
    await ctx.db.tx(async (q) => {
      const r = await q.query(`UPDATE provider_suborders SET state='CANCELLED' WHERE order_id=$1 AND state IN ('PENDING','ACCEPTED','CLARIFICATION_REQUESTED') RETURNING id, provider_id`, [wf.order_id]);
      for (const s of r.rows) await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: wf.order_id, type: 'SUBORDER_CANCELLED', payload: { subOrderId: s.id, providerId: s.provider_id } });
    });
    return { kind: 'DONE' };
  },

  async REFUND_PAYMENT_SIMULATED(ctx, meta, wf) {
    await ctx.db.tx(async (q) => {
      const r = await q.query(`UPDATE orders SET payment_status='REFUNDED_SIMULATED' WHERE id=$1 AND payment_status='PAID_SIMULATED' RETURNING id`, [wf.order_id]);
      if (r.rows.length) await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: wf.order_id, type: 'PAYMENT_REFUNDED_SIMULATED' });
    });
    return { kind: 'DONE' };
  },

  async FINALIZE_ORDER(ctx, meta, wf) {
    await ctx.db.tx(async (q) => {
      const outcome = (wf.outcome ?? 'FAILED') as OrderState;
      await moveOrder(q, ctx, meta, wf.order_id, outcome, wf.failure_reason ?? undefined);
      const s = (await q.query(`SELECT state FROM services WHERE id=$1`, [wf.service_id])).rows[0];
      if (s && s.state !== 'DECOMMISSIONED') {
        await q.query(`UPDATE services SET state=$2, oper_status='UNKNOWN', monitoring=false WHERE id=$1`, [wf.service_id, s.state === 'DESIGNED' || s.state === 'RESERVED' ? 'DECOMMISSIONED' : 'FAILED']);
      }
      await q.query(`UPDATE service_paths SET status='RELEASED' WHERE service_id=$1`, [wf.service_id]);
      await q.query(`UPDATE settlement_ledger SET status='VOID' WHERE order_id=$1 AND status='PENDING'`, [wf.order_id]);
    });
    return { kind: 'DONE' };
  },
};
