// The in-game BOOST row follows the LONGER of the two wall-clock timers — the UPGRADES ×10 item (a code boost,
// taw.boost) and the Rebirth Rush OVERDRIVE (taw.overdrive). Before this, only the overdrive clock was watched, so
// a bought ×10 stayed on the HUD past its 5 minutes until the next screen (Andy oct8).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

test('liveBoostRemaining: the ×10 item boost counts even with no Rebirth Rush overdrive running', async () => {
  const { liveBoostRemaining } = await import('./liveBoost.js');
  const T = 1_000_000;
  store.clear();
  assert.equal(liveBoostRemaining(T), 0, 'nothing live');
  store.set('taw.boost', JSON.stringify({ until: T + 300_000, mult: 10 }));
  assert.equal(liveBoostRemaining(T), 300_000, 'the item boost arms the clock');
  assert.equal(liveBoostRemaining(T + 300_000), 0, 'and it ends on the timer');
  store.set('taw.overdrive', JSON.stringify({ playMs: 0, nextMs: null, until: T + 400_000 }));
  assert.equal(liveBoostRemaining(T), 400_000, 'the longer of the two wins');
});

test('a slot written during the ×15 weeks keeps its clock and runs at ×3, named OVERDRIVE; a ×3 code stays a BOOST', async () => {
  const { activeBoosts } = await import('./liveBoost.js');
  const { codeBoostMult, boostMult } = await import('./boost.js');
  const T = 1_800_000_000_000;
  const row = () => activeBoosts(T).find((b) => b.id === 'boost1');
  const set = (o) => globalThis.localStorage.setItem('taw.boost', JSON.stringify(o));
  set({ until: T + 200_000, mult: 15 });
  assert.equal(codeBoostMult(T), 3);
  assert.equal(boostMult(T), 3);
  assert.deepEqual([row().name, row().mult, row().ms], ['OVERDRIVE', '×3', 200_000]);
  set({ until: T + 200_000, mult: 3 }); // the TRIPLE code
  assert.deepEqual([row().name, row().mult], ['BOOST', '×3']);
  set({ until: T + 200_000, mult: 3, od: 1 }); // the shop / drop / an OVERDRIVE code
  assert.deepEqual([row().name, row().mult], ['OVERDRIVE', '×3']);
});
