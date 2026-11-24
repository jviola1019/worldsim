import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import type { Civ } from '../../sim/types';
import { getAtlas } from '../shared';
import { albumCities, snapshotCity, type CitySnapshot } from '../../history/album';
import { drawAerial, drawPostcard, aerialStyle, photoFontsReady } from '../../rendering/photos';

/** Save a canvas as a PNG file (generated locally; nothing leaves the device). */
function savePng(canvas: HTMLCanvasElement | null, name: string): void {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/[^A-Za-z0-9_-]+/g, '_') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function Postcard({ snap, label }: { snap: CitySnapshot; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // draw now, and again once the era's lettering has loaded (canvas text does not wait for web fonts)
  useEffect(() => { if (ref.current) drawPostcard(ref.current, snap); let live = true; photoFontsReady().then(() => { if (live && ref.current) drawPostcard(ref.current, snap); }); return () => { live = false; }; }, [snap]);
  return (
    <figure class="photo">
      <canvas ref={ref} class="postcard" role="img" aria-label={`Postcard of ${snap.name}, year ${snap.year}`} />
      <figcaption class="row small">
        <span class="muted">{label ?? `${snap.name}, year ${snap.year}`}</span>
        <button class="btn small" onClick={() => savePng(ref.current, `${snap.name}-${snap.year}-postcard`)}>Save PNG</button>
      </figcaption>
    </figure>
  );
}

/** Live aerial photo and street postcard of a nation's cities. */
export function CityPictures({ sim, civ }: { sim: Simulation; civ: Civ }) {
  const cities = useMemo(() => {
    const main = albumCities(sim, civ);
    const rest = civ.settlements.map((id) => sim.w.settlements.get(id)!).filter((s) => s && !main.includes(s)).sort((a, b) => b.pop - a.pop).slice(0, 6);
    return main.concat(rest);
  }, [civ.id, civ.settlements.length]);
  const [sid, setSid] = useState(cities[0]?.id ?? 0);
  const s = sim.w.settlements.get(sid) ?? cities[0];
  const aerial = useRef<HTMLCanvasElement>(null);
  const snap = useMemo(() => (s ? snapshotCity(sim, civ, s) : undefined), [s?.id, sim.year]);
  useEffect(() => {
    if (!s || !aerial.current) return;
    const style = aerialStyle(civ.era, (civ.techs['flight']?.adoption ?? 0) >= 0.3, (civ.techs['satellites']?.adoption ?? 0) >= 0.3);
    drawAerial(aerial.current, sim, getAtlas(), s, style);
    let live = true;
    photoFontsReady().then(() => { if (live && aerial.current) drawAerial(aerial.current, sim, getAtlas(), s, style); });
    return () => { live = false; };
  }, [s?.id, sim.year]);
  if (!s || !snap) return null;
  return (
    <div class="section">
      <h3>Pictures of {civ.baseName}</h3>
      <div class="filters" role="group" aria-label="City">
        {cities.map((c) => <button key={c.id} aria-pressed={c.id === s.id} onClick={() => setSid(c.id)}>{c.name}{c.capital ? ' ★' : ''}</button>)}
      </div>
      <div class="photo-row">
        <figure class="photo">
          <canvas ref={aerial} class="aerial" role="img" aria-label={`Aerial view of ${s.name}`} />
          <figcaption class="row small">
            <span class="muted">From above, now</span>
            <button class="btn small" onClick={() => savePng(aerial.current, `${s.name}-${sim.year}-aerial`)}>Save PNG</button>
          </figcaption>
        </figure>
        <Postcard snap={snap} label="From the street, now" />
      </div>
    </div>
  );
}

/** Postcards recorded every 50 years. */
export function Album({ sim, civ }: { sim: Simulation; civ: Civ }) {
  const snaps = (sim.w.album ?? []).filter((a) => a.civId === civ.id).slice().reverse();
  const [limit, setLimit] = useState(6);
  if (!snaps.length) return <p class="muted">The first postcards are made in the year {Math.ceil((sim.year + 1) / 50) * 50}, and every 50 years after.</p>;
  return (
    <div class="album">
      {snaps.slice(0, limit).map((s) => <Postcard key={`${s.sid}-${s.year}`} snap={s} />)}
      {snaps.length > limit && <button class="btn small" onClick={() => setLimit(limit + 6)}>Older postcards</button>}
    </div>
  );
}
