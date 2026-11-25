// Captures the round-5 README screenshots from the real built game (Chromium; iPhone 13 emulation + desktop).
//   npm run build && npx vite preview --port 4173 &  node tools/gallery-r5.mjs   → docs/images/r5-*.png
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const out = (n) => `docs/images/r5-${n}.png`;
const browser = await chromium.launch();
const log = (...a) => console.log(...a);

async function world(ctx, { preset, shape, seconds, seed }) {
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByText('New world').first().click();
  await page.waitForTimeout(300);
  // the old presets are God mode at an era stop (the three starts replaced them)
  const era = { 'Age of Kingdoms': 4, 'Industrializing World': 7, 'Modern Geopolitics': 10 }[preset] ?? 1;
  if (era > 1) await page.getByRole('slider', { name: 'Start in era' }).fill(String(era));
  if (shape) await page.locator('#wshape').selectOption(shape);
  if (seed) await page.locator('#wseed').fill(seed);
  await page.getByText('Create world').click();
  if (era > 1) await page.getByRole('dialog', { name: /^Start in the/ }).getByRole('button', { name: /^Start in / }).click();
  await page.waitForSelector('canvas.canvas', { timeout: 60000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  await page.locator('.playback button').last().click();
  await page.waitForTimeout(seconds * 1000);
  await page.locator('.playback button').first().click();
  await page.waitForTimeout(400);
  return page;
}
const close = async (page) => { const c = page.getByLabel('Close'); if (await c.count()) await c.first().click(); await page.waitForTimeout(200); };
const year = async (page) => (await page.locator('.world-card .year').innerText().catch(() => '?')).trim();

// 1) The feed in the medium of each era (phone)
const phone = await browser.newContext({ ...devices['iPhone 13'] });
const only = process.env.ONLY;
for (const [preset, label, secs] of [[undefined, 'feed-cave', 3], ['Age of Kingdoms', 'feed-scroll', 25], ['Industrializing World', 'feed-newspaper', 20], ['Modern Geopolitics', 'feed-social', 28], ['Modern Geopolitics', 'feed-holo', 45]]) {
  if (only && !only.split(',').includes(label)) continue;
  const page = await world(phone, { preset, seconds: secs, seed: 'gallery-' + (label === 'feed-holo' ? 'feed-social' : label) });
  await page.getByLabel('News feed').click();
  await page.waitForTimeout(600);
  const cls = await page.locator('article.post').first().getAttribute('class').catch(() => 'none');
  // scroll the sheet so the era frame fills the view (frame head at the top of the sheet body)
  await page.locator('.frame-head').first().evaluate((el) => el.scrollIntoView({ block: 'start' })).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(label) });
  log(label, await year(page), cls);
  await page.close();
}

if (only) { await browser.close(); process.exit(0); }

// 2) A donut world, the nation overview with live city pictures, and the album (desktop)
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await world(desk, { preset: 'Age of Kingdoms', shape: 'donut', seconds: 70, seed: 'gallery-donut' });
log('donut', await year(page));
await page.getByLabel('Nations').click();
await page.waitForTimeout(300);
await page.locator('.sheet-body ul.list li button').first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: out('nation-overview') });
const pics = page.locator('.photo canvas');
log('pictures', await pics.count());
if (await pics.count()) {
  await pics.nth(0).screenshot({ path: out('aerial') });
  await pics.nth(1).screenshot({ path: out('postcard') }).catch(() => {});
}
await page.getByRole('tab', { name: 'Album' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: out('album') });
log('album cards', await page.locator('.album canvas, .album .photo').count());
await browser.close();
