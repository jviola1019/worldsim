/**
 * Simulation: fixed-tick, deterministic orchestration of all systems.
 *
 * One tick ~ 3 days (120 ticks per year). Work is staggered: settlements run
 * their monthly cycle on the tick slot matching their id, civilizations their
 * yearly cycle on a day derived from their id, global yearly systems on day 0.
 * The renderer never drives simulation logic; `advance()` converts real time
 * to a budgeted number of ticks for the chosen speed.
 */
import type { Sim, VisualFx } from './context';
import { CHUNK } from './context';
import type { HistoryEvent, WorldState } from './types';
import { Rng } from '../core/rng';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '../core/time';
import { environmentTick, climateMonthly, climateYearly } from '../world/environment';
import { herdsTick, herdsMonthly, vegetationSlice, evolutionYearly, speciesCensus, monstersTick, monstersMonthly } from '../ecology/ecology';
import { bandsTick, bandsMonthly } from '../population/bands';
import { agentsTick } from '../population/agents';
import { armiesTick } from '../military/war';
import { settlementMonthly } from '../civilizations/settlement';
import { civYearly } from './civYearly';
import { religionYearly } from '../culture/religion';
import { cultureYearly } from '../culture/culture';
import { tradeYearly } from '../economy/trade';
import { notablesYearly } from '../politics/succession';
import { sampleStats } from '../history/stats';
import { emptyFlows } from '../population/demography';
import { Digest } from '../core/rng';
import { pruneArchive } from './maintenance';
import { catastrophesYearly } from '../world/catastrophes';
import { risksWorldYearly } from '../future/risks';
import { horrorsYearly } from '../powers/horrors';
import { techLeadYearly } from '../technology/overtaking';

export const SPEEDS = [0, 20, 60, 150, 400, 1200];
export const SPEED_LABELS = ['Paused', '1×', '2×', '3×', '4×', 'Max'];

export class Simulation implements Sim {
  w: WorldState;
  rng: Rng;
  year: number;
  chunkDirty: Uint8Array;
  chunksX: number;
  chunksY: number;
  overlayDirty: Uint8Array;
  centers = new Map<number, number>();
  listeners: ((e: HistoryEvent) => void)[] = [];
  fx: VisualFx[] = [];
  territoryDirty = new Set<number>();
  terrainVersion = 0;
  cache: Record<string, any> = {};
  /** Fractional tick accumulator for real-time driving. */
  private carry = 0;
  /** Measured cost of the last advance() call (ms). */
  lastStepMs = 0;

  constructor(w: WorldState) {
    this.w = w;
    this.rng = new Rng(w.rng);
    this.year = w.meta.startYear + Math.floor(w.tick / TICKS_PER_YEAR);
    this.chunksX = Math.ceil(w.map.w / CHUNK);
    this.chunksY = Math.ceil(w.map.h / CHUNK);
    this.chunkDirty = new Uint8Array(this.chunksX * this.chunksY).fill(1);
    this.overlayDirty = new Uint8Array(this.chunksX * this.chunksY).fill(1);
    for (const s of w.settlements.values()) this.centers.set(w.map.idx(s.x, s.y), s.id);
  }

  /** Copy live RNG state into the world (call before serializing). */
  syncRng(): void {
    this.w.rng = this.rng.getState();
  }

  step(): void {
    const w = this.w;
    w.tick++;
    this.year = w.meta.startYear + Math.floor(w.tick / TICKS_PER_YEAR);
    const day = w.tick % TICKS_PER_YEAR;
    const slot = w.tick % TICKS_PER_MONTH;
    // global yearly systems (day 0)
    if (day === 0) this.yearStart();
    // per tick
    environmentTick(this);
    herdsTick(this);
    bandsTick(this);
    agentsTick(this);
    armiesTick(this);
    monstersTick(this);
    vegetationSlice(this, slot);
    // monthly, staggered by id
    herdsMonthly(this);
    bandsMonthly(this);
    for (const s of [...w.settlements.values()]) if (s.id % TICKS_PER_MONTH === slot && w.settlements.has(s.id)) settlementMonthly(this, s);
    if (slot === 0) {
      climateMonthly(this);
      monstersMonthly(this);
    }
    // yearly per civ, staggered
    for (const c of [...w.civs.values()]) if (c.alive && (c.id * 37) % TICKS_PER_YEAR === day) civYearly(this, c);
  }

  private yearStart(): void {
    const w = this.w;
    sampleStats(this);
    let worldPop = 0;
    for (const s of w.settlements.values()) worldPop += s.pop;
    for (const b of w.bands.values()) worldPop += b.members.length;
    this.cache.worldPop = worldPop; // display only; the population-cap law recomputes live (see settlement.ts)
    for (const s of w.settlements.values()) s.flows = emptyFlows();
    const totals = tradeYearly(this);
    for (const c of w.civs.values()) {
      const t = totals.get(c.id);
      c.tradeExp = t?.exp ?? 0;
      c.tradeImp = t?.imp ?? 0;
    }
    speciesCensus(this);
    evolutionYearly(this);
    religionYearly(this);
    cultureYearly(this);
    climateYearly(this);
    catastrophesYearly(this);
    risksWorldYearly(this);
    horrorsYearly(this);
    techLeadYearly(this);
    notablesYearly(this);
    if (this.year % 10 === 0) pruneArchive(this);
  }

  runTicks(n: number): void {
    for (let k = 0; k < n; k++) this.step();
  }

  runYears(n: number): void {
    this.runTicks(n * TICKS_PER_YEAR);
  }

  /**
   * Real-time driver: advance by `realMs` at `ticksPerSecond`, but never spend
   * more than `budgetMs` of wall time (keeps input responsive on phones).
   * Returns the number of ticks executed.
   */
  advance(realMs: number, ticksPerSecond: number, budgetMs = 8, now: () => number = () => performance.now()): number {
    if (ticksPerSecond <= 0) return 0;
    this.carry += (realMs / 1000) * ticksPerSecond;
    const want = Math.floor(this.carry);
    this.carry -= want;
    const t0 = now();
    let done = 0;
    while (done < want) {
      this.step();
      done++;
      if (now() - t0 > budgetMs) break;
    }
    if (done < want) this.carry = Math.min(this.carry + (want - done) * 0.25, ticksPerSecond * 0.25); // drop backlog gracefully
    this.lastStepMs = now() - t0;
    return done;
  }

  onEvent(fn: (e: HistoryEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  /** Deterministic digest of the core state (for reproducibility tests). */
  digest(): string {
    const w = this.w;
    const d = new Digest();
    d.num(w.tick).arr(this.rng.getState());
    d.arr(w.map.terrain).arr(w.map.owner).arr(w.map.bld).arr(w.map.veg);
    for (const c of w.civs.values()) d.num(c.id).num(c.population).num(c.techScore).num(c.treasury).str(c.govForm).num(c.alive ? 1 : 0);
    for (const s of w.settlements.values()) d.num(s.id).num(s.pop).num(s.food).arr(s.bld);
    for (const h of w.herds.values()) d.num(h.id).num(h.count).num(h.x).num(h.y);
    for (const o of w.outlets.values()) d.num(o.id).num(o.reach).num(o.closed ?? -1);
    for (const a of w.ais.values()) d.num(a.id).num(a.capability).num(a.alignment).str(a.status);
    for (const c of w.civs.values()) if (c.media) d.num(c.media.polarization).num(c.media.misinformation).num(c.media.trust);
    d.num(w.persons.size).num(w.events.length);
    return d.hex();
  }
}
