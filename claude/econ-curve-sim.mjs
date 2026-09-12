// econ-curve-sim.mjs — the Economy v7 curve refit, simulated before it ships.
//
// WHY. v6's level curve was 1.25^n to level 60 and then FLATTENED to a 1.08 tail forever, so
// per-level cost growth FELL from +25% to +8% while income kept compounding (Key Power ×2.5 a
// tier, rebirth, momentum, mastery). The late game therefore got EASIER per level and the scale
// effectively stopped around 60-80. v7 replaces it with a shape that only ever steepens, raises
// the per-word wins base and makes that base grow with level, and turns rebirth + the cosmetic
// prices into clean exponentials.
//
// This file is the evidence for those numbers. It imports the LIVE shipped modules - no
// reimplemented constants - simulates a 200-hour player word by word, and reports:
//   - the need() table at 1 / 25 / 50 / 100 / 150 / 200 / 300 / 500
//   - the rebirth ladder at R1 / R3 / R5 / R10 / R20
//   - the cosmetic price ladders
//   - time to LV 50 / 100 / 200 / 300 and the wins/min at each
//   - each mode's wins/min under an IDENTICAL player state, and the spread between them
//
// Run: node claude/econ-curve-sim.mjs [rebirthCap=10]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  need, keyTierXp, keyTierCostAt, rebirthMult, rebirthThreshold, round10,
  CURVE_BASE, CURVE_BREAK, EARLY_CURVE_EXP, TOP_CURVE_EXP, REBIRTH_MULT_BASE,
  NEED_REBIRTH_BASE,
} from '../src/progress/xp.js';
import {
  WORD_WINS_BASE, WINS_MULT, WIN_LEVEL_STEP, winLevelMult,
} from '../src/progress/wins.js';
import { momentumCost, momentumMult, MOMENTUM_MAX } from '../src/progress/momentum.js';
// WORD SENSE WAS DELETED (ec8e8db, feat/cut-secrets-rarity) and this file broke with it —
// `Cannot find module .../wordSense.js`, so the economy's own evidence stopped running and
// nobody could re-derive the numbers the curve was tuned on. The upgrade bought a multiplier
// on a word's rarity EXCESS; with it gone that term is identically 1, which is what these
// stubs are. They are deliberately NOT a re-implementation: they say "this factor no longer
// exists", and the buy-loop branch that spent wins on it is removed below.
const wordSenseFactor = () => 1;
const wordSenseCost = () => Infinity;
import { masteryNeed, MASTERY_MAX, MASTERY_XP_STEP } from '../src/progress/mastery.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { streakMultiplier } from '../src/progress/streak.js';
import { POP_STYLES, SOUND_PACKS } from '../src/progress/shop.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);

const PLAY_MIN = 200 * 60;
// THE POSITIONAL ARG AND THE FLAGS CLASHED, SILENTLY. This read process.argv[2] directly,
// so ANY flag run — `--early=1.25`, `--top=1.08`, the v6 comparison this file documents —
// put "--early=1.25" through Number(), got NaN, and then `rc < NaN` is false, so the
// prestige loop never fired. Every sweep ever run through this file ran with REBIRTH
// TURNED OFF and reported it as R 0 in a column nobody was reading. Take the first
// NON-FLAG argument instead.
const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
const REBIRTH_CAP = positional != null && positional !== '' ? Number(positional) : 10;

