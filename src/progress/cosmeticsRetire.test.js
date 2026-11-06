import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { refundOf, retireCosmetics, takeRefundNote, RETIRED_KEY, NOTE_KEY } from './cosmeticsRetire.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
beforeEach(() => store.clear());

test('refundOf: only PAID pieces count — wheel confetti and the free click packs never do', () => {
  assert.deepEqual(refundOf(['firework', 'confetti', 'jackpot', 'blast'], ['classic', 'thock', 'marble', 'crystal', 'inferno']), { gems: 500 + 1500 + 75 + 1920, fx: ['firework', 'blast'], sounds: ['marble', 'crystal'] });
  assert.deepEqual(refundOf(undefined, null), { gems: 0, fx: [], sounds: [] });
});

test('retireCosmetics: refunds once, strips the ids, resets the worn slots, leaves frames + pop styles alone', () => {
  store.set('taw.s2.kit', JSON.stringify({ own: ['firework', 'confetti', 'graffiti'], frame: 'graffiti', fx: 'firework' }));
  store.set('taw.owned', JSON.stringify(['classic', 'thock', 'inferno', 'glass']));
  store.set('taw.equipped', JSON.stringify({ popStyle: 'inferno', soundPack: 'glass' }));
  const paid = [];
  const r = retireCosmetics((n, why, meta) => paid.push([n, why, meta.detail]));
  assert.equal(r.gems, 500 + 570);
  assert.deepEqual(paid, [[1070, 'refund', 'cosmetics-retired']]);
  assert.deepEqual(JSON.parse(store.get('taw.s2.kit')), { own: ['graffiti'], frame: 'graffiti', fx: null });
  assert.deepEqual(JSON.parse(store.get('taw.owned')), ['classic', 'thock', 'inferno']);
  assert.deepEqual(JSON.parse(store.get('taw.equipped')), { popStyle: 'inferno', soundPack: 'thock' });
  assert.equal(store.get(RETIRED_KEY), '1');
  // a second boot pays nothing
  assert.equal(retireCosmetics(() => paid.push('again')), null);
  assert.equal(paid.length, 1);
  // the notice is said once
  assert.equal(takeRefundNote(), 1070);
  assert.equal(takeRefundNote(), 0);
});

test('retireCosmetics: a save that never paid gets no notice', () => {
  store.set('taw.s2.kit', JSON.stringify({ own: ['confetti'], frame: null, fx: 'confetti' }));
  let called = false;
  const r = retireCosmetics(() => { called = true; });
  assert.equal(r.gems, 0);
  assert.equal(called, false);
  assert.equal(store.has(NOTE_KEY), false);
  assert.deepEqual(JSON.parse(store.get('taw.s2.kit')).own, []);
});
