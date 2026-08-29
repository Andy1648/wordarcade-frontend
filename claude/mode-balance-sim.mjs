// mode-balance-sim.mjs — Job 13: cross-mode economy balance simulation.
//
// Simulates 1,000 runs per mode per difficulty and reports wins/min, XP/min,
// mastery/min. All payout constants are CITED from source (no invented numbers):
//   src/progress/wins.js   — WINS_MULT, DIFFICULTY_MULT, WORD_WINS_BASE, perWordWins, bankWordWins, round10
//   src/progress/xp.js     — XP_MULTIPLIERS, keyTierXp(T0)=10, xpPerWord, cappedWordMult(cap 40)
//   src/progress/mastery.js— +1 mastery word / accepted word (uniform, MASTERY_XP mult M1=1)
//   src/progress/combo.js  — COMBO_STEP 0.1, COMBO_MAX 3.0 (Chain/Fuse only)
//   src/progress/luck.js   — LUCKY_ODDS 40, LUCKY_WINS/XP_MULT 5 (Chain/Fuse only)
//   src/progress/rarity.js — bands COMMON1.0/UNCOMMON1.5/RARE2.5/OBSCURE4.0, +len bonus, cap 4.5
//   src/satRush/engine.js  — stageIntervalMs 2800, spellAlongMs 1100, 3 stages
//   src/solo/chain.js/fuse.js — per-turn clocks (used to sanity-bound pace, not to set it)
//
// BASELINE: R0 (rebirthMult=1), Key Power T0 (10 XP/letter), streak ×1, Word Sense T0,
// mastery M1. These factors are identical multipliers across every mode, so they cancel
// out of the CROSS-MODE comparison; the sim runs them at 1 so the ratios are the pure
// structural balance. (Rebirth/keytier/streak scale every mode equally.)
//
// The ECONOMY is driven by only two things per mode: (a) accepted words / minute [pace],
// and (b) each word's payout weight [rarity × combo × lucky × length]. Each mode's INTERNAL
// score (SAT ante, chain multiplier) is IRRELEVANT to wins/XP/mastery — verified in source:
// bankWordWins/awardWordXp key only off word count + rarity weight, never the mode's score.

import fs from 'fs';

// ---------- CITED payout constants ----------
const WORD_WINS_BASE = 20;                                   // wins.js:117
const WINS_MULT = { wordBomb: 1, blitz: 1, satRush: 2, chain: 10, fuse: 15 };   // wins.js:99
const DIFFICULTY_MULT = { chill: 1.0, easy: 1.25, medium: 1.5, hard: 2.0 };     // wins.js:106
const XP_MULT = { 'word-bomb': 2, 'category-blitz': 2, 'sat-rush': 3, chain: 4, fuse: 5 }; // xp.js:18
const KEYTIER0_XP = 10;                                      // xp.js KEY_TIERS T0
const PER_WORD_MULT_CAP = 40;                                // xp.js:295
const COMBO_STEP = 0.1, COMBO_MAX = 3.0;                     // combo.js:15-16
const LUCKY_ODDS = 40, LUCKY_MULT = 5;                       // luck.js:6-8

function round10(x) {                                        // xp.js:33 (half-to-even)
  const q = (Number.isFinite(x) ? x : 0) / 10, f = Math.floor(q), r = q - f;
  let n; if (r < 0.5) n = f; else if (r > 0.5) n = f + 1; else n = f % 2 === 0 ? f : f + 1;
  return n * 10;
}
function perWordWins(mode, diff) {                           // wins.js:118 at R0
  return round10(WORD_WINS_BASE * (WINS_MULT[mode] || 1) * (DIFFICULTY_MULT[diff] ?? 1) * 1);
}
function cappedWordMult(r, c, l) { return Math.min(PER_WORD_MULT_CAP, r * c * l); } // xp.js:297

// ---------- rarity from the REAL corpus ----------
function toks(p) { return fs.readFileSync(p, 'utf8').split(/\s+/).filter(Boolean); }
const recall = toks('src/solo/words.recall.txt');
const rank = new Map(); recall.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });
function bandMult(w) { const r = rank.has(w) ? rank.get(w) : Infinity;
  if (r < 3000) return 1.0; if (r < 15000) return 1.5; if (r < Infinity) return 2.5; return 4.0; }
function lenBonus(len) { const o = len - 5; return o <= 0 ? 0 : Math.min(0.5, o * 0.1); }
function rarityMult(w) { return Math.min(4.5, Math.round((bandMult(w) + lenBonus(w.length)) * 100) / 100); }

// Word pools (real data). Each pool: sample a {word,len,rarity} to reflect what that mode/strategy types.
const accept = toks('src/solo/words.accept.txt');
const satWords = (() => { const j = JSON.parse(fs.readFileSync('src/data/satRush/words.json', 'utf8'));
  const arr = Array.isArray(j) ? j : j.words; return arr.map(x => (x.word || '').toLowerCase()); })();
