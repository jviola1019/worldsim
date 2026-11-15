import { useState } from 'preact/hooks';
import { CATEGORIES, POWERS, POWER_BY_ID, type PowerCategory } from '../../powers/powers';
import { Icon } from '../shared';

export function Dock({ tool, setTool, brushSize, setBrushSize, openLaws, canUndo, onUndo }: { tool: string; setTool: (t: string) => void; brushSize: number; setBrushSize: (n: number) => void; openLaws: () => void; canUndo: boolean; onUndo: () => void }) {
  const [cat, setCat] = useState<PowerCategory | null>(null);
  const active = POWER_BY_ID[tool];
  const tools = cat ? POWERS.filter((p) => p.cat === cat) : [];
  return (
    <div class="dock">
      {active && (
        <div class="active-tool" role="status">
          <Icon id={active.icon} size={20} />
          {active.label}
          <button aria-label="Stop using this power" onClick={() => setTool('inspect')}>
            <Icon id="ico.close" size={16} />
          </button>
        </div>
      )}
      {cat && (
        <div class="tool-row" role="toolbar" aria-label={CATEGORIES.find((c) => c.id === cat)?.label}>
          <button class="tool" aria-pressed={tool === 'inspect'} onClick={() => setTool('inspect')} title="Inspect: tap anything to learn about it">
            <Icon id="ico.inspect" size={32} />
            <span>Inspect</span>
          </button>
          {tools.map((p) => (
            <button key={p.id} class={'tool' + (p.destructive ? ' destructive' : '')} aria-pressed={tool === p.id} onClick={() => setTool(tool === p.id ? 'inspect' : p.id)} title={p.desc}>
              <Icon id={p.icon} size={32} />
              <span>{p.label}</span>
            </button>
          ))}
          {active?.kind === 'brush' && (
            <label class="brush-row">
              <Icon id="ico.brush_size" size={22} />
              <input type="range" min={0} max={8} step={1} value={brushSize} aria-label="Brush size" onInput={(e) => setBrushSize(Number((e.target as HTMLInputElement).value))} />
            </label>
          )}
          {cat === 'terrain' && (
            <button class="tool" onClick={onUndo} disabled={!canUndo} title="Undo the last terrain edit" style={{ opacity: canUndo ? 1 : 0.4 }}>
              <Icon id="ico.undo" size={32} />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
      <nav class="cat-row" aria-label="Power categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            class="cat"
            aria-pressed={cat === c.id}
            aria-label={c.label}
            title={c.label}
            onClick={() => {
              if (c.id === 'laws') {
                openLaws();
                return;
              }
              setCat(cat === c.id ? null : c.id);
            }}
          >
            <Icon id={c.icon} size={30} />
          </button>
        ))}
      </nav>
    </div>
  );
}
