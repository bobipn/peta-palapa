import { loadConfig } from './config.js';
import { buildApp } from './http/app.js';

const config = loadConfig();
const { app } = await buildApp(config);
await app.listen({ host: config.host, port: config.port });
app.log.info(`C-Ring virtual testbed (SIMULATED) listening on ${config.host}:${config.port} — db=${config.databaseUrl.split(':')[0]}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
