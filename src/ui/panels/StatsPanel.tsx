import { useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import { Icon, Kv, fmt } from '../shared';
import { LineChart, type Series } from '../charts/LineChart';
import { CIV_SERIES } from '../../history/stats';

const GLOBAL: { key: string; label: string; unit?: string; fmt?: (v: number) => string }[] = [
  { key: 'population', label: 'World population' },
  { key: 'gdp', label: 'World output (GDP)' },
  { key: 'civs', label: 'Nations' },
  { key: 'wars', label: 'Active wars' },
  { key: 'techScore', label: 'Most advanced technology score' },
  { key: 'temperature', label: 'Global temperature change', unit: '°C', fmt: (v) => v.toFixed(2) },
  { key: 'co2', label: 'Atmospheric CO₂ (ppm-eq.)' },
  { key: 'religions', label: 'Living religions' },
  { key: 'species', label: 'Surviving animal species' },
];

const CIV_LABELS: Record<string, string> = {
  population: 'Population', gdp: 'GDP', gdpPerCapita: 'GDP per person', techScore: 'Technology score', territory: 'Territory', military: 'Military power',
  stability: 'Stability', legitimacy: 'Legitimacy', settlements: 'Settlements', livingStandard: 'Living standard', unemployment: 'Unemployment', inflation: 'Inflation', debt: 'Debt',
};

export function StatsPanel({ sim, close }: { sim: Simulation; close: () => void }) {
  const [view, setView] = useState<'world' | 'compare'>('world');
  const [variable, setVariable] = useState('population');
  const alive = [...sim.w.civs.values()].filter((c) => c.alive).sort((a, b) => b.population - a.population);
  const [picked, setPicked] = useState<number[]>(alive.slice(0, 3).map((c) => c.id));
  const g = sim.w.stats.global;
  const majorEvents = sim.w.events.filter((e) => e.importance >= 4).map((e) => ({ year: e.year, label: e.title }));
  const latest = (k: string) => g.data[k]?.[g.data[k].length - 1] ?? 0;
  const series: Series[] = picked
    .map((id) => sim.w.civs.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ label: c.name, color: c.color, years: sim.w.stats.civs[c.id]?.years ?? [], values: sim.w.stats.civs[c.id]?.data[variable] ?? [] }));
  return (
    <aside class="sheet" aria-label="Statistics">
      <div class="sheet-head">
        <Icon id="ico.stats" size={28} />
        <h2>Statistics</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'world'} onClick={() => setView('world')}>World</button>
        <button role="tab" aria-selected={view === 'compare'} onClick={() => setView('compare')}>Compare nations</button>
      </div>
      <div class="sheet-body">
        {view === 'world' && (
          <>
            <Kv rows={[
              ['People', fmt(latest('population'))], ['Nations', String(latest('civs'))], ['Settlements', String(sim.w.settlements.size)], ['Extinct nations', String(latest('extinctCivs'))],
              ['Active wars', String(latest('wars'))], ['Warming', `${sim.w.climate.anomaly.toFixed(2)} °C`], ['Sea level rise', `${sim.w.climate.seaLevel.toFixed(2)} m`], ['Energy used / yr', fmt(latest('energy'))],
            ]} />
            <p class="muted">Gold lines mark world-shaking events. Touch a chart to read values.</p>
            {GLOBAL.map((s) => (
              <div class="section" key={s.key}>
                <h3>{s.label}</h3>
                <LineChart series={[{ label: s.label, color: '#5fd0c4', years: g.years, values: g.data[s.key] ?? [] }]} markers={majorEvents} unit={s.unit} format={s.fmt} />
              </div>
            ))}
          </>
        )}
        {view === 'compare' && (
          <>
            <div class="field">
              <label for="var">Measure</label>
              <select id="var" value={variable} onChange={(e) => setVariable((e.target as HTMLSelectElement).value)}>
                {CIV_SERIES.filter((k) => CIV_LABELS[k]).map((k) => <option key={k} value={k}>{CIV_LABELS[k]}</option>)}
              </select>
            </div>
            <div class="filters" role="group" aria-label="Nations to compare (up to 6)">
              {alive.slice(0, 16).map((c) => (
                <button key={c.id} aria-pressed={picked.includes(c.id)} onClick={() => setPicked(picked.includes(c.id) ? picked.filter((x) => x !== c.id) : [...picked, c.id].slice(-6))}>
                  <i class="swatch" style={{ background: c.color }} /> {c.name}
                </button>
              ))}
            </div>
            <LineChart series={series} markers={majorEvents} height={220} format={variable === 'stability' || variable === 'legitimacy' || variable === 'unemployment' || variable === 'inflation' ? (v) => `${Math.round(v * 100)}%` : undefined} />
            <table class="muted" style={{ width: '100%', fontSize: '13px' }}>
              <caption style={{ textAlign: 'left' }}>Latest values</caption>
              <tbody>
                {series.map((s) => (
                  <tr key={s.label}>
                    <td><i class="swatch" style={{ background: s.color }} /> {s.label}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(s.values[s.values.length - 1] ?? 0, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </aside>
  );
}
