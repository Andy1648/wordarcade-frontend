// combo.test.js — the WINS combo model (Job 2). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comboMultiplier,
  freshCombo,
  comboAccept,
  comboBreak,
  COMBO_MAX,
  COMBO_STEP,
} from './combo.js';
import { awardWins, perWordWins } from './wins.js';

test('comboMultiplier climbs +0.1 per accept and caps at 3.0', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.ok(Math.abs(comboMultiplier(1) - 1.1) < 1e-9);
  assert.ok(Math.abs(comboMultiplier(5) - 1.5) < 1e-9);
  assert.equal(comboMultiplier(20), COMBO_MAX);
  assert.equal(comboMultiplier(21), COMBO_MAX); // never exceeds the cap
  assert.equal(comboMultiplier(1000), COMBO_MAX);
  assert.equal(COMBO_STEP, 0.1);
});

test('a fresh run starts at ×1.0 with nothing weighted', () => {
  const c = freshCombo();
  assert.deepEqual(c, { streak: 0, mult: 1, weighted: 0, breaks: 0 });
});

test('accepts build streak + multiplier and accumulate the weighted word count', () => {
  let c = freshCombo();
  c = comboAccept(c); // word 1 -> ×1.1
  assert.equal(c.streak, 1);
  assert.ok(Math.abs(c.mult - 1.1) < 1e-9);
  assert.ok(Math.abs(c.weighted - 1.1) < 1e-9);
  c = comboAccept(c); // word 2 -> ×1.2
  assert.equal(c.streak, 2);
  assert.ok(Math.abs(c.mult - 1.2) < 1e-9);
  assert.ok(Math.abs(c.weighted - (1.1 + 1.2)) < 1e-9);
});

test('the multiplier caps at 3.0 even on a long streak', () => {
  let c = freshCombo();
  for (let i = 0; i < 40; i++) c = comboAccept(c);
  assert.equal(c.mult, COMBO_MAX);
  // Weighted is the sum of each word's (capped) multiplier — strictly > raw count.
  assert.ok(c.weighted > 40);
});

test('a reject/timeout resets the streak to ×1.0 and bumps breaks (only with a real streak)', () => {
  let c = freshCombo();
  c = comboAccept(c);
  c = comboAccept(c);
  const beforeWeighted = c.weighted;
  c = comboBreak(c);
  assert.equal(c.streak, 0);
  assert.equal(c.mult, 1);
  assert.equal(c.breaks, 1);
  assert.equal(c.weighted, beforeWeighted); // a break never removes earned weight

  // Breaking with no active streak does NOT fire a shake (breaks unchanged).
  const c2 = comboBreak(c);
  assert.equal(c2.breaks, 1);
});

test('combo multiplies the payout via wins.js weightedWords (stacks on the per-word rate)', () => {
  // Five accepts with no break -> weighted = 1.1+1.2+1.3+1.4+1.5 = 6.5
  let c = freshCombo();
  for (let i = 0; i < 5; i++) c = comboAccept(c);
  assert.ok(Math.abs(c.weighted - 6.5) < 1e-9);

  const rate = perWordWins({ mode: 'fuse', rebirthCount: 0 }); // 20 at R0 (fuse ×1 post-rebalance)
  const plain = awardWins({ mode: 'fuse', wordsAccepted: 5, rebirthCount: 0 });
  const boosted = awardWins({ mode: 'fuse', wordsAccepted: 5, weightedWords: c.weighted, rebirthCount: 0 });

  assert.equal(plain, 5 * rate); // no combo -> exactly count × rate
  assert.ok(boosted > plain); // combo pays more
  // round10(6.5 × 20) = round10(130) = 130
  assert.equal(boosted, 130);
});

test('weightedWords never lowers a payout below the plain count, and the <3 gate still applies', () => {
  // Below the gate, even a big weighted count pays nothing.
  assert.equal(awardWins({ mode: 'chain', wordsAccepted: 2, weightedWords: 99, rebirthCount: 0 }), 0);
  // A degenerate/zero weighted falls back to the plain count.
  const plain = awardWins({ mode: 'chain', wordsAccepted: 4, rebirthCount: 0 });
  assert.equal(awardWins({ mode: 'chain', wordsAccepted: 4, weightedWords: 0, rebirthCount: 0 }), plain);
});
