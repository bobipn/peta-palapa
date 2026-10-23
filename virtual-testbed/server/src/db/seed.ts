import type { Db, Queryable } from './db.js';
import { truncateDemoData } from './migrate.js';
import {
  CABLE_SYSTEMS, CUSTOMERS, DEFAULT_SETTINGS, DEMO_USERS, LOCATIONS, PRODUCTS, PROVIDERS, SCENARIOS,
  SEGMENTS, SIMULATION_DEFAULTS, SLA_PROFILES,
} from './seed-data.js';
import { FIBER_MS_PER_KM, haversineKm, round, type Clock } from '../lib/util.js';
import { hashPassword } from '../lib/password.js';
import { ensureInventoryV2 } from '../modules/netconfig.js';

export const segId = (a: string, b: string) => `seg-${a}-${b}`;

export async function seed(db: Db, opts: { clock: Clock; demoPassword: string }) {
  const now = opts.clock.now();
  const pwHash = await hashPassword(opts.demoPassword);
  await db.tx(async (q) => {
    await seedOrgsAndUsers(q, now, pwHash);
    await seedTopology(q);
    await seedCatalog(q, now);
    await q.query(
      `INSERT INTO simulation_state (id, seed, sim_epoch, tick, tick_seconds, auto_tick) VALUES (1,$1,$2,0,$3,true)`,
      [SIMULATION_DEFAULTS.seed, SIMULATION_DEFAULTS.epoch, SIMULATION_DEFAULTS.tickSeconds],
    );
    for (const s of SCENARIOS) {
      await q.query(`INSERT INTO simulation_scenarios (id, code, name, description, steps) VALUES ($1,$2,$3,$4,$5)`, [
        `scn-${s.code.toLowerCase()}`, s.code, s.name, s.description, JSON.stringify(s.steps),
      ]);
    }
  });
  await ensureInventoryV2(db, opts.clock);
}

export async function resetDemo(db: Db, opts: { clock: Clock; demoPassword: string }) {
  await truncateDemoData(db);
  await seed(db, opts);
}

async function seedOrgsAndUsers(q: Queryable, now: Date, pwHash: string) {
  await q.query(`INSERT INTO organizations VALUES ('org-platform','C-Ring Market Virtual Testbed (DEMO platform)','PLATFORM',true,$1)`, [now]);
  for (const c of CUSTOMERS) {
    await q.query(`INSERT INTO organizations VALUES ($1,$2,'CUSTOMER',true,$3)`, [c.org, c.name, now]);
    await q.query(`INSERT INTO customers VALUES ($1,$2,$3)`, [c.id, c.org, c.name]);
  }
  for (const p of PROVIDERS) {
    await q.query(`INSERT INTO organizations VALUES ($1,$2,'PROVIDER',true,$3)`, [`org-${p.id}`, p.name, now]);
    await q.query(
      `INSERT INTO providers (id, org_id, code, name, eligible, auto_accept, acceptance_delay_s, is_demo) VALUES ($1,$2,$3,$4,true,$5,$6,true)`,
      [p.id, `org-${p.id}`, p.code, p.name, p.autoAccept, p.delayS],
    );
  }
  for (const u of DEMO_USERS) {
    await q.query(`INSERT INTO users (id,email,display_name,password_hash,role,org_id,active,created_at) VALUES ($1,$2,$3,$4,$5,$6,true,$7)`, [
      u.id, u.email, u.name, pwHash, u.role, u.org, now,
    ]);
  }
}

