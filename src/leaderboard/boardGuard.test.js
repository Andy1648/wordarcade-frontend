// boardGuard.test.js — a device behind its own board row never pushes (Andy oct17 second-device reset).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behindBoard, adoptRebirths, pushAllowed } from './boardGuard.js';

const row = (o = {}) => ({ stars: 0, rebirths: 4, level: 60, lifetime_words: 900, lifetime_letters: 5000, ...o });
const me = (o = {}) => ({ stars: 0, rebirths: 4, level: 60, lifetimeWords: 900, lifetimeLetters: 5000, ...o });

test('a fresh second device (LV 1, nothing played) is behind the account row', () => {
  assert.equal(behindBoard(me({ rebirths: 0, level: 1, lifetimeWords: 0, lifetimeLetters: 0 }), row()), true);
});

test('equal or ahead is not behind (the device that owns the progress keeps pushing)', () => {
  assert.equal(behindBoard(me(), row()), false);
  assert.equal(behindBoard(me({ level: 61, lifetimeWords: 905, lifetimeLetters: 5030 }), row()), false);
  // after a server rebirth: R+1 at LV 1 on both sides
  assert.equal(behindBoard(me({ rebirths: 5, level: 1 }), row({ rebirths: 5, level: 1 })), false);
});

test('board order ★ → R → level decides first', () => {
  assert.equal(behindBoard(me({ stars: 1, rebirths: 0, level: 1 }), row()), false, 'a star outranks rebirths');
  assert.equal(behindBoard(me({ stars: 0 }), row({ stars: 1, rebirths: 0, level: 1 })), true);
  assert.equal(behindBoard(me({ rebirths: 3, level: 300 }), row()), true);
  assert.equal(behindBoard(me({ level: 59 }), row()), true);
});

test('057: fewer lifetime words or letters is NOT behind (the server merges them; blocking froze rebirths — B3)', () => {
  assert.equal(behindBoard(me({ lifetimeWords: 899 }), row()), false);
  assert.equal(behindBoard(me({ lifetimeLetters: 4999 }), row()), false);
  assert.equal(behindBoard(me({ lifetimeLetters: 0 }), row({ lifetime_letters: null })), false, 'a row without letters');
});

test('B3: a row AHEAD on rebirths (same ★) is adopted — the save only goes up', () => {
  assert.equal(adoptRebirths(me({ rebirths: 4 }), row({ rebirths: 5, level: 1 })), 5);
  assert.equal(adoptRebirths(me({ rebirths: 5 }), row({ rebirths: 5 })), null, 'equal: nothing to adopt');
  assert.equal(adoptRebirths(me({ rebirths: 6 }), row({ rebirths: 5 })), null, 'ahead: never lowered');
  assert.equal(adoptRebirths(me({ stars: 0, rebirths: 2 }), row({ stars: 1, rebirths: 9 })), null, 'a different ★ is not adopted here');
  // after adopting, a device restored mid-climb (R4 LV 80 vs the row's R5 LV 1) is no longer behind
  assert.equal(behindBoard(me({ rebirths: 5, level: 80, lifetimeWords: 700 }), row({ rebirths: 5, level: 1 })), false);
});

test('B3: pushAllowed adopts the row rebirths, then allows the push', async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ id: 'p', stars: 0, rebirths: 5, level: 1, lifetime_words: 900, lifetime_letters: 5000 }] });
  try {
    let adopted = null;
    const ok = await pushAllowed({ base: 'x', headers: {}, view: 'v', id: 'p', local: me({ rebirths: 4, level: 80, lifetimeWords: 800 }), adopt: (n) => { adopted = n; } });
    assert.equal(adopted, 5);
    assert.equal(ok, true);
  } finally {
    globalThis.fetch = prev;
  }
});

test('no row / no local = nothing to guard', () => {
  assert.equal(behindBoard(me(), null), false);
  assert.equal(behindBoard(null, row()), false);
});
