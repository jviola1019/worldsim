/**
 * Save-format migrations. Each entry upgrades a parsed header from version
 * N to N+1. Add a migration whenever WorldState gains/changes fields.
 */
import { SAVE_VERSION } from '../config/laws';
import { SaveError } from './serialize';

type Migration = (h: any) => any;

const MIGRATIONS: Record<number, Migration> = {
  // v0 (pre-release prototype saves) -> v1: civs lacked `acc` and `unlocked`
  0: (h) => {
    for (const c of h.state.civs ?? []) {
      c.unlocked ??= [1];
      c.acc ??= { prod: new Array(21).fill(0), use: new Array(21).fill(0), want: new Array(21).fill(0), cons: 0, inv: 0, va: 0, services: 0, workers: 0, unemployed: 0, foodNeed: 0, foodShort: 0, energyUse: 0, emissions: 0 };
    }
    h.saveVersion = 1;
    return h;
  },
};

export function migrate(h: any): any {
  let v = h.saveVersion ?? 0;
  if (v > SAVE_VERSION) throw new SaveError(`This save was made by a newer version of EPOCH (format ${v})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new SaveError(`No migration from save format ${v}`);
    h = m(h);
    v = h.saveVersion;
  }
  return h;
}
