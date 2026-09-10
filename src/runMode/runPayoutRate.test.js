// runPayoutRate.test.js — THE RUN's wins/min must stay inside the shipped 5-mode band.
//
// WHY THIS EXISTS. `claude/run-econ-sim.mjs` has always been able to prove whether THE RUN pays
// at a sane rate, but nothing ran it, so nothing noticed when it stopped being true.
//
// The divisor in `runWinsPayout` prices a run. It was fitted once (JOB A) and measured 594/727/938
// wins/min at 12/15/20 wpm — inside the band, gate passing. Then **c180f90 (the deck rebalance)
// changed what a round SCORES without re-fitting the divisor that prices it.** No payout code was
// touched; the same divisor simply now pays 0.16-0.39x of the band and blew the spread from 1.54x
// to 3.9-6.2x. It stayed broken silently because the sim was a script a human had to remember to
// run.
//
// So: any future change to the deck, the wall, the round payout, or the divisor that moves the
// rate out of the band fails HERE, at `npm test`, instead of shipping.
//
// It deliberately imports the sim's own `greedyRun` / band / duration model rather than copying
// them — a copy would drift from the script it is supposed to be guarding, which is the exact
// failure mode being fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWinsPayout, RUN_WINS_DIVISOR, RUN_ROUNDS } from './engine.js';
import { greedyRun, winsPerMin, spreadWith, BAND, RATES } from '../../claude/run-econ-sim.mjs';

// 600 fixed seeds: deterministic, ~1.7s, and convergent — @15 wpm measures 707-759 across
// N = 200..4000, so the verdict does not depend on the sample size.
const N = 600;
const runs = Array.from({ length: N }, (_, i) => greedyRun(1000 + i));

test('the payout formula matches the named divisor (the sim cannot describe a formula it is not running)', () => {
  // A full clear pays progress = 1, so the payout is exactly cumulative / divisor, rounded.
  for (const cum of [0, 1, 999, 19887, 250000]) {
    assert.equal(
      runWinsPayout(cum, RUN_ROUNDS),
      Math.round(cum / RUN_WINS_DIVISOR),
      `full-clear payout for ${cum} must be round(${cum}/${RUN_WINS_DIVISOR})`,
    );
  }
  // Partial runs scale linearly with the round reached.
  assert.equal(runWinsPayout(1000, 5), Math.round((1000 / RUN_WINS_DIVISOR) * 0.5));
  assert.equal(runWinsPayout(1000, 0), 0);
  // Past the last round the progress term is clamped, never >1.
  assert.equal(runWinsPayout(1000, RUN_ROUNDS + 7), runWinsPayout(1000, RUN_ROUNDS));
});

test('THE RUN pays inside the shipped band at 15 wpm', () => {
  const v = winsPerMin(runs, 15);
  assert.ok(
    v >= BAND.LO && v <= BAND.HI,
    `RUN pays ${v.toFixed(0)} wins/min at 15 wpm, outside the shipped band ${BAND.LO}-${BAND.HI}. ` +
    'If the deck, the wall or the round payout changed, RUN_WINS_DIVISOR needs re-fitting — ' +
    'run `node claude/run-econ-sim.mjs` and sweep it. This is exactly what c180f90 missed.',
  );
});

test('adding THE RUN keeps the 5-mode wins/min spread within 2x at every rate', () => {
  for (const wpm of RATES) {
    const v = winsPerMin(runs, wpm);
    const spread = spreadWith(v);
    assert.ok(
      spread <= 2,
      `at ${wpm} wpm RUN pays ${v.toFixed(0)} wins/min, taking the mode spread to ${spread.toFixed(2)}x (max 2x)`,
    );
  }
});

test('the rate is not an artefact of one typing speed', () => {
  // The band spans 1.54x while 12->20 wpm spans 1.58x, so RUN cannot sit INSIDE the band at every
  // rate no matter how it is priced — that is structural, not a tuning failure. What IS required
  // is that it stays close at the extremes rather than only being correct at the fitted rate.
  for (const wpm of RATES) {
    const v = winsPerMin(runs, wpm);
    assert.ok(v >= BAND.LO * 0.9, `at ${wpm} wpm RUN pays ${v.toFixed(0)}, more than 10% below the band floor`);
    assert.ok(v <= BAND.HI * 1.1, `at ${wpm} wpm RUN pays ${v.toFixed(0)}, more than 10% above the band ceiling`);
  }
});
