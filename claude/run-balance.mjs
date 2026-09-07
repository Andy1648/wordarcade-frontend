// run-sim-deep.mjs — DEEP RUN-MODE DRAFT SIMULATION (report-only, chore/run-sim-deep)
//
// Plays RUN MODE headless, N runs per strategy (default 50 → 200 total), to answer:
//   is DRAFTING a real decision, or does one strategy strictly win?
//
// It reuses the SHIPPED pure engine (src/runMode/engine.js) for ALL scoring/wall/modifier
// math — scoreWord, roundKnobs, applyRoundMods, suddenDeathChance, dealOffers, wallAt,
// expectedRoundPayout — so the numbers are the game's own, not a re-implementation.
//
// The ONE thing the engine can't provide is a human: simulateRoundPayout() assumes all 16
// words land. This harness replaces that with a PLAYER-SKILL model (variable word count +
// accuracy + combo resets on a miss) that is IDENTICAL across all four strategies, so the
// only variable between strategies is which modifiers get drafted.
//
// TWO round models (toggled by `live`):
//   DESIGNED — honours every engine knob (wprMul, luckyOdds, SNOWBALL owned-ramp). What the
//              engine + wall calibration INTEND.
//   LIVE     — mirrors what useRunMode.js actually applies at run time: ctx.owned hardcoded 0
//              (SNOWBALL ramp dead), wprMul never read (SHORT FUSE downside dead), lucky
//              oracle fixed at 1/40 (luckyOdds knob dead → LUCKY CHARM upside / JACKPOT
//              downside dead). What players ACTUALLY experience in the shipped build.
//
// Deterministic + seedable: one mulberry32 stream per (run index), shared across strategies
// (common random numbers) so cross-strategy differences are drafting, not luck.
//
// Run:  node claude/run-sim-deep.mjs            (50/strategy, LIVE, seed 20260906)
//       node claude/run-sim-deep.mjs 2000       (2000/strategy — stable secondary stats)
//       node claude/run-sim-deep.mjs 50 designed (DESIGNED round model)
//       node claude/run-sim-deep.mjs 50 live 123 (custom seed)

import {
  MODIFIERS, MODIFIER_BY_ID, RUN_ROUNDS, wallAt, wallSchedule, roundKnobs,
  scoreWord, applyRoundMods, suddenDeathChance, dealOffers, expectedRoundPayout,
} from '../src/runMode/engine.js';
import { mulberry32, LUCKY_ODDS } from '../src/progress/luck.js';

// ---------------- CLI ----------------
const N = parseInt(process.argv[2], 10) || 50;               // runs per strategy
const MODE = (process.argv[3] || 'live').toLowerCase();      // 'live' | 'designed'
const SEED0 = parseInt(process.argv[4], 10) || 20260906;     // base seed
const LIVE = MODE !== 'designed';

// The three solo modes a round can roll (config.js ROUND_MODES). Constraint modes are
// harder → the player lands fewer / lower-accuracy words. Same for all strategies.
const ROUND_MODES = [
  { key: 'chain', attemptsMul: 0.90, accuracy: 0.86 },
  { key: 'fuse',  attemptsMul: 0.80, accuracy: 0.82 },
  { key: 'sat',   attemptsMul: 0.88, accuracy: 0.88 },
];

// ---------------- PLAYER-SKILL MODEL (identical across strategies) ----------------
// A competent-but-human player. The engine baseline is 16 landed words/round; a real 30s
// round yields fewer, and some attempts miss (reset the combo). These constants are the
// ONLY tuning knobs of the "human"; they never change between strategies.
// meanAttempts + baseAccuracy are overridable (argv[5], argv[6]) to sweep skill levels —
// the wall was calibrated to 16 PERFECT words, so a weaker human dies round 1 pre-draft and
// the draft never gets to matter. A "strong player who reaches the endgame" (higher skill)
// is the regime where drafting is actually a decision, so that is the headline regime.
const SKILL = {
  meanAttempts: parseFloat(process.argv[5]) || 20,  // word attempts in a 30s round
  sdAttempts: 2.5,
  baseAccuracy: parseFloat(process.argv[6]) || 0.93, // P(an attempt is an accepted word)
  minAttempts: 5,
  maxAttempts: 28,
};

// Rarity mix — identical to engine.js RARITY_MIX (not exported, so mirrored here).
const RARITY_MIX = [['COMMON', 0.68], ['UNCOMMON', 0.22], ['RARE', 0.08], ['OBSCURE', 0.02]];

