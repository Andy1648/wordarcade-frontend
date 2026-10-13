// rebirthWords.test.js — the client mirror of 035's WORDS PER REBIRTH: same number as the server, menu keys never count,
// a reset counts every word since, and the readiness check waits for the words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS_PER_REBIRTH, RB_WORDS_KEY, wordsSinceRebirth, markRebirthWords, lifetimeGameWords } from './rebirthWords.js';
import { WORDS_PER_RB } from '../leaderboard/rebirthRules.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('WORDS_PER_REBIRTH matches the server rule (037 / rebirthRules.js)', () => {
  assert.equal(WORDS_PER_REBIRTH, WORDS_PER_RB);
  assert.equal(WORDS_PER_REBIRTH, 10); // 037
});

test('words since the last rebirth: marked at a rebirth; a reset counts every word since; never negative', () => {
  withStorage({}, (m) => {
    const total = lifetimeGameWords();
    assert.equal(wordsSinceRebirth(), total, 'no mark = every game word counts');
    markRebirthWords();
    assert.equal(m.get(RB_WORDS_KEY), String(total));
    assert.equal(wordsSinceRebirth(), 0);
    m.set(RB_WORDS_KEY, String(total + 500)); // a reset dropped the words below the mark
    assert.equal(wordsSinceRebirth(), total);
  });
});
