// payout.test.js — the payout BREAKDOWN: the explanation has to match the money.
//
// The defect: "I got 40k and couldn't tell where it came from." A payout is a product of named
// multipliers (Rebirth Rush: MODE × REBIRTH × MARK × BOOST × FRENZY on the BASE) and once none were named. These tests pin the two properties that
// make the explanation trustworthy — it never quotes a factor the payout did not use, and the
// per-factor shares add up to exactly what was earned.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayout, inactivePayoutFactors, PAYOUT_FACTORS,
  beginPayoutLedger, notePayout, readPayoutLedger, clearPayoutLedger,
} from './payout.js';
import { roundWordXp } from './xp.js';

test('buildPayout multiplies every PAYING factor and reports the same total wins.js would pay', () => {
  const r = buildPayout({
    base: 100,
    factors: { mode: 2, rebirth: 5, bonus: 1.5, boost: 3 },
  });
  assert.equal(r.product, 2 * 5 * 1.5 * 3);
  // Economy v8: wins are the word's XP ÷ 10, and it is the XP that is snapped (to whole XP) — so the
  // receipt snaps on the XP grid too (×10, snap, ÷10). Snapping the WINS total to a multiple of
  // ten would print 20 for a word that paid 15.
  assert.equal(r.computed, roundWordXp(100 * 2 * 5 * 1.5 * 3 * 10) / 10);
  assert.equal(r.total, r.computed, 'with no granted amount passed, total IS the computed figure');
});

// REBIRTH RUSH: the receipt is BASE 10 × length/5 × MODE × REBIRTH × MARK × BOOST (× FRENZY). A caller
// that still passes a retired factor (difficulty, streak, forge, rarity, length, combo, lucky, cap) must
// neither get a row for it nor have it multiplied into PAID — that would claim a bonus the bank never paid.
test('retired factors are never named and never multiplied in', () => {
  const r = buildPayout({
    base: 10,
    factors: { mode: 2, difficulty: 1.5, streak: 1.2, forge: 1.3, rarity: 2.5, length: 1.1, combo: 1.6, lucky: 5, cap: 0.5 },
  });
  assert.deepEqual(r.rows.map((x) => x.key), ['mode']);
  assert.equal(r.product, 2);
  assert.equal(r.paid, 20);
  assert.deepEqual(PAYOUT_FACTORS.map((f) => f.key), ['mode', 'rebirth', 'bonus', 'frenzy', 'boost']);
  assert.equal(PAYOUT_FACTORS.find((f) => f.key === 'bonus').label, 'MARK');
});

// THE BOTTOM LINE FOLLOWS FROM THE ROWS. This replaces a test that asserted the opposite — that a
// caller-supplied `total` was what the panel showed. That is how a receipt came to list BASE 100,
// MODE x2, RARITY x2.5, LENGTH x1.16, COMBO x1.1 and then print PAID 0: the first two words of a
// round bank nothing (the 3-word gate), the caller passed that 0 through, and the panel printed a
// total that contradicted every line above it.
test('PAID is exactly the product of the listed rows, rounded — always', () => {
  const cases = [
    { base: 100, factors: { mode: 2, bonus: 1.25, boost: 3 } },
    { base: 100, factors: { mode: 1.5, rebirth: 25, bonus: 1.1, frenzy: 5 } },
    { base: 20, factors: {} },
    { base: 100, factors: { mode: 2, rarity: 2.5, combo: 1.3 } }, // retired factors: ignored, still adds up
  ];
  for (const c of cases) {
    const r = buildPayout(c);
    const fromRows = r.rows.reduce((a, row) => a * row.mult, 1);
    assert.ok(Math.abs(fromRows - r.product) < 1e-9, 'the listed rows ARE the product');
    assert.equal(r.paid, roundWordXp(c.base * fromRows * 10) / 10, `PAID must equal base x rows for ${JSON.stringify(c.factors)}`);
    assert.equal(r.paid, r.computed);
  }
});

test('the 3-WORD GATE shows as HELD, never as a PAID of zero', () => {
  // total 0 = banked nothing yet. The word is still worth what its rows say, and the panel says
  // so; `held` is what carries the other fact.
  const r = buildPayout({ base: 100, factors: { mode: 2, rebirth: 5 }, total: 0 });
  assert.equal(r.paid, roundWordXp(100 * 2 * 5 * 10) / 10, 'the bottom line is what the word is worth');
  assert.equal(r.total, 0, 'what was BANKED is still reported, for the ledger');
  assert.equal(r.held, true);
  // Past the gate, nothing is held.
  const paid = buildPayout({ base: 100, factors: { mode: 2, rebirth: 5 }, total: 500 });
  assert.equal(paid.held, false);
  // A word genuinely worth nothing is not "held" either — there is nothing to release.
  assert.equal(buildPayout({ base: 0, factors: {}, total: 0 }).held, false);
});

test('a ×1 factor is NOT drawn — the panel lists contributions, not the whole schema', () => {
  const r = buildPayout({ base: 100, factors: { mode: 2, rebirth: 1, bonus: 1, boost: 3 } });
  assert.deepEqual(r.rows.map((x) => x.key), ['mode', 'boost']);
});

