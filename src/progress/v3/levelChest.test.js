// levelChest.test.js — LEVEL CHESTS (Andy oct22 "every 5th level pays a small gem chest (sim it so it doesn't flood
// gems), and show it on the plate"): which levels pay, first-time-per-climb, the daily cap, and what the plate shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_CHEST_GEMS, LEVEL_CHEST_DAILY, LEVEL_CHEST_KEY, isChestLevel, chestLevelsBetween, takeLevelChests,
  nextLevelChest, chestsLeftToday, climbPeak, chestDay,
} from './levelChest.js';

function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const T = new Date(2026, 9, 22, 15, 0, 0).getTime();

test('every 5th level is a chest level; a jump counts every chest level it passes', () => {
  assert.deepEqual([4, 5, 9, 10, 15, 0, -5].map(isChestLevel), [false, true, false, true, true, false, false]);
  assert.equal(chestLevelsBetween(4, 5), 1);
  assert.equal(chestLevelsBetween(5, 9), 0, 'LV 5 was already reached this climb');
  assert.equal(chestLevelsBetween(3, 21), 4, '5, 10, 15, 20');
  assert.equal(chestLevelsBetween(10, 10), 0);
});

test('a chest pays LEVEL_CHEST_GEMS once, and the day caps at LEVEL_CHEST_DAILY chests', () => {
  const s = mem();
  assert.equal(takeLevelChests(4, 5, T, s), LEVEL_CHEST_GEMS);
  assert.equal(chestsLeftToday(T, s), LEVEL_CHEST_DAILY - 1);
  // a fast climb crosses 50 levels at once: only the rest of today's cap pays
  assert.equal(takeLevelChests(5, 255, T, s), (LEVEL_CHEST_DAILY - 1) * LEVEL_CHEST_GEMS);
  assert.equal(chestsLeftToday(T, s), 0);
  assert.equal(takeLevelChests(255, 260, T, s), 0, 'capped');
  // a new local day: the cap resets
  assert.equal(takeLevelChests(260, 265, T + 86400000, s), LEVEL_CHEST_GEMS);
  assert.equal(JSON.parse(s.getItem(LEVEL_CHEST_KEY)).day, chestDay(T + 86400000));
});

test('the cap holds a whole day at <= 100 gems whatever the pace', () => {
  const s = mem();
  let gems = 0;
  for (let L = 1; L <= 2000; L += 1) gems += takeLevelChests(L - 1, L, T, s);
  assert.equal(gems, LEVEL_CHEST_DAILY * LEVEL_CHEST_GEMS);
  assert.ok(gems <= 100);
});

test('the plate: shows the chest only for an unreached 5th level with room left today', () => {
  const s = mem();
  assert.equal(nextLevelChest(10, 9, T, s), LEVEL_CHEST_GEMS);
  assert.equal(nextLevelChest(9, 8, T, s), 0, 'not a chest level');
  assert.equal(nextLevelChest(10, 12, T, s), 0, 'this climb already passed LV 10');
  assert.equal(nextLevelChest(10, null, T, s), LEVEL_CHEST_GEMS, 'a fresh climb');
  s.setItem(LEVEL_CHEST_KEY, JSON.stringify({ day: chestDay(T), n: LEVEL_CHEST_DAILY }));
  assert.equal(nextLevelChest(10, 9, T, s), 0, 'capped for today: no promise on the plate');
});

test('climbPeak reads the climb the level hook records (taw.s2.lvgems)', () => {
  const s = mem({ 'taw.s2.lvgems': JSON.stringify({ r: 3, peak: 41 }) });
  assert.equal(climbPeak(3, s), 41);
  assert.equal(climbPeak(4, s), null, 'a different climb');
});

test('the leaf prefix matches the season-2 store', async () => {
  const { S2_PREFIX } = await import('./store.js');
  assert.equal(LEVEL_CHEST_KEY, `${S2_PREFIX}lvchest`);
});
