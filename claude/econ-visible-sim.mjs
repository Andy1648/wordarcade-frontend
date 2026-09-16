// econ-visible-sim.mjs — ITEMS 4 AND 5 OF THE econ-visible BRIEF, SIMULATED BEFORE ANYTHING SHIPS.
//
// ANDY:
//   item 4  "SAT RUSH should reach ~80/word (it's far under Blitz today)" and CHAIN + FUSE
//           "MUCH higher — it feels impossible to get more than 10k".
//   item 5  "Stuck at lvl 40", said more than once.
//
// WHAT THIS PRINTS
//   A. The per-word rate a MODE CARD shows today vs proposed — the number Andy reads.
//   B. wins/RUN and wins/MIN per mode at WEAK / MEDIAN / STRONG play, before and after, with the
//      cross-mode spread (must stay under 2.00x).
//   C. The level table at LV1/20/40/60/100/150/200/300: xp needed, wins/word at that level, and
//      TIME TO NEXT LEVEL at median play — before and after.
//   D. The pass conditions, EVALUATED, with a non-zero exit. (The other econ sim in this repo
//      printed its conditions as prose and checked none, which is how a failing one survived a
//      whole run. Not repeating that.)
//
// It imports the LIVE modules for the "before" column — no re-implemented constants — and applies
// the proposed numbers as overrides, so "after" is a sweep of the same code, not a parallel model.
//
// Run: node claude/econ-visible-sim.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORD_WINS_BASE, WINS_MULT, WIN_LEVEL_STEP, winLevelMult } from '../src/progress/wins.js';
import { need, round10, XP_MULTIPLIERS, keyTierXp, keyTierCostAt, EARLY_CURVE_EXP } from '../src/progress/xp.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
const satDeck = (() => {
  try {
    return JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);
  } catch {
    return null;
  }
})();

const MODES = ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];

// Words/min per mode — the same explicit model winsmin-sim.mjs documents and derives.
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: 20 };

// WORDS PER RUN, per mode, at three qualities of play. This is the axis item 4 is actually about:
// "impossible to get more than 10k" is a statement about a RUN, not a minute. Word Bomb / Blitz are
// multiplayer rounds (bounded by the round, not by skill); the solo modes end when you die, so
// skill moves the length a lot.
const WORDS_PER_RUN = {
  wordBomb: { weak: 4, median: 10, strong: 22 },
  blitz: { weak: 6, median: 14, strong: 30 },
  satRush: { weak: 5, median: 14, strong: 32 },
  chain: { weak: 6, median: 18, strong: 45 },
  fuse: { weak: 8, median: 24, strong: 60 },
};

const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5; // 1.1
// One run length for the cross-mode wins/min comparison -- see the note at row.perMin.
const COMMON_RUN = 20;
const WEIGHT_CAP = 40;

// A frequency-weighted picker — common words are common. SAT Rush draws its OWN deck when present:
// feeding it the recall list understates its rarity badly (a previous sim did exactly that and
// reported a fake 3.67x spread).
function picker(mode, seed) {
  const rng = mulberry32(seed);
  if (mode === 'satRush' && satDeck && satDeck.length) {
    return () => satDeck[Math.floor(rng() * satDeck.length)];
  }
  return () => recall[Math.min(recall.length - 1, Math.floor((rng() ** 2.2) * recall.length))];
}

/** Mean reward weight (rarity x combo x lucky, capped) over a run of `words` accepted words. */
function meanWeight(mode, words, seed = 4242) {
  const pick = picker(mode, seed);
  const N = Math.max(400, words * 40);
  let total = 0;
  let combo = 0;
  for (let i = 0; i < N; i++) {
    // Reset the combo at the run boundary so a long run's tail does not leak into a short one.
    if (i % words === 0) combo = 0;
    combo += 1;
    const rr = wordRarity(pick(), idx);
    total += Math.min(WEIGHT_CAP, rr.mult * comboMultiplier(combo) * LUCKY_MEAN);
  }
  return total / N;
}

/** Wins for one word, given the mode multiplier table and the player's level. */
function perWord(mults, mode, level) {
  return round10(WORD_WINS_BASE * (mults[mode] || 1) * winLevelMult(level));
}

const fmt = (n) => (Math.abs(n) >= 1e6 ? n.toExponential(2) : Math.round(n).toLocaleString('en-US'));
const pad = (s, n) => String(s).padStart(n);

