import { godMode } from '../../powers/powerSet';
import { useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import { LAW_LABELS } from '../../config/laws';
import type { WorldLaws } from '../../sim/types';
import { Icon } from '../shared';
import { BALANCE } from '../../config/balance';

const TUNABLE: { key: keyof typeof BALANCE; label: string; min: number; max: number; step: number }[] = [
  { key: 'tfrMax', label: 'Natural fertility (children per woman)', min: 3, max: 9, step: 0.1 },
  { key: 'famineMortality', label: 'Famine severity', min: 1, max: 12, step: 0.5 },
  { key: 'farmYield', label: 'Farm yield', min: 400, max: 3000, step: 50 },
  { key: 'folkResearch', label: 'Research rate', min: 0.05, max: 1, step: 0.01 },
  { key: 'techEraScale', label: 'Later-era tech cost growth', min: 1, max: 2, step: 0.05 },
  { key: 'maxEmigration', label: 'Migration intensity', min: 0, max: 0.2, step: 0.01 },
  { key: 'warPropensity', label: 'Conflict likelihood (multiplier)', min: 0, max: 3, step: 0.1 },
  { key: 'vegRegrowth', label: 'Vegetation regrowth', min: 0.002, max: 0.05, step: 0.002 },
];

export function LawsPanel({ sim, close }: { sim: Simulation; close: () => void }) {
  const [, force] = useState(0);
  const laws = sim.w.laws;
  const toggle = (k: keyof WorldLaws) => {
    (laws as any)[k] = !(laws as any)[k];
    force((x) => x + 1);
  };
  const boolKeys = (Object.keys(LAW_LABELS) as (keyof WorldLaws)[]).filter((k) => typeof laws[k] === 'boolean' && !(k === 'horrors' && !godMode(sim.w.meta.settings)));
  return (
    <aside class="sheet" aria-label="World laws">
      <div class="sheet-head">
        <Icon id="ico.cat_laws" size={28} />
        <h2>World laws</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body">
        <section class="fieldset">
          {boolKeys.map((k) => (
            <label class="toggle" key={k}>
              {LAW_LABELS[k]}
              <input type="checkbox" checked={laws[k] as boolean} onChange={() => toggle(k)} />
            </label>
          ))}
          <div class="field">
            <label>Research speed: {laws.researchSpeed.toFixed(2)}×</label>
            <input type="range" min={0.1} max={5} step={0.05} value={laws.researchSpeed} onInput={(e) => { laws.researchSpeed = Number((e.target as HTMLInputElement).value); force((x) => x + 1); }} />
          </div>
          <div class="field">
            <label>Population cap: {laws.populationCap ? laws.populationCap.toLocaleString('en-US') : 'none'}</label>
            <input type="range" min={0} max={10} step={1} value={laws.populationCap ? Math.log10(laws.populationCap) : 0} onInput={(e) => { const v = Number((e.target as HTMLInputElement).value); laws.populationCap = v === 0 ? 0 : Math.pow(10, v); force((x) => x + 1); }} />
          </div>
        </section>
        <details class="fieldset">
          <summary>Balance parameters (for tinkerers)</summary>
          <p class="muted">These change the simulation coefficients for this session. They are shared by all worlds until you reload the page.</p>
          {TUNABLE.map((t) => (
            <div class="field" key={t.key}>
              <label>{t.label}: {(BALANCE[t.key] as number).toFixed(3)}</label>
              <input type="range" min={t.min} max={t.max} step={t.step} value={BALANCE[t.key] as number} onInput={(e) => { (BALANCE as any)[t.key] = Number((e.target as HTMLInputElement).value); force((x) => x + 1); }} />
            </div>
          ))}
        </details>
      </div>
    </aside>
  );
}
