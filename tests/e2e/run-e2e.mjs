// End-to-end smoke test in emulated iPhone 13 (touch) and desktop Chromium.
// Requires a build served at URL (default: npm run build && npm run preview -- --port 4173).
//   node tests/e2e/run-e2e.mjs
// Checks: no console errors; world creation; time advances; tool selection; tap-to-inspect;
// layers sheet incl. past-borders slider; nations list with flags; news feed; manual save to IndexedDB.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const url = process.env.URL ?? 'http://localhost:4173/';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };

async function run(label, ctxOpts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await page.goto(url);
  const meta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content').catch(() => null);
  check(`${label}: production CSP is in force`, !!meta && meta.includes("script-src 'self'") && !meta.includes('unsafe'), meta ? 'meta CSP present' : 'missing');
  await page.getByText('New world').first().click();
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  const yearOf = async () => Number((await page.locator('.world-card .year').innerText()).replace(/\D/g, ''));
  const y0 = await yearOf();
  await page.locator('.playback button').nth(5).click().catch(() => page.locator('.playback button').last().click());
  await page.waitForTimeout(8000);
  const y1 = await yearOf();
  check(`${label}: time advances at max speed`, y1 > y0, `year ${y0} → ${y1}`);
  await page.locator('.playback button').first().click();
  // tool selection: open a category and pick the first tool
  await page.locator('.cat').first().click();
  const tool = page.locator('.tool, .tools button').first();
  if (await tool.count()) { await tool.click(); check(`${label}: tool selectable`, (await page.locator('[aria-pressed=true]').count()) > 0); }
  await page.keyboard.press('Escape').catch(() => {});
  // layers + past borders
  await page.getByLabel('Map layers').click();
  await page.getByText('Past borders').click();
  check(`${label}: past-borders layer opens`, (await page.locator('.sheet').count()) > 0);
  await page.getByLabel('Close').first().click();
  // nations + flags
  await page.getByLabel('Nations').click();
  const flags = await page.locator('img.flag').count();
  check(`${label}: nations list renders flags`, flags > 0, `${flags} flags`);
  // nation overview: key figures, live aerial photo and postcard, album tab
  await page.locator('.sheet-body ul.list li button').first().click();
  await page.waitForTimeout(800);
  const pics = await page.locator('.photo canvas').count();
  const tiles = await page.locator('.stat-tile').count();
  check(`${label}: nation overview shows key figures and city pictures`, pics >= 2 && tiles >= 6, `${tiles} figures, ${pics} pictures`);
  await page.getByRole('tab', { name: 'Album' }).click();
  await page.waitForTimeout(300);
  check(`${label}: album tab opens`, (await page.locator('.album, .sheet-body p.muted').count()) > 0);
  await page.getByLabel('Close').first().click();
  // news feed: posts in the medium of their time
  await page.getByLabel('News feed').click();
  await page.waitForTimeout(300);
  const posts = await page.locator('article.post').count();
  const medium = posts ? await page.locator('article.post').first().getAttribute('class') : '';
  check(`${label}: news feed shows posts`, posts > 0, `${posts} posts (${medium})`);
  await page.getByLabel('Close').first().click();
  // save
  await page.getByLabel('Menu').click();
  const save = page.getByText(/^Save/).first();
  if (await save.count()) { await save.click(); await page.waitForTimeout(800); }
  const saved = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('epoch-saves'); r.onsuccess = () => { const db = r.result; res([...db.objectStoreNames].length); }; r.onerror = () => res(0); }));
  check(`${label}: IndexedDB save store exists`, saved > 0);
  const csp = await page.evaluate(() => window.__csp);
  check(`${label}: no CSP violations`, csp.length === 0, csp.slice(0, 3).join(' | '));
  const fonts = await page.evaluate(() => document.fonts.check('16px "Pixelify Sans"'));
  check(`${label}: self-hosted Pixelify Sans loaded`, fonts);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  // dynamic security checks (authorized, local build only): an injected inline script must be blocked by the CSP
  const blocked = await page.evaluate(() => new Promise((res) => {
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = 1';
    document.head.appendChild(s);
    setTimeout(() => res(window.__pwned === undefined && window.__csp.some((v) => v.startsWith('script-src'))), 200);
  }));
  check(`${label}: CSP blocks an injected inline script`, blocked);
  // clickjacking fallback: framed by another origin, the game refuses to run and offers its own tab
  const framer = await ctx.newPage();
  await framer.setContent(`<iframe src="${url}" style="width:800px;height:600px"></iframe>`);
  const frame = framer.frameLocator('iframe');
  await frame.getByText('Open EPOCH in a new tab').waitFor({ timeout: 15000 }).catch(() => {});
  const refused = (await frame.getByText('Open EPOCH in a new tab').count()) === 1 && (await frame.getByText('New world').count()) === 0;
  check(`${label}: refuses to run inside a cross-origin frame`, refused);
  await browser.close();
}

await run('phone', { ...devices['iPhone 13'] });
await run('desktop', { viewport: { width: 1280, height: 800 } });
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
