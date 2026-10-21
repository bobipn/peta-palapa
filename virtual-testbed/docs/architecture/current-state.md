# Current state — repository audit (Phase 0)

Audit date: 2026-10-21. Branch: `claude/cring-digital-twin`.

## 1. What the repository was before this work

| Item | Finding (observed) |
|---|---|
| Purpose | `peta-palapa` = static portal for Palapa Ring Tengah / LTI commercial team (`index.html`, `peta.html`, `crm.html`, `sales.html`, `sop.html`, `komersial.html`, `dokumen.html`). |
| Stack | Single-file HTML pages; React 18 + Tailwind loaded from CDNs at runtime; no package manager, no build, no tests. |
| Backend | None in repo. `cloudflare-chat-worker/` is a separate Cloudflare Worker for chat. `api` is a 1-byte placeholder file. |
| Database | None. Pages keep login/session state in `localStorage` (client-side gate, not real auth). |
| Deploy | `.github/workflows/deploy.yml`: on every push to `main`, FTP-sync the **entire repo root** to cPanel `/` (LiteSpeed, `.htaccess` security headers). |
| CI | CodeQL workflow. |
| C-Ring Market? | **No.** The C-Ring Market platform (`market.komersiallti.my.id`, PRD §2.1) is not in this repository. Nothing here exposes its API, schema or auth. |

## 2. Consequences for the integration plan

1. **Greenfield app, isolated in `virtual-testbed/`.** No existing feature is touched. The only change to existing files is the FTP deploy exclusion (below).
2. **Deploy hazard found and fixed.** Without an exclusion, pushing this app to `main` would have FTP-uploaded server source, lockfiles and docs into the public web root of `komersiallti.my.id`. `deploy.yml` now excludes `virtual-testbed/**` (and re-states the action's default excludes, because setting `exclude` overrides them).
3. **Target host is cPanel (LiteSpeed) — inferred from `.htaccess` and the FTP workflow.** Shared cPanel hosting typically cannot run Docker and may not offer a PostgreSQL server. That conflicts with the brief's "PostgreSQL + Docker Compose" baseline, so the app supports both:
   - `DATABASE_URL=postgres://…` — real PostgreSQL (Docker Compose, VPS, managed DB);
   - `DATABASE_URL=pglite:///path` — PostgreSQL compiled to WASM, in-process, persisted to a directory. Same SQL, same migrations. Lets the demo run on a cPanel Node.js app. **Needs verification on the actual hosting plan** (Node.js App availability, Node version ≥ 20, memory limit).
4. **No C-Ring backend to integrate with.** The PRD references a Cantata-like internal backend; it was not available, so the marketplace in this testbed is self-contained and the Sonata boundary is a MOCK adapter only.

## 3. Inputs reviewed

| Source | Type | Used for | Caveat |
|---|---|---|---|
| `LSO-SDK-analisis.md` (user REA, 2026-10-21) | Primary analysis of 4 local SDK zips | Sonata base path/version, endpoint list, state enum (`acknowledged → inProgress → completed`), quote-ref requirement `[id, quoteId]`, billing read-only, placeholder tokenUrl, operationId defect | The SDK files themselves are **not** in this repo; nothing could be re-verified here. |
| `prd-adaptasi-mplify-cring-market.pdf` v1.0 | PRD (synthesis) | Target vocabulary, state machine, X-Request-ID + Idempotency-Key (NFR-016), camelCase operationIds (NFR-012), deprecation/status-page goals | Mixes verified REA facts with public research and targets; KPI targets and some vendor/standards claims are not verified here. |

## 4. Decisions taken under uncertainty (safe defaults, configurable)

| Decision | Default | Where to change |
|---|---|---|
| Stack | Fastify + TypeScript modular monolith, React/Vite SPA served by the same process (one deployable) | — (ADR in `architecture.md`) |
| Database engine | `pglite://memory` in dev/test, Postgres in Compose | `DATABASE_URL` |
| Currency | IDR (PRD NG3: IDR-only in year 1) | `platform_settings.currency` |
| Platform fee | 10 % on GROSS customer price, labelled DEMO / basis not agreed | Settings → Platform fee |
| Tax | 0 % (disabled — Indonesian VAT base/rate need finance verification) | `platform_settings.tax` |
| Timeouts | payment 30 min, provider acceptance 10 min, capacity hold 30 min, quote 7 days | Settings |
| Protection | 1+1, non-revertive, 50 ms switch (simulated) | Settings |
| Demo password | refuses default in `NODE_ENV=production` | `DEMO_PASSWORD` |

## 5. Implementation plan (as executed)

Phases 0–8 of the brief were executed in order; see `../testing/test-plan-and-results.md` for what was verified at each step and `integration-gates.md` for what remains before any real-network connection.

## 6. Technical risks

| # | Risk | Impact | Mitigation in this build | Residual |
|---|---|---|---|---|
| T1 | cPanel host cannot run the app (no Node.js App / old Node / low memory) | Demo not deployable at `virtual.komersiallti.my.id` | No native deps; PGlite option; Passenger shim `app.cjs`; Docker path for a VPS | **Unverified** — check hosting plan |
| T2 | Synthetic numbers mistaken for real capacity/price/SLA | Commercial/reputational | `SIMULATED` labels on every page, DEMO names, disclaimers in API (`X-Simulation: true`) | Screenshots can be cropped; brief the audience |
| T3 | Sonata mapping mistaken for conformance | Wrong integration assumptions | Contract is labelled illustrative; only REA-verified enum values marked verified | Must be audited against the real SDK YAML |
| T4 | Single-process scheduler | Double execution if scaled horizontally | In-process lock; persisted idempotency keys | Needs `SKIP LOCKED` or a broker before >1 instance |
| T5 | Public demo with shared demo credentials | Anyone can reset data | Login rate limit, audit trail, password from env | Put the subdomain behind HTTP auth / IP allow-list if needed |
| T6 | Route engine heuristics | Suboptimal/missed diverse paths in trap topologies | Documented limitation; k=12 candidates | Not carrier-grade PCE |
