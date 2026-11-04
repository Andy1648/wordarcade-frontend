// scripts/fuseVariety.mjs — how repetitive does FUSE feel? Plays SESSIONS of back-to-back runs with the median player
// model from fuse.test.js and reports: (1) fragments repeated WITHIN a run, (2) fragments a run shares with the run just
// before it (the "didn't I just get this?" feeling), (3) the same for the run's OPENING 5 fragments, (4) pool sizes.
//   node scripts/fuseVariety.mjs [sessions=300] [runsPerSession=5] [seed=7]
import { readFileSync } from 'node:fs';
import { createFuseEngine } from '../src/solo/fuse.js';
import { mulberry32 } from '../src/solo/shared.js';

const [SESS = 300, RUNS = 5, SEED = 7] = process.argv.slice(2).map(Number);
const here = (p) => new URL(`../src/solo/${p}`, import.meta.url);
const recall = readFileSync(here('words.recall.txt'), 'utf8').split(' ');
const accept = new Set(recall);
for (const w of readFileSync(here('words.accept.txt'), 'utf8').split(' ')) accept.add(w);
const raw = JSON.parse(readFileSync(here('fragmentPools.json'), 'utf8'));
const pools = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v : v.split(' ')]));
const fragSet = new Set(Object.values(pools).flat());
const idx = new Map([...fragSet].map((f) => [f, []]));
for (const w of recall.slice(0, 9000)) {
  const seen = new Set();
  for (let i = 0; i < w.length; i++) for (const L of [2, 3]) {
    const s = w.slice(i, i + L);
    if (s.length === L && idx.has(s) && !seen.has(s)) { seen.add(s); idx.get(s).push(w); }
  }
}
const THINK = { e: 0, m: 500, h: 1300, b: 2000 };

function run(rng, opts) {
  const eng = createFuseEngine({ accept, pools, rng, ...opts });
  const served = [eng.start().fragment];
  for (let g = 0; g < 3000 && eng.state.alive; g++) {
    const cands = idx.get(eng.state.fragment) || [];
    let word = null;
    for (const w of cands) { if (eng.state.used.has(w)) continue; if (rng() < 0.75) { word = w; break; } }
    const r = !word || 1400 + rng() * 2800 + 260 * word.length + THINK[eng.state.tier] > eng.state.fuseMs ? eng.expire() : eng.submit(word);
    if (r.ended) break;
    if (r.fragment) served.push(r.fragment);
  }
  return served;
}

export function measure(opts = {}, sessions = SESS, runs = RUNS, seed = SEED) {
  const rng = mulberry32(seed);
  let served = 0, withinRep = 0, prevShared = 0, prevDen = 0, openShared = 0, openDen = 0, len = 0, n = 0;
  for (let s = 0; s < sessions; s++) {
    let prev = null;
    const memory = opts.memoryFactory ? opts.memoryFactory() : null;
    for (let r = 0; r < runs; r++) {
      const frags = run(rng, memory ? { recent: memory } : {});
      if (memory && memory.note) memory.note(frags);
      const seen = new Set();
      for (const f of frags) { if (seen.has(f)) withinRep++; seen.add(f); }
      served += frags.length; len += frags.length; n++;
      if (prev) {
        const ps = new Set(prev);
        prevShared += frags.filter((f) => ps.has(f)).length; prevDen += frags.length;
        const po = new Set(prev.slice(0, 5));
        openShared += frags.slice(0, 5).filter((f) => po.has(f)).length; openDen += Math.min(5, frags.length);
      }
      prev = frags;
    }
  }
  return {
    pools: Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])),
    avgRunFragments: +(len / n).toFixed(1),
    withinRunRepeat: +(100 * withinRep / served).toFixed(2),
    sharedWithPrevRun: +(100 * prevShared / Math.max(1, prevDen)).toFixed(2),
    openingSharedWithPrevOpening: +(100 * openShared / Math.max(1, openDen)).toFixed(2),
  };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('fuseVariety.mjs')) {
  console.log(JSON.stringify(measure(), null, 1));
}
