/** Undo for terrain-editing strokes: snapshots of each touched tile before the first change. */
import type { Sim } from '../sim/context';
import { markTile, markOverlay } from '../sim/context';

interface TileSnap {
  i: number;
  elev: number;
  terrain: number;
  moist: number;
  fert: number;
  veg: number;
  dep: number;
  depAmt: number;
  temp: number;
}

export class UndoStack {
  private strokes: Map<number, TileSnap>[] = [];
  private current: Map<number, TileSnap> | null = null;
  max = 20;

  begin(): void {
    this.current = new Map();
  }

  record(sim: Sim, i: number): void {
    if (!this.current || this.current.has(i)) return;
    const m = sim.w.map;
    this.current.set(i, { i, elev: m.elev[i], terrain: m.terrain[i], moist: m.moist[i], fert: m.fert[i], veg: m.veg[i], dep: m.dep[i], depAmt: m.depAmt[i], temp: m.temp[i] });
  }

  end(): void {
    if (this.current && this.current.size) {
      this.strokes.push(this.current);
      if (this.strokes.length > this.max) this.strokes.shift();
    }
    this.current = null;
  }

  get canUndo(): boolean {
    return this.strokes.length > 0;
  }

  undo(sim: Sim): boolean {
    const s = this.strokes.pop();
    if (!s) return false;
    const m = sim.w.map;
    for (const t of s.values()) {
      m.elev[t.i] = t.elev;
      m.terrain[t.i] = t.terrain;
      m.moist[t.i] = t.moist;
      m.fert[t.i] = t.fert;
      m.veg[t.i] = t.veg;
      m.dep[t.i] = t.dep;
      m.depAmt[t.i] = t.depAmt;
      m.temp[t.i] = t.temp;
      markTile(sim, t.i);
      markOverlay(sim, t.i);
    }
    return true;
  }
}
