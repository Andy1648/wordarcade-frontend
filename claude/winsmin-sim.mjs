// winsmin-sim.mjs — JOB B: measures WINS/MIN per mode (rarity-weighted) at equal difficulty, so
// the mode multipliers can be tuned until no mode earns >2x any other, and no degenerate strategy
// beats honest play by >1.5x. Run: node claude/winsmin-sim.mjs
//
// wins/min = (words/min throughput) × (mean rarity-weighted wins per word).
//   - per-word wins  = WORD_WINS_BASE(20) × modeMult × rarityWeight(band.mult + lengthBonus)
//   - modeMult       = the LIVE src/progress/wins.js WINS_MULT (edit there; this reads it)
//   - word models    = the faithful per-mode models from rarity-sim.mjs (CHAIN = real engine +
//                      calibrated 9k human; SAT = forced deck; BOMB/BLITZ/FUSE = freq-weighted typist)
//
// THROUGHPUT (words/min) — the knob that, with the mults, sets wins/min. Made EXPLICIT and
// documented here rather than hidden. CHAIN is DERIVED from the engine's own produce-time model
// (high fidelity). The others are reasoned from each mode's loop and labeled APPROX:
//   WORD BOMB  ~8/min  — turn-based; one word per turn then waits for other players (high downtime)
//   BLITZ     ~14/min  — 60s type-fast sprints separated by round/scoring downtime
//   SAT RUSH  ~12/min  — paced reveal cadence (stageIntervalMs 2800), one answer per ~5s
//   FUSE      ~20/min  — continuous solo, short fragments, little downtime
// (CHAIN comes out ~ the same order, derived below.)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createChainEngine } from '../src/solo/chain.js';
import { mulberry32 } from '../src/solo/shared.js';
import { WORD_WINS_BASE, WINS_MULT } from '../src/progress/wins.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { comboMultiplier } from '../src/progress/combo.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const accept = new Set(recall);
for (const w of readFileSync(U('../src/solo/words.accept.txt'), 'utf8').split(' ')) accept.add(w);
const idx = buildRarityIndex(recall);
const topCommon = recall.slice(0, 3000);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// Mean reward-weighted wins/word for a set of runs (arrays of accepted words), at a given mode mult.
// POST-PARITY (feat/parity-wb-blitz): ALL five modes now score with combo (+0.1 per consecutive
// accept, ×3 cap) + lucky (1/40 ×5), so the per-word weight is cappedWordMult(rarity, combo, lucky)
// — the SAME product the live code banks. Runs are all-accept sequences (no breaks modeled), so the
// combo streak = the word's position in the run; lucky is its expected value E[×] = 39/40 + 5/40 =
// 1.1. This is applied UNIFORMLY to every mode (they all have the mechanic now), so it must not move
// the SPREAD — the point of re-running is to confirm exactly that.
const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5; // 1.1
const WEIGHT_CAP = 40; // cappedWordMult's ×40 ceiling (rarity×combo×lucky)
// Which modes fold combo+lucky into the weight. Post feat/parity-sat: ALL FIVE do (WB/Blitz added on
// feat/parity-wb-blitz, SAT Rush on feat/parity-sat) — so the mechanic is uniform and the spread
// returns to the compressed band.
const HAS_COMBO_LUCKY = { wordBomb: true, blitz: true, chain: true, fuse: true, satRush: true };
function meanWinsPerWord(runs, modeKey) {
  const mult = WINS_MULT[modeKey] || 1;
  const cl = HAS_COMBO_LUCKY[modeKey];
  const per = [];
  for (const words of runs) {
    words.forEach((w, i) => {
      const rarity = wordRarity(w, idx).mult;
      const weight = cl ? Math.min(WEIGHT_CAP, rarity * comboMultiplier(i + 1) * LUCKY_MEAN) : rarity;
      per.push(WORD_WINS_BASE * mult * weight);
    });
  }
  return mean(per);
}

// ---- CHAIN: real engine + calibrated median human; DERIVE words/min from produce times ----
function byFirst(words) { const m = new Map(); for (const w of words) { const c = w[0]; let a = m.get(c); if (!a) m.set(c, (a = [])); a.push(w); } return m; }
function runChainTimed(rng, vocabByFirst) {
  const eng = createChainEngine({ accept, topCommon, rng });
  const got = []; let ms = 0;
  for (let g = 0; g < 5000; g++) {
    const pool = vocabByFirst.get(eng.state.requiredLetter) || [];
    const cands = [];
    for (const w of pool) { if (!eng.state.used.has(w)) cands.push(w); if (cands.length >= 30) break; }
    if (cands.length === 0) break;
    const word = cands.find((w) => !eng.state.endedLetters.has(w[w.length - 1])) || cands[Math.floor(rng() * cands.length)];
    const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
    const produce = 1600 + rng() * 4600 + 300 * word.length + scarcity;
    if (produce > eng.currentTMax()) break;
    if (!eng.submit(word).ok) break;
    got.push(word); ms += produce;
  }
  return { got, ms };
}
const humanVocab = byFirst(recall.slice(0, 9000));
function manyChain(runs = 1000, seed = 4242) {
  const rng = mulberry32(seed);
  const out = []; let totMs = 0, totWords = 0;
  for (let i = 0; i < runs; i++) { const r = runChainTimed(rng, humanVocab); out.push(r.got); totMs += r.ms; totWords += r.got.length; }
  const wordsPerMin = totWords / (totMs / 60000); // derived from the engine's own timing
  return { runs: out, wordsPerMin };
}

