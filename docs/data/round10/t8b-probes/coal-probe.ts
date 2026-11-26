/**
 * Task 8c probe: does coal decide when a nation industrialises in the Industrializing World?
 * Runs the mode-audit's own Industrializing worlds (start era 7, horizon 120) twice per seed: as generated, and with
 * every coal deposit removed before year 1 (the counterfactual). Per nation it logs the coal tiles in its territory at
 * the start, its steam-engine adoption, and its era every 30 years; per world, the first year any nation reaches era 8
 * and the nations at era 8 or later at the horizon. Also reports Spearman with tie-averaged ranks (coal tiles vs era).
 *   npx tsx docs/data/round10/t8b-probes/coal-probe.ts [seeds=6] [years=120] [variant=both|real|nocoal]
 */
import { configFor, snapshot } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { Deposit, Good } from '../../../../src/world/resources';
import { TECHS } from '../../../../src/technology/techData';

const n = Number(process.argv[2] ?? 6);
const years = Number(process.argv[3] ?? 120);
const variant = process.argv[4] ?? 'both';

function rankAvg(v: number[]): number[] {
  const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length);
  for (let i = 0; i < o.length; ) {
    let j = i;
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
export function spearmanTies(xs: number[], ys: number[]): number {
  const rx = rankAvg(xs), ry = rankAvg(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length, my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < rx.length; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

function run(seed: string, noCoal: boolean) {
  const sim = createSimulation(configFor('industrial', seed));
  if (noCoal) for (let i = 0; i < sim.w.map.n; i++) if (sim.w.map.dep[i] === Deposit.COAL) { sim.w.map.dep[i] = Deposit.NONE; sim.w.map.depAmt[i] = 0; }
  const st = snapshot(sim);
  const ids = [...sim.w.civs.values()].filter((c) => c.alive).map((c) => c.id);
  const traj = new Map<number, number[]>(ids.map((id) => [id, [sim.w.civs.get(id)!.era]]));
  const steam = new Map<number, number[]>(ids.map((id) => [id, [sim.w.civs.get(id)!.techs.steam_engine?.adoption ?? 0]]));
  const era8 = new Map<number, number>();
  let first8 = -1;
  const steamYears = new Map<number, number>(ids.map((id) => [id, 0]));
  for (let y = 1; y <= years; y++) {
    sim.runYears(1);
    for (const id of ids) {
      const c = sim.w.civs.get(id)!;
      if (c.alive && c.era >= 8 && !era8.has(id)) era8.set(id, y);
      if (first8 < 0 && c.alive && c.era >= 8) first8 = y;
      if (c.alive && (c.techs.steam_engine?.adoption ?? 0) >= 0.5) steamYears.set(id, steamYears.get(id)! + 1);
      if (y % 30 === 0) { traj.get(id)!.push(c.alive ? c.era : 0); steam.get(id)!.push(c.techs.steam_engine?.adoption ?? 0); }
    }
  }
  const rows = ids.map((id) => {
    const c = sim.w.civs.get(id)!;
    let ind = 0; // adoption summed over the era-7 and era-8 techs (14 + 18 = 32): a continuous industrialisation score
    for (const t of TECHS) if (t.era === 7 || t.era === 8) ind += c.techs[t.id]?.known ? c.techs[t.id].adoption : 0;
    return { id, coal: st.coal.get(id) ?? 0, alive: c.alive, era: c.alive ? c.era : 0, era8: era8.get(id) ?? -1, traj: traj.get(id)!, steam: steam.get(id)!, coalAccess: c.access[Good.COAL], pop: c.population, ind, score: c.techScore, gdppc: c.econ.gdp / Math.max(1, c.population), steamYears: steamYears.get(id)! };
  });
  return { rows, first8, at8: rows.filter((r) => r.alive && r.era >= 8).length };
}

for (let k = 0; k < n; k++) {
  const seed = `audit-industrial-${k}`;
  for (const noCoal of variant === 'both' ? [false, true] : [variant === 'nocoal']) {
    const r = run(seed, noCoal);
    const alive = r.rows.filter((x) => x.alive && st(x));
    const rho = spearmanTies(alive.map((x) => x.coal), alive.map((x) => x.era));
    const rho8 = spearmanTies(alive.map((x) => x.coal), alive.map((x) => (x.era8 < 0 ? years + 1 : -x.era8)));
    const rhoInd = spearmanTies(alive.map((x) => x.coal), alive.map((x) => x.ind));
    const rhoSteam = spearmanTies(alive.map((x) => x.coal), alive.map((x) => x.steamYears));
    const rhoGdp = spearmanTies(alive.map((x) => x.coal), alive.map((x) => x.gdppc));
    const mean = (f: (x: (typeof alive)[number]) => number) => (alive.reduce((a, x) => a + f(x), 0) / Math.max(1, alive.length)).toFixed(2);
    console.log(`seed ${k} ${noCoal ? 'NO COAL' : 'as generated'}: first era 8 in year ${r.first8}; at era ≥ 8 at year ${years}: ${r.at8}/${r.rows.filter((x) => x.alive).length}; Spearman(coal, era) ${rho.toFixed(2)}; Spearman(coal, earliness of era 8) ${rho8.toFixed(2)}; Spearman(coal, era-7/8 adoption) ${rhoInd.toFixed(2)}; Spearman(coal, steam years) ${rhoSteam.toFixed(2)}; Spearman(coal, GDP per head) ${rhoGdp.toFixed(2)}; mean era-7/8 adoption ${mean((x) => x.ind)}; mean techScore ${mean((x) => x.score)}; mean GDP per head ${mean((x) => x.gdppc)}`);
    for (const x of r.rows) console.log(`    nation ${x.id}: coal tiles ${x.coal}, era by 30y ${x.traj.join('→')}, steam adoption ${x.steam.map((v) => v.toFixed(2)).join('→')}, era 8 in ${x.era8}, era-7/8 adoption ${x.ind.toFixed(1)}, steam years ${x.steamYears}, GDP/head ${x.gdppc.toFixed(2)}, coal access ${x.coalAccess.toFixed(2)}, pop ${Math.round(x.pop)}${x.alive ? '' : ' (fallen)'}`);
  }
}
function st(x: { coal: number }) { return x.coal >= 0; }