test('rows come out in the fixed published order, never in object-key order', () => {
  const r = buildPayout({
    base: 100,
    // deliberately reversed on the way in
    factors: { boost: 3, frenzy: 5, bonus: 1.5, rebirth: 5, mode: 2 },
  });
  assert.deepEqual(r.rows.map((x) => x.key), ['mode', 'rebirth', 'bonus', 'frenzy', 'boost']);
  // ...and that order is the module's published one.
  assert.deepEqual(r.rows.map((x) => x.key), PAYOUT_FACTORS.map((f) => f.key));
});

test('every factor is labelled and classed as permanent (built) or word (just did)', () => {
  for (const f of PAYOUT_FACTORS) {
    assert.ok(f.label && f.label === f.label.toUpperCase(), `${f.key} needs an upper-case label`);
    assert.ok(f.kind === 'permanent' || f.kind === 'word', `${f.key} kind`);
  }
});

// REBIRTH RUSH: only factors that still PAY can be "off" (REBIRTH, MARK). COMBO / RARITY / LUCKY /
// STREAK are not in the formula, so naming them as switched-off would advertise a bonus that does not exist.
test('inactive factors carry the REASON, and only for factors that still pay', () => {
  const off = inactivePayoutFactors({ rebirth: 1, bonus: 1, combo: 1, rarity: 1, lucky: 1, streak: 1 });
  assert.ok(off.find((f) => f.key === 'rebirth' && /rebirth/.test(f.why)));
  assert.ok(off.find((f) => f.key === 'bonus' && f.label === 'MARK' && /mark/.test(f.why)));
  for (const k of ['combo', 'rarity', 'lucky', 'streak', 'difficulty', 'forge', 'wordSense']) {
    assert.equal(off.some((f) => f.key === k), false, `${k} does not pay — never listed`);
  }
  // An ACTIVE factor is never listed as inactive.
  assert.equal(inactivePayoutFactors({ rebirth: 5, bonus: 1.2 }).length, 0);
});

// ---- the round ledger ------------------------------------------------------------------------
test('the ledger shares add up to EXACTLY the wins earned above base', () => {
  clearPayoutLedger();
  beginPayoutLedger('wordBomb');
  notePayout({ base: 100, total: 600, factors: { mode: 2, bonus: 3 } });
  notePayout({ base: 100, total: 400, factors: { mode: 2, boost: 2 } });
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
  notePayout({ base: 100, total: 400, factors: { boost: 2, bonus: 2 } });
  const led = readPayoutLedger();
  const boost = led.rows.find((r) => r.key === 'boost');
  const mark = led.rows.find((r) => r.key === 'bonus');
  assert.ok(Math.abs(boost.share - mark.share) < 1e-12);
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
test('buildPayout reports WINS only — a game word pays no XP (v11 amended)', () => {
  const r = buildPayout({ base: 5, factors: { mode: 2, bonus: 1.5 } });
  assert.equal(r.paid, 15);
  assert.equal(r.xp, undefined, 'no XP line on a game receipt');
  assert.equal('levelFloor' in r, false, 'Option F is gone');
});

test('buildPayout carries the base TERMS so the panel can name them', () => {
  const r = buildPayout({ base: 5, letters: 5, perLetter: 10, factors: { mode: 2 } });
  assert.equal(r.letters, 5);
  assert.equal(r.perLetter, 10);
  // letters x perLetter IS the base, in XP units — the panel prints it in WINS (v11): "BASE 1 WINS / LETTER x 5 LETTERS".
  assert.equal(r.letters * r.perLetter, r.base * 10);
  // Absent/garbage terms degrade to null so the panel falls back to the bare base.
  const bare = buildPayout({ base: 5, factors: {} });
  assert.equal(bare.letters, null);
  assert.equal(bare.perLetter, null);
  assert.equal(buildPayout({ base: 5, letters: 0, perLetter: -3, factors: {} }).letters, null);
});

// O12 — the WINNER bonus: +50% of the game's word wins, its own row, in the TOTAL, paid once.
import { noteRoundBonus, winnerBonusFor, WINNER_BONUS } from './payout.js';
test('winner bonus is +50% of the round, rides the total, and is noted once per round', async () => {
  const { beginPayoutLedger, notePayout, readPayoutLedger } = await import('./payout.js');
  assert.equal(WINNER_BONUS, 0.5);
  assert.equal(winnerBonusFor(0), 0);
  assert.equal(winnerBonusFor(301), 151);
  beginPayoutLedger('word-bomb');
  notePayout({ base: 100, factors: {}, total: 100 });
  notePayout({ base: 100, factors: {}, total: 200 });
  const b = winnerBonusFor(readPayoutLedger().total);
  assert.equal(b, 150);
  assert.equal(noteRoundBonus({ key: 'winner', label: 'WINNER BONUS', mult: 1.5, wins: b }), true);
  assert.equal(noteRoundBonus({ key: 'winner', label: 'WINNER BONUS', mult: 1.5, wins: b }), false, 'a re-delivered game_over never pays twice');
  const led = readPayoutLedger();
  assert.equal(led.total, 450);
  assert.deepEqual(led.bonuses.map((x) => [x.key, x.wins]), [['winner', 150]]);
  assert.equal(noteRoundBonus({ key: 'winner', wins: 0 }), false);
});
