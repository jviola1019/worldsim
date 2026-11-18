// Layout check across device profiles (Chromium emulation, not Safari/physical devices).
// For each profile: create a world, run briefly, open the nations sheet and a person, and screenshot.
// Reports elements that overflow the viewport and console errors.  Usage: node tools/viewports.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const profiles = ['iPhone SE', 'iPhone 13', 'iPhone 13 landscape', 'iPhone 15 Pro Max', 'iPad (gen 7)', 'Galaxy S9+'];
const browser = await chromium.launch();
let problems = 0;
for (const name of profiles) {
  const ctx = await browser.newContext({ ...devices[name] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.getByText('New world').first().click();
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  await page.locator('.playback button').last().click();
  await page.waitForTimeout(6000);
  await page.locator('.playback button').first().click();
  const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({ path: `tools/output/vp-${slug}-hud.png` });
  // controls outside the viewport (clipped HUD) — ignore the map canvas itself
  const offscreen = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [];
    for (const el of document.querySelectorAll('button, .world-card, .playback, .hud-actions, .cat-row')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bad.push(`${el.className || el.tagName}@${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)}x${Math.round(r.bottom)}`);
    }
    // touch targets under 32px in either dimension
    const small = [...document.querySelectorAll('.hud-actions button, .playback button, .cat')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 32 || r.height < 32); }).length;
    return { bad: bad.slice(0, 5), small };
  });
  await page.getByLabel('Nations').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `tools/output/vp-${slug}-nations.png` });
  const row = page.locator('.sheet-body ul.list li button').first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(300); }
  const card = page.locator('.sheet-body button.person-card').first();
  if (await card.count()) { await card.click(); await page.waitForTimeout(300); }
  await page.screenshot({ path: `tools/output/vp-${slug}-person.png` });
  const ok = offscreen.bad.length === 0 && errors.length === 0;
  if (!ok) problems++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(20)} ${devices[name].viewport.width}x${devices[name].viewport.height} offscreen=${offscreen.bad.length} ${offscreen.bad.join(' ')} smallTargets=${offscreen.small} errors=${errors.length} ${errors.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
