// Browser frame-rate benchmark: creates a world, runs at max speed and measures
// requestAnimationFrame rate and simulated years per real second.
//   npm run build && npm run preview -- --port 4173 &  node benchmarks/browser-bench.mjs [phone|desktop]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const mode = process.argv[2] ?? 'phone';
const browser = await chromium.launch();
const ctx = await browser.newContext(mode === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(url);
await page.getByText('New world').first().click();
await page.getByText('Create world').click();
await page.waitForSelector('canvas.canvas', { timeout: 30000 });
const skip = page.getByText('Skip');
if (await skip.count()) await skip.click();
const yearOf = async () => Number((await page.locator('.world-card .year').innerText()).replace(/\D/g, ''));
for (const [label, idx] of [['1x', 1], ['max', -1]]) {
  await (idx < 0 ? page.locator('.playback button').last() : page.locator('.playback button').nth(idx)).click();
  await page.waitForTimeout(1500);
  const y0 = await yearOf();
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 10000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const y1 = await yearOf();
  console.log(`${mode} ${label}: ${fps.toFixed(1)} fps, ${((y1 - y0) / 10).toFixed(2)} sim years/s (year ${y1})`);
}
console.log('Note: headless Chromium on a server CPU, not a real phone; treat as relative numbers.');
await browser.close();
