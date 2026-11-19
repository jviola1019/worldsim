import { useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import type { Civ, HistoryEvent, Person, Settlement, SeriesStore } from '../../sim/types';
import { Icon, Kv, Bar, fmt, pct, Sprite, Flag } from '../shared';
import { PostList } from './FeedPanel';
import { CityPictures, Album } from './CivPhotos';
import { ETHOS } from '../../civilizations/ethos';
import { MISSIONS, missionMetric, assignMission, type MissionKind } from '../../civilizations/missions';
import { BUILDINGS, SECTOR_NAMES } from '../../civilizations/buildings';
import { TERRAIN } from '../../world/terrain';
import { DEPOSITS, GOODS } from '../../world/resources';
import { ERA_NAMES, TECHS, TECH_BY_ID } from '../../technology/techData';
import { GOV_FORMS, type GovFormKey } from '../../politics/govforms';
import { SPECIES_BY_KEY } from '../../ecology/species';
import { eventById } from '../../history/events';
import { getRelation } from '../../civilizations/knowledge';
import { treatiesBetween, atWarWith } from '../../politics/diplomacy';
import { lifeExpectancy, healthIndices, mortalitySchedule, cohortTotal } from '../../population/demography';
import { LineChart } from '../charts/LineChart';
import { explainPopulationChange } from '../../history/stats';
import { effCost } from '../../technology/research';
import { TRAIT_BY_KEY, TRAITS } from '../../population/traits';
import { divineTrait } from '../../population/development';
import { DOCTRINES } from '../../culture/religion';
import { occupations, JOB_GROUPS, GROUP_LABEL, type JobGroup } from '../../economy/occupations';

export type Selection = { kind: 'settlement' | 'civ' | 'person' | 'army' | 'herd' | 'band' | 'tile' | 'religion'; id: number };

interface P {
  sim: Simulation;
  sel: Selection;
  setSel: (s: Selection | null) => void;
  close: () => void;
  focus: (x: number, y: number, zoom?: boolean) => void;
}

function Head({ title, sub, icon, close }: { title: string; sub?: string; icon?: preact.JSX.Element; close: () => void }) {
  return (
    <div class="sheet-head">
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2>{title}</h2>
        {sub && <div class="sub">{sub}</div>}
      </div>
      <button class="icon-btn" aria-label="Close" onClick={close}>
        <Icon id="ico.close" size={24} />
      </button>
    </div>
  );
}

export function EventList({ sim, ids, focus, limit = 12 }: { sim: Simulation; ids: number[]; focus: P['focus']; limit?: number }) {
  const evs = ids.slice(-limit).reverse().map((id) => eventById(sim, id)).filter((e): e is HistoryEvent => !!e);
  if (!evs.length) return <p class="muted">Nothing recorded yet.</p>;
  return (
    <ul class="list">
      {evs.map((e) => (
        <li key={e.id}>
          <button onClick={() => focus(e.x, e.y)}>
            <span class="when">{e.year}</span>
            {e.title}
          </button>
          {e.causes && <Causes causes={e.causes} />}
        </li>
      ))}
    </ul>
  );
}

export function Causes({ causes }: { causes: { label: string; weight: number }[] }) {
  return (
    <ul class="causes" aria-label="Measured contributing conditions">
      {causes.map((c) => (
        <li key={c.label}>
          <span>{c.label}</span>
          <span class="w" style={{ width: `${Math.max(4, c.weight * 44)}px` }} title={pct(c.weight)} />
        </li>
      ))}
    </ul>
  );
}

const civLink = (sim: Simulation, id: number, setSel: P['setSel']) => {
  const c = sim.w.civs.get(id);
  if (!c) return <span>—</span>;
  return (
    <button class="chip" onClick={() => setSel({ kind: 'civ', id })}>
      <i class="swatch" style={{ background: c.color }} />
      {c.name}
    </button>
  );
};

export function Inspector(p: P) {
  const { sim, sel, close } = p;
  const w = sim.w;
  let body: preact.JSX.Element | null = null;
  switch (sel.kind) {
    case 'settlement': {
      const s = w.settlements.get(sel.id);
      body = s ? <SettlementView {...p} s={s} /> : null;
      break;
    }
    case 'civ': {
      const c = w.civs.get(sel.id);
      body = c ? <CivView {...p} civ={c} /> : null;
      break;
    }
    case 'person': {
      const pp = w.persons.get(sel.id);
      body = pp ? <PersonView {...p} person={pp} /> : null;
      break;
    }
    case 'religion':
      body = <ReligionView {...p} />;
      break;
    case 'army': {
      const a = w.armies.get(sel.id);
      const civ = a ? w.civs.get(a.civId) : undefined;
      body = a ? (
        <>
          <Head title={`Army of ${civ?.name ?? '?'}`} sub={a.state} icon={<Sprite id={`unit.soldier.${Math.min(12, a.tier)}`} color={civ?.color} />} close={close} />
          <div class="sheet-body">
            <Kv rows={[['Soldiers', fmt(a.manpower)], ['Weapons era', String(a.tier)], ['Equipment', pct(a.equipment)], ['Training', pct(a.training)], ['Morale', pct(a.morale)], ['Supply', pct(a.supply)], ['General', w.persons.get(a.generalId)?.name ?? 'none'], ['War', a.warId ? w.wars.get(a.warId)?.name ?? '—' : 'none']]} />
          </div>
        </>
      ) : null;
      break;
    }
    case 'herd': {
      const h = w.herds.get(sel.id);
      const sp = h ? SPECIES_BY_KEY[h.species] : undefined;
      const ss = h?.subspeciesId ? w.subspecies.get(h.subspeciesId) : undefined;
      body = h && sp ? (
        <>
          <Head title={ss?.name ?? sp.name} sub={h.owner ? `Domesticated by ${w.civs.get(h.owner)?.name}` : 'Wild'} icon={<Sprite id={sp.sprite} />} close={close} />
          <div class="sheet-body">
            <Kv rows={[['Animals', fmt(h.count)], ['Diet', sp.diet], ['Size gene', pct(h.genes[0])], ['Cold tolerance', pct(h.genes[2])], ['Worldwide', fmt(w.speciesStatus[h.species]?.count ?? 0)]]} />
            <p class="muted">Genes drift and adapt to climate over generations; long divergence produces new subspecies.</p>
          </div>
        </>
      ) : null;
      break;
    }
    case 'band': {
      const b = w.bands.get(sel.id);
      body = b ? (
        <>
          <Head title={`${w.civs.get(b.civId)?.adjective ?? ''} band`} sub="Nomadic foragers" icon={<Sprite id="unit.citizen.0" color={w.civs.get(b.civId)?.color} />} close={close} />
          <div class="sheet-body">
            <Kv rows={[['People', String(b.members.length)], ['Food stored', fmt(b.food)], ['Since', String(b.founded)]]} />
            <div class="section">
              <h3>Members</h3>
              <ul class="list">
                {b.members.slice(0, 30).map((id) => {
                  const m = w.persons.get(id);
                  return m ? <li key={id}><button onClick={() => p.setSel({ kind: 'person', id })}>{m.name} · {sim.year - m.born} yrs · {m.job || 'forager'}</button></li> : null;
                })}
              </ul>
            </div>
            {civLink(sim, b.civId, p.setSel)}
          </div>
        </>
      ) : null;
      break;
    }
    case 'tile':
      body = <TileView {...p} />;
      break;
  }
  if (!body)
    body = (
      <>
        <Head title="Gone" close={close} />
        <div class="sheet-body">
          <p class="muted">This no longer exists. Its story is kept in the history book.</p>
        </div>
      </>
    );
  return (
    <aside class="sheet" aria-label="Inspector">
      {body}
    </aside>
  );
}

function TileView({ sim, sel, close, setSel }: P) {
  const m = sim.w.map;
  const i = sel.id;
  const t = TERRAIN[m.terrain[i]];
  const owner = m.owner[i];
  return (
    <>
      <Head title={t.name} sub={`Tile ${m.xOf(i)}, ${m.yOf(i)}`} close={close} />
      <div class="sheet-body">
        <Kv rows={[
          ['Elevation', m.elev[i] > 0 ? `${Math.round(m.elev[i] * 5000)} m` : `${Math.round(-m.elev[i] * 5000)} m deep`],
          ['Temperature', `${m.temp[i]} °C (base)`],
          ['Rainfall', pct(m.moist[i] / 255)],
          ['Soil fertility', pct(m.fert[i] / 255)],
          ['Vegetation', pct(m.veg[i] / 255)],
          ['River', m.river[i] ? 'yes' : 'no'],
          ['Deposit', m.dep[i] ? `${DEPOSITS[m.dep[i]].name} (${fmt(m.depAmt[i])})` : 'none'],
          ['Pollution', pct(m.pollution[i] / 255)],
          ['Road / rail', `${m.roadTier(i)} / ${m.railTier(i)}`],
        ]} />
        {owner ? civLink(sim, owner, setSel) : <p class="muted">Unclaimed land.</p>}
      </div>
    </>
  );
}

function SettlementView({ sim, s, setSel, close, focus }: P & { s: Settlement }) {
  const w = sim.w;
  const civ = w.civs.get(s.civId);
  const counts = s.bld.map((n, id) => [id, n] as const).filter(([id, n]) => n > 0 && id).sort((a, b) => b[1] - a[1]);
  const q = mortalitySchedule(healthIndices(civ, s.prosperity), s.species);
  const emp = s.employment;
  const empTotal = emp.reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <Head title={s.name} sub={`${s.capital ? 'Capital · ' : ''}${civ?.name ?? ''} · founded ${s.founded}`} icon={civ ? <Flag civ={civ} size={24} /> : <Icon id={s.capital ? 'ico.crown' : 'ico.found_city'} size={32} />} close={close} />
      <div class="sheet-body">
        <Kv rows={[
          ['People', fmt(s.pop)],
          ['Housing', `${fmt(s.housing)} places`],
          ['Food stored', `${fmt(s.food)} person-years`],
          ['Living standard', s.prosperity.toFixed(2)],
          ['Life expectancy', `${Math.round(lifeExpectancy(q))} years`],
          ['Schooling', pct(s.education)],
          ['Unrest', pct(s.unrest)],
          ['Market access', pct(s.access)],
          ['Simulation detail', s.mode === 'individual' ? 'Individuals' : 'Age cohorts'],
        ]} />
        {civ && civLink(sim, civ.id, setSel)}
        {s.construction && (
          <div class="section">
            <h3>Building now</h3>
            <p>{BUILDINGS[s.construction.type].name} — {pct(s.construction.progress)}</p>
            <Bar value={s.construction.progress} />
          </div>
        )}
        <div class="section">
          <h3>Work</h3>
          {emp.map((n, k) => (n > 0.5 ? <div key={k} class="row"><span style={{ width: '110px' }}>{SECTOR_NAMES[k]}</span><div style={{ flex: 1 }}><Bar value={n / empTotal} color={k === 6 ? '#e2654e' : undefined} /></div><span class="muted">{fmt(n)}</span></div> : null))}
        </div>
        <JobsList s={s} civ={civ} />
        <div class="section">
          <h3>Districts</h3>
          <div class="row">{counts.map(([id, n]) => <span key={id} class="chip">{BUILDINGS[id].name} ×{n}</span>)}</div>
        </div>
        <div class="section">
          <h3>Beliefs & peoples</h3>
          <div class="row">
            {s.religions.map((r) => (
              <button key={r.id} class="chip" onClick={() => r.id && setSel({ kind: 'religion', id: r.id })}>
                {r.id ? w.religions.get(r.id)?.name : 'Non-religious'} {pct(r.f)}
              </button>
            ))}
            {s.cultures.map((c) => <span key={c.id} class="chip">{w.cultures.get(c.id)?.name} {pct(c.f)}</span>)}
          </div>
        </div>
        {s.epidemics.length > 0 && (
          <div class="section">
            <h3>Epidemics</h3>
            {s.epidemics.map((e) => <p key={e.diseaseId}>{w.diseases.get(e.diseaseId)?.name}: {pct(e.i)} sick, {fmt(e.deaths)} dead</p>)}
          </div>
        )}
        {s.mode === 'individual' && (
          <div class="section">
            <h3>Residents</h3>
            <ul class="list">
              {s.members.slice(0, 20).map((id) => {
                const m = w.persons.get(id);
                return m ? <li key={id}><button onClick={() => setSel({ kind: 'person', id })}>{m.name} · {sim.year - m.born} yrs · {m.job}</button></li> : null;
              })}
            </ul>
          </div>
        )}
        <div class="section">
          <h3>Chronicle</h3>
          <EventList sim={sim} ids={s.events} focus={focus} />
        </div>
      </div>
    </>
  );
}

