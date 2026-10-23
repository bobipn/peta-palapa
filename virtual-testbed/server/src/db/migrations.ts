/**
 * Ordered, append-only migrations. Never edit a migration that has shipped;
 * add a new one. Applied ids are tracked in schema_migrations, which demo
 * resets never touch.
 *
 * Conventions:
 *  - money: bigint, whole IDR (DEMO prices, not tariffs)
 *  - bandwidth/capacity: bigint Mbps
 *  - wall-clock timestamps are passed in from the app Clock (no now() in SQL)
 *  - simulation timestamps (sim_*) live on the simulation clock, see simulation_state
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: /* sql */ `
-- ===================== Identity & access =====================
CREATE TABLE organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('PLATFORM','CUSTOMER','PROVIDER')),
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN','CUSTOMER','PROVIDER','NOC','COMMERCIAL','AUDITOR')),
  org_id text NOT NULL REFERENCES organizations(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE sessions (
  id text PRIMARY KEY,               -- sha256(token); the raw token only lives in the cookie
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  ip text
);

CREATE TABLE customers (
  id text PRIMARY KEY,
  org_id text NOT NULL UNIQUE REFERENCES organizations(id),
  name text NOT NULL
);

CREATE TABLE providers (
  id text PRIMARY KEY,
  org_id text NOT NULL UNIQUE REFERENCES organizations(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  auto_accept boolean NOT NULL DEFAULT true,
  acceptance_delay_s integer NOT NULL DEFAULT 3,
  is_demo boolean NOT NULL DEFAULT true
);

-- ===================== Geography & network inventory =====================
CREATE TABLE locations (
  id text PRIMARY KEY,
  city text NOT NULL,
  country_code text NOT NULL,
  country text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  coord_note text NOT NULL            -- provenance: approximate public city-centre coordinates
);

CREATE TABLE pops (
  id text PRIMARY KEY,
  location_id text NOT NULL REFERENCES locations(id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('POP','LANDING_STATION','DATA_CENTER')),
  is_synthetic boolean NOT NULL DEFAULT true
);

CREATE TABLE nodes (
  id text PRIMARY KEY,
  pop_id text NOT NULL REFERENCES pops(id),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ROUTER','OTN','ROADM')),
  admin_status text NOT NULL DEFAULT 'UP' CHECK (admin_status IN ('UP','DOWN')),
  oper_status text NOT NULL DEFAULT 'UP' CHECK (oper_status IN ('UP','DOWN','DEGRADED'))
);

CREATE TABLE cable_systems (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider_id text NOT NULL REFERENCES providers(id),
  kind text NOT NULL CHECK (kind IN ('SUBSEA','TERRESTRIAL')),
  is_synthetic boolean NOT NULL DEFAULT true
);

-- Physical fibre span between two nodes. Length is a physical attribute;
-- capacity lives in capacity_resources (they are deliberately different things).
CREATE TABLE cable_segments (
  id text PRIMARY KEY,
  cable_system_id text NOT NULL REFERENCES cable_systems(id),
  provider_id text NOT NULL REFERENCES providers(id),
  a_node_id text NOT NULL REFERENCES nodes(id),
  b_node_id text NOT NULL REFERENCES nodes(id),
  length_km double precision NOT NULL CHECK (length_km > 0),
  base_latency_ms double precision NOT NULL,
  base_jitter_ms double precision NOT NULL,
  base_loss_pct double precision NOT NULL,
  price_per_gbps_month bigint NOT NULL CHECK (price_per_gbps_month >= 0),
  setup_fee bigint NOT NULL DEFAULT 0,
  srlg text,                                    -- shared risk link group tag
  admin_status text NOT NULL DEFAULT 'UP' CHECK (admin_status IN ('UP','DOWN')),
  oper_status text NOT NULL DEFAULT 'UP' CHECK (oper_status IN ('UP','DOWN','DEGRADED')),
  CHECK (a_node_id <> b_node_id)
);

CREATE TABLE equipment (
  id text PRIMARY KEY,
  node_id text NOT NULL REFERENCES nodes(id),
  model text NOT NULL,
  vendor text NOT NULL DEFAULT 'SIMULATED',
  kind text NOT NULL
);

CREATE TABLE ports (
  id text PRIMARY KEY,
  equipment_id text NOT NULL REFERENCES equipment(id),
  name text NOT NULL,
  segment_id text REFERENCES cable_segments(id),
  speed_mbps bigint NOT NULL,
  admin_status text NOT NULL DEFAULT 'UP' CHECK (admin_status IN ('UP','DOWN')),
  oper_status text NOT NULL DEFAULT 'UP' CHECK (oper_status IN ('UP','DOWN'))
);

-- Inventory only in the MVP: wavelengths are listed but reservation happens at
-- the Mbps level on capacity_resources. No optical physics is modelled.
CREATE TABLE optical_channels (
  id text PRIMARY KEY,
  segment_id text NOT NULL REFERENCES cable_segments(id),
  channel_no integer NOT NULL,
  frequency_thz double precision NOT NULL,
  capacity_mbps bigint NOT NULL,
  note text NOT NULL DEFAULT 'SYNTHETIC inventory placeholder',
  UNIQUE (segment_id, channel_no)
);

-- Logical link capacity pool (1:1 with a segment in the MVP).
CREATE TABLE capacity_resources (
  id text PRIMARY KEY,
  segment_id text NOT NULL UNIQUE REFERENCES cable_segments(id),
  capacity_mbps bigint NOT NULL CHECK (capacity_mbps >= 0),
  reserved_mbps bigint NOT NULL DEFAULT 0,
  CONSTRAINT capacity_not_overbooked CHECK (reserved_mbps >= 0 AND reserved_mbps <= capacity_mbps)
);

-- ===================== Catalog & commercial =====================
CREATE TABLE products (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('EPL','EVPL','WAVE')),
  min_mbps bigint NOT NULL,
  max_mbps bigint NOT NULL,
  description text NOT NULL
);

CREATE TABLE sla_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  latency_ms double precision NOT NULL,      -- one-way
  jitter_ms double precision NOT NULL,
  loss_pct double precision NOT NULL,
  availability_pct double precision NOT NULL,
  note text NOT NULL DEFAULT 'DEMO profile — not a commercial commitment',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text
);

CREATE TABLE quotes (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers(id),
  product_id text NOT NULL REFERENCES products(id),
  sla_profile_id text NOT NULL REFERENCES sla_profiles(id),
  a_location_id text NOT NULL REFERENCES locations(id),
  b_location_id text NOT NULL REFERENCES locations(id),
  bandwidth_mbps bigint NOT NULL CHECK (bandwidth_mbps > 0),
  protection text NOT NULL CHECK (protection IN ('NONE','PROTECTED')),
  term_months integer NOT NULL CHECK (term_months > 0),
  route jsonb NOT NULL,
  currency text NOT NULL,
  price_monthly bigint NOT NULL,
  setup_fee bigint NOT NULL,
  breakdown jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('QUOTED','ACCEPTED','EXPIRED','WITHDRAWN')),
  valid_until timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL
);

CREATE TABLE orders (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers(id),
  quote_id text NOT NULL UNIQUE REFERENCES quotes(id),
  state text NOT NULL,
  state_reason text,
  payment_status text NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PAID_SIMULATED','REFUNDED_SIMULATED')),
  payment_ref text,
  deadline_at timestamptz,
  bandwidth_mbps bigint NOT NULL,
  protection text NOT NULL,
  price_monthly bigint NOT NULL,
  setup_fee bigint NOT NULL,
  currency text NOT NULL,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 0
);
CREATE INDEX orders_customer_idx ON orders(customer_id);

CREATE TABLE provider_suborders (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  provider_id text NOT NULL REFERENCES providers(id),
  state text NOT NULL CHECK (state IN ('PENDING','ACCEPTED','REJECTED','CLARIFICATION_REQUESTED','CANCELLED','TIMED_OUT')),
  segment_ids jsonb NOT NULL,
  wholesale_monthly bigint NOT NULL,
  setup_fee bigint NOT NULL,
  response_note text,
  deadline_at timestamptz NOT NULL,
  responded_at timestamptz,
  responded_by text,
  created_at timestamptz NOT NULL,
  UNIQUE (order_id, provider_id)
);

-- ===================== Services & orchestration =====================
CREATE TABLE services (
  id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE REFERENCES orders(id),
  customer_id text NOT NULL REFERENCES customers(id),
  name text NOT NULL,
  state text NOT NULL,
  oper_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (oper_status IN ('UP','DOWN','DEGRADED','UNKNOWN')),
  active_path text CHECK (active_path IN ('PRIMARY','PROTECTION','REROUTE')),
  bandwidth_mbps bigint NOT NULL,
  sla_profile_id text NOT NULL REFERENCES sla_profiles(id),
  protection text NOT NULL,
  auto_reroute boolean NOT NULL DEFAULT true,
  a_location_id text NOT NULL REFERENCES locations(id),
  b_location_id text NOT NULL REFERENCES locations(id),
  sim_handle text,
  monitoring boolean NOT NULL DEFAULT false,
  reroute_ready_tick bigint,             -- sim tick at which a pending reroute completes
  down_since_tick bigint,                -- sim tick the service last went DOWN (restoration time)
  activated_at timestamptz,
  activated_sim_tick bigint,
  created_at timestamptz NOT NULL
);

CREATE TABLE service_paths (
  id text PRIMARY KEY,
  service_id text NOT NULL REFERENCES services(id),
  role text NOT NULL CHECK (role IN ('PRIMARY','PROTECTION','REROUTE')),
  segment_ids jsonb NOT NULL,
  node_ids jsonb NOT NULL,
  latency_ms double precision NOT NULL,
  length_km double precision NOT NULL,
  status text NOT NULL CHECK (status IN ('PLANNED','ACTIVE','STANDBY','FAILED','RELEASED')),
  created_at timestamptz NOT NULL
);

CREATE TABLE reservations (
  id text PRIMARY KEY,
  capacity_resource_id text NOT NULL REFERENCES capacity_resources(id),
  segment_id text NOT NULL REFERENCES cable_segments(id),
  order_id text REFERENCES orders(id),
  service_id text REFERENCES services(id),
  fault_id text,
  mbps bigint NOT NULL CHECK (mbps > 0),
  role text NOT NULL CHECK (role IN ('PRIMARY','PROTECTION','REROUTE','FAULT')),
  status text NOT NULL CHECK (status IN ('HELD','COMMITTED','RELEASED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  released_at timestamptz,
  release_reason text
);
CREATE INDEX reservations_order_idx ON reservations(order_id);

CREATE TABLE provisioning_workflows (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  service_id text REFERENCES services(id),
  state text NOT NULL CHECK (state IN ('RUNNING','WAITING','COMPLETED','COMPENSATING','COMPENSATED','FAILED')),
  failure_reason text,
  outcome text,                       -- final order state applied after compensation
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE provisioning_tasks (
  id text PRIMARY KEY,
  workflow_id text NOT NULL REFERENCES provisioning_workflows(id),
  seq integer NOT NULL,
  type text NOT NULL,
  is_compensation boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK (state IN ('PENDING','RUNNING','WAITING','DONE','FAILED','SKIPPED')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  not_before timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  UNIQUE (workflow_id, seq)
);

CREATE TABLE service_tests (
  id text PRIMARY KEY,
  service_id text NOT NULL REFERENCES services(id),
  run_id text NOT NULL,
  test_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS','FAIL','NOT_RUN')),
  simulated boolean NOT NULL DEFAULT true,
  input jsonb NOT NULL,
  threshold jsonb,
  result jsonb,
  reason text NOT NULL,
  executed_at timestamptz NOT NULL
);

-- ===================== Simulation & assurance =====================
CREATE TABLE simulation_state (
  id integer PRIMARY KEY CHECK (id = 1),
  seed bigint NOT NULL,
  sim_epoch timestamptz NOT NULL,
  tick bigint NOT NULL DEFAULT 0,
  tick_seconds integer NOT NULL,
  auto_tick boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'DETERMINISTIC'
);

CREATE TABLE simulation_scenarios (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  steps jsonb NOT NULL
);

CREATE TABLE injected_faults (
  id text PRIMARY KEY,
  type text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('SEGMENT','NODE','PORT','PROVIDER','SERVICE','GLOBAL')),
  target_id text,
  params jsonb NOT NULL DEFAULT '{}',
  state text NOT NULL CHECK (state IN ('ACTIVE','RESTORED')),
  group_id text,                     -- correlated faults share a group (one incident)
  injected_tick bigint NOT NULL,
  restored_tick bigint,
  injected_by text,
  created_at timestamptz NOT NULL
);

CREATE TABLE telemetry_samples (
  id bigserial PRIMARY KEY,
  service_id text NOT NULL REFERENCES services(id),
  tick bigint NOT NULL,
  sim_time timestamptz NOT NULL,
  interval_s integer NOT NULL,
  latency_ms double precision,
  jitter_ms double precision,
  loss_pct double precision,
  throughput_mbps double precision,
  state text NOT NULL CHECK (state IN ('UP','DOWN','DEGRADED')),
  outage_cause text NOT NULL CHECK (outage_cause IN ('NONE','PROVIDER_NETWORK','SCHEDULED_MAINTENANCE','CUSTOMER_SIDE')),
  breaches jsonb NOT NULL DEFAULT '[]',
  active_path text,
  simulated boolean NOT NULL DEFAULT true,
  UNIQUE (service_id, tick)
);

CREATE TABLE sla_breaches (
  id text PRIMARY KEY,
  service_id text NOT NULL REFERENCES services(id),
  metric text NOT NULL CHECK (metric IN ('LATENCY','JITTER','LOSS','AVAILABILITY')),
  threshold double precision NOT NULL,
  peak_value double precision NOT NULL,
  started_tick bigint NOT NULL,
  ended_tick bigint,
  alarm_id text
);

CREATE TABLE incidents (
  id text PRIMARY KEY,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('CRITICAL','MAJOR','MINOR','WARNING')),
  state text NOT NULL CHECK (state IN ('OPEN','MITIGATED','RESOLVED')),
  fault_group text,
  opened_tick bigint NOT NULL,
  mitigated_tick bigint,
  resolved_tick bigint,
  impacted_services jsonb NOT NULL DEFAULT '[]',
  impacted_providers jsonb NOT NULL DEFAULT '[]',
  impacted_customers jsonb NOT NULL DEFAULT '[]',
  root_cause text,
  created_at timestamptz NOT NULL
);

CREATE TABLE incident_events (
  id bigserial PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id),
  tick bigint NOT NULL,
  kind text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE alarms (
  id text PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('CRITICAL','MAJOR','MINOR','WARNING','INFO')),
  type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  message text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE','CLEARED')),
  acknowledged boolean NOT NULL DEFAULT false,
  raised_tick bigint NOT NULL,
  cleared_tick bigint,
  incident_id text REFERENCES incidents(id),
  fault_id text,
  created_at timestamptz NOT NULL
);
CREATE INDEX alarms_state_idx ON alarms(state);

-- ===================== Settlement =====================
CREATE TABLE settlement_ledger (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  period text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('CUSTOMER_CHARGE','PROVIDER_ALLOCATION','PLATFORM_FEE','TAX','SETUP_CHARGE')),
  party_type text NOT NULL CHECK (party_type IN ('CUSTOMER','PROVIDER','PLATFORM','TAX_AUTHORITY')),
  party_id text,
  amount bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','SETTLED_SIMULATED','VOID')),
  basis jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

-- ===================== Integration (mock) =====================
CREATE TABLE sonata_messages (
  id text PRIMARY KEY,
  order_id text REFERENCES orders(id),
  provider_id text REFERENCES providers(id),
  direction text NOT NULL CHECK (direction IN ('OUTBOUND','INBOUND')),
  operation text NOT NULL,
  adapter_mode text NOT NULL CHECK (adapter_mode IN ('MOCK')),
  request jsonb NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL
);

-- ===================== Event log, audit, idempotency =====================
CREATE TABLE domain_events (
  id bigserial PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  correlation_id text,
  actor_id text,
  sim_tick bigint,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX domain_events_agg_idx ON domain_events(aggregate_type, aggregate_id);

CREATE VIEW order_events AS
  SELECT id, aggregate_id AS order_id, type, payload, correlation_id, actor_id, occurred_at
  FROM domain_events WHERE aggregate_type = 'order';

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  actor_id text,
  actor_role text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  outcome text NOT NULL CHECK (outcome IN ('ALLOWED','DENIED','ERROR')),
  details jsonb NOT NULL DEFAULT '{}',
  ip text,
  request_id text,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE idempotency_keys (
  user_id text NOT NULL,
  route text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  status_code integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, route, key)
);
`,
  },
  {
    // Provisioning is now scheduled node by node (live view). Existing databases
    // keep their other settings; the old per-segment key is renamed in place.
    id: '002_node_provisioning_delay',
    sql: /* sql */ `
UPDATE platform_settings SET key = 'provisioning_delay_s_per_node', value = '2'::jsonb
WHERE key = 'provisioning_delay_s_per_segment';
`,
  },
  {
    // NOC v2: device inventory per PoP (OTN + PE router + management switch),
    // interface attributes, IPAM, VLAN allocation, per-service network config,
    // device/port performance metrics and alarm-console fields.
    // Additive only; inventory rows are created by ensureInventoryV2() at startup.
    id: '003_noc_inventory_ipam_vlan_metrics',
    sql: /* sql */ `
ALTER TABLE equipment ADD COLUMN hostname text;
ALTER TABLE equipment ADD COLUMN role text;
ALTER TABLE equipment ADD COLUMN mgmt_ip text;
ALTER TABLE equipment ADD COLUMN loopback_ip text;
ALTER TABLE equipment ADD COLUMN os_version text;
ALTER TABLE equipment ADD COLUMN serial text;

ALTER TABLE ports ADD COLUMN kind text NOT NULL DEFAULT 'LINE';
ALTER TABLE ports ADD COLUMN peer_port_id text;
ALTER TABLE ports ADD COLUMN ip_address text;
ALTER TABLE ports ADD COLUMN mtu integer NOT NULL DEFAULT 9216;
ALTER TABLE ports ADD COLUMN description text;
ALTER TABLE ports ADD COLUMN mode text;

CREATE TABLE ip_pools (
  id text PRIMARY KEY,
  name text NOT NULL,
  cidr text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('MGMT','LOOPBACK','CUSTOMER_TEST')),
  prefix_len integer NOT NULL,
  note text NOT NULL DEFAULT 'SIMULATED address plan'
);

CREATE TABLE ip_allocations (
  id text PRIMARY KEY,
  pool_id text NOT NULL REFERENCES ip_pools(id),
  address text NOT NULL,
  assigned_type text NOT NULL CHECK (assigned_type IN ('DEVICE','PORT','SERVICE')),
  assigned_id text NOT NULL,
  service_id text REFERENCES services(id),
  description text,
  status text NOT NULL CHECK (status IN ('ALLOCATED','RELEASED')),
  created_at timestamptz NOT NULL,
  released_at timestamptz
);
CREATE UNIQUE INDEX ip_alloc_active_uq ON ip_allocations(pool_id, address) WHERE status = 'ALLOCATED';

CREATE TABLE vlan_allocations (
  id text PRIMARY KEY,
  equipment_id text NOT NULL REFERENCES equipment(id),
  port_id text REFERENCES ports(id),
  vlan_id integer NOT NULL CHECK (vlan_id BETWEEN 2 AND 4094),
  kind text NOT NULL CHECK (kind IN ('S_VLAN','C_VLAN','MGMT')),
  service_id text REFERENCES services(id),
  description text,
  status text NOT NULL CHECK (status IN ('ALLOCATED','RELEASED')),
  created_at timestamptz NOT NULL,
  released_at timestamptz
);
-- A VLAN id is used once per device for service (S-VLAN) / management purposes.
CREATE UNIQUE INDEX vlan_alloc_active_uq ON vlan_allocations(equipment_id, vlan_id) WHERE status = 'ALLOCATED' AND kind <> 'C_VLAN';

CREATE TABLE service_configs (
  id text PRIMARY KEY,
  service_id text NOT NULL REFERENCES services(id),
  equipment_id text NOT NULL REFERENCES equipment(id),
  port_id text REFERENCES ports(id),
  role text NOT NULL CHECK (role IN ('A_END','B_END','TRANSIT')),
  path_role text NOT NULL,
  s_vlan integer,
  c_vlan text,
  mtu integer,
  rendered_config text NOT NULL,
  status text NOT NULL CHECK (status IN ('APPLIED','REMOVED')),
  created_at timestamptz NOT NULL,
  removed_at timestamptz
);
-- One customer handoff (UNI) port carries one service at a time.
CREATE UNIQUE INDEX service_uni_port_uq ON service_configs(port_id) WHERE status = 'APPLIED' AND role <> 'TRANSIT';

-- Metrics are synthetic, regenerated every tick and pruned to a 24 h window:
-- UNLOGGED keeps them out of the WAL (PGlite never recycles WAL on its own).
-- After an unclean shutdown PostgreSQL empties UNLOGGED tables; graphs refill.
CREATE UNLOGGED TABLE device_metrics (
  equipment_id text NOT NULL REFERENCES equipment(id),
  tick bigint NOT NULL,
  reachable boolean NOT NULL,
  ping_ms double precision,
  ping_loss_pct double precision NOT NULL,
  cpu_pct double precision,
  mem_pct double precision,
  poll_ms double precision,
  PRIMARY KEY (equipment_id, tick)
);
CREATE INDEX device_metrics_tick_idx ON device_metrics(tick);

CREATE UNLOGGED TABLE port_metrics (
  port_id text NOT NULL REFERENCES ports(id),
  tick bigint NOT NULL,
  oper_status text NOT NULL,
  in_mbps double precision NOT NULL,
  out_mbps double precision NOT NULL,
  PRIMARY KEY (port_id, tick)
);
CREATE INDEX port_metrics_tick_idx ON port_metrics(tick);

ALTER TABLE alarms ADD COLUMN code integer;
ALTER TABLE alarms ADD COLUMN source_name text;
ALTER TABLE alarms ADD COLUMN location_info text;
ALTER TABLE alarms ADD COLUMN occurrence integer NOT NULL DEFAULT 1;
ALTER TABLE alarms ADD COLUMN acked_by text;
ALTER TABLE alarms ADD COLUMN acked_at timestamptz;
ALTER TABLE alarms ADD COLUMN cleared_by text;

CREATE TABLE alarm_comments (
  id bigserial PRIMARY KEY,
  alarm_id text NOT NULL REFERENCES alarms(id),
  author_id text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL
);
`,
  },
];
