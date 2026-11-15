import { useEffect, useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import { Simulation as SimClass } from '../../sim/simulation';
import type { Renderer } from '../../rendering/renderer';
import { store } from '../App';
import { exportBlob, branchMeta, type SlotMeta } from '../../persistence/saves';
import { unpackWorld, packWorld } from '../../persistence/serialize';
import { Icon } from '../shared';

export function MenuPanel({ sim, renderer, close, exit, toast, replaceSim }: { sim: Simulation; renderer: Renderer; close: () => void; exit: () => void; toast: (t: string, warn?: boolean) => void; replaceSim: (s: Simulation) => void }) {
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    store.list().then(setSlots);
  }, []);
  const slotKey = `world-${sim.w.meta.seed}-${sim.w.meta.name}`.replace(/\s+/g, '_');
  const save = async () => {
    setBusy(true);
    try {
      sim.syncRng();
      await store.save(slotKey, sim.w, { thumbnail: renderer.thumbnail() });
      toast(`Saved “${sim.w.meta.name}” (year ${sim.year})`);
      setSlots(await store.list());
    } catch (e) {
      toast(`Could not save: ${e instanceof Error ? e.message : e}`, true);
    } finally {
      setBusy(false);
    }
  };
  const exportFile = async () => {
    sim.syncRng();
    const blob = await exportBlob(sim.w);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sim.w.meta.name.replace(/[^\w-]+/g, '_')}-y${sim.year}.epoch`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('World file exported');
  };
  const branch = async () => {
    setBusy(true);
    try {
      sim.syncRng();
      // deep copy via the save format, then rename as an alternate timeline
      const copy = await unpackWorld(await packWorld(sim.w));
      branchMeta(copy, `${sim.w.meta.name} (alt. ${sim.year})`);
      if (store.available) await store.save(`branch-${Date.now()}`, copy, { thumbnail: renderer.thumbnail() });
      replaceSim(new SimClass(copy));
      toast('You are now in an alternate timeline. The original was kept.');
      close();
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside class="sheet" aria-label="Game menu">
      <div class="sheet-head">
        <Icon id="ico.menu" size={28} />
        <h2>{sim.w.meta.name}</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body">
        <p class="muted">Seed “{sim.w.meta.seed}” · engine {sim.w.meta.engineVersion} · {sim.w.interventions.length} divine interventions recorded{sim.w.meta.branchOf ? ` · branched from ${sim.w.meta.branchOf.name} in year ${sim.w.meta.branchOf.year}` : ''}</p>
        <div class="menu">
          <button class="primary" disabled={busy || !store.available} onClick={save}>Save world</button>
          <button disabled={busy} onClick={branch}>Branch timeline here</button>
          <button onClick={exportFile}>Export world file</button>
          <button onClick={exit}>Leave to title</button>
        </div>
        {!store.available && <p class="toast warn">Saving in the browser is unavailable here ({store.error}). Export the world file to keep it.</p>}
        <div class="section">
          <h3>Saved worlds</h3>
          <ul class="list">{slots.slice(0, 8).map((s) => <li key={s.slot}>{s.name} — year {s.year}{s.autosave ? ' (autosave)' : ''}</li>)}</ul>
        </div>
      </div>
    </aside>
  );
}
