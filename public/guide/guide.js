// EPOCH code guide: interactive companion to docs/GUIDE.md. No dependencies; data from facts.json
// (tools/guide-facts.mjs) and balance.json (measured 1,000-year runs).
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, text) => {
  const e = tag.startsWith('svg:') ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};
const fmt = (n) => n.toLocaleString('en-US');

const ROLE = {
  core: 'base', config: 'base',
  rendering: 'out', ui: 'out', persistence: 'out', security: 'out', workers: 'out', '(root)': 'out',
};
const ABOUT = {
  sim: 'The heartbeat and world state: Simulation.step(), the types of everything saved, the yearly cycle of a nation, the effects registry.',
  world: 'The map as typed arrays, terrain, world generation, climate, catastrophes, pathfinding.',
  population: 'Individuals and age cohorts, births and deaths, the exact population ledger, migration, bands, disease.',
  civilizations: 'Nations, settlements, the city planner, territory, values (ethos), missions, endings.',
  economy: 'Monthly production and jobs, markets and public finance, trade and roads, occupations, traffic.',
  technology: '207 techs, research, discovery, adoption, diffusion, overtaking.',
  politics: 'Institutions and policies, government forms, diplomacy, succession.',
  military: 'Armies and battles, weapons by era, nuclear weapons.',
  culture: 'Religion, culture drift, languages and names, sport.',
  media: 'News outlets, polarization, artificial intelligence.',
  ecology: 'Animals, predators, vegetation, monsters.',
  future: 'Space programmes and existential risks.',
  history: 'Events with causes, statistics, the era-medium feed, the photo album.',
  powers: 'The 108 god powers, horrors (god mode only), undo.',
  scenarios: 'Optional scenario goals.',
  core: 'Seeded random numbers (sfc32), noise, math, time units.',
  config: 'Every balance number in one place; world laws and presets.',
  rendering: 'Everything drawn: chunk caches, zone caching, close-up city blocks, effects, photos, pixel art as code.',
  ui: 'Preact screens, panels and input.',
  persistence: 'The binary save format, validation of untrusted files, IndexedDB.',
  security: 'Content Security Policy and the frame check.',
  workers: 'World generation in a Web Worker.',
  '(root)': 'main.tsx: starts the app.',
};

