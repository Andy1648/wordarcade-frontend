// modeAccess.test.js — the menu lock predicate: level gate OR "already played it".
// modeAccess reads the GLOBAL localStorage (through solo/shared's run counters), so each
// test installs an in-memory (or throwing) stand-in on globalThis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isModeLocked, hasPlayedMode } from './modeAccess.js';

// Fixtures, not the real GAMES: gameData.js uses Vite-style extensionless imports that
// node:test can't resolve. The REAL unlockLevel values are asserted end-to-end against the
// live menu copy in e2e/mode-preview.spec.js ('UNLOCKS AT LV 2' / 'LV 3').
const FIXTURES = {
  chain: { id: 'chain', unlockLevel: 2 },
  fuse: { id: 'fuse', unlockLevel: 3 },
  'word-bomb': { id: 'word-bomb' }, // ungated: no unlockLevel
};

function memStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const blockedStorage = {
  getItem() { throw new Error('storage blocked'); },
  setItem() { throw new Error('storage blocked'); },
  removeItem() { throw new Error('storage blocked'); },
};

const gameById = (id) => FIXTURES[id];

test('an ungated mode is never locked', () => {
  globalThis.localStorage = memStorage();
  assert.equal(isModeLocked(gameById('word-bomb'), 0), false);
});

test('a gated, unplayed mode is locked below its level and open at it', () => {
  globalThis.localStorage = memStorage();
  assert.equal(isModeLocked(gameById('chain'), 0), true);
  assert.equal(isModeLocked(gameById('chain'), 1), true);
  assert.equal(isModeLocked(gameById('chain'), 2), false);
  assert.equal(isModeLocked(gameById('fuse'), 2), true);
  assert.equal(isModeLocked(gameById('fuse'), 3), false);
});

test('a PLAYED mode is never locked, whatever the level — the deep-link contradiction', () => {
  globalThis.localStorage = memStorage({ 'taw.chain.runs': '1', 'taw.fuse.runs': '4' });
  assert.equal(hasPlayedMode('chain'), true);
  assert.equal(isModeLocked(gameById('chain'), 0), false);
  assert.equal(isModeLocked(gameById('fuse'), 0), false);
});

test('the bypass is per-mode, not a blanket unlock', () => {
  globalThis.localStorage = memStorage({ 'taw.chain.runs': '1' });
  assert.equal(isModeLocked(gameById('chain'), 0), false);
  assert.equal(isModeLocked(gameById('fuse'), 0), true);
});

test('a zero run count is not a play', () => {
  globalThis.localStorage = memStorage({ 'taw.chain.runs': '0' });
  assert.equal(hasPlayedMode('chain'), false);
  assert.equal(isModeLocked(gameById('chain'), 0), true);
});

test('blocked storage degrades to the level gate alone', () => {
  globalThis.localStorage = blockedStorage;
  assert.equal(hasPlayedMode('chain'), false);
  assert.equal(isModeLocked(gameById('chain'), 0), true);
  assert.equal(isModeLocked(gameById('chain'), 5), false);
});

test('a mode with no run counter has no bypass, and a missing game is not locked', () => {
  globalThis.localStorage = memStorage();
  assert.equal(hasPlayedMode('word-bomb'), false);
  assert.equal(isModeLocked(null, 0), false);
});