const SKILL_NAMES = { admin: 'Administration', military: 'Military', diplomacy: 'Diplomacy', learning: 'Learning' };

function traitTip(key: string): string {
  const d = TRAIT_BY_KEY[key];
  if (!d) return key;
  const parts: string[] = [];
  if (d.desc) parts.push(d.desc);
  for (const [k, v] of Object.entries(d.skills ?? {})) parts.push(`${(v as number) > 0 ? '+' : ''}${v} ${k}`);
  for (const [k, v] of Object.entries(d.lead ?? {})) parts.push(`as leader: ${(v as number) > 0 ? '+' : ''}${Math.round((v as number) * 100)}% ${k}`);
  if (d.health) parts.push(`${d.health > 0 ? '+' : ''}${Math.round(d.health * 100)}% health`);
  return parts.join(' · ');
}

function TraitEditor({ sim, person }: { sim: Simulation; person: Person }) {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  if (!open) return <button class="chip" onClick={() => setOpen(true)}>Divine touch: edit traits</button>;
  return (
    <div class="trait-editor">
      <div class="muted small">Tap to grant or remove. Opposites replace each other. Recorded as an intervention.</div>
      <div class="row">
        {TRAITS.map((t) => {
          const has = person.traits.includes(t.key);
          return (
            <button key={t.key} class={`chip trait ${t.kind === 'acquired' ? 'acquired' : ''}`} aria-pressed={has} title={traitTip(t.key)} onClick={() => { divineTrait(sim, person, t.key, !has); bump((n) => n + 1); }}>
              {has ? '✓ ' : ''}{t.name}
            </button>
          );
        })}
      </div>
      <button class="chip" onClick={() => setOpen(false)}>Done</button>
    </div>
  );
}