async function load(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function stats(f) {
  const s = $('stats');
  const items = [[fmt(f.totals.srcFiles), 'source files'], [fmt(f.totals.srcLines), 'lines of code'], [String(f.folders.length), 'folders'], [String(f.totals.testFiles), 'test files']];
  for (const [b, t] of items) {
    const d = el('div', { class: 'stat' });
    d.append(el('b', {}, b), el('span', {}, t));
    s.append(d);
  }
  $('gen').textContent = `Facts generated ${f.generated} from the code by tools/guide-facts.mjs.`;
}

/** Folder map: base folders at the bottom, the simulation in a ring, presentation and storage on top. */
function codeMap(f) {
  const svg = $('mapsvg');
  const W = 720, H = 600;
  const groups = { base: [], sim: [], out: [] };
  for (const g of f.folders) groups[ROLE[g.name] ?? 'sim'].push(g);
  const pos = {};
  const maxLines = Math.max(...f.folders.map((g) => g.lines));
  const r = (g) => 10 + 34 * Math.sqrt(g.lines / maxLines);
  // the heartbeat in the middle, the other simulation folders in a ring around it
  const simG = groups.sim.filter((g) => g.name !== 'sim');
  pos.sim = [W / 2, 305];
  simG.forEach((g, k) => {
    const a = (k / simG.length) * Math.PI * 2 - Math.PI / 2;
    pos[g.name] = [W / 2 + Math.cos(a) * 250, 305 + Math.sin(a) * 165];
  });
  groups.base.forEach((g, k) => { pos[g.name] = [W / 2 + (k - (groups.base.length - 1) / 2) * 160, H - 30]; });
  groups.out.forEach((g, k) => { pos[g.name] = [80 + k * ((W - 160) / Math.max(1, groups.out.length - 1)), 52]; });
  const edges = [];
  const gEdges = el('svg:g');
  for (const g of f.folders) for (const [to, n] of Object.entries(g.deps)) {
    if (!pos[to]) continue;
    const [x1, y1] = pos[g.name], [x2, y2] = pos[to];
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    const p = el('svg:path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, class: 'edge' });
    p.dataset.from = g.name;
    p.dataset.to = to;
    p.setAttribute('stroke-width', String(Math.min(4, 0.6 + Math.log2(1 + n) * 0.5)));
    gEdges.append(p);
    edges.push(p);
  }
  svg.append(gEdges);
  const nodes = {};
  for (const g of f.folders) {
    const [x, y] = pos[g.name];
    const role = ROLE[g.name] ?? 'sim';
    const n = el('svg:g', { class: 'node', tabindex: '0', role: 'button', 'aria-label': `${g.name}: ${g.files} files, ${g.lines} lines` });
    const color = getComputedStyle(document.documentElement).getPropertyValue(role === 'base' ? '--base' : role === 'out' ? '--out' : '--sim');
    n.append(el('svg:circle', { cx: x, cy: y, r: r(g), fill: color.trim() }));
    n.append(el('svg:text', { x, y: y + r(g) + 14, 'text-anchor': 'middle' }, g.name));
    n.addEventListener('click', () => select(g.name));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.name); } });
    nodes[g.name] = n;
    svg.append(n);
  }
  const legend = el('div', { class: 'legend' });
  for (const [c, t] of [['sim', 'simulation'], ['base', 'foundation'], ['out', 'presentation, storage, security']]) {
    const s = el('span');
    s.append(el('span', { class: `sw ${c}` }), document.createTextNode(t));
    legend.append(s);
  }
  svg.after(legend);

  function select(name) {
    const g = f.folders.find((x) => x.name === name);
    for (const [k, n] of Object.entries(nodes)) {
      n.classList.toggle('sel', k === name);
      const linked = k === name || g.deps[k] || f.folders.find((x) => x.name === k)?.deps[name];
      n.classList.toggle('dim', !linked);
    }
    for (const e of edges) {
      const hot = e.dataset.from === name || e.dataset.to === name;
      e.classList.toggle('hot', hot);
      e.classList.toggle('dim', !hot);
    }
    const d = $('detail');
    d.replaceChildren();
    d.append(el('h3', {}, `src/${name === '(root)' ? '' : name + '/'}`));
    d.append(el('p', {}, ABOUT[name] ?? ''));
    d.append(el('p', { class: 'muted' }, `${g.files} files · ${fmt(g.lines)} lines · uses ${Object.keys(g.deps).length ? Object.keys(g.deps).sort().join(', ') : 'nothing'}`));
    const usedBy = f.folders.filter((x) => x.deps[name]).map((x) => x.name);
    d.append(el('p', { class: 'muted' }, `used by ${usedBy.length ? usedBy.sort().join(', ') : 'nothing'}`));
    const ul = el('ul');
    for (const file of f.files.filter((x) => x.folder === name)) {
      const li = el('li');
      li.append(el('code', {}, file.path.replace(/^src\//, '')), document.createTextNode(` (${fmt(file.lines)}) ${file.about ? '— ' + file.about : ''}`));
      ul.append(li);
    }
    d.append(ul);
  }
  select('sim');
}

/** The year wheel: 120 ticks; what runs on each. */
function timeline() {
  const svg = $('wheel');
  const cells = [];
  for (let t = 0; t < 120; t++) {
    const x = 4 + t * 5.95;
    const c = el('svg:rect', { x, y: 30, width: 5, height: t % 10 === 0 ? 60 : 40, class: t === 0 ? 'year' : t % 10 === 0 ? 'month' : '' });
    svg.append(c);
    cells.push(c);
  }
  svg.append(el('svg:text', { x: 4, y: 20, fill: 'currentColor', 'font-size': 12 }, 'day 0: world-wide yearly systems'));
  svg.append(el('svg:text', { x: 360, y: 20, fill: 'currentColor', 'font-size': 12 }, 'taller bars: slot 0 of each month'));
  const input = $('tick'), out = $('tickout'), runs = $('runs'), play = $('play');
  const MONTHS = ['Thaw', 'Bloom', 'Sowing', 'Rains', 'Highsun', 'Harvest', 'Gold', 'Ember', 'Frost', 'Dark', 'Deepwinter', 'Waking'];
  function show(t) {
    cells.forEach((c, k) => c.classList.toggle('on', k === t));
    const slot = t % 10;
    out.textContent = `Day ${t} · ${MONTHS[Math.floor(t / 10)]}, tick ${slot + 1} of 10`;
    const nations = [];
    for (let id = 1; id <= 120; id++) if ((id * 37) % 120 === t) nations.push(id);
    const items = [];
    if (t === 0) items.push('World-wide yearly: statistics sample, international trade, religion, culture, sport, album, climate, catastrophes, existential risks, technology lead, notable people.');
    items.push('Every tick: fires and weather, herds, nomadic bands, settlers and migrants, armies and battles, monsters, a slice of the vegetation.');
    items.push(`Monthly cycle for settlements whose id ends in ${slot} (id % 10 = ${slot}): economy → births and deaths → construction → health and migration.`);
    if (slot === 0) items.push('Slot 0: monthly climate (rain anomalies), monsters roam.');
    items.push(`Yearly cycle for nation ${nations.map((n) => '#' + n).join(', ')} (id × 37 % 120 = ${t}): census, research, market, politics, diplomacy, war, roads, space, expansion.`);
    runs.replaceChildren(...items.map((x) => el('li', {}, x)));
  }
  input.addEventListener('input', () => show(Number(input.value)));
  let timer = 0;
  play.addEventListener('click', () => {
    const on = !timer;
    play.setAttribute('aria-pressed', String(on));
    play.textContent = on ? 'Pause' : 'Play';
    if (on) timer = setInterval(() => { input.value = String((Number(input.value) + 1) % 120); show(Number(input.value)); }, 180);
    else { clearInterval(timer); timer = 0; }
  });
  show(0);
}

/** Paired bars: the round before against the latest round, per world (labels come with the data). */
function bars(svgId, rows, key, unit, labels) {
  const svg = $(svgId);
  svg.classList.add('chart');
  const W = 340, H = 220, L = 34, B = 30, T = 20;
  const max = Math.max(...rows.flatMap((r) => [r.before[key], r.after[key]])) * 1.15;
  const y = (v) => H - B - (v / max) * (H - B - T);
  svg.append(el('svg:line', { x1: L, y1: H - B, x2: W - 6, y2: H - B, class: 'axis' }));
  const gw = (W - L - 10) / rows.length;
  rows.forEach((r, k) => {
    const x0 = L + k * gw + 8;
    for (const [j, side] of [[0, 'before'], [1, 'after']]) {
      const v = r[side][key];
      const x = x0 + j * ((gw - 16) / 2);
      const w = (gw - 20) / 2;
      const rect = el('svg:rect', { x, y: y(v), width: w, height: H - B - y(v), class: side, rx: 3 });
      rect.append(el('svg:title', {}, `${r.world}, ${labels[side]}: ${v}${unit}`));
      svg.append(rect);
      svg.append(el('svg:text', { x: x + w / 2, y: y(v) - 4, 'text-anchor': 'middle', class: 'val' }, `${Math.round(v * 10) / 10}${unit}`));
    }
    svg.append(el('svg:text', { x: x0 + (gw - 16) / 2, y: H - 10, 'text-anchor': 'middle' }, r.world));
  });
  const lg = el('svg:g');
  lg.append(el('svg:rect', { x: L, y: 2, width: 10, height: 10, class: 'before' }), el('svg:text', { x: L + 14, y: 11 }, labels.before));
  lg.append(el('svg:rect', { x: L + 80, y: 2, width: 10, height: 10, class: 'after' }), el('svg:text', { x: L + 94, y: 11 }, labels.after));
  svg.append(lg);
}

function fileList(f) {
  const list = $('filelist'), q = $('q');
  const all = [...f.files.map((x) => ({ ...x, kind: 'src' })), ...f.scripts.map((x) => ({ ...x, kind: 'script' })), ...f.tests.map((x) => ({ ...x, kind: 'test' })), ...f.workflows.map((x) => ({ ...x, kind: 'workflow', lines: 0 }))];
  function render() {
    const term = q.value.trim().toLowerCase();
    const found = all.filter((x) => !term || x.path.toLowerCase().includes(term) || (x.about ?? '').toLowerCase().includes(term));
    const hits = found.slice(0, term ? 80 : 20);
    $('count').textContent = `${found.length} of ${all.length} files${found.length > hits.length ? `, showing ${hits.length}: search to narrow` : ''}`;
    list.replaceChildren(...hits.map((x) => {
      const d = el('div', { class: 'file' });
      d.append(el('span', { class: 'n' }, x.kind === 'test' ? `${x.cases} tests` : x.lines ? `${fmt(x.lines)} lines` : x.kind));
      d.append(el('code', {}, x.path), el('br'), document.createTextNode(x.about || '(no description)'));
      return d;
    }));
  }
  q.addEventListener('input', render);
  render();
}

(async () => {
  try {
    const f = await load('facts.json');
    stats(f);
    codeMap(f);
    fileList(f);
  } catch (e) {
    $('detail').textContent = `Could not load facts.json (${e.message}).`;
  }
  timeline();
  try {
    const b = await load('balance.json');
    bars('chart-unemp', b.worlds, 'unemp', '%', b.labels);
    bars('chart-warm', b.worlds, 'warm', '°', b.labels);
    $('balnote').textContent = b.note;
  } catch (e) {
    $('balnote').textContent = `Could not load balance.json (${e.message}).`;
  }
})();
