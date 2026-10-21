import type { Queryable } from '../db/db.js';
import type { Principal } from '../domain/rbac.js';
import { conflict, notFound } from '../lib/util.js';
import { audit, getSettings, type Ctx, type Meta } from './context.js';

export async function ledger(q: Queryable, who: Principal) {
  const pid = who.role === 'PROVIDER' ? who.providerId : null;
  const rows = (await q.query(
    `SELECT l.*, o.customer_id FROM settlement_ledger l JOIN orders o ON o.id=l.order_id
     WHERE ($1::text IS NULL OR (l.party_type='PROVIDER' AND l.party_id=$1)) ORDER BY l.created_at DESC, l.order_id, l.entry_type LIMIT 1000`, [pid])).rows;
  return rows;
}

export async function settlementSummary(q: Queryable, who: Principal) {
  const rows = await ledger(q, who);
  const live = rows.filter((r) => r.status !== 'VOID' && r.period !== 'ONE_TIME');
  const sum = (t: string) => live.filter((r) => r.entry_type === t).reduce((a, r) => a + r.amount, 0);
  const byProvider = new Map<string, number>();
  for (const r of live.filter((x) => x.entry_type === 'PROVIDER_ALLOCATION')) byProvider.set(r.party_id, (byProvider.get(r.party_id) ?? 0) + r.amount);
  const names = new Map((await q.query(`SELECT id, name FROM providers`)).rows.map((p) => [p.id, p.name]));
  const settings = await getSettings(q);
  const customerCharges = sum('CUSTOMER_CHARGE');
  const allocations = sum('PROVIDER_ALLOCATION');
  const fees = sum('PLATFORM_FEE');
  return {
    simulated: true,
    currency: settings.currency,
    feeConfig: settings.platform_fee,
    monthlyRecurring: who.role === 'PROVIDER' ? null : { customerCharges, providerAllocations: allocations, platformFees: fees, tax: sum('TAX') },
    providerAllocations: [...byProvider].map(([providerId, amount]) => ({ providerId, providerName: names.get(providerId), amount })),
    /** Invariant check visible to auditors: charges must equal allocations + fees. */
    balanced: who.role === 'PROVIDER' ? null : customerCharges === allocations + fees,
    pending: live.filter((r) => r.status === 'PENDING').length,
    settled: live.filter((r) => r.status === 'SETTLED_SIMULATED').length,
  };
}

export async function markSettled(ctx: Ctx, meta: Meta, orderId: string) {
  return ctx.db.tx(async (q) => {
    const rows = (await q.query(`SELECT status FROM settlement_ledger WHERE order_id=$1`, [orderId])).rows;
    if (rows.length === 0) throw notFound('Ledger entries for order');
    if (!rows.some((r) => r.status === 'PENDING')) throw conflict('NOTHING_PENDING', 'No pending entries');
    const r = await q.query(`UPDATE settlement_ledger SET status='SETTLED_SIMULATED' WHERE order_id=$1 AND status='PENDING' RETURNING id`, [orderId]);
    await audit(q, ctx, meta, { action: 'settlement.mark_settled', entityType: 'order', entityId: orderId, details: { entries: r.rows.length, simulated: true } });
    return { settled: r.rows.length };
  });
}
