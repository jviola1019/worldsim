import { normalizeReal, realWorld } from '../../powers/powerSet';
import { useEffect, useRef, useState } from 'preact/hooks';
import { applyMapShape, clampStartEra, eraPeopleDefault, MAX_START_ERA, START_VARIANTS, presetByKey, defaultConfig, PRESETS, randomizeConfig, WORLD_SIZES, randomSeedString, type WorldConfig } from '../../config/laws';
import { MAP_SHAPES, SHAPE_FAMILY_LABELS, mapShape, type MapShape, type MapShapeFamily } from '../../world/mapShapes';
import { ERA_NAMES } from '../../technology/techData';
import { SCENARIOS } from '../../scenarios/scenarios';
import { ConfirmEra } from './ConfirmEra';

type StartKey = 'realistic' | 'god' | 'observer';

/**
 * Ask "Are you sure?" before a start after Prehistoric. On the Scenario screen only when the player moved the
 * era away from the scenario's own (a scenario set in the Atomic age needs no warning).
 */
export function needsEraConfirm(cfg: WorldConfig, scenarioEra?: number): boolean {
  const era = cfg.settings.startEra;
  return era > 1 && (scenarioEra === undefined || era !== scenarioEra);
}

const variant = (key: string) => START_VARIANTS.find((v) => v.key === key)!;

/** Re-apply what a start fixes, whatever else changed: powers, pace and the real-world lock. */
function keepStartRules(c: WorldConfig, start: StartKey): void {
  if (start === 'realistic') {
    c.settings.powerSet = 'grounded';
    c.settings.pace = 'slow';
    c.settings.observer = false;
    c.settings.realism = 'unrestricted';
    c.laws.speculativeTech = true;
  } else if (start === 'observer') {
    c.settings.powerSet = 'none';
    c.settings.observer = true;
    c.settings.realism = 'grounded';
    c.laws.speculativeTech = false;
  }
  normalizeReal(c); // Realistic and Observer: no fantasy, no alien planet, no horrors
}

/**
 * "Randomize settings": roll every setting on a copy, then keep the start's rules, the name, seed, size, map
 * shape and the chosen toggles. A Prehistoric Realistic roll starts empty, as Realistic does.
 */
export function randomizeForStart(cfg: WorldConfig, start: StartKey): WorldConfig {
  const c = structuredClone(cfg);
  randomizeConfig(c);
  c.settings.startEra = clampStartEra(c.settings.startEra);
  if (c.scenario === 'collapse' && c.settings.startEra === 1) c.settings.startEra = 3; // a collapse needs a past
  if (c.settings.alien) c.settings.fantasy = c.gen.fantasy = c.laws.fantasyCreatures = true; // alien worlds hold other peoples
  keepStartRules(c, start);
  if (start === 'realistic' && c.settings.startEra === 1) c.settings.startCivs = 0;
  return c;
}

/** What each start leaves in your hands, shown on its card. */
const START_POWERS: Record<StartKey, string> = {
  realistic: 'You place people and animals',
  god: 'Every power is yours',
  observer: 'No powers: you watch',
};

