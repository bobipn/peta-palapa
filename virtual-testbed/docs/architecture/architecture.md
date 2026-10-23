# Architecture

## 1. Shape

A **modular monolith**: one Node.js process serves the REST API, the background workers and the built SPA. Domain boundaries are module boundaries, not network boundaries.

```
web/ (React SPA)  ──HTTP/JSON──►  server/src/http (Fastify: auth, RBAC guard, validation, idempotency, OpenAPI)
                                        │
        ┌───────────────┬───────────────┼────────────────┬─────────────────┬──────────────┐
   marketplace      orders &         orchestrator     network inventory   simulation      assurance
   (quotes.ts)      providers        (workflow,       (topology.ts,       (adapter.ts,    (assurance.ts:
   pricing.ts       (orders.ts,      tasks, retry,    capacity.ts)        engine.ts,      SLA, alarms,
   routing.ts       providers.ts,    compensation)                        deterministic,  incidents, NOC)
                    settlement.ts)        │                               external-stubs)
                                          ├──► NetworkSimulationAdapter (Mode A; Mode B stubs)
                                          └──► SonataMockSeller (MOCK; real adapter = NOT CONNECTED)
        all modules ──► Queryable (pg | PGlite) ──► PostgreSQL schema (migrations.ts)
                    ──► domain_events (event log) + audit_events (audit trail)
```

`server/src/domain/*` is pure logic (no I/O) and carries most unit tests: routing, pricing, SLA, state machines, telemetry model, RBAC.

### ADR-1 — Fastify + React/Vite instead of Next.js + NestJS
The brief's baseline is Next.js (+ NestJS or FastAPI). Chosen instead: Fastify backend + Vite SPA in **one** deployable.
- The UI is an authenticated dashboard; server-side rendering/SEO adds nothing.
- The likely target is a cPanel Node.js app (one Passenger process). Two processes (Next + Nest) or a Next standalone server are heavier to host there.
- Fastify + TypeBox yields OpenAPI from the same schemas used for validation.
- Trade-off: no Next.js conventions; if C-Ring Market later standardises on Next.js (PRD L1), the SPA pages can move with little change because they only call the REST API.

### ADR-2 — PostgreSQL, two engines
All SQL targets PostgreSQL 16. `pg` for a real server, `@electric-sql/pglite` (Postgres in WASM) for zero-dependency runs. Scenario tests pass on both (see test results). PGlite is single-connection: transactions serialise, which is safe but does not reproduce real concurrency — the concurrent-reservation test is therefore also run against real Postgres.

### ADR-3 — Business order state ≠ network service state
`orders.state` (commercial lifecycle) and `services.state` / `services.oper_status` (network lifecycle) live in different tables with separate state machines (`domain/state-machines.ts`). Only the orchestrator moves both, task by task.

## 2. State machines

**Quote:** `QUOTED → ACCEPTED | EXPIRED | WITHDRAWN`. Quotes are their own aggregate (mirrors Sonata Quote vs ProductOrder), so the order starts at `PENDING_PAYMENT` rather than DRAFT/QUOTED.

**Order:**
```
PENDING_PAYMENT ─pay─► CONFIRMED ─► PROVIDER_ACCEPTANCE ─► RESOURCE_RESERVED ─► PROVISIONING ─► TESTING ─► ACTIVE ─► DISCONNECTED
      │                   │                │                       │                 │             │
      └─timeout/cancel─► CANCELLED ◄──cancel──┴──────cancel─────────┘                 │             │
                          FAILED ◄──────────┴── failure (compensation) ───────────────┴─────────────┘
                          REJECTED ◄── provider rejects
```
Every non-terminal state has an exit by timeout or failure: payment window, acceptance deadline, task max-attempts, hold TTL sweeper. Customer cancel is allowed until `RESOURCE_RESERVED` (nothing built yet).

**Service:** `DESIGNED → RESERVED → PROVISIONING → CONFIGURED → TESTING → ACTIVE → DECOMMISSIONED` (+ `FAILED`). Operational status (`UP/DEGRADED/DOWN`) and active path (`PRIMARY/PROTECTION/REROUTE`) are separate fields driven by the simulator.

**Sonata mapping (illustrative):** `PENDING_PAYMENT..PROVIDER_ACCEPTANCE → acknowledged`, `RESOURCE_RESERVED..TESTING → inProgress`, `ACTIVE → completed`, `CANCELLED → cancelled` (these four are REA-verified enum values). `REJECTED → rejected`, `FAILED → failed` are marked **unverified**.

## 3. Capacity reservation (correctness core)

