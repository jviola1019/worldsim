// Frame-time check for the close-up city layer (round 6): a modern capital at maximum zoom (close-up
// on) and just below the close-up threshold (normal map), Chromium with CPU throttled ×4.
// This is emulation on a desktop CPU, not a phone.   node tools/perf-closeup.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(url);
await page.getByText('New world').first().click();
await page.locator('button.preset', { hasText: 'Modern Geopolitics' }).first().click();
await page.getByText('Create world').click();
await page.waitForSelector('canvas.canvas', { timeout: 60000 });
const skip = page.getByText('Skip'); if (await skip.count()) await skip.click();
await page.locator('.playback button').last().click(); await page.waitForTimeout(6000);
await page.locator('.playback button').nth(1).click(); // normal speed while measuring
await page.getByLabel('Nations').click(); await page.waitForTimeout(300);
await page.locator('.sheet-body ul.list li button').first().click(); await page.waitForTimeout(300);
await page.getByText('Show capital').click(); await page.waitForTimeout(500);
await page.getByLabel('Close').first().click();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const measure = async (label) => {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + 8000;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
    requestAnimationFrame(f);
  }));
  r.sort((a, b) => a - b);
  const q = (p) => r[Math.min(r.length - 1, Math.floor(p * r.length))];
  const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));
  const chunks = await page.locator('canvas.canvas').getAttribute('data-city-chunks');
  console.log(`${label.padEnd(34)} frames ${r.length}  median ${q(0.5).toFixed(1)} ms  p95 ${q(0.95).toFixed(1)} ms  heap ${heap} MB  close-up chunks ${chunks}`);
};
const vp = page.viewportSize();
await page.mouse.move(vp.width / 2, vp.height / 2);
for (let k = 0; k < 40; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(20); }
await measure('max zoom (close-up on)');
// back out until the close-up is off but the map is still near (just under 20 px per tile)
for (let k = 0; k < 40; k++) {
  await page.mouse.wheel(0, 120); await page.waitForTimeout(60);
  if (Number(await page.locator('canvas.canvas').getAttribute('data-city-chunks')) === 0) break;
}
await measure('just below threshold (close-up off)');
await browser.close();
