/**
 * Time-series statistics sampled from live simulation state (yearly, with
 * adaptive decimation so long histories stay bounded), plus change
 * decomposition built from recorded demographic flows.
 */
import type { Sim } from '../sim/context';
import type { Civ, SeriesStore, TerritorySnapshot } from '../sim/types';
import { boundaryPopulation, emptyLedger, LEDGER_KEYS, LEDGER_SIGN, type LedgerKey, type PopLedger } from '../population/ledger';

const MAX_SAMPLES = 400;

export const GLOBAL_SERIES = ['population', 'civs', 'settlements', 'gdp', 'livingStandard', 'techScore', 'wars', 'co2', 'temperature', 'energy', 'emissions', 'religions', 'extinctCivs', 'species'] as const;
export const CIV_SERIES = ['population', 'gdp', 'gdpPerCapita', 'techScore', 'era', 'territory', 'military', 'stability', 'legitimacy', 'settlements', 'livingStandard', 'unemployment', 'inflation', 'debt', 'births', 'deaths', 'famine', 'disease', 'war', 'emigration', 'immigration'] as const;

export function emptySeries(): SeriesStore {
  return { years: [], data: {} };
}

function push(store: SeriesStore, year: number, values: Record<string, number>): void {
  store.years.push(year);
  for (const [k, v] of Object.entries(values)) (store.data[k] ??= []).push(Number.isFinite(v) ? v : 0);
  // pad missing series
  const n = store.years.length;
  for (const k of Object.keys(store.data)) while (store.data[k].length < n) store.data[k].unshift(0);
}

function decimate(store: SeriesStore): void {
  const keep = (_: number, i: number) => i % 2 === 0 || i === store.years.length - 1;
  store.years = store.years.filter(keep);
  for (const k of Object.keys(store.data)) store.data[k] = store.data[k].filter(keep);
}

export function civFlowsTotal(sim: Sim, civ: Civ) {
  const f = { births: 0, deaths: 0, famine: 0, disease: 0, war: 0, disaster: 0, emigration: 0, immigration: 0 };
  for (const id of civ.settlements) {
    const s = sim.w.settlements.get(id);
    if (!s) continue;
    for (const k of Object.keys(f) as (keyof typeof f)[]) f[k] += s.flows[k];
  }
  return f;
}

/** Yearly sampling. Called at year start, after civ yearly updates have run at least once. */
export const TERRITORY_EVERY = 25;
const TERRITORY_MAX = 64;

/** Record a downsampled territory map every TERRITORY_EVERY years (thinned when the store fills up). */
export function sampleTerritory(sim: Sim): void {
  const w = sim.w;
  if (sim.year % TERRITORY_EVERY !== 0) return;
  const m = w.map;
  const tw = Math.ceil(m.w / 2), th = Math.ceil(m.h / 2);
  const rle: number[] = [];
  let cur = -1, run = 0;
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const o = m.owner[Math.min(m.h - 1, y * 2) * m.w + Math.min(m.w - 1, x * 2)];
      if (o === cur) run++;
      else {
        if (run) rle.push(cur, run);
        cur = o;
        run = 1;
      }
    }
  if (run) rle.push(cur, run);
  const list = (w.stats.territory ??= []);
  if (list.length && list[list.length - 1].year === sim.year) list.pop();
  list.push({ year: sim.year, w: tw, h: th, rle });
  // keep the store bounded: drop every second snapshot of the older half
  if (list.length > TERRITORY_MAX) {
    const half = list.length >> 1;
    w.stats.territory = list.filter((_, k) => k >= half || k % 2 === 0);
  }
}

/** Decode a snapshot into owner ids per 2×2 block. */
export function decodeTerritory(t: TerritorySnapshot): Uint16Array {
  const out = new Uint16Array(t.w * t.h);
  let p = 0;
  for (let k = 0; k < t.rle.length; k += 2) {
    out.fill(t.rle[k], p, p + t.rle[k + 1]);
    p += t.rle[k + 1];
  }
  return out;
}

