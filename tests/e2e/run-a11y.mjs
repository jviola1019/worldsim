// Round 10: accessibility audit of the production build (WCAG 2.2 A/AA rules of axe-core, plus scripted checks of
// keyboard focus, Escape, reflow at 320 px and text spacing). Needs `npm run preview` running.
//   node tests/e2e/run-a11y.mjs            (Chromium)        BROWSER=webkit node tests/e2e/run-a11y.mjs
// Fails (exit 1) on any serious or critical axe violation or a failed scripted check; moderate and minor
// violations are written to tools/output/a11y-<browser>.json for the audit report (docs/DESIGN-REVIEW.md §R10).
// axe runs in a test-only context with bypassCSP, so the shipped Content-Security-Policy is unchanged.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// like run-e2e.mjs: the project's playwright (CI installs it) or the container's copy
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, webkit, devices } = pw;
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const url = process.env.URL ?? 'http://localhost:4173/';
const engineName = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const engine = engineName === 'webkit' ? webkit : chromium;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const results = [];
const minor = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };

async function audit(page, label) {
  // measure the settled page: an entrance animation (sheets fade in over 200 ms) would read as low contrast
  // on a slower machine (seen on CI: the Laws sheet was audited mid-fade)
  // only finite animations: the broadcast feed's on-air dot and ticker loop forever, and awaiting their
  // `finished` hung the audit until CI's 30-minute timeout (#68). A 3 s cap guards against any other stall.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => null))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  await page.evaluate(AXE);
  const r = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), TAGS);
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of r.violations.filter((x) => !bad.includes(x))) minor.push({ where: label, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target });
  check(`axe ${label}`, bad.length === 0, bad.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`).join('; '));
}

async function newWorld(page, preset, secs = 0) {
  await page.goto(url);
  await page.getByText('New world').first().click();
  if (preset) await page.locator('button.preset', { hasText: preset }).first().click();
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  if (secs) {
    await page.locator('.playback button').last().click();
    await page.waitForTimeout(secs * 1000);
    await page.locator('.playback button').first().click();
  }
}

const close = (page) => page.getByLabel('Close').first().click().catch(() => {});

async function run(label, ctxOpts) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...ctxOpts, bypassCSP: true });
  const page = await ctx.newPage();
  // screens
  await page.goto(url);
  await audit(page, `${label}: title`);
  await page.getByText('Settings').first().click();
  await audit(page, `${label}: settings`);
  await page.goto(url);
  const load = page.getByText('Load world');
  if (await load.count()) { await load.first().click(); await audit(page, `${label}: load`); }
  await page.goto(url);
  await page.getByText('New world').first().click();
  await audit(page, `${label}: new world`);
  // god mode (Primitive, 9 s at max speed): HUD, dock, every sheet, inspectors
  await newWorld(page, 'Primitive Earth', 9);
  await audit(page, `${label}: game HUD (god mode)`);
  await page.locator('.cat').first().click();
  await audit(page, `${label}: dock tools open`);
  await page.keyboard.press('Escape');
  for (const [name, sheet] of [['Map layers', 'layers'], ['Nations', 'nations'], ['History', 'history'], ['News feed', 'feed (carving)'], ['Statistics', 'statistics'], ['Menu', 'menu']]) {
    await page.getByLabel(name, { exact: true }).click();
    await page.waitForTimeout(300);
    await audit(page, `${label}: ${sheet}`);
    // Escape closes the sheet
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const open = await page.locator('aside.sheet').count();
    if (open) await close(page);
    check(`${label}: Escape closes ${sheet}`, open === 0);
  }
  const lawsCat = page.getByLabel('World laws');
  if (await lawsCat.count()) { await lawsCat.click(); await audit(page, `${label}: laws`); await close(page); }
  // nation: every tab
  await page.getByLabel('Nations', { exact: true }).click();
  await page.locator('.sheet-body ul.list li button').first().click();
  await page.waitForTimeout(300);
  for (const tab of await page.getByRole('tab').allInnerTexts()) {
    await page.getByRole('tab', { name: tab.trim() }).click();
    await page.waitForTimeout(250);
    await audit(page, `${label}: nation ${tab.trim()}`);
  }
  // person: the ruler's card on the nation overview
  await page.getByRole('tab', { name: 'Overview' }).click();
  const ruler = page.locator('aside.sheet .person-card').first();
  if (await ruler.count()) {
    await ruler.click();
    await page.waitForTimeout(300);
    await audit(page, `${label}: inspector (person)`);
    await close(page);
    await page.getByLabel('Nations', { exact: true }).click();
    await page.locator('.sheet-body ul.list li button').first().click();
    await page.waitForTimeout(300);
  } else check(`${label}: a ruler card to open the person inspector`, false);
  // settlement: show the capital and tap it
  const cap = page.getByText('Show capital');
  if (await cap.count()) {
    await cap.first().click();
    await close(page);
    const vp = page.viewportSize();
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForTimeout(400);
    const kind = await page.locator('aside.sheet').getAttribute('data-kind').catch(() => null);
    if (kind) await audit(page, `${label}: inspector (${kind})`);
    await close(page);
  }
  // keyboard: Tab reaches the controls, and focus is always visible (2.4.7) with a 2 px+ outline
  const focusSeen = [];
  for (let k = 0; k < 25; k++) {
    await page.keyboard.press('Tab');
    focusSeen.push(await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const w = parseFloat(cs.outlineWidth) || 0;
      const r = e.getBoundingClientRect();
      const hidden = r.bottom < 0 || r.top > innerHeight;
      return { tag: e.tagName, label: e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 20), outline: cs.outlineStyle !== 'none' && w >= 2, shadow: cs.boxShadow !== 'none', hidden };
    }));
  }
  const reached = focusSeen.filter(Boolean);
  const invisible = reached.filter((f) => !f.outline && !f.shadow);
  check(`${label}: keyboard focus is visible on every stop`, reached.length >= 10 && invisible.length === 0 && reached.every((f) => !f.hidden), `${reached.length} stops; without a visible focus: ${JSON.stringify(invisible.slice(0, 4))}`);
  // Realistic (grounded) and Observer (none): the HUD and dock
  await newWorld(page, 'Realistic');
  await audit(page, `${label}: game HUD (Realistic)`);
  await newWorld(page, 'Observer');
  await audit(page, `${label}: game HUD (Observer)`);
  // the feed in other mediums (scroll or tablet; broadsheet; broadcast)
  for (const [preset, secs] of [['Age of Kingdoms', 5], ['Industrializing World', 4], ['Modern Geopolitics', 4]]) {
    await newWorld(page, preset, secs);
    await page.getByLabel('News feed', { exact: true }).click();
    await page.waitForTimeout(300);
    const m = await page.locator('aside.sheet').getAttribute('data-medium');
    await audit(page, `${label}: feed (${m})`);
    await close(page);
  }
  await browser.close();
}

// reflow (1.4.10) at 320 CSS px and text spacing (1.4.12): nothing scrolls sideways or gets clipped
async function reflow() {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, bypassCSP: true });
  const page = await ctx.newPage();
  await newWorld(page, 'Primitive Earth', 6);
  const spacing = '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }';
  for (const [name, sheet] of [['News feed', 'feed'], ['Nations', 'nations'], ['Statistics', 'statistics']]) {
    await page.getByLabel(name, { exact: true }).click();
    await page.waitForTimeout(300);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`reflow 320: ${sheet} has no sideways scroll`, sw <= 320, `scrollWidth ${sw}`);
    await page.addStyleTag({ content: spacing });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('aside.sheet *')].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.overflow === 'hidden' || cs.overflowX === 'hidden') && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && e.textContent.trim().length > 0 && e.children.length === 0;
    }).map((e) => e.className || e.tagName).slice(0, 5));
    check(`text spacing: ${sheet} clips no text`, clipped.length === 0, JSON.stringify(clipped));
    await close(page);
    await page.reload();
    await page.waitForSelector('canvas.canvas', { timeout: 30000 }).catch(() => {});
    if (!(await page.locator('canvas.canvas').count())) await newWorld(page, 'Primitive Earth', 6);
  }
  await browser.close();
}

await run('phone', { ...devices['iPhone 13'] });
await run('desktop', { viewport: { width: 1280, height: 800 } });
await reflow();
mkdirSync('tools/output', { recursive: true });
writeFileSync(`tools/output/a11y-${engineName}.json`, JSON.stringify(minor, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} accessibility checks passed (${engineName}); ${minor.length} moderate/minor findings in tools/output/a11y-${engineName}.json`);
process.exit(failed ? 1 : 0);
