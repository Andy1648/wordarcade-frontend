// winsGroup.test.js — FUSE end screen (Andy: "i had 4 clutches which made screen expand"): the receipt
// is one row per bonus KIND, capped, and the rows still sum to every credit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBonusLines } from './winsGroup.js';

const b = (label, amount, id = `${label}-${amount}`) => ({ id, kind: 'bonus', label, amount });
const sum = (xs) => xs.reduce((a, x) => a + x.amount, 0);

test('repeated credits of one label merge into one row with a count and the summed amount', () => {
  const rows = groupBonusLines([b('CLUTCH!', 100, 'a'), b('CLUTCH!', 120, 'b'), b('CLUTCH!', 80, 'c'), b('CLUTCH!', 100, 'd')]);
  assert.deepEqual(rows, [{ id: 'a', label: 'CLUTCH!', amount: 400, count: 4 }]);
});

test('first-seen order is kept; non-bonus and zero entries are dropped', () => {
  const rows = groupBonusLines([b('FRENZY!', 50), { kind: 'word', label: 'X', amount: 9 }, b('CLUTCH!', 0), b('CLUTCH!', 10)]);
  assert.deepEqual(rows.map((r) => r.label), ['FRENZY!', 'CLUTCH!']);
});

test('past 3 kinds the tail folds into OTHER BONUSES and the total is unchanged', () => {
  const lines = [...Array.from({ length: 8 }, (_, i) => b('CLUTCH!', 10, `c${i}`)), b('FRENZY!', 20), b('COLLECTION 100', 30), b('ACHIEVEMENT', 40)];
  const rows = groupBonusLines(lines);
  assert.deepEqual(rows.map((r) => r.label), ['CLUTCH!', 'FRENZY!', 'OTHER BONUSES']);
  assert.equal(rows[2].amount, 70);
  assert.equal(rows[2].count, 2);
  assert.equal(sum(rows), sum(lines));
});
