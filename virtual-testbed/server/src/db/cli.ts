import { loadConfig } from '../config.js';
import { systemClock } from '../lib/util.js';
import { openDb } from './db.js';
import { migrate } from './migrate.js';
import { resetDemo, seed } from './seed.js';

const cmd = process.argv[2];
const config = loadConfig();
const db = await openDb(config.databaseUrl);
try {
  if (cmd === 'migrate') console.log('applied:', await migrate(db));
  else if (cmd === 'seed') {
    await migrate(db);
    const n = (await db.query(`SELECT count(*)::int AS n FROM organizations`)).rows[0].n;
    if (n > 0) console.log('already seeded; use reset-demo to re-seed');
    else await seed(db, { clock: systemClock, demoPassword: config.demoPassword });
  } else if (cmd === 'reset-demo') {
    await migrate(db);
    await resetDemo(db, { clock: systemClock, demoPassword: config.demoPassword });
    console.log('demo data reset (schema and migration history kept)');
  } else {
    console.error('usage: cli.ts migrate|seed|reset-demo');
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
