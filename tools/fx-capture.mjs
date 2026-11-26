// Round 10 second addendum (Task 7): capture every disaster and disease effect for the design review, at 2x.
//   node tools/fx-capture.mjs                 (starts its own Vite dev server; writes tools/output/fx/*.png)
//   OUT=<dir> REDUCED=1 ZOOM=2 SEED=<seed> SCALE=2 ONLY=volcano,storm node tools/fx-capture.mjs
// The dev server serves the source modules, so the tool can reach the running world: it wraps Renderer.frame to
// find the renderer (and through it the world and camera), then sets off each effect through the real code path
// (a god power, a disaster, a logged event or a pandemic closing). Capture-only: nothing here ships in the game.
// Each effect is shot at several moments of its life around the place it plays; the aurora is shot across the top.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const OUT = process.env.OUT ?? 'tools/output/fx';
const SCALE = Number(process.env.SCALE ?? 2);
const REDUCED = process.env.REDUCED === '1';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
/** A pinned seed: before and after captures show the same world and the same sites (override with SEED=). */
const SEED = process.env.SEED ?? 'fx-capture-6'; // this seed's world has volcanic vents
/** ZOOM=2 shoots the same effects twice as close (the player's close zoom); clips grow with it, up to the view. */
const ZMUL = Number(process.env.ZOOM ?? 1);
const TIMES = REDUCED ? [300, 1500] : [120, 450, 900, 1600, 2600, 3800];
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: SCALE, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('page error:', String(e)));
await page.goto(url);
// find the renderer the game creates
await page.evaluate(async () => {
  const R = await import('/src/rendering/renderer.ts');
  const frame = R.Renderer.prototype.frame;
  R.Renderer.prototype.frame = function (dt) { window.__fxr = this; return frame.call(this, dt); };
});
await page.getByText('New world').first().click();
await page.locator('#wseed').fill(SEED);
await page.getByRole('slider', { name: 'Start in era' }).fill('6').catch(() => {});
await page.getByRole('button', { name: 'Create world' }).click();
await page.getByRole('dialog', { name: /^Start in the/ }).getByRole('button', { name: /^Start in/ }).click({ timeout: 5000 }).catch(() => {});
await page.waitForSelector('canvas.canvas', { timeout: 60000 });
if (await page.getByText('Skip').count()) await page.getByText('Skip').click();
await page.getByLabel('Paused').click();
await page.waitForFunction(() => !!window.__fxr);
await page.evaluate((z) => { window.__fxZoom = z; }, ZMUL);

/** Center the camera on a world tile at a zoom (screen px per art px) and return its screen position. */
const look = (x, y, zoom = 2.2) => page.evaluate(([x, y, zoom]) => {
  zoom *= window.__fxZoom ?? 1;
  const r = window.__fxr;
  r.cam.x = (x + 0.5) * 8;
  r.cam.y = (y + 0.5) * 8;
  r.cam.zoom = zoom;
  return r.cam.worldToScreen((x + 0.5) * 8, (y + 0.5) * 8);
}, [x, y, zoom]);