export function sampleStats(sim: Sim): void {
  const w = sim.w;
  sampleTerritory(sim);
  const st = w.stats;
  if (sim.year - st.lastSample < st.interval) return;
  st.lastSample = sim.year;
  let pop = 0;
  let gdp = 0;
  let ls = 0;
  let tech = 0;
  let civs = 0;
  let extinct = 0;
  let energy = 0;
  let emissions = 0;
  for (const c of w.civs.values()) {
    if (!c.alive) {
      extinct++;
      continue;
    }
    civs++;
    pop += c.population;
    gdp += c.econ.gdp;
    ls += c.econ.livingStandard * c.population;
    tech = Math.max(tech, c.techScore);
    energy += c.econ.energyUse;
    emissions += c.econ.emissions;
    const f = civFlowsTotal(sim, c);
    const cs = (st.civs[c.id] ??= emptySeries());
    push(cs, sim.year, {
      // live boundary population and the cumulative ledger at the same instant (see population/ledger.ts)
      population: boundaryPopulation(sim, c.id),
      ...ledgerSeries(c.ledger),
      gdp: c.econ.gdp,
      gdpPerCapita: c.econ.gdpPerCapita,
      techScore: c.techScore,
      era: c.era,
      territory: c.territory,
      military: c.militaryPower,
      stability: c.stability,
      legitimacy: c.legitimacy,
      settlements: c.settlements.length,
      livingStandard: c.econ.livingStandard,
      unemployment: c.econ.unemployment,
      inflation: c.inflation,
      debt: c.debt,
      ...f,
    });
    if (cs.years.length > MAX_SAMPLES) decimate(cs);
  }
  pop = boundaryPopulation(sim); // settlements + bands + people in transit + colonies
  let wars = 0;
  for (const wr of w.wars.values()) if (!wr.end) wars++;
  let religions = 0;
  for (const r of w.religions.values()) if (!r.extinct) religions++;
  let species = 0;
  for (const s of Object.values(w.speciesStatus)) if (s.count >= 1) species++;
  push(st.global, sim.year, {
    population: pop,
    ...ledgerSeries(w.popLedger),
    civs,
    settlements: w.settlements.size,
    gdp,
    livingStandard: pop > 0 ? ls / pop : 0,
    techScore: tech,
    wars,
    co2: w.climate.co2,
    temperature: w.climate.anomaly,
    energy,
    emissions,
    religions,
    extinctCivs: extinct,
    species,
  });
  if (st.global.years.length > MAX_SAMPLES) {
    decimate(st.global);
    st.interval *= 2;
  }
  // global population milestones
  for (const m of [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]) {
    const key = `pop:${m}`;
    if (pop >= m && w.milestones[key] === undefined) {
      w.milestones[key] = sim.year;
      if (m >= 1e5) sim.listeners.forEach(() => {});
    }
  }
}

export interface ChangeExplanation {
  from: number;
  to: number;
  change: number;
  contributors: { label: string; value: number }[];
}

/** Cumulative ledger values as series entries `L.<key>` (differences between any two samples are exact). */
function ledgerSeries(l: PopLedger | undefined): Record<string, number> {
  const src = l ?? emptyLedger();
  const out: Record<string, number> = {};
  for (const k of LEDGER_KEYS) out['L.' + k] = src[k];
  return out;
}

export const LEDGER_LABELS: Record<LedgerKey, string> = {
  births: 'Births',
  deaths: 'Ordinary deaths',
  famine: 'Famine deaths',
  disease: 'Epidemic deaths',
  war: 'War deaths',
  disaster: 'Disaster deaths',
  emigration: 'Emigration',
  immigration: 'Immigration',
  transferIn: 'Gained with territory',
  transferOut: 'Lost with territory',
  destroyed: 'Lost when settlements were abandoned or destroyed',
  lost: 'Lost in transit',
  resolution: 'Rounding (cohorts ↔ individuals)',
  divine: 'Divine intervention',
};

/**
 * Explain the population change of a series (a civ's or the world's) between two sample years.
 * With ledger data the components reconcile exactly (closing − opening = Σ components); any remaining
 * difference is reported as an explicit "Unreconciled" line rather than hidden in a catch-all.
 */
export function explainPopulationChange(store: SeriesStore, y0: number, y1: number): ChangeExplanation | null {
  const i0 = store.years.findIndex((y) => y >= y0);
  let i1 = store.years.length - 1;
  while (i1 > 0 && store.years[i1] > y1) i1--;
  if (i0 < 0 || i1 <= i0) return null;
  const d = store.data;
  const from = d.population[i0];
  const to = d.population[i1];
  const contributors: { label: string; value: number }[] = [];
  const hasLedger = Object.prototype.hasOwnProperty.call(d, 'L.births');
  if (hasLedger) {
    for (const k of LEDGER_KEYS) {
      const v = LEDGER_SIGN[k] * ((d['L.' + k]?.[i1] ?? 0) - (d['L.' + k]?.[i0] ?? 0));
      if (Math.abs(v) >= 0.5) contributors.push({ label: LEDGER_LABELS[k], value: v });
    }
  } else {
    // saves from before the ledger: yearly flows only (approximate, and incomplete after decimation)
    const sum = (k: string) => {
      let s = 0;
      for (let i = i0 + 1; i <= i1; i++) s += d[k]?.[i] ?? 0;
      return s;
    };
    for (const [k, label, sign] of [['births', 'Births', 1], ['deaths', 'Ordinary deaths', -1], ['famine', 'Famine deaths', -1], ['disease', 'Epidemic deaths', -1], ['war', 'War deaths', -1], ['disaster', 'Disaster deaths', -1], ['emigration', 'Emigration', -1], ['immigration', 'Immigration', 1]] as const) {
      const v = sign * sum(k);
      if (Math.abs(v) >= 1) contributors.push({ label, value: v });
    }
  }
  const accounted = contributors.reduce((a, c) => a + c.value, 0);
  const residual = to - from - accounted;
  if (Math.abs(residual) >= Math.max(1, 1e-6 * Math.abs(to))) contributors.push({ label: hasLedger ? 'Unreconciled (accounting error)' : 'Unrecorded (save predates the population ledger)', value: residual });
  contributors.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { from, to, change: from > 0 ? to / from - 1 : 0, contributors };
}
