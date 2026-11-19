// Design review capture (round 6): every screen at five device sizes, plus measured design metrics.
//   npm run build && npx vite preview --port 4173 &   node tools/design-capture.mjs [outDir]
// Writes <outDir>/<device>/<screen>.png and <outDir>/metrics.json, and prints a summary:
// text under 12 CSS px, touch targets under 44 px (touch devices), text below WCAG AA contrast,
// and every CSS transition/animation duration in use.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
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

/** Measured in the page: small text, small targets, low contrast, motion durations. */
function measure(touch) {
  const lum = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
  };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      // gradient backgrounds (era frames: scroll, broadsheet...): use the gradient's first colour
      const grad = st.backgroundImage && st.backgroundImage.includes('gradient') ? st.backgroundImage.match(/rgba?\([^)]+\)/) : null;
      if (grad) { const g = lum(grad[0]); if (g && g.a > 0.6) return g.L; }
      const l = lum(st.backgroundColor);
      if (l && l.a > 0.6) return l.L;
    }
    return lum('rgb(13,20,36)').L; // the app background
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const smallText = [], lowContrast = [], smallTargets = [], motion = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.transitionDuration && s.transitionDuration !== '0s') motion.add(`transition ${s.transitionDuration} ${s.transitionTimingFunction}`);
    if (s.animationName && s.animationName !== 'none') motion.add(`animation ${s.animationName} ${s.animationDuration}`);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (hasText) {
      const fs = parseFloat(s.fontSize);
      if (fs < 12) smallText.push(`${sel(el)} ${fs}px "${el.textContent.trim().slice(0, 30)}"`);
      const fg = lum(s.color);
      if (fg) {
        const bg = bgOf(el);
        const ratio = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(s.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${sel(el)} ${ratio.toFixed(2)}:1 "${el.textContent.trim().slice(0, 30)}"`);
      }
    }
    if (touch && el.matches('button, a[href], input, select, [role=tab], [role=button]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) smallTargets.push(`${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`);
    }
  }
  return { smallText, lowContrast, smallTargets, motion: [...motion] };
}

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
