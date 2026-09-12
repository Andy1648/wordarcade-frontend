// payout.test.js — the payout BREAKDOWN: the explanation has to match the money.
//
// The defect: "I got 40k and couldn't tell where it came from." A payout is a product of up to
// nine multipliers and none of them were named on screen. These tests pin the two properties that
// make the explanation trustworthy — it never quotes a factor the payout did not use, and the
// per-factor shares add up to exactly what was earned.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayout, inactivePayoutFactors, PAYOUT_FACTORS,
  beginPayoutLedger, notePayout, readPayoutLedger, clearPayoutLedger,
} from './payout.js';
import { round10 } from './xp.js';

test('buildPayout multiplies every factor and reports the same total wins.js would pay', () => {
  const r = buildPayout({
    base: 100,
    factors: { mode: 2, difficulty: 1.5, rarity: 2.5, combo: 1.6 },
  });
  assert.equal(r.product, 2 * 1.5 * 2.5 * 1.6);
  assert.equal(r.computed, round10(100 * 2 * 1.5 * 2.5 * 1.6));
  assert.equal(r.total, r.computed, 'with no granted amount passed, total IS the computed figure');
});

test('the GRANTED amount wins: a breakdown can never contradict the ledger', () => {
  // The live payout is snapped per grant and can differ from a recomputation by a rounding step.
  // When the caller knows what was actually banked, that number is what is shown.
  const r = buildPayout({ base: 100, factors: { mode: 2 }, total: 12345 });
  assert.equal(r.total, 12345);
  assert.equal(r.computed, 200, 'the recomputation is still reported, for a test to compare');
});

test('a ×1 factor is NOT drawn — the panel lists contributions, not the whole schema', () => {
  const r = buildPayout({ base: 100, factors: { mode: 2, combo: 1, lucky: 1, rarity: 1.5 } });
  assert.deepEqual(r.rows.map((x) => x.key), ['mode', 'rarity']);
});

test('rows come out in the fixed published order, never in object-key order', () => {
  const r = buildPayout({
    base: 100,
    // deliberately reversed on the way in
    factors: { lucky: 5, combo: 2, rebirth: 3, mode: 2 },
  });
  assert.deepEqual(r.rows.map((x) => x.key), ['mode', 'rebirth', 'combo', 'lucky']);
  // ...and that order is the module's published one.
  const want = PAYOUT_FACTORS.map((f) => f.key).filter((k) => ['mode', 'rebirth', 'combo', 'lucky'].includes(k));
  assert.deepEqual(r.rows.map((x) => x.key), want);
});

test('every factor is labelled and classed as permanent (built) or word (just did)', () => {
  for (const f of PAYOUT_FACTORS) {
    assert.ok(f.label && f.label === f.label.toUpperCase(), `${f.key} needs an upper-case label`);
    assert.ok(f.kind === 'permanent' || f.kind === 'word', `${f.key} kind`);
  }
});

test('inactive factors carry the REASON — the answer when the number looks small', () => {
  // WORD SENSE is the one that most needs this: it scales rarity EXCESS, so on a COMMON word an
  // owned, paid-for upgrade does precisely nothing and the shop never said so.
  const off = inactivePayoutFactors({ wordSense: 1, combo: 1, rarity: 1 }, { band: 'COMMON' });
  const ws = off.find((f) => f.key === 'wordSense');
  assert.ok(ws && /COMMON/.test(ws.why), ws && ws.why);
  const rare = inactivePayoutFactors({ wordSense: 1 }, { band: 'RARE' }).find((f) => f.key === 'wordSense');
  assert.ok(rare && /not bought/.test(rare.why), rare && rare.why);
  // An ACTIVE factor is never listed as inactive.
  assert.equal(inactivePayoutFactors({ combo: 2 }).some((f) => f.key === 'combo'), false);
});

// ---- the round ledger ------------------------------------------------------------------------
test('the ledger shares add up to EXACTLY the wins earned above base', () => {
  clearPayoutLedger();
  beginPayoutLedger('wordBomb');
  notePayout({ base: 100, total: 600, factors: { mode: 2, rarity: 3 } });
  notePayout({ base: 100, total: 400, factors: { mode: 2, combo: 2 } });
  notePayout({ base: 100, total: 200, factors: { mode: 2 } });
  const led = readPayoutLedger();
  assert.equal(led.words, 3);
  assert.equal(led.base, 300);
  assert.equal(led.total, 1200);
  assert.equal(led.above, 900);
  // Attribution splits the amount above base in proportion to ln(mult); it must LOSE NOTHING.
  const summed = led.rows.reduce((a, r) => a + r.wins, 0);
  assert.ok(Math.abs(summed - led.above) <= led.rows.length, `shares ${summed} vs ${led.above}`);
  const shares = led.rows.reduce((a, r) => a + r.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9, `shares must sum to 1, got ${shares}`);
});

test('the ledger ranks by share, so the biggest reason is the first thing read', () => {
  clearPayoutLedger();
  beginPayoutLedger('fuse');
  for (let i = 0; i < 10; i++) notePayout({ base: 100, total: 1000, factors: { rebirth: 9, mode: 1.2 } });
  const led = readPayoutLedger();
  assert.equal(led.rows[0].key, 'rebirth');
  assert.ok(led.rows[0].share > led.rows[1].share);
  // The reported per-factor multiplier is the round's geometric mean — comparable to a shop card.
  assert.ok(Math.abs(led.rows[0].mult - 9) < 1e-6, led.rows[0].mult);
});

test('two equal multipliers get equal credit, whatever order they arrived in', () => {
  clearPayoutLedger();
  beginPayoutLedger('chain');
  notePayout({ base: 100, total: 400, factors: { combo: 2, rarity: 2 } });
  const led = readPayoutLedger();
  const combo = led.rows.find((r) => r.key === 'combo');
  const rarity = led.rows.find((r) => r.key === 'rarity');
  assert.ok(Math.abs(combo.share - rarity.share) < 1e-12);
});

test('a ledger that was never opened reads as null, and noting into none does not throw', () => {
  clearPayoutLedger();
  assert.equal(readPayoutLedger(), null);
  assert.doesNotThrow(() => notePayout({ base: 100, total: 200, factors: { mode: 2 } }));
  assert.equal(readPayoutLedger(), null);
});

test('a round with no multipliers at all reports zero above base and no rows', () => {
  clearPayoutLedger();
  beginPayoutLedger('blitz');
  notePayout({ base: 100, total: 100, factors: {} });
  const led = readPayoutLedger();
  assert.equal(led.above, 0);
  assert.deepEqual(led.rows, []);
});