// ---- SAT: forced deck ----
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);
function manySat(runs = 1000, seed = 77, perRun = 12) {
  const rng = mulberry32(seed); const out = [];
  for (let i = 0; i < runs; i++) { const words = []; for (let k = 0; k < perRun; k++) words.push(satDeck[Math.floor(rng() * satDeck.length)]); out.push(words); }
  return out;
}

// ---- BOMB/BLITZ/FUSE: frequency-weighted typist (APPROX). Optional forced short-common vocab for
// the DEGENERATE model (spam the fastest, most-common short words). ----
function freqTypist({ runs = 1000, seed, perRun, topVocab, minLen = 3, maxLen = 99 }) {
  const rng = mulberry32(seed);
  const pool = []; const weights = []; let acc = 0;
  for (let i = 0; i < Math.min(topVocab, recall.length); i++) {
    const w = recall[i];
    if (w.length < minLen || w.length > maxLen) continue;
    acc += 1 / (i + 50); pool.push(w); weights.push(acc);
  }
  const totalW = acc;
  const pick = () => { const r = rng() * totalW; let lo = 0, hi = weights.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (weights[mid] < r) lo = mid + 1; else hi = mid; } return pool[lo]; };
  const out = [];
  for (let i = 0; i < runs; i++) { const words = []; const seen = new Set(); for (let k = 0; k < perRun; k++) { let w = pick(); let t = 0; while (seen.has(w) && t++ < 5) w = pick(); seen.add(w); words.push(w); } out.push(words); }
  return out;
}

// THROUGHPUT (words/min). CHAIN derived; others documented APPROX (see header).
const chain = manyChain();
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: chain.wordsPerMin, fuse: 20 };

const MODELS = {
  wordBomb: freqTypist({ seed: 11, perRun: 12, topVocab: 12000, minLen: 3 }),
  blitz: freqTypist({ seed: 22, perRun: 12, topVocab: 12000, minLen: 3 }),
  satRush: manySat(),
  chain: chain.runs,
  fuse: freqTypist({ seed: 33, perRun: 12, topVocab: 12000, minLen: 3 }),
};
// wins.js keys wins by the ROUND-mode key. Word Bomb / Blitz aren't in WINS_MULT (→ ×1); chain/fuse/satRush are.
const MULT_KEY = { wordBomb: 'wordBomb', blitz: 'blitz', satRush: 'satRush', chain: 'chain', fuse: 'fuse' };

console.log(`WINS/MIN per mode (rarity-weighted, equal difficulty ×1, R0). mults = ${JSON.stringify(WINS_MULT)}`);
console.log(`CHAIN words/min DERIVED from engine timing: ${THROUGHPUT.chain.toFixed(1)}\n`);
const rows = [];
for (const mode of Object.keys(MODELS)) {
  const wpw = meanWinsPerWord(MODELS[mode], MULT_KEY[mode]);
  const wpm = THROUGHPUT[mode] * wpw;
  rows.push({ mode, tput: THROUGHPUT[mode], wpw, wpm });
}
rows.sort((a, b) => a.wpm - b.wpm);
const lo = rows[0].wpm, hi = rows[rows.length - 1].wpm;
for (const r of rows) console.log(`  ${r.mode.padEnd(9)} tput ${r.tput.toFixed(1).padStart(5)}/min × ${r.wpw.toFixed(1).padStart(6)}/word = ${r.wpm.toFixed(0).padStart(6)} wins/min   (${(r.wpm / lo).toFixed(2)}× lowest)`);
console.log(`\n  SPREAD (max/min): ${(hi / lo).toFixed(2)}×   ${hi / lo <= 2 ? '✓ within 2×' : '✗ over 2× target'}`);

// ---- DEGENERATE vs HONEST (per mode that a human can steer: BOMB/BLITZ/FUSE) ----
// Degenerate = spam the fastest short common words (len 3-4, top 2k), at a FASTER throughput
// (short words type quicker: +40%). Honest = the normal freq typist. Check degenerate ≤ 1.5× honest.
console.log('\nDEGENERATE (short-common spam, +40% tput) vs HONEST (normal play):');
for (const mode of ['wordBomb', 'blitz', 'fuse']) {
  const honestWpm = THROUGHPUT[mode] * meanWinsPerWord(MODELS[mode], MULT_KEY[mode]);
  const degRuns = freqTypist({ seed: 99, perRun: 12, topVocab: 2000, minLen: 3, maxLen: 4 });
  const degWpm = THROUGHPUT[mode] * 1.4 * meanWinsPerWord(degRuns, MULT_KEY[mode]);
  const ratio = degWpm / honestWpm;
  console.log(`  ${mode.padEnd(9)} honest ${honestWpm.toFixed(0).padStart(6)} · degenerate ${degWpm.toFixed(0).padStart(6)}  = ${ratio.toFixed(2)}× honest   ${ratio <= 1.5 ? '✓' : '✗ >1.5×'}`);
}
