// Render SVG → PNG memakai Chromium (Playwright).
// Pemakaian: node tools/brand/render.js in.svg out.png lebarPx
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [inp, out, w] = process.argv.slice(2);
  const svg = fs.readFileSync(inp, 'utf8');
  const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
  const W = +w, H = Math.round(W * vh / vw);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg', `<svg width="${W}" height="${H}"`)}</body></html>`
  );
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
})();