function PersonView({ sim, person, setSel, close, focus }: P & { person: Person }) {
  const w = sim.w;
  const age = (person.died ?? sim.year) - person.born;
  const father = w.persons.get(person.fatherId);
  const mother = w.persons.get(person.motherId);
  const spouse = w.persons.get(person.spouseId);
  const kids = person.children.map((id) => w.persons.get(id)).filter((x): x is Person => !!x);
  const dyn = person.dynastyId ? w.dynasties.get(person.dynastyId) : undefined;
  const link = (q: Person | undefined) => (q ? <button class="chip" onClick={() => setSel({ kind: 'person', id: q.id })}>{q.name}</button> : <span class="muted">unknown</span>);
  return (
    <>
      <Head title={`${person.titles.length ? person.titles[person.titles.length - 1] + ' ' : ''}${person.name}${person.family ? ' ' + person.family : ''}`} sub={`${person.role.replace('_', ' ')} · ${person.died !== undefined ? `${person.born}–${person.died}` : `born ${person.born}, age ${age}`}`} close={close} />
      <div class="sheet-body">
        <Kv rows={[
          ['Species', person.species],
          ['Culture', w.cultures.get(person.cultureId)?.name ?? '—'],
          ['Faith', person.religionId ? w.religions.get(person.religionId)?.name ?? '—' : 'none'],
          ...(person.battles ? [['Battles', `${person.battles} fought, ${person.victories ?? 0} won`] as [string, string]] : []),
          ...(person.died !== undefined ? [['Died of', person.deathCause ?? '—'] as [string, string]] : []),
          ...(dyn ? [['Dynasty', `House ${dyn.name}`] as [string, string]] : []),
        ]} />
        <div class="section">
          <h3>Skills</h3>
          {(['admin', 'military', 'diplomacy', 'learning'] as const).map((k) => (
            <div key={k} class="skill-row">
              <span>{SKILL_NAMES[k]}</span>
              <Bar value={person.skills[k] / 10} />
              <span class="num">{person.skills[k].toFixed(1)}</span>
            </div>
          ))}
          {person.stress !== undefined && person.died === undefined && (
            <div class="skill-row">
              <span>Stress</span>
              <Bar value={person.stress} color="#e2654e" />
              <span class="num">{Math.round(person.stress * 100)}%</span>
            </div>
          )}
        </div>
        <div class="section">
          <h3>Traits</h3>
          <div class="row">
            {person.traits.map((t) => {
              const d = TRAIT_BY_KEY[t];
              return (
                <span key={t} class={`chip trait ${d?.kind === 'acquired' ? 'acquired' : ''}`} title={traitTip(t)}>
                  {d?.name ?? t}
                </span>
              );
            })}
          </div>
          <div class="muted small">Outlined traits were earned through life events; others were inborn or inherited.</div>
          {person.died === undefined && !sim.w.meta.settings.observer && <TraitEditor sim={sim} person={person} />}
        </div>
        {person.deeds && person.deeds.length > 0 && (
          <div class="section">
            <h3>Life</h3>
            <ul class="list timeline">{person.deeds.map((d, k) => <li key={k}><span class="yr">{d.y}</span> {d.t}</li>)}</ul>
          </div>
        )}
        {person.reigns.length > 0 && (
          <div class="section">
            <h3>Reigns</h3>
            <ul class="list">{person.reigns.map((r, k) => <li key={k}>{r.title}: {r.start}–{r.end ?? 'present'}</li>)}</ul>
          </div>
        )}
        <div class="section">
          <h3>Family</h3>
          <div class="row">Father {link(father)} Mother {link(mother)} Spouse {link(spouse)}</div>
          {kids.length > 0 && <div class="row">Children {kids.map((k) => link(k))}</div>}
        </div>
        <div class="section">
          <h3>Biography (from recorded events)</h3>
          <EventList sim={sim} ids={person.events} focus={focus} limit={20} />
        </div>
      </div>
    </>
  );
}

