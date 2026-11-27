// bestLane.test.js — the solo BEST LANE (nov26): a record is the right answers after each answer; the lane races
// it at the same point; only a run with MORE right answers replaces it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { paceOf, bestAt, readBest, saveIfBest } from './bestLane.js';

const mem = new Map();
globalThis.window = { localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) } };

test('pace: right answers after each answer', () => {
  assert.deepEqual(paceOf([{ ok: true }, { ok: false }, { ok: true }, { ok: true }]), [0, 1, 1, 2, 3]);
  assert.deepEqual(paceOf([]), [0]);
});

test('bestAt: the record at the same point, held at its end once its run is over', () => {
  const pace = [0, 1, 1, 2];
  assert.equal(bestAt(pace, 0), 0);
  assert.equal(bestAt(pace, 2), 1);
  assert.equal(bestAt(pace, 9), 2);
  assert.equal(bestAt(null, 3), null);
});

test('saveIfBest: the first run sets the record, only a better one replaces it, per language + mode + length', () => {
  const run = (oks) => oks.map((ok) => ({ ok }));
  assert.deepEqual(saveIfBest('es', 'lineup', 4, run([true, false, true, false])), { isNew: true, beat: false });
  assert.deepEqual(readBest('es', 'lineup', 4), [0, 1, 1, 2, 2]);
  assert.deepEqual(saveIfBest('es', 'lineup', 4, run([true, true, false, false])), { isNew: false, beat: false }, 'a tie keeps the old record');
  assert.deepEqual(saveIfBest('es', 'lineup', 4, run([true, true, true, false])), { isNew: true, beat: true });
  assert.equal(readBest('fr', 'lineup', 4), null, 'another language has its own record');
  assert.equal(readBest('es', 'briefing', 4), null, 'another mode has its own record');
  assert.deepEqual(saveIfBest('es', 'lineup', 4, run([false, false])), { isNew: false, beat: false }, 'no right answers is never a record');
});
