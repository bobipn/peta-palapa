import type { Db, Queryable } from '../db/db.js';
import type { AppConfig } from '../config.js';
import type { Clock } from '../lib/util.js';
import type { Principal } from '../domain/rbac.js';
import type { NetworkSimulationAdapter } from './simulation/adapter.js';

export interface Logger {
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
}

export interface Ctx {
  db: Db;
  clock: Clock;
  config: AppConfig;
  sim: NetworkSimulationAdapter;
  log: Logger;
}

/** Per-request metadata threaded through service calls. */
export interface Meta {
  actor: Principal | null; // null = system (worker, auto-accept, simulator)
  correlationId: string;
  ip?: string;
}

export const systemMeta = (correlationId: string): Meta => ({ actor: null, correlationId });

export async function emitEvent(
  q: Queryable,
  ctx: Ctx,
  meta: Meta,
  e: { aggregateType: string; aggregateId: string; type: string; payload?: unknown; simTick?: number | null },
) {
  await q.query(
    `INSERT INTO domain_events (aggregate_type, aggregate_id, type, payload, correlation_id, actor_id, sim_tick, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.aggregateType, e.aggregateId, e.type, JSON.stringify(e.payload ?? {}), meta.correlationId, meta.actor?.userId ?? 'system', e.simTick ?? null, ctx.clock.now()],
  );
}

export async function audit(
  q: Queryable,
  ctx: Ctx,
  meta: Meta,
  a: { action: string; entityType?: string; entityId?: string; outcome?: 'ALLOWED' | 'DENIED' | 'ERROR'; details?: unknown },
) {
  await q.query(
    `INSERT INTO audit_events (actor_id, actor_role, action, entity_type, entity_id, outcome, details, ip, request_id, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      meta.actor?.userId ?? 'system', meta.actor?.role ?? 'SYSTEM', a.action, a.entityType ?? null, a.entityId ?? null,
      a.outcome ?? 'ALLOWED', JSON.stringify(a.details ?? {}), meta.ip ?? null, meta.correlationId, ctx.clock.now(),
    ],
  );
}

export interface Settings {
  currency: string;
  platform_fee: { rate: number; basis: 'GROSS' | 'WHOLESALE'; note: string };
  tax: { rate: number; label: string; note: string };
  quote_validity_hours: number;
  payment_timeout_minutes: number;
  provider_acceptance_timeout_minutes: number;
  hold_ttl_minutes: number;
  provisioning_delay_s_per_segment: number;
  protection_revertive: boolean;
  protection_switch_ms: number;
  reroute_ticks: number;
  node_processing_ms: number;
}

export async function getSettings(q: Queryable): Promise<Settings> {
  const rows = (await q.query<{ key: string; value: unknown }>('SELECT key, value FROM platform_settings')).rows;
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as Settings;
}

export interface SimState {
  seed: number;
  simEpoch: Date;
  tick: number;
  tickSeconds: number;
  autoTick: boolean;
  mode: string;
}

export async function getSimState(q: Queryable): Promise<SimState> {
  const r = (await q.query('SELECT * FROM simulation_state WHERE id = 1')).rows[0];
  return { seed: r.seed, simEpoch: r.sim_epoch, tick: r.tick, tickSeconds: r.tick_seconds, autoTick: r.auto_tick, mode: r.mode };
}

export function simTimeOf(s: SimState, tick = s.tick) {
  return new Date(new Date(s.simEpoch).getTime() + tick * s.tickSeconds * 1000);
}