const commonShort = recall.slice(0, 3000);                  // natural short/common (avg len ~6, rarity ~1.13)
const obscure3 = accept.filter(w => w.length === 3);        // shortest-word spam, OBSCURE variant (122 words, ×4)
const obscureLong = accept.filter(w => !rank.has(w) && w.length >= 8); // rarity maximizer (×4.5)

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// ---------- RNG ----------
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function lognormalMs(rng, meanS, sigma) { // returns seconds; median≈meanS
  const u1 = Math.max(1e-9, rng()), u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0.6, meanS * Math.exp(sigma * z));
}

// ---------- Per-mode player models (DOCUMENTED ASSUMPTIONS) ----------
// cycleMean = seconds between YOUR accepted words (think + type + reject-recovery, and for
// turn-based modes the opponents' turns). typeCharsPerSec ~3.3 (≈40 WPM) folded into means.
// rejectP = fraction of attempts rejected (resets Chain/Fuse combo; wastes ~cycle time).
const MODELS = {
  'word-bomb': {   // turn-based: your word every Nth turn. Short common words (fragment-containing).
    mode: 'wordBomb', xpMode: 'word-bomb', masteryMode: 'word-bomb',
    nPlayers: 2, yourAnswerS: 4.0, oppTurnS: 4.0, rejectP: 0.06,
    pool: commonShort, combo: false, lucky: false, hasDifficulty: true,
  },
  'category-blitz': { // simultaneous: rapid submit, no turn wait. Category members (common-ish).
    mode: 'blitz', xpMode: 'category-blitz', masteryMode: 'category-blitz',
    cycleMean: 4.5, rejectP: 0.10, pool: commonShort, combo: false, lucky: false, hasDifficulty: true,
  },
  'sat-rush': {    // stage-gated. Advanced deck (avg rarity 3.49, len 8.25). Answer stage distribution.
    mode: 'satRush', xpMode: 'sat-rush', masteryMode: 'sat-rush',
    stageProb: [0.35, 0.30, 0.25, 0.10], // P(answer at stage0 / stage1 / stage2 / spell-along)
    stageBaseS: [0, 2.8, 5.6, 9.0], answerS: 3.5, rejectP: 0.08,
    pool: satWords, combo: false, lucky: false, hasDifficulty: false,
  },
  chain: {         // solo, one life. Find word starting with last letter.
    mode: 'chain', xpMode: 'chain', masteryMode: 'chain',
    cycleMean: 5.0, rejectP: 0.09, pool: commonShort, combo: true, lucky: true, hasDifficulty: false,
  },
  fuse: {          // solo, two lives. Find word containing fragment.
    mode: 'fuse', xpMode: 'fuse', masteryMode: 'fuse',
    cycleMean: 5.0, rejectP: 0.08, pool: commonShort, combo: true, lucky: true, hasDifficulty: false,
  },
};

const WINDOW_S = 180; // simulate a 3-minute active-play window per run, then divide by 3.

function drawWord(model, rng) {
  const w = pick(model.pool, rng);
  return { len: w.length, rarity: rarityMult(w) };
}
function cycleTime(model, rng) {
  if (model.mode === 'wordBomb') {
    // your answer + (nPlayers-1) opponent turns
    let t = lognormalMs(rng, model.yourAnswerS, 0.3);
    for (let i = 0; i < model.nPlayers - 1; i++) t += lognormalMs(rng, model.oppTurnS, 0.3);
    return t;
  }
  if (model.mode === 'satRush') {
    let s = 0, r = rng(); for (let i = 0; i < 4; i++) { if ((r -= model.stageProb[i]) < 0) { s = i; break; } }
    return model.stageBaseS[s] + lognormalMs(rng, model.answerS, 0.3);
  }
  return lognormalMs(rng, model.cycleMean, 0.35);
}

function simRun(model, diff, rng) {
  let t = 0, words = 0, wins = 0, xp = 0, comboStreak = 0;
  const pw = perWordWins(model.mode, diff);
  const xpMult = XP_MULT[model.xpMode];
  while (t < WINDOW_S) {
    // A rejected attempt costs ~half a cycle and (Chain/Fuse) breaks the combo.
    if (rng() < model.rejectP) {
      t += cycleTime(model, rng) * 0.5;
      if (model.combo) comboStreak = 0;
      continue;
    }
    const c = cycleTime(model, rng);
    t += c; if (t > WINDOW_S) break;
    const { len, rarity } = drawWord(model, rng);
    const comboMult = model.combo ? Math.min(COMBO_MAX, 1 + COMBO_STEP * comboStreak) : 1;
    const luckyMult = model.lucky && rng() < 1 / LUCKY_ODDS ? LUCKY_MULT : 1;
    const weight = cappedWordMult(rarity, comboMult, luckyMult);
    wins += round10(weight * pw);
    xp += round10(KEYTIER0_XP * len * xpMult * weight * 1) * 1; // mastery M1 = ×1
    words += 1;
    if (model.combo) comboStreak += 1;
  }
  return { words, wins, xp };
}