// ---- CURVE SWEEP HOOK -------------------------------------------------------------------
// `--early=` / `--top=` / `--break=` let this file try a curve WITHOUT editing the shipped
// constants, which is how the v7 exponents were chosen (and how v6 is re-run for comparison:
// `--early=1.25 --top=1.08 --break=60`). With no flags it uses the LIVE constants and asserts
// its own need() is byte-identical to the shipped one - so a sweep can never quietly diverge
// from what actually ships.
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? Number(hit.slice(k.length + 3)) : d;
};
const BASE = arg('base', CURVE_BASE);
const EARLY = arg('early', EARLY_CURVE_EXP);
const TOP = arg('top', TOP_CURVE_EXP);
const BREAK = arg('break', CURVE_BREAK);
const SWEEPING = BASE !== CURVE_BASE || EARLY !== EARLY_CURVE_EXP || TOP !== TOP_CURVE_EXP || BREAK !== CURVE_BREAK;
// THE REBIRTH TERM IS PART OF THE CURVE NOW and the sim has to carry it, or this file
// keeps reporting the pre-fix ladder while claiming to mirror the shipped one. `--needreb=`
// sweeps it the same way --early/--top sweep the exponents; with no flag it is the shipped
// constant, and the identity check below runs at rc=0 AND at rc=10 so a divergence in the
// rebirth term cannot hide behind an rc=0-only assertion (it did, for one run of this file).
const NEEDREB = arg('needreb', NEED_REBIRTH_BASE);
const SWEEPING_REB = NEEDREB !== NEED_REBIRTH_BASE;
function needOf(n, rc = 0) {
  const raw = n <= BREAK
    ? round10(BASE * Math.pow(EARLY, n))
    : round10(round10(BASE * Math.pow(EARLY, BREAK)) * Math.pow(TOP, n - BREAK));
  return rc > 0 ? round10(raw * Math.pow(NEEDREB, rc)) : raw;
}
if (!SWEEPING && !SWEEPING_REB) {
  for (const rc of [0, 3, 10]) {
    for (const n of [1, 7, 60, 100, 101, 250]) {
      if (needOf(n, rc) !== need(n, rc)) {
        throw new Error(`sim need(${n}, R${rc})=${needOf(n, rc)} != shipped ${need(n, rc)}`);
      }
    }
  }
}
const XP_MULT = { 'word-bomb': 2, 'category-blitz': 2, 'sat-rush': 3, chain: 4, fuse: 5 };
const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5; // 1.1
// Words/min per mode — the same throughput model winsmin-sim and econ200h-audit use.
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: 20 };
const XPID = { wordBomb: 'word-bomb', blitz: 'category-blitz', satRush: 'sat-rush', chain: 'chain', fuse: 'fuse' };
const MODES = ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];

const COSMETIC_PRICES = [...POP_STYLES, ...SOUND_PACKS].map((i) => i.price).filter((p) => p > 0).sort((a, b) => a - b);

// A frequency-weighted typist word stream (full recall tail, so RARE/OBSCURE appear at their real
// rate); SAT draws its forced deck.
function freqPicker(seed, { minLen = 3 } = {}) {
  const rng = mulberry32(seed);
  const pool = []; const weights = []; let acc = 0;
  for (let i = 0; i < recall.length; i++) {
    const w = recall[i];
    if (w.length < minLen) continue;
    acc += 1 / (i + 50); pool.push(w); weights.push(acc);
  }
  const total = acc;
  return () => {
    const r = rng() * total; let lo = 0, hi = weights.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (weights[mid] < r) lo = mid + 1; else hi = mid; }
    return pool[lo];
  };
}
function satPicker(seed) { const rng = mulberry32(seed); return () => satDeck[Math.floor(rng() * satDeck.length)]; }
const makePicker = (mode, seed) => (mode === 'satRush' ? satPicker(seed) : freqPicker(seed));

const fmt = (x) => (Math.abs(x) >= 1e7 ? x.toExponential(3) : Math.round(x).toLocaleString('en-US'));
const hrs = (min) => (min == null ? 'never' : `${(min / 60).toFixed(1)}h`);

