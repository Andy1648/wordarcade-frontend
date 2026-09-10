// runPayout.test.js (fix/run-payout) — THE RUN credits XP per accepted word and banks its wins
// once at run end. Before this, src/runMode never called awardWordXp or the wins helpers, so the
// over screen's "+N WINS" was never credited and the menu stayed at 0 WINS / no XP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { awardWordXp, loadProgress, XP_MULTIPLIERS } from '../progress/xp.js';
import { getWins, getWinsLifetime, bankRunWins, consumePendingWinsStamp } from '../progress/wins.js';
import { masteryWords, MASTERY_MODES } from '../progress/mastery.js';
import { runReducer, runWinsEarned } from './useRunMode.js';
import { RUN_UNLOCK_LEVEL } from './config.js';
import { wallAt, RUN_ROUNDS, RUN_WINS_DIVISOR } from './engine.js';

function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

// Play N accepted six-letter words in THE RUN from a fresh LV1 save; return the level state.
function runWords(n) {
  return withStorage({}, () => {
    for (let i = 0; i < n; i++) awardWordXp({ mode: 'run', wordLength: 6 });
    return { ...loadProgress(), mastery: masteryWords('run') };
  });
}

test('run has an XP multiplier and a mastery track', () => {
  assert.equal(XP_MULTIPLIERS.run, 3);
  assert.ok(MASTERY_MODES.includes('run'));
});

test('(a) 12 accepted 6-letter words in a run reach at least LV8 (the RUN unlock level) from LV1', () => {
  const r = runWords(12);
  assert.ok(r.level >= 8, `expected LV>=8, got LV${r.level}`);
  assert.ok(r.level >= RUN_UNLOCK_LEVEL, 'one free run must clear its own gate');
  assert.equal(r.mastery, 12, 'each accepted word credits the run mastery track');
});

test('12 / 20 / 30-word runs level monotonically (reported figures)', () => {
  const a = runWords(12);
  const b = runWords(20);
  const c = runWords(30);
  assert.ok(a.level <= b.level && b.level <= c.level);
  // Reported by fix/run-payout: keep these pinned so a curve/multiplier change is visible.
  assert.equal(a.level, 8);
  assert.equal(b.level, 10);
  assert.equal(c.level, 12);
});

// Drive the reducer through a short run that dies on the round-1 wall and bank the payout.
function playToOver(score) {
  const s0 = { phase: 'wall', seed: 7, round: 1, stackIds: [], cumulative: 0, clean: 0, lastRoundScore: 0, lastWall: 0, reason: null, offers: [], words: null };
  const s1 = runReducer(s0, { type: 'startRound' });
  return runReducer(s1, { type: 'endRound', score, fumbled: false });
}

test('(b) wins balance after "over" equals the rendered winsEarned (balance + lifetime + stamp)', () => {
  withStorage({}, () => {
    const over = playToOver(wallAt(1) - 1); // short of the wall → over on round 1
    assert.equal(over.phase, 'over');
    const earned = runWinsEarned(over);
    assert.ok(earned > 0, 'a scored run pays something');
    bankRunWins(earned);
    assert.equal(getWins(), earned);
    assert.equal(getWinsLifetime(), earned);
    assert.equal(consumePendingWinsStamp(), earned);
  });
});

test('(b) a cleared run pays full progress; wins add to an existing balance', () => {
  withStorage({ 'taw.wins': '500', 'taw.winsLifetime': '900' }, () => {
    let s = { phase: 'wall', seed: 3, round: RUN_ROUNDS, stackIds: [], cumulative: 4000, clean: RUN_ROUNDS - 1, lastRoundScore: 0, lastWall: 0, reason: null, offers: [], words: null };
    s = runReducer(s, { type: 'startRound' });
    s = runReducer(s, { type: 'endRound', score: wallAt(RUN_ROUNDS) + 10, fumbled: false });
    assert.equal(s.phase, 'over');
    assert.equal(s.reason, 'cleared');
    const earned = runWinsEarned(s);
    // Full progress means NO round-scaling — the payout is the whole cumulative priced by the
    // divisor. Derived from RUN_WINS_DIVISOR rather than hard-coded: this assertion is about
    // progress being 1, not about what the divisor happens to be, and hard-coding /10 made a
    // pure re-tune look like a behaviour regression.
    assert.equal(earned, Math.round(s.cumulative / RUN_WINS_DIVISOR));
    bankRunWins(earned);
    assert.equal(getWins(), 500 + earned);
    assert.equal(getWinsLifetime(), 900 + earned);
  });
});

test('runWinsEarned is 0 before the run is over; bankRunWins(0) is a no-op', () => {
  withStorage({ 'taw.wins': '40' }, () => {
    assert.equal(runWinsEarned({ phase: 'round', cumulative: 999, round: 3 }), 0);
    assert.equal(bankRunWins(0), 40);
    assert.equal(getWins(), 40);
  });
});
