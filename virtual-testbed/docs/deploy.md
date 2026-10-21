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

## Operations
- Health: `GET /api/health`. Logs: JSON (pino) to stdout, cookies/passwords redacted.
- Reset demo data: Admin → Simulation Lab → *Full demo reset*, or `npm run db:reset-demo` (keeps schema + migration history).
- Backups (PGlite): copy the data directory while the app is stopped. (Postgres): `pg_dump`.
