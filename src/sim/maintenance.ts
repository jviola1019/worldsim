/**
 * Archive maintenance: keeps long-running worlds bounded in memory and save
 * size. Old dead persons who never ruled, founded, invented or led are pruned
 * a century after death; finished diseases, inactive routes and expired
 * treaties are removed after a while. History events are pruned by
 * importance in history/events.ts.
 */
import type { Sim } from './context';

export function pruneArchive(sim: Sim): void {
  const w = sim.w;
  const year = sim.year;
  for (const [id, p] of w.persons) {
    if (p.died === undefined) continue;
    const significant = p.reigns.length > 0 || p.role === 'prophet' || p.role === 'founder' || (p.role === 'scholar' && p.events.length > 0) || p.role === 'religious_leader';
    if (!significant && year - p.died > 60) w.persons.delete(id);
    else if (significant && year - p.died > 1500 && p.reigns.length === 0) w.persons.delete(id);
  }
  for (const [id, d] of w.diseases) if (d.totalDeaths === 0 && year - d.emerged > 30) w.diseases.delete(id);
  for (const [id, r] of w.routes) if (!r.active && year - r.established > 50) w.routes.delete(id);
  for (const [id, t] of w.treaties) {
    if (!t.active && year - t.start > 100) {
      w.treaties.delete(id);
      const key = t.a < t.b ? `${t.a}-${t.b}` : `${t.b}-${t.a}`;
      const rel = w.relations.get(key);
      if (rel) rel.treaties = rel.treaties.filter((x) => x !== id);
    }
  }
  for (const [id, wr] of w.wars) if (wr.end !== undefined && year - wr.end > 400) w.wars.delete(id);
  for (const [key, rel] of w.relations) {
    const a = w.civs.get(rel.a);
    const b = w.civs.get(rel.b);
    if ((!a || !a.alive) && (!b || !b.alive)) w.relations.delete(key);
  }
}
