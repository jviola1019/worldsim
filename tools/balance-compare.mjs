// Compare two sets of 1,000-year modernization runs (scripts/modernization.ts output).
//   node tools/balance-compare.mjs <baselineDir> <baselinePrefix> <newDir> <newPrefix>
// e.g. node tools/balance-compare.mjs docs/data/round7 final- /tmp/r8 v1-
// For each world: milestones reached in both runs and the worst shift (%), mean unemployment over years 700–1,000,
// food short and warming at year 1,000. Then the means across worlds.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const [bDir, bPre, nDir, nPre, jsonOut] = process.argv.slice(2); // optional 5th argument: write the per-world figures as JSON
const WORLDS = ['modern-1', 'modern-2', 'modern-3', 'realistic-1'];

function parse(file) {
  const t = readFileSync(file, 'utf8');
  const lines = t.split('\n');
  const ms = {};
  const msLine = lines.find((l) => l.includes('→')) ?? '';
  for (const part of msLine.split('→')) {
    const m = part.trim().match(/^(.+?)\s+(\d+)$/);
    if (m) ms[m[1]] = Number(m[2]);
  }
  const at = (y) => lines.find((l) => new RegExp(`year\\s+${y} ·`).test(l)) ?? '';
  const num = (l, re) => Number((l.match(re) ?? [])[1] ?? NaN);
  const unemp = [700, 800, 900, 1000].map((y) => num(at(y), /unemployed (\d+)%/)).filter(Number.isFinite);
  return {
    ms,
    unemp: unemp.reduce((a, b) => a + b, 0) / Math.max(1, unemp.length),
    food: num(at(1000), /food short (\d+)%/),
    warm: num(t, /climate anomaly ([\d.]+)/),
  };
}

const rows = [];
for (const w of WORLDS) {
  const bf = `${bDir}/${bPre}${w}.txt`, nf = `${nDir}/${nPre}${w}.txt`;
  if (!existsSync(bf) || !existsSync(nf)) continue;
  const b = parse(bf), n = parse(nf);
  const common = Object.keys(b.ms).filter((k) => k in n.ms && b.ms[k] > 1);
  let worst = ['', 0];
  for (const k of common) {
    const d = ((n.ms[k] - b.ms[k]) / b.ms[k]) * 100;
    if (Math.abs(d) > Math.abs(worst[1])) worst = [k, d];
  }
  rows.push({ w, common: common.length, worst, gained: Object.keys(n.ms).filter((k) => !(k in b.ms)), lost: Object.keys(b.ms).filter((k) => !(k in n.ms)), b, n });
}
console.log('| World | Milestones in both | Worst shift | Unemployment 700–1,000 | Food short (y1000) | Warming (y1000) |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  const extra = [r.gained.length ? `+${r.gained.join(', ')}` : '', r.lost.length ? `−${r.lost.join(', ')}` : ''].filter(Boolean).join('; ');
  console.log(`| ${r.w} | ${r.common}${extra ? ` (${extra})` : ''} | ${r.worst[0]} ${r.worst[1] >= 0 ? '+' : ''}${r.worst[1].toFixed(1)}% | ${r.b.unemp.toFixed(0)}% → ${r.n.unemp.toFixed(0)}% | ${r.b.food}% → ${r.n.food}% | ${r.b.warm.toFixed(2)} → ${r.n.warm.toFixed(2)} °C |`);
}
const mean = (k, side) => rows.reduce((a, r) => a + r[side][k], 0) / Math.max(1, rows.length);
console.log(`\nMeans over ${rows.length} worlds: unemployment ${mean('unemp', 'b').toFixed(1)}% → ${mean('unemp', 'n').toFixed(1)}%, warming ${mean('warm', 'b').toFixed(2)} → ${mean('warm', 'n').toFixed(2)} °C`);
if (jsonOut) {
  const worlds = rows.map((r) => ({ world: r.w, r7: { unemp: Math.round(r.b.unemp * 10) / 10, warm: r.b.warm }, r8: { unemp: Math.round(r.n.unemp * 10) / 10, warm: r.n.warm }, worstShift: r.worst }));
  writeFileSync(jsonOut, JSON.stringify({ note: `Measured with scripts/modernization.ts (4 natural histories, 1,000 years each, 128², no god powers); compared by tools/balance-compare.mjs. Milestone years shift by at most ${Math.max(...rows.map((r) => Math.abs(r.worst[1]))).toFixed(1)}%.`, worlds }, null, 1));
}
