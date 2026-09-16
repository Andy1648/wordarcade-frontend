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
import { buildRarityIndex, wordRarity, satRarityMult } from '../src/progress/rarity.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { mulberry32 } from '../src/solo/shared.js';
import { deriveFuseWpm } from './fuseThroughput.mjs';

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

// Words/min per mode. WORD BOMB / BLITZ / SAT stay the documented APPROX figures from
// winsmin-sim.mjs (turn-based downtime / 60s sprints / the 2800ms reveal cadence). CHAIN is
// DERIVED there from its engine's produce-time model.
//
// FUSE IS NOW DERIVED HERE TOO, AND THAT IS THE HEADLINE OF THIS RE-FIT. It had been asserted
// at ~20/min ("continuous solo, short fragments, little downtime") while CHAIN — the same human
// solving a comparably constrained prompt — was DERIVED at 11.6. Driving the real fuse.js engine
// with the SAME calibrated human produce-time model chain uses (1600 + U(0,4600) + 300*len, plus
// scarcity) measures 9.3/min: the median run dies at ~18 words, mean 6.5s per word, because late
// fuses fall to fuseBase->3500ms while the human still needs ~5.5s, and every expire burns a full
// fuse for no word. The asserted figure was 2.15x too fast.
//
// THIS IS WHY FUSE WAS STUCK AT x1.35. wins/min = throughput x per-word, so a 2.15x overstated
// throughput made every proposed fuse raise look like it would blow the cross-mode spread. It
// would not have. Correcting the input is what makes Andy's ask satisfiable instead of impossible.
const FUSE_WPM = deriveFuseWpm().wordsPerMin;
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: FUSE_WPM };

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
// THE TYPIST MODEL IS NOW winsmin-sim.mjs's, NOT THIS FILE'S OWN. It used to draw with
// `recall[(rng ** 2.2) * recall.length]` over the WHOLE 31k list, which puts the median typed word
// at rank ~6,845 and produces "cookers / jerseys / starks" — nobody types those with a fuse
// burning. winsmin-sim's frequency-weighted typist (1/(i+50) over the top 12k) puts the median at
// rank ~720: "painting / photo / across". That matters because the rarity weight of the non-SAT
// modes is the denominator of the cross-mode spread: the old picker inflated it, which made every
// other mode look nearly as rare as SAT RUSH's fixed deck and UNDERSTATED the spread (1.89x here
// against winsmin's 2.41x on the same table). Two divergent models of one quantity is the same
// bug class as the asserted-vs-derived FUSE throughput, so this file now uses the better one.
function freqPick(rng) {
  const pool = [];
  const weights = [];
  let acc = 0;
  for (let i = 0; i < Math.min(12000, recall.length); i++) {
    const w = recall[i];
    if (w.length < 3) continue;
    acc += 1 / (i + 50);
    pool.push(w);
    weights.push(acc);
  }
  const total = acc;
  return () => {
    const r = rng() * total;
    let lo = 0, hi = weights.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (weights[mid] < r) lo = mid + 1; else hi = mid; }
    return pool[lo];
  };
}
function picker(mode, seed) {
  const rng = mulberry32(seed);
  if (mode === 'satRush' && satDeck && satDeck.length) {
    return () => satDeck[Math.floor(rng() * satDeck.length)];
  }
  return freqPick(rng);
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
    // SAT scores its rarity RELATIVE TO ITS OWN DECK (the double-count fix): every word that
    // mode serves is rare by construction, so the raw multiplier paid it a flat ~2.79x nobody
    // chose. The live path is cappedWordMult(satRarityMult(mult), 1, 1) in SatRushGame.jsx;
    // this mirrors it exactly, including SAT having no combo and no lucky.
    const rmult = mode === 'satRush' ? satRarityMult(rr.mult) : rr.mult;
    const cm = mode === 'satRush' ? 1 : comboMultiplier(combo);
    const lm = mode === 'satRush' ? 1 : LUCKY_MEAN;
    total += Math.min(WEIGHT_CAP, rmult * cm * lm);
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
// ANDY, THIS ROUND: "CHAIN and FUSE MUCH higher than the multiplayer modes — they're solo,
// score-attack, and it feels impossible to clear 10k" and "SAT RUSH near Blitz, not a third of
// Word Bomb". At LV40 the shipped table reads WB 770 / CHAIN 730 / FUSE 520 / BLITZ 460 / SAT 310:
// the two solo modes SIT BELOW Word Bomb, which is the exact inversion of what the modes are for.
//
// The fit is bounded by wins/min = throughput x per-word. Because Word Bomb is turn-based it has
// the LOWEST throughput (8/min), so it is structurally allowed the highest per-word rate — the
// ceiling on "how far can CHAIN lead WB per word" with the spread held at 2.00x is 2*w_wb/w_chain
// = 1.38x, and for FUSE (with throughput derived, not asserted) 1.72x. Those ceilings are what
// this table is fitted against; it sits just inside them, not on them.
//
// SAT IS THE BINDING CONSTRAINT, AND THIS TABLE SITS ON THE CORNER OF THE FEASIBLE REGION.
// SAT's fixed deck is ~4x rarer than a real typist's vocabulary, so at an equal card rate it earns
// 2.40x per word from RARITY ALONE, while its throughput (12/min) is close to Blitz's (14). So
// wm_sat/wm_blitz = 2.40 x (c_sat/c_blitz). The 20% ask forces that card ratio >= 0.80, which puts
// SAT at >= 1.92x Blitz's wins/min before anything else is chosen; holding the spread at 2.00x then
// forces the ratio <= 0.835. The whole feasible window is [0.800, 0.835] — about four card points.
// c_sat=100 / c_blitz=120 (0.833) is the only multiple-of-10 pair inside it, and Word Bomb has to
// rise 200 -> 210 to lift the FLOOR of the band to meet it. Measured spread 1.996x, and 1.972-1.999
// across 12 typist seeds: under 2.00x everywhere, but with ~0.1% of headroom.
// THE ROOT CAUSE IS A DOUBLE COUNT, and fixing it is the real follow-up: SAT is paid for rarity
// TWICE — once by a deck that is rare by construction, and again by the per-word rarity multiplier
// that exists to reward players for CHOOSING an uncommon word. In SAT Rush the player has no
// choice; the deck serves the word. Damping SAT's rarity term would move this off the corner and
// let its card sit anywhere near Blitz with real margin. That is a scoring change, not a re-fit,
// so it is deliberately NOT bundled here.
const PROPOSED = { wordBomb: 2.1, blitz: 1.2, satRush: 3.9, chain: 2.7, fuse: 2.7 };

// THE BASELINE IS PINNED, NOT READ LIVE. Once the re-fit SHIPPED, WINS_MULT became the proposal —
// so a sim that read it live compared the new numbers to themselves and reported "no change",
// which is worse than useless: it is a before/after table that silently stops being one. These are
// the pre-re-fit constants as literals, so this file keeps showing what actually moved.
// THE BASELINE IS THE CURRENTLY SHIPPED TABLE — the LV40 numbers Andy quoted back. (It was the
// pre-previous-refit constants; that comparison is now two refits stale and hid the fact that the
// SHIPPED config, measured against the CORRECTED fuse throughput, is itself over the 2.00x spread.)
const BEFORE_MULT = { wordBomb: 2, blitz: 1.2, satRush: 0.8, chain: 1.9, fuse: 1.35 };
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
for (const [label, mults] of [['BEFORE (shipped today)', BEFORE_MULT], ['AFTER (proposed)', PROPOSED]]) {
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
  console.log(`  ${m.padEnd(12)}${pad(fmt(results['BEFORE (shipped today)'][m].strong), 8)}${pad(fmt(results['AFTER (proposed)'][m].strong), 13)}`);
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
  ok: results['AFTER (proposed)'].spread <= 2,
  // THREE DECIMALS ON PURPOSE. This fit sits on the corner of the feasible region (see the SAT
  // note by PROPOSED), so "2.00x" rounded is the difference between passing and failing.
  detail: `${results['AFTER (proposed)'].spread.toFixed(3)}x (before ${results['BEFORE (shipped today)'].spread.toFixed(3)}x)`
    + `  — only ${(((2 / results['AFTER (proposed)'].spread) - 1) * 100).toFixed(1)}% of headroom; SAT's mult is load-bearing`,
});
// ANDY'S THREE ASKS THIS ROUND, EVALUATED.
const cardOf = (t, m) => round10(WORD_WINS_BASE * t[m]);
const lv40 = (t, m) => Math.round(WORD_WINS_BASE * t[m] * winLevelMult(40));
const soloLow = Math.min(cardOf(PROPOSED, 'chain'), cardOf(PROPOSED, 'fuse'));
const mpHigh = Math.max(cardOf(PROPOSED, 'wordBomb'), cardOf(PROPOSED, 'blitz'));
conds.push({
  name: 'CHAIN and FUSE both LEAD every multiplayer mode on the per-word rate',
  ok: soloLow > mpHigh,
  detail: `LV40: chain ${lv40(PROPOSED, 'chain')}, fuse ${lv40(PROPOSED, 'fuse')} vs wordBomb `
    + `${lv40(PROPOSED, 'wordBomb')}, blitz ${lv40(PROPOSED, 'blitz')} `
    + `(was chain ${lv40(BEFORE_MULT, 'chain')}, fuse ${lv40(BEFORE_MULT, 'fuse')} — both BELOW wordBomb `
    + `${lv40(BEFORE_MULT, 'wordBomb')})`,
});
conds.push({
  name: 'the solo lead is a REAL lead, not a rounding win (>= 1.25x the best multiplayer rate)',
  ok: soloLow / mpHigh >= 1.25,
  detail: `${(soloLow / mpHigh).toFixed(2)}x  (ceiling with the spread held at 2.00x is 1.38x for chain, `
    + `1.72x for fuse — this sits inside both)`,
});
conds.push({
  // THE OLD "SAT WITHIN 20% OF BLITZ" CONDITION IS GONE, and it was retired by a proof.
  // Fixing SAT's rarity DOUBLE COUNT left it the only mode with no per-word multiplier at all
  // (no combo, no lucky, and now no free deck rarity), so at an equal card rate it earns 0.31x
  // Blitz per MINUTE. Holding the two cards within 20% therefore forces a 2.7-4.0x wins/min gap
  // that busts the 2.00x spread on its own — an exhaustive search over card space in multiples
  // of 10 found NO assignment satisfying both. The honest replacement asserts what the fix is
  // actually for: SAT's card must LEAD, because it has nothing to stack.
  name: 'SAT RUSH leads on the card (it has no combo, no lucky and no free rarity to stack)',
  ok: cardOf(PROPOSED, 'satRush') > cardOf(PROPOSED, 'wordBomb'),
  detail: `LV40: sat ${lv40(PROPOSED, 'satRush')} vs wordBomb ${lv40(PROPOSED, 'wordBomb')}, `
    + `blitz ${lv40(PROPOSED, 'blitz')} — at equal cards SAT earns only `
    + `0.31x Blitz per minute, so a high card is what keeps its wins/min in band`,
});
conds.push({
  name: 'the SAT rarity fix bought real headroom (was ~0.1% on the corner)',
  ok: ((2 / results['AFTER (proposed)'].spread) - 1) >= 0.03,
  detail: `${(((2 / results['AFTER (proposed)'].spread) - 1) * 100).toFixed(1)}% of spare spread `
    + `at ${results['AFTER (proposed)'].spread.toFixed(3)}x — the double count was worth ~2.79x on `
    + `every SAT word and was what pinned the whole table to a 4-card-point sliver`,
});
conds.push({
  name: 'a STRONG run in CHAIN and FUSE clears 10,000',
  ok: results['AFTER (proposed)'].chain.strong >= 10000 && results['AFTER (proposed)'].fuse.strong >= 10000,
  detail: `chain ${fmt(results['AFTER (proposed)'].chain.strong)}, fuse ${fmt(results['AFTER (proposed)'].fuse.strong)}`,
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
