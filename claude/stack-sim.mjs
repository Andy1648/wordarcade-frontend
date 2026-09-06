// stack-sim.mjs — per-word WINS distribution under the full multiplier stack
// (rarity × combo × lucky) × perWordWins, for the highest-mult solo mode (FUSE).
// Faithful to the shipped logic: real rarity index (recall.txt), combo curve, 1/40 lucky.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(dir, '..', p), 'utf8');

const recall = read('src/solo/words.recall.txt').split(/\s+/).filter(Boolean);
const accept = read('src/solo/words.accept.txt').split(/\s+/).filter(Boolean);
const idx = buildRarityIndex(recall);

// --- shipped stack constants (mirrored) ---
const round10 = (x) => Math.round(x / 10) * 10; // sim uses half-up; economy uses half-even (±0 here)
const COMBO_MAX = 3.0, COMBO_STEP = 0.1;
const comboMult = (streak) => Math.min(COMBO_MAX, 1 + COMBO_STEP * Math.max(0, streak));
const LUCKY_ODDS = 40, LUCKY_WINS = 5;
const WORD_WINS_BASE = 20, FUSE_MODE_MULT = 15; // FUSE is the top solo mode mult
const rebirthMultTable = { 0: 1, 10: 10 };
const perWordWins = (rc) => round10(WORD_WINS_BASE * FUSE_MODE_MULT * 1 * rebirthMultTable[rc]);

// deterministic PRNG so the run is reproducible
let seed = 123456789 >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// REALISTIC word choice: players type common words far more than rare ones. Model the typed word's
// rank as skewed toward the common (low-rank) end of recall (rand^2.5), with ~6% "obscure" words
// not in the 31k corpus (rarest band). Uniform-from-accept (every rare word equally likely) is an
// unrealistic upper bound; this skew matches how a person actually plays.
const OBSCURE_WORD = 'zzzzzzzzzz'; // 10-letter, absent from recall → OBSCURE + max length bonus
const pickWord = () => {
  if (rand() < 0.06) return OBSCURE_WORD;
  const rank = Math.floor(recall.length * Math.pow(rand(), 2.5));
  return recall[Math.min(recall.length - 1, rank)];
};
const maxOf = (arr) => { let m = -Infinity; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return m; };

// FUSE run model: 3 lives; ~11% miss per word → median run ≈ 24 solved (matches the FUSE sim note).
// combo grows on accept, resets on miss.
const MISS_P = 0.11;
const perWordWinsAtR0 = [], perWordWinsAtR10 = [];
const RUNS = 40000;
for (let r = 0; r < RUNS; r++) {
  let lives = 3, streak = 0;
  while (lives > 0) {
    if (rand() < MISS_P) { lives--; streak = 0; continue; }
    streak++;
    const w = pickWord();
    const rarity = wordRarity(w, idx).mult;         // ≤ 4.5
    const combo = comboMult(streak);                 // ≤ 3.0
    const lucky = rand() < 1 / LUCKY_ODDS ? LUCKY_WINS : 1; // ×5 @ 1/40
    const weight = rarity * combo * lucky;
    perWordWinsAtR0.push(round10(weight * perWordWins(0)));
    perWordWinsAtR10.push(round10(weight * perWordWins(10)));
  }
}
const pct = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))]; };
const rep = (label, arr, rc) => {
  const theoMax = 4.5 * 3.0 * 5 * perWordWins(rc);
  console.log(`${label}  (perWordWins=${perWordWins(rc)})`);
  console.log(`   words simulated : ${arr.length.toLocaleString()}`);
  console.log(`   median          : ${pct(arr, 50).toLocaleString()}`);
  console.log(`   p99             : ${pct(arr, 99).toLocaleString()}`);
  console.log(`   p99.9           : ${pct(arr, 99.9).toLocaleString()}`);
  console.log(`   observed max    : ${maxOf(arr).toLocaleString()}`);
  console.log(`   THEORETICAL max : ${theoMax.toLocaleString()}  (4.5 × 3.0 × 5 × ${perWordWins(rc)})`);
};
rep('=== FUSE per-word WINS @ R0 ===', perWordWinsAtR0, 0);
rep('=== FUSE per-word WINS @ R10 ===', perWordWinsAtR10, 10);
