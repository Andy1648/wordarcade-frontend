// run-skill.mjs — PLAYER-SKILL SWEEP for THE RUN's ante wall (fix/run-wall-2).
//
// A copy of claude/run-balance.mjs (same engine reuse, same player-skill model, same four
// drafters, same common-random-number seeding) RESTRUCTURED so the whole battery is a pure
// FUNCTION of skill: simulate({ attempts, accuracy, N, seed }) → per-strategy stats. Nothing
// runs on import, so src/runMode/wallSkill.test.js can import it as a node:test fixture.
//
// Why a skill sweep: run-balance.mjs calibrated the wall to ONE strong player (20 attempts /
// 93% accuracy). The wall has to work across the real skill range — a casual player must reach
// a draft before dying (round-1 death, mean round), while a strong player must still find that
// drafting is a decision (RANDOM win % in a band, GREEDY clearly above RANDOM).
//
// ALL scoring / wall / modifier math is the SHIPPED pure engine (src/runMode/engine.js):
// scoreWord, roundKnobs, applyRoundMods, suddenDeathChance, dealOffers, wallAt,
// expectedRoundPayout. The only thing the engine can't provide is a human, which is the
// player-skill model below (identical across strategies within a sweep point).
//
// Run:  node claude/run-skill.mjs             (N=1000 per strategy per skill, seed 20260906)
//       node claude/run-skill.mjs 2000        (N=2000)
//       node claude/run-skill.mjs 1000 123    (custom seed)
// Sweep points: attempts 5.4 / 8.6 / 14 / 20 at 0.93 base accuracy.

import { pathToFileURL } from 'node:url';
import {
  MODIFIERS, RUN_ROUNDS, wallAt, wallSchedule, roundKnobs,
  scoreWord, applyRoundMods, suddenDeathChance, dealOffers, expectedRoundPayout,
} from '../src/runMode/engine.js';
import { mulberry32 } from '../src/progress/luck.js';

export const DEFAULT_SEED = 20260906;
export const DEFAULT_N = 1000;
export const DEFAULT_ACCURACY = 0.93;
export const DEFAULT_SWEEP = [5.4, 8.6, 14, 20]; // mean word ATTEMPTS per 30s round
export const STRATEGY_NAMES = ['GREEDY', 'BALANCED', 'RISK-AVERSE', 'RANDOM'];

// The three solo modes a round can roll (config.js ROUND_MODES). Constraint modes are
// harder → the player lands fewer / lower-accuracy words. Same for all strategies.
const ROUND_MODES = [
  { key: 'chain', attemptsMul: 0.90, accuracy: 0.86 },
  { key: 'fuse',  attemptsMul: 0.80, accuracy: 0.82 },
  { key: 'sat',   attemptsMul: 0.88, accuracy: 0.88 },
];

// ---------------- PLAYER-SKILL MODEL (identical across strategies at a sweep point) ----------------
// meanAttempts / baseAccuracy are the sweep axes; the rest is fixed exactly as in run-balance.mjs.
function makeSkill(attempts, accuracy) {
  return { meanAttempts: attempts, sdAttempts: 2.5, baseAccuracy: accuracy, minAttempts: 5, maxAttempts: 28 };
}

// Rarity mix — identical to engine.js RARITY_MIX (not exported, so mirrored here).
const RARITY_MIX = [['COMMON', 0.68], ['UNCOMMON', 0.22], ['RARE', 0.08], ['OBSCURE', 0.02]];

