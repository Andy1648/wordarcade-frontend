// scripts/fuseCoverage.mjs — each FUSE tier's difficulty as COVERAGE: how many of the median player's ~9k known words
// (recall top 9,000, fuse.test.js) contain the fragment. Prints each tier's coverage quartiles and, with --suggest,
// fresh 2–3 letter fragments (in no pool yet) whose coverage falls inside a tier's inter-quartile band — so a pool can
// grow without moving its difficulty.   node scripts/fuseCoverage.mjs [--suggest]
import { readFileSync } from 'node:fs';

const here = (p) => new URL(`../src/solo/${p}`, import.meta.url);
const recall = readFileSync(here('words.recall.txt'), 'utf8').split(' ');
const vocab = recall.slice(0, 9000);
const raw = JSON.parse(readFileSync(here('fragmentPools.json'), 'utf8'));
const pools = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.split(' ')]));

export const cover = new Map();
for (const w of vocab) {
  const seen = new Set();
  for (let i = 0; i < w.length; i++) for (const L of [2, 3]) {
    const s = w.slice(i, i + L);
    if (s.length === L && !seen.has(s)) { seen.add(s); cover.set(s, (cover.get(s) || 0) + 1); }
  }
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
export const bands = {};
for (const [t, fr] of Object.entries(pools)) {
  const c = fr.map((f) => cover.get(f) || 0);
  bands[t] = { n: fr.length, min: Math.min(...c), q1: q(c, 0.25), med: q(c, 0.5), q3: q(c, 0.75), max: Math.max(...c) };
}
if (process.argv[1] && process.argv[1].endsWith('fuseCoverage.mjs')) {
  console.log(JSON.stringify(bands, null, 1));
  if (process.argv.includes('--suggest')) {
    const inPool = new Set(Object.values(pools).flat());
    for (const t of ['e', 'm']) {
      const b = bands[t];
      const s = [...cover].filter(([f, c]) => !inPool.has(f) && /^[a-z]+$/.test(f) && c >= b.q1 && c <= b.q3).sort((a, b2) => b2[1] - a[1]);
      console.log(t, s.length, s.slice(0, 80).map(([f, c]) => `${f}:${c}`).join(' '));
    }
  }
}
