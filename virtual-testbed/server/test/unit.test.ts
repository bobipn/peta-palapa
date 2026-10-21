import { describe, expect, it } from 'vitest';
import { areDisjoint, computeRoutes, kShortestPaths, widestPathMbps, type GraphSegment, type Topology } from '../src/domain/routing.js';
import { ledgerLines, priceRoute } from '../src/domain/pricing.js';
import { availability, breachesOf } from '../src/domain/sla.js';
import { canTransitionOrder, canTransitionService, ORDER_STATES, ORDER_TERMINAL } from '../src/domain/state-machines.js';
import { segmentSample, serviceSample } from '../src/domain/telemetry-model.js';
import { can, PERMISSIONS } from '../src/domain/rbac.js';
import { haversineKm, seededUnit } from '../src/lib/util.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { isContiguous } from '../src/modules/simulation/deterministic.js';

const seg = (id: string, a: string, b: string, o: Partial<GraphSegment> = {}): GraphSegment => ({
  id, a, b, providerId: 'P1', providerEligible: true, up: true, availableMbps: 10_000, latencyMs: 1, lengthKm: 200,
  pricePerGbpsMonth: 1_000_000, setupFee: 0, srlg: null, ...o,
});
const nodes = (...ids: string[]) => ids.map((id) => ({ id, up: true }));

// Diamond with a long tail:  A-B-D, A-C-D, plus A-D direct (slow)
const diamond: Topology = {
  nodes: nodes('A', 'B', 'C', 'D'),
  segments: [
    seg('ab', 'A', 'B', { latencyMs: 1 }), seg('bd', 'B', 'D', { latencyMs: 1 }),
    seg('ac', 'A', 'C', { latencyMs: 2, providerId: 'P2' }), seg('cd', 'C', 'D', { latencyMs: 2, providerId: 'P2' }),
    seg('ad', 'A', 'D', { latencyMs: 10, availableMbps: 500 }),
  ],
};

describe('route computation', () => {
  it('Yen returns loopless paths in non-decreasing weight', () => {
    const ps = kShortestPaths(diamond.segments, new Set(['A', 'B', 'C', 'D']), 'A', 'D', 5, 'LATENCY');
    expect(ps.map((p) => p.segmentIds.join(','))).toEqual(['ab,bd', 'ac,cd', 'ad']);
    for (let i = 1; i < ps.length; i++) expect(ps[i].weight).toBeGreaterThanOrEqual(ps[i - 1].weight);
    for (const p of ps) expect(new Set(p.nodeIds).size).toBe(p.nodeIds.length);
  });

  it('objective COST prefers cheaper path', () => {
    const t: Topology = { ...diamond, segments: diamond.segments.map((s) => (s.id === 'ab' ? { ...s, pricePerGbpsMonth: 50_000_000 } : s)) };
    const r = computeRoutes(t, { fromNode: 'A', toNode: 'D', bandwidthMbps: 100, protection: 'NONE', objective: 'COST', nodeProcessingMs: 0 });
    expect(r.candidates[0].primary.segmentIds).toEqual(['ad']);
  });

  it('prunes segments without capacity and reports the widest feasible bandwidth', () => {
    const r = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 20_000, protection: 'NONE' });
    expect(r.feasible).toBe(false);
    expect(r.reason).toBe('INSUFFICIENT_CAPACITY');
    expect(r.maxFeasibleMbps).toBe(10_000);
    expect(widestPathMbps(diamond.segments, new Set(['A', 'B', 'C', 'D']), 'A', 'D')).toBe(10_000);
  });

  it('distinguishes NO_PATH, ENDPOINT_DOWN, PROVIDER_NOT_ELIGIBLE and SLA_NOT_MET', () => {
    const down = { ...diamond, segments: diamond.segments.map((s) => ({ ...s, up: false })) };
    expect(computeRoutes(down, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'NONE' }).reason).toBe('NO_PATH');
    expect(computeRoutes({ ...diamond, nodes: [{ id: 'A', up: false }, ...nodes('B', 'C', 'D')] }, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'NONE' }).reason).toBe('ENDPOINT_DOWN');
    const r = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'NONE', excludeProviders: ['P1', 'P2'] });
    expect(r.reason).toBe('PROVIDER_NOT_ELIGIBLE');
    const s = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'NONE', maxLatencyMs: 1, nodeProcessingMs: 0 });
    expect(s.reason).toBe('SLA_NOT_MET');
    expect(s.bestLatencyMs).toBe(2);
  });

  it('protection pair is segment/node/SRLG disjoint', () => {
    const r = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 100, protection: 'PROTECTED', nodeProcessingMs: 0 });
    expect(r.feasible).toBe(true);
    const c = r.candidates[0];
    expect(c.primary.segmentIds).toEqual(['ab', 'bd']);
    expect(c.protection!.segmentIds).toEqual(['ac', 'cd']);
    const byId = new Map(diamond.segments.map((s) => [s.id, s]));
    expect(areDisjoint(c.primary, c.protection!, byId)).toBe(true);
    // Same SRLG on ab and ac -> that pair is no longer diverse.
    const srlg = { ...diamond, segments: diamond.segments.map((s) => (s.id === 'ab' || s.id === 'ac' ? { ...s, srlg: 'DUCT-1' } : s)) };
    const r2 = computeRoutes(srlg, { fromNode: 'A', toNode: 'D', bandwidthMbps: 100, protection: 'PROTECTED', nodeProcessingMs: 0 });
    for (const cand of r2.candidates) expect(areDisjoint(cand.primary, cand.protection!, new Map(srlg.segments.map((s) => [s.id, s])))).toBe(true);
  });

  it('reports NO_DIVERSE_PATH on a chain', () => {
    const chain: Topology = { nodes: nodes('A', 'B', 'C'), segments: [seg('ab', 'A', 'B'), seg('bc', 'B', 'C')] };
    expect(computeRoutes(chain, { fromNode: 'A', toNode: 'C', bandwidthMbps: 1, protection: 'PROTECTED' }).reason).toBe('NO_DIVERSE_PATH');
  });

  it('is deterministic', () => {
    const a = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'PROTECTED' });
    const b = computeRoutes(diamond, { fromNode: 'A', toNode: 'D', bandwidthMbps: 1, protection: 'PROTECTED' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('contiguity check', () => {
    const ends = new Map<string, [string, string]>([['ab', ['A', 'B']], ['bd', ['D', 'B']]]);
    expect(isContiguous(['A', 'B', 'D'], ['ab', 'bd'], ends)).toBe(true);
    expect(isContiguous(['A', 'D'], ['ab'], ends)).toBe(false);
  });
});

