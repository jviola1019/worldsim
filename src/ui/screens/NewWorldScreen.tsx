import { useState } from 'preact/hooks';
import { applyMapShape, defaultConfig, PRESETS, WORLD_SIZES, randomizeConfig, randomSeedString, type WorldConfig } from '../../config/laws';
import { MAP_SHAPES, SHAPE_FAMILY_LABELS, mapShape, type MapShape, type MapShapeFamily } from '../../world/mapShapes';
import { ERA_NAMES } from '../../technology/techData';
import { SCENARIOS } from '../../scenarios/scenarios';

function Slider({ label, value, min, max, step, onInput, show }: { label: string; value: number; min: number; max: number; step: number; onInput: (v: number) => void; show?: (v: number) => string }) {
  return (
    <div class="field">
      <div class="field-row">
        <label>{label}</label>
        <span>{show ? show(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
    </div>
  );
}

const SHAPE_FAMILIES = Object.keys(SHAPE_FAMILY_LABELS) as MapShapeFamily[];

/** Map shape picker: a native select grouped by family (compact and touch-friendly), with the shape's description below. */
function MapShapeField({ value, onChange }: { value: MapShape; onChange: (key: MapShape) => void }) {
  return (
    <div class="field">
      <label for="wshape">Map shape</label>
      <select id="wshape" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as MapShape)}>
        {SHAPE_FAMILIES.map((fam) => (
          <optgroup key={fam} label={SHAPE_FAMILY_LABELS[fam]}>
            {MAP_SHAPES.filter((s) => s.family === fam).map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <span class="footnote">{mapShape(value).description}</span>
    </div>
  );
}

const lvl = (v: number) => (v < 0.25 ? 'Very low' : v < 0.45 ? 'Low' : v < 0.6 ? 'Medium' : v < 0.8 ? 'High' : 'Very high');
const mult = (v: number) => `${v.toFixed(1)}×`;

export function NewWorldScreen({ scenarios, back, start }: { scenarios: boolean; back: () => void; start: (c: WorldConfig) => void }) {
  const [cfg, setCfg] = useState<WorldConfig>(() => {
    const c = defaultConfig();
    PRESETS.find((p) => p.key === 'primitive')!.apply(c); // the highlighted default (not the list's first entry)
    return c;
  });
  const [preset, setPreset] = useState(scenarios ? SCENARIOS[0].key : 'primitive');
  const set = (f: (c: WorldConfig) => void) => {
    const c = structuredClone(cfg);
    f(c);
    setCfg(c);
  };
  const choosePreset = (key: string) => {
    const c = defaultConfig();
    c.name = cfg.name;
    c.gen.seed = cfg.gen.seed;
    c.gen.width = cfg.gen.width;
    c.gen.height = cfg.gen.height;
    const p = PRESETS.find((x) => x.key === key);
    if (p) {
      p.apply(c);
      if (key === 'random') randomizeConfig(c);
    }
    const sc = SCENARIOS.find((x) => x.key === key);
    if (sc) sc.apply(c);
    const shape = cfg.gen.shape ?? 'natural';
    if (shape !== 'natural') applyMapShape(c.gen, shape); // keep the chosen map shape across presets
    setPreset(key);
    setCfg(c);
  };
  const list = scenarios ? SCENARIOS : PRESETS;
  return (
    <main class="screen">
      <div class="page">
        <div class="back-row">
          <button class="btn small" onClick={back}>Back</button>
          <h1>{scenarios ? 'Scenario worlds' : 'New world'}</h1>
        </div>
        <section class="fieldset">
          <h2>{scenarios ? 'Choose a scenario' : 'Start from a preset'}</h2>
          <div class="presets">
            {list.map((p) => (
              <button key={p.key} class="preset" aria-pressed={preset === p.key} onClick={() => choosePreset(p.key)}>
                <strong>{p.name}</strong>
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        </section>
        <section class="fieldset">
          <h2>Identity</h2>
          <div class="field">
            <label for="wname">World name</label>
            <input id="wname" type="text" value={cfg.name} maxLength={40} onInput={(e) => set((c) => (c.name = (e.target as HTMLInputElement).value))} />
          </div>
          <div class="field">
            <label for="wseed">Seed (same seed + settings = same world)</label>
            <div class="field-row">
              <input id="wseed" type="text" value={cfg.gen.seed} onInput={(e) => set((c) => (c.gen.seed = (e.target as HTMLInputElement).value))} />
              <button class="btn small" onClick={() => set((c) => (c.gen.seed = randomSeedString()))}>Shuffle</button>
            </div>
          </div>
          <div class="field">
            <label>Size</label>
            <div class="seg">
              {WORLD_SIZES.map((s) => (
                <button key={s.key} aria-pressed={cfg.gen.width === s.w} onClick={() => set((c) => ((c.gen.width = s.w), (c.gen.height = s.h)))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section class="fieldset">
          <h2>Geography</h2>
          <MapShapeField value={cfg.gen.shape ?? 'natural'} onChange={(key) => set((c) => applyMapShape(c.gen, key))} />
          <div class="field">
            <label>Landmass</label>
            <div class="seg">
              {(['continents', 'pangaea', 'archipelago', 'islands'] as const).map((l) => (
                <button key={l} aria-pressed={cfg.gen.landmass === l} onClick={() => set((c) => (c.gen.landmass = l))}>
                  {l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Ocean coverage" value={cfg.gen.oceanCoverage} min={0.1} max={0.9} step={0.01} onInput={(v) => set((c) => (c.gen.oceanCoverage = v))} show={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Continental fragmentation" value={cfg.gen.fragmentation} min={0} max={1} step={0.01} onInput={(v) => set((c) => (c.gen.fragmentation = v))} show={lvl} />
          <Slider label="Mountains" value={cfg.gen.mountains} min={0} max={1} step={0.01} onInput={(v) => set((c) => (c.gen.mountains = v))} show={lvl} />
          <Slider label="Rivers" value={cfg.gen.rivers} min={0} max={1} step={0.01} onInput={(v) => set((c) => (c.gen.rivers = v))} show={lvl} />
          <Slider label="Climate variation" value={cfg.gen.climateVariation} min={0} max={1} step={0.01} onInput={(v) => set((c) => (c.gen.climateVariation = v))} show={lvl} />
          <Slider label="Temperature" value={cfg.gen.temperature} min={-2} max={2} step={0.05} onInput={(v) => set((c) => (c.gen.temperature = v))} show={(v) => (v < -1.2 ? 'Frozen' : v < -0.3 ? 'Ice age' : v > 1.2 ? 'Scorching' : v > 0.3 ? 'Hothouse' : 'Temperate')} />
          <Slider label="Moisture" value={cfg.gen.moisture} min={-2} max={2} step={0.05} onInput={(v) => set((c) => (c.gen.moisture = v))} show={(v) => (v < -1.2 ? 'Desert world' : v < -0.3 ? 'Arid' : v > 1.2 ? 'Drenched' : v > 0.3 ? 'Wet' : 'Moderate')} />
          <Slider label="Resource abundance" value={cfg.gen.resources} min={0.2} max={2} step={0.05} onInput={(v) => set((c) => (c.gen.resources = v))} show={mult} />
        </section>
        <section class="fieldset">
          <h2>Life & history</h2>
          <Slider label="Starting biodiversity" value={cfg.settings.biodiversity} min={0} max={2} step={0.05} onInput={(v) => set((c) => (c.settings.biodiversity = v))} show={mult} />
          <Slider label="Natural disaster frequency" value={cfg.settings.disasterFrequency} min={0} max={2} step={0.05} onInput={(v) => set((c) => (c.settings.disasterFrequency = v))} show={mult} />
          <Slider label="Civilizational aggressiveness" value={cfg.settings.aggressiveness} min={0} max={2} step={0.05} onInput={(v) => set((c) => (c.settings.aggressiveness = v))} show={mult} />
          <Slider label="Technological advancement speed" value={cfg.settings.techSpeed} min={0.25} max={4} step={0.05} onInput={(v) => set((c) => (c.settings.techSpeed = v))} show={mult} />
          <Slider label="Starting era" value={cfg.settings.startEra} min={1} max={11} step={1} onInput={(v) => set((c) => (c.settings.startEra = v))} show={(v) => ERA_NAMES[v]} />
          <Slider label="Starting peoples" value={cfg.settings.startCivs} min={0} max={20} step={1} onInput={(v) => set((c) => (c.settings.startCivs = v))} show={(v) => String(v)} />
          <label class="toggle">
            Empty world (no people or animals)
            <input type="checkbox" checked={cfg.settings.empty} onChange={(e) => set((c) => (c.settings.empty = (e.target as HTMLInputElement).checked))} />
          </label>
          <label class="toggle">
            Fantasy peoples & creatures
            <input type="checkbox" checked={cfg.settings.fantasy} onChange={(e) => set((c) => ((c.settings.fantasy = (e.target as HTMLInputElement).checked), (c.gen.fantasy = c.settings.fantasy), (c.laws.fantasyCreatures = c.settings.fantasy)))} />
          </label>
          <div class="field">
            <label>Future technology</label>
            <div class="seg">
              {(['grounded', 'plausible', 'unrestricted'] as const).map((r) => (
                <button key={r} aria-pressed={cfg.settings.realism === r} onClick={() => set((c) => ((c.settings.realism = r), (c.laws.speculativeTech = r === 'unrestricted')))}>
                  {r === 'grounded' ? 'Grounded' : r === 'plausible' ? 'Plausible' : 'Science fiction'}
                </button>
              ))}
            </div>
            <span class="footnote">Grounded stops at credible near-future tech. Science fiction unlocks speculative eras (megastructures, AGI, terraforming).</span>
          </div>
        </section>
        <div class="sticky-actions">
          <button class="btn primary" onClick={() => start(cfg)}>Create world</button>
        </div>
      </div>
    </main>
  );
}
