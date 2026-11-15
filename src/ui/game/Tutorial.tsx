import { useState } from 'preact/hooks';

const STEPS = [
  { title: 'Welcome, watcher', text: 'This world runs on its own. Peoples forage, settle, invent, trade, worship and fight without you. Press play and watch.' },
  { title: 'Move around', text: 'Drag with one finger to move the map and pinch to zoom. On a computer, drag and use the mouse wheel.' },
  { title: 'Learn anything', text: 'Tap a settlement, nation, army or animal to inspect it. Every number you see comes from the simulation.' },
  { title: 'Shape the world', text: 'Open a category in the bottom bar and pick a power. Brushes paint with one finger; two fingers still move the map.' },
  { title: 'Follow the story', text: 'The history book records wars, inventions, revolutions and the measured reasons behind them. Save often — or branch a timeline to try another fate.' },
];

export function Tutorial({ done }: { done: () => void }) {
  const [k, setK] = useState(0);
  const s = STEPS[k];
  return (
    <div class="tutorial" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <h2 id="tut-title">{s.title}</h2>
      <p>{s.text}</p>
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <button class="btn small" onClick={done}>Skip</button>
        <span class="muted">{k + 1} / {STEPS.length}</span>
        <button class="btn small primary" onClick={() => (k + 1 < STEPS.length ? setK(k + 1) : done())}>
          {k + 1 < STEPS.length ? 'Next' : 'Start watching'}
        </button>
      </div>
    </div>
  );
}