describe('pricing & revenue allocation', () => {
  const segs = [
    { segmentId: 's1', providerId: 'P1', pricePerGbpsMonth: 6_000_000, setupFee: 5_000_000, role: 'PRIMARY' as const },
    { segmentId: 's2', providerId: 'P2', pricePerGbpsMonth: 7_333_333, setupFee: 5_000_000, role: 'PRIMARY' as const },
    { segmentId: 's3', providerId: 'P1', pricePerGbpsMonth: 1_000_001, setupFee: 0, role: 'PROTECTION' as const },
  ];
  it('GROSS basis: fee ≈ rate x customer price; providers get exactly wholesale', () => {
    const b = priceRoute(segs, 1500, { rate: 0.1, basis: 'GROSS' });
    expect(b.providers.find((p) => p.providerId === 'P1')!.wholesaleMonthly).toBe(9_000_000 + 1_500_002);
    expect(b.customerMonthly).toBe(b.wholesaleMonthly + b.platformFeeMonthly);
    expect(Math.abs(b.platformFeeMonthly - b.customerMonthly * 0.1)).toBeLessThanOrEqual(1);
  });
  it('WHOLESALE basis: fee = rate x wholesale (rounded up)', () => {
    const b = priceRoute(segs, 1000, { rate: 0.1, basis: 'WHOLESALE' });
    expect(b.platformFeeMonthly).toBe(Math.ceil(b.wholesaleMonthly * 1.1) - b.wholesaleMonthly);
  });
  it('ledger lines always balance (property check over many inputs)', () => {
    for (let i = 1; i < 300; i++) {
      const rate = (i % 40) / 100;
      const b = priceRoute(segs.map((s) => ({ ...s, pricePerGbpsMonth: s.pricePerGbpsMonth + i * 7919 })), 37 * i, { rate, basis: i % 2 ? 'GROSS' : 'WHOLESALE' }, 0.11);
      const l = ledgerLines(b, 'C');
      const charge = l.find((x) => x.entryType === 'CUSTOMER_CHARGE')!.amount;
      const rest = l.filter((x) => x.entryType === 'PROVIDER_ALLOCATION' || x.entryType === 'PLATFORM_FEE').reduce((a, x) => a + x.amount, 0);
      expect(charge).toBe(rest);
      expect(l.every((x) => Number.isInteger(x.amount) && x.amount >= 0)).toBe(true);
    }
  });
  it('rejects invalid fee rates', () => {
    expect(() => priceRoute(segs, 1000, { rate: 1, basis: 'GROSS' })).toThrow();
  });
});

