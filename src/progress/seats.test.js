// seats.test.js — H4 anti-farm: "two tabs of the same person". Every tab of this browser writes
// its live player id into one shared localStorage map; at game over, any rival id that ANOTHER tab
// of this browser registered is the player themself and can never unlock the match bonus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSeats, SEAT_TTL_MS } from './seats.js';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('another tab\'s seat is reported; my own seat is not', () => {
  const store = memStore();
  const a = makeSeats({ storage: store, tabId: 'A' });
  const b = makeSeats({ storage: store, tabId: 'B' });
  a.note('id-a', 1000);
  b.note('id-b', 1000);
  assert.deepEqual(a.otherIds(1000), ['id-b']);
  assert.deepEqual(b.otherIds(1000), ['id-a']);
});

test('a reconnect overwrites the tab\'s seat (one entry per tab)', () => {
  const store = memStore();
  const a = makeSeats({ storage: store, tabId: 'A' });
  const b = makeSeats({ storage: store, tabId: 'B' });
  a.note('old', 1000);
  a.note('new', 2000);
  assert.deepEqual(b.otherIds(2000), ['new']);
});

test('stale seats expire', () => {
  const store = memStore();
  const a = makeSeats({ storage: store, tabId: 'A' });
  const b = makeSeats({ storage: store, tabId: 'B' });
  a.note('id-a', 0);
  assert.deepEqual(b.otherIds(SEAT_TTL_MS + 1), []);
});

test('blocked / corrupt storage never throws and reports nothing', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = makeSeats({ storage: boom, tabId: 'A' });
  s.note('x', 1);
  assert.deepEqual(s.otherIds(1), []);
  const bad = memStore();
  bad.setItem('taw.seats', '{nope');
  assert.deepEqual(makeSeats({ storage: bad, tabId: 'B' }).otherIds(1), []);
  assert.deepEqual(makeSeats({ storage: null, tabId: 'C' }).otherIds(1), []);
});
