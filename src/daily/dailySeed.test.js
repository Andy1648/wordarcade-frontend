// dailySeed.test.js — the DAILY SHARED SEED guarantees Job 7 rests on:
//   1. same date  → identical sequences (across "machines")
//   2. the seed CHANGES at local midnight
//   3. a completed daily cannot be replayed
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDateKey,
  seedFor,
  dailyRng,
  dailyBlitzCategories,
  emptyState,
  load,
  save,
  hasPlayedToday,
  recordDaily,
  personalBest,
  DAILY_MODES,
} from './dailySeed.js';

function memStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), _map: map };
}
function draws(rng, n = 8) {
  return Array.from({ length: n }, () => rng());
}

// ---- 1. SAME DATE → IDENTICAL SEQUENCES ACROSS MACHINES ----
test('same date yields an identical seed and RNG stream (two independent "machines")', () => {
  const day = '2026-09-04';
  // Two independently-constructed RNGs (as two clients would build them).
  assert.deepEqual(draws(dailyRng(day, 'chain')), draws(dailyRng(day, 'chain')));
  assert.deepEqual(draws(dailyRng(day, 'fuse')), draws(dailyRng(day, 'fuse')));
  // The seed is a pure function of the string — a fixed constant, machine-independent.
  assert.equal(seedFor('2026-09-04', 'chain'), seedFor('2026-09-04', 'chain'));
  assert.equal(typeof seedFor('2026-09-04', 'chain'), 'number');
});

test('same date + same category list → identical Blitz categories, same order', () => {
  const cats = ['Big cats', 'Sushi types', 'HBO series', 'Types of cake', 'Farm crops', 'Art mediums', 'Music awards'];
  const a = dailyBlitzCategories('2026-09-04', cats, 3);
  const b = dailyBlitzCategories('2026-09-04', cats, 3);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3, 'distinct categories');
});

test('different modes on the same date get DIFFERENT (salted) sequences', () => {
  const day = '2026-09-04';
  assert.notDeepEqual(draws(dailyRng(day, 'chain')), draws(dailyRng(day, 'fuse')));
  assert.notEqual(seedFor(day, 'chain'), seedFor(day, 'fuse'));
});

// ---- 2. CHANGES AT LOCAL MIDNIGHT ----
test('localDateKey reads the LOCAL calendar date and flips at local midnight', () => {
  // 23:59:59 local on the 4th, then 00:00:01 local on the 5th — a local-midnight cross.
  const beforeMidnight = new Date(2026, 8, 4, 23, 59, 59); // months are 0-based → Sep
  const afterMidnight = new Date(2026, 8, 5, 0, 0, 1);
  assert.equal(localDateKey(beforeMidnight), '2026-09-04');
  assert.equal(localDateKey(afterMidnight), '2026-09-05');
  // Two moments a second apart across midnight → DIFFERENT day → DIFFERENT seed.
  assert.notEqual(
    seedFor(localDateKey(beforeMidnight), 'chain'),
    seedFor(localDateKey(afterMidnight), 'chain'),
  );
  // …and the next day's puzzle differs from today's.
  assert.notDeepEqual(draws(dailyRng('2026-09-04', 'fuse')), draws(dailyRng('2026-09-05', 'fuse')));
});

test('two moments in the SAME local day map to the same seed (morning vs night)', () => {
  const morning = new Date(2026, 8, 4, 7, 30, 0);
  const night = new Date(2026, 8, 4, 22, 15, 0);
  assert.equal(localDateKey(morning), localDateKey(night));
  assert.equal(seedFor(localDateKey(morning), 'blitz'), seedFor(localDateKey(night), 'blitz'));
});

// ---- 3. A COMPLETED DAILY CANNOT BE REPLAYED ----
test('a completed daily is marked played for the day and blocks a replay', () => {
  const s = emptyState();
  const day = '2026-09-04';
  assert.equal(hasPlayedToday(s, 'chain', day), false, 'fresh: not played');
  recordDaily(s, 'chain', 1200, day);
  assert.equal(hasPlayedToday(s, 'chain', day), true, 'after completing: played → replay blocked');
  // Other modes on the same day are independent (each is one-attempt separately).
  assert.equal(hasPlayedToday(s, 'fuse', day), false);
  // The NEXT day is playable again (a new puzzle).
  assert.equal(hasPlayedToday(s, 'chain', '2026-09-05'), false);
});

test('personal best keeps the all-time max across days; replay-day score updates PB only if higher', () => {
  const s = emptyState();
  recordDaily(s, 'fuse', 800, '2026-09-04');
  assert.equal(personalBest(s, 'fuse'), 800);
  recordDaily(s, 'fuse', 1500, '2026-09-05'); // new day, higher → PB up
  assert.equal(personalBest(s, 'fuse'), 1500);
  recordDaily(s, 'fuse', 300, '2026-09-06'); // new day, lower → PB unchanged
  assert.equal(personalBest(s, 'fuse'), 1500);
});

test('state round-trips through injected storage; corrupt/absent → empty', () => {
  const st = memStorage();
  const s = emptyState();
  recordDaily(s, 'blitz', 999, '2026-09-04');
  save(st, s);
  const back = load(st);
  assert.equal(hasPlayedToday(back, 'blitz', '2026-09-04'), true);
  assert.equal(personalBest(back, 'blitz'), 999);
  // corrupt / missing → clean empty
  assert.deepEqual(load(memStorage({ wa_daily_seed: '{bad json' })), emptyState());
  assert.deepEqual(load(memStorage()), emptyState());
});

test('DAILY_MODES is the three shared-seed modes', () => {
  assert.deepEqual([...DAILY_MODES].sort(), ['blitz', 'chain', 'fuse']);
});