// ---------------------------------------------------------------- THE PROPOSAL
//
// item 4. Andy's two asks, turned into numbers:
//   - SAT RUSH to ~80/word on the card. The card rate is WORD_WINS_BASE x modeMult, so 0.5 -> 0.8
//     puts it at 80 exactly, and stops it being HALF of Blitz for the mode with the hardest words.
//   - CHAIN and FUSE "much higher". FUSE is the outlier: x1.0, the same as Blitz, for a mode whose
//     runs are the longest and whose words are the most constrained. CHAIN is already x1.9.
// The constraint is the 2.00x cross-mode spread on wins/MIN — raising a per-word rate on a
// high-throughput mode moves wins/min fast, which is why fuse cannot simply be doubled.
const PROPOSED = { wordBomb: 2, blitz: 1.2, satRush: 0.8, chain: 1.9, fuse: 1.35 };

// THE BASELINE IS PINNED, NOT READ LIVE. Once the re-fit SHIPPED, WINS_MULT became the proposal —
// so a sim that read it live compared the new numbers to themselves and reported "no change",
// which is worse than useless: it is a before/after table that silently stops being one. These are
// the pre-re-fit constants as literals, so this file keeps showing what actually moved.
const BEFORE_MULT = { wordBomb: 2, blitz: 1, satRush: 0.5, chain: 1.9, fuse: 1 };
const BEFORE_CURVE = 1.115;
const BEFORE_WINSTEP = 1.015;

console.log('\n================ A. THE NUMBER ON THE MODE CARD (per word, R0, LV1) ================');
console.log('This is what a player reads before choosing a mode.\n');
console.log('  mode       before      after   change');
for (const m of MODES) {
  const a = round10(WORD_WINS_BASE * BEFORE_MULT[m]);
  const b = round10(WORD_WINS_BASE * PROPOSED[m]);
  console.log(`  ${m.padEnd(10)}${pad(a, 6)}${pad(b, 11)}   ${b === a ? '—' : `${b > a ? '+' : ''}${Math.round(((b / a) - 1) * 100)}%`}`);
}

console.log('\n================ B. WINS PER RUN AND PER MINUTE, BY PLAY QUALITY ================');
const QUALITIES = ['weak', 'median', 'strong'];
const results = {};
for (const [label, mults] of [['BEFORE', BEFORE_MULT], ['AFTER (shipped)', PROPOSED]]) {
  console.log(`\n--- ${label} ---`);
  console.log('  mode        weak/run   median/run   strong/run    median wins/min');
  results[label] = {};
  for (const m of MODES) {
    const row = {};
    for (const q of QUALITIES) {
      const words = WORDS_PER_RUN[m][q];
      const w = meanWeight(m, words);
      row[q] = words * w * perWord(mults, m, 1);
    }
    // wins/MIN USES A COMMON RUN LENGTH FOR EVERY MODE. Using each mode's own median run here
    // confounded the invariant with the run-length ASSUMPTION: longer runs carry higher combo
    // multipliers, so CHAIN/FUSE read as richer per minute partly because I had assumed they run
    // longer. That is an assumption, not a measurement, and it made the LIVE economy report 2.12x
    // when winsmin-sim.mjs -- the established model, which does not bake in run length -- measures
    // 1.54x. The spread invariant is about MODE and RARITY, so both columns use COMMON_RUN.
    row.perMin = THROUGHPUT[m] * meanWeight(m, COMMON_RUN) * perWord(mults, m, 1);
    results[label][m] = row;
    console.log(
      `  ${m.padEnd(10)}${pad(fmt(row.weak), 9)}${pad(fmt(row.median), 13)}${pad(fmt(row.strong), 13)}${pad(fmt(row.perMin), 19)}`,
    );
  }
  const mins = MODES.map((m) => results[label][m].perMin);
  const spread = Math.max(...mins) / Math.min(...mins);
  results[label].spread = spread;
  console.log(`  SPREAD (wins/min): ${spread.toFixed(2)}x  ${spread <= 2 ? 'OK' : 'OVER 2.00x'}`);
}

console.log('\n  "IT FEELS IMPOSSIBLE TO GET MORE THAN 10K" — a STRONG run, which is the run a player');
console.log('  remembers, at LV1. (The level term multiplies all of these as the player climbs.)');
console.log('  mode         before        after');
for (const m of MODES) {
  console.log(`  ${m.padEnd(12)}${pad(fmt(results.BEFORE[m].strong), 8)}${pad(fmt(results['AFTER (shipped)'][m].strong), 13)}`);
}

