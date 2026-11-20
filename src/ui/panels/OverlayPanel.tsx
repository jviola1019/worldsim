import { useState } from 'preact/hooks';
import type { Renderer } from '../../rendering/renderer';
import { OVERLAYS } from '../../rendering/overlays';
import { Icon } from '../shared';

export function OverlayPanel({ renderer, close }: { renderer: Renderer; close: () => void }) {
  const [mode, setMode] = useState(renderer.overlay.mode);
  const cur = OVERLAYS.find((o) => o.mode === mode);
  return (
    <aside class="sheet" aria-label="Map layers">
      <div class="sheet-head">
        <Icon id="ico.layers" size={28} />
        <h2>Map layers</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body" tabIndex={0}>
        <div class="overlay-grid">
          {OVERLAYS.map((o) => (
            <button
              key={o.mode}
              aria-pressed={mode === o.mode}
              onClick={() => {
                renderer.overlay.mode = o.mode;
                renderer.overlay.update(true);
                setMode(o.mode);
              }}
            >
              <Icon id={o.icon} size={32} />
              {o.label}
            </button>
          ))}
        </div>
        {cur && <p class="muted">{cur.legend}</p>}
        {mode === 'history' && <HistorySlider renderer={renderer} />}
        <label class="toggle">
          Names on the map
          <input type="checkbox" checked={renderer.showLabels} onChange={(e) => (renderer.showLabels = (e.target as HTMLInputElement).checked)} />
        </label>
      </div>
    </aside>
  );
}

function HistorySlider({ renderer }: { renderer: Renderer }) {
  const snaps = renderer.sim.w.stats.territory ?? [];
  const [year, setYear] = useState(renderer.overlay.historyYear || renderer.sim.year);
  if (!snaps.length) return <p class="muted">No borders recorded yet — the first snapshot is taken in the next year divisible by 25.</p>;
  const first = snaps[0].year;
  const last = snaps[snaps.length - 1].year;
  const shown = renderer.overlay.historyGrid()?.year ?? last;
  return (
    <label class="slider">
      <span>Borders in year <strong>{shown}</strong></span>
      <input
        type="range"
        min={first}
        max={last}
        step={1}
        value={Math.min(last, Math.max(first, year))}
        aria-label="Year shown by the past borders layer"
        onInput={(e) => {
          const y = Number((e.target as HTMLInputElement).value);
          renderer.overlay.historyYear = y;
          renderer.overlay.update(true);
          setYear(y);
        }}
      />
      <span class="muted small">{snaps.length} snapshots, {first}–{last}</span>
    </label>
  );
}
