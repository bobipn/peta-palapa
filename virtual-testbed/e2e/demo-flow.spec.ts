/**
 * UI end-to-end: order -> provisioning -> active service -> fault -> incident -> recovery.
 * Requires a built app (npm run build). Uses the real background worker (no test hooks).
 */
import { expect, test, type Page } from '@playwright/test';

const PW = process.env.DEMO_PASSWORD ?? 'demo-cring-2026';
const shots = process.env.E2E_SHOTS_DIR;

async function login(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}
const snap = (page: Page, name: string) => (shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) : Promise.resolve());

test('customer orders Jakarta–Ternate 1 Gbps 1+1 and NOC handles a fiber cut', async ({ page, request }) => {
  // Clean slate.
  const adminLogin = await request.post('/api/auth/login', { data: { email: 'admin@demo.local', password: PW } });
  expect(adminLogin.ok()).toBeTruthy();
  await request.post('/api/admin/reset-demo');

  await login(page, 'customer.a@demo.local');
  await snap(page, '01-overview-customer');
  await page.getByRole('link', { name: 'Marketplace' }).click();
  await page.getByLabel('B-end').selectOption('tte');
  await page.getByLabel('Protection').selectOption('PROTECTED');
  await page.getByRole('button', { name: 'Search routes' }).click();
  await expect(page.getByText(/Candidate routes/)).toBeVisible();
  await snap(page, '02-marketplace-candidates');
  await page.getByRole('button', { name: 'Request quote for selected route' }).click();
  await expect(page.getByText(/Quote qt-/)).toBeVisible();
  await page.getByRole('button', { name: /Accept quote/ }).click();
  await expect(page.getByRole('heading', { name: /Order ord-/ })).toBeVisible();
  await page.getByRole('button', { name: /Pay .* \(SIMULATED\)/ }).click();
  // Background worker: auto-accept (2 s) + simulated provisioning delay.
  await expect(page.getByText('Service is active')).toBeVisible({ timeout: 60_000 });
  await snap(page, '03-order-active');
  await page.getByRole('link', { name: 'Service →' }).click();
  await page.getByRole('tab', { name: 'Activation tests' }).click();
  await expect(page.getByText('ENDPOINT_REACHABILITY')).toBeVisible();
  await expect(page.locator('td .b-bad', { hasText: /^FAIL$/ })).toHaveCount(0);
  await snap(page, '04-service-tests');
  await logout(page);

  await login(page, 'noc@demo.local');
  await snap(page, '05-overview-noc');
  await page.getByRole('link', { name: 'Network Topology' }).click();
  await page.getByLabel('Show service path').selectOption({ index: 1 });
  await snap(page, '06-topology-path');
  await page.getByRole('link', { name: 'Simulation Lab' }).click();
  await page.getByRole('button', { name: 'Pause auto-tick' }).click();
  await page.locator('tr', { hasText: 'Fiber cut Jakarta–Makassar' }).getByRole('button', { name: 'Run' }).click();
  await page.getByRole('link', { name: /Open incident/ }).click();
  await expect(page.getByText('FAULT INJECTED')).toBeVisible();
  await expect(page.getByText(/PROTECTION SWITCH|SERVICE DOWN|MITIGATED/).first()).toBeVisible();
  await snap(page, '07-incident');
  await page.getByRole('link', { name: 'SLA & Monitoring' }).click();
  await expect(page.getByRole('heading', { name: 'Per-service SLA' })).toBeVisible();
  await snap(page, '08-sla');
  await page.getByRole('link', { name: 'Simulation Lab' }).click();
  await page.getByRole('button', { name: 'Restore all faults' }).click();
  await page.getByRole('button', { name: '+10' }).click();
  await page.getByRole('link', { name: 'Alarms & Incidents' }).click();
  await expect(page.locator('tr', { hasText: 'Fiber cut' }).getByText('RESOLVED')).toBeVisible();
  await snap(page, '09-alarms-resolved');
  await logout(page);

  // RBAC in the UI mirrors the backend.
  await login(page, 'customer.b@demo.local');
  await page.getByRole('link', { name: 'Orders' }).click();
  await expect(page.getByText('No orders yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Simulation Lab' })).toHaveCount(0);
});