/** Places to play effects: the biggest towns, an inland tile and a coastal land tile near towns. */
const sites = await page.evaluate(() => {
  const sim = window.__fxr.sim;
  const m = sim.w.map;
  const towns = [...sim.w.settlements.values()].sort((a, b) => b.pop - a.pop).map((s) => ({ id: s.id, x: s.x, y: s.y, civ: s.civId }));
  let coast = null, inland = null, warmCoast = null, mildCoast = null;
  for (const t of towns) {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = t.x + dx, y = t.y + dy;
      if (!m.inBounds(x, y)) continue;
      const i = m.idx(x, y);
      if (!m.isLand(i)) continue;
      if (!coast && m.isCoastal(i)) coast = { x, y };
      // natural storm sites (warm coastal land, as environment.ts isStormSite), split at the cyclone sea temperature
      const site = m.isCoastal(i) && m.temp[i] > 20;
      if (site && !warmCoast && m.temp[i] >= 26.5) warmCoast = { x, y };
      if (site && !mildCoast && m.temp[i] < 26.5) mildCoast = { x, y };
      let water = 0;
      m.forRadius(x, y, 6, (j) => { if (!m.isLand(j)) water++; });
      if (!inland && water === 0) inland = { x, y };
    }
    if (coast && inland && warmCoast && mildCoast) break;
  }
  // storm sites anywhere on the map if none lies near a town
  for (let i = 0; i < m.n && !(warmCoast && mildCoast); i++) {
    if (!(m.isLand(i) && m.isCoastal(i) && m.temp[i] > 20)) continue;
    if (!warmCoast && m.temp[i] >= 26.5) warmCoast = { x: m.xOf(i), y: m.yOf(i) };
    if (!mildCoast && m.temp[i] < 26.5) mildCoast = { x: m.xOf(i), y: m.yOf(i) };
  }
  let vent = null; // a volcanic vent, where eruptions happen naturally (HAZARD.VENT = 8)
  for (let i = 0; i < m.n && !vent; i++) if (m.hazard[i] & 8) vent = { x: m.xOf(i), y: m.yOf(i) };
  return { towns, coast, inland, vent, warmCoast, mildCoast };
});
console.log(`world (seed ${SEED}): ${sites.towns.length} towns, coast ${JSON.stringify(sites.coast)}, inland ${JSON.stringify(sites.inland)}, vent ${JSON.stringify(sites.vent)}, warm coast ${JSON.stringify(sites.warmCoast)}, mild coast ${JSON.stringify(sites.mildCoast)}`);
if (!sites.vent) console.log('warning: no volcanic vent in this world; the volcano is captured inland');
if (sites.towns.length < 6) console.log('warning: few towns; some captures share a place');
const town = (k) => sites.towns[k % sites.towns.length];

/** Clear effects, run `fire` in the page (with the world, its modules and the site), then shoot over time. */
async function shoot(name, site, fire, opts = {}) {
  if (ONLY && !ONLY.has(name)) return;
  const [sx, sy] = await look(site.x, site.y, opts.zoom);
  await page.waitForTimeout(250); // let the chunks paint
  await page.evaluate(() => { window.__fxr.sim.fx.length = 0; });
  await page.evaluate(fire, site);
  const t0 = Date.now();
  const w = Math.min(900, (opts.w ?? 220) * ZMUL), h = Math.min(700, (opts.h ?? 200) * ZMUL);
  const clip = opts.top ? { x: 0, y: 0, width: 900, height: 240 } : { x: Math.max(0, sx - w / 2), y: Math.max(0, sy - h * 0.7), width: w, height: h };
  for (const ms of opts.times ?? TIMES) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    const file = `${OUT}/${name}${REDUCED ? '-reduced' : ''}${ZMUL !== 1 ? `-z${ZMUL}` : ''}-${String(ms).padStart(4, '0')}.png`;
    await page.screenshot({ path: file, clip });
    const c = page.locator('canvas.canvas');
    console.log(`${name} ${ms}ms: fx="${await c.getAttribute('data-fx')}" motion="${await c.getAttribute('data-fx-motion')}" sick="${await c.getAttribute('data-sick')}" aurora="${await c.getAttribute('data-aurora')}"`);
  }
}

const power = (id, r = 3) => async (site) => {
  const { applyPower } = await import('/src/powers/powers.ts');
  const sim = window.__fxr.sim;
  const res = applyPower(sim, window.__fxId, site.x, site.y, window.__fxR, { selectedCiv: site.civ ?? 0 });
  if (res !== null) console.log('power refused: ' + res);
};
async function viaPower(name, id, site, r = 3, opts) {
  await page.evaluate(([id, r]) => { window.__fxId = id; window.__fxR = r; }, [id, r]);
  await shoot(name, site, power(id, r), opts);
}

