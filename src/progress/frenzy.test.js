import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRENZY_KEY, FRENZY_MS, FRENZY_MULT, frenzyRemaining, frenzyMult, startFrenzy, formatFrenzy } from './frenzy.js';
import { perWordFactors, perWordWins } from './wins.js';

function withStorage(fn) {
  const m = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('FRENZY: 5 real minutes of ×5, FUSE only, persisted as a wall-clock expiry', () => {
  withStorage((m) => {
    const t0 = 1_000_000;
    assert.equal(frenzyRemaining(t0), 0);
    assert.equal(frenzyMult('fuse', t0), 1);
    startFrenzy(t0);
    assert.equal(Number(m.get(FRENZY_KEY)), t0 + FRENZY_MS);
    assert.equal(frenzyRemaining(t0 + 1000), FRENZY_MS - 1000);
    assert.equal(frenzyMult('fuse', t0 + 1000), FRENZY_MULT);
    assert.equal(frenzyMult('chain', t0 + 1000), 1, 'FRENZY is a FUSE mechanic');
    assert.equal(frenzyMult('fuse', t0 + FRENZY_MS + 1), 1, 'and it ends on the clock');
  });
});

test('FRENZY: a clear while it runs does not extend it (no permanent ×5)', () => {
  withStorage(() => {
    const t0 = 5_000;
    assert.equal(startFrenzy(t0).started, true);
    const again = startFrenzy(t0 + 60_000);
    assert.equal(again.started, false);
    assert.equal(frenzyRemaining(t0 + 60_000), FRENZY_MS - 60_000);
    assert.equal(startFrenzy(t0 + FRENZY_MS + 1).started, true, 'a clear after it ends starts a new one');
  });
});

test('FRENZY is a named factor of the one payout stack (receipt = bank)', () => {
  withStorage(() => {
    const o = { mode: 'fuse', rebirthCount: 0, streakMult: 1, masteryMult: 1, keyTier: 0 };
    const before = perWordWins(o);
    assert.equal(perWordFactors(o).frenzy, 1);
    startFrenzy(Date.now());
    assert.equal(perWordFactors(o).frenzy, FRENZY_MULT);
    assert.equal(perWordWins(o), before * FRENZY_MULT);
  });
});

test('formatFrenzy is m:ss', () => {
  assert.equal(formatFrenzy(FRENZY_MS), '5:00');
  assert.equal(formatFrenzy(61_001), '1:02');
  assert.equal(formatFrenzy(0), '0:00');
});

import { isClutch, CLUTCH_MS } from './frenzy.js';
test('CLUTCH: a word with 2.0 s or less left', () => {
  assert.equal(CLUTCH_MS, 2000);
  assert.equal(isClutch(1999), true);
  assert.equal(isClutch(2000), true);
  assert.equal(isClutch(2001), false);
  assert.equal(isClutch(null), false);
});
