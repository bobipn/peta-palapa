import type { Queryable } from '../db/db.js';
import { computeRoutes, type Objective, type Path, type RouteCandidate, type RouteResult } from '../domain/routing.js';
import { priceRoute, type PricedSegment, type PriceBreakdown } from '../domain/pricing.js';
import { scopeFor, type Principal } from '../domain/rbac.js';
import { AppError, badRequest, conflict, forbidden, newId, notFound } from '../lib/util.js';
import { audit, emitEvent, getSettings, type Ctx, type Meta, type Settings } from './context.js';
import { loadGraph, nodeForLocation } from './topology.js';

export interface RouteSearchInput {
  aLocationId: string;
  bLocationId: string;
  bandwidthMbps: number;
  protection: 'NONE' | 'PROTECTED';
  slaProfileId?: string;
  productId?: string;
  objective?: Objective;
  excludeProviders?: string[];
}

export interface PricedCandidate {
  index: number;
  signature: string;
  primary: Path & { providerNames: string[] };
  protection: (Path & { providerNames: string[] }) | null;
  price: PriceBreakdown;
  meetsSla: boolean | null;
}

export async function searchRoutes(q: Queryable, input: RouteSearchInput) {
  const settings = await getSettings(q);
  const [from, to] = [await nodeForLocation(q, input.aLocationId), await nodeForLocation(q, input.bLocationId)];
  let sla: any = null;
  if (input.slaProfileId) {
    sla = (await q.query(`SELECT * FROM sla_profiles WHERE id=$1 AND active`, [input.slaProfileId])).rows[0];
    if (!sla) throw notFound('SLA profile');
  }
  if (input.productId) {
    const p = (await q.query(`SELECT * FROM products WHERE id=$1`, [input.productId])).rows[0];
    if (!p) throw notFound('Product');
    if (input.bandwidthMbps < p.min_mbps || input.bandwidthMbps > p.max_mbps) {
      throw badRequest('BANDWIDTH_OUT_OF_RANGE', `${p.code} supports ${p.min_mbps}–${p.max_mbps} Mbps`);
    }
  }
  const topo = await loadGraph(q);
  const result: RouteResult = computeRoutes(topo, {
    fromNode: from,
    toNode: to,
    bandwidthMbps: input.bandwidthMbps,
    protection: input.protection,
    maxLatencyMs: sla?.latency_ms,
    objective: input.objective,
    excludeProviders: input.excludeProviders,
    nodeProcessingMs: settings.node_processing_ms,
  });
  const names = new Map((await q.query(`SELECT id, name FROM providers`)).rows.map((p) => [p.id, p.name]));
  const segById = new Map(topo.segments.map((s) => [s.id, s]));
  const candidates: PricedCandidate[] = result.candidates.map((c, i) => ({
    index: i,
    signature: signatureOf(c),
    primary: { ...c.primary, providerNames: c.primary.providers.map((p) => names.get(p) ?? p) },
    protection: c.protection ? { ...c.protection, providerNames: c.protection.providers.map((p) => names.get(p) ?? p) } : null,
    price: priceCandidate(c, segById, input.bandwidthMbps, settings),
    meetsSla: sla ? c.primary.latencyMs <= sla.latency_ms && (!c.protection || c.protection.latencyMs <= sla.latency_ms) : null,
  }));
  return {
    simulated: true,
    feasible: result.feasible,
    reason: result.reason ?? null,
    explanation: result.explanation ?? null,
    maxFeasibleMbps: result.maxFeasibleMbps ?? null,
    bestLatencyMs: result.bestLatencyMs ?? null,
    alternatives: suggestAlternatives(result, input),
    candidates,
    note: 'Route computation is an MVP heuristic (k-shortest paths + disjoint pair search), not carrier-grade PCE.',
  };
}

function suggestAlternatives(r: RouteResult, input: RouteSearchInput) {
  const out: { kind: string; description: string; bandwidthMbps?: number }[] = [];
  if (r.reason === 'INSUFFICIENT_CAPACITY' && r.maxFeasibleMbps && r.maxFeasibleMbps > 0) {
    out.push({ kind: 'LOWER_BANDWIDTH', bandwidthMbps: r.maxFeasibleMbps, description: `Request ${r.maxFeasibleMbps} Mbps or less` });
  }
  if (r.reason === 'NO_DIVERSE_PATH' && input.protection === 'PROTECTED') {
    out.push({ kind: 'UNPROTECTED', description: 'Order without protection (single path)' });
  }
  if (r.reason === 'SLA_NOT_MET') out.push({ kind: 'RELAX_SLA', description: `Choose an SLA profile allowing at least ${r.bestLatencyMs} ms` });
  return out;
}