await viaPower('earthquake', 'dis_earthquake', town(1));
await viaPower('volcano', 'dis_volcano', sites.vent ?? sites.inland ?? town(2));
await viaPower('flood', 'dis_flood', town(3));
await viaPower('tsunami', 'dis_tsunami', sites.coast ?? town(4));
await viaPower('storm-inland', 'dis_storm', sites.inland ?? town(5));
// natural storms (radius 5 on warm coastal land): a hurricane over sea >= 26.5 C, else a squall
const naturalStorm = async (site) => {
  const { triggerDisaster, NATURAL_STORM_RADIUS } = await import('/src/world/environment.ts');
  triggerDisaster(window.__fxr.sim, 'storm', site.x, site.y, NATURAL_STORM_RADIUS ?? 5, true); // 5 before the constant existed
};
if (sites.warmCoast) await shoot('storm-coastal', sites.warmCoast, naturalStorm);
else console.log('warning: no coast warm enough for a hurricane in this world');
if (sites.mildCoast) await shoot('storm-mild-coast', sites.mildCoast, naturalStorm);
await viaPower('drought', 'dis_drought', town(6));
await viaPower('blizzard', 'dis_blizzard', town(7));
await viaPower('wildfire', 'dis_fire', sites.inland ?? town(8), 2);
await viaPower('lightning', 'dis_lightning', town(9));
await viaPower('meteor', 'dis_meteor', town(10));
await shoot('airburst', town(11), async (site) => {
  const { asteroidImpact } = await import('/src/world/catastrophes.ts');
  asteroidImpact(window.__fxr.sim, site.x, site.y, 'airburst');
});
await shoot('epidemic', town(0), async (site) => {
  const { logEvent } = await import('/src/history/events.ts');
  const { infect } = await import('/src/population/disease.ts');
  const sim = window.__fxr.sim;
  const s = sim.w.settlements.get(site.id);
  const d = { id: ++sim.w.ids.disease, name: 'Capture Fever', r0: 2, lethality: 0.01, duration: 1, immunity: 600, origin: s.id, emerged: sim.year, zoonotic: false, totalDeaths: 0 };
  sim.w.diseases.set(d.id, d);
  infect(sim, s, d, 0.05); // the town stays sick while the world is paused: its marker shows
  logEvent(sim, { type: 'epidemic', cat: 'demography', title: `Capture Fever in ${s.name}`, civs: [s.civId], settlements: [s.id], x: s.x, y: s.y, importance: 3 });
}, { w: 260, h: 220, zoom: 3.5 });
await viaPower('plague-power', 'dis_plague', town(12), 1);
await shoot('pandemic', town(0), async (site) => {
  const { closePandemics } = await import('/src/population/pandemic.ts');
  const sim = window.__fxr.sim;
  const origin = sim.w.settlements.get(site.id);
  const d = { id: ++sim.w.ids.disease, name: 'Capture Influenza', r0: 2, lethality: 0.01, duration: 1, immunity: 600, origin: origin.id, emerged: sim.year - 2, zoonotic: false, totalDeaths: 5e5, pandemic: true, worldPop: 2e6 };
  sim.w.diseases.set(d.id, d);
  // the towns near the origin were reached (they carry immunity); none is still sick, so the pandemic closes now
  const near = [...sim.w.settlements.values()].sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)).slice(0, 6);
  for (const s of near) { s.immunity[d.id] = 0.6; s.epidemics = s.epidemics.filter((e) => e.diseaseId !== d.id); }
  closePandemics(sim);
}, { zoom: 1.2, w: 420, h: 340 });
await shoot('geomagnetic', town(0), async () => {
  const { logEvent } = await import('/src/history/events.ts');
  logEvent(window.__fxr.sim, { type: 'geomagnetic_storm', cat: 'disaster', title: 'A geomagnetic storm knocked out power grids', importance: 3 });
}, { top: true, times: REDUCED ? [300, 1500] : [200, 900, 2000, 5000] });
await viaPower('solar-storm-power', 'emp', town(0), 3, { top: true, times: REDUCED ? [300, 1500] : [200, 900, 2500, 5000] });

await browser.close();
await server.close();
console.log(`captures in ${OUT}`);
