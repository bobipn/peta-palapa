import type { Queryable } from '../db/db.js';
import type { Principal } from '../domain/rbac.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/util.js';
import { audit, emitEvent, type Ctx, type Meta } from './context.js';

function providerOf(who: Principal) {
  if (who.role !== 'PROVIDER' || !who.providerId) throw forbidden('Provider role required');
  return who.providerId;
}

export async function listSuborders(q: Queryable, who: Principal) {
  const pid = who.role === 'PROVIDER' ? who.providerId : null;
  return (await q.query(
    `SELECT ps.*, p.name AS provider_name, o.state AS order_state, o.bandwidth_mbps, qt.a_location_id, qt.b_location_id, c.name AS customer_name
     FROM provider_suborders ps JOIN providers p ON p.id=ps.provider_id JOIN orders o ON o.id=ps.order_id
     JOIN quotes qt ON qt.id=o.quote_id JOIN customers c ON c.id=o.customer_id
     WHERE ($1::text IS NULL OR ps.provider_id=$1) ORDER BY ps.created_at DESC LIMIT 300`, [pid])).rows;
}

export async function respondSuborder(ctx: Ctx, meta: Meta, subId: string, decision: 'ACCEPT' | 'REJECT' | 'CLARIFY', note?: string) {
  const pid = providerOf(meta.actor!);
  return ctx.db.tx(async (q) => {
    const s = (await q.query(`SELECT * FROM provider_suborders WHERE id=$1 FOR UPDATE`, [subId])).rows[0];
    if (!s || s.provider_id !== pid) {
      await audit(q, ctx, meta, { action: 'suborder.respond', entityType: 'suborder', entityId: subId, outcome: 'DENIED' });
      throw notFound('Sub-order');
    }
    if (!['PENDING', 'CLARIFICATION_REQUESTED'].includes(s.state)) throw conflict('SUBORDER_CLOSED', `Sub-order is ${s.state}`);
    const now = ctx.clock.now();
    if (new Date(s.deadline_at) < now) throw conflict('SUBORDER_DEADLINE_PASSED', 'Response deadline has passed');
    if (decision === 'REJECT' && !note) throw badRequest('REASON_REQUIRED', 'A rejection reason is required');
    const state = decision === 'ACCEPT' ? 'ACCEPTED' : decision === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED';
    await q.query(`UPDATE provider_suborders SET state=$2, response_note=$3, responded_at=$4, responded_by=$5 WHERE id=$1`, [subId, state, note ?? null, now, meta.actor!.userId]);
    await emitEvent(q, ctx, meta, { aggregateType: 'order', aggregateId: s.order_id, type: `SUBORDER_${state}`, payload: { subOrderId: subId, providerId: pid, note: note ?? null } });
    await audit(q, ctx, meta, { action: 'suborder.respond', entityType: 'suborder', entityId: subId, details: { decision, note } });
    return { id: subId, state };
  });
}

export async function providerAssets(q: Queryable, who: Principal) {
  const pid = providerOf(who);
  const provider = (await q.query(`SELECT * FROM providers WHERE id=$1`, [pid])).rows[0];
  const segments = (await q.query(
    `SELECT s.*, c.capacity_mbps, c.reserved_mbps, cs.name AS cable_system_name,
       (SELECT count(DISTINCT sp.service_id)::int FROM service_paths sp WHERE sp.segment_ids ? s.id AND sp.status IN ('ACTIVE','STANDBY')) AS services
     FROM cable_segments s JOIN capacity_resources c ON c.segment_id=s.id JOIN cable_systems cs ON cs.id=s.cable_system_id
     WHERE s.provider_id=$1 ORDER BY s.id`, [pid])).rows;
  const services = (await q.query(
    `SELECT DISTINCT sv.id, sv.name, sv.state, sv.oper_status, sv.active_path, sv.bandwidth_mbps, sp.role
     FROM services sv JOIN service_paths sp ON sp.service_id=sv.id
     WHERE sp.status IN ('ACTIVE','STANDBY') AND EXISTS (SELECT 1 FROM cable_segments cs WHERE cs.provider_id=$1 AND sp.segment_ids ? cs.id)
     ORDER BY sv.id`, [pid])).rows;
  return { provider, segments, services };
}

export async function updateOwnSegment(ctx: Ctx, meta: Meta, segId: string, patch: { pricePerGbpsMonth?: number; adminStatus?: 'UP' | 'DOWN' }) {
  const pid = providerOf(meta.actor!);
  return ctx.db.tx(async (q) => {
    const s = (await q.query(`SELECT * FROM cable_segments WHERE id=$1 FOR UPDATE`, [segId])).rows[0];
    if (!s || s.provider_id !== pid) {
      await audit(q, ctx, meta, { action: 'provider.segment.update', entityType: 'segment', entityId: segId, outcome: 'DENIED', details: patch });
      throw forbidden('You can only modify segments owned by your organisation');
    }
    if (patch.pricePerGbpsMonth !== undefined) {
      if (!Number.isInteger(patch.pricePerGbpsMonth) || patch.pricePerGbpsMonth < 0) throw badRequest('INVALID_PRICE', 'Price must be a non-negative integer (IDR)');
      await q.query(`UPDATE cable_segments SET price_per_gbps_month=$2 WHERE id=$1`, [segId, patch.pricePerGbpsMonth]);
    }
    if (patch.adminStatus) {
      if (patch.adminStatus === 'DOWN') {
        const used = (await q.query(`SELECT count(*)::int n FROM reservations WHERE segment_id=$1 AND status <> 'RELEASED' AND role <> 'FAULT'`, [segId])).rows[0].n;
        if (used > 0) throw conflict('SEGMENT_IN_USE', 'Segment carries reservations; use a scheduled maintenance scenario instead of admin-down');
      }
      await q.query(`UPDATE cable_segments SET admin_status=$2 WHERE id=$1`, [segId, patch.adminStatus]);
    }
    await audit(q, ctx, meta, { action: 'provider.segment.update', entityType: 'segment', entityId: segId, details: patch });
    return (await q.query(`SELECT * FROM cable_segments WHERE id=$1`, [segId])).rows[0];
  });
}

export async function updateProviderSettings(ctx: Ctx, meta: Meta, patch: { autoAccept?: boolean }) {
  const pid = providerOf(meta.actor!);
  return ctx.db.tx(async (q) => {
    if (patch.autoAccept !== undefined) await q.query(`UPDATE providers SET auto_accept=$2 WHERE id=$1`, [pid, patch.autoAccept]);
    await audit(q, ctx, meta, { action: 'provider.settings.update', entityType: 'provider', entityId: pid, details: patch });
    return (await q.query(`SELECT * FROM providers WHERE id=$1`, [pid])).rows[0];
  });
}
