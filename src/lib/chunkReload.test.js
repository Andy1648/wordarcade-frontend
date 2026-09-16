// chunkReload.test.js — the stale-chunk reload, and the loop guard around it.
// The module reads the GLOBAL sessionStorage / window, so each test installs a
// stand-in on globalThis first (same shape as visitHistory.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaleChunkError, reloadOnceForStaleChunk } from './chunkReload.js';

function memStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const blockedStorage = {
  getItem() { throw new Error('storage blocked'); },
  setItem() { throw new Error('storage blocked'); },
  removeItem() { throw new Error('storage blocked'); },
};

// Install a fake window whose location.reload just counts calls.
function install(storage) {
  globalThis.sessionStorage = storage;
  const calls = { reloads: 0 };
  globalThis.window = { location: { reload: () => { calls.reloads += 1; } } };
  return calls;
}

// ---- the matcher ----

test('matches the Chrome/Edge phrasing Sentry reported', () => {
  assert.equal(
    isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://typeaword.com/assets/GameScreen-a1b2c3.js')),
    true
  );
});

test('matches the Firefox and Safari phrasings of the same failure', () => {
  assert.equal(isStaleChunkError(new TypeError('error loading dynamically imported module')), true);
  assert.equal(isStaleChunkError(new TypeError('Importing a module script failed.')), true);
});

test('accepts a bare string reason (unhandledrejection reasons are untyped)', () => {
  assert.equal(isStaleChunkError('Failed to fetch dynamically imported module'), true);
});

test('does NOT match a plain network failure — only a MODULE fetch may reload', () => {
  assert.equal(isStaleChunkError(new TypeError('Failed to fetch')), false);
  assert.equal(isStaleChunkError(new Error('NetworkError when attempting to fetch resource.')), false);
});

test('does NOT match unrelated rejections', () => {
  assert.equal(isStaleChunkError(new Error('WebSocket closed')), false);
  assert.equal(isStaleChunkError(null), false);
  assert.equal(isStaleChunkError(undefined), false);
});

// ---- the loop guard ----

test('first stale chunk in a tab reloads once and records the flag', () => {
  const calls = install(memStorage());
  assert.equal(reloadOnceForStaleChunk(), true);
  assert.equal(calls.reloads, 1);
  assert.equal(globalThis.sessionStorage.getItem('taw.chunkReload'), '1');
});

test('a SECOND stale chunk in the same tab never reloads again', () => {
  const calls = install(memStorage());
  reloadOnceForStaleChunk();
  assert.equal(reloadOnceForStaleChunk(), false);
  assert.equal(reloadOnceForStaleChunk(), false);
  assert.equal(calls.reloads, 1, 'the reload is once per tab session, no matter how many errors');
});

test('a tab that already reloaded before boot does not reload again', () => {
  const calls = install(memStorage({ 'taw.chunkReload': '1' }));
  assert.equal(reloadOnceForStaleChunk(), false);
  assert.equal(calls.reloads, 0);
});

test('blocked sessionStorage → never reloads (an unguardable loop is worse than the error)', () => {
  const calls = install(blockedStorage);
  assert.equal(reloadOnceForStaleChunk(), false);
  assert.equal(calls.reloads, 0);
});
