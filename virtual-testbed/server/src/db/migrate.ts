import type { Db } from './db.js';
import { MIGRATIONS } from './migrations.js';

export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.tx(async (q) => {
      await q.exec(m.sql);
      await q.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}

/** Tables holding demo data, in an order safe for TRUNCATE ... CASCADE. Schema and schema_migrations are untouched. */
export const DATA_TABLES = [
  'alarm_comments', 'port_metrics', 'device_metrics', 'service_configs', 'vlan_allocations', 'ip_allocations', 'ip_pools',
  'idempotency_keys', 'audit_events', 'domain_events', 'sonata_messages', 'settlement_ledger',
  'alarms', 'incident_events', 'incidents', 'sla_breaches', 'telemetry_samples', 'injected_faults',
  'simulation_scenarios', 'simulation_state', 'service_tests', 'provisioning_tasks', 'provisioning_workflows',
  'reservations', 'service_paths', 'services', 'provider_suborders', 'orders', 'quotes', 'platform_settings',
  'sla_profiles', 'products', 'capacity_resources', 'optical_channels', 'ports', 'equipment', 'cable_segments',
  'cable_systems', 'nodes', 'pops', 'locations', 'providers', 'customers', 'sessions', 'users', 'organizations',
];

export async function truncateDemoData(db: Db) {
  await db.exec(`TRUNCATE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}
