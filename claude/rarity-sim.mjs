// rarity-sim.mjs — measures the RARITY-band distribution of accepted words per mode, and the
// change in median wins/run when the rarity multiplier is applied. Run: node claude/rarity-sim.mjs
//
// Faithfulness per mode:
//   CHAIN   — the REAL chain engine + the repo's CALIBRATED median-player model (chain.test.js:
//             runHuman, vocab = recall.slice(0,9000)). Highest fidelity.
//   CHAIN*  — a STRONG player (full accept vocab) to show the top-tier CEILING (reachability).
//   SAT     — the actual 612-word deck the mode FORCES on the player (players don't choose). Faithful.
//   BOMB/BLITZ/FUSE — a transparent FREQUENCY-WEIGHTED typist model (prob of producing a word
//             falls with its rank), since these are player-choice with no headless engine here.
//             Labeled APPROX. The vocab ceiling (topVocab) is the knob that decides reachability.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createChainEngine } from '../src/solo/chain.js';
import { mulberry32 } from '../src/solo/shared.js';
import { perWordWins } from '../src/progress/wins.js';
import { buildRarityIndex, wordRarity, RARITY_BANDS, OBSCURE_BAND } from '../src/progress/rarity.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const accept = new Set(recall);
for (const w of readFileSync(U('../src/solo/words.accept.txt'), 'utf8').split(' ')) accept.add(w);
const idx = buildRarityIndex(recall);
const topCommon = recall.slice(0, 3000);

const BANDS = [...RARITY_BANDS.map((b) => b.name), OBSCURE_BAND.name];
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0');

// Tally a stream of accepted-word arrays (one per run): band shares + median wins/run.
function tally(runs, mode) {
  const bandCount = Object.fromEntries(BANDS.map((b) => [b, 0]));
  let total = 0;
  const perWord = perWordWins({ mode, rebirthCount: 0 });
  const baseRun = [];
  const rareRun = [];
  for (const words of runs) {
    let base = 0;
    let rare = 0;
    for (const w of words) {
      const r = wordRarity(w, idx);
      bandCount[r.band] += 1;
      total += 1;
      base += perWord;
      rare += perWord * r.mult;
    }
    baseRun.push(base);
    rareRun.push(Math.round(rare));
  }
  return { bandCount, total, medBase: median(baseRun), medRare: median(rareRun), nRuns: runs.length };
}

function report(label, mode, t) {
  console.log(`\n== ${label} ==  (${t.nRuns} runs, ${t.total} accepted words)`);
  for (const b of BANDS) console.log(`   ${b.padEnd(9)} ${String(t.bandCount[b]).padStart(7)}  ${pct(t.bandCount[b], t.total).padStart(5)}%`);
  const obsc = pct(t.bandCount.OBSCURE, t.total);
  const topShare = ((t.bandCount.RARE + t.bandCount.OBSCURE) / (t.total || 1)) * 100;
  console.log(`   median wins/run:  base ${t.medBase}  →  rarity ${t.medRare}  (${t.medBase ? '+' + ((100 * (t.medRare - t.medBase)) / t.medBase).toFixed(0) : '0'}%)`);
  console.log(`   OBSCURE share: ${obsc}%   RARE+OBSCURE: ${topShare.toFixed(1)}%   ${Number(obsc) < 2 ? '⚠ OBSCURE < 2% (top tier hard to reach)' : '✓'}`);
}

