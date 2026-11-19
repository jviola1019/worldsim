/**
 * Round 9: saves are accounted to the device that made them.
 */
import { describe, it, expect } from 'vitest';
import { deviceNameFromUA, currentDevice, setDeviceName, stampDevice, validDevices, DEVICE_HISTORY } from '../../src/persistence/device';
import { groupByDevice, type SlotMeta } from '../../src/persistence/saves';
import { toggleFavorite, isFavorite, validFavorites, favoritePosition } from '../../src/sim/favorites';
import { encodeWorld, decodeWorld } from '../../src/persistence/serialize';
import { makeSim } from '../helpers';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('device identity', () => {
  it('names devices from the user agent', () => {
    expect(deviceNameFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(deviceNameFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Windows PC · Edge');
    expect(deviceNameFromUA('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Android phone · Chrome');
    expect(deviceNameFromUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Mac · Firefox');
  });

  it('keeps one private id per browser, and a name the player can change', () => {
    const s = mem();
    const a = currentDevice(s, 'iPad');
    const b = currentDevice(s, 'iPad');
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f-]{8,40}$/i);
    expect(setDeviceName('  Kitchen <iPad>  ', s).name).toBe('Kitchen iPad');
    expect(currentDevice(s).name).toBe('Kitchen iPad');
    expect(currentDevice(mem()).id).not.toBe(a.id); // another browser, another id
  });

  it('without storage (private mode) the id stays the same for the whole session (review fix)', () => {
    expect(currentDevice(undefined, 'x').id).toBe(currentDevice(undefined, 'x').id);
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(currentDevice(broken, 'x').id).toBe(currentDevice(broken, 'x').id);
  });
});

describe('saves carry their device history', () => {
  it('a world remembers the devices that saved it, newest first, one entry each, at most 8', () => {
    const sim = makeSim('dev-hist', 32);
    for (let k = 0; k < 12; k++) stampDevice(sim.w, { id: `0000000${k % 10}-aaaa`, name: `Device ${k % 10}` }, 1000 + k);
    const d = sim.w.meta.devices!;
    expect(d.length).toBe(DEVICE_HISTORY);
    expect(d[0].name).toBe('Device 1');
    expect(new Set(d.map((x) => x.id)).size).toBe(d.length);
  });

  it('the world keeps the device it started on, however many devices save it later (review fix)', () => {
    const sim = makeSim('dev-origin', 32);
    stampDevice(sim.w, { id: 'aaaaaaaa-0001', name: 'Phone A' }, 1);
    stampDevice(sim.w, { id: 'bbbbbbbb-0002', name: 'Laptop B' }, 2);
    stampDevice(sim.w, { id: 'aaaaaaaa-0001', name: 'Phone A' }, 3); // back on A: A moves to the front of the history
    for (let k = 0; k < 10; k++) stampDevice(sim.w, { id: `cccccccc-00${10 + k}`, name: `Other ${k}` }, 10 + k); // A drops out
    expect(sim.w.meta.devices!.some((d) => d.id === 'aaaaaaaa-0001')).toBe(false);
    expect(sim.w.meta.origin).toEqual({ id: 'aaaaaaaa-0001', name: 'Phone A', at: 1 });
    sim.syncRng();
    expect(decodeWorld(encodeWorld(sim.w)).meta.origin).toEqual({ id: 'aaaaaaaa-0001', name: 'Phone A', at: 1 });
  });

  it('the device history and favourites survive a save, and malformed ones are refused', () => {
    const sim = makeSim('dev-save', 48, (c) => { c.settings.startEra = 4; });
    stampDevice(sim.w, { id: '12345678-abcd', name: 'iPhone · Safari' }, 5);
    const s = [...sim.w.settlements.values()][0];
    toggleFavorite(sim.w, 'settlement', s.id, s.name);
    sim.syncRng();
    const back = decodeWorld(encodeWorld(sim.w));
    expect(back.meta.devices).toEqual([{ id: '12345678-abcd', name: 'iPhone · Safari', at: 5 }]);
    expect(isFavorite(back, 'settlement', s.id)).toBe(true);
    expect(favoritePosition(back, back.meta.favorites![0])).toEqual({ x: s.x, y: s.y });
    expect(validDevices([{ id: 'x', name: 'a', at: 1 }])).toBe(false);
    expect(validDevices([{ id: '12345678-abcd', name: '<script>', at: 1 }])).toBe(false);
    expect(validFavorites([{ kind: 'god', id: 1, label: 'x' }])).toBe(false);
    expect(validFavorites([{ kind: 'army', id: -1, label: 'x' }])).toBe(false);
  });

  it('the load screen groups saves by the device the world started on, this device first', () => {
    const slot = (o: Partial<SlotMeta>): SlotMeta => ({ slot: 's', name: 'w', year: 1, seed: 'x', savedAt: 1, engineVersion: '1', saveVersion: 1, bytes: 1, ...o });
    const groups = groupByDevice([slot({ slot: 'a', originId: 'other', originName: 'iPhone · Safari' }), slot({ slot: 'b', originId: 'me' }), slot({ slot: 'c' })], 'me');
    expect(groups.map((g) => g.title)).toEqual(['Started on this device', 'Started on iPhone · Safari']);
    expect(groups[0].slots.map((s) => s.slot)).toEqual(['b', 'c']); // saves from before device labels were made here
  });
});