function gauss(rng, mean, sd) {
  // Box–Muller, one normal per two uniforms.
  const u = Math.max(1e-9, rng()), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Play ONE round with the player-skill model. Returns the round-adjusted payout.
function playRound(rng, stack, knobs, ctx, mode, skill) {
  let attempts = Math.round(gauss(rng, skill.meanAttempts, skill.sdAttempts) * mode.attemptsMul);
  attempts = Math.round(attempts * knobs.wprMul); // SHORT FUSE shortens the timed round (hook honours wprMul)
  attempts = Math.max(skill.minAttempts, Math.min(skill.maxAttempts, attempts));

  const accuracy = skill.baseAccuracy * (mode.accuracy / 0.88); // normalise around the middle mode
  const luckyOdds = knobs.luckyOdds; // hook honours the luckyOdds knob (makeLuckyOracle)

  let combo = knobs.comboStart;
  let raw = 0;
  for (let i = 0; i < attempts; i++) {
    if (rng() >= Math.min(0.98, accuracy)) { combo = 1; continue; } // a miss resets the combo (live `fail`)
    // Accepted word — generated exactly like engine.simulateRoundPayout.
    const x = rng();
    let acc = 0, rarity = 'COMMON';
    for (const [n, p] of RARITY_MIX) { acc += p; if (x <= acc) { rarity = n; break; } }
    const len = 4 + Math.floor(rng() * 6);
    const vowels = Math.max(1, Math.round(len * 0.4));
    const rare = rng() < 0.08;
    const lucky = !knobs.noLucky && rng() < 1 / luckyOdds;
    raw += scoreWord({ rarity, len, vowels, rare, lucky, combo }, stack, knobs);
    combo = Math.min(knobs.comboMax, combo + knobs.comboStep);
  }
  return applyRoundMods(raw, stack, ctx);
}

// ---------------- MODIFIER METADATA (for BALANCED / RISK-AVERSE deciders) ----------------
// Verbatim from run-balance.mjs (re-rated on fix/run-deck-2 for the two-sided deck).
const META = {
  'deep-pockets':   { cat: 'defense', safety: 8 },
  'combo-king':     { cat: 'defense', safety: 8 },
  'common-folk':    { cat: 'defense', safety: 8 },
  'bookworm':       { cat: 'defense', safety: 7 },
  'scrabble-bag':   { cat: 'offense', safety: 4 },
  'jackpot':        { cat: 'economy', safety: 5 },
  'lucky-charm':    { cat: 'economy', safety: 4 },
  'hot-streak':     { cat: 'offense', safety: 4 },
  'uncapped':       { cat: 'offense', safety: 4 },
  'momentum':       { cat: 'offense', safety: 4 },
  'double-vowels':  { cat: 'offense', safety: 3 },
  'long-haul':      { cat: 'offense', safety: 3 },
  'vowel-movement': { cat: 'offense', safety: 3 },
  'rare-breed':     { cat: 'offense', safety: 3 },
  'short-fuse':     { cat: 'offense', safety: 3 },
  'snowball':       { cat: 'economy', safety: 3 },
  'lexicographer':  { cat: 'offense', safety: 3 },
  'glass-cannon':   { cat: 'offense', safety: 0 },
};

// EV signal: the engine's own expected round payout for a stack (greedy's ranking signal).
const ev = (stack, ctx) => expectedRoundPayout(stack, ctx);

// The four drafters. Each takes (offers[], stack[], ctx, rng) and returns the chosen modifier.
const STRATEGIES = {
  GREEDY(offers, stack, ctx) { // highest immediate expected next-round payout
    let best = offers[0], bestEV = -Infinity;
    for (const o of offers) { const e = ev([...stack, o], ctx); if (e > bestEV) { bestEV = e; best = o; } }
    return best;
  },
  BALANCED(offers, stack, ctx) { // fill the least-represented category, EV tie-break
    const counts = { offense: 0, defense: 0, economy: 0 };
    for (const m of stack) counts[META[m.id].cat]++;
    let best = offers[0], bestKey = [Infinity, -Infinity];
    for (const o of offers) {
      const key = [counts[META[o.id].cat], ev([...stack, o], ctx)];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) { bestKey = key; best = o; }
    }
    return best;
  },
  'RISK-AVERSE'(offers, stack, ctx) { // safest offer, EV tie-break
    let best = offers[0], bestKey = [-Infinity, -Infinity];
    for (const o of offers) {
      const key = [META[o.id].safety, ev([...stack, o], ctx)];
      if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) { bestKey = key; best = o; }
    }
    return best;
  },
  RANDOM(offers, stack, ctx, rng) { return offers[Math.floor(rng() * offers.length)]; },
};

