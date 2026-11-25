import { defaultConfig, MAX_START_ERA } from '../src/config/laws';
import { createSimulation } from '../src/sim/bootstrap';
import { TECHS } from '../src/technology/techData';
import { techState, eraOf, techPermitted } from '../src/technology/research';
import type { Sim } from '../src/sim/context';

/**
 * Round 10 second addendum: no world starts past MAX_START_ERA. Tests that need a digital or space-age world
 * ask for it with startEra > 10; the world starts at the cap and every nation is then handed the technologies
 * of the era asked for (prerequisites first, only techs the world's realism setting and laws permit), then civ.era is
 * set from the techs (eraOf, as the sim does). LIMIT: only technology is granted. It builds no extra infrastructure,
 * buildings or population beyond what an era-10 start has, so tests must not depend on those.
 */
export function developTo(sim: Sim, era: number): void {
  for (const civ of sim.w.civs.values()) {
    for (let guard = 0; guard < 400 && eraOf(civ) < era; guard++) {
      const ready = TECHS.filter((t) => t.era <= era && !civ.techs[t.id]?.known && techPermitted(sim, t) && !(t.advancedWeapon && !sim.w.laws.advancedWeapons) && t.prereqs.every((p) => civ.techs[p]?.known));
      if (!ready.length) break;
      const now = ready.filter((t) => t.era === era);
      const t = (now.length ? now : ready)[0];
      const st = techState(civ, t.id);
      st.known = true; st.year = 0; st.adoption = 1;
    }
    civ.era = eraOf(civ);
  }
}

export function makeSim(seed = 'test', size = 64, mutate?: (c: ReturnType<typeof defaultConfig>) => void) {
  const cfg = defaultConfig();
  cfg.name = 'Test';
  cfg.gen.seed = seed;
  cfg.gen.width = size;
  cfg.gen.height = size;
  mutate?.(cfg);
  const want = cfg.settings.startEra;
  const sim = createSimulation(cfg);
  if (want > MAX_START_ERA) developTo(sim, want);
  return sim;
}
