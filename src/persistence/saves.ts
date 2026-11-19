/**
 * Local-first save storage in IndexedDB.
 *
 * Two object stores: `meta` (small slot summaries with thumbnail, name, year,
 * seed, versions, timestamps) and `data` (packed world bytes). Writes are a
 * single transaction over both stores, so an interrupted write never leaves a
 * slot's metadata pointing at missing data. Autosave rotates between two
 * slots so a crash during autosave keeps the previous one intact. When
 * IndexedDB is unavailable (private browsing, quota 0) `available` is false
 * and the game still runs; export/import to files keeps working.
 */
import type { WorldState } from '../sim/types';
import { packWorld, unpackWorld, SaveError } from './serialize';
import { ENGINE_VERSION, SAVE_VERSION } from '../config/laws';
import { currentDevice, stampDevice } from './device';

export interface SlotMeta {
  slot: string;
  /** Round 9: the device this save was made on (absent for saves from before round 9). */
  deviceId?: string;
  deviceName?: string;
  /** The device the world started on (the oldest in its device history) and every device that saved it. */
  originId?: string;
  originName?: string;
  devicesSeen?: { id: string; name: string }[];
  name: string;
  year: number;
  seed: string;
  savedAt: number;
  engineVersion: string;
  saveVersion: number;
  bytes: number;
  thumbnail?: string;
  branchOf?: string;
  autosave?: boolean;
  population?: number;
  civs?: number;
}

const DB = 'epoch-saves';
const VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export class SaveStore {
  private db: IDBDatabase | null = null;
  available = false;
  error = '';

  async open(): Promise<boolean> {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available in this browser');
      const open = indexedDB.open(DB, VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'slot' });
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
      };
      // never hang: a blocked upgrade (another tab) or a stalled store degrades to "unavailable"
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const timer = setTimeout(() => rej(new Error('Browser storage did not respond')), 8000);
        open.onblocked = () => { clearTimeout(timer); rej(new Error('Storage is in use by another tab of this game')); };
        req(open).then((d) => { clearTimeout(timer); res(d); }, (e) => { clearTimeout(timer); rej(e); });
      });
      db.onversionchange = () => db.close(); // let a newer tab upgrade instead of blocking it
      this.db = db;
      this.available = true;
    } catch (e) {
      this.available = false;
      this.error = e instanceof Error ? e.message : String(e);
    }
    return this.available;
  }

  async list(): Promise<SlotMeta[]> {
    if (!this.db) return [];
    const tx = this.db.transaction('meta', 'readonly');
    const all = (await req(tx.objectStore('meta').getAll())) as SlotMeta[];
    return all.sort((a, b) => b.savedAt - a.savedAt);
  }

  async save(slot: string, w: WorldState, extra: Partial<SlotMeta> = {}): Promise<SlotMeta> {
    if (!this.db) throw new SaveError('Saving is unavailable: ' + (this.error || 'storage not open'));
    const device = currentDevice();
    stampDevice(w, device);
    const bytes = await packWorld(w);
    const pop = [...w.civs.values()].filter((c) => c.alive).reduce((a, c) => a + c.population, 0);
    const meta: SlotMeta = {
      slot,
      name: w.meta.name,
      year: w.meta.startYear + Math.floor(w.tick / 120),
      seed: w.meta.seed,
      savedAt: Date.now(),
      engineVersion: ENGINE_VERSION,
      saveVersion: SAVE_VERSION,
      bytes: bytes.length,
      population: Math.round(pop),
      civs: [...w.civs.values()].filter((c) => c.alive).length,
      branchOf: w.meta.branchOf?.name,
      deviceId: device.id,
      deviceName: device.name,
      originId: w.meta.origin?.id,
      originName: w.meta.origin?.name,
      devicesSeen: w.meta.devices?.map((d) => ({ id: d.id, name: d.name })),
      ...extra,
    };
    const tx = this.db.transaction(['meta', 'data'], 'readwrite');
    try {
      tx.objectStore('data').put(bytes, slot);
      tx.objectStore('meta').put(meta);
    } catch (e) {
      tx.abort(); // all-or-nothing: never data without its slot entry, or a slot entry for old data
      throw e instanceof SaveError ? e : new SaveError('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error ?? new SaveError('Save failed'));
      tx.onabort = () => rej(tx.error ?? new SaveError('Save aborted (storage full?)'));
    });
    return meta;
  }

  async load(slot: string): Promise<WorldState> {
    if (!this.db) throw new SaveError('Saving is unavailable');
    const tx = this.db.transaction('data', 'readonly');
    const bytes = (await req(tx.objectStore('data').get(slot))) as Uint8Array | undefined;
    if (!bytes) throw new SaveError('Save slot is empty');
    return unpackWorld(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer));
  }

  async remove(slot: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(['meta', 'data'], 'readwrite');
    tx.objectStore('meta').delete(slot);
    tx.objectStore('data').delete(slot);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error ?? new SaveError('Delete failed'));
      tx.onabort = () => rej(tx.error ?? new SaveError('Delete aborted'));
    });
  }

  /** Autosave alternates between two slots so one good copy always survives. */
  async autosave(w: WorldState, thumbnail?: string): Promise<SlotMeta> {
    const metas = await this.list();
    const a = metas.find((m) => m.slot === 'auto-a');
    const b = metas.find((m) => m.slot === 'auto-b');
    const slot = !a ? 'auto-a' : !b ? 'auto-b' : a.savedAt < b.savedAt ? 'auto-a' : 'auto-b';
    return this.save(slot, w, { autosave: true, thumbnail });
  }
}

export async function exportBlob(w: WorldState): Promise<Blob> {
  stampDevice(w, currentDevice());
  return new Blob([(await packWorld(w)) as BlobPart], { type: 'application/octet-stream' });
}

export async function importBytes(bytes: Uint8Array): Promise<WorldState> {
  return unpackWorld(bytes);
}

/** Duplicate a world as an alternate timeline (same seed & state, new identity). */
export function branchMeta(w: WorldState, newName: string): void {
  w.meta.branchOf = { name: w.meta.name, year: w.meta.startYear + Math.floor(w.tick / 120), tick: w.tick };
  w.meta.name = newName;
}

/** Saves grouped for the load screen: worlds started on this device first, then by the device they came from. */
export function groupByDevice(slots: SlotMeta[], here: string): { title: string; here: boolean; slots: SlotMeta[] }[] {
  const groups = new Map<string, { title: string; here: boolean; slots: SlotMeta[] }>();
  for (const s of slots) {
    const origin = s.originId ?? here; // saves from before device labels were made in this browser
    const key = origin === here ? 'here' : origin;
    const g = groups.get(key) ?? { title: origin === here ? 'Started on this device' : `Started on ${s.originName ?? 'another device'}`, here: origin === here, slots: [] };
    g.slots.push(s);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => Number(b.here) - Number(a.here) || a.title.localeCompare(b.title));
}