// ---------------------------------------------------------------- C. THE LEVEL LADDER
//
// item 5, "stuck at lvl 40". SIMULATED, not computed from a formula. The first cut of this section
// used a closed form with `tierAt(lv) = min(8, lv/12)` — a guess at which Key Power tier a player
// holds — and that cap alone produced "LV150 takes 241 hours", which is an artifact of the guess,
// not a fact about the game (keyTierXp keeps growing x2.5 per tier forever; what actually limits a
// player is whether they can AFFORD the next one, since cost grows x6 per tier against xp's x2.5).
//
// So this plays a real player: every minute they type THROUGHPUT words, each word earns wins and
// XP through the live formulas, they greedily buy the cheapest Key Power tier they can afford, and
// we record the wall-clock minute each level lands on. That makes "time to next level" a measured
// quantity.
//
// THE STRUCTURAL NUMBER, and it is the whole of item 5: a level costs EARLY_CURVE_EXP (1.115) more
// than the one before it, while a word pays WIN_LEVEL_STEP (1.015) more. Income growth is seven
// times slower than cost growth, so each level takes ~9.8% longer than the last, compounding —
// 1.115/1.015 = 1.0985. Twenty levels of that is 6.5x; forty is 43x. Key Power is the only thing
// pushing back, and it arrives in lumps you have to afford.
console.log('\n================ C. THE LEVEL LADDER — SIMULATED AT MEDIAN PLAY ================');
console.log(`  cost growth/level ${EARLY_CURVE_EXP}  ·  income growth/level ${WIN_LEVEL_STEP}`);
console.log(`  => each level is ${((EARLY_CURVE_EXP / WIN_LEVEL_STEP - 1) * 100).toFixed(1)}% longer than the last before Key Power pushes back\n`);