async function seedTopology(q: Queryable) {
  const loc = new Map<string, (typeof LOCATIONS)[number]>(LOCATIONS.map((l) => [l.id, l]));
  for (const l of LOCATIONS) {
    await q.query(`INSERT INTO locations VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      l.id, l.city, l.cc, l.country, l.lat, l.lon, 'Approximate public city-centre coordinates; not a facility location',
    ]);
    await q.query(`INSERT INTO pops VALUES ($1,$2,$3,$4,true)`, [`pop-${l.id}`, l.id, `${l.id.toUpperCase()}-${l.kind === 'DATA_CENTER' ? 'DC' : l.kind === 'LANDING_STATION' ? 'CLS' : 'POP'}1 (SIM)`, l.kind]);
    await q.query(`INSERT INTO nodes VALUES ($1,$2,$3,'OTN','UP','UP')`, [`nd-${l.id}`, `pop-${l.id}`, `${l.id.toUpperCase()}-OTN-01 (SIM)`]);
    await q.query(`INSERT INTO equipment VALUES ($1,$2,'SIM-OTN-X100','SIMULATED','OTN_SWITCH')`, [`eq-${l.id}`, `nd-${l.id}`]);
  }
  const sys = new Map<string, (typeof CABLE_SYSTEMS)[number]>(CABLE_SYSTEMS.map((s) => [s.id, s]));
  for (const s of CABLE_SYSTEMS) {
    await q.query(`INSERT INTO cable_systems VALUES ($1,$2,$3,$4,true)`, [s.id, s.name, s.provider, s.kind]);
  }
  for (const [a, b, sysId, capGbps, price, srlg] of SEGMENTS) {
    const s = sys.get(sysId)!;
    const la = loc.get(a)!;
    const lb = loc.get(b)!;
    const factor = s.kind === 'SUBSEA' ? 1.3 : 1.25;
    const lengthKm = round(haversineKm(la.lat, la.lon, lb.lat, lb.lon) * factor, 1);
    const id = segId(a, b);
    await q.query(
      `INSERT INTO cable_segments (id, cable_system_id, provider_id, a_node_id, b_node_id, length_km, base_latency_ms, base_jitter_ms, base_loss_pct, price_per_gbps_month, setup_fee, srlg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id, sysId, s.provider, `nd-${a}`, `nd-${b}`, lengthKm,
        round(lengthKm * FIBER_MS_PER_KM, 3),
        round(0.05 + lengthKm * 0.00004, 3),
        round(0.0001 + lengthKm * 1e-7, 6),
        price, 5_000_000, srlg ?? null,
      ],
    );
    await q.query(`INSERT INTO capacity_resources VALUES ($1,$2,$3,0)`, [`cap-${id}`, id, capGbps * 1000]);
    for (const end of [a, b]) {
      await q.query(`INSERT INTO ports VALUES ($1,$2,$3,$4,100000,'UP','UP')`, [`pt-${end}-${id}`, `eq-${end}`, `line-${end === a ? b : a}`, id]);
    }
    const channels = Math.max(1, Math.ceil(capGbps / 100));
    for (let c = 0; c < channels; c++) {
      await q.query(`INSERT INTO optical_channels (id, segment_id, channel_no, frequency_thz, capacity_mbps) VALUES ($1,$2,$3,$4,$5)`, [
        `och-${id}-${c + 1}`, id, c + 1, round(191.35 + c * 0.05, 2), Math.min(100, capGbps - c * 100) * 1000,
      ]);
    }
  }
}

async function seedCatalog(q: Queryable, now: Date) {
  for (const p of PRODUCTS) {
    await q.query(`INSERT INTO products VALUES ($1,$2,$3,$4,$5,$6,$7)`, [p.id, p.code, p.name, p.type, p.min, p.max, p.desc]);
  }
  for (const s of SLA_PROFILES) {
    await q.query(`INSERT INTO sla_profiles (id,name,latency_ms,jitter_ms,loss_pct,availability_pct) VALUES ($1,$2,$3,$4,$5,$6)`, [
      s.id, s.name, s.latency, s.jitter, s.loss, s.avail,
    ]);
  }
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await q.query(`INSERT INTO platform_settings VALUES ($1,$2,$3,'seed')`, [k, JSON.stringify(v), now]);
  }
}
