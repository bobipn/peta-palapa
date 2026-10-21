import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// In the managed sandbox a pre-installed Chromium lives at /opt/pw-browsers/chromium;
// elsewhere Playwright's own browser is used.
const sandboxChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    screenshot: 'only-on-failure',
    launchOptions: existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node dist/server/src/index.js',
        cwd: '..',
        url: 'http://localhost:8080/api/health',
        reuseExistingServer: true,
        env: { NODE_ENV: 'development', DATABASE_URL: 'pglite://memory', PORT: '8080', DEMO_PASSWORD: 'demo-cring-2026' },
      },
});
