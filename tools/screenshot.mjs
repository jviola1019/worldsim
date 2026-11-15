// Usage: node tools/screenshot.mjs [mode] ; serves dist via vite preview externally
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const url = process.env.URL ?? 'http://localhost:4173/';
const mode = process.argv[2] ?? 'phone';
const browser = await chromium.launch();
const ctx = mode === 'phone' ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(1200);
await page.screenshot({ path: `tools/output/shot-${mode}-title.png` });
await page.getByText('New world').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `tools/output/shot-${mode}-new.png` });
await page.getByText('Create world').click();
await page.waitForSelector('canvas.canvas', { timeout: 30000 });
await page.waitForTimeout(1500);
const skip = page.getByText('Skip');
if (await skip.count()) await skip.click();
// run at max speed for a while
await page.locator('.playback button').nth(4).click();
await page.waitForTimeout(Number(process.env.WAIT ?? 15000));
await page.screenshot({ path: `tools/output/shot-${mode}-game.png` });
// nations list -> first nation inspector (flags, ruler biography)
await page.locator('.playback button').nth(0).click();
await page.getByLabel('Nations').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `tools/output/shot-${mode}-nations.png` });
const row = page.locator('.sheet-body ul.list li button').first();
if (await row.count()) { await row.click(); await page.waitForTimeout(400); await page.screenshot({ path: `tools/output/shot-${mode}-civ.png` }); }
const ruler = page.locator('.sheet-body button.person-card').first();
if (await ruler.count()) { await ruler.click(); await page.waitForTimeout(400); await page.screenshot({ path: `tools/output/shot-${mode}-person.png`, fullPage: true }); }
console.log('errors:', errors.slice(0, 10));
await browser.close();
