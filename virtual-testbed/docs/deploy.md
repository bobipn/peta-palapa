# Deployment

Target: `virtual.komersiallti.my.id`. The app is one Node.js (≥ 20.11) process serving API + SPA on `PORT`.

## Option A — cPanel "Setup Node.js App" (Phusion Passenger), no database server

**Status: not verified on the real host.** Check first: does the hosting plan offer *Setup Node.js App*, Node ≥ 20, and enough memory? Measured RSS with PGlite after a full demo flow: **~450 MB** (2026-10-21, this sandbox). Many shared plans cap processes at 512 MB–1 GB; if the app is killed, use Option B or C.

1. cPanel → Subdomains: create `virtual.komersiallti.my.id`.
2. cPanel → Setup Node.js App → Create: Node 22 (or newest ≥ 20), Application root e.g. `cring-virtual` (**outside `public_html`**), Application URL = the subdomain, startup file `app.cjs`.
3. Environment variables (same screen):
   ```
   NODE_ENV=production
   DATABASE_URL=pglite:///home/<cpanel-user>/cring-virtual-data
   DEMO_PASSWORD=<choose a strong one>
   COOKIE_SECURE=true
   TRUST_PROXY=true
   AUTO_TICK_MS=5000
   ```
4. Upload the bundle: run the GitHub workflow **Deploy virtual testbed (manual)** (secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `VIRTUAL_FTP_DIR=/cring-virtual/`), or build locally (`npm ci && npm run build`) and upload `dist/`, `package.json`, `package-lock.json`, `.npmrc`, `app.cjs`.
5. Setup Node.js App → *Run NPM Install* → *Restart*. Check `https://virtual.komersiallti.my.id/api/health`.
6. Optional hardening for a public demo: password-protect the subdomain (cPanel Directory Privacy) or IP-allow-list it, because demo credentials are shared.

The static site's FTP workflow (`deploy.yml`) excludes `virtual-testbed/**`, so the two deployments never overlap.

## Option B — VPS with Docker Compose (PostgreSQL 16)

```bash
cd virtual-testbed
DEMO_PASSWORD=<strong> docker compose up --build -d
```
Put a TLS reverse proxy (Caddy/Nginx) in front for `virtual.komersiallti.my.id` → `localhost:8080`, then set `COOKIE_SECURE=true` and `TRUST_PROXY=true` in `docker-compose.yml`.
**Validation status:** `docker compose config` and the `db` service were validated (migrations + seed ran against it); the app image build could not be completed in the build sandbox (Docker Hub rate limit 429), so `Dockerfile` is unverified end-to-end.

## Option C — VPS/bare Node with managed PostgreSQL
`DATABASE_URL=postgres://…` then `npm ci && npm run build && npm start` under systemd/pm2. Migrations run automatically at start; seeding happens only if the database is empty.

**Disk usage (PGlite).** PGlite runs PostgreSQL in single-user mode: no autovacuum, no background checkpointer, and `postgresql.conf` is not applied. Before this release the WAL (`pg_wal/`) was never recycled and grew with every tick (measured: 767 MB after 3,000 ticks). The app now vacuums churned tables and issues `CHECKPOINT` every 30 ticks, and keeps the synthetic metrics tables `UNLOGGED`. Measured after the fix (2026-10-23, no active services): data directory plateaus at ~122 MB, `pg_wal` ~6 MB, RSS ~430 MB. Still unbounded: `telemetry_samples` (one row per active service per tick, ~17k rows/service/day at `AUTO_TICK_MS=5000`) — use *Reset simulation* periodically on a long-running demo. After an unclean kill, PostgreSQL empties UNLOGGED tables: the Performance graphs restart empty; nothing else is lost.

## Upgrading an existing install
Overwrite the app files (keep the PGlite data directory / database), *Run NPM Install*, then **Restart** — the server serves the SPA files it found at start, so without a restart the browser gets a blank page. Migrations run at start; migration 003 (NOC layer) is additive and `ensureInventoryV2` back-fills devices, IPs and network configs for services that were already ACTIVE. Existing orders and services are kept.

## Operations
- Health: `GET /api/health`. Logs: JSON (pino) to stdout, cookies/passwords redacted.
- Reset demo data: Admin → Simulation Lab → *Full demo reset*, or `npm run db:reset-demo` (keeps schema + migration history).
- Backups (PGlite): copy the data directory while the app is stopped. (Postgres): `pg_dump`.
