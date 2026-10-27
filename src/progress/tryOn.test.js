// node --test — LOOKS TRY-ON (oct26): the try window, the menu's streak thresholds, the +N a tried style would pay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRY_MS, tryStreak, tryGain, padLetter } from './tryOn.js';


test('a try lasts ~10 seconds', () => {
  assert.equal(TRY_MS, 10_000);
});

test('the streak grows the pop at the menu thresholds (10 / 25 / 50) and resets after a pause', () => {
  const st = { count: 0, lastTime: 0 };
  const tiers = [];
  for (let i = 0; i < 50; i++) tiers.push(tryStreak(st, 10_000 + i * 100));
  assert.equal(tiers[0], 0);
  assert.equal(tiers[9], 1);
  assert.equal(tiers[24], 2);
  assert.equal(tiers[49], 3);
  assert.ok(tiers.every((t) => t >= 0 && t <= 3));
  assert.equal(tryStreak(st, 10_000 + 49 * 100 + 1300), 0); // a 1.3 s gap → back to tier 0
});

test('a pricier style shows a bigger +N, never below 1', () => {
  const g0 = tryGain('classic');
  const g1 = tryGain('legend');
  assert.ok(g0 >= 1);
  assert.ok(g1 >= g0);
  assert.ok(tryGain('nope') >= 1);
});

test('pad taps stand in for letters', () => {
  for (let i = 0; i < 60; i++) assert.match(padLetter(i), /^[A-Z]$/);
});
