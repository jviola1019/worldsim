// Captures the README screenshot gallery from the real built game (Chromium; desktop + iPhone 13 emulation).
//   npm run build && npm run preview &  node tools/gallery.mjs   → docs/images/*.png
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const out = (n) => `docs/images/${n}.png`;
const browser = await chromium.launch();

async function world(ctx, preset, seconds, label) {
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(800);
  if (label === 'title') await page.screenshot({ path: out(label) });
  await page.getByText('New world').first().click();
  await page.waitForTimeout(300);
  // the old presets are God mode at an era stop (the three starts replaced them)
  const era = { 'Age of Kingdoms': 4, 'Industrializing World': 7, 'Modern Geopolitics': 10 }[preset] ?? 1;
  if (preset && era === 1) await page.locator('button.preset', { hasText: preset }).first().click();
  if (era > 1) await page.getByRole('slider', { name: 'Start in era' }).fill(String(era));
  if (label === 'new-world') await page.screenshot({ path: out('new-world') });
  await page.getByText('Create world').click();
  if (era > 1) await page.getByRole('dialog', { name: /^Start in the/ }).getByRole('button', { name: /^Start in / }).click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  await page.locator('.playback button').last().click();
  await page.waitForTimeout(seconds * 1000);
  await page.locator('.playback button').first().click();
  await page.waitForTimeout(300);
  return page;
}
const zoomIn = async (page, steps) => { const b = await page.viewportSize(); await page.mouse.move(b.width / 2, b.height / 2); for (let k = 0; k < steps; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); } await page.waitForTimeout(400); };
const closeSheet = async (page) => { const c = page.getByLabel('Close'); if (await c.count()) await c.first().click(); await page.waitForTimeout(200); };

const toCapital = async (page) => {
  await page.getByLabel('Nations').click(); await page.waitForTimeout(300);
  await page.locator('.sheet-body ul.list li button').first().click(); await page.waitForTimeout(300);
  await page.getByText('Show capital').click(); await page.waitForTimeout(600);
  await closeSheet(page);
};

// ---- desktop
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
let p = await world(desk, null, 1, 'title');
await p.close();
p = await world(desk, null, 1, 'new-world');
await p.close();
// a natural world grown for a while: overview, political & religion overlays, past borders, nations, a ruler
p = await world(desk, 'God mode', 40, 'grown');
await p.screenshot({ path: out('desktop-world') });
await p.getByLabel('Map layers').click(); await p.getByText('Religion', { exact: true }).click(); await closeSheet(p);
await p.screenshot({ path: out('overlay-religion') });
await p.getByLabel('Map layers').click(); await p.getByText('Past borders').click(); await p.waitForTimeout(300);
await p.screenshot({ path: out('overlay-past-borders') });
await p.getByText('Nations', { exact: true }).first().click().catch(() => {}); await closeSheet(p);
await p.getByLabel('Nations').click(); await p.waitForTimeout(300);
await p.screenshot({ path: out('nations-flags') });
await p.locator('.sheet-body ul.list li button').first().click(); await p.waitForTimeout(300);
await p.screenshot({ path: out('civ-inspector') });
const card = p.locator('.sheet-body button.person-card').first();
if (await card.count()) { await card.click(); await p.waitForTimeout(300); await p.screenshot({ path: out('person-biography') }); }
await closeSheet(p);
await p.getByLabel('History').click(); await p.waitForTimeout(300); await p.screenshot({ path: out('history') }); await closeSheet(p);
await p.getByLabel('Statistics').click(); await p.waitForTimeout(400); await p.screenshot({ path: out('statistics') }); await closeSheet(p);
await p.locator('.cat').first().click(); await p.waitForTimeout(300); await p.screenshot({ path: out('god-powers') });
await p.close();
// modern era: cities up close
p = await world(desk, 'Modern Geopolitics', 6, 'modern');
await toCapital(p);
await zoomIn(p, 2);
await p.screenshot({ path: out('modern-city') });
await p.close();
// medieval kingdoms up close
p = await world(desk, 'Age of Kingdoms', 8, 'kingdoms');
await toCapital(p);
await zoomIn(p, 2);
await p.screenshot({ path: out('kingdoms-city') });
await p.close();
// observer mode
p = await world(desk, 'Realistic', 10, 'observer');
await p.screenshot({ path: out('observer-mode') });
await p.close();
await desk.close();

// ---- iPhone 13 (emulated)
const phone = await browser.newContext({ ...devices['iPhone 13'] });
p = await world(phone, 'God mode', 25, 'phone');
await p.screenshot({ path: out('iphone-world') });
await p.getByLabel('Nations').click(); await p.waitForTimeout(300);
await p.locator('.sheet-body ul.list li button').first().click(); await p.waitForTimeout(300);
await p.screenshot({ path: out('iphone-inspector') });
await p.close();
await phone.close();
await browser.close();
console.log('gallery written to docs/images/');