const hrs = (m) => (m == null ? 'never' : m >= 60 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`);
const XP_MODE = 'word-bomb';
function climb({ curveExp, winStep, maxMin = 200 * 60 }) {
  const wpm = THROUGHPUT.wordBomb;
  const weight = meanWeight('wordBomb', WORDS_PER_RUN.wordBomb.median);
  const needOf = (n) => (curveExp == null
    ? need(n)
    : round10(2000 * Math.pow(curveExp, Math.min(n, 100)) * (n > 100 ? Math.pow(1.135, n - 100) : 1)));
  const lvlMult = (lv) => Math.pow(winStep == null ? WIN_LEVEL_STEP : winStep, Math.max(0, lv - 1));

  let level = 1, into = 0, wins = 0, tier = 0, minute = 0;
  const reached = { 1: 0 };
  while (minute < maxMin && level < 320) {
    minute += 1;
    for (let k = 0; k < wpm; k++) {
      wins += round10(WORD_WINS_BASE * WINS_MULT.wordBomb * lvlMult(level) * weight);
      into += round10(keyTierXp(tier) * 6 * (XP_MULTIPLIERS[XP_MODE] || 1) * weight);
      while (into >= needOf(level)) {
        into -= needOf(level);
        level += 1;
        if (reached[level] == null) reached[level] = minute;
      }
    }
    // greedy: buy the next Key Power tier the moment it is affordable
    for (;;) {
      const cost = keyTierCostAt(tier + 1);
      if (!Number.isFinite(cost) || wins < cost) break;
      wins -= cost; tier += 1;
    }
  }
  return { reached, level, tier };
}

function ladderTable(label, opts) {
  const r = climb(opts);
  console.log(`--- ${label} ---`);
  console.log('  LV     xp needed     wins/word    reached at   time from prev   x prev');
  const step = opts.winStep == null ? WIN_LEVEL_STEP : opts.winStep;
  let prevGap = null;
  for (const lv of [1, 20, 40, 60, 100, 150, 200, 300]) {
    const at = r.reached[lv];
    const prevLv = [1, 20, 40, 60, 100, 150, 200, 300][[1, 20, 40, 60, 100, 150, 200, 300].indexOf(lv) - 1];
    const prevAt = prevLv == null ? null : r.reached[prevLv];
    const gap = at != null && prevAt != null ? at - prevAt : null;
    const ratio = gap != null && prevGap ? gap / prevGap : null;
    console.log(
      `  ${pad(lv, 4)}${pad(fmt(need(lv)), 14)}${pad(fmt(round10(WORD_WINS_BASE * WINS_MULT.wordBomb * Math.pow(step, lv - 1))), 13)}`
      + `${pad(at == null ? 'never' : hrs(at), 14)}${pad(gap == null ? '—' : hrs(gap), 17)}${pad(ratio == null ? '—' : `${ratio.toFixed(1)}x`, 8)}`,
    );
    if (gap != null) prevGap = gap;
  }
  console.log(`  200h ends at LV${r.level}, Key Power T${r.tier}\n`);
  return r;
}


const todayLadder = ladderTable(`BEFORE — curve ${BEFORE_CURVE}, income ${BEFORE_WINSTEP}`, { curveExp: BEFORE_CURVE, winStep: BEFORE_WINSTEP });

// THE PROPOSAL FOR item 5. Move BOTH, as asked, and by the smallest amount that keeps levels
// arriving: income growth 1.015 -> 1.035 and cost growth 1.115 -> 1.085. That takes the per-level
// stretch from 1.0985 to 1.0483 — roughly halving the compounding — without flattening the curve
// (it still only ever steepens above the break).
const PROP_CURVE = EARLY_CURVE_EXP; // now the shipped value
const PROP_WINSTEP = WIN_LEVEL_STEP; // now the shipped value
const propLadder = ladderTable(`AFTER (shipped) — curve ${PROP_CURVE}, income ${PROP_WINSTEP}`, { curveExp: PROP_CURVE, winStep: PROP_WINSTEP });
console.log(`  per-level stretch: before ${(BEFORE_CURVE / BEFORE_WINSTEP).toFixed(4)}  ->  after ${(PROP_CURVE / PROP_WINSTEP).toFixed(4)}`);

// ---------------------------------------------------------------- D. PASS CONDITIONS
const conds = [];
conds.push({
  name: 'cross-mode wins/min spread stays under 2.00x after the re-fit',
  ok: results['AFTER (shipped)'].spread <= 2,
  detail: `${results['AFTER (shipped)'].spread.toFixed(2)}x (before ${results.BEFORE.spread.toFixed(2)}x)`,
});
conds.push({
  name: 'SAT RUSH reaches ~80 wins/word on its card',
  ok: round10(WORD_WINS_BASE * PROPOSED.satRush) >= 80,
  detail: `${round10(WORD_WINS_BASE * PROPOSED.satRush)} (was ${round10(WORD_WINS_BASE * BEFORE_MULT.satRush)})`,
});
conds.push({
  name: 'a STRONG run in CHAIN and FUSE clears 10,000',
  ok: results['AFTER (shipped)'].chain.strong >= 10000 && results['AFTER (shipped)'].fuse.strong >= 10000,
  detail: `chain ${fmt(results['AFTER (shipped)'].chain.strong)}, fuse ${fmt(results['AFTER (shipped)'].fuse.strong)}`,
});
// item 5's conditions, measured off the SIMULATED climbs rather than a formula. The first cut used
// a closed form with a guessed Key Power tier (`tierAt = min(8, lv/12)`) and reported "LV150 takes
// 241 hours" — an artifact of the guess, not a fact about the game.
function worstStretch(r) {
  const marks = [1, 20, 40, 60, 100, 150, 200, 300];
  let prevGap = null, worst = 0, at = null;
  for (let i = 1; i < marks.length; i++) {
    const a = r.reached[marks[i - 1]], b = r.reached[marks[i]];
    if (a == null || b == null) break;
    const gap = b - a;
    if (prevGap && gap / prevGap > worst) { worst = gap / prevGap; at = marks[i]; }
    prevGap = gap;
  }
  return { worst, at };
}
conds.push({
  name: 'the ladder keeps arriving - a 200h player passes LV150',
  ok: propLadder.level > 150,
  detail: `proposed reaches LV${propLadder.level} in 200h (today LV${todayLadder.level})`,
});
// LIKE FOR LIKE. Comparing each climb's WORST stretch is not a comparison: the proposed climb gets
// FURTHER, so it reaches a later and naturally steeper stretch that today's never sees, and the
// metric went "worse" while every shared stretch got better. Compare the SAME stretch instead --
// LV60 -> LV100, the one just past where Andy says he gets stuck.
function stretch(r, a, b) {
  const x = r.reached[a], y = r.reached[b];
  return x == null || y == null ? null : y - x;
}
const tA = stretch(todayLadder, 40, 60), tB = stretch(todayLadder, 60, 100);
const pA = stretch(propLadder, 40, 60), pB = stretch(propLadder, 60, 100);
const todayRatio = tA && tB ? tB / tA : null;
const propRatio = pA && pB ? pB / pA : null;
conds.push({
  name: 'the LV60->LV100 stretch grows less steeply than it did before',
  ok: propRatio != null && todayRatio != null && propRatio < todayRatio,
  detail: `LV60->100 vs LV40->60: before ${todayRatio == null ? 'n/a' : todayRatio.toFixed(1)}x -> after ${propRatio == null ? 'n/a' : propRatio.toFixed(1)}x`,
});

console.log('\n================ D. PASS CONDITIONS ================');
for (const c of conds) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}\n        ${c.detail}`);
const failed = conds.filter((c) => !c.ok);
console.log(failed.length ? `\n${failed.length} of ${conds.length} FAILED.` : `\nAll ${conds.length} pass.`);
if (failed.length) process.exitCode = 1;