function ReligionView({ sim, sel, close }: P) {
  const r = sim.w.religions.get(sel.id);
  if (!r) return null;
  return (
    <>
      <Head title={r.name} sub={`Founded ${r.founded}${r.extinct ? ` · faded ${r.extinct}` : ''}`} close={close} />
      <div class="sheet-body">
        <p>{r.myth}</p>
        <Kv rows={[['Followers', fmt(r.adherents)], ['Kind', r.kind], ['Deity', r.deity], ['Cohesion', pct(r.cohesion)], ['Founder', sim.w.persons.get(r.founderId)?.name ?? 'unknown'], ['Branch of', r.parentId ? sim.w.religions.get(r.parentId)?.name ?? '—' : '—']]} />
        <div class="section">
          <h3>Doctrines</h3>
          <ul class="list">{r.doctrines.map((d) => <li key={d}><strong>{DOCTRINES[d]?.name ?? d}</strong> — {DOCTRINES[d]?.desc}</li>)}</ul>
        </div>
      </div>
    </>
  );
}

const TABS = ['Overview', 'Feed', 'Album', 'History', 'Technology', 'Military', 'Economy', 'Culture', 'Diplomacy', 'Statistics'] as const;

function CivView({ sim, civ, setSel, close, focus }: P & { civ: Civ }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const w = sim.w;
  const ruler = w.persons.get(civ.rulerId);
  const heir = civ.heirId ? w.persons.get(civ.heirId) : undefined;
  const gov = GOV_FORMS[civ.govForm as GovFormKey];
  const cap = w.settlements.get(civ.capital);
  return (
    <>
      <Head title={civ.name} sub={civ.alive ? `${gov?.label ?? civ.govForm} · ${ERA_NAMES[civ.era]} era` : `Fell in ${civ.fell}: ${civ.fellCause}`} icon={<Flag civ={civ} size={26} />} close={close} />
      <div class="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div class="sheet-body">
        {tab === 'Overview' && (
          <>
            <div class="stat-tiles" role="group" aria-label="Key figures (tap for details)">
              <button class="stat-tile" onClick={() => setTab('Statistics')}><span class="v">{fmt(civ.population)}</span><span class="k">people</span></button>
              <button class="stat-tile" onClick={() => setTab('History')}><span class="v">{(civ.alive ? sim.year : civ.fell ?? sim.year) - civ.founded}</span><span class="k">years {civ.alive ? 'alive' : 'lasted'}</span></button>
              <button class="stat-tile" onClick={() => setTab('Technology')}><span class="v">{ERA_NAMES[civ.era]}</span><span class="k">era</span></button>
              <button class="stat-tile" onClick={() => setTab('Economy')}><span class="v">{civ.econ.gdpPerCapita.toFixed(2)}</span><span class="k">output per person</span></button>
              <button class="stat-tile" onClick={() => setTab('Military')}><span class="v">{fmt(civ.militaryPower)}</span><span class="k">military power</span></button>
              <button class="stat-tile" onClick={() => setTab('Diplomacy')}><span class="v">{civ.knownCivs.length}</span><span class="k">known nations</span></button>
            </div>
            <CityPictures sim={sim} civ={civ} />
            <Kv rows={[
              ['People', fmt(civ.population)],
              ['Settlements', String(civ.settlements.length)],
              ['Capital', cap?.name ?? '—'],
              ['Territory', `${fmt(civ.territory)} tiles`],
              ['Founded', String(civ.founded)],
              ['Output (GDP)', fmt(civ.econ.gdp)],
              ['Living standard', civ.econ.livingStandard.toFixed(2)],
              ['Research per year', fmt(civ.researchRate)],
            ]} />
            {civ.ethos && (
              <div class="section">
                <h3>Values: {ETHOS[civ.ethos.key].name}</h3>
                <p class="muted">{ETHOS[civ.ethos.key].blurb} <span>(since {civ.ethos.since})</span></p>
              </div>
            )}
            <MissionBox sim={sim} civ={civ} />
            <SportsBox sim={sim} civ={civ} />
            <div class="section">
              <h3>Leadership</h3>
              {ruler ? (
                <button class="person-card" onClick={() => setSel({ kind: 'person', id: ruler.id })}>
                  <strong>{ruler.titles[ruler.titles.length - 1] ?? 'Leader'} {ruler.name}{ruler.family ? ' ' + ruler.family : ''}</strong>
                  <span class="muted">age {sim.year - ruler.born} · {ruler.traits.map((t) => TRAIT_BY_KEY[t]?.name ?? t).join(', ') || 'no notable traits'}</span>
                </button>
              ) : <span class="muted">No recognised leader</span>}
              {heir && <button class="chip" onClick={() => setSel({ kind: 'person', id: heir.id })}>Heir: {heir.name}</button>}
            </div>
            <div class="section"><h3>Stability</h3><Bar value={civ.stability} /></div>
            <div class="section"><h3>Legitimacy</h3><Bar value={civ.legitimacy} /></div>
            <div class="section"><h3>Unrest</h3><Bar value={civ.unrest} color="#e2654e" /></div>
            {ruler && <button class="btn small" onClick={() => setSel({ kind: 'person', id: ruler.id })}>Leader's biography</button>}
            {cap && <button class="btn small" onClick={() => focus(cap.x, cap.y)}>Show capital</button>}
            <div class="section">
              <h3>Institutions (the label summarizes these)</h3>
              <Kv rows={Object.entries(civ.inst).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').toLowerCase(), pct(v)] as [string, string])} />
            </div>
          </>
        )}
        {tab === 'Feed' && <PostList sim={sim} civId={civ.id} focus={focus} />}
        {tab === 'Album' && <Album sim={sim} civ={civ} />}
        {tab === 'History' && <EventList sim={sim} ids={civ.events} focus={focus} limit={40} />}
        {tab === 'Technology' && <TechTab civ={civ} />}
        {tab === 'Military' && (
          <>
            <Kv rows={[['Military power', fmt(civ.militaryPower)], ['Armies', String(civ.armies.length)], ['Mobilized', pct(civ.mobilization)], ['War exhaustion', pct(civ.warExhaustion)], ['Weapons era', String(civ.caps.landTier)], ['Navy', String(civ.caps.navalTier)], ['Air', String(civ.caps.airTier)], ['Strategic weapons', civ.nukes > 0 ? `${civ.nukes} (deterrent)` : 'none']]} />
            <div class="section">
              <h3>Wars</h3>
              <ul class="list">
                {[...w.wars.values()].filter((x) => x.attackers.includes(civ.id) || x.defenders.includes(civ.id)).slice(-10).reverse().map((x) => (
                  <li key={x.id}>
                    <strong>{x.name}</strong> <span class="muted">{x.start}–{x.end ?? 'ongoing'}</span>
                    <div class="muted">{x.outcome ?? `Score ${Math.round(x.score)} · ${x.battles} battles`}</div>
                    <Causes causes={x.causes} />
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {tab === 'Economy' && (
          <>
            <Kv rows={[
              ['GDP', fmt(civ.econ.gdp)], ['Per person', civ.econ.gdpPerCapita.toFixed(2)], ['Growth', pct(civ.econ.growth)], ['Consumption', fmt(civ.econ.consumption)], ['Investment', fmt(civ.econ.investment)],
              ['Government', fmt(civ.econ.government)], ['Exports', fmt(civ.econ.exports)], ['Imports', fmt(civ.econ.imports)], ['Tax rate', pct(civ.taxRate)], ['Treasury', fmt(civ.treasury)],
              ['Debt', fmt(civ.debt)], ['Inflation', pct(civ.inflation)], ['Unemployment', pct(civ.econ.unemployment)], ['Inequality (Gini-like)', civ.econ.inequality.toFixed(2)], ['Emissions', fmt(civ.econ.emissions)],
            ]} />
            <p class="muted">GDP = consumption + investment (incl. inventory change) + government + net exports, measured from recorded flows.</p>
            <div class="section">
              <h3>Stockpiles</h3>
              <div class="row">{GOODS.filter((g) => civ.stock[g.id] >= 1).map((g) => <span key={g.key} class="chip">{g.name} {fmt(civ.stock[g.id])}</span>)}</div>
            </div>
          </>
        )}
        {tab === 'Culture' && (
          <>
            <Kv rows={[['Culture', w.cultures.get(civ.cultureId)?.name ?? '—'], ['Language', w.languages.get(civ.languageId)?.name ?? '—'], ['State faith', civ.stateReligion ? w.religions.get(civ.stateReligion)?.name ?? '—' : 'none'], ['Religious policy', civ.policies.tolerance], ['Migration', civ.policies.migration], ['Trade policy', civ.policies.trade], ['Environment', civ.policies.environment]]} />
            {civ.stateReligion > 0 && <button class="btn small" onClick={() => setSel({ kind: 'religion', id: civ.stateReligion })}>About the state faith</button>}
            <div class="section">
              <h3>Factions</h3>
              <ul class="list">{civ.factions.map((f) => <li key={f.name}>{f.name} · {pct(f.power)} of influence · {f.satisfaction >= 0 ? 'content' : 'discontented'} ({f.satisfaction.toFixed(2)})</li>)}</ul>
            </div>
          </>
        )}
        {tab === 'Diplomacy' && (
          <ul class="list">
            {civ.knownCivs.map((oid) => {
              const o = w.civs.get(oid);
              const rel = getRelation(sim, civ.id, oid);
              if (!o || !rel) return null;
              const tr = treatiesBetween(sim, civ.id, oid).map((t) => t.kind);
              return (
                <li key={oid}>
                  {civLink(sim, oid, setSel)} {atWarWith(sim, civ.id, oid) ? <strong style={{ color: '#e2654e' }}>at war</strong> : <span>opinion {Math.round(rel.opinion)}, trust {pct(rel.trust)}</span>}
                  {tr.length > 0 && <div class="muted">{tr.join(', ')}</div>}
                </li>
              );
            })}
            {!civ.knownCivs.length && <li>No contact with other peoples yet.</li>}
          </ul>
        )}
        {tab === 'Statistics' && <CivStats sim={sim} civ={civ} />}
      </div>
    </>
  );
}

function TechTab({ civ }: { civ: Civ }) {
  const known = TECHS.filter((t) => civ.techs[t.id]?.known);
  const target = TECH_BY_ID.get(civ.researchTarget);
  return (
    <>
      {target && (
        <div class="section">
          <h3>Researching</h3>
          <p>{target.name} — {target.description}</p>
          <Bar value={(civ.techs[target.id]?.progress ?? 0) / effCost(target)} />
        </div>
      )}
      <div class="section">
        <h3>{known.length} technologies known (adoption)</h3>
        <ul class="list">
          {known.slice().reverse().slice(0, 60).map((t) => (
            <li key={t.id}>
              <div class="row" style={{ justifyContent: 'space-between' }}>
                <span>{t.name} <span class="muted">· era {t.era}</span></span>
                <span class="muted">{pct(civ.techs[t.id].adoption)}</span>
              </div>
              <Bar value={civ.techs[t.id].adoption} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** What people here do for a living (named occupations within each sector). */
function JobsList({ s, civ }: { s: Settlement; civ: Civ | undefined }) {
  const jobs = occupations(s, civ);
  const total = jobs.reduce((a, j) => a + j.count, 0);
  if (!total) return null;
  return (
    <div class="section" data-testid="jobs">
      <h3>Jobs</h3>
      {jobs.slice(0, 10).map((j) => (
        <div key={j.key} class="row"><span style={{ width: '170px' }}>{j.label}</span><div style={{ flex: 1 }}><Bar value={j.count / total} color={j.key === 'job_seekers' ? '#e2654e' : undefined} /></div><span class="muted">{fmt(j.count)}</span></div>
      ))}
      {jobs.length > 10 && <p class="muted">{jobs.length - 10} more kinds of work, {fmt(jobs.slice(10).reduce((a, j) => a + j.count, 0))} people.</p>}
    </div>
  );
}

/** Colour per job group for the "Jobs over time" chart (distinct hues, readable on the dark sheet). */
const JOB_COLORS: Record<JobGroup, string> = {
  foraging: '#a3d977', farming: '#e8c034', fishing: '#4fa3dc', agritech: '#9be3c0', extraction: '#b08060', crafts: '#e8762b',
  factory: '#c9463d', hightech: '#3fd6e0', building: '#d7bd78', commerce: '#f8e889', care: '#ef8a72', knowledge: '#a77fcf',
  digital: '#7da7ff', culture: '#f2a7d0', military: '#9d96a3', unemployed: '#e2654e',
};

/** How the nation's work changed: the share of workers in its six largest job groups, year by year. */
function JobsOverTime({ st }: { st: SeriesStore }) {
  const groups = JOB_GROUPS.filter((g) => (st.data['job_' + g] ?? []).some((v) => v > 0.01));
  if (!groups.length) return null;
  const peak = (g: JobGroup) => Math.max(...(st.data['job_' + g] ?? [0]));
  const top = [...groups].sort((a, b) => peak(b) - peak(a)).slice(0, 6);
  return (
    <div class="section" data-testid="jobs-over-time">
      <h3>Jobs over time</h3>
      <LineChart series={top.map((g) => ({ label: GROUP_LABEL[g], color: JOB_COLORS[g], years: st.years, values: st.data['job_' + g] ?? [] }))} format={(v) => `${Math.round(v * 100)}%`} />
      <p class="muted">Share of workers in the largest kinds of work. Names change as the nation's technology changes what people do.</p>
    </div>
  );
}

function CivStats({ sim, civ }: { sim: Simulation; civ: Civ }) {
  const st = sim.w.stats.civs[civ.id];
  if (!st || st.years.length < 2) return <p class="muted">Statistics appear after a few years of history.</p>;
  const mk = (key: string, label: string) => ({ label, color: civ.color, years: st.years, values: st.data[key] ?? [] });
  const markers = civ.events.map((id) => sim.w.events.find((e) => e.id === id)).filter((e): e is HistoryEvent => !!e && e.importance >= 3).map((e) => ({ year: e.year, label: e.title }));
  const y1 = st.years[st.years.length - 1];
  const exp = explainPopulationChange(st, Math.max(st.years[0], y1 - 20), y1);
  return (
    <>
      <div class="section"><h3>Population</h3><LineChart series={[mk('population', 'People')]} markers={markers} /></div>
      {exp && (
        <div class="section">
          <h3>Why population changed ({pct(exp.change)} over the last 20 years)</h3>
          <ul class="list">{exp.contributors.slice(0, 6).map((c) => <li key={c.label}>{c.label}: {c.value >= 0 ? '+' : ''}{fmt(c.value)}</li>)}</ul>
          <p class="muted">From the population ledger: these components add up exactly to the change. They show what happened, not a full causal proof.</p>
        </div>
      )}
      <div class="section"><h3>Output (GDP)</h3><LineChart series={[mk('gdp', 'GDP')]} markers={markers} /></div>
      <div class="section"><h3>Technology score</h3><LineChart series={[mk('techScore', 'Technology')]} markers={markers} /></div>
      <div class="section"><h3>Military power</h3><LineChart series={[mk('military', 'Military')]} /></div>
      <div class="section"><h3>Stability</h3><LineChart series={[mk('stability', 'Stability')]} format={(v) => `${Math.round(v * 100)}%`} /></div>
      <JobsOverTime st={st} />
      <p class="muted">Cohort size note: {fmt(sim.w.settlements.size ? [...sim.w.settlements.values()].filter((s) => s.civId === civ.id).reduce((a, s) => a + (s.mode === 'cohort' ? cohortTotal(s.cohorts) : 0), 0) : 0)} people are modelled as age cohorts; smaller groups as individuals.</p>
    </>
  );
}

/** The nation's current mission with measured progress; god mode may assign a new one. */
function MissionBox({ sim, civ }: { sim: P['sim']; civ: Civ }) {
  const [, force] = useState(0);
  const m = civ.mission;
  const god = !sim.w.meta.settings.observer && civ.alive;
  let progress = 0;
  if (m) {
    const now = missionMetric(sim, civ, m.kind);
    progress = m.kind === 'environment' ? (m.start - now) / Math.max(1e-9, m.start - m.target) : (now - m.start) / Math.max(1e-9, m.target - m.start);
  }
  const done = civ.missionLog ?? [];
  return (
    <div class="section">
      <h3>Mission{m ? `: ${MISSIONS[m.kind].name}` : ''}</h3>
      {m ? (
        <>
          <p class="muted">{MISSIONS[m.kind].goal}. Because: {m.reason}. Deadline: year {m.until}.</p>
          <Bar value={Math.max(0, Math.min(1, progress))} />
        </>
      ) : <p class="muted">No national mission right now.</p>}
      {done.length > 0 && <p class="muted small">Past missions: {done.filter((d) => d.ok).length} achieved, {done.filter((d) => !d.ok).length} failed.</p>}
      {god && (
        <label class="row small">
          <span>Decree a mission</span>
          <select aria-label="Decree a mission" value="" onChange={(e) => { const k = (e.target as HTMLSelectElement).value as MissionKind; if (k) { assignMission(sim, civ, k); force((x) => x + 1); } }}>
            <option value="">Choose…</option>
            {(Object.keys(MISSIONS) as MissionKind[]).map((k) => <option key={k} value={k}>{MISSIONS[k].name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/** Leagues, champions, games and prestige of a nation. */
function SportsBox({ sim, civ }: { sim: P['sim']; civ: Civ }) {
  const leagues = [...sim.w.leagues.values()].filter((l) => l.civId === civ.id && l.active);
  const games = sim.w.sports?.held ?? [];
  const hosted = games.filter((g) => g.hostCiv === civ.id).length;
  const medals = games.reduce((a, g) => a + (g.medals[civ.id] ?? 0), 0);
  if (!leagues.length && !hosted && !medals) return null;
  return (
    <div class="section">
      <h3>Sports and games</h3>
      <ul class="list">
        {leagues.map((l) => <li key={l.id}><strong>{l.name}</strong> <span class="muted">· {l.teams.length} teams{l.champions.length ? ` · champions: ${l.champions[l.champions.length - 1].team}` : ''}</span></li>)}
      </ul>
      <p class="muted small">World games hosted: {hosted} · medals won: {medals} · prestige {Math.round((civ.prestige ?? 0) * 100)}</p>
    </div>
  );
}
