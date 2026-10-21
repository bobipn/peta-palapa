/** Writes the generated OpenAPI document to docs/api/openapi.json (run: npm run openapi:export). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadConfig } from './config.js';
import { buildApp } from './http/app.js';

const config = { ...loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv), databaseUrl: 'pglite://memory' };
const { app } = await buildApp(config);
await app.ready();
mkdirSync('docs/api', { recursive: true });
writeFileSync('docs/api/openapi.json', JSON.stringify(app.swagger(), null, 2) + '\n');
console.log('wrote docs/api/openapi.json with', Object.keys((app.swagger() as any).paths).length, 'paths');
await app.close();
