/**
 * Task 8b probe: why is "a monster slain by a settlement" rare in Realms of Legend?
 * Steps the mode-audit's own Fantasy worlds tick by tick and, around every monthly monster pass, records
 * monster–settlement encounters (a settlement within 3 tiles, the fight radius in monstersMonthly), the damage
 * dealt, the longest unbroken fight, the lowest health reached, kills, and monster distance to the nearest town.
 *   npx tsx docs/data/round10/t8b-probes/fantasy-probe.ts [seeds=6] [years=200]
 */
import { auditMode, configFor, MODES } from '../../../../scripts/mode-audit';
import { createSimulation } from '../../../../src/sim/bootstrap';
import { MONSTERS } from '../../../../src/ecology/species';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '../../../../src/core/time';

void auditMode; void MODES;
const n = Number(process.argv[2] ?? 6);
const years = Number(process.argv[3] ?? 200);

for (let k = 0; k < n; k++) {
  const sim = createSimulation(configFor('fantasy', `audit-fantasy-${k}`));
  const w = sim.w;
  const start = [...w.monsters.values()].map((m) => `${m.kind}(${MONSTERS.find((d) => d.kind === m.kind)!.hp})`);
  type Acc = { months: number; contact: number; episodes: number; run: number; longest: number; dmg: number; minHpFrac: number; healed: number; inContact: boolean };
  const acc = new Map<number, Acc>();
  let slain = 0, gone = 0;
  const contactPops: number[] = [];
  const nationPops: number[] = [];
  const distSamples: number[] = [];
  const deathsBefore = () => [...w.settlements.values()].reduce((a, s) => a + (s.flows?.disaster ?? 0), 0);
  let monsterDeaths = 0;
  const totalTicks = years * TICKS_PER_YEAR;
  for (let t = 0; t < totalTicks; t++) {
    const monthly = (w.tick + 1) % TICKS_PER_MONTH === 0;
    let before: Map<number, { hp: number; near: boolean }> | null = null;
    if (monthly) {
      before = new Map();
      for (const mo of w.monsters.values()) {
        const close = [...w.settlements.values()].filter((s) => (s.x - mo.x) ** 2 + (s.y - mo.y) ** 2 <= 9);
        const near = close.length > 0;
        if (near) contactPops.push(Math.max(...close.map((s) => s.pop)));
        if (near) nationPops.push(Math.max(...close.map((s) => w.civs.get(s.civId)?.population ?? 0)));
        before.set(mo.id, { hp: mo.hp, near });
      }
    }
    const d0 = monthly ? deathsBefore() : 0;
    sim.step();
    if (monthly && before) {
      monsterDeaths += Math.max(0, deathsBefore() - d0); // approx: disaster flow also counts other disasters that month
      for (const [id, b] of before) {
        const def = MONSTERS.find((d) => d.kind === (w.monsters.get(id)?.kind ?? ''));
        const a = acc.get(id) ?? { months: 0, contact: 0, episodes: 0, run: 0, longest: 0, dmg: 0, minHpFrac: 1, healed: 0, inContact: false };
        acc.set(id, a);
        a.months++;
        const mo = w.monsters.get(id);
        if (b.near) {
          a.contact++;
          if (!a.inContact) a.episodes++;
          a.inContact = true; a.run++; a.longest = Math.max(a.longest, a.run);
          a.dmg += b.hp - (mo ? mo.hp : 0);
          if (!mo) slain++;
        } else {
          a.inContact = false; a.run = 0;
          if (mo) a.healed += Math.max(0, mo.hp - b.hp);
          else gone++;
        }
        if (mo && def) a.minHpFrac = Math.min(a.minHpFrac, mo.hp / def.hp);
      }
    }
    if (w.tick % TICKS_PER_YEAR === 0 && w.settlements.size) {
      for (const mo of w.monsters.values()) {
        let best = Infinity;
        for (const s of w.settlements.values()) best = Math.min(best, Math.hypot(s.x - mo.x, s.y - mo.y));
        distSamples.push(best);
      }
    }
  }
  distSamples.sort((a, b) => a - b);
  const med = distSamples.length ? distSamples[Math.floor(distSamples.length / 2)] : NaN;
  const within10 = distSamples.filter((d) => d <= 10).length;
  const towns = [...w.settlements.values()];
  const pops = towns.map((s) => s.pop).sort((a, b) => b - a);
  const all = [...acc.entries()];
  const contactMonths = all.reduce((a, [, x]) => a + x.contact, 0);
  const dmg = all.reduce((a, [, x]) => a + x.dmg, 0);
  const slainEv = w.events.filter((e) => e.type === 'monster_slain');
  console.log(`seed ${k}: monsters at start ${start.join(' ')}; slain at the gates ${slain}; removed away from the gates (hunted) ${gone}; monster_slain events ${slainEv.length}: ${slainEv.map((e) => `y${Math.floor(e.tick / TICKS_PER_YEAR)} "${e.title}"`).join('; ')}`);
  console.log(`  monster-months ${all.reduce((a, [, x]) => a + x.months, 0)}, in contact ${contactMonths} (${all.reduce((a, [, x]) => a + x.episodes, 0)} episodes), damage dealt ${dmg.toFixed(0)} (${contactMonths ? (dmg / contactMonths).toFixed(2) : '-'} per contact month)`);
  for (const [id, x] of all) console.log(`    monster ${id}: contact ${x.contact}/${x.months} months, ${x.episodes} episodes, longest ${x.longest}, damage ${x.dmg.toFixed(0)}, healed ${x.healed.toFixed(0)}, min hp ${(x.minHpFrac * 100).toFixed(0)}%`);
  contactPops.sort((a, b) => a - b);
  const q = (f: number) => (contactPops.length ? Math.round(contactPops[Math.floor(f * (contactPops.length - 1))]) : NaN);
  console.log(`  largest town in reach during contact months: median ${q(0.5)}, 90th pct ${q(0.9)}, max ${q(1)}; months with a town ≥ 2,000 in reach: ${contactPops.filter((p) => p >= 2000).length}`);
  nationPops.sort((a, b) => a - b);
  const qn = (f: number) => (nationPops.length ? Math.round(nationPops[Math.floor(f * (nationPops.length - 1))]) : NaN);
  console.log(`  that town's nation during contact months: median ${qn(0.5)} people, 10th pct ${qn(0.1)}, 90th pct ${qn(0.9)}`);
  console.log(`  yearly distance monster→nearest town: median ${med.toFixed(1)} tiles; ≤ 10 tiles in ${within10}/${distSamples.length} samples`);
  console.log(`  towns at year ${years}: ${towns.length}, largest ${pops.slice(0, 5).map((p) => Math.round(p)).join(', ')}; disaster deaths in monster months ≈ ${Math.round(monsterDeaths)}`);
}
