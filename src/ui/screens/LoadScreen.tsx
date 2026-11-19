import { useEffect, useRef, useState } from 'preact/hooks';
import { store } from '../App';
import type { SlotMeta } from '../../persistence/saves';
import { importBytes, groupByDevice } from '../../persistence/saves';
import { currentDevice } from '../../persistence/device';
import type { WorldState } from '../../sim/types';
import { fmt } from '../shared';

/** Other devices that saved this world (by id, so two phones with the same name both count). */
const alsoOn = (s: SlotMeta) => (s.devicesSeen ?? []).filter((d) => typeof d === 'object' && d.id !== s.deviceId).map((d) => d.name).join(', ');

export function LoadScreen({ back, open, setBusy }: { back: () => void; open: (w: WorldState) => void; setBusy: (s: string) => void }) {
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const device = currentDevice();
  const refresh = () => store.list().then(setSlots);
  useEffect(() => {
    refresh();
  }, []);
  const load = async (slot: string) => {
    setBusy('Loading world…');
    try {
      open(await store.load(slot));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };
  const importFile = async (f: File) => {
    setBusy('Importing world…');
    try {
      // a real save is a few MB; refuse anything far larger before reading it into memory
      if (f.size > 64 * 1024 * 1024) throw new Error('the file is too large to be an EPOCH world');
      open(await importBytes(new Uint8Array(await f.arrayBuffer())));
    } catch (e) {
      setError(`Could not import "${f.name}": ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy('');
    }
  };
  return (
    <main class="screen">
      <div class="page">
        <div class="back-row">
          <button class="btn small" onClick={back}>Back</button>
          <h1>Load world</h1>
        </div>
        {!store.available && <p class="empty-note">Saving is unavailable in this browser ({store.error || 'storage blocked'}). You can still import a world file.</p>}
        {error && <p class="toast warn" role="alert">{error}</p>}
        <div class="slots">
          {slots.length === 0 && store.available && <p class="empty-note">No saved worlds yet. Create one, then save it from the in-game menu.</p>}
          {groupByDevice(slots, device.id).map((g) => (
            <section key={g.title} class="device-group" aria-label={g.title}>
              <h2 class="device-title">{g.title}{g.here ? ` (${device.name})` : ''}</h2>
          {g.slots.map((s) => (
            <div class="slot" key={s.slot}>
              {s.thumbnail ? <img src={s.thumbnail} alt="" /> : <span />}
              <div>
                <strong>{s.name}</strong>
                {s.autosave && <span class="chip" style={{ marginLeft: 6 }}>Autosave</span>}
                <div class="meta">
                  Year {s.year} · {fmt(s.population ?? 0)} people · {s.civs ?? 0} nations
                  <br />
                  Seed {s.seed} · saved {new Date(s.savedAt).toLocaleString()}
                  {s.branchOf ? <><br />Branch of {s.branchOf}</> : null}
                  {s.deviceName ? <><br />Saved on {s.deviceId === device.id ? 'this device' : s.deviceName}{alsoOn(s) ? ` · also saved on ${alsoOn(s)}` : ''}</> : null}
                </div>
              </div>
              <div class="actions">
                <button class="btn small primary" onClick={() => load(s.slot)}>Load</button>
                <button class="btn small danger" onClick={async () => { if (confirm(`Delete "${s.name}"?`)) { await store.remove(s.slot); refresh(); } }}>Delete</button>
              </div>
            </div>
          ))}
            </section>
          ))}
        </div>
        <div class="row">
          <button class="btn" onClick={() => file.current?.click()}>Import world file</button>
          <input ref={file} type="file" accept=".epoch,application/octet-stream" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) importFile(f); }} />
        </div>
      </div>
    </main>
  );
}
