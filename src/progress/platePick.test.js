import { test } from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const P = await import('./platePick.js');

test('plate pick: none → the current rank; a reached pick shows; an unreached pick falls back', () => {
  mem.clear();
  assert.equal(P.shownPlateIndex(4), 4);
  P.setPlatePick(2);
  assert.equal(P.shownPlateIndex(4), 2);
  P.setPlatePick(9);
  assert.equal(P.shownPlateIndex(4), 4, 'cannot show a rank not reached yet');
  P.setPlatePick(null);
  assert.equal(P.getPlatePick(), null);
});
