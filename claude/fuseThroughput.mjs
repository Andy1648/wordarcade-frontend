// fuseThroughput.mjs — FUSE words/min, DERIVED from the real fuse.js engine.
//
// WHY THIS IS A SHARED MODULE AND NOT A CONSTANT IN EACH SIM. FUSE's throughput had been
// ASSERTED at ~20/min in winsmin-sim.mjs ("continuous solo, short fragments, little downtime")
// while CHAIN — the same human solving a comparably constrained prompt — was DERIVED from its
// engine at 11.6/min. The asserted figure is 2.15x too fast. Because wins/min = throughput x
// per-word, that one wrong input made every proposed FUSE rate rise look like it would blow the
// cross-mode spread, and pinned fuse at x1.35 through two re-fits.
//
// The model is CHAIN'S, unchanged, so the two modes are measured against one human:
//   produce time = 1600 + U(0,4600) + 300*len + scarcity,  scarcity = (6-cands)*300 when thin.
// Driving the real engine with it, the median run dies at ~18 words at ~6.5s/word: late fuses
// fall toward fuseBase -> 3500ms while the human still needs ~5.5s, and every expire burns a
// full fuse for no word at all.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFuseEngine } from '../src/solo/fuse.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));

/** words/min for FUSE at median human play, derived from the engine's own fuse clock. */
export function deriveFuseWpm({ runs = 2000, seed = 4242 } = {}) {
  const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
  const accept = new Set(recall);
  for (const w of readFileSync(U('../src/solo/words.accept.txt'), 'utf8').split(' ')) accept.add(w);
  const raw = JSON.parse(readFileSync(U('../src/solo/fragmentPools.json'), 'utf8'));
  const pools = { e: raw.e.split(' '), m: raw.m.split(' '), h: raw.h.split(' '), b: raw.b.split(' ') };

  // The same 9k-word human vocabulary chain is calibrated against, indexed by servable fragment.
  const byFrag = new Map();
  for (const w of recall.slice(0, 9000)) {
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

  const rng = mulberry32(seed);
  let totWords = 0, totMs = 0, totRunWords = 0;
  for (let i = 0; i < runs; i++) {
    const eng = createFuseEngine({ accept, pools, rng });
    let served = eng.start();
    let runWords = 0;
    for (let g = 0; g < 5000; g++) {
      const pool = byFrag.get(served.fragment) || [];
      const cands = [];
      for (const w of pool) {
        if (!eng.state.used.has(w)) cands.push(w);
        if (cands.length >= 30) break;
      }
      const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
      const word = cands.length ? cands[Math.floor(rng() * cands.length)] : null;
      const produce = word ? 1600 + rng() * 4600 + 300 * word.length + scarcity : Infinity;
      // The fuse beat them: the whole fuse elapses and a life goes, with no word banked.
      if (produce > served.fuseMs) {
        totMs += served.fuseMs;
        if (eng.expire().ended) break;
        served = { fragment: eng.state.fragment, fuseMs: eng.state.fuseMs };
        continue;
      }
      const r = eng.submit(word);
      if (!r.ok) {
        totMs += served.fuseMs;
        if (eng.expire().ended) break;
        served = { fragment: eng.state.fragment, fuseMs: eng.state.fuseMs };
        continue;
      }
      totMs += produce;
      totWords += 1;
      runWords += 1;
      served = r;
    }
    totRunWords += runWords;
  }
  return { wordsPerMin: totWords / (totMs / 60000), meanWordsPerRun: totRunWords / runs, secPerWord: totMs / totWords / 1000 };
}
