import { round, seededUnit } from '../lib/util.js';

/**
 * Deterministic synthetic telemetry model (Mode A). Every value produced here is
 * SIMULATED. Given (seed, tick, segment) the output is always identical, which
 * is what makes a reset + replay reproducible.
 *
 * Per segment at tick t:
 *   jitter  = baseJitter x (0.5 + u1)
 *   latency = baseLatency + jitter/2 + congestion + fault.addMs
 *   loss    = baseLoss x (0.5 + u2) + congestionLoss + fault.addPct
 *   congestion when utilisation > 90 %: +(util-0.9) x 10 ms, +(util-0.9) x 1 % loss
 * Per service (along its active path):
 *   latency = sum(segment latency) + nodes x nodeProcessingMs
 *   jitter  = sqrt(sum jitter^2)  (independent-variance approximation)
 *   loss    = 1 - prod(1 - loss_i)
 *   throughput = bandwidth x diurnal demand(t) x (1 - loss)
 * Nothing here models optical physics (OSNR, power, dispersion).
 */
export interface SegmentState {
  id: string;
  baseLatencyMs: number;
  baseJitterMs: number;
  baseLossPct: number;
  utilisation: number;
  down: boolean;
  downCause: 'NONE' | 'PROVIDER_NETWORK' | 'SCHEDULED_MAINTENANCE';
  addLatencyMs: number;
  addLossPct: number;
}

export interface SegmentSample {
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
}

export function segmentSample(seed: number, tick: number, s: SegmentState): SegmentSample {
  const u1 = seededUnit(seed, `${s.id}:j:${tick}`);
  const u2 = seededUnit(seed, `${s.id}:l:${tick}`);
  const over = Math.max(0, s.utilisation - 0.9);
  const jitter = s.baseJitterMs * (0.5 + u1);
  return {
    jitterMs: jitter,
    latencyMs: s.baseLatencyMs + jitter / 2 + over * 10 + s.addLatencyMs,
    lossPct: s.baseLossPct * (0.5 + u2) + over * 1 + s.addLossPct,
  };
}

export interface ServiceSampleInput {
  seed: number;
  tick: number;
  serviceKey: string;
  bandwidthMbps: number;
  pathSegments: SegmentState[];
  nodeCount: number;
  nodeProcessingMs: number;
  tickSeconds: number;
}

export interface ServiceSample {
  latencyMs: number | null;
  jitterMs: number | null;
  lossPct: number | null;
  throughputMbps: number;
  pathDown: boolean;
  downCause: 'NONE' | 'PROVIDER_NETWORK' | 'SCHEDULED_MAINTENANCE';
}

/** Diurnal demand factor in [0.5, 0.95] over a 24h simulated day. */
export function demandFactor(seed: number, key: string, tick: number, tickSeconds: number) {
  const hours = ((tick * tickSeconds) / 3600) % 24;
  const diurnal = 0.5 + 0.5 * Math.sin(((hours - 8) / 24) * 2 * Math.PI); // peak mid-afternoon
  return 0.5 + 0.4 * diurnal + 0.05 * seededUnit(seed, `${key}:d:${tick}`);
}

export function serviceSample(i: ServiceSampleInput): ServiceSample {
  const down = i.pathSegments.find((s) => s.down);
  if (down) return { latencyMs: null, jitterMs: null, lossPct: null, throughputMbps: 0, pathDown: true, downCause: down.downCause };
  let lat = 0;
  let jit2 = 0;
  let keep = 1;
  for (const s of i.pathSegments) {
    const m = segmentSample(i.seed, i.tick, s);
    lat += m.latencyMs;
    jit2 += m.jitterMs ** 2;
    keep *= 1 - Math.min(100, m.lossPct) / 100;
  }
  lat += i.nodeCount * i.nodeProcessingMs;
  const loss = (1 - keep) * 100;
  return {
    latencyMs: round(lat, 3),
    jitterMs: round(Math.sqrt(jit2), 3),
    lossPct: round(loss, 5),
    throughputMbps: round(i.bandwidthMbps * demandFactor(i.seed, i.serviceKey, i.tick, i.tickSeconds) * (1 - loss / 100), 1),
    pathDown: false,
    downCause: 'NONE',
  };
}