describe('SLA', () => {
  const t = { latencyMs: 30, jitterMs: 2, lossPct: 0.1, availabilityPct: 99.9 };
  it('detects metric breaches', () => {
    expect(breachesOf({ latencyMs: 31, jitterMs: 1, lossPct: 0.2 }, t)).toEqual(['LATENCY', 'LOSS']);
    expect(breachesOf({ latencyMs: null, jitterMs: null, lossPct: null }, t)).toEqual([]);
  });
  it('availability excludes maintenance and customer-side time, reports missing data', () => {
    const samples = [
      ...Array.from({ length: 90 }, (_, i) => ({ tick: i + 1, intervalS: 60, state: 'UP' as const, outageCause: 'NONE' as const })),
      ...Array.from({ length: 4 }, (_, i) => ({ tick: 91 + i, intervalS: 60, state: 'DOWN' as const, outageCause: 'SCHEDULED_MAINTENANCE' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ tick: 95 + i, intervalS: 60, state: 'DOWN' as const, outageCause: 'CUSTOMER_SIDE' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ tick: 97 + i, intervalS: 60, state: 'DOWN' as const, outageCause: 'PROVIDER_NETWORK' as const })),
    ];
    const r = availability(samples, { fromTick: 1, toTick: 100, tickSeconds: 60 }, 99.9);
    expect(r.measuredSeconds).toBe(98 * 60);
    expect(r.noDataSeconds).toBe(2 * 60);
    expect(r.availabilityPct).toBeCloseTo((90 / 92) * 100, 3);
    expect(r.met).toBe(false);
  });
});

describe('state machines', () => {
  it('order happy path and terminal states', () => {
    const path = ['PENDING_PAYMENT', 'CONFIRMED', 'PROVIDER_ACCEPTANCE', 'RESOURCE_RESERVED', 'PROVISIONING', 'TESTING', 'ACTIVE'] as const;
    for (let i = 1; i < path.length; i++) expect(canTransitionOrder(path[i - 1], path[i])).toBe(true);
    for (const t of ORDER_TERMINAL) for (const s of ORDER_STATES) if (t !== 'ACTIVE') expect(canTransitionOrder(t, s)).toBe(false);
    expect(canTransitionOrder('PROVISIONING', 'CANCELLED')).toBe(false);
    expect(canTransitionOrder('PENDING_PAYMENT', 'ACTIVE')).toBe(false);
    expect(canTransitionOrder('PROVIDER_ACCEPTANCE', 'REJECTED')).toBe(true);
  });
  it('service lifecycle', () => {
    expect(canTransitionService('DESIGNED', 'RESERVED')).toBe(true);
    expect(canTransitionService('ACTIVE', 'PROVISIONING')).toBe(false);
  });
});

describe('telemetry model', () => {
  const s = { id: 'x', baseLatencyMs: 10, baseJitterMs: 0.2, baseLossPct: 0.001, utilisation: 0.5, down: false, downCause: 'NONE' as const, addLatencyMs: 0, addLossPct: 0 };
  it('is a pure function of (seed, tick, state)', () => {
    expect(segmentSample(1, 5, s)).toEqual(segmentSample(1, 5, s));
    expect(segmentSample(1, 5, s)).not.toEqual(segmentSample(2, 5, s));
    expect(seededUnit(42, 'k')).toBe(seededUnit(42, 'k'));
  });
  it('faults add latency/loss and down paths yield no metrics', () => {
    const base = segmentSample(1, 1, s);
    const hot = segmentSample(1, 1, { ...s, addLatencyMs: 40, addLossPct: 1 });
    expect(hot.latencyMs - base.latencyMs).toBeCloseTo(40, 6);
    const r = serviceSample({ seed: 1, tick: 1, serviceKey: 'k', bandwidthMbps: 1000, pathSegments: [s, { ...s, id: 'y', down: true, downCause: 'PROVIDER_NETWORK' }], nodeCount: 3, nodeProcessingMs: 0.05, tickSeconds: 60 });
    expect(r.pathDown).toBe(true);
    expect(r.latencyMs).toBeNull();
  });
  it('loss composes as 1 - prod(1 - p)', () => {
    const r = serviceSample({ seed: 1, tick: 1, serviceKey: 'k', bandwidthMbps: 1000, pathSegments: [{ ...s, baseLossPct: 0, addLossPct: 10 }, { ...s, id: 'z', baseLossPct: 0, addLossPct: 10 }], nodeCount: 3, nodeProcessingMs: 0, tickSeconds: 60 });
    expect(r.lossPct).toBeCloseTo(19, 3);
  });
});

describe('misc', () => {
  it('haversine Jakarta–Singapore ≈ 880 km', () => {
    expect(haversineKm(-6.2088, 106.8456, 1.3521, 103.8198)).toBeGreaterThan(850);
    expect(haversineKm(-6.2088, 106.8456, 1.3521, 103.8198)).toBeLessThan(910);
  });
  it('password hashing round-trips and rejects wrong passwords', async () => {
    const h = await hashPassword('s3cret');
    expect(await verifyPassword('s3cret', h)).toBe(true);
    expect(await verifyPassword('nope', h)).toBe(false);
    expect(h).not.toContain('s3cret');
  });
  it('RBAC matrix: auditor is read-only', () => {
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      if (/:(write|control|create|pay|cancel|respond|reset|ack|test|terminate)$/.test(perm)) expect((roles as readonly string[]).includes('AUDITOR'), perm).toBe(false);
    }
    expect(can('CUSTOMER', 'simulation:control')).toBe(false);
  });
});