`modules/capacity.ts::reserve` increments `capacity_resources.reserved_mbps` with a conditional `UPDATE … WHERE reserved + x <= capacity`, segments in sorted order, all inside the caller's transaction. In PostgreSQL the UPDATE row-locks and re-checks the predicate after concurrent commits, so concurrent orders cannot jointly exceed capacity; a `CHECK (reserved_mbps <= capacity_mbps)` constraint backs it up. Reservations are `HELD` (with TTL) at payment, `COMMITTED` after all providers accept, `RELEASED` on compensation/termination. A validation test asserts that counters equal the sum of active reservations.

Holding capacity at payment — before provider acceptance — is deliberate: otherwise capacity could be sold twice during the acceptance window.

## 4. Orchestration workflow

Activation tasks: `VALIDATE_REQUEST, COMPUTE_ROUTE (re-validate quoted path), RESERVE_CAPACITY, CREATE_SUBORDERS (Sonata mock), AWAIT_PROVIDER_ACCEPTANCE, COMMIT_RESERVATION, PROVISION_VIRTUAL, CONFIGURE_SERVICE, RUN_ACTIVATION_TESTS, ACTIVATE_SERVICE, START_MONITORING`.

Compensation (generated in reverse from what was touched): `DEPROVISION_VIRTUAL, RELEASE_CAPACITY, CANCEL_SUBORDERS, REFUND_PAYMENT_SIMULATED, FINALIZE_ORDER`. Each task row stores state, attempts/max, `not_before`, timestamps, result, error, `correlation_id` and a unique `idempotency_key = <workflow>:<type>`. Handlers are idempotent so a task left `RUNNING` by a crash is safely re-run at startup. If a compensation step itself fails, the workflow stops in `FAILED` for manual intervention instead of looping.

## 5. Data model (tables)

Identity: `organizations, users, sessions, customers, providers`.
Inventory: `locations, pops, nodes, cable_systems, cable_segments (physical span: length), equipment, ports, optical_channels (inventory only), capacity_resources (logical link capacity, 1:1 with span in MVP), reservations`.
Commercial: `products, sla_profiles, platform_settings, quotes, orders, provider_suborders, settlement_ledger`.
Service & orchestration: `services, service_paths, provisioning_workflows, provisioning_tasks, service_tests`.
NOC (migration 003): `ip_pools, ip_allocations, vlan_allocations, service_configs, device_metrics, port_metrics, alarm_comments` + equipment hostname/role/mgmt_ip/loopback_ip, port kind/ip/mtu/mode, alarm code/source/occurrence/ack.
Simulation & assurance: `simulation_state, simulation_scenarios, injected_faults, telemetry_samples, sla_breaches, alarms, incidents, incident_events`.
Integration & audit: `sonata_messages, domain_events (+ view order_events), audit_events, idempotency_keys`.

Distinctions required by the brief are kept as separate attributes/tables: geographic location (`locations`, approximate city coordinates) ≠ physical span (`cable_segments.length_km`) ≠ logical capacity (`capacity_resources`) ≠ virtual service instance (`services.sim_handle`) ≠ customer service (`services`). Length, capacity, latency, availability and cost are independent columns.

Demo reset (`POST /api/admin/reset-demo`, `npm run db:reset-demo`) truncates data tables and re-seeds; `schema_migrations` and the schema are untouched.

## 6. Events and audit

- `domain_events`: order state changes, sub-order responses, payments, workflow/task transitions, service activation/down/restored/protection switch/reroute, SLA breach start/end, fault injected/restored, simulation reset. Correlation id = request id (`X-Request-ID`) or workflow correlation id.
- `audit_events`: logins (success and denied), every mutating admin/provider/NOC/commercial action, and **denied** permission attempts. Passwords and session tokens are never logged (session ids are stored as SHA-256 hashes; Fastify logger redacts cookies and `password`).

## 7. Security controls

| Control | Implementation |
|---|---|
| AuthN | scrypt password hashes; random 256-bit session token in `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie; server-side session with expiry |
| AuthZ | permission matrix (`domain/rbac.ts`) checked in a backend pre-handler on every route + row-level scoping in queries (customer → own; provider → own assets/sub-orders/allocations). Unknown rows return 404 (no existence leak). |
| CSRF | SameSite=Lax + cross-origin `Origin` rejection on mutations |
| Input | TypeBox schemas on every body/param/query; 256 KB body limit |
| Rate limiting | global 600/min/IP; login 10/min/IP |
| Idempotency | `Idempotency-Key` on quote/accept/pay; key reuse with different body → 422 |
| Egress | `fetch` wrapped default-deny; only localhost/allow-listed hosts |
| Simulation safety | Fault injection only touches simulator tables; no endpoint talks to devices or providers |
| Headers | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, `X-Simulation: true` |
| Production guard | refuses to start with the default demo password |
| Dependencies | `npm audit` = 0 vulnerabilities at build time (2026-10-21) |
