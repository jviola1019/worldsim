import { useMemo, useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import type { EventCategory } from '../../sim/types';
import { Icon } from '../shared';
import { Causes } from './Inspector';

const CATS: [EventCategory | 'all', string][] = [
  ['all', 'All'], ['war', 'Wars'], ['politics', 'Politics'], ['diplomacy', 'Diplomacy'], ['technology', 'Inventions'], ['religion', 'Faith'],
  ['founding', 'Foundings'], ['economy', 'Economy'], ['demography', 'People'], ['disaster', 'Disasters'], ['culture', 'Culture'], ['nature', 'Nature'], ['space', 'Space'], ['god', 'Your deeds'],
];

export function HistoryPanel({ sim, close, focus, selectedCiv, openCiv }: { sim: Simulation; close: () => void; focus: (x: number, y: number) => void; selectedCiv: number; openCiv: (id: number) => void }) {
  const [cat, setCat] = useState<EventCategory | 'all'>('all');
  const [major, setMajor] = useState(true);
  const [onlyCiv, setOnlyCiv] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const evs = useMemo(() => {
    const out = [];
    const ql = q.toLowerCase();
    for (let k = sim.w.events.length - 1; k >= 0 && out.length < 250; k--) {
      const e = sim.w.events[k];
      if (cat !== 'all' && e.cat !== cat) continue;
      if (major && e.importance < 2) continue;
      if (onlyCiv && selectedCiv && !e.civs.includes(selectedCiv)) continue;
      if (ql && !e.title.toLowerCase().includes(ql) && !String(e.year).startsWith(ql)) continue;
      out.push(e);
    }
    return out;
  }, [sim.w.events.length, cat, major, onlyCiv, q, selectedCiv]);
  return (
    <aside class="sheet" aria-label="World history">
      <div class="sheet-head">
        <Icon id="ico.history" size={28} />
        <h2>History of {sim.w.meta.name}</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body" tabIndex={0}>
        <input type="text" placeholder="Search events or a year" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search history" />
        <div class="filters" role="group" aria-label="Categories">
          {CATS.map(([k, label]) => (
            <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>{label}</button>
          ))}
        </div>
        <div class="filters">
          <button aria-pressed={major} onClick={() => setMajor(!major)}>Major events only</button>
          {selectedCiv > 0 && <button aria-pressed={onlyCiv} onClick={() => setOnlyCiv(!onlyCiv)}>Only {sim.w.civs.get(selectedCiv)?.name}</button>}
        </div>
        <ul class="list">
          {evs.map((e) => (
            <li key={e.id}>
              <button onClick={() => { setOpen(open === e.id ? null : e.id); if (e.x >= 0) focus(e.x, e.y); }} aria-expanded={open === e.id}>
                <span class="when">{e.year}</span>
                {e.title}
              </button>
              {open === e.id && (
                <div>
                  {e.text && <p class="muted">{e.text}</p>}
                  {e.causes && (
                    <>
                      <div class="muted">Measured conditions behind this:</div>
                      <Causes causes={e.causes} />
                    </>
                  )}
                  <div class="row">
                    {e.civs.map((c) => {
                      const civ = sim.w.civs.get(c);
                      return civ ? <button key={c} class="chip" onClick={() => openCiv(c)}><i class="swatch" style={{ background: civ.color }} />{civ.name}</button> : null;
                    })}
                  </div>
                </div>
              )}
            </li>
          ))}
          {!evs.length && <li>No matching events yet.</li>}
        </ul>
      </div>
    </aside>
  );
}
