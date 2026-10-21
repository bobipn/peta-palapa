import type { Queryable } from '../db/db.js';
import { canTransitionOrder, ORDER_CANCELLABLE, ORDER_STATE_LABEL, type OrderState } from '../domain/state-machines.js';
import { scopeFor, type Principal } from '../domain/rbac.js';
import { conflict, forbidden, newId, notFound } from '../lib/util.js';
import { audit, emitEvent, getSettings, type Ctx, type Meta } from './context.js';
import { release, expireHolds } from './capacity.js';
import { sonataStateOf } from './sonata/sonata.js';
import { createActivationWorkflow, requestCompensation, withOrchestratorLock } from './orchestrator.js';

export async function transitionOrder(q: Queryable, ctx: Ctx, meta: Meta, orderId: string, to: OrderState, reason?: string) {
  const o = (await q.query(`SELECT id, state, version FROM orders WHERE id=$1 FOR UPDATE`, [orderId])).rows[0];
  if (!o) throw notFound('Order');
  if (o.state === to) return;
  if (!canTransitionOrder(o.state, to)) throw conflict('INVALID_ORDER_TRANSITION', `Order cannot go from ${o.state} to ${to}`);
  const r = await q.query(`UPDATE orders SET state=$2, state_reason=$3, updated_at=$4, version=version+1 WHERE id=$1 AND version=$5`, [
    orderId, to, reason ?? null, ctx.clock.now(), o.version,
  ]);
  if (r.rowCount === 0) throw conflict('CONCURRENT_MODIFICATION', 'Order was modified concurrently');
  await emitEvent(q, ctx, meta, {
    aggregateType: 'order', aggregateId: orderId, type: 'ORDER_STATE_CHANGED',
    payload: { from: o.state, to, reason: reason ?? null, sonataState: sonataStateOf(to).state },
  });
}

