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
  // Economy v8: wins are the word's XP ÷ 10, and it is the XP that round10 snaps — so the
  // receipt snaps on the XP grid too (×10, snap, ÷10). Snapping the WINS total to a multiple of
  // ten would print 20 for a word that paid 15.
  assert.equal(r.computed, round10(100 * 2 * 1.5 * 2.5 * 1.6 * 10) / 10);
  assert.equal(r.total, r.computed, 'with no granted amount passed, total IS the computed figure');
});

// THE BOTTOM LINE FOLLOWS FROM THE ROWS. This replaces a test that asserted the opposite — that a
// caller-supplied `total` was what the panel showed. That is how a receipt came to list BASE 100,
// MODE x2, RARITY x2.5, LENGTH x1.16, COMBO x1.1 and then print PAID 0: the first two words of a
// round bank nothing (the 3-word gate), the caller passed that 0 through, and the panel printed a
// total that contradicted every line above it.
test('PAID is exactly the product of the listed rows, rounded — always', () => {
  const cases = [
    { base: 100, factors: { mode: 2, rarity: 2.5, length: 1.16, combo: 1.1 } },
    { base: 100, factors: { mode: 2, difficulty: 1.5, rarity: 4, length: 1.12, combo: 1.3, rebirth: 3 } },
    { base: 20, factors: {} },
    { base: 100, factors: { mode: 2, cap: 0.4 } }, // a factor BELOW 1 still has to multiply out
  ];
  for (const c of cases) {
    const r = buildPayout(c);
    const fromRows = r.rows.reduce((a, row) => a * row.mult, 1);
    assert.ok(Math.abs(fromRows - r.product) < 1e-9, 'the listed rows ARE the product');
    assert.equal(r.paid, round10(c.base * fromRows * 10) / 10, `PAID must equal base x rows for ${JSON.stringify(c.factors)}`);
    assert.equal(r.paid, r.computed);
  }
});

test('the 3-WORD GATE shows as HELD, never as a PAID of zero', () => {
  // total 0 = banked nothing yet. The word is still worth what its rows say, and the panel says
  // so; `held` is what carries the other fact.
  const r = buildPayout({ base: 100, factors: { mode: 2, rarity: 2.5 }, total: 0 });
  assert.equal(r.paid, round10(100 * 2 * 2.5 * 10) / 10, 'the bottom line is what the word is worth');
  assert.equal(r.total, 0, 'what was BANKED is still reported, for the ledger');
  assert.equal(r.held, true);
  // Past the gate, nothing is held.
  const paid = buildPayout({ base: 100, factors: { mode: 2, rarity: 2.5 }, total: 500 });
  assert.equal(paid.held, false);
  // A word genuinely worth nothing is not "held" either — there is nothing to release.
  assert.equal(buildPayout({ base: 0, factors: {}, total: 0 }).held, false);
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

// UPDATED (feat/cut-secrets-rarity). This used to be about WORD SENSE — the upgrade that scaled a
// word's rarity EXCESS and therefore did nothing at all on a COMMON word while the shop card never
// said so. The upgrade is deleted (rarity is now something you SEE when the word lands, not a
// hidden multiplier to buy a hidden multiplier on), so the case moves to the factors that are
// still switchable: COMBO, RARITY and the LUCKY roll.
test('inactive factors carry the REASON — the answer when the number looks small', () => {
  const off = inactivePayoutFactors({ combo: 1, rarity: 1, lucky: 1 }, { band: 'COMMON' });
  assert.ok(off.find((f) => f.key === 'combo' && /streak/.test(f.why)));
  assert.ok(off.find((f) => f.key === 'rarity' && /COMMON/.test(f.why)));
  assert.ok(off.find((f) => f.key === 'lucky'));
  // An ACTIVE factor is never listed as inactive.
  assert.equal(inactivePayoutFactors({ combo: 2 }).some((f) => f.key === 'combo'), false);
  // ...and WORD SENSE is not a factor at all any more.
  assert.equal(inactivePayoutFactors({}).some((f) => f.key === 'wordSense'), false);
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

// ---- THE RECEIPT CARRIES BOTH CURRENCIES AND NAMES ITS BASE ---------------------------------
test('buildPayout reports the award in XP as well as WINS (they are one number)', () => {
  const r = buildPayout({ base: 5, factors: { mode: 2, difficulty: 1.5 } });
  assert.equal(r.paid, 15);
  // Wins are the word's XP / 10 (Economy v8), so the XP is the same award times ten. Asserted
  // against the WINS figure rather than recomputed, which is the invariant that matters.
  assert.equal(r.xp, r.paid * 10);
  assert.equal(r.xp, 150);
});

test('buildPayout carries the base TERMS so the panel can name them', () => {
  const r = buildPayout({ base: 5, letters: 5, perLetter: 10, factors: { mode: 2 } });
  assert.equal(r.letters, 5);
  assert.equal(r.perLetter, 10);
  // letters x perLetter IS the base, in XP — the panel prints "5 LETTERS x 10", not "BASE 5".
  assert.equal(r.letters * r.perLetter, r.base * 10);
  // Absent/garbage terms degrade to null so the panel falls back to the bare base.
  const bare = buildPayout({ base: 5, factors: {} });
  assert.equal(bare.letters, null);
  assert.equal(bare.perLetter, null);
  assert.equal(buildPayout({ base: 5, letters: 0, perLetter: -3, factors: {} }).letters, null);
});