// ---------------- ONE FULL RUN ----------------
function playRun(strategyName, seed, skill) {
  const rng = mulberry32(seed >>> 0);
  const decide = STRATEGIES[strategyName];
  const stack = [];
  let clean = 0, cumulative = 0;

  for (let round = 1; round <= RUN_ROUNDS; round++) {
    const knobs = roundKnobs(stack);
    const ctx = { owned: 0, clean }; // engine's SNOWBALL/MOMENTUM ramps read `clean`
    const mode = ROUND_MODES[Math.floor(rng() * ROUND_MODES.length)];

    const score = playRound(rng, stack, knobs, ctx, mode, skill);
    cumulative += score;

    // Sudden death (GLASS CANNON): an automatic loss regardless of score.
    const sd = suddenDeathChance(stack);
    const fumbled = sd > 0 && rng() < sd;

    if (fumbled || score < wallAt(round)) {
      return { cleared: false, deathRound: round, reason: fumbled ? 'fumble' : 'wall', roundReached: round, cumulative, stack: stack.map((m) => m.id) };
    }
    clean++;
    if (round === RUN_ROUNDS) {
      return { cleared: true, deathRound: null, reason: 'cleared', roundReached: round, cumulative, stack: stack.map((m) => m.id) };
    }
    // DRAFT: three distinct unowned offers, strategy picks one.
    const offers = dealOffers(stack.map((m) => m.id), rng);
    if (offers.length) stack.push(decide(offers, stack, { owned: 0, clean }, rng));
  }
  return { cleared: true, deathRound: null, reason: 'cleared', roundReached: RUN_ROUNDS, cumulative, stack: stack.map((m) => m.id) };
}

// ---------------- THE BATTERY AS A FUNCTION OF SKILL ----------------
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function statsFor(runs) {
  const hist = {};
  let wins = 0, fumbles = 0;
  for (const x of runs) {
    if (x.cleared) wins++;
    else { hist[x.deathRound] = (hist[x.deathRound] || 0) + 1; if (x.reason === 'fumble') fumbles++; }
  }
  const n = runs.length || 1;
  return {
    n: runs.length,
    wins,
    winPct: 100 * wins / n,
    round1DeathPct: 100 * (hist[1] || 0) / n,
    meanRound: mean(runs.map((x) => x.roundReached)),
    meanCumulative: mean(runs.map((x) => x.cumulative)),
    fumbles,
    deathHist: hist,
  };
}

// Play N runs per strategy at one skill point (paired seeds across strategies — CRN — so
// cross-strategy differences are drafting, not luck). Returns per-strategy + pooled stats.
export function simulate({ attempts = 20, accuracy = DEFAULT_ACCURACY, N = DEFAULT_N, seed = DEFAULT_SEED } = {}) {
  const skill = makeSkill(attempts, accuracy);
  const results = {};
  for (const name of STRATEGY_NAMES) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(playRun(name, seed + i, skill));
    results[name] = runs;
  }
  const stats = {};
  for (const name of STRATEGY_NAMES) stats[name] = statsFor(results[name]);
  const pooled = statsFor(STRATEGY_NAMES.flatMap((n) => results[n]));
  // Modifier presence among winning runs (pooled) — the T2 lens, per skill point.
  const winRuns = STRATEGY_NAMES.flatMap((n) => results[n]).filter((x) => x.cleared);
  const topModifier = { id: '(none)', pct: 0 };
  if (winRuns.length) {
    for (const m of MODIFIERS) {
      const p = 100 * winRuns.filter((x) => x.stack.includes(m.id)).length / winRuns.length;
      if (p > topModifier.pct) { topModifier.id = m.id; topModifier.pct = p; }
    }
  }
  return { skill, N, seed, wall: wallSchedule(), results, stats, pooled, topModifier };
}

