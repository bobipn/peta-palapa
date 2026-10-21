import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

/**
 * Minimal database abstraction over two PostgreSQL engines that speak the same SQL:
 *  - `pg`     : real PostgreSQL server (production / docker-compose / CI).
 *  - `pglite` : PostgreSQL compiled to WASM, in-process (zero-dependency local runs,
 *               tests, and hosts that cannot run a Postgres server).
 * Business code only sees `Queryable` / `Db`, so the engine is a deployment choice.
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
export interface Queryable {
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Run a parameterless multi-statement script (migrations). */
  exec(sql: string): Promise<void>;
}
export interface Db extends Queryable {
  kind: 'pg' | 'pglite';
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// int8 and numeric come back as strings from pg by default; all our values fit in a JS number.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

class PgDb implements Db {
  kind = 'pg' as const;
  constructor(private pool: pg.Pool) {}
  async query<T>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query(sql, params as any[]);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
  }
  async exec(sql: string) {
    await this.pool.query(sql);
  }
  async tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const q: Queryable = {
        query: async <R>(sql: string, params: unknown[] = []) => {
          const r = await client.query(sql, params as any[]);
          return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
        },
        exec: async (sql: string) => {
          await client.query(sql);
        },
      };
      const out = await fn(q);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
  close() {
    return this.pool.end();
  }
}

class PgliteDb implements Db {
  kind = 'pglite' as const;
  constructor(private db: PGlite) {}
  async query<T>(sql: string, params: unknown[] = []) {
    const r = await this.db.query<T>(sql, params as any[]);
    return { rows: r.rows, rowCount: r.affectedRows || r.rows.length };
  }
  async exec(sql: string) {
    await this.db.exec(sql);
  }
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    // PGlite serialises transactions on its single connection, so concurrent
    // callers queue instead of interleaving.
    return this.db.transaction(async (t) =>
      fn({
        query: async <R>(sql: string, params: unknown[] = []) => {
          const r = await t.query<R>(sql, params as any[]);
          return { rows: r.rows, rowCount: r.affectedRows || r.rows.length };
        },
        exec: async (sql: string) => {
          await t.exec(sql);
        },
      }),
    );
  }
  close() {
    return this.db.close();
  }
}

export async function openDb(url: string): Promise<Db> {
  if (url.startsWith('pglite://')) {
    const loc = url.slice('pglite://'.length);
    const parsers = { 20: (v: string) => Number(v), 1700: (v: string) => Number(v) };
    const inst = loc === 'memory' || loc === '' ? new PGlite({ parsers }) : new PGlite(loc, { parsers });
    await inst.waitReady;
    return new PgliteDb(inst);
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    await pool.query('select 1');
    return new PgDb(pool);
  }
  throw new Error(`Unsupported DATABASE_URL scheme: ${url.split(':')[0]}`);
}

