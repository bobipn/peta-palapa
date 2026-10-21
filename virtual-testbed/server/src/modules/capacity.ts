import type { Queryable } from '../db/db.js';
import { conflict, newId } from '../lib/util.js';

export interface ReservationRequest {
  segmentId: string;
  role: 'PRIMARY' | 'PROTECTION' | 'REROUTE' | 'FAULT';
}

/**
 * Atomically reserve `mbps` on every listed segment, or nothing.
 *
 * Concurrency: each segment is incremented with a conditional UPDATE
 * (`reserved + x <= capacity`). In PostgreSQL the UPDATE takes a row lock and
 * re-evaluates the predicate after any concurrent writer commits, so two
 * transactions can never jointly exceed capacity. Segments are locked in a
 * fixed (sorted) order to avoid deadlocks. The CHECK constraint
 * `capacity_not_overbooked` is a second line of defence. Must be called inside
 * a transaction: if any segment fails, the caller's transaction rolls back.
 */
export async function reserve(
  q: Queryable,
  opts: { segments: ReservationRequest[]; mbps: number; orderId?: string | null; serviceId?: string | null; faultId?: string | null; status: 'HELD' | 'COMMITTED'; expiresAt?: Date | null; now: Date },
): Promise<string[]> {
  const sorted = [...opts.segments].sort((a, b) => a.segmentId.localeCompare(b.segmentId));
  const ids: string[] = [];
  for (const s of sorted) {
    const r = await q.query<{ id: string }>(
      `UPDATE capacity_resources SET reserved_mbps = reserved_mbps + $1
       WHERE segment_id = $2 AND reserved_mbps + $1 <= capacity_mbps RETURNING id`,
      [opts.mbps, s.segmentId],
    );
    if (r.rows.length === 0) {
      throw conflict('INSUFFICIENT_CAPACITY', `Segment ${s.segmentId} does not have ${opts.mbps} Mbps free`, { segmentId: s.segmentId });
    }
    const id = newId('rsv');
    await q.query(
      `INSERT INTO reservations (id, capacity_resource_id, segment_id, order_id, service_id, fault_id, mbps, role, status, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, r.rows[0].id, s.segmentId, opts.orderId ?? null, opts.serviceId ?? null, opts.faultId ?? null, opts.mbps, s.role, opts.status, opts.expiresAt ?? null, opts.now],
    );
    ids.push(id);
  }
  return ids;
}

/** HELD -> COMMITTED for an order. Returns number committed; 0 means the hold was lost (expired/released). */
export async function commitHolds(q: Queryable, orderId: string): Promise<number> {
  const r = await q.query(`UPDATE reservations SET status='COMMITTED', expires_at=NULL WHERE order_id=$1 AND status='HELD' RETURNING id`, [orderId]);
  return r.rows.length;
}

/** Release matching active reservations and give the capacity back. Idempotent. */
export async function release(
  q: Queryable,
  where: { orderId?: string; serviceId?: string; faultId?: string; role?: string; ids?: string[] },
  reason: string,
  now: Date,
): Promise<number> {
  const conds = [`status <> 'RELEASED'`];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); conds.push(sql.replace('?', `$${params.length}`)); };
  if (where.orderId) add('order_id = ?', where.orderId);
  if (where.serviceId) add('service_id = ?', where.serviceId);
  if (where.faultId) add('fault_id = ?', where.faultId);
  if (where.role) add('role = ?', where.role);
  if (where.ids) add('id = ANY(?)', where.ids);
  if (params.length === 0) throw new Error('release() requires a filter');
  const rows = (await q.query(`SELECT id, segment_id, mbps FROM reservations WHERE ${conds.join(' AND ')} ORDER BY segment_id FOR UPDATE`, params)).rows;
  for (const r of rows) {
    await q.query(`UPDATE capacity_resources SET reserved_mbps = reserved_mbps - $1 WHERE segment_id = $2`, [r.mbps, r.segment_id]);
    await q.query(`UPDATE reservations SET status='RELEASED', released_at=$2, release_reason=$3 WHERE id=$1`, [r.id, now, reason]);
  }
  return rows.length;
}

/** Sweeper: free holds whose TTL passed (orphaned by a crashed or abandoned workflow). */
export async function expireHolds(q: Queryable, now: Date): Promise<number> {
  const ids = (await q.query(`SELECT id FROM reservations WHERE status='HELD' AND expires_at IS NOT NULL AND expires_at < $1`, [now])).rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  return release(q, { ids }, 'hold expired', now);
}

/** Consistency check used by validation tests: reserved_mbps must equal the sum of active reservations. */
export async function capacityConsistency(q: Queryable) {
  return (
    await q.query(`
      SELECT c.segment_id, c.reserved_mbps, COALESCE(SUM(r.mbps) FILTER (WHERE r.status <> 'RELEASED'), 0)::bigint AS active_sum
      FROM capacity_resources c LEFT JOIN reservations r ON r.segment_id = c.segment_id
      GROUP BY c.segment_id, c.reserved_mbps
      HAVING c.reserved_mbps <> COALESCE(SUM(r.mbps) FILTER (WHERE r.status <> 'RELEASED'), 0)`)
  ).rows;
}
