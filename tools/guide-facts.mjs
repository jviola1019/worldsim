// Round 8: facts for the code guide, read from the code itself so the guide cannot drift silently.
//   node tools/guide-facts.mjs  → public/guide/facts.json (used by the interactive guide at /guide/)
//                                 and prints a Markdown summary (folders, files, lines, tests, import edges)
// Each file's description is the first sentence of its leading doc comment.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** The first sentence of the file's leading /** ... *\/ or // comment block. */
function describe(text) {
  const t = text.replace(/^﻿/, '');
  let m = t.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  let body = m ? m[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join(' ') : '';
  if (!body) {
    const lines = [];
    for (const l of t.split('\n')) { if (/^\s*\/\//.test(l)) lines.push(l.replace(/^\s*\/\/\s?/, '')); else if (lines.length || l.trim()) break; }
    body = lines.join(' ');
  }
  body = body.replace(/\s+/g, ' ').trim();
  const s = body.match(/^(.{20,}?[.!?])(\s|$)/);
  return (s ? s[1] : body).slice(0, 260);
}

const srcFiles = walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
const folderOf = (f) => {
  const r = relative(join(root, 'src'), f).split('/');
  return r.length > 1 ? r[0] : '(root)';
};
const files = srcFiles.map((f) => {
  const text = readFileSync(f, 'utf8');
  const imports = [...text.matchAll(/from\s+'(\.[^']+)'/g)].map((m) => resolve(dirname(f), m[1]));
  return { path: relative(root, f), folder: folderOf(f), lines: text.split('\n').length, about: describe(text), importsAbs: imports };
});
const folders = {};
for (const f of files) {
  const g = (folders[f.folder] ??= { name: f.folder, files: 0, lines: 0, deps: {} });
  g.files++;
  g.lines += f.lines;
  for (const abs of f.importsAbs) {
    const r = relative(join(root, 'src'), abs).split('/');
    const to = r.length > 1 ? r[0] : '(root)';
    if (to !== f.folder && !to.startsWith('..')) g.deps[to] = (g.deps[to] ?? 0) + 1;
  }
}
const tests = walk(join(root, 'tests')).filter((f) => /\.test\.ts$/.test(f));
const testCount = tests.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/^\s*it\(/gm) ?? []).length, 0);
const scripts = ['scripts', 'tools', 'benchmarks'].flatMap((d) => walk(join(root, d)).filter((f) => /\.(ts|mjs)$/.test(f) && !f.includes('/output/')))
  .map((f) => ({ path: relative(root, f), lines: readFileSync(f, 'utf8').split('\n').length, about: describe(readFileSync(f, 'utf8')) }));
const workflows = readdirSync(join(root, '.github/workflows')).map((f) => ({ path: '.github/workflows/' + f, about: describe(readFileSync(join(root, '.github/workflows', f), 'utf8').replace(/^#/gm, '//')) }));

const facts = {
  generated: new Date().toISOString().slice(0, 10),
  totals: { srcFiles: files.length, srcLines: files.reduce((a, f) => a + f.lines, 0), testFiles: tests.length, testCases: testCount },
  folders: Object.values(folders).sort((a, b) => b.lines - a.lines),
  files: files.map(({ importsAbs, ...f }) => f).sort((a, b) => a.path.localeCompare(b.path)),
  tests: tests.map((f) => ({ path: relative(root, f), cases: (readFileSync(f, 'utf8').match(/^\s*it\(/gm) ?? []).length, about: describe(readFileSync(f, 'utf8')) })).sort((a, b) => a.path.localeCompare(b.path)),
  scripts,
  workflows,
};
mkdirSync(join(root, 'public/guide'), { recursive: true });
writeFileSync(join(root, 'public/guide/facts.json'), JSON.stringify(facts, null, 1));
console.log(`src: ${facts.totals.srcFiles} files, ${facts.totals.srcLines} lines; tests: ${facts.totals.testFiles} files, ${facts.totals.testCases} cases`);
console.log('| Folder | Files | Lines | Uses |\n|---|---|---|---|');
for (const g of facts.folders) console.log(`| \`${g.name}\` | ${g.files} | ${g.lines.toLocaleString('en-US')} | ${Object.keys(g.deps).sort().join(', ')} |`);
