// streakOnAccept.test.js — playing CHAIN or FUSE must count toward the daily streak.
//
// Those two modes never route through wordCount.addWords (that's the bug this fixes); instead they
// touch the streak on EACH accepted word via the shared accept path: useSoloGame → submitSoloWord
// → onAccept (which both games wire to progress/streak.touchStreak). These tests exercise the REAL
// engines + the SAME submitSoloWord + the SAME touchStreak the hook uses, with no React — so an
// accepted word in either mode is proven to bump the streak, and a rejected word is proven not to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createChainEngine } from './chain.js';
import { createFuseEngine } from './fuse.js';
import { submitSoloWord } from './shared.js';
import { touchStreak, getStreak } from '../progress/streak.js';

function memStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}
function install(s) {
  globalThis.localStorage = s;
}

// A synthetic CHAIN dictionary (mirrors chain.test.js's `synth`): every letter gets 3 common
// continuations so no dead-end/reroute fires; with rng:()=>0 the opener is 'a'.
function synthChain() {
  const accept = new Set();
  const topCommon = [];
  for (const L of 'abcdefghijklmnopqrstuvwxyz') {
    for (const s of ['qx', 'qy', 'qz']) {
      const w = L + s;
      accept.add(w);
      topCommon.push(w);
    }
  }
  return { accept, topCommon };
}

test('CHAIN: one accepted word bumps the streak day', () => {
  install(memStorage());
  assert.equal(getStreak().count, 0);

  const { accept, topCommon } = synthChain();
  accept.add('aab'); // starts with the opener 'a', in the accept set
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 });
  assert.equal(eng.state.requiredLetter, 'a');

  const r = submitSoloWord(eng, 'aab', touchStreak);
  assert.equal(r.ok, true);
  assert.equal(getStreak().count, 1); // the accepted word counted today
});

test('FUSE: one accepted word bumps the streak day', () => {
  install(memStorage());
  assert.equal(getStreak().count, 0);

  // All tier pools hold the same fragment so the served fragment is deterministically 'abc'.
  const pools = { e: ['abc'], m: ['abc'], h: ['abc'], b: ['abc'] };
  const accept = new Set(['abcde']); // contains 'abc', in the accept set
  const eng = createFuseEngine({ accept, pools, rng: () => 0 });
  eng.start();
  assert.equal(eng.state.fragment, 'abc');

  const r = submitSoloWord(eng, 'abcde', touchStreak);
  assert.equal(r.ok, true);
  assert.equal(getStreak().count, 1);
});

test('a REJECTED solo word does not touch the streak', () => {
  install(memStorage());
  const { accept, topCommon } = synthChain();
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 }); // opener 'a'

  const r = submitSoloWord(eng, 'zzz', touchStreak); // wrong start letter → rejected
  assert.equal(r.ok, false);
  assert.equal(getStreak().count, 0); // nothing counted
});
