// wordCount.test.js — the lifetime WORDS TYPED counter.
// wordCount reads/writes the GLOBAL localStorage, so each test installs an in-memory
// (or throwing) stand-in on globalThis before calling in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWordCount, addWords, subscribe } from './wordCount.js';

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

function install(storage) {
  globalThis.localStorage = storage;
}

test('fresh read is the versioned zeroed shape', () => {
  install(memStorage());
  const c = readWordCount();
  assert.equal(c.v, 1);
  assert.equal(c.total, 0);
  assert.deepEqual(c.byMode, { 'word-bomb': 0, 'category-blitz': 0, 'sat-rush': 0 });
});

test('addWords increments total + the mode slot and returns the new count', () => {
  install(memStorage());
  const c = addWords('word-bomb');
  assert.equal(c.total, 1);
  assert.equal(c.byMode['word-bomb'], 1);
  // Persisted: a fresh read sees the same value.
  assert.equal(readWordCount().total, 1);
});

test('byMode accumulates independently across modes and counts', () => {
  install(memStorage());
  addWords('word-bomb');
  addWords('word-bomb');
  addWords('category-blitz', 3);
  addWords('sat-rush');
  const c = readWordCount();
  assert.equal(c.total, 6);
  assert.equal(c.byMode['word-bomb'], 2);
  assert.equal(c.byMode['category-blitz'], 3);
  assert.equal(c.byMode['sat-rush'], 1);
});

test('an unknown mode still bumps total but adds no byMode slot', () => {
  install(memStorage());
  const c = addWords('mystery-mode');
  assert.equal(c.total, 1);
  assert.equal(c.byMode['mystery-mode'], undefined);
  assert.deepEqual(Object.keys(c.byMode).sort(), ['category-blitz', 'sat-rush', 'word-bomb']);
});

test('n <= 0 or non-finite never decrements or corrupts the count', () => {
  install(memStorage({ wa_words: JSON.stringify({ v: 1, total: 5, byMode: { 'word-bomb': 5, 'category-blitz': 0, 'sat-rush': 0 } }) }));
  assert.equal(addWords('word-bomb', 0).total, 5);
  assert.equal(addWords('word-bomb', -3).total, 5);
  assert.equal(addWords('word-bomb', NaN).total, 5);
});

test('garbage / missing / partial storage reads back as zeros', () => {
  install(memStorage({ wa_words: 'not-json{' }));
  assert.equal(readWordCount().total, 0);
  install(memStorage()); // nothing stored
  assert.equal(readWordCount().total, 0);
  // partial: total present, byMode missing → byMode zeros, total kept
  install(memStorage({ wa_words: JSON.stringify({ total: 9 }) }));
  const c = readWordCount();
  assert.equal(c.total, 9);
  assert.deepEqual(c.byMode, { 'word-bomb': 0, 'category-blitz': 0, 'sat-rush': 0 });
});

test('storage that throws → reads as zeros and addWords never throws', () => {
  install(blockedStorage);
  assert.equal(readWordCount().total, 0);
  assert.doesNotThrow(() => addWords('sat-rush'));
});

test('subscribe fires on add with the new count; unsubscribe stops it', () => {
  install(memStorage());
  let calls = 0;
  let last = null;
  const off = subscribe((c) => { calls += 1; last = c; });
  addWords('category-blitz');
  assert.equal(calls, 1);
  assert.equal(last.total, 1);
  off();
  addWords('category-blitz');
  assert.equal(calls, 1, 'no further calls after unsubscribe');
});
