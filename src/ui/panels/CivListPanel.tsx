import { useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import { Icon, fmt, Flag } from '../shared';
import { ERA_NAMES } from '../../technology/techData';

export function CivListPanel({ sim, close, open }: { sim: Simulation; close: () => void; open: (id: number) => void }) {
  const [showFallen, setShowFallen] = useState(false);
  const civs = [...sim.w.civs.values()].filter((c) => showFallen || c.alive).sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.population - a.population);
  return (
    <aside class="sheet" aria-label="Nations">
      <div class="sheet-head">
        <Icon id="ico.crown" size={28} />
        <h2>Nations</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body">
        <div class="filters">
          <button aria-pressed={showFallen} onClick={() => setShowFallen(!showFallen)}>Include fallen nations</button>
        </div>
        <ul class="list">
          {civs.map((c) => (
            <li key={c.id}>
              <button onClick={() => open(c.id)}>
                <div class="row">
                  <Flag civ={c} size={14} />
                  <strong>{c.name}</strong>
                </div>
                <div class="muted">
                  {c.alive ? `${fmt(c.population)} people · ${c.settlements.length} settlements · ${ERA_NAMES[c.era]}` : `Fell ${c.fell}: ${c.fellCause}`}
                </div>
              </button>
            </li>
          ))}
          {!civs.length && <li>No nations yet. Place people with the Peoples tools.</li>}
        </ul>
      </div>
    </aside>
  );
}
