// End-to-end smoke test against the static export in out/ (run `npm run build` first).
//
//   npm run smoke
//   CHROMIUM_PATH=/path/to/chrome npm run smoke   # when Playwright's bundled browser is not installed
//
// Serves out/ on an ephemeral port, loads the fictional demo family, visits every route and tab at
// desktop (1440×900) and mobile (390×844) sizes, opens a "Cara hitung" sheet, imports a CSV (one valid
// row, two that must be rejected), downloads the PDF / Excel / CSV exports and checks their contents.
// Fails on any console error, page error, failed request (except aborted prefetches), HTTP ≥ 400,
// horizontal overflow on mobile, or unexpected result. Screenshots go to test-results/smoke/.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "out");
const OUT = path.join(ROOT, "test-results", "smoke");
if (!fs.existsSync(path.join(SITE, "index.html"))) {
  console.error("out/ not found — run `npm run build` first.");
  process.exit(2);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  let file = path.join(SITE, decodeURIComponent(pathname));
  if (!file.startsWith(SITE)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "content-type": MIME[".html"] });
    fs.createReadStream(path.join(SITE, "404.html")).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const problems = [];
const log = (m) => console.log(m);

function watch(page, tag) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`[${tag}] console.${msg.type()}: ${msg.text().slice(0, 400)} @ ${page.url()}`);
  });
  page.on("pageerror", (err) => problems.push(`[${tag}] pageerror: ${err.message} @ ${page.url()}`));
  // Next.js <Link> prefetches are aborted when the test navigates away — benign.
  page.on("requestfailed", (req) => {
    if (req.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`[${tag}] requestfailed: ${req.url()} ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) problems.push(`[${tag}] HTTP ${res.status()}: ${res.url()}`);
  });
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // useDeferredCompute runs the heavy engine work after paint.
  await page.waitForTimeout(700);
  if (await page.getByText("Application error").count()) problems.push(`client crash on ${page.url()}`);
}

const ROUTES = [
  ["home", "/"],
  ["children", "/children/"],
  ["schools", "/schools/"],
  ["school-ui", "/schools/?id=univ-ui"],
  ["school-dpk", "/schools/?id=dpk-nurul-fikri-islamic-school"],
  ["compare", "/schools/compare/"],
  ...["cost", "funding", "scenarios", "sensitivity", "tradeoff", "recommend", "inflation"].map((t) => [`plan-${t}`, `/planning/?tab=${t}`]),
  ...["networth", "cashflow", "balance", "risk", "retirement"].map((t) => [`pf-${t}`, `/portfolio/?tab=${t}`]),
  ["report", "/report/"],
  ...["schools", "import", "verify", "assumptions", "master"].map((t) => [`admin-${t}`, `/admin/?tab=${t}`]),
  ["settings", "/settings/"],
  ["onboarding", "/onboarding/"],
  ["login", "/login/"],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
try {
  // ---------- Desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: "id-ID" });
  const page = await ctx.newPage();
  watch(page, "desktop");
  await page.goto(BASE + "/");
  await settle(page);
  await page.getByRole("button", { name: /Coba dengan keluarga contoh/ }).click();
  await settle(page);

  const explain = page.getByRole("button", { name: /^Cara hitung/ });
  if (!(await explain.count())) problems.push("no 'Cara hitung' button on the dashboard");
  else {
    await explain.first().click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor({ state: "visible", timeout: 5000 });
    for (const k of ["Input", "Formula", "Assumption", "Result"]) if (!(await dlg.getByText(k, { exact: true }).count())) problems.push(`explain sheet missing "${k}"`);
    await page.screenshot({ path: path.join(OUT, "desktop-explain.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    if (await page.getByRole("dialog").count()) problems.push("Escape did not close the explain sheet");
  }

  for (const [tag, r] of ROUTES) {
    await page.goto(BASE + r);
    await settle(page);
    if (!(await page.locator("h1").count())) problems.push(`no <h1> on ${r}`);
    await page.screenshot({ path: path.join(OUT, `desktop-${tag}.png`), fullPage: true });
  }
  log(`desktop: ${ROUTES.length} routes`);

  // Compare three schools picked from the database page
  await page.goto(BASE + "/schools/");
  await settle(page);
  const cmp = page.getByRole("button", { name: /Bandingkan/ });
  for (let i = 0; i < Math.min(3, await cmp.count()); i++) await cmp.nth(i).click();
  await page.goto(BASE + "/schools/compare/");
  await settle(page);
  await page.waitForTimeout(1000);
  const cmpRows = await page.locator("table.data-table tbody tr").count();
  log(`compare: ${cmpRows} metric rows`);
  if (!cmpRows) problems.push("compare table empty");

  // CSV import: one valid row, one without source, one "verified" without URL
  await page.goto(BASE + "/admin/?tab=import");
  await settle(page);
  const csv = [
    "school_id,school_name,city,province,level,academic_year,entry_fee,monthly_tuition,annual_fee,transport_fee,meal_fee,book_fee,activity_fee,source,source_date,verification_status,source_url",
    ",Sekolah Uji Smoke,Kota Depok,Jawa Barat,SD,2026/2027,20000000,1250000,3000000,,,900000,600000,Brosur PPDB resmi 2026/2027,2026-08-01,user_submitted,https://contoh.sch.id/ppdb",
    ",Sekolah Tanpa Sumber,Kota Bogor,Jawa Barat,SMP,2026/2027,15000000,1000000,,,,,,,2026-08-01,estimated,",
    ",Sekolah Verified Tanpa URL,Kota Bogor,Jawa Barat,SMA,2026/2027,15000000,1000000,,,,,,Brosur,2026-08-01,verified,",
  ].join("\n");
  await page.getByLabel("Isi CSV").fill(csv);
  await page.getByRole("button", { name: /Validasi & pratinjau/ }).click();
  const preview = await page.getByText(/Pratinjau:/).first().textContent();
  log(`csv: ${preview}`);
  if (!/1 valid, 2 ditolak/.test(preview ?? "")) problems.push(`unexpected CSV preview: ${preview}`);
  await page.getByRole("button", { name: /Impor 1 baris/ }).click();
  await page.goto(BASE + "/schools/");
  await settle(page);
  await page.getByPlaceholder(/Cari/).first().fill("Sekolah Uji Smoke");
  await page.waitForTimeout(400);
  if (!(await page.getByText("Sekolah Uji Smoke").count())) problems.push("imported school not listed");

  // Report + exports
  await page.goto(BASE + "/report/");
  await settle(page);
  await page.waitForTimeout(1000);
  const sections = await page.locator("section.card h2").count();
  log(`report: ${sections} sections`);
  if (sections !== 17) problems.push(`report has ${sections} sections, expected 17`);
  const download = async (name) => {
    const [d] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name }).first().click()]);
    const p = path.join(OUT, d.suggestedFilename());
    await d.saveAs(p);
    return p;
  };
  const pdf = await download(/^PDF$/);
  if (fs.readFileSync(pdf).subarray(0, 5).toString() !== "%PDF-") problems.push("PDF header invalid");
  const xlsx = await download(/^Excel$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);
  let formulas = 0;
  wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((cell) => void (cell.formula || cell.sharedFormula ? formulas++ : 0))));
  log(`exports: PDF ${fs.statSync(pdf).size} B, XLSX ${wb.worksheets.length} sheets / ${formulas} formulas`);
  if (!formulas) problems.push("xlsx contains no formulas");
  for (const b of [/CSV timeline/, /CSV cash flow/, /CSV sekolah/]) {
    const f = await download(b);
    if (fs.readFileSync(f, "utf8").split("\n").length < 2) problems.push(`${b} export is empty`);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(BASE + "/");
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "desktop-dark-home.png"), fullPage: true });
  const state = await ctx.storageState();
  await ctx.close();

  // ---------- Mobile ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state, locale: "id-ID" });
  const m = await mctx.newPage();
  watch(m, "mobile");
  for (const [tag, r] of ROUTES) {
    await m.goto(BASE + r);
    await settle(m);
    const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (o.sw > o.iw + 1) problems.push(`[mobile] horizontal overflow ${o.sw}>${o.iw} on ${r}`);
    await m.screenshot({ path: path.join(OUT, `mobile-${tag}.png`) });
  }
  log(`mobile: ${ROUTES.length} routes`);
  await m.goto(BASE + "/");
  await settle(m);
  const nav = (await m.locator("nav").last().innerText()).replace(/\s+/g, " ").trim();
  if (nav !== "Home Children Schools Planning Portfolio") problems.push(`unexpected bottom nav: ${nav}`);
  await m.getByRole("button", { name: /Tambah|Aksi cepat|Quick/i }).last().click();
  await m.waitForTimeout(300);
  for (const item of ["Add Child", "Add School", "Add Expense", "Add Asset"]) if (!(await m.getByText(item).count())) problems.push(`FAB menu missing ${item}`);
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}

const unique = [...new Set(problems)];
console.log(`\n${unique.length ? "FAIL" : "OK"} — ${unique.length} problem(s); screenshots in ${path.relative(ROOT, OUT)}/`);
for (const p of unique) console.log("  " + p);
process.exit(unique.length ? 1 : 0);