export async function acceptQuote(ctx: Ctx, meta: Meta, quoteId: string) {
  const actor = meta.actor!;
  return ctx.db.tx(async (q) => {
    const quote = (await q.query(`SELECT * FROM quotes WHERE id=$1 FOR UPDATE`, [quoteId])).rows[0];
    if (!quote || quote.customer_id !== actor.customerId) throw notFound('Quote');
    const now = ctx.clock.now();
    if (quote.state !== 'QUOTED') throw conflict('QUOTE_NOT_OPEN', `Quote is ${quote.state}`);
    if (new Date(quote.valid_until) < now) {
      await q.query(`UPDATE quotes SET state='EXPIRED' WHERE id=$1`, [quoteId]);
      throw conflict('QUOTE_EXPIRED', 'Quote validity has passed; request a new quote');
    }
    const settings = await getSettings(q);
    const id = newId('ord');
    await q.query(
      `INSERT INTO orders (id, customer_id, quote_id, state, payment_status, deadline_at, bandwidth_mbps, protection, price_monthly, setup_fee, currency, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'PENDING_PAYMENT','UNPAID',$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      [id, quote.customer_id, quoteId, new Date(now.getTime() + settings.payment_timeout_minutes * 60_000), quote.bandwidth_mbps, quote.protection,
        quote.price_monthly, quote.setup_fee, quote.currency, actor.userId, now],
    );
    await q.query(`UPDATE quotes SET state='ACCEPTED' WHERE id=$1`, [quoteId]);
    await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: id, type: 'ORDER_CREATED', payload: { quoteId, state: 'PENDING_PAYMENT' } });
    await audit(q, ctx, meta, { action: 'order.create', entityType: 'order', entityId: id, details: { quoteId } });
    return id;
  });
}

/** Simulated checkout. No payment gateway, no money moves. */
export async function payOrder(ctx: Ctx, meta: Meta, orderId: string) {
  const actor = meta.actor!;
  return ctx.db.tx(async (q) => {
    const o = (await q.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [orderId])).rows[0];
    if (!o || o.customer_id !== actor.customerId) throw notFound('Order');
    if (o.state !== 'PENDING_PAYMENT') throw conflict('ORDER_NOT_PAYABLE', `Order is ${o.state}`);
    if (o.deadline_at && new Date(o.deadline_at) < ctx.clock.now()) {
      await transitionOrder(q, ctx, meta, orderId, 'CANCELLED', 'Payment window expired');
      throw conflict('PAYMENT_WINDOW_EXPIRED', 'Payment window expired; order cancelled');
    }
    const ref = newId('simpay');
    await q.query(`UPDATE orders SET payment_status='PAID_SIMULATED', payment_ref=$2, deadline_at=NULL WHERE id=$1`, [orderId, ref]);
    await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: orderId, type: 'PAYMENT_SIMULATED', payload: { ref, amount: o.price_monthly + o.setup_fee, currency: o.currency } });
    await transitionOrder(q, ctx, meta, orderId, 'CONFIRMED', 'Simulated payment received');
    const quote = (await q.query(`SELECT * FROM quotes WHERE id=$1`, [o.quote_id])).rows[0];
    const serviceId = await createServiceRecord(q, ctx, o, quote);
    await createActivationWorkflow(q, ctx, meta, orderId, serviceId);
    await audit(q, ctx, meta, { action: 'order.pay', entityType: 'order', entityId: orderId, details: { ref, simulated: true } });
    return { paymentRef: ref, serviceId };
  });
}

async function createServiceRecord(q: Queryable, ctx: Ctx, o: any, quote: any) {
  const id = newId('svc');
  const now = ctx.clock.now();
  const a = (await q.query(`SELECT city FROM locations WHERE id=$1`, [quote.a_location_id])).rows[0].city;
  const b = (await q.query(`SELECT city FROM locations WHERE id=$1`, [quote.b_location_id])).rows[0].city;
  const name = `${a} ⇄ ${b} ${o.bandwidth_mbps >= 1000 ? `${o.bandwidth_mbps / 1000} Gbps` : `${o.bandwidth_mbps} Mbps`}${quote.protection === 'PROTECTED' ? ' (1+1)' : ''}`;
  await q.query(
    `INSERT INTO services (id, order_id, customer_id, name, state, oper_status, bandwidth_mbps, sla_profile_id, protection, a_location_id, b_location_id, created_at)
     VALUES ($1,$2,$3,$4,'DESIGNED','UNKNOWN',$5,$6,$7,$8,$9,$10)`,
    [id, o.id, o.customer_id, name, o.bandwidth_mbps, quote.sla_profile_id, quote.protection, quote.a_location_id, quote.b_location_id, now],
  );
  const route = quote.route;
  for (const [role, p] of [['PRIMARY', route.primary], ['PROTECTION', route.protection]] as const) {
    if (!p) continue;
    await q.query(
      `INSERT INTO service_paths (id, service_id, role, segment_ids, node_ids, latency_ms, length_km, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'PLANNED',$8)`,
      [newId('sp'), id, role, JSON.stringify(p.segmentIds), JSON.stringify(p.nodeIds), p.latencyMs, p.lengthKm, now],
    );
  }
  return id;
}

export async function cancelOrder(ctx: Ctx, meta: Meta, orderId: string, reason = 'Cancelled by customer') {
  return withOrchestratorLock(async () => {
    const actor = meta.actor!;
    const o = (await ctx.db.query(`SELECT * FROM orders WHERE id=$1`, [orderId])).rows[0];
    if (!o || (actor.role === 'CUSTOMER' && o.customer_id !== actor.customerId)) throw notFound('Order');
    if (!ORDER_CANCELLABLE.includes(o.state)) {
      throw conflict('ORDER_NOT_CANCELLABLE', `Order in ${o.state} can no longer be cancelled${o.state === 'ACTIVE' ? '; terminate the service instead' : ''}`);
    }
    await ctx.db.tx(async (q) => {
      if (o.state === 'PENDING_PAYMENT') {
        await transitionOrder(q, ctx, meta, orderId, 'CANCELLED', reason);
      } else {
        const wf = (await q.query(`SELECT * FROM provisioning_workflows WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`, [orderId])).rows[0];
        await requestCompensation(q, ctx, meta, wf.id, reason, 'CANCELLED');
      }
      await audit(q, ctx, meta, { action: 'order.cancel', entityType: 'order', entityId: orderId, details: { reason } });
    });
    return { state: o.state === 'PENDING_PAYMENT' ? 'CANCELLED' : 'CANCELLING' };
  });
}

/** Customer disconnects an active service: release capacity, decommission. */
export async function terminateService(ctx: Ctx, meta: Meta, serviceId: string) {
  const actor = meta.actor!;
  const svc = (await ctx.db.query(`SELECT * FROM services WHERE id=$1`, [serviceId])).rows[0];
  if (!svc || (actor.role === 'CUSTOMER' && svc.customer_id !== actor.customerId)) throw notFound('Service');
  if (svc.state !== 'ACTIVE') throw conflict('SERVICE_NOT_ACTIVE', `Service is ${svc.state}`);
  if (svc.sim_handle) await ctx.sim.deactivateService(svc.sim_handle);
  await ctx.db.tx(async (q) => {
    const now = ctx.clock.now();
    await release(q, { serviceId }, 'service terminated', now);
    await release(q, { orderId: svc.order_id }, 'service terminated', now);
    await q.query(`UPDATE service_paths SET status='RELEASED' WHERE service_id=$1`, [serviceId]);
    await q.query(`UPDATE services SET state='DECOMMISSIONED', oper_status='UNKNOWN', monitoring=false WHERE id=$1`, [serviceId]);
    await q.query(`UPDATE alarms SET state='CLEARED' WHERE entity_type='SERVICE' AND entity_id=$1 AND state='ACTIVE'`, [serviceId]);
    await q.query(`UPDATE sla_breaches SET ended_tick=(SELECT tick FROM simulation_state WHERE id=1) WHERE service_id=$1 AND ended_tick IS NULL`, [serviceId]);
    await transitionOrder(q, ctx, meta, svc.order_id, 'DISCONNECTED', 'Service terminated by customer');
    await emitEvent(q, ctx, meta, { aggregateType: 'service', aggregateId: serviceId, type: 'SERVICE_DECOMMISSIONED' });
    await audit(q, ctx, meta, { action: 'service.terminate', entityType: 'service', entityId: serviceId });
  });
}

function orderScopeSql(who: Principal, alias = 'o') {
  const s = scopeFor(who);
  if (s.customerId) return { sql: `${alias}.customer_id = $1`, params: [s.customerId] };
  if (s.providerId) return { sql: `EXISTS (SELECT 1 FROM provider_suborders ps WHERE ps.order_id=${alias}.id AND ps.provider_id=$1)`, params: [s.providerId] };
  return { sql: 'TRUE', params: [] as unknown[] };
}

export async function listOrders(q: Queryable, who: Principal) {
  const sc = orderScopeSql(who);
  const rows = (await q.query(
    `SELECT o.*, qt.a_location_id, qt.b_location_id, qt.sla_profile_id, c.name AS customer_name,
            (SELECT id FROM services s WHERE s.order_id=o.id) AS service_id
     FROM orders o JOIN quotes qt ON qt.id=o.quote_id JOIN customers c ON c.id=o.customer_id
     WHERE ${sc.sql} ORDER BY o.created_at DESC LIMIT 300`, sc.params)).rows;
  return rows.map((r) => ({ ...r, state_label: ORDER_STATE_LABEL[r.state as OrderState], sonata: sonataStateOf(r.state) }));
}

export async function getOrderDetail(q: Queryable, who: Principal, id: string) {
  const sc = orderScopeSql(who);
  const o = (await q.query(
    `SELECT o.*, c.name AS customer_name FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$${sc.params.length + 1} AND ${sc.sql}`,
    [...sc.params, id])).rows[0];
  if (!o) throw notFound('Order');
  const quote = (await q.query(`SELECT * FROM quotes WHERE id=$1`, [o.quote_id])).rows[0];
  const isProvider = who.role === 'PROVIDER';
  const subs = (await q.query(`SELECT ps.*, p.name AS provider_name FROM provider_suborders ps JOIN providers p ON p.id=ps.provider_id WHERE order_id=$1 ORDER BY p.code`, [id])).rows
    .filter((s) => !isProvider || s.provider_id === who.providerId);
  const events = (await q.query(`SELECT * FROM order_events WHERE order_id=$1 ORDER BY id`, [id])).rows;
  const service = (await q.query(`SELECT * FROM services WHERE order_id=$1`, [id])).rows[0] ?? null;
  const wf = (await q.query(`SELECT * FROM provisioning_workflows WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`, [id])).rows[0] ?? null;
  const tasks = wf && !['CUSTOMER', 'PROVIDER'].includes(who.role) ? (await q.query(`SELECT * FROM provisioning_tasks WHERE workflow_id=$1 ORDER BY seq`, [wf.id])).rows : [];
  return {
    order: { ...o, state_label: ORDER_STATE_LABEL[o.state as OrderState], sonata: sonataStateOf(o.state) },
    quote: isProvider ? { id: quote.id, bandwidth_mbps: quote.bandwidth_mbps, route: quote.route } : quote,
    subOrders: subs,
    events,
    service,
    workflow: wf ? { ...wf, tasks } : null,
  };
}

/** Periodic sweeper: payment timeouts, expired quotes, orphaned holds. Nothing is left stuck silently. */
export async function sweepTimeouts(ctx: Ctx, meta: Meta) {
  const now = ctx.clock.now();
  return ctx.db.tx(async (q) => {
    const expiredOrders = (await q.query(`SELECT id FROM orders WHERE state='PENDING_PAYMENT' AND deadline_at < $1`, [now])).rows;
    for (const o of expiredOrders) await transitionOrder(q, ctx, meta, o.id, 'CANCELLED', 'Payment window expired (timeout)');
    const quotes = await q.query(`UPDATE quotes SET state='EXPIRED' WHERE state='QUOTED' AND valid_until < $1 RETURNING id`, [now]);
    const holds = await expireHolds(q, now);
    return { cancelledOrders: expiredOrders.length, expiredQuotes: quotes.rows.length, releasedHolds: holds };
  });
}

export function assertCustomer(who: Principal) {
  if (who.role !== 'CUSTOMER' || !who.customerId) throw forbidden('Customer role required');
}
