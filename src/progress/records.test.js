// records.test.js — the permanent-record model (personal bests + lifetime firsts).
// records reads/writes the GLOBAL localStorage, so each test installs an in-memory (or throwing)
// stand-in on globalThis and resets the in-memory seen set before calling in. Rarity is passed
// EXPLICITLY so tests never touch the lazy recall-corpus loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readRecords,
  noteWord,
  noteCombo,
  noteStreak,
  noteLevel,
  noteSession,
  noteLucky,
  __resetSeenForTest,
} from './records.js';

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
  __resetSeenForTest();
}

const OBSCURE = { band: 'OBSCURE', mult: 4.5 };
const RARE = { band: 'RARE', mult: 2.5 };
const COMMON = { band: 'COMMON', mult: 1 };

test('fresh read is the zeroed shape with distinct derived at 0', () => {
  install(memStorage());
  const r = readRecords();
  assert.equal(r.longestCombo, 0);
  assert.equal(r.longestStreak, 0);
  assert.equal(r.rarest, null);
  assert.equal(r.obscure, 0);
  assert.equal(r.lucky, 0);
  assert.equal(r.maxLevel, 1);
  assert.equal(r.firstPlayed, 0);
  assert.equal(r.sessions, 0);
  assert.equal(r.distinct, 0);
});

test('noteWord counts DISTINCT words, de-duplicating case + whitespace', () => {
  install(memStorage());
  noteWord('Cat', COMMON);
  noteWord('  cat  ', COMMON); // same word → not distinct
  noteWord('dog', COMMON);
  assert.equal(readRecords().distinct, 2);
});

test('noteWord counts every OBSCURE accept as a lucky hit (repeats included)', () => {
  install(memStorage());
  noteWord('zyzzyva', OBSCURE);
  noteWord('zyzzyva', OBSCURE); // same word, still a hit
  noteWord('common', COMMON);
  assert.equal(readRecords().obscure, 2);
});

test('rarest ever keeps the highest multiplier and its word + band', () => {
  install(memStorage());
  noteWord('cat', COMMON);
  noteWord('brave', RARE);
  noteWord('zyzzyva', OBSCURE);
  noteWord('mild', RARE); // lower than the OBSCURE — must not overwrite
  const { rarest } = readRecords();
  assert.equal(rarest.word, 'zyzzyva');
  assert.equal(rarest.band, 'OBSCURE');
  assert.equal(rarest.mult, 4.5);
});

test('a missing/empty word is ignored (no distinct, no rarest)', () => {
  install(memStorage());
  noteWord('', OBSCURE);
  noteWord('   ', OBSCURE);
  noteWord(undefined, OBSCURE);
  const r = readRecords();
  assert.equal(r.distinct, 0);
  assert.equal(r.obscure, 0);
  assert.equal(r.rarest, null);
});

test('noteCombo / noteStreak / noteLevel keep the MAX and never decrease', () => {
  install(memStorage());
  noteCombo(5);
  noteCombo(3); // lower — ignored
  noteCombo(9);
  noteStreak(7);
  noteStreak(2); // lower — ignored
  noteLevel(40);
  noteLevel(10); // lower — ignored (a rebirth zeroed the live level, but the record stands)
  const r = readRecords();
  assert.equal(r.longestCombo, 9);
  assert.equal(r.longestStreak, 7);
  assert.equal(r.maxLevel, 40);
});

test('noteLucky counts real lucky hits, separate from OBSCURE finds', () => {
  install(memStorage());
  noteWord('zyzzyva', OBSCURE); // an OBSCURE find, but NOT a lucky hit
  noteLucky(); // a real 1/40 lucky hit (independent of the word's rarity)
  noteLucky();
  const r = readRecords();
  assert.equal(r.obscure, 1); // vocabulary record
  assert.equal(r.lucky, 2); // chance record — the two never conflate
});

test('noteSession increments the count and stamps firstPlayed exactly once', () => {
  install(memStorage());
  noteSession(1000);
  noteSession(5000);
  noteSession(9000);
  const r = readRecords();
  assert.equal(r.sessions, 3);
  assert.equal(r.firstPlayed, 1000); // the FIRST session's time, never overwritten
});

test('distinct + records persist across a re-hydrate (new session, same storage)', () => {
  const store = memStorage();
  install(store);
  noteWord('alpha', RARE);
  noteWord('beta', OBSCURE);
  noteCombo(12);
  // Simulate a new session: same storage, fresh in-memory seen set.
  install(store);
  const r = readRecords();
  assert.equal(r.distinct, 2);
  assert.equal(r.obscure, 1);
  assert.equal(r.longestCombo, 12);
  assert.equal(r.rarest.word, 'beta');
});

test('garbage / partial stored blob reads back as valid zeros', () => {
  install(memStorage({ 'taw.records': '{"longestCombo":-5,"maxLevel":0,"rarest":42,"sessions":"x"}' }));
  const r = readRecords();
  assert.equal(r.longestCombo, 0); // negative rejected
  assert.equal(r.maxLevel, 1); // below the floor → 1
  assert.equal(r.rarest, null); // non-object rejected
  assert.equal(r.sessions, 0); // non-number rejected
});

test('storage that throws → reads as zeros and no recorder ever throws', () => {
  install(blockedStorage);
  assert.doesNotThrow(() => {
    noteWord('cat', OBSCURE);
    noteCombo(9);
    noteStreak(9);
    noteLevel(9);
    noteSession(1);
  });
  const r = readRecords();
  // Persisted-backed fields can't survive a throwing write → 0.
  assert.equal(r.longestCombo, 0);
  assert.equal(r.sessions, 0);
  // The in-memory seen set still holds the word for THIS session (graceful degradation,
  // same contract as wordCount) — it simply isn't remembered past a reload.
  assert.equal(r.distinct, 1);
});