// Sweep several skill points. Returns [{ attempts, ...simulate() }].
export function sweep({ attemptsList = DEFAULT_SWEEP, accuracy = DEFAULT_ACCURACY, N = DEFAULT_N, seed = DEFAULT_SEED } = {}) {
  return attemptsList.map((attempts) => ({ attempts, ...simulate({ attempts, accuracy, N, seed }) }));
}

// ---------------- CLI ----------------
function main() {
  const N = parseInt(process.argv[2], 10) || DEFAULT_N;
  const seed = parseInt(process.argv[3], 10) || DEFAULT_SEED;
  const pct = (x) => x.toFixed(1).padStart(5) + '%';
  console.log(`\n=== RUN-MODE SKILL SWEEP (fix/run-wall-2) ===`);
  console.log(`N=${N}/strategy/skill  seed=${seed}  accuracy=${DEFAULT_ACCURACY}  attempts=${DEFAULT_SWEEP.join(' / ')}`);
  console.log(`wall schedule: ${wallSchedule().join(', ')}\n`);
  const rows = sweep({ N, seed });
  console.log(`  attempts   round-1 death   mean round   win%  GREEDY  BALANCED  RISK-AV  RANDOM   GREEDY-RANDOM   top modifier in winners`);
  for (const r of rows) {
    const s = r.stats;
    const diff = s.GREEDY.winPct - s.RANDOM.winPct;
    console.log(
      `  ${String(r.attempts).padStart(8)}   ${pct(r.pooled.round1DeathPct).padStart(13)}   ${r.pooled.meanRound.toFixed(2).padStart(10)}` +
      `         ${pct(s.GREEDY.winPct)}   ${pct(s.BALANCED.winPct)}   ${pct(s['RISK-AVERSE'].winPct)}  ${pct(s.RANDOM.winPct)}` +
      `   ${(diff >= 0 ? '+' : '') + diff.toFixed(1) + ' pts'}`.padEnd(16) +
      `   ${r.topModifier.id} ${r.topModifier.pct.toFixed(1)}%`,
    );
  }
  console.log(`\n  death-round histogram per skill (pooled over the 4 strategies; C = cleared):`);
  const rounds = Array.from({ length: RUN_ROUNDS }, (_, i) => i + 1);
  console.log(`  attempts  ` + rounds.map((x) => String(x).padStart(5)).join('') + '      C');
  for (const r of rows) {
    console.log(`  ${String(r.attempts).padStart(8)}  ` + rounds.map((x) => String(r.pooled.deathHist[x] || 0).padStart(5)).join('') + `  ${String(r.pooled.wins).padStart(5)}`);
  }
  console.log(`\n  acceptance (src/runMode/wallSkill.test.js):`);
  const casual = rows.find((r) => r.attempts === 8.6);
  const strong = rows.find((r) => r.attempts === 20);
  if (casual) {
    console.log(`    @8.6  round-1 death ${casual.pooled.round1DeathPct.toFixed(1)}% <= 25  -> ${casual.pooled.round1DeathPct <= 25 ? 'PASS' : 'FAIL'}`);
    console.log(`    @8.6  mean round ${casual.pooled.meanRound.toFixed(2)} >= 2.5      -> ${casual.pooled.meanRound >= 2.5 ? 'PASS' : 'FAIL'}`);
  }
  if (strong) {
    const rnd = strong.stats.RANDOM.winPct, g = strong.stats.GREEDY.winPct;
    console.log(`    @20   RANDOM win ${rnd.toFixed(1)}% in 10-30      -> ${rnd >= 10 && rnd <= 30 ? 'PASS' : 'FAIL'}`);
    console.log(`    @20   GREEDY-RANDOM ${(g - rnd).toFixed(1)} pts >= 5   -> ${g - rnd >= 5 ? 'PASS' : 'FAIL'}`);
  }
  console.log('');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