// ---------------------------------------------------------------- the 200h run
function simulate(archMode, seed) {
  const pick = makePicker(archMode, seed);
  const wordsPerMin = THROUGHPUT[archMode];
  const totalWords = Math.floor(wordsPerMin * PLAY_MIN);
  const modeMultW = WINS_MULT[archMode] || 1;
  const xpModeMult = XP_MULT[XPID[archMode]] || 1;

  let wins = 0, lifetime = 0, kt = 0, ws = 0, mom = 0, cosmeticI = 0;
  let level = 1, into = 0, rc = 0;
  let masteryWords = 0, masteryLevel = 1;
  let comboStreak = 0, streakDay = 0, lastDayMark = 0;
  const rng2 = mulberry32(seed ^ 0x9e3779b9);

  // MILESTONES ARE MEASURED ON THE FINAL CLIMB. A prestige loop resets the level bar, so the
  // FIRST time a player touches LV100 is meaningless - it happens minutes in, on a bar they are
  // about to wipe for a ×3. What a player means by "I am level 200" is the climb they keep: the
  // one after their last rebirth. `marks` therefore records the time each level was reached on
  // the CURRENT climb, and is CLEARED on every rebirth; whatever is in it at hour 200 is the
  // real answer. `firstTouch` keeps the naive number alongside it, because the gap between the
  // two is itself the interesting finding.
  let marks = { 50: null, 100: null, 200: null, 300: null };
  const firstTouch = { 50: null, 100: null, 200: null, 300: null };
  let deepest = 1;
  const winsAtMark = {};
  let winsWindow = 0, windowStart = 0; // rolling wins/min

  for (let i = 0; i < totalWords; i++) {
    const t = i / wordsPerMin;
    if (t - lastDayMark >= 100) { streakDay += 1; lastDayMark = t; }
    const streakMult = streakMultiplier(streakDay);

    const word = pick();
    const rr = wordRarity(word, idx);
    comboStreak += 1;
    if (rng2() < 1 / 15) comboStreak = 0;
    const weight = Math.min(40, rr.mult * comboMultiplier(comboStreak) * LUCKY_MEAN);

    // WINS (live formula, including the new level term).
    const wsFactor = 1 + Math.max(0, rr.mult - 1) * (wordSenseFactor(ws) - 1);
    const perWord = round10(
      WORD_WINS_BASE * modeMultW * rebirthMult(rc) * momentumMult(mom) * winLevelMult(level)
    );
    const gainWins = round10(weight * perWord * wsFactor);
    wins += gainWins; lifetime += gainWins; winsWindow += gainWins;

    // XP.
    const masteryMult = 1 + MASTERY_XP_STEP * (masteryLevel - 1);
    const gainXp = round10(
      round10(keyTierXp(kt) * word.length * xpModeMult * rebirthMult(rc) * weight * streakMult) * masteryMult
    );
    into += gainXp;
    while (into >= needOf(level, rc)) {
      into -= needOf(level, rc); level += 1;
      deepest = Math.max(deepest, level);
      for (const m of [50, 100, 200, 300]) {
        if (firstTouch[m] == null && level >= m) firstTouch[m] = t;
        if (marks[m] == null && level >= m) {
          marks[m] = t;
          winsAtMark[m] = (t - windowStart) > 0 ? winsWindow / (t - windowStart) : 0;
        }
      }
      if ((t - windowStart) > 10) { winsWindow = 0; windowStart = t; }
    }

    masteryWords += 1;
    if (masteryLevel < MASTERY_MAX && masteryWords >= masteryNeed(masteryLevel)) {
      masteryWords -= masteryNeed(masteryLevel); masteryLevel += 1;
    }

    if (level >= rebirthThreshold(rc) && rc < REBIRTH_CAP) {
      rc += 1; level = 1; into = 0;
      marks = { 50: null, 100: null, 200: null, 300: null }; // the climb restarts with the bar
    }

    // Greedy purchasing: always take the cheapest affordable sink.
    let bought = true;
    while (bought) {
      bought = false;
      const nextKey = kt < 25 ? keyTierCostAt(kt + 1) : Infinity;
      const nextWs = ws < 25 ? wordSenseCost(ws) : Infinity;
      const nextMom = mom < MOMENTUM_MAX ? momentumCost(mom) : Infinity;
      const nextCos = cosmeticI < COSMETIC_PRICES.length ? COSMETIC_PRICES[cosmeticI] : Infinity;
      const cheapest = Math.min(nextKey, nextWs, nextMom, nextCos);
      if (!Number.isFinite(cheapest) || wins < cheapest) break;
      if (nextMom === cheapest) { wins -= nextMom; mom += 1; bought = true; }
      else if (nextCos === cheapest) { wins -= nextCos; cosmeticI += 1; bought = true; }
      else if (nextKey === cheapest) { wins -= nextKey; kt += 1; bought = true; }
      else { wins -= nextWs; ws += 1; bought = true; }
    }
  }
  return { marks, firstTouch, winsAtMark, deepest, level, rc, kt, ws, mom, lifetime, winsPerMin: lifetime / PLAY_MIN };
}

