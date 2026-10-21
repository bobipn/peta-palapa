/**
 * Runtime configuration. Every value has a safe default for local/simulated use.
 * Nothing here points at a real provider, billing system or network device.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  /** postgres://... | pglite://memory | pglite:///absolute/data/dir */
  databaseUrl: string;
  sessionTtlHours: number;
  cookieSecure: boolean;
  trustProxy: boolean;
  /** Password for all seeded demo users. */
  demoPassword: string;
  /** Background workflow worker interval (ms). 0 disables (tests drive it manually). */
  workerIntervalMs: number;
  /** Real-time interval for one simulation tick (ms). 0 disables auto ticking. */
  autoTickMs: number;
  rateLimitPerMinute: number;
  loginRateLimitPerMinute: number;
  /** Hosts the process may call out to. Default: none (default-deny egress). */
  egressAllowlist: string[];
  serveWeb: boolean;
  webDistDir: string;
}

export const DEFAULT_DEMO_PASSWORD = 'demo-cring-2026';

function num(v: string | undefined, d: number): number {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric config value: ${v}`);
  return n;
}

function bool(v: string | undefined, d: boolean): boolean {
  if (v === undefined || v === '') return d;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = (env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development') as AppConfig['env'];
  const cfg: AppConfig = {
    env: mode,
    host: env.HOST ?? '0.0.0.0',
    port: num(env.PORT, 8080),
    databaseUrl: env.DATABASE_URL ?? 'pglite://memory',
    sessionTtlHours: num(env.SESSION_TTL_HOURS, 12),
    cookieSecure: bool(env.COOKIE_SECURE, mode === 'production'),
    trustProxy: bool(env.TRUST_PROXY, mode === 'production'),
    demoPassword: env.DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD,
    workerIntervalMs: num(env.WORKER_INTERVAL_MS, mode === 'test' ? 0 : 1000),
    autoTickMs: num(env.AUTO_TICK_MS, mode === 'test' ? 0 : 5000),
    rateLimitPerMinute: num(env.RATE_LIMIT_PER_MINUTE, 600),
    loginRateLimitPerMinute: num(env.LOGIN_RATE_LIMIT_PER_MINUTE, 10),
    egressAllowlist: (env.EGRESS_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    serveWeb: bool(env.SERVE_WEB, mode !== 'test'),
    webDistDir: env.WEB_DIST_DIR ?? 'dist/web',
  };
  if (cfg.env === 'production' && cfg.demoPassword === DEFAULT_DEMO_PASSWORD && !bool(env.ALLOW_DEFAULT_DEMO_PASSWORD, false)) {
    throw new Error(
      'Refusing to start in production with the default demo password. Set DEMO_PASSWORD (or ALLOW_DEFAULT_DEMO_PASSWORD=true for a throwaway demo).',
    );
  }
  return cfg;
}