// ---- CHAIN: real engine + calibrated median human (chain.test.js runHuman) ----
function byFirst(words) {
  const m = new Map();
  for (const w of words) {
    const c = w[0];
    let a = m.get(c);
    if (!a) m.set(c, (a = []));
    a.push(w);
  }
  return m;
}
function runChain(rng, vocabByFirst) {
  const eng = createChainEngine({ accept, topCommon, rng });
  const got = [];
  for (let g = 0; g < 5000; g++) {
    const pool = vocabByFirst.get(eng.state.requiredLetter) || [];
    const cands = [];
    for (const w of pool) {
      if (!eng.state.used.has(w)) cands.push(w);
      if (cands.length >= 30) break;
    }
    if (cands.length === 0) break;
    const word = cands.find((w) => !eng.state.endedLetters.has(w[w.length - 1])) || cands[Math.floor(rng() * cands.length)];
    const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
    const produce = 1600 + rng() * 4600 + 300 * word.length + scarcity;
    if (produce > eng.currentTMax()) break;
    if (!eng.submit(word).ok) break;
    got.push(word);
  }
  return got;
}
const humanVocab = byFirst(recall.slice(0, 9000)); // calibrated median: knows ~9k words
const strongVocab = byFirst([...accept]); // full-vocab ceiling
function manyChain(vocab, runs = 1000, seed = 4242) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < runs; i++) out.push(runChain(rng, vocab));
  return out;
}

// ---- SAT: the forced deck (players don't choose). One "run" = ~12 served words. ----
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);
function manySat(runs = 1000, seed = 77, perRun = 12) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < runs; i++) {
    const words = [];
    for (let k = 0; k < perRun; k++) words.push(satDeck[Math.floor(rng() * satDeck.length)]);
    out.push(words);
  }
  return out;
}

// ---- BOMB/BLITZ/FUSE: frequency-weighted typist (APPROX). p(word) ∝ 1/(rank+bias) within a
// vocab ceiling; longer min-length for FUSE. topVocab = how deep the player's active vocab goes. ----
function freqTypist({ runs = 1000, seed, perRun, topVocab, minLen = 3 }) {
  const rng = mulberry32(seed);
  // Build a weighted pool once: recall words within [minLen, topVocab-rank], weight 1/(rank+50).
  const pool = [];
  const weights = [];
  let acc = 0;
  for (let i = 0; i < Math.min(topVocab, recall.length); i++) {
    const w = recall[i];
    if (w.length < minLen) continue;
    const wt = 1 / (i + 50);
    pool.push(w);
    acc += wt;
    weights.push(acc);
  }
  const totalW = acc;
  const pick = () => {
    const r = rng() * totalW;
    let lo = 0;
    let hi = weights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (weights[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return pool[lo];
  };
  const out = [];
  for (let i = 0; i < runs; i++) {
    const words = [];
    const seen = new Set();
    for (let k = 0; k < perRun; k++) {
      let w = pick();
      let tries = 0;
      while (seen.has(w) && tries++ < 5) w = pick();
      seen.add(w);
      words.push(w);
    }
    out.push(words);
  }
  return out;
}

console.log('RARITY DISTRIBUTION — 1,000 runs/mode. Bands: COMMON<3k UNCOMMON<15k RARE<recall-end OBSCURE=not-in-recall');
console.log(`recall corpus: ${recall.length} words (index === rank)`);
report('CHAIN — median human (calibrated, vocab≈9k)', 'chain', tally(manyChain(humanVocab), 'chain'));
report('CHAIN* — strong player (full vocab, CEILING)', 'chain', tally(manyChain(strongVocab, 1000, 555), 'chain'));
report('SAT RUSH — forced deck (612 words)', 'satRush', tally(manySat(), 'satRush'));
report('WORD BOMB — freq typist APPROX (vocab≈12k, len≥3)', 'wordBomb', tally(freqTypist({ seed: 11, perRun: 12, topVocab: 12000, minLen: 3 }), 'wordBomb'));
report('CATEGORY BLITZ — freq typist APPROX (vocab≈12k, len≥3)', 'blitz', tally(freqTypist({ seed: 22, perRun: 12, topVocab: 12000, minLen: 3 }), 'blitz'));
report('FUSE — freq typist APPROX (vocab≈9k, len≥5)', 'fuse', tally(freqTypist({ seed: 33, perRun: 10, topVocab: 9000, minLen: 5 }), 'fuse'));
