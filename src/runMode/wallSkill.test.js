// wallSkill.test.js (fix/run-wall-2) — the ante wall must work across the REAL skill range, not
// just for the 16-perfect-words player it was first calibrated to. Drives the shipped engine
// through the skill-sweep harness (claude/run-skill.mjs — imports the engine, no side effects)
// at the two ends of the range:
//   CASUAL (8.6 attempts/round @93%): must reach a draft before dying — round-1 death ≤ 25%,
//     mean round reached ≥ 2.5 (pooled over the four drafters; round 1 is pre-draft so it's
//     identical for all of them under the paired seeds).
//   STRONG (20 attempts/round @93%): drafting must be a decision — RANDOM clears 10–30% of runs
//     (not free, not hopeless) and GREEDY beats RANDOM by ≥ 5 pts (choice matters).
// N=1000/strategy, seed 20260906 — deterministic, so these are pins, not flaky thresholds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../../claude/run-skill.mjs';
import { wallSchedule } from './engine.js';

const N = 1000;
const SEED = 20260906;
const ACC = 0.93;

test('the harness runs the shipped wall (80 … 1504)', () => {
  const r = simulate({ attempts: 20, accuracy: ACC, N: 10, seed: SEED });
  assert.deepEqual(r.wall, wallSchedule());
  assert.equal(r.stats.RANDOM.n, 10);
});

test('CASUAL (8.6 attempts): round-1 death ≤ 25% and mean round ≥ 2.5', () => {
  const r = simulate({ attempts: 8.6, accuracy: ACC, N, seed: SEED });
  const d1 = r.pooled.round1DeathPct;
  const mr = r.pooled.meanRound;
  assert.ok(d1 <= 25, `round-1 death ${d1.toFixed(1)}% > 25% — casual players die before the first draft`);
  assert.ok(mr >= 2.5, `mean round ${mr.toFixed(2)} < 2.5 — casual runs end too early`);
});

test('STRONG (20 attempts): RANDOM wins 10–30% and GREEDY − RANDOM ≥ 5 pts', () => {
  const r = simulate({ attempts: 20, accuracy: ACC, N, seed: SEED });
  const rnd = r.stats.RANDOM.winPct;
  const greedy = r.stats.GREEDY.winPct;
  assert.ok(rnd >= 10 && rnd <= 30, `RANDOM win ${rnd.toFixed(1)}% outside 10–30%`);
  assert.ok(greedy - rnd >= 5, `GREEDY ${greedy.toFixed(1)}% − RANDOM ${rnd.toFixed(1)}% = ${(greedy - rnd).toFixed(1)} pts < 5 — drafting doesn't matter`);
});