/** One line under the era setting: what a world at this era starts with (the old era presets at their stops). */
function eraHint(era: number): string {
  if (era === 1) return 'No towns or technology yet. Later eras start with nations already in place.';
  const stop = START_VARIANTS.find((v) => (v.key === 'kingdoms' && era === 4) || (v.key === 'industrial' && era === 7) || (v.key === 'modern' && era === 10));
  return stop ? `${stop.name}: ${stop.description}` : 'Nations, towns and technology will already exist.';
}

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
    if (scenarios) SCENARIOS[0].apply(c);
    else presetByKey('god')!.apply(c); // the highlighted default: hunter-gatherer bands and every power
    return c;
  });
  const [choice, setChoice] = useState(scenarios ? SCENARIOS[0].key : 'god');
  const [scenarioEra, setScenarioEra] = useState<number | undefined>(scenarios ? cfg.settings.startEra : undefined);
  const [confirming, setConfirming] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    // the era dialog closed without starting: focus goes back to "Create world"
    if (confirming) asked.current = true;
    else if (asked.current) { asked.current = false; createRef.current?.focus(); }
  }, [confirming]);
  const startKey: StartKey = scenarios ? 'god' : (choice as StartKey);
  const set = (f: (c: WorldConfig) => void) => {
    const c = structuredClone(cfg);
    f(c);
    setCfg(c);
  };
  /** A start keeps the name, seed, size, map shape, era and the collapse toggle; Alien planet only stays on God mode. */
  const chooseStart = (key: string) => {
    const c = defaultConfig();
    c.name = cfg.name;
    c.gen.seed = cfg.gen.seed;
    c.gen.width = cfg.gen.width;
    c.gen.height = cfg.gen.height;
    const sc = SCENARIOS.find((x) => x.key === key);
    if (sc) {
      sc.apply(c);
      c.settings.startEra = clampStartEra(c.settings.startEra);
      setScenarioEra(c.settings.startEra);
    } else {
      const era = cfg.settings.startEra;
      presetByKey(key)!.apply(c);
      c.settings.startEra = era;
      c.settings.startCivs = eraPeopleDefault(key as StartKey, era);
      if (cfg.scenario === 'collapse') variant('collapse').apply(c);
      if (cfg.settings.alien && key === 'god') {
        variant('alien').apply(c);
        c.settings.startEra = era;
        c.settings.startCivs = cfg.settings.startCivs;
      }
    }
    const shape = cfg.gen.shape ?? 'natural';
    if (shape !== 'natural') applyMapShape(c.gen, shape); // keep the chosen map shape across starts
    setChoice(key);
    setCfg(c);
  };
  const setEra = (v: number) => set((c) => {
    c.settings.startEra = clampStartEra(v);
    if (!scenarios) c.settings.startCivs = eraPeopleDefault(startKey, c.settings.startEra); // a scenario keeps its own peoples
  });
  const toggleCollapse = (on: boolean) => set((c) => {
    if (on) return variant('collapse').apply(c); // at Prehistoric the era moves to Bronze & Early Urban
    c.scenario = undefined;
    c.settings.startCivs = eraPeopleDefault(startKey, c.settings.startEra);
  });
  const toggleAlien = (on: boolean) => set((c) => {
    if (on) {
      const era = c.settings.startEra;
      variant('alien').apply(c);
      if (era > 1) { c.settings.startEra = era; c.settings.startCivs = eraPeopleDefault('god', era); } // keep the chosen era
      return;
    }
    c.gen.alien = c.settings.alien = false;
    c.gen.fantasy = c.settings.fantasy = c.laws.fantasyCreatures = false; // undo what the toggle turned on
  });
  const create = () => (needsEraConfirm(cfg, scenarioEra) ? setConfirming(true) : start(cfg));
  const real = realWorld(cfg.settings); // round 10 addendum: no fiction in Realistic or Observer worlds
  const collapse = cfg.scenario === 'collapse';
  const eraMin = collapse ? 2 : 1; // a collapse needs a past
  const era = cfg.settings.startEra;
  return (
    <main class="screen">
      <div class="page">
        <div class="back-row">
          <button class="btn small" onClick={back}>Back</button>
          <h1>{scenarios ? 'Scenario worlds' : 'New world'}</h1>
        </div>
        <section class="fieldset">
          <h2>{scenarios ? 'Choose a scenario' : 'Choose a start'}</h2>
          {scenarios ? (
            <div class="presets">
              {SCENARIOS.map((p) => (
                <button key={p.key} class="preset" aria-pressed={choice === p.key} onClick={() => chooseStart(p.key)}>
                  <strong>{p.name}</strong>
                  <span>{p.description}</span>
                </button>
              ))}
            </div>
          ) : (
            <div class="presets starts" data-testid="starts">
              {PRESETS.map((p) => (
                <button key={p.key} class="preset start-card" aria-pressed={choice === p.key} onClick={() => chooseStart(p.key)}>
                  <strong>{p.name}</strong>
                  <span>{p.description}</span>
                  <em class="start-powers">{START_POWERS[p.key as StartKey]}</em>
                </button>
              ))}
            </div>
          )}
          <div class="field era-field">
            <div class="field-row">
              <label for="wera">Start in era</label>
              <span class="era-now">{ERA_NAMES[era]}</span>
            </div>
            <input id="wera" type="range" min={eraMin} max={MAX_START_ERA} step={1} value={era} aria-valuetext={ERA_NAMES[era]} aria-describedby="era-hint" onInput={(e) => setEra(Number((e.target as HTMLInputElement).value))} />
            <div class="era-ends" aria-hidden="true">
              <span>{ERA_NAMES[eraMin]}</span>
              <span data-testid="era-max">{ERA_NAMES[MAX_START_ERA]}</span>
            </div>
            <span class="footnote" id="era-hint">{eraHint(era)}</span>
          </div>
          {!scenarios && (
            <>
              <div class="field toggle-field">
                <label class="toggle">
                  After the collapse
                  <input type="checkbox" checked={collapse} aria-describedby="collapse-note" onChange={(e) => toggleCollapse((e.target as HTMLInputElement).checked)} />
                </label>
                <span class="footnote" id="collapse-note">{variant('collapse').description}</span>
              </div>
              <div class="field toggle-field">
                <label class="toggle">
                  Alien planet
                  <input type="checkbox" checked={!!cfg.settings.alien && !real} disabled={real} aria-describedby="alien-note" onChange={(e) => toggleAlien((e.target as HTMLInputElement).checked)} />
                </label>
                <span class="footnote" id="alien-note">{real ? 'God mode only. Realistic and Observer worlds hold only what could really exist.' : variant('alien').description}</span>
              </div>
              <div class="randomize-row">
                <button class="btn small" onClick={() => setCfg(randomizeForStart(cfg, startKey))}>Randomize settings</button>
                <span class="footnote">Rolls the era and the settings below. Your start and its rules stay.</span>
              </div>
            </>
          )}
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
              <input id="wseed" type="text" value={cfg.gen.seed} maxLength={64} onInput={(e) => set((c) => (c.gen.seed = (e.target as HTMLInputElement).value))} />
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
          <Slider label="Starting peoples" value={cfg.settings.startCivs} min={0} max={20} step={1} onInput={(v) => set((c) => (c.settings.startCivs = v))} show={(v) => String(v)} />
          <label class="toggle">
            Empty world (no people or animals)
            <input type="checkbox" checked={cfg.settings.empty} onChange={(e) => set((c) => (c.settings.empty = (e.target as HTMLInputElement).checked))} />
          </label>
          <label class="toggle" data-testid="fantasy-toggle">
            Fantasy peoples & creatures
            <input type="checkbox" checked={cfg.settings.fantasy && !real} disabled={real} aria-describedby={real ? 'real-note' : undefined} onChange={(e) => set((c) => ((c.settings.fantasy = (e.target as HTMLInputElement).checked), (c.gen.fantasy = c.settings.fantasy), (c.laws.fantasyCreatures = c.settings.fantasy)))} />
          </label>
          {real && <span class="footnote" id="real-note">Realistic and Observer worlds hold only what could really exist.</span>}
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
          <div class="field">
            <span class="label" id="pace-label">Pace</span>
            <div class="seg" role="group" aria-labelledby="pace-label" data-testid="pace">
              {(['standard', 'slow'] as const).map((p) => (
                <button key={p} aria-pressed={(cfg.settings.pace ?? 'standard') === p} onClick={() => set((c) => (c.settings.pace = p))}>
                  {p === 'standard' ? 'Standard' : 'Slow'}
                </button>
              ))}
            </div>
            <span class="footnote">Slow: people take generations to settle and centuries to build cities.</span>
          </div>
        </section>
        <div class="sticky-actions">
          <button ref={createRef} class="btn primary" onClick={create}>Create world</button>
        </div>
      </div>
      {confirming && <ConfirmEra era={era} onCancel={() => setConfirming(false)} onConfirm={() => { asked.current = false; setConfirming(false); start(cfg); }} />}
    </main>
  );
}