// ------------------------------------------------ per-mode wins/min at one fixed player state
// The cross-mode fairness question is "does mode CHOICE decide how fast you earn", so every mode
// is measured at the SAME level / rebirth / tier - only its own throughput and rarity profile
// differ. Anything else compares players, not modes.
function winsPerMinAt({ level, rc, mom, ws }) {
  const out = {};
  for (const mode of MODES) {
    const pick = makePicker(mode, 12345);
    const rng = mulberry32(999);
    const wpm = THROUGHPUT[mode];
    const N = 20000;
    let total = 0, combo = 0;
    for (let i = 0; i < N; i++) {
      const word = pick();
      const rr = wordRarity(word, idx);
      combo += 1;
      if (rng() < 1 / 15) combo = 0;
      const weight = Math.min(40, rr.mult * comboMultiplier(combo) * LUCKY_MEAN);
      const wsFactor = 1 + Math.max(0, rr.mult - 1) * (wordSenseFactor(ws) - 1);
      const perWord = round10(
        WORD_WINS_BASE * (WINS_MULT[mode] || 1) * rebirthMult(rc) * momentumMult(mom) * winLevelMult(level)
      );
      total += round10(weight * perWord * wsFactor);
    }
    out[mode] = (total / N) * wpm;
  }
  return out;
}

// ================================================================= report
console.log('=== ECONOMY v7 — CURVE REFIT, SIMULATED ===\n');

console.log(`CURVE: need(n) = ${BASE} · ${EARLY}^n up to LV${BREAK}, then × ${TOP}^(n-${BREAK}).` + (SWEEPING ? '   [SWEEP — not the shipped constants]' : ''));
console.log(`       The tail is STEEPER than the head (${TOP_CURVE_EXP} > ${EARLY_CURVE_EXP}). v6 went the other way: 1.25 -> 1.08.\n`);
{
  let cum = 0; const cums = { 1: 0 };
  for (let n = 1; n <= 500; n++) { cum += needOf(n); cums[n + 1] = cum; }
  console.log('  LEVEL        need(n)        cumulative to reach     per-level growth');
  let prev = null;
  for (const n of [1, 25, 50, 100, 150, 200, 300, 500]) {
    const g = prev == null ? '' : `×${Math.pow(needOf(n) / needOf(prev), 1 / (n - prev)).toFixed(4)}/lvl`;
    console.log(`  ${String(n).padStart(5)}  ${fmt(needOf(n)).padStart(14)}  ${fmt(cums[n]).padStart(22)}   ${g}`);
    prev = n;
  }
}

console.log(`\nREBIRTH: mult = ${REBIRTH_MULT_BASE}^rebirths (v6 was a flat table: R1 ×1.5 … R10 ×10).`);
console.log('  ' + [1, 3, 5, 10, 20].map((r) => `R${r} ×${fmt(rebirthMult(r))}`).join('   '));
console.log('  gate levels: ' + [1, 3, 5, 10, 20].map((r) => `R${r}@LV${rebirthThreshold(r - 1)}`).join('  '));

