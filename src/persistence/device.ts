/**
 * Round 9: which device a save was made on. Each browser gets a private random device id, made once and kept
 * in localStorage; it never leaves the device except inside a world file the player exports. The name is read
 * from the user agent ("iPhone · Safari") and can be edited in Settings. Saves record both, and a world keeps
 * a short history of the devices that saved it (meta.devices), so an imported world shows where it came from.
 */
import type { DeviceStamp, WorldState } from '../sim/types';

const KEY = 'epoch-device';
export const DEVICE_HISTORY = 8;
export const DEVICE_NAME_MAX = 40;

export interface DeviceInfo { id: string; name: string }

/** A readable device name from a user-agent string. */
export function deviceNameFromUA(ua: string): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux PC' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) || /FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${browser}`;
}

const ID_RE = /^[0-9a-f-]{8,40}$/i;
const clean = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, DEVICE_NAME_MAX);

let sessionId: string | undefined;

function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else { const t = Date.now(); for (let k = 0; k < 16; k++) b[k] = (t / 256 ** (k % 6) + k * 37) & 255; } // no Web Crypto: a time-based id (only a label, never a secret)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** This device's id and name (created on first use). Storage may be unavailable: then an id for this session only. */
export function currentDevice(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safeStorage(), ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): DeviceInfo {
  let stored: Partial<DeviceInfo> = {};
  try { stored = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {}; } catch { stored = {}; }
  const known = typeof stored.id === 'string' && ID_RE.test(stored.id);
  let id = known ? (stored.id as string) : newId();
  const name = typeof stored.name === 'string' && clean(stored.name) ? clean(stored.name) : deviceNameFromUA(ua);
  let kept = false;
  try { if (storage) { storage.setItem(KEY, JSON.stringify({ id, name })); kept = true; } } catch { /* private mode */ }
  // storage unavailable: one id for the whole session, not a new one per call
  if (!known && !kept) id = sessionId ??= id;
  return { id, name };
}

/** Rename this device (Settings). */
export function setDeviceName(name: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safeStorage()): DeviceInfo {
  const d = currentDevice(storage);
  const next = { id: d.id, name: clean(name) || d.name };
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

function safeStorage(): Storage | undefined {
  try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; }
}

/** Record that this device saved the world now (newest first, at most DEVICE_HISTORY devices, one entry each). */
export function stampDevice(w: WorldState, d: DeviceInfo, at = Date.now()): void {
  // the origin is fixed at the first stamp (older round-9 saves: the oldest device in the history)
  const old = w.meta.devices ?? [];
  if (!w.meta.origin) w.meta.origin = old.length ? { ...old[old.length - 1] } : { id: d.id, name: d.name, at };
  const list = old.filter((x) => x.id !== d.id);
  list.unshift({ id: d.id, name: d.name, at } as DeviceStamp);
  w.meta.devices = list.slice(0, DEVICE_HISTORY);
}

/** Decoder check for meta.devices (imported files are untrusted). */
export function validDevices(v: unknown): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length > DEVICE_HISTORY) return false;
  return v.every((x) => x && typeof x === 'object' && typeof x.id === 'string' && ID_RE.test(x.id) && typeof x.name === 'string' && x.name.length <= DEVICE_NAME_MAX && clean(x.name) === x.name && Number.isFinite(x.at));
}
