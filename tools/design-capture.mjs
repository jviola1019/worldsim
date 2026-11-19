// Design review capture (round 6): every screen at five device sizes, plus measured design metrics.
//   npm run build && npx vite preview --port 4173 &   node tools/design-capture.mjs [outDir]
// Writes <outDir>/<device>/<screen>.png and <outDir>/metrics.json, and prints a summary:
// text under 12 CSS px, touch targets under 44 px (touch devices), text below WCAG AA contrast,
// and every CSS transition/animation duration in use.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { measure } from './design-metrics.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const out = process.argv[2] ?? 'docs/images/design-review/before';
const DEVICES = [
  ['iphone-se', { ...devices['iPhone SE'] }],
  ['iphone-13', { ...devices['iPhone 13'] }],
  ['iphone-13-land', { ...devices['iPhone 13 landscape'] }],
  ['ipad', { ...devices['iPad (gen 7)'] }],
  ['desktop', { viewport: { width: 1280, height: 800 } }],
];

const browser = await chromium.launch();
const metrics = {};
let shots = 0;
for (const [name, ctxOpts] of DEVICES) {
  mkdirSync(`${out}/${name}`, { recursive: true });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const touch = !!ctxOpts.hasTouch;
  const snap = async (screen) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${name}/${screen}.png` });
    metrics[`${name}/${screen}`] = await page.evaluate(measure, touch);
    shots++;
  };
  const tryClick = async (loc) => { try { if (await loc.count()) { await loc.first().click({ timeout: 3000 }); return true; } } catch { /* not on this screen */ } return false; };
  const close = async () => { await tryClick(page.getByLabel('Close')); await page.waitForTimeout(150); };

  await page.goto(url);
  await page.waitForTimeout(800);
  await snap('01-title');
  if (await tryClick(page.getByText('Settings'))) { await snap('02-settings'); await tryClick(page.getByText('Back')); }
  if (await tryClick(page.getByText(/^Load|Continue|Saved worlds/))) { await snap('03-load'); await tryClick(page.getByText('Back')); }
  await tryClick(page.getByText('New world'));
  await snap('04-new-world');
  await tryClick(page.locator('button.preset', { hasText: 'Age of Kingdoms' }));
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 60000 });
  await page.waitForTimeout(500);
  await snap('05-tutorial');
  await tryClick(page.getByText('Skip'));
  await page.locator('.playback button').last().click();
  await page.waitForTimeout(12000);
  await page.locator('.playback button').first().click();
  await snap('06-game-hud');
  await tryClick(page.locator('.cat'));
  await snap('07-tool-dock');
  await page.keyboard.press('Escape').catch(() => {});
  for (const [label, screen] of [['Map layers', '08-layers'], ['News feed', '09-world-feed'], ['History', '10-history'], ['Statistics', '11-statistics'], ['World laws', '12-laws'], ['Menu', '13-menu']]) {
    if (await tryClick(page.getByLabel(label, { exact: true }))) { await snap(screen); await close(); await page.keyboard.press('Escape').catch(() => {}); }
  }
  if (await tryClick(page.getByLabel('Nations', { exact: true }))) {
    await snap('14-nations');
    if (await tryClick(page.locator('.sheet-body ul.list li button'))) {
      await page.waitForTimeout(800);
      await snap('15-nation-overview');
      for (const t of ['Feed', 'Album', 'History', 'Technology', 'Economy', 'Diplomacy']) if (await tryClick(page.getByRole('tab', { name: t }))) await snap(`16-nation-${t.toLowerCase()}`);
    }
    await close();
  }
  // a person (ruler) inspector via the nation overview's leader link, if present
  if (name === 'desktop') {
    const vp = page.viewportSize();
    await page.mouse.move(vp.width / 2, vp.height / 2);
    for (let k = 0; k < 30; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(25); }
    await page.waitForTimeout(1200);
    await snap('17-close-up-map');
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 1));
const sum = (k) => Object.values(metrics).reduce((a, m) => a + m[k].length, 0);
const motion = new Set(Object.values(metrics).flatMap((m) => m.motion));
console.log(`${shots} captures in ${out}`);
console.log(`small text (<12px): ${sum('smallText')}  small touch targets (<44px): ${sum('smallTargets')}  low contrast (<AA): ${sum('lowContrast')}`);
console.log(`motion in use: ${[...motion].join(' | ')}`);
