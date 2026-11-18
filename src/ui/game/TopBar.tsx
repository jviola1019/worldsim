import type { Simulation } from '../../sim/simulation';
import { SPEED_LABELS } from '../../sim/simulation';
import { ERA_NAMES } from '../../technology/techData';
import { Icon, fmt } from '../shared';
import type { Sheet } from './Game';
import type { Objective } from '../../scenarios/scenarios';
import { monthOf, MONTH_NAMES } from '../../core/time';

const SPEED_ICONS = ['ico.pause', 'ico.play', 'ico.speed1', 'ico.speed2', 'ico.speed3', 'ico.speed3'];

export function TopBar({ sim, speed, setSpeed, openSheet, sheet, objectives, done }: { sim: Simulation; speed: number; setSpeed: (n: number) => void; openSheet: (s: Sheet) => void; sheet: Sheet; objectives: Objective[]; done: string[] }) {
  const w = sim.w;
  let pop = 0;
  let era = 1;
  let civs = 0;
  for (const c of w.civs.values()) {
    if (!c.alive) continue;
    civs++;
    pop += c.population;
    if (c.era > era) era = c.era;
  }
  for (const b of w.bands.values()) pop += b.members.length;
  let wars = 0;
  for (const x of w.wars.values()) if (!x.end) wars++;
  return (
    <header class="hud-top">
      <div class="world-card" aria-live="off">
        <div class="name">{w.meta.name}</div>
        <div class="dial">
          <span class="year">Year {sim.year}</span>
          <span class="era">{MONTH_NAMES[monthOf(w.tick)]}</span>
        </div>
        <div class="era">
          {civs ? `${ERA_NAMES[era]} · ${fmt(pop)} people · ${civs} ${civs === 1 ? 'people' : 'nations'}` : pop ? `${fmt(pop)} wanderers` : 'No people yet'}
        </div>
        {objectives.length > 0 && <div class="era muted">Objectives {done.length}/{objectives.length}</div>}
      </div>
      <div class="playback" role="group" aria-label="Simulation speed">
        {[0, 1, 2, 3, 5].map((s) => (
          <button key={s} aria-pressed={speed === s} aria-label={SPEED_LABELS[s]} title={SPEED_LABELS[s]} onClick={() => setSpeed(s)}>
            <Icon id={SPEED_ICONS[s]} size={24} />
          </button>
        ))}
      </div>
      <nav class="hud-actions" aria-label="World panels">
        <button class="icon-btn" aria-pressed={sheet === 'overlays'} aria-label="Map layers" title="Map layers" onClick={() => openSheet('overlays')}>
          <Icon id="ico.layers" size={28} />
        </button>
        <button class="icon-btn" aria-pressed={sheet === 'civs'} aria-label="Nations" title="Nations" onClick={() => openSheet('civs')}>
          <Icon id="ico.crown" size={28} />
        </button>
        <button class="icon-btn" aria-pressed={sheet === 'history'} aria-label="History" title="History" onClick={() => openSheet('history')}>
          <Icon id="ico.history" size={28} />
          {wars > 0 && <span class="badge">{wars}</span>}
        </button>
        <button class="icon-btn" aria-pressed={sheet === 'feed'} aria-label="News feed" title="News feed" onClick={() => openSheet('feed')}>
          <Icon id="ico.newspaper" size={28} />
        </button>
        <button class="icon-btn" aria-pressed={sheet === 'stats'} aria-label="Statistics" title="Statistics" onClick={() => openSheet('stats')}>
          <Icon id="ico.stats" size={28} />
        </button>
        <button class="icon-btn" aria-pressed={sheet === 'menu'} aria-label="Menu" title="Save, load and settings" onClick={() => openSheet('menu')}>
          <Icon id="ico.menu" size={28} />
        </button>
      </nav>
    </header>
  );
}
