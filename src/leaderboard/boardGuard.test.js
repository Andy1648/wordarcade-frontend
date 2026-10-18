// boardGuard.test.js — a device behind its own board row never pushes (Andy oct17 second-device reset).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behindBoard } from './boardGuard.js';

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

test('fewer lifetime words or letters at the same standing is behind (the server would read it as a reset)', () => {
  assert.equal(behindBoard(me({ lifetimeWords: 899 }), row()), true);
  assert.equal(behindBoard(me({ lifetimeLetters: 4999 }), row()), true);
  assert.equal(behindBoard(me({ lifetimeLetters: 0 }), row({ lifetime_letters: null })), false, 'a row without letters');
});

test('no row / no local = nothing to guard', () => {
  assert.equal(behindBoard(me(), null), false);
  assert.equal(behindBoard(null, row()), false);
});
