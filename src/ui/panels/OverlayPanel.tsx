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
      <div class="sheet-body">
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
        <label class="toggle">
          Names on the map
          <input type="checkbox" checked={renderer.showLabels} onChange={(e) => (renderer.showLabels = (e.target as HTMLInputElement).checked)} />
        </label>
      </div>
    </aside>
  );
}
