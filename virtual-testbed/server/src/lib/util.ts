import { randomBytes, randomUUID, createHash } from 'node:crypto';

/** Injectable wall clock so timeouts and workflows are testable. */
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };

export class ManualClock implements Clock {
  constructor(private t = new Date('2026-10-21T00:00:00Z')) {}
  now() {
    return new Date(this.t);
  }
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms);
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}${randomUUID().slice(0, 4)}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Domain error carrying an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (msg = 'Forbidden') => new AppError(403, 'FORBIDDEN', msg);
export const conflict = (code: string, msg: string, details?: unknown) => new AppError(409, code, msg, details);
export const badRequest = (code: string, msg: string, details?: unknown) => new AppError(422, code, msg, details);

// ---------------------------------------------------------------------------
// Seeded deterministic randomness (mulberry32 over an FNV-1a hash of the key).
// Same (seed, key) -> same number, independent of call order. This is what
// makes simulation runs reproducible after a reset.
// ---------------------------------------------------------------------------
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seededUnit(seed: number, key: string): number {
  let a = (fnv1a(key) ^ seed) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function round(n: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Great-circle distance in km (haversine, spherical earth R=6371 km). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * One-way propagation delay in fibre: ~4.9 microseconds per km
 * (group index ~1.47). Synthetic engineering approximation, not a measurement.
 */
export const FIBER_MS_PER_KM = 0.0049;
