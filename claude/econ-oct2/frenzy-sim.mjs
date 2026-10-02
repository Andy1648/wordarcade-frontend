// frenzy-sim.mjs — how often does a FUSE run light all 26 letters (= FRENZY), before/after the
// last-letters steering? Drives the REAL fuse.js engine with the fuseThroughput.mjs human model,
// at three skill levels. node claude/econ-oct2/frenzy-sim.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFuseEngine } from '../../src/solo/fuse.js';
import { mulberry32 } from '../../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../../src/solo/words.recall.txt'), 'utf8').split(' ');
const accept = new Set(recall);
for (const w of readFileSync(U('../../src/solo/words.accept.txt'), 'utf8').split(' ')) accept.add(w);
const raw = JSON.parse(readFileSync(U('../../src/solo/fragmentPools.json'), 'utf8'));
const pools = { e: raw.e.split(' '), m: raw.m.split(' '), h: raw.h.split(' '), b: raw.b.split(' ') };

// weak / median / strong: vocabulary size, speed scale, and how hard they aim for dark letters.
const BOTS = [
  { id: 'weak', vocab: 4000, speed: 1.3, aim: 0.2 },
  { id: 'median', vocab: 9000, speed: 1.0, aim: 0.5 },
  { id: 'strong', vocab: 20000, speed: 0.75, aim: 0.9 },
];

function index(vocab) {
  const byFrag = new Map();
  for (const w of recall.slice(0, vocab)) {
    const seen = new Set();
    for (let i = 0; i < w.length - 1; i++) {
      seen.add(w.slice(i, i + 2));
      if (i < w.length - 2) seen.add(w.slice(i, i + 3));
    }
    for (const f of seen) {
      let a = byFrag.get(f);
      if (!a) byFrag.set(f, (a = []));
      if (a.length < 400) a.push(w);
    }
  }
  return byFrag;
}

function run(bot, steerP, runs = 1500, seed = 1648) {
  const byFrag = index(bot.vocab);
  const rng = mulberry32(seed);
  let frenzyRuns = 0, words = 0, ms = 0, strips = 0, maxLitSum = 0;
  for (let i = 0; i < runs; i++) {
    const eng = createFuseEngine({ accept, pools, rng, steerP });
    let served = eng.start();
    let cleared = 0, maxLit = 0;
    for (let g = 0; g < 5000; g++) {
      const pool = byFrag.get(served.fragment) || [];
      const cands = [];
      for (const w of pool) {
        if (!eng.state.used.has(w)) cands.push(w);
        if (cands.length >= 30) break;
      }
      let word = null;
      if (cands.length) {
        const lit = eng.state.lettersUsed;
        const dark = cands.filter((w) => [...w].some((c) => !lit.has(c)));
        word = dark.length && rng() < bot.aim ? dark[Math.floor(rng() * dark.length)] : cands[Math.floor(rng() * cands.length)];
      }
      const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
      const produce = word ? (1600 + rng() * 4600 + 300 * word.length + scarcity) * bot.speed : Infinity;
      if (produce > served.fuseMs) {
        ms += served.fuseMs;
        if (eng.expire().ended) break;
        served = { fragment: eng.state.fragment, fuseMs: eng.state.fuseMs };
        continue;
      }
      const r = eng.submit(word);
      if (!r.ok) {
        ms += served.fuseMs;
        if (eng.expire().ended) break;
        served = { fragment: eng.state.fragment, fuseMs: eng.state.fuseMs };
        continue;
      }
      ms += produce;
      words += 1;
      maxLit = Math.max(maxLit, eng.state.lettersUsed.size);
      if (r.stripCleared) { cleared += 1; maxLit = 26; }
      served = r;
    }
    if (cleared > 0) frenzyRuns += 1;
    strips += cleared;
    maxLitSum += maxLit;
  }
  return {
    frenzyRunPct: +(100 * frenzyRuns / runs).toFixed(1),
    stripsPerRun: +(strips / runs).toFixed(3),
    meanMaxLit: +(maxLitSum / runs).toFixed(1),
    wordsPerRun: +(words / runs).toFixed(1),
    minutesPerFrenzy: strips ? +((ms / 60000) / strips).toFixed(1) : null,
  };
}

const out = {};
for (const bot of BOTS) {
  out[bot.id] = { before: run(bot, 0), after: run(bot, undefined) };
  console.log(bot.id.padEnd(7), 'BEFORE', JSON.stringify(out[bot.id].before));
  console.log(''.padEnd(7), 'AFTER ', JSON.stringify(out[bot.id].after));
}
import('node:fs').then((fs) => fs.writeFileSync(U('./frenzy-sim.json'), JSON.stringify(out, null, 2)));