function simulate(name, model, diff, N = 1000, seed = 12345) {
  const rng = mulberry32(seed + name.length * 7 + (diff ? diff.length : 0) * 13);
  let W = 0, X = 0, M = 0;
  for (let i = 0; i < N; i++) { const r = simRun(model, diff, rng); W += r.wins; X += r.xp; M += r.words; }
  const perMin = (x) => x / N / (WINDOW_S / 60);
  return { winsMin: perMin(W), xpMin: perMin(X), masteryMin: perMin(M) };
}

// ---------- Run the matrix ----------
const rows = [];
for (const [name, model] of Object.entries(MODELS)) {
  const diffs = model.hasDifficulty ? ['chill', 'easy', 'medium', 'hard'] : [null];
  for (const d of diffs) {
    const r = simulate(name, model, d);
    rows.push({ mode: name, diff: d || '—', ...r });
  }
}

console.log('\n=== PER MODE / DIFFICULTY (1,000 runs, 3-min window, R0/T0 baseline) ===');
console.log('mode'.padEnd(16), 'diff'.padEnd(8), 'wins/min'.padStart(10), 'XP/min'.padStart(10), 'mastery/min'.padStart(12));
for (const r of rows) console.log(
  r.mode.padEnd(16), r.diff.padEnd(8),
  Math.round(r.winsMin).toLocaleString().padStart(10),
  Math.round(r.xpMin).toLocaleString().padStart(10),
  r.masteryMin.toFixed(1).padStart(12));

// Dominance per axis (best difficulty per mode)
function bestPerMode(axis) {
  const best = {};
  for (const r of rows) { if (!best[r.mode] || r[axis] > best[r.mode][axis]) best[r.mode] = r; }
  return Object.values(best).sort((a, b) => b[axis] - a[axis]);
}
for (const axis of ['winsMin', 'xpMin', 'masteryMin']) {
  const s = bestPerMode(axis);
  console.log(`\n--- ${axis} ranking (best difficulty per mode) ---`);
  s.forEach((r, i) => console.log(`${i + 1}. ${r.mode} (${r.diff})  ${Math.round(r[axis]).toLocaleString()}`));
  console.log(`   DOMINANCE: ${s[0].mode} beats runner-up ${s[1].mode} by ${(s[0][axis] / s[1][axis]).toFixed(2)}x`);
}

// ---------- Degenerate strategies (wins/min inflation vs natural, same mode) ----------
console.log('\n=== DEGENERATE STRATEGIES ===');
function degen(label, base, overrides) {
  const model = { ...MODELS[base], ...overrides };
  const diff = MODELS[base].hasDifficulty ? 'medium' : null;
  const nat = simulate(base + 'NAT', MODELS[base], diff);
  const deg = simulate(base + 'DEG', model, diff);
  console.log(`${label}`);
  console.log(`   natural : wins/min ${Math.round(nat.winsMin).toLocaleString()}  mastery/min ${nat.masteryMin.toFixed(1)}`);
  console.log(`   degen   : wins/min ${Math.round(deg.winsMin).toLocaleString()}  mastery/min ${deg.masteryMin.toFixed(1)}`);
  console.log(`   inflation: wins ${(deg.winsMin / nat.winsMin).toFixed(2)}x  mastery ${(deg.masteryMin / nat.masteryMin).toFixed(2)}x`);
}
// 1a. Shortest-word spam, COMMON 3-letter (cat/its): len3, faster cycle, rarity ~1.
degen('1a. Fuse shortest-word spam (COMMON 3-letter, cycle 3.2s)', 'fuse',
  { cycleMean: 3.2, pool: recall.slice(0, 3000).filter(w => w.length === 3) });
// 1b. Shortest-word spam, OBSCURE 3-letter accept words (×4 rarity, memorised 122-word bank).
degen('1b. Fuse OBSCURE-3-letter spam (×4 rarity, memorised, cycle 3.2s)', 'fuse',
  { cycleMean: 3.2, pool: obscure3 });
// 2. Rarity maximiser: long OBSCURE words (×4.5) — slower to type but max weight.
degen('2. Fuse rarity-maximiser (long OBSCURE ×4.5, cycle 6.5s)', 'fuse',
  { cycleMean: 6.5, pool: obscureLong });
// 3. Category farming: memorised big list, rapid submit.
degen('3. Blitz category-farming (memorised list, cycle 2.5s)', 'category-blitz',
  { cycleMean: 2.5, rejectP: 0.03 });
// 4. SAT banked answers: always answer stage0 (ante irrelevant to wins) → faster cycle only.
degen('4. SAT banked/briefing (always stage0, cycle 4.0s)', 'sat-rush',
  { stageProb: [1, 0, 0, 0], answerS: 4.0 });

console.log('\n(Assumptions & caveats documented in claude/mode-balance.md)');
