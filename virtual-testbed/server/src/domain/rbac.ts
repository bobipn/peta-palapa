/**
 * Role-based permissions. Enforced on the backend for every route; the UI only
 * mirrors this to hide buttons. Row-level scoping (own orders / own assets)
 * is applied in the modules via `scopeFor`.
 */
export type Role = 'ADMIN' | 'CUSTOMER' | 'PROVIDER' | 'NOC' | 'COMMERCIAL' | 'AUDITOR';

export const PERMISSIONS = {
  'topology:read': ['ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'COMMERCIAL'],
  'routes:search': ['ADMIN', 'CUSTOMER', 'NOC', 'COMMERCIAL'],
  'catalog:read': ['ADMIN', 'CUSTOMER', 'PROVIDER', 'NOC', 'COMMERCIAL', 'AUDITOR'],
  'catalog:write': ['ADMIN'],
  'quotes:create': ['CUSTOMER'],
  'quotes:read': ['ADMIN', 'CUSTOMER', 'COMMERCIAL', 'AUDITOR'],
  'orders:create': ['CUSTOMER'],
  'orders:read': ['ADMIN', 'CUSTOMER', 'PROVIDER', 'NOC', 'COMMERCIAL', 'AUDITOR'],
  'orders:pay': ['CUSTOMER'],
  'orders:cancel': ['CUSTOMER', 'ADMIN'],
  'suborders:respond': ['PROVIDER'],
  'provider:assets:write': ['PROVIDER'],
  'services:read': ['ADMIN', 'CUSTOMER', 'PROVIDER', 'NOC', 'AUDITOR', 'COMMERCIAL'],
  'services:test': ['ADMIN', 'NOC'],
  'services:terminate': ['CUSTOMER', 'ADMIN'],
  'provisioning:read': ['ADMIN', 'NOC', 'AUDITOR'],
  'assurance:read': ['ADMIN', 'NOC', 'AUDITOR', 'PROVIDER', 'CUSTOMER'],
  'alarms:ack': ['ADMIN', 'NOC'],
  'simulation:read': ['ADMIN', 'NOC', 'AUDITOR'],
  'simulation:control': ['ADMIN', 'NOC'],
  'settlement:read': ['ADMIN', 'COMMERCIAL', 'AUDITOR', 'PROVIDER'],
  'settlement:write': ['ADMIN', 'COMMERCIAL'],
  'settings:read': ['ADMIN', 'COMMERCIAL', 'AUDITOR', 'NOC'],
  'settings:write': ['ADMIN'],
  'audit:read': ['ADMIN', 'AUDITOR'],
  'integrations:read': ['ADMIN', 'NOC', 'AUDITOR', 'COMMERCIAL'],
  'admin:reset': ['ADMIN'],
  'users:read': ['ADMIN', 'AUDITOR'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export interface Principal {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  orgId: string;
  customerId: string | null;
  providerId: string | null;
}

/** Row-level scope: which customer/provider rows this principal may see. null = unrestricted. */
export function scopeFor(p: Principal): { customerId: string | null; providerId: string | null } {
  if (p.role === 'CUSTOMER') return { customerId: p.customerId ?? '__none__', providerId: null };
  if (p.role === 'PROVIDER') return { customerId: null, providerId: p.providerId ?? '__none__' };
  return { customerId: null, providerId: null };
}