console.log(`\nPER-WORD WINS BASE: ${WORD_WINS_BASE} (v6: 20), × ${WIN_LEVEL_STEP}^(level-1).`);
console.log('  level term: ' + [1, 50, 100, 200, 300].map((l) => `LV${l} ×${winLevelMult(l).toFixed(2)}`).join('   '));
console.log('  WORD BOMB per-word at R0/×1 difficulty: ' +
  [1, 50, 100, 200, 300].map((l) => `LV${l} ${fmt(round10(WORD_WINS_BASE * WINS_MULT.wordBomb * winLevelMult(l)))}`).join('  '));

console.log('\nCOSMETIC LADDERS (exponential, ×5 a rung — v6 was 150/400/900/2000, near-linear):');
console.log('  POP   ' + POP_STYLES.filter((i) => i.price > 0).map((i) => `${i.name} ${fmt(i.price)}`).join('  →  '));
console.log('  SOUND ' + SOUND_PACKS.filter((i) => i.price > 0).map((i) => `${i.name} ${fmt(i.price)}`).join('  →  '));

console.log('\n=== 200-HOUR RUN (one archetype per mode, greedy upgrade buying) ===');
console.log(`rebirth cap R${REBIRTH_CAP}. "deepest LV" is the level ladder ignoring rebirth resets.\n`);
console.log('  Times are on the FINAL climb (the bar the player keeps). "1st" = the first time the');
console.log('  level was ever touched, mid-rebirth-cascade, which is the number that looks absurd.');
console.log('');
console.log('  MODE        LV50     LV100    LV200    LV300    deepest  R   keyT  wins/min');
const runs = {};
for (const m of MODES) {
  const r = simulate(m, 0xC0FFEE ^ m.length);
  runs[m] = r;
  console.log(
    `  ${m.padEnd(10)}  ${hrs(r.marks[50]).padStart(7)}  ${hrs(r.marks[100]).padStart(7)}  ` +
    `${hrs(r.marks[200]).padStart(7)}  ${hrs(r.marks[300]).padStart(7)}  ` +
    `${String(r.deepest).padStart(7)}  ${String(r.rc).padStart(2)}  ${String(r.kt).padStart(4)}  ${fmt(r.winsPerMin).padStart(9)}`
  );
}
console.log('');
console.log('  first touch (any climb):');
for (const m of MODES) {
  const r = runs[m];
  console.log(`  ${m.padEnd(10)}  ` + [50, 100, 200, 300].map((L) => hrs(r.firstTouch[L]).padStart(7)).join('  '));
}
console.log('');
console.log('  wins/min measured over the 10 minutes before each FINAL-climb milestone:');
for (const m of MODES) {
  const r = runs[m];
  console.log(`  ${m.padEnd(10)}  ` + [50, 100, 200, 300]
    .map((L) => (r.winsAtMark[L] == null ? '      -' : fmt(r.winsAtMark[L]).padStart(11))).join('  '));
}

console.log('\n=== WINS/MIN BY MODE AT ONE FIXED PLAYER STATE (mode choice must not be a grind decision) ===');
for (const state of [
  { label: 'LV1  R0  mom0 ws0', level: 1, rc: 0, mom: 0, ws: 0 },
  { label: 'LV50 R1  mom50 ws3', level: 50, rc: 1, mom: 50, ws: 3 },
  { label: 'LV100 R3 mom200 ws6', level: 100, rc: 3, mom: 200, ws: 6 },
  { label: 'LV200 R5 mom200 ws9', level: 200, rc: 5, mom: 200, ws: 9 },
]) {
  const w = winsPerMinAt(state);
  const vals = MODES.map((m) => w[m]);
  const spread = Math.max(...vals) / Math.min(...vals);
  console.log(`  ${state.label.padEnd(20)} ` + MODES.map((m) => `${m}=${fmt(w[m])}`).join('  ') +
    `   SPREAD ${spread.toFixed(2)}×  ${spread <= 2 ? 'OK' : 'OVER 2× — FAIL'}`);
}
console.log('\nPASS CONDITIONS: the per-level growth column never falls; LV300 is reached by at least');
console.log('one archetype inside 200h but not by hour ~20; no mode spread above 2.00×.');
