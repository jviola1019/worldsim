// Round 10 addendum: capture the placing hand for the design review (descend, open and drop, landed), at 2x.
//   node tools/hand-capture.mjs        (needs `npm run preview`; writes tools/output/hand-*.png)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const url = process.env.URL ?? 'http://localhost:4173/';
mkdirSync('tools/output', { recursive: true });
const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 })).newPage();
await page.goto(url);
await page.getByText('New world').first().click();
await page.locator('button.preset', { hasText: /^Realistic/ }).click();
await page.getByText('Create world').click();
await page.waitForSelector('canvas.canvas', { timeout: 30000 });
if (await page.getByText('Skip').count()) await page.getByText('Skip').click();
const canvas = page.locator('canvas.canvas');
const vp = page.viewportSize();
// zoom in on the middle so the hand reads at street scale
await page.mouse.move(vp.width / 2, vp.height / 2);
for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(40); }
await page.waitForTimeout(800);
for (const [cat, tool, name] of [['Peoples', 'Humans', 'humans'], ['Nature', 'Elephants', 'elephants']]) {
  await page.getByLabel(cat).click();
  await page.locator('.tool', { hasText: tool }).first().click();
  let at = null;
  outer: for (const fy of [0.5, 0.42, 0.58, 0.35, 0.65]) for (const fx of [0.5, 0.42, 0.58, 0.35, 0.65]) {
    await page.mouse.click(vp.width * fx, vp.height * fy);
    await page.waitForTimeout(30);
    if (((await canvas.getAttribute('data-fx')) ?? '').includes('fx.hand')) { at = [vp.width * fx, vp.height * fy]; break outer; }
  }
  if (!at) { console.log(`${name}: no dry land found to drop on`); continue; }
  const clip = { x: Math.max(0, at[0] - 90), y: Math.max(0, at[1] - 105), width: 180, height: 150 };
  for (const [ms, phase] of [[110, 'descend'], [330, 'open'], [700, 'landed']]) {
    await page.waitForTimeout(ms - (phase === 'descend' ? 30 : phase === 'open' ? 110 : 330));
    await page.screenshot({ path: `tools/output/hand-${name}-${phase}.png`, clip });
    console.log(`${name} ${phase}: ${await canvas.getAttribute('data-fx-motion')}`);
  }
  await page.getByLabel('Stop using this power').click().catch(() => {});
  await page.waitForTimeout(1200);
  // move the next drop away from this one
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.keyboard.press('Escape').catch(() => {});
}
await browser.close();
