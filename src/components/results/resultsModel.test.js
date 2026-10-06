// resultsModel.test.js — the v2 RESULTS card's numbers (P9b): placement, XP travelled, the chain, every win a line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementOrder, xpBetween, chainOf, tallyLines, stampFor } from './resultsModel.js';

const P = ['me', 'a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() }));

test('placement: winner #1, then whoever went out LAST', () => {
  const t = placementOrder({ players: P, winnerId: 'a', elimOrder: ['e', 'd', 'me', 'c', 'b'], wordsBy: { me: 4, a: 9 } });
  assert.deepEqual(t.map((r) => r.id), ['a', 'b', 'c', 'me', 'd', 'e']);
  assert.deepEqual(t.map((r) => r.place), [1, 2, 3, 4, 5, 6]);
  assert.equal(t.find((r) => r.id === 'me').words, 4);
});

test('placement: a seat that never went out sits under the winner (by words); duplicates / unknown ids ignored', () => {
  const t = placementOrder({ players: [...P, P[1]], winnerId: 'me', elimOrder: ['zz', 'e', 'd'], wordsBy: { b: 2, c: 7 } });
  assert.deepEqual(t.map((r) => r.id).slice(0, 2), ['me', 'c']);
  assert.equal(t.length, 6);
  assert.deepEqual(t.slice(-2).map((r) => r.id), ['d', 'e']);
});

test('xpBetween sums the curve across levels; same level = the fraction; drops / too far', () => {
  const need = (l) => 100 * l;
  assert.equal(Math.round(xpBetween({ level: 3, frac: 0.2 }, { level: 3, frac: 0.7 }, need)), 150);
  assert.equal(Math.round(xpBetween({ level: 3, frac: 0.5 }, { level: 5, frac: 0.25 }, need)), 150 + 400 + 125);
  assert.equal(xpBetween({ level: 5, frac: 0.5 }, { level: 3, frac: 0.5 }, need), 0);
  assert.equal(xpBetween({ level: 1, frac: 0 }, { level: 99999, frac: 0 }, need), null);
});

test('the chain: the ledger factors (≠ ×1) and the effective × that turns BASE into the WORDS line', () => {
  const ledger = { base: 40, rows: [{ key: 'rebirth', label: 'REBIRTH', mult: 8 }, { key: 'mode', label: 'MODE', mult: 1 }, { key: 'bonus', label: 'MARK', mult: 1.25 }] };
  const c = chainOf(ledger, 400);
  assert.equal(c.base, 40);
  assert.equal(c.mult, 10);
  assert.deepEqual(c.chips.map((x) => x.label), ['REBIRTH', 'MARK']);
  assert.deepEqual(chainOf(null, 0), { base: 0, mult: 0, chips: [] });
});

test('every credited win is ONE line; the total is exactly their sum; the ledger adds ×mult + note', () => {
  const { lines, total } = tallyLines({
    wordsWins: 120,
    bonusLines: [
      { id: 1, kind: 'bonus', label: 'WINNER BONUS', amount: 60 },
      { id: 2, kind: 'bonus', label: 'SECRET FIND', amount: 500 },
      { id: 3, kind: 'word', label: 'IGNORED', amount: 9 },
      { id: 4, kind: 'bonus', label: 'ZERO', amount: 0 },
    ],
    ledger: { bonuses: [{ key: 'winner', label: 'WINNER BONUS', mult: 1.5, wins: 60, note: 'MATCH BONUS NEEDS 5+ WORDS' }] },
  });
  assert.deepEqual(lines.map((l) => [l.label, l.amount]), [['WORDS', 120], ['WINNER BONUS', 60], ['SECRET FIND', 500]]);
  assert.equal(total, 680);
  assert.equal(lines[1].mult, 1.5);
  assert.equal(lines[1].note, 'MATCH BONUS NEEDS 5+ WORDS');
  assert.equal(lines[2].mult, null);
});

test('stamp: WIN / TOP 3 / KO\'D', () => {
  assert.equal(stampFor(1, true).text, 'WIN');
  assert.equal(stampFor(3, false).text, 'TOP 3');
  assert.equal(stampFor(4, false).text, "KO'D");
});

test('SEASON 2 (FINAL): the REBIRTH row splits into REBIRTH ×2^R and ★ ×(1 + ★)', () => {
  const ledger = { base: 40, rows: [{ key: 'rebirth', label: 'REBIRTH', mult: 16 }, { key: 'bonus', label: 'MARK', mult: 1.5 }] };
  const c = chainOf(ledger, 960, { rebirth: 8, star: 2 });
  assert.deepEqual(c.chips.map((x) => [x.label, x.mult]), [['REBIRTH', 8], ['★', 2], ['MARK', 1.5]]);
  assert.equal(c.mult, 24);
  assert.deepEqual(chainOf(ledger, 960, { rebirth: 8, star: 1 }).chips.map((x) => x.label), ['REBIRTH', 'MARK']);
});
