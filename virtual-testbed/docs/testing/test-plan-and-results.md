# Test plan and results

Run date: 2026-10-23, Node 22.22.0, sandbox Linux. Commands in brackets.

## Results

| Check | Command | Result |
|---|---|---|
| Type check (server + web) | `npm run typecheck` | ✅ pass |
| Lint (ESLint + typescript-eslint) | `npm run lint` | ✅ pass |
| Unit + API + contract + scenario tests on **PGlite** | `npm test` | ✅ 65/65 (4 files, ~60 s) |
| Same suite on **PostgreSQL 16** (real concurrent transactions) | `npm run test:pg` | ✅ 65/65 |
| Production build (tsc + vite) | `npm run build` | ✅ pass |
| UI end-to-end (Playwright, Chromium, real background worker) | `npm run test:e2e` | ✅ 1/1 (~26 s; now also walks Alarm Logs, IPAM, device running-config, Device Map) |
| Dependency audit | `npm audit` | ✅ 0 vulnerabilities |
| OpenAPI generation | `npm run openapi:export` | ✅ 77 paths → `docs/api/openapi.json` |
| PGlite file persistence across restart | manual (sim tick 7 survived restart; 2026-10-23: tick 3000 + metrics survived) | ✅ |
| PGlite disk growth over 3,000 ticks | manual (`du` on data dir) | ✅ plateau ~122 MB, pg_wal ~6 MB (was 767 MB and growing before vacuum/checkpoint fix) |
| Production refuses default demo password | manual | ✅ |
| Docker Compose: config + `db` service + migrations/seed against it | manual | ✅ |
| Docker image build | `docker compose up --build` | ⚠️ **not verified** — Docker Hub returned 429 (rate limit) in the sandbox; earlier attempt's `npm ci` failed inside the container, most likely due to the sandbox HTTPS proxy. Needs a run on a normal Docker host. |
| Deployment on cPanel host | — | ⚠️ **not verified** (no access to the host) |

## Coverage of the brief's acceptance scenarios (`server/test/scenarios.test.ts`)

| Scenario | What is asserted |
|---|---|
| A — Jakarta–Ternate 1 Gbps | exact order transition sequence to ACTIVE; Sonata state `completed`; all activation tests non-FAIL and `simulated`; one COMMITTED 1000 Mbps reservation per primary span; capacity counters consistent; every task DONE with attempts, correlation id and `workflow:type` idempotency key. Plus: idempotent accept/pay replays don't double-charge. |
| B — Bali–Tokyo multi-provider | >1 sub-order, all ACCEPTED; path starts/ends at BAL/TYO; each provider's ledger allocation = its sub-order wholesale; charge = Σ allocations + fee; fee ≈ 10 % of charge (GROSS); provider sees only own ledger rows; one MOCK Sonata message per provider on the v11 base path. |
| C — insufficient capacity | 20 Gbps rejected `ROUTE_INSUFFICIENT_CAPACITY`, `maxFeasibleMbps=10000`, alternative is actually orderable; 3 concurrent 6 Gbps reservations on a 10 Gbps span → exactly 1 succeeds; two customers racing for the same bottleneck → one ACTIVE, one FAILED with refund and no residual reservation. |
| D — fiber cut | protected service switches to PROTECTION and stays UP; LOS + ON_PROTECTION alarms; incident MITIGATED with impacted service/customer; only the impacted customer sees the incident; restore → RESOLVED. Unprotected: DOWN → REROUTE_STARTED → restored after reroute delay with restoration seconds > 0, availability < 100 %, reverts to primary on repair, reroute capacity released. |
| E — provisioning failure | transitions `…RESOURCE_RESERVED → PROVISIONING → FAILED`; compensation tasks in reverse order; capacity returned exactly; sub-orders CANCELLED; payment REFUNDED_SIMULATED; no live ledger rows. Also: provider REJECT → REJECTED; provider API timeout → 3 attempts → FAILED (not stuck); customer cancel during acceptance → CANCELLED. |
| F — SLA breach & recovery | +25 ms → DEGRADED, open LATENCY breach with peak > 30 ms, alarm; after restore breach closed with duration exactly 5 ticks (300 s), alarm cleared, availability 100 %, degraded 300 s. Maintenance outage excluded from availability. |
| G — RBAC | cross-customer reads/pay/cancel → 404; provider can't modify another provider's span (403) but can its own; other owners' capacity hidden; customer can't inject faults or read topology; auditor can't mutate; NOC can't reset demo; anonymous → 401; denied attempts audited; cross-origin mutation → 403. |
| H — repeatability | full scripted run (2 orders, ticks, correlated failure, restore) → reset → rerun: telemetry, alarms and incidents byte-identical. |

`noc.test.ts` (NOC v2): seeded inventory (3 devices/PoP, IPAM pools, unique mgmt/loopback IPs); network-config allocation on activation (UNI port, common S-VLAN on both PEs, CE /30) and release + reuse on disconnect; 9th service at a PoP fails `NO_FREE_UNI_PORT` with full compensation; backfill of configs for services activated before migration 003; UNI `shutdown` takes the service DOWN with a PORT_DOWN alarm and `no shutdown` restores it; device/port metrics recorded per tick and DCN isolation of TTE yields DEVICE_UNREACHABLE + an outage window; alarm console ack/clear/comment/stats/CSV with RBAC (auditor read-only, customer denied).

Other suites: `unit.test.ts` (Yen ordering, objectives, diagnosis of every rejection reason, disjoint/SRLG protection, determinism, pricing in both fee bases, 300-case ledger balance property, availability exclusions, state-machine guards, telemetry determinism and loss composition, password hashing, RBAC auditor read-only) and `contract-and-api.test.ts` (Sonata mapper vs illustrative contract, negative contract cases, mock seller response contract + timeout fault, real adapter NOT CONNECTED, verified-state marking; OpenAPI coverage, X-Request-ID propagation, idempotency-key reuse 422, validation 400, login audit without password, cookie flags, integration status honesty, egress block, settings validation, login rate limit 429).

## Known gaps (not tested)
- Load/performance (NFR p95 targets) — not measured.
- NOC metrics (CPU, memory, ping, interface traffic) are a synthetic model, not validated against any real device; graphs are only as meaningful as that model (see `simulation-model.md`).
- Device Map layout and chart rendering verified by screenshots in Chromium only.
- Multi-instance deployment (scheduler assumes one process).
- Browser coverage beyond Chromium; accessibility audit beyond semantic roles used by the e2e test.
- Sonata conformance against the official schema (SDK not in repo — see `integration-gates.md` S1).
