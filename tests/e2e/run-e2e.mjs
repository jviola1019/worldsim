// End-to-end smoke test in emulated iPhone 13 (touch) and desktop Chromium.
// Requires a build served at URL (default: npm run build && npm run preview -- --port 4173).
//   node tests/e2e/run-e2e.mjs
// Checks: no console errors; world creation; time advances; tool selection; tap-to-inspect;
// layers sheet incl. past-borders slider; nations list with flags; news feed; manual save to IndexedDB.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, webkit, devices } = pw;
// BROWSER=webkit runs the same checks on WebKit (Safari's engine; still emulation, not a real iPhone)
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
console.log(`engine: ${process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium'}`);
const url = process.env.URL ?? 'http://localhost:4173/';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };

async function run(label, ctxOpts) {
  // mobile WebKit has no mouse wheel: zoom with the keyboard (+ / -) there
  const noWheel = process.env.BROWSER === 'webkit' && !!ctxOpts.isMobile;
  const zoom = async (page, steps, dy) => {
    for (let k = 0; k < Math.abs(steps); k++) {
      if (noWheel) await page.keyboard.press(dy < 0 ? '+' : '-');
      else await page.mouse.wheel(0, dy);
      await page.waitForTimeout(20);
    }
  };
  const reduced = ctxOpts.reducedMotion === 'reduce';
  const browser = await engine.launch();
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
  // round 10: an honest count, wandering bands are tribes, not nations
  const hud0 = (await page.locator('.world-card').innerText()).replace(/\n/g, ' | ');
  // a band may already have settled in the first months, so a nation is fine; most peoples still wander as tribes
  const m0 = hud0.match(/(\d+)\s+nations?/), t0 = hud0.match(/(\d+)\s+tribes?/);
  check(`${label}: HUD counts tribes at year 0`, !!t0 && Number(t0[1]) > Number(m0?.[1] ?? 0), hud0);
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
  const aerialBlocks = Number(await page.locator('.photo canvas').first().getAttribute('data-blocks'));
  check(`${label}: aerial photo shows the close-up city blocks`, aerialBlocks > 0, `${aerialBlocks} blocks`);
  await page.getByRole('tab', { name: 'Album' }).click();
  await page.waitForTimeout(300);
  check(`${label}: album tab opens`, (await page.locator('.album, .sheet-body p.muted').count()) > 0);
  // round 10: the nation's tabs sit on one row you can swipe, arrow keys move between them (ARIA tabs),
  // Follow and Favourite live in the header, and the Feed tab shows its first post without scrolling
  const tabs = await page.evaluate(() => {
    const list = document.querySelector('aside.sheet .tabs[role=tablist]');
    const btns = [...list.querySelectorAll('[role=tab]')];
    return { rows: new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top))).size, swipes: list.scrollWidth > list.clientWidth || btns.length <= 4 };
  });
  await page.getByRole('tab', { name: 'Album' }).focus();
  await page.keyboard.press('ArrowRight');
  const nextSel = await page.getByRole('tab', { name: 'History' }).getAttribute('aria-selected');
  const nextFocus = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press('Home');
  const homeSel = await page.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected');
  const head = await page.evaluate(() => ['follow', 'favorite'].map((id) => {
    const b = document.querySelector(`aside.sheet .sheet-head [data-testid=${id}]`);
    const r = b?.getBoundingClientRect();
    return b ? !!b.getAttribute('aria-label') && r.width >= 44 && r.height >= 44 : false;
  }));
  check(`${label}: nation tabs on one row, arrow keys, header actions`, tabs.rows === 1 && tabs.swipes && nextSel === 'true' && /History/.test(nextFocus ?? '') && homeSel === 'true' && head.every(Boolean), JSON.stringify({ tabs, nextSel, nextFocus, homeSel, head }));
  await page.getByRole('tab', { name: 'Feed' }).click();
  await page.waitForTimeout(300);
  const firstPost = await page.evaluate(() => {
    const body = document.querySelector('aside.sheet .sheet-body').getBoundingClientRect();
    const post = document.querySelector('aside.sheet article.post')?.getBoundingClientRect();
    return post ? { visible: Math.round(Math.min(post.bottom, body.bottom) - post.top), height: Math.round(post.height), offset: Math.round(post.top - body.top) } : null;
  });
  check(`${label}: the Feed tab shows its first post`, !!firstPost && firstPost.visible >= Math.min(firstPost.height, 120), JSON.stringify(firstPost));
  await page.getByRole('tab', { name: 'Album' }).click();
  await page.getByLabel('Close').first().click();
  // news feed: posts in the medium of their time
  await page.getByLabel('News feed').click();
  await page.waitForTimeout(300);
  const posts = await page.locator('article.post').count();
  const medium = posts ? await page.locator('article.post').first().getAttribute('class') : '';
  check(`${label}: news feed shows posts`, posts > 0, `${posts} posts (${medium})`);
  // round 10: the whole sheet wears the medium, and the posts scroll as one list
  const sheetSel = 'aside.sheet[aria-label="News feed"]';
  const worn = await page.evaluate((sel) => {
    const sh = document.querySelector(sel);
    const frame = sh?.querySelector('.feed-frame');
    return { sheet: sh?.getAttribute('data-medium'), frame: frame?.getAttribute('data-medium'), bg: sh ? getComputedStyle(sh).backgroundColor : '' };
  }, sheetSel);
  check(`${label}: feed sheet wears its medium`, !!worn.sheet && worn.sheet === worn.frame && worn.bg !== 'rgb(20, 28, 48)', JSON.stringify(worn));
  const scrollers = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} *`)].filter((e) => {
    const oy = getComputedStyle(e).overflowY;
    return (oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1 && !e.classList.contains('sheet-body');
  }).map((e) => e.className), sheetSel);
  const body = page.locator(`${sheetSel} .sheet-body`);
  const box = await body.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const st0 = await body.evaluate((e) => e.scrollTop);
  await page.mouse.wheel(0, 600).catch(() => {});
  await page.waitForTimeout(300);
  let st1 = await body.evaluate((e) => e.scrollTop);
  if (st1 === st0) { await body.focus().catch(() => {}); await page.keyboard.press('PageDown'); await page.waitForTimeout(300); st1 = await body.evaluate((e) => e.scrollTop); }
  check(`${label}: feed scrolls as one list`, scrollers.length === 0 && st1 > st0, `inner scrollers: ${JSON.stringify(scrollers)}; scrollTop ${st0} → ${st1}`);
  if (posts >= 20) {
    await body.evaluate((e) => { e.scrollTop = e.scrollHeight; });
    await page.waitForTimeout(800);
    const more = await page.locator('article.post').count();
    const button = await page.locator(`${sheetSel} button`, { hasText: 'Older posts' }).count();
    check(`${label}: older posts load on scroll`, more > posts || button === 0, `${posts} → ${more}, older-posts button ${button ? 'still shown' : 'gone (no more)'}`);
  }
  const chip = page.locator(`${sheetSel} .filters button`).nth(1);
  if (await chip.count()) {
    await body.evaluate((e) => { e.scrollTop = 400; });
    await chip.click();
    await page.waitForTimeout(300);
    const after = await page.evaluate((sel) => ({ top: document.querySelector(`${sel} .sheet-body`).scrollTop, sheet: document.querySelector(sel).getAttribute('data-medium'), frame: document.querySelector(`${sel} .feed-frame`)?.getAttribute('data-medium') }), sheetSel);
    check(`${label}: switching whose news resets the scroll and the medium`, after.top === 0 && !!after.sheet && after.sheet === after.frame, JSON.stringify(after));
  }
  await page.getByLabel('Close').first().click();
  // close-up city: zoom into the capital; streets of the 32-px blocks must be on screen
  await page.getByLabel('Nations').click();
  await page.locator('.sheet-body ul.list li button').first().click();
  await page.waitForTimeout(300);
  const showCap = page.getByText('Show capital');
  if (await showCap.count()) await showCap.first().click();
  await page.waitForTimeout(400);
  await page.getByLabel('Close').first().click().catch(() => {});
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await zoom(page, noWheel ? 16 : 30, -300);
  await page.waitForTimeout(1500);
  const cityChunks = Number(await page.locator('canvas.canvas').getAttribute('data-city-chunks'));
  check(`${label}: close-up city blocks drawn when zoomed in`, cityChunks > 0, `${cityChunks} close-up chunks on screen`);
  // round 9: up close, people are drawn at a readable size, and tapping one of the real people opens that person
  const peopleUp = Number(await page.locator('canvas.canvas').getAttribute('data-people'));
  check(`${label}: zoomed in, people are drawn up close`, peopleUp > 0, `${peopleUp} people`);
  const spot = await page.locator('canvas.canvas').getAttribute('data-person-at');
  if (spot) {
    const [px, py] = spot.split(',').map(Number);
    await page.mouse.click(px, py);
    await page.waitForTimeout(400);
    const kind = await page.locator('aside.sheet').first().getAttribute('data-kind').catch(() => null);
    check(`${label}: tapping a person up close opens that person`, kind === 'person', `opened ${kind}`);
    await page.getByLabel('Close').first().click().catch(() => {});
  } else check(`${label}: tapping a person up close opens that person`, false, 'no real person on screen');
  // round 7: the capital's inspector lists jobs, homes, and streets and traffic
  // open the capital from its nation's panel
  await page.getByLabel('Nations').click();
  await page.locator('.sheet-body ul.list li button').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid=open-capital]').first().click();
  await page.waitForTimeout(400);
  const jobRows = await page.locator('[data-testid=jobs] .row').count();
  const trafficKv = await page.locator('[data-testid=traffic]').count();
  check(`${label}: settlement shows its jobs and its streets and traffic`, jobRows > 0 && trafficKv === 1, `${jobRows} job rows, traffic panel ${trafficKv}`);
  // round 9: follow the capital and make it a favourite
  await page.locator('[data-testid=follow]').first().click();
  const followed = await page.locator('[data-testid=follow]').first().getAttribute('aria-pressed');
  await page.locator('[data-testid=favorite]').first().click();
  const fav = await page.locator('[data-testid=favorite]').first().getAttribute('aria-pressed');
  check(`${label}: follow and favourite from the panel`, followed === 'true' && fav === 'true', `follow ${followed}, favourite ${fav}`);
  await page.locator('[data-testid=follow]').first().click();
  // round 7: interface motion follows the setting (200 ms sheet entrance; none under Reduce motion)
  const anim = await page.locator('.sheet').first().evaluate((el) => { const cs = getComputedStyle(el); return { name: cs.animationName, dur: cs.animationDuration }; }).catch(() => ({ name: '?', dur: '?' }));
  if (reduced) check(`${label}: sheets do not animate under Reduce motion`, anim.name === 'none' || anim.dur === '0s', `${anim.name} ${anim.dur}`);
  else check(`${label}: sheets open with the 200 ms entrance`, anim.name !== 'none' && anim.dur === '0.2s', `${anim.name} ${anim.dur}`);
  await page.getByLabel('Close').first().click().catch(() => {});
  // round 7: a god power used through the real dock shows its effect where it lands, which moves and then ends
  // (under Reduce motion it is a still marker)
  await page.getByLabel('Disasters').click();
  await page.locator('.tool', { hasText: 'Earthquake' }).first().click();
  await page.mouse.click(vp.width / 2, vp.height / 2 + 40);
  // let the map redraw what the quake destroyed (cached chunks repaint over a few frames), then sample the effect
  await page.waitForTimeout(700);
  const fxNow = (await page.locator('canvas.canvas').getAttribute('data-fx')) ?? '';
  // movement is read from the renderer's hook (ring size and sprite frame of each effect drawn), not from a screen
  // clip: the world is random, so a fixed clip could miss the ring (CI #42 failed that way on the phone)
  const motionOf = async () => (await page.locator('canvas.canvas').getAttribute('data-fx-motion')) ?? '';
  let changes = 0;
  let prev = await motionOf();
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(150);
    const next = await motionOf();
    if (next !== prev) changes++;
    prev = next;
  }
  await page.waitForTimeout(3000);
  const fxLater = (await page.locator('canvas.canvas').getAttribute('data-fx')) ?? '';
  check(`${label}: an earthquake shows its effect and ring, then it ends`, fxNow.includes('fx.quake') && !fxLater.includes('fx.quake'), `now "${fxNow}", later "${fxLater}"`);
  if (reduced) check(`${label}: under Reduce motion the effect is a still marker`, changes <= 1, `${changes} of 3 samples changed`);
  else check(`${label}: the effect animates`, changes >= 2, `${changes} of 3 samples changed (last: ${prev})`);
  await page.getByLabel('Stop using this power').click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await diseaseAndEruption(page, label, reduced);
  if (label === 'desktop') {
    // cache pressure: a big screen just past the close-up threshold wants more chunks than the cache
    // holds; the layer must settle (nothing pending) with at most 48 chunks drawn
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.mouse.move(960, 540);
    for (let k = 0; k < 40; k++) {
      await page.mouse.wheel(0, 120); await page.waitForTimeout(40);
      if (Number(await page.locator('canvas.canvas').getAttribute('data-city-chunks')) === 0) break;
    }
    await page.mouse.wheel(0, -160);
    await page.waitForTimeout(4000);
    const attr = async (n) => page.locator('canvas.canvas').getAttribute(n);
    const r0 = await attr('data-city-redraws');
    await page.waitForTimeout(2000);
    const r1 = await attr('data-city-redraws');
    const drawnBig = Number(await attr('data-city-chunks'));
    const pendingBig = await attr('data-city-pending');
    // settled: chunks drawn within the cap, nothing pending, and no chunk redrawn in 2 s of a still view
    check(`${label}: close-up settles on a 1920x1080 screen (no thrash)`, drawnBig > 0 && drawnBig <= 48 && pendingBig === '0' && r0 !== null && r0 === r1, `${drawnBig} drawn, ${pendingBig} pending, redraws ${r0} -> ${r1}`);
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  await zoom(page, noWheel ? 16 : 30, 300);
  // save
  await page.getByLabel('Menu').click();
  const save = page.getByText(/^Save/).first();
  if (await save.count()) { await save.click(); await page.waitForTimeout(800); }
  const saved = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('epoch-saves'); r.onsuccess = () => { const db = r.result; res([...db.objectStoreNames].length); }; r.onerror = () => res(0); }));
  check(`${label}: IndexedDB save store exists`, saved > 0);
  // round 9: the load screen groups saves by device; this save started on this device
  await page.getByLabel('Close').first().click().catch(() => {});
  const menu2 = page.getByLabel('Menu');
  if (await menu2.count()) {
    await menu2.click();
    const leave = page.getByText('Leave to title');
    if (await leave.count()) {
      await leave.click();
      await page.getByText(/^Load|Continue|Saved worlds/).first().click().catch(() => {});
      await page.waitForTimeout(600);
      const groupTitle = await page.locator('.device-title').first().innerText().catch(() => '');
      check(`${label}: saves are grouped by the device they started on`, groupTitle.startsWith('Started on this device'), groupTitle || 'no device group');
    }
  }
  const csp = await page.evaluate(() => window.__csp);
  check(`${label}: no CSP violations`, csp.length === 0, csp.slice(0, 3).join(' | '));
  const fonts = await page.evaluate(() => document.fonts.check('16px "Pixelify Sans"'));
  check(`${label}: self-hosted Pixelify Sans loaded`, fonts);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  // round 8: the interactive code guide loads and draws under the same CSP
  if (label === 'desktop') {
    const g = await ctx.newPage();
    const gErr = [];
    g.on('pageerror', (e) => gErr.push(String(e)));
    g.on('console', (m) => { if (m.type() === 'error') gErr.push(m.text()); });
    await g.goto(new URL('guide/', url).href);
    await g.waitForTimeout(800);
    const nodes = await g.locator('#mapsvg .node').count();
    const bars = await g.locator('#chart-unemp rect.after').count(); // round 10: bars are 'before' and 'after' (latest two rounds)
    check(`${label}: the code guide draws its map and charts with no errors`, nodes > 10 && bars >= 4 && gErr.length === 0, `${nodes} folders, ${bars} bars, ${gErr.length} errors ${gErr.slice(0, 2).join(' | ')}`);
    await g.close();
  }
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

// round 10: the HUD card at 320 px with a long world name: no overlap with the speed controls, no sideways scroll,
// and the people/nation line is shown whole (it wraps, never cut off with an ellipsis)
async function narrow() {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByText('New world').first().click();
  await page.locator('#wname').fill('The Exceedingly Long-Named World of Q');
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  const m = await page.evaluate(() => {
    const card = document.querySelector('.world-card').getBoundingClientRect();
    const play = document.querySelector('.playback').getBoundingClientRect();
    const overlap = !(card.right <= play.left || play.right <= card.left || card.bottom <= play.top || play.bottom <= card.top);
    const line = [...document.querySelectorAll('.world-card .era')].find((e) => /people/.test(e.textContent));
    return { overlap, sw: document.documentElement.scrollWidth, cut: line ? line.scrollWidth > line.clientWidth + 1 : true };
  });
  check('narrow 320: HUD card clear of the speed controls, whole, no sideways scroll', !m.overlap && m.sw <= 320 && !m.cut, JSON.stringify(m));
  await browser.close();
}

// round 10: Realistic is a grounded sandbox: empty at year 0, a hint to place the first humans, and only
// grounded tools (Peoples offers Humans alone; no Warfare, Technology or Laws categories)
async function realistic() {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByText('New world').first().click();
  await page.locator('button.preset', { hasText: /^Realistic/ }).click();
  const slowPressed = await page.locator('[data-testid=pace] button', { hasText: 'Slow' }).getAttribute('aria-pressed');
  check('realistic: Slow pace is chosen', slowPressed === 'true', String(slowPressed));
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 });
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  const hud = await page.locator('.world-card').innerText();
  const note = await page.locator('.realism-note').innerText().catch(() => '');
  const cats = await page.locator('.cat-row .cat').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await page.getByLabel('Peoples').click();
  const people = await page.locator('.tool-row .tool span').allInnerTexts();
  check('realistic: empty at year 0 with a hint to place the first humans', /Year 0/.test(hud) && /No people yet/.test(hud) && /Humans/.test(note), `${hud.replace(/\n/g, ' | ')} / ${note}`);
  check('realistic: only grounded tools', JSON.stringify(people) === JSON.stringify(['Inspect', 'Humans']) && !cats.includes('Warfare') && !cats.includes('Technology') && !cats.includes('World laws'), `${cats.join(',')} / ${people.join(',')}`);
  // round 10 addendum: Realistic places only people and animals (no land tools, no disasters), every real species
  check('realistic: the dock offers only Peoples and Nature', JSON.stringify([...cats].sort()) === JSON.stringify(['Nature', 'Peoples']), cats.join(','));
  await page.getByLabel('Nature').click();
  const animals = await page.locator('.tool-row .tool span').allInnerTexts();
  check('realistic: every real animal can be placed (24), elephants and seals included', animals.length === 25 && animals.includes('Elephants') && animals.includes('Seals') && !animals.includes('Monster'), `${animals.length - 1} animals`);
  await page.getByLabel('Peoples').click();
  await dropHand(page, 'realistic');
  await browser.close();
  // the same drop under Reduce motion is one still frame
  const b2 = await engine.launch();
  const c2 = await b2.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p2 = await c2.newPage();
  await p2.goto(url);
  await p2.getByText('New world').first().click();
  await p2.locator('button.preset', { hasText: /^Realistic/ }).click();
  await p2.getByText('Create world').click();
  await p2.waitForSelector('canvas.canvas', { timeout: 30000 });
  if (await p2.getByText('Skip').count()) await p2.getByText('Skip').click();
  await p2.getByLabel('Peoples').click();
  await dropHand(p2, 'realistic (Reduce motion)', true);
  await b2.close();
}

// starts, disease, predators (Task 2): three start cards, an era setting capped at Atomic & Space that sets the
// starting peoples, Alien planet in God mode only, and a confirmation dialog before a start after Prehistoric
async function startScreen() {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.getByText('New world').first().click();
  const cards = await page.locator('[data-testid=starts] button.preset strong').allInnerTexts();
  check('new world: exactly three starts (Realistic, God mode, Observer)', JSON.stringify(cards) === JSON.stringify(['Realistic', 'God mode', 'Observer']), cards.join(', '));
  const era = page.getByRole('slider', { name: 'Start in era' });
  const maxLabel = (await page.locator('[data-testid=era-max]').innerText().catch(() => '')).trim();
  check('new world: the era setting ends at Atomic & Space', maxLabel === 'Atomic & Space' && (await era.getAttribute('max').catch(() => null)) === '10', `"${maxLabel}"`);
  // era 1: no dialog, the world starts at once
  await page.getByText('Create world').click();
  await page.waitForSelector('canvas.canvas', { timeout: 30000 }).catch(() => {});
  check('new world: a Prehistoric start opens no dialog', (await page.locator('canvas.canvas').count()) === 1 && (await page.getByRole('dialog', { name: /^Start in the/ }).count()) === 0);
  await page.goto(url);
  await page.getByText('New world').first().click();
  await era.fill('4').catch(() => {});
  const peoples = await page.getByRole('slider', { name: 'Starting peoples' }).inputValue().catch(() => '');
  check('new world: moving the era to 4 sets 8 starting peoples', peoples === '8', `peoples ${peoples}`);
  const create = page.getByRole('button', { name: 'Create world' });
  await create.click();
  const dlg = page.getByRole('dialog', { name: /^Start in the/ }); // the tutorial is a dialog too
  await dlg.waitFor({ timeout: 3000 }).catch(() => {});
  const shown = await dlg.isVisible().catch(() => false);
  const named = shown ? await dlg.getAttribute('aria-labelledby').then((id) => page.locator(`#${id}`).innerText()).catch(() => '') : '';
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  for (let k = 0; k < 4; k++) await page.keyboard.press('Tab');
  const trapped = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog], dialog'));
  check('new world: Create world at era 4 asks first (dialog, title, focus on Cancel, focus stays inside)', shown && /Iron & Classical/.test(named) && first === 'Cancel' && trapped, `shown ${shown}, title "${named}", focus "${first}", trapped ${trapped}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = (await dlg.count()) === 0 || !(await dlg.isVisible());
  const back = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check('new world: Escape cancels: no world, focus back on Create world', closed && (await page.locator('canvas.canvas').count()) === 0 && back === 'Create world', `closed ${closed}, focus "${back}"`);
  await create.click();
  await dlg.getByRole('button', { name: /^Start in Iron & Classical/ }).click().catch(() => {});
  await page.waitForSelector('canvas.canvas', { timeout: 30000 }).catch(() => {});
  const skip = page.getByText('Skip');
  if (await skip.count()) await skip.click();
  const hud = await page.locator('.world-card').innerText().catch(() => '');
  check('new world: confirming starts the world in the Iron & Classical era', /Iron & Classical/.test(hud), hud.replace(/\n/g, ' | '));
  // Realistic: Alien planet is God mode only
  await page.goto(url);
  await page.getByText('New world').first().click();
  await page.locator('[data-testid=starts] button.preset', { hasText: /^Realistic/ }).click();
  const alien = page.getByRole('checkbox', { name: /Alien planet/ });
  const alienOff = (await alien.count()) === 1 && (await alien.isDisabled());
  await page.locator('[data-testid=starts] button.preset', { hasText: /^God mode/ }).click();
  const alienOn = (await alien.count()) === 1 && !(await alien.isDisabled());
  check('new world: Alien planet is off in Realistic and open in God mode', alienOff && alienOn, `realistic disabled ${alienOff}, god enabled ${alienOn}`);
  check('new world: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
}

/**
 * Round 10 second addendum (Task 7): realistic disease and eruption visuals through the real dock. The camera is on
 * the capital (followed earlier). A plague there shows the sickness pall (not a skull) and the sick-town marker; the
 * pall ends, and once time runs the town recovers and the marker goes. An eruption nearby animates (5 samples);
 * under Reduce motion both are still.
 */
async function diseaseAndEruption(page, label, reduced) {
  const canvas = page.locator('canvas.canvas');
  const vp = page.viewportSize();
  const attr = async (n) => (await canvas.getAttribute(n)) ?? '';
  // the Disasters tools may still be open from the earthquake
  const openDisasters = async () => { if (!(await page.getByRole('toolbar', { name: 'Disasters' }).count())) await page.getByRole('button', { name: 'Disasters' }).click(); };
  await openDisasters();
  await page.locator('.tool', { hasText: 'Plague' }).first().click();
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(400);
  const fx0 = await attr('data-fx');
  const sick0 = Number(await attr('data-sick'));
  const pulses = [];
  for (let k = 0; k < 5; k++) { pulses.push(`${await attr('data-fx-motion')}|${await attr('data-sick-pulse')}`); await page.waitForTimeout(250); }
  check(`${label}: a plague shows the sickness pall and the sick-town marker (no skull)`, fx0.includes('fx.pall') && !fx0.includes('fx.skull') && sick0 >= 1, `fx "${fx0}", sick towns ${sick0}`);
  if (reduced) check(`${label}: under Reduce motion the pall and the marker are still`, pulses.every((x) => x === pulses[0]), pulses.join(' / '));
  else check(`${label}: the pall drifts and the marker pulses`, new Set(pulses.map((x) => x.split('|')[0])).size >= 3 && new Set(pulses.map((x) => x.split('|')[1])).size >= 2, pulses.join(' / '));
  await page.waitForTimeout(3000);
  const fx1 = await attr('data-fx');
  check(`${label}: the pall ends`, !fx1.includes('fx.pall'), `later "${fx1}"`);
  await page.getByLabel('Stop using this power').click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  // let time run until the town recovers (a divine plague lasts about a year)
  await page.getByLabel('Max', { exact: true }).click();
  let sick1 = sick0;
  for (let k = 0; k < 40 && sick1 > 0; k++) { await page.waitForTimeout(500); sick1 = Number(await attr('data-sick')); }
  await page.getByLabel('Paused', { exact: true }).click();
  check(`${label}: the sick-town marker goes when the town recovers`, sick1 === 0, `sick towns ${sick0} → ${sick1}`);
  // an eruption a little way off: the ash column rises (sprite frames and ring change), or one still under Reduce motion
  await openDisasters();
  await page.locator('.tool', { hasText: 'Eruption' }).first().click();
  await page.mouse.click(vp.width / 2 - Math.min(120, vp.width / 4), vp.height / 2 + 30);
  await page.waitForTimeout(200);
  const fxE = await attr('data-fx');
  const samples = [];
  for (let k = 0; k < 5; k++) { samples.push(await attr('data-fx-motion')); await page.waitForTimeout(300); }
  const frames = new Set(samples.map((x) => (x.match(/f(\d+);/) ?? [])[1]));
  check(`${label}: an eruption plays the ash column (not the generic explosion)`, fxE.includes('fx.eruption') && !fxE.includes('fx.explosion'), `fx "${fxE}"`);
  if (reduced) check(`${label}: under Reduce motion the eruption is one still`, samples.every((x) => x === samples[0]), samples.join(' / '));
  else check(`${label}: the eruption animates (5 samples)`, new Set(samples).size >= 4 && frames.size >= 2, samples.join(' / '));
  await page.getByLabel('Stop using this power').click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

/** Round 10 addendum: pick Humans, check the hover hand, then tap until dry land takes the band; the hand plays. */
async function dropHand(page, label, reduced = false) {
  await page.locator('.tool', { hasText: 'Humans' }).first().click();
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(150);
  const hover = await page.locator('canvas.canvas').getAttribute('data-hand');
  check(`${label}: an open hand hovers under the pointer while placing`, hover === 'on', String(hover));
  // switching to Inspect with the keyboard (the pointer has not moved) takes the hand away; picking Humans again brings it back on the next move
  await page.locator('.tool', { hasText: 'Inspect' }).first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const afterKey = await page.locator('canvas.canvas').getAttribute('data-hand');
  check(`${label}: switching to Inspect by keyboard hides the hand`, afterKey === 'off', String(afterKey));
  await page.locator('.tool', { hasText: 'Humans' }).first().click();
  await page.mouse.move(vp.width / 2 + 3, vp.height / 2 + 3);
  await page.waitForTimeout(150);
  const canvas = page.locator('canvas.canvas');
  let fx = '';
  outer: for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7]) for (const fxp of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    await page.mouse.click(vp.width * fxp, vp.height * fy);
    await page.waitForTimeout(80);
    fx = (await canvas.getAttribute('data-fx')) ?? '';
    if (fx.includes('fx.hand')) break outer;
  }
  // several samples while the hand plays: a slow runner can skip frames between two samples (CI #83, WebKit)
  const samples = [];
  for (let k = 0; k < 5; k++) { samples.push((await canvas.getAttribute('data-fx-motion')) ?? ''); await page.waitForTimeout(120); }
  const m1 = samples[0], m2 = samples.find((x) => x !== m1) ?? samples[samples.length - 1];
  await page.waitForTimeout(800);
  const later = (await canvas.getAttribute('data-fx')) ?? '';
  const hud = await page.locator('.world-card').innerText();
  check(`${label}: dropping humans plays the hand, which then ends`, fx.includes('fx.hand') && !later.includes('fx.hand'), `now "${fx}", later "${later}"`);
  if (reduced) check(`${label}: the hand is one still frame`, samples.every((x) => x === m1 || x === '') && m1.includes('hand-still'), samples.join(' / '));
  else check(`${label}: the hand moves (descends, opens, lifts)`, m1 !== m2 && /hand\d/.test(m1 + m2), samples.join(' / '));
  check(`${label}: the dropped band is on the map (1 tribe)`, /1\s+tribe/.test(hud), hud.replace(/\n/g, ' | '));
  await page.getByLabel('Stop using this power').click().catch(() => {});
}

await startScreen();
await realistic();
await narrow();
await run('phone', { ...devices['iPhone 13'] });
await run('desktop', { viewport: { width: 1280, height: 800 } });
await run('reduced', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
