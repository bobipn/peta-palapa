# C-Ring Market — Digital Twin & Virtual Network Testbed

A runnable simulation of a connectivity marketplace **and** the network behind it: customer search → quote → simulated payment → provider sub-orders → transactional capacity reservation → orchestrated virtual provisioning → activation tests → SLA monitoring → fault injection → protection/reroute → incidents → recovery → settlement.

> **Everything is SIMULATED.** Providers ("Alpha…Echo (DEMO)"), cable systems (`SIM-…`), capacities, prices, payments, telemetry and SLA targets are synthetic. Nothing connects to real devices, provider APIs, payment gateways or billing. Outbound HTTP is blocked by default.

Target deployment: `virtual.komersiallti.my.id` (see [docs/deploy.md](docs/deploy.md)).

## Quick start

```bash
cd virtual-testbed
npm ci
npm run build
DEMO_PASSWORD=demo-cring-2026 npm start        # in-memory Postgres (PGlite), http://localhost:8080
```
Other modes:
- Persistent without a DB server: `DATABASE_URL=pglite:///abs/path/data`
- Real PostgreSQL: `DATABASE_URL=postgres://user:pass@host:5432/db`
- Docker Compose (app + Postgres 16): `DEMO_PASSWORD=… docker compose up --build`
- Development with hot reload: `npm run dev` (API :8080, Vite :5173 with proxy)

### Demo users
Password = `DEMO_PASSWORD` (default `demo-cring-2026` locally; the server **refuses to start in production with the default**).

| Email | Role |
|---|---|
| customer.a@demo.local / customer.b@demo.local | Customer (two separate buyers) |
| alpha@ / bravo@ / charlie@ / echo@demo.local | Cable owner (auto-accept) |
| delta@demo.local | Cable owner (manual acceptance) |
| noc@demo.local | NOC |
| commercial@demo.local | Commercial operations |
| auditor@demo.local | Auditor (read-only) |
| admin@demo.local | Platform administrator |

## Scripts
| | |
|---|---|
| `npm test` / `npm run test:pg` | 54 unit, API, contract and scenario A–H tests on PGlite / on PostgreSQL (`TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright UI flow (needs `npm run build`) |
| `npm run typecheck` · `npm run lint` | static checks |
| `npm run db:migrate` · `db:seed` · `db:reset-demo` | schema / seed / reset demo data (schema + migration history kept) |
| `npm run openapi:export` | writes `docs/api/openapi.json` (live Swagger UI at `/api/docs`) |

## Documentation
- [Repository audit & risks](docs/architecture/current-state.md)
- [Architecture, state machines, data model, security](docs/architecture/architecture.md)
- [Simulation assumptions & limitations](docs/architecture/simulation-model.md)
- [Mode B (Containerlab / Mininet-Optical) evaluation](docs/architecture/mode-b-emulation.md)
- [Roadmap & integration gates before any real network](docs/architecture/integration-gates.md)
- [Test plan & results](docs/testing/test-plan-and-results.md)
- [Panduan pengguna (user manual, ID)](docs/user-manual.md)
- [Demo walkthrough](docs/demo-walkthrough.md)
- [Deployment](docs/deploy.md)

## Layout
```
server/src/domain      pure logic: routing (Yen + disjoint pairs), pricing/ledger, SLA, state machines, telemetry model, RBAC
server/src/modules     DB-backed modules: topology, capacity, quotes, orders, providers, orchestrator, assurance, settlement, auth,
                       simulation/ (adapter interface, Mode A engine, Mode B stubs), sonata/ (canonical model, mapper, MOCK seller)
server/src/http        Fastify app, guards, idempotency, routes (OpenAPI)
server/src/db          migrations, seed (synthetic topology), pg/PGlite adapter
server/test            unit, contract/API, scenarios A–H
web/src                React SPA (17 menus incl. alarm console, Device Map, Performance, IPAM & VLAN), SVG topology map
e2e/                   Playwright
```

## Known limitations (summary)
Route engine is an MVP heuristic, not carrier-grade PCE · no optical physics (OSNR/power) · Sonata mapping is illustrative, no conformance claim · single-process scheduler · platform-fee basis and tax are DEMO configuration, not agreed commercial terms · Docker image build and cPanel deployment not verified from the build sandbox.
