// Annotated "what's on the screen" guide images: numbered callouts drawn over the live game at the real
// positions of each control (Chromium; desktop + iPhone 13 emulation).  → docs/images/guide-*.png
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const callouts = [
  ['.world-card', '1', 'World, year, era, people'],
  ['.playback', '2', 'Pause / speed'],
  ['[aria-label="Map layers"]', '3', 'Map layers'],
  ['[aria-label="Nations"]', '4', 'Nations & flags'],
  ['[aria-label="History"]', '5', 'History'],
  ['[aria-label="Statistics"]', '6', 'Charts'],
  ['[aria-label="Menu"]', '7', 'Save / load / settings'],
  ['.cat-row', '8', 'God powers (10 kinds)'],
];
for (const [name, ctxOpts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['iphone', { ...devices['iPhone 13'] }]]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url);
  // step pictures: title → new world → game
  await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/images/step1-${name}.png` });
  await page.getByText('New world').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/images/step2-${name}.png` });
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  await page.locator('.playback button').last().click();
  await page.waitForTimeout(12000);
  await page.locator('.playback button').first().click();
  await page.evaluate((list) => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;font:600 14px "Pixelify Sans",sans-serif';
    for (const [sel, num, label] of list) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:3px solid #d8a548;border-radius:8px;box-shadow:0 0 0 2px #141c30`;
      const tag = document.createElement('div');
      const below = r.top < innerHeight / 2;
      const left = Math.min(Math.max(4, r.left), innerWidth - 190);
      tag.style.cssText = `position:fixed;left:${left}px;top:${below ? r.bottom + 8 : r.top - 34}px;background:#d8a548;color:#141c30;padding:3px 8px;border-radius:6px;white-space:nowrap`;
      tag.textContent = `${num} ${label}`;
      layer.append(box, tag);
    }
    document.body.append(layer);
  }, callouts);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/images/guide-${name}.png` });
  await ctx.close();
}
await browser.close();
console.log('guide images written');
