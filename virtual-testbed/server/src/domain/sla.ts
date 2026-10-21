/**
 * SLA evaluation (pure).
 *
 * Availability over a window of samples, each covering `intervalS` seconds:
 *   excluded   = SCHEDULED_MAINTENANCE + CUSTOMER_SIDE outage time
 *   unavailable= PROVIDER_NETWORK outage time
 *   availability % = (measured - excluded - unavailable) / (measured - excluded) x 100
 * Time with no samples (simulator paused/not running) is NOT counted as measured;
 * it is reported separately as `noDataSeconds` (simulator downtime).
 */
export interface SlaTargets {
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
  availabilityPct: number;
}

export type Metric = 'LATENCY' | 'JITTER' | 'LOSS';

export function breachesOf(
  s: { latencyMs: number | null; jitterMs: number | null; lossPct: number | null },
  t: SlaTargets,
): Metric[] {
  const out: Metric[] = [];
  if (s.latencyMs !== null && s.latencyMs > t.latencyMs) out.push('LATENCY');
  if (s.jitterMs !== null && s.jitterMs > t.jitterMs) out.push('JITTER');
  if (s.lossPct !== null && s.lossPct > t.lossPct) out.push('LOSS');
  return out;
}

export interface SampleForAvailability {
  tick: number;
  intervalS: number;
  state: 'UP' | 'DOWN' | 'DEGRADED';
  outageCause: 'NONE' | 'PROVIDER_NETWORK' | 'SCHEDULED_MAINTENANCE' | 'CUSTOMER_SIDE';
}

export interface AvailabilityReport {
  windowSeconds: number;
  measuredSeconds: number;
  noDataSeconds: number;
  providerOutageSeconds: number;
  maintenanceSeconds: number;
  customerSideSeconds: number;
  degradedSeconds: number;
  availabilityPct: number | null;
  targetPct: number;
  met: boolean | null;
}

export function availability(
  samples: SampleForAvailability[],
  window: { fromTick: number; toTick: number; tickSeconds: number },
  targetPct: number,
): AvailabilityReport {
  const windowSeconds = Math.max(0, (window.toTick - window.fromTick + 1) * window.tickSeconds);
  let measured = 0, provider = 0, maint = 0, cust = 0, degraded = 0;
  for (const s of samples) {
    if (s.tick < window.fromTick || s.tick > window.toTick) continue;
    measured += s.intervalS;
    if (s.state === 'DOWN') {
      if (s.outageCause === 'SCHEDULED_MAINTENANCE') maint += s.intervalS;
      else if (s.outageCause === 'CUSTOMER_SIDE') cust += s.intervalS;
      else provider += s.intervalS;
    } else if (s.state === 'DEGRADED') degraded += s.intervalS;
  }
  const denom = measured - maint - cust;
  const pct = denom > 0 ? ((denom - provider) / denom) * 100 : null;
  return {
    windowSeconds,
    measuredSeconds: measured,
    noDataSeconds: Math.max(0, windowSeconds - measured),
    providerOutageSeconds: provider,
    maintenanceSeconds: maint,
    customerSideSeconds: cust,
    degradedSeconds: degraded,
    availabilityPct: pct === null ? null : Math.round(pct * 10000) / 10000,
    targetPct,
    met: pct === null ? null : pct >= targetPct,
  };
}