export function signatureOf(c: RouteCandidate) {
  return `${c.primary.segmentIds.join('>')}${c.protection ? `|${c.protection.segmentIds.join('>')}` : ''}`;
}

function priceCandidate(c: RouteCandidate, segById: Map<string, any>, mbps: number, s: Settings) {
  const segs: PricedSegment[] = [
    ...c.primary.segmentIds.map((id) => ({ id, role: 'PRIMARY' as const })),
    ...(c.protection?.segmentIds ?? []).map((id) => ({ id, role: 'PROTECTION' as const })),
  ].map(({ id, role }) => {
    const g = segById.get(id);
    return { segmentId: id, providerId: g.providerId, pricePerGbpsMonth: g.pricePerGbpsMonth, setupFee: g.setupFee, role };
  });
  return priceRoute(segs, mbps, { rate: s.platform_fee.rate, basis: s.platform_fee.basis }, s.tax.rate);
}

export interface CreateQuoteInput extends RouteSearchInput {
  productId: string;
  slaProfileId: string;
  termMonths: number;
  /** Signature of the candidate the customer picked from searchRoutes; default = best. */
  routeSignature?: string;
}

export async function createQuote(ctx: Ctx, meta: Meta, input: CreateQuoteInput) {
  const actor = meta.actor!;
  if (actor.role !== 'CUSTOMER' || !actor.customerId) throw forbidden('Only customers can request quotes');
  if (input.aLocationId === input.bLocationId) throw badRequest('SAME_ENDPOINTS', 'A and B must differ');
  return ctx.db.tx(async (q) => {
    const search = await searchRoutes(q, input);
    if (!search.feasible) {
      throw new AppError(422, `ROUTE_${search.reason}`, search.explanation ?? 'No feasible route', {
        reason: search.reason, maxFeasibleMbps: search.maxFeasibleMbps, alternatives: search.alternatives,
      });
    }
    const chosen = input.routeSignature ? search.candidates.find((c) => c.signature === input.routeSignature) : search.candidates[0];
    if (!chosen) throw conflict('ROUTE_NO_LONGER_AVAILABLE', 'The selected route is no longer feasible; search again.');
    const settings = await getSettings(q);
    const now = ctx.clock.now();
    const id = newId('qt');
    const validUntil = new Date(now.getTime() + settings.quote_validity_hours * 3600_000);
    const route = {
      primary: pick(chosen.primary),
      protection: chosen.protection ? pick(chosen.protection) : null,
      signature: chosen.signature,
    };
    await q.query(
      `INSERT INTO quotes (id, customer_id, product_id, sla_profile_id, a_location_id, b_location_id, bandwidth_mbps, protection, term_months,
         route, currency, price_monthly, setup_fee, breakdown, state, valid_until, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'QUOTED',$15,$16,$17)`,
      [
        id, actor.customerId, input.productId, input.slaProfileId, input.aLocationId, input.bLocationId, input.bandwidthMbps, input.protection,
        input.termMonths, JSON.stringify(route), settings.currency, chosen.price.customerMonthly, chosen.price.setupFee,
        JSON.stringify(chosen.price), validUntil, actor.userId, now,
      ],
    );
    await emitEvent(q, ctx, meta, { aggregateType: 'quote', aggregateId: id, type: 'QUOTE_CREATED', payload: { price: chosen.price.customerMonthly, route: route.signature } });
    await audit(q, ctx, meta, { action: 'quote.create', entityType: 'quote', entityId: id });
    return getQuote(q, actor, id);
  });
}

const pick = (p: Path) => ({
  nodeIds: p.nodeIds, segmentIds: p.segmentIds, latencyMs: p.latencyMs, lengthKm: p.lengthKm, providers: p.providers,
});

export async function getQuote(q: Queryable, who: Principal, id: string) {
  const row = (await q.query(`SELECT * FROM quotes WHERE id=$1`, [id])).rows[0];
  if (!row) throw notFound('Quote');
  const scope = scopeFor(who);
  if (scope.customerId && row.customer_id !== scope.customerId) throw notFound('Quote');
  return row;
}

export async function listQuotes(q: Queryable, who: Principal) {
  const scope = scopeFor(who);
  return (await q.query(`SELECT * FROM quotes WHERE ($1::text IS NULL OR customer_id=$1) ORDER BY created_at DESC LIMIT 200`, [scope.customerId])).rows;
}