function gauss(rng, mean, sd) {
  // Box–Muller, one normal per two uniforms.
  const u = Math.max(1e-9, rng()), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Play ONE round with the player-skill model. Returns the round-adjusted payout.
// `ctx` = { owned, clean }; owned = rounds since SNOWBALL drafted (0 if not owned / LIVE).
function playRound(rng, stack, knobs, ctx, mode) {
  let attempts = Math.round(gauss(rng, SKILL.meanAttempts, SKILL.sdAttempts) * mode.attemptsMul);
  // fix/run-deck fixed the hook: the live round NOW reads wprMul (SHORT FUSE shortens the
  // timed round) and luckyOdds (makeLuckyOracle). Both models therefore honour every knob;
  // the old LIVE/DESIGNED split (which faked the fixed bugs) is retired — kept only so the
  // `designed` CLI arg still runs. SNOWBALL's `owned` ramp is moot (engine now uses `clean`).
  attempts = Math.round(attempts * knobs.wprMul);
  attempts = Math.max(SKILL.minAttempts, Math.min(SKILL.maxAttempts, attempts));

  const accuracy = SKILL.baseAccuracy * (mode.accuracy / 0.88); // normalise around the middle mode
  const luckyOdds = knobs.luckyOdds; // hook now honours the luckyOdds knob (was fixed 1/40)

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
// category: offense (ceiling / conditional) | defense (broad floor / flat) | economy (lucky/niche)
// safety: higher = safer for a risk-averse player (0 = run-ending gamble)
// NOTE (fix/run-balance): safety/cat ratings RE-RATED to match the rebalanced deck. The
// old ratings described the pre-rebalance cards; several are now wrong and would make the
// harness's BALANCED / RISK-AVERSE drafters model cards that no longer exist. Key changes:
//   momentum  9→4, defense→offense: now down:true (×0.9 every word) + a capped survival
//             scaler — a costed aggressive bet, NOT the safe floor it used to be.
//   snowball  5→3: now ×0.6 base (−40% floor) before it ramps — high early risk.
//   lexicographer 1→3: no longer zeroes COMMON/UNCOMMON (×0.55 now), so less of a trap.
const META = {
  'deep-pockets':   { cat: 'defense', safety: 10 },
  'combo-king':     { cat: 'defense', safety: 8 },
  'common-folk':    { cat: 'defense', safety: 8 },
  'bookworm':       { cat: 'defense', safety: 7 },
  'scrabble-bag':   { cat: 'economy', safety: 6 },
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
function playRun(strategyName, seed) {
  const rng = mulberry32(seed >>> 0);
  const decide = STRATEGIES[strategyName];
  let stack = [];
  let clean = 0, cumulative = 0, snowballAt = null;
  let deathRound = null, reason = null;

  for (let round = 1; round <= RUN_ROUNDS; round++) {
    const knobs = roundKnobs(stack);
    const owned = (!LIVE && snowballAt != null) ? (round - snowballAt) : 0; // SNOWBALL ramp (DESIGNED only)
    const ctx = { owned, clean };
    const mode = ROUND_MODES[Math.floor(rng() * ROUND_MODES.length)];

    const score = playRound(rng, stack, knobs, ctx, mode);
    cumulative += score;

    // Sudden death (GLASS CANNON): an automatic loss regardless of score.
    const sd = suddenDeathChance(stack);
    const fumbled = sd > 0 && rng() < sd;

    if (fumbled || score < wallAt(round)) {
      deathRound = round;
      reason = fumbled ? 'fumble' : 'wall';
      return { cleared: false, deathRound, reason, roundReached: round, cumulative, stack: stack.map((m) => m.id) };
    }
    clean++;
    if (round === RUN_ROUNDS) {
      return { cleared: true, deathRound: null, reason: 'cleared', roundReached: round, cumulative, stack: stack.map((m) => m.id) };
    }
    // DRAFT: three distinct unowned offers, strategy picks one.
    const offers = dealOffers(stack.map((m) => m.id), rng);
    if (offers.length) {
      const draftCtx = { owned: (!LIVE && snowballAt != null) ? (round + 1 - snowballAt) : 0, clean };
      const pick = decide(offers, stack, draftCtx, rng);
      stack.push(pick);
      if (pick.id === 'snowball') snowballAt = round + 1;
    }
  }
  // unreachable
  return { cleared: true, deathRound: null, reason: 'cleared', roundReached: RUN_ROUNDS, cumulative, stack: stack.map((m) => m.id) };
}

// ---------------- RUN THE BATTERY ----------------
const strategyNames = ['GREEDY', 'BALANCED', 'RISK-AVERSE', 'RANDOM'];
const results = {};
for (const name of strategyNames) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(playRun(name, SEED0 + i)); // paired seeds (CRN) across strategies
  results[name] = runs;
}

// ---------------- REPORTING ----------------
const pct = (x) => (100 * x).toFixed(1) + '%';
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

console.log(`\n=== RUN-MODE DEEP DRAFT SIM ===`);
console.log(`model=${LIVE ? 'LIVE (useRunMode semantics)' : 'DESIGNED (all engine knobs honoured)'}  N=${N}/strategy  seed=${SEED0}`);
console.log(`wall schedule: ${wallSchedule().join(', ')}`);
console.log(`player skill: ~${SKILL.meanAttempts} attempts/round, ${pct(SKILL.baseAccuracy)} base accuracy (identical for all strategies)\n`);

// 1) Win rate + mean rounds per strategy
console.log(`--- 1. WIN RATE (out of ${N}) ---`);
for (const name of strategyNames) {
  const r = results[name];
  const wins = r.filter((x) => x.cleared).length;
  console.log(`  ${name.padEnd(12)} ${String(wins).padStart(3)}/${N}  (${pct(wins / N)})   mean round reached ${mean(r.map((x) => x.roundReached)).toFixed(2)}   mean cumulative ${mean(r.map((x) => x.cumulative)).toFixed(0)}`);
}

// 2) Death-round histogram (pooled across all strategies, and per strategy)
console.log(`\n--- 2. DEATH-ROUND HISTOGRAM (round the run ended on; C = cleared) ---`);
const histFor = (runs) => {
  const h = {}; let cleared = 0, fumble = 0;
  for (const x of runs) { if (x.cleared) cleared++; else { h[x.deathRound] = (h[x.deathRound] || 0) + 1; if (x.reason === 'fumble') fumble++; } }
  return { h, cleared, fumble };
};
const pooled = histFor(strategyNames.flatMap((n) => results[n]));
const rounds = Array.from({ length: RUN_ROUNDS }, (_, i) => i + 1);
console.log(`  round: ` + rounds.map((r) => String(r).padStart(4)).join('') + '   C');
for (const name of strategyNames) {
  const { h, cleared } = histFor(results[name]);
  console.log(`  ${name.padEnd(11)} ` + rounds.map((r) => String(h[r] || 0).padStart(4)).join('') + `  ${String(cleared).padStart(3)}`);
}
console.log(`  ${'POOLED'.padEnd(11)} ` + rounds.map((r) => String(pooled.h[r] || 0).padStart(4)).join('') + `  ${String(pooled.cleared).padStart(3)}`);
{
  const deaths = Object.entries(pooled.h).sort((a, b) => b[1] - a[1]);
  if (deaths.length) console.log(`  → most runs die on ROUND ${deaths[0][0]} (${deaths[0][1]} of ${strategyNames.length * N} pooled runs). sudden-death fumbles pooled: ${pooled.fumble}`);
}

// 3) Modifier pick frequency (pooled) — most / least / NEVER
console.log(`\n--- 3. MODIFIER PICK FREQUENCY (pooled over all ${strategyNames.length * N} runs) ---`);
const pickCount = Object.fromEntries(MODIFIERS.map((m) => [m.id, 0]));
let totalPicks = 0;
for (const name of strategyNames) for (const x of results[name]) for (const id of x.stack) { pickCount[id]++; totalPicks++; }
const sorted = MODIFIERS.map((m) => [m.id, pickCount[m.id]]).sort((a, b) => b[1] - a[1]);
for (const [id, c] of sorted) {
  const m = MODIFIER_BY_ID[id];
  console.log(`  ${String(c).padStart(4)}  ${(c === 0 ? 'NEVER  ' : '       ')}${id.padEnd(15)} [${META[id].cat}/${m.down ? 'two-sided' : 'upside'}] ${m.text}`);
}
const never = sorted.filter(([, c]) => c === 0).map(([id]) => id);
console.log(`  → NEVER picked (dead weight): ${never.length ? never.join(', ') : '(none)'}`);

// 4) Dominance — modifiers/pairs over-represented in WINNING runs
console.log(`\n--- 4. DOMINANCE IN WINNING RUNS (pick-rate in winners vs in all runs) ---`);
const allRuns = strategyNames.flatMap((n) => results[n]);
const winRuns = allRuns.filter((x) => x.cleared);
if (winRuns.length === 0) {
  console.log(`  (no winning runs to analyse)`);
} else {
  const rateIn = (runs, id) => runs.filter((x) => x.stack.includes(id)).length / runs.length;
  const single = MODIFIERS.map((m) => ({
    id: m.id, win: rateIn(winRuns, m.id), all: rateIn(allRuns, m.id),
  })).filter((r) => r.win > 0).sort((a, b) => b.win - a.win);
  console.log(`  winning runs: ${winRuns.length}. single-modifier presence (winRate / allRate / lift):`);
  for (const r of single.slice(0, 18)) {
    console.log(`    ${r.id.padEnd(15)} ${pct(r.win).padStart(6)} / ${pct(r.all).padStart(6)}  lift ${(r.all > 0 ? r.win / r.all : Infinity).toFixed(2)}x`);
  }
  // pairs
  const pairKey = (a, b) => [a, b].sort().join(' + ');
  const pairWin = {}, pairAll = {};
  const addPairs = (runs, store) => { for (const x of runs) { const s = [...new Set(x.stack)]; for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const k = pairKey(s[i], s[j]); store[k] = (store[k] || 0) + 1; } } };
  addPairs(winRuns, pairWin); addPairs(allRuns, pairAll);
  const pairs = Object.entries(pairWin).map(([k, c]) => ({ k, win: c / winRuns.length, all: (pairAll[k] || 0) / allRuns.length })).sort((a, b) => b.win - a.win);
  console.log(`  top pairs in winning runs (winRate / allRate / lift):`);
  for (const p of pairs.slice(0, 8)) {
    console.log(`    ${p.k.padEnd(30)} ${pct(p.win).padStart(6)} / ${pct(p.all).padStart(6)}  lift ${(p.all > 0 ? p.win / p.all : Infinity).toFixed(2)}x`);
  }
}

// 5) TARGETS SUMMARY (fix/run-balance) — the three balance targets, evaluated.
console.log(`\n--- 5. TARGETS (fix/run-balance) ---`);
{
  const winPct = {};
  for (const name of strategyNames) winPct[name] = 100 * results[name].filter((x) => x.cleared).length / N;
  const sortedWin = strategyNames.map((n) => [n, winPct[n]]).sort((a, b) => b[1] - a[1]);
  const best = sortedWin[0];
  // T1: no single strategy >35%
  const t1 = best[1] <= 35;
  console.log(`  T1 best strategy <=35%%: ${best[0]} ${best[1].toFixed(1)}%  -> ${t1 ? 'PASS' : 'FAIL'}`);
  // T2: no modifier >60% of winning runs
  const winRunsAll = strategyNames.flatMap((n) => results[n]).filter((x) => x.cleared);
  let topMod = ['(none)', 0];
  const over60 = [];
  if (winRunsAll.length) {
    for (const m of MODIFIERS) {
      const r = winRunsAll.filter((x) => x.stack.includes(m.id)).length / winRunsAll.length * 100;
      if (r > topMod[1]) topMod = [m.id, r];
      if (r > 60) over60.push(`${m.id} ${r.toFixed(1)}%`);
    }
  }
  const t2 = topMod[1] <= 60;
  console.log(`  T2 top modifier <=60%% of winners: ${topMod[0]} ${topMod[1].toFixed(1)}%  -> ${t2 ? 'PASS' : 'FAIL'}${over60.length ? '   over60: ' + over60.join(', ') : ''}`);
  // T3: at least two strategies within 10 pts of each other
  let closest = [null, null, Infinity];
  for (let i = 0; i < sortedWin.length; i++) for (let j = i + 1; j < sortedWin.length; j++) {
    const d = Math.abs(sortedWin[i][1] - sortedWin[j][1]);
    if (d < closest[2]) closest = [sortedWin[i], sortedWin[j], d];
  }
  const t3 = closest[2] <= 10;
  console.log(`  T3 two strategies within 10pts: ${closest[0][0]}(${closest[0][1].toFixed(1)}) & ${closest[1][0]}(${closest[1][1].toFixed(1)}) = ${closest[2].toFixed(1)}pts  -> ${t3 ? 'PASS' : 'FAIL'}`);
  // sanity: best in 15-45%
  const sanity = best[1] >= 15 && best[1] <= 45;
  console.log(`  SANITY best in 15-45%%: ${best[1].toFixed(1)}%  -> ${sanity ? 'PASS' : 'FAIL'}`);
  console.log(`  ==> ALL THREE ${t1 && t2 && t3 ? 'PASS' : 'FAIL'}${t1 && t2 && t3 && sanity ? ' (+sanity)' : ''}`);
}

console.log('');
