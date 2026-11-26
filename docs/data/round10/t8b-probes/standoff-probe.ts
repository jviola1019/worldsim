/**
 * Task 8e probe: why does the Long Standoff often end without an international organization?
 * organizationsYearly (diplomacy.ts) lets a nation found one only when it holds the international-organizations
 * capability (tech `international_organizations`, adopted) and has ≥ 2 known nations with opinion > 25 that hold it
 * too, at 30% a year. This logs, per audit world: who knows/has adopted the tech and when, each nation's count of
 * such friends every 10 years, and the founding year.
 *   npx tsx docs/data/round10/t8b-probes/standoff-probe.ts [seeds=6] [years=110]
 */
import { configFor } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { getRelation } from '../../../../src/civilizations/knowledge';

const n = Number(process.argv[2] ?? 6);
const years = Number(process.argv[3] ?? 110);

for (let k = 0; k < n; k++) {
  const sim = createSimulation(configFor('standoff', `audit-standoff-${k}`));
  const w = sim.w;
  const y0 = w.meta.startYear;
  const ids = [...w.civs.values()].filter((c) => c.alive).map((c) => c.id);
  const known: Record<number, number> = {}, cap: Record<number, number> = {};
  for (const id of ids) { const c = w.civs.get(id)!; if (c.techs.international_organizations?.known) known[id] = 0; if (c.caps.internationalOrgs > 0) cap[id] = 0; }
  const friendLines: string[] = [];
  let founded = -1;
  const opin = () => ids.map((a) => ids.filter((b) => b !== a).map((b) => Math.round(getRelation(sim, a, b)?.opinion ?? NaN)).join('/')).join(' | ');
  const startOpinions = opin();
  for (let y = 1; y <= years; y++) {
    sim.runYears(1);
    for (const id of ids) {
      const c = w.civs.get(id)!;
      if (known[id] === undefined && c.techs.international_organizations?.known) known[id] = y;
      if (cap[id] === undefined && c.caps.internationalOrgs > 0) cap[id] = y;
    }
    if (founded < 0 && [...w.orgs.values()].some((o) => o.founded > y0)) founded = y;
    if (y % 10 === 0) {
      const f = ids.map((id) => {
        const c = w.civs.get(id)!;
        if (!c.alive) return 'x';
        const fr = c.knownCivs.filter((o) => (getRelation(sim, id, o)?.opinion ?? 0) > 25).length;
        const frCap = c.knownCivs.filter((o) => (getRelation(sim, id, o)?.opinion ?? 0) > 25 && (w.civs.get(o)?.caps.internationalOrgs ?? 0) > 0).length;
        return `${c.caps.internationalOrgs > 0 ? 'C' : '-'}${fr}/${frCap}`;
      });
      friendLines.push(`    y${y}: ${f.join(' ')} · wars ${[...w.wars.values()].filter((x) => !x.end).length}`);
    }
  }
  const adoption = ids.map((id) => (w.civs.get(id)!.techs.international_organizations?.adoption ?? 0).toFixed(2));
  console.log(`seed ${k}: org founded in year ${founded}; tech known (year) ${ids.map((id) => known[id] ?? '-').join(',')}; capability (year) ${ids.map((id) => cap[id] ?? '-').join(',')}; adoption at end ${adoption.join(',')}`);
  console.log(`  opinions at start (each nation of the others): ${startOpinions}`);
  console.log(`  per nation every 10 years: C = has the capability; friends (opinion > 25) / friends with the capability`);
  for (const l of friendLines) console.log(l);
}
