import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordBestStreak } from './bestStreak.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('the first real streak is a record; a shorter one is not', () => {
  const s = mem();
  assert.deepEqual(recordBestStreak('chain', 5, s), { run: 5, best: 0, isNew: true });
  assert.deepEqual(recordBestStreak('chain', 3, s), { run: 3, best: 5, isNew: false });
  assert.deepEqual(recordBestStreak('chain', 8, s), { run: 8, best: 5, isNew: true });
});

test('modes keep their own record, and a 0-1 streak never counts', () => {
  const s = mem();
  recordBestStreak('chain', 9, s);
  assert.equal(recordBestStreak('fuse', 1, s).isNew, false);
  assert.deepEqual(recordBestStreak('fuse', 4, s), { run: 4, best: 0, isNew: true });
});

test('a blocked or broken store never throws', () => {
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(recordBestStreak('chain', 6, bad), { run: 6, best: 0, isNew: true });
  assert.deepEqual(recordBestStreak('chain', 6, null), { run: 6, best: 0, isNew: false });
});
