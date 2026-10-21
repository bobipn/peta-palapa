import type { Queryable } from '../db/db.js';
import type { Principal, Role } from '../domain/rbac.js';
import { AppError, randomToken, sha256 } from '../lib/util.js';
import { verifyPassword } from '../lib/password.js';
import { audit, type Ctx, type Meta } from './context.js';

async function principalFor(q: Queryable, userId: string): Promise<Principal | null> {
  const u = (await q.query(
    `SELECT u.id, u.email, u.display_name, u.role, u.org_id, u.active, c.id AS customer_id, p.id AS provider_id
     FROM users u LEFT JOIN customers c ON c.org_id=u.org_id LEFT JOIN providers p ON p.org_id=u.org_id WHERE u.id=$1`, [userId])).rows[0];
  if (!u || !u.active) return null;
  return { userId: u.id, email: u.email, displayName: u.display_name, role: u.role as Role, orgId: u.org_id, customerId: u.customer_id, providerId: u.provider_id };
}

export async function login(ctx: Ctx, meta: Meta, email: string, password: string) {
  const u = (await ctx.db.query(`SELECT id, password_hash, active FROM users WHERE lower(email)=lower($1)`, [email])).rows[0];
  // Verify even when the user is unknown so response timing does not reveal valid emails.
  const ok = await verifyPassword(password, u?.password_hash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  if (!u || !ok || !u.active) {
    await audit(ctx.db, ctx, meta, { action: 'auth.login', outcome: 'DENIED', details: { email } });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const token = randomToken();
  const now = ctx.clock.now();
  const expires = new Date(now.getTime() + ctx.config.sessionTtlHours * 3600_000);
  await ctx.db.query(`INSERT INTO sessions (id, user_id, created_at, expires_at, ip) VALUES ($1,$2,$3,$4,$5)`, [sha256(token), u.id, now, expires, meta.ip ?? null]);
  const principal = (await principalFor(ctx.db, u.id))!;
  await audit(ctx.db, ctx, { ...meta, actor: principal }, { action: 'auth.login', entityType: 'user', entityId: u.id });
  return { token, expires, principal };
}

export async function resolveSession(ctx: Ctx, token: string | undefined): Promise<Principal | null> {
  if (!token || token.length > 200) return null;
  const s = (await ctx.db.query(`SELECT user_id, expires_at FROM sessions WHERE id=$1`, [sha256(token)])).rows[0];
  if (!s || new Date(s.expires_at) < ctx.clock.now()) return null;
  return principalFor(ctx.db, s.user_id);
}

export async function logout(ctx: Ctx, meta: Meta, token: string | undefined) {
  if (!token) return;
  await ctx.db.query(`DELETE FROM sessions WHERE id=$1`, [sha256(token)]);
  await audit(ctx.db, ctx, meta, { action: 'auth.logout' });
}
