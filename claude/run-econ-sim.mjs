// run-econ-sim.mjs — JOB A: where does RUN MODE sit on the wins/min mode-spread once it's
// reachable at LV8? Runs the greedy drafter over the real engine, applies runWinsPayout, and
// converts to wins/min against a duration model, then compares to the shipped 5-mode band
// (measured live by winsmin-sim.mjs on current main: blitz 625 … chain 963, spread 1.54×).
// Run: node claude/run-econ-sim.mjs
import {
  simulateRoundPayout, roundKnobs, wallAt, runWinsPayout, dealOffers,
  expectedRoundPayout, MODIFIERS, RUN_ROUNDS, WORDS_PER_ROUND, RUN_WINS_DIVISOR,
} from '../src/runMode/engine.js';
import { mulberry32 } from '../src/progress/luck.js';
import { pathToFileURL } from 'node:url';

const byId = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));

export function greedyRun(seed) {
  const rng = mulberry32(seed);
  let stack = [], cumulative = 0, clean = 0, roundReached = 0, cleared = false;
  for (let round = 1; round <= RUN_ROUNDS; round++) {
    roundReached = round;
    const ctx = { owned: stack.length, clean };
    const knobs = roundKnobs(stack);
    const sd = stack.reduce((m, x) => Math.max(m, x.suddenDeath || 0), 0); // GLASS CANNON
    if (sd > 0 && rng() < sd) break; // sudden death ends the run
    const score = simulateRoundPayout(rng, stack, ctx, knobs);
    cumulative += score;
    if (score < wallAt(round)) break; // missed the wall → run over
    clean += 1;
    if (round === RUN_ROUNDS) { cleared = true; break; }
    // draft: greedily take the offer that maximises expected next-round payout
    const offers = dealOffers(stack.map((m) => m.id), rng);
    let best = null, bestEV = -Infinity;
    for (const o of offers) {
      const ev = expectedRoundPayout([...stack, o], { owned: stack.length + 1, clean });
      if (ev > bestEV) { bestEV = ev; best = o; }
    }
    if (best) stack.push(best);
  }
  const wins = runWinsPayout(cumulative, cleared ? RUN_ROUNDS : roundReached);
  return { cumulative, roundReached, cleared, wins };
}

// Exported so src/runMode/runPayoutRate.test.js asserts against the SAME band and duration
// model this script prints, rather than a copy that can drift away from it.
export const BAND = { LO: 625, HI: 963 };
export const DRAFT_S = 8;
export const RATES = [12, 15, 20];

/** wins/min for a set of runs at a typing rate — the sim's duration model, shared with the test. */
export function winsPerMin(runs, wpm) {
  const totWins = runs.reduce((s, r) => s + r.wins, 0);
  const totMin = runs.reduce(
    (s, r) => s + (r.roundReached * (WORDS_PER_ROUND / wpm) + Math.max(0, r.roundReached - 1) * (DRAFT_S / 60)), 0);
  return totWins / totMin;
}

/** The spread across the 5-mode band once RUN is added at `v` wins/min. */
export function spreadWith(v) {
  return Math.max(BAND.HI / Math.min(BAND.LO, v), Math.max(BAND.HI, v) / BAND.LO);
}

const N = 4000;
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const runs = isMain ? Array.from({ length: N }, (_, i) => greedyRun(1000 + i)) : [];
if (isMain) {
const winRate = runs.filter((r) => r.cleared).length / N;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const meanWins = mean(runs.map((r) => r.wins));
const meanRounds = mean(runs.map((r) => r.roundReached));
const meanCum = mean(runs.map((r) => r.cumulative));

console.log(`RUN MODE greedy sim (${N} runs): win rate ${(winRate * 100).toFixed(1)}%, mean rounds ${meanRounds.toFixed(1)}, mean cumulative ${meanCum.toFixed(0)}, mean wins/run ${meanWins.toFixed(0)}`);
// Printed from the CONSTANT, not hand-typed: the old literal said "/100" long after the
// code had moved to /10, so the sim described a formula it was not running.
console.log(`runWinsPayout = round(cumulative/${RUN_WINS_DIVISOR} × roundReached/${RUN_ROUNDS})  [BASE_WIN_PER_WORD=10 vs solo 20]\n`);

// Duration model: a run round is 16 words of continuous typing + a short draft. Sweep the typing
// rate across the solo band (SAT-paced 12 … FUSE-fast 20 words/min) so the answer isn't rate-sensitive.
const DRAFT_S = 8;
console.log('wins/min vs the shipped band (blitz 625 lo … chain 963 hi, spread 1.54×):');
for (const wpm of [12, 15, 20]) {
  const totWins = runs.reduce((s, r) => s + r.wins, 0);
  const totMin = runs.reduce((s, r) => s + (r.roundReached * (WORDS_PER_ROUND / wpm) + Math.max(0, r.roundReached - 1) * (DRAFT_S / 60)), 0);
  const wpmRun = totWins / totMin;
  const vsLo = wpmRun / 625, vsHi = wpmRun / 963;
  const spreadIfLowest = 963 / Math.min(625, wpmRun);
  const spreadIfHighest = Math.max(963, wpmRun) / 625;
  const spread = Math.max(spreadIfLowest, spreadIfHighest);
  console.log(`  @${wpm} words/min: RUN ≈ ${wpmRun.toFixed(0)} wins/min (${vsLo.toFixed(2)}× blitz, ${vsHi.toFixed(2)}× chain) → new spread ${spread.toFixed(2)}× ${spread <= 2 ? '✓' : '✗ >2×'}`);
}
}
