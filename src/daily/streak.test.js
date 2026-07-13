// node --test — Daily Challenge streak math (pure UTC-day-number arithmetic).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_EPOCH_UTC,
  currentDayNumber,
  emptyDailyState,
  hasPlayedDay,
  recordDailyResult,
  displayStreak,
  loadDailyState,
  saveDailyState,
} from './streak.js';

test('currentDayNumber matches the backend formula (epoch day = 1)', () => {
  assert.equal(currentDayNumber(DAILY_EPOCH_UTC), 1);
  assert.equal(currentDayNumber(Date.UTC(2026, 6, 12, 5, 0, 0)), 193);
});

test('first ever play starts a 1-day streak', () => {
  const s = recordDailyResult(emptyDailyState(), 100, 12);
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 1);
  assert.equal(s.lastDayNumber, 100);
  assert.equal(s.lastScore, 12);
  assert.equal(s.playedCount, 1);
});

test('consecutive days extend the streak', () => {
  let s = emptyDailyState();
  for (let day = 100; day < 105; day++) s = recordDailyResult(s, day, day - 95);
  assert.equal(s.streak, 5);
  assert.equal(s.bestStreak, 5);
  assert.equal(s.playedCount, 5);
});

test('a missed day resets the streak to 1 but keeps the best', () => {
  let s = emptyDailyState();
  for (let day = 100; day < 103; day++) s = recordDailyResult(s, day, 5); // last day 102, streak 3
  s = recordDailyResult(s, 105, 5); // gap: 102 -> 105 skips 103 & 104
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 3);
});

test('same-day replay: streak/playedCount frozen, best score of the day kept', () => {
  let s = recordDailyResult(emptyDailyState(), 200, 7);
  s = recordDailyResult(s, 200, 3); // worse replay
  assert.equal(s.streak, 1);
  assert.equal(s.playedCount, 1);
  assert.equal(s.lastScore, 7);
  s = recordDailyResult(s, 200, 11); // better replay
  assert.equal(s.lastScore, 11);
  assert.equal(s.bestScore, 11);
  assert.equal(s.streak, 1);
});

test('midnight rollover mid-session: next completion lands on the new day and extends', () => {
  // Player finishes one daily at 23:59 UTC (day N) and another at 00:05 (day N+1):
  // the server stamps each game with ITS day, so the second play extends the run.
  let s = recordDailyResult(emptyDailyState(), 300, 4);
  s = recordDailyResult(s, 301, 6);
  assert.equal(s.streak, 2);
});

test('DST is irrelevant: day numbers are integers, 23h/25h local days still increment by 1', () => {
  // 2026-03-08 (US spring-forward) and 2026-11-01 (fall-back) straddled by UTC noons.
  const before = currentDayNumber(Date.UTC(2026, 2, 7, 12, 0, 0));
  const after = currentDayNumber(Date.UTC(2026, 2, 8, 12, 0, 0));
  assert.equal(after, before + 1);
  const b2 = currentDayNumber(Date.UTC(2026, 9, 31, 12, 0, 0));
  const a2 = currentDayNumber(Date.UTC(2026, 10, 1, 12, 0, 0));
  assert.equal(a2, b2 + 1);
});

test('an EARLIER day than the last recorded is ignored (clock skew guard)', () => {
  let s = recordDailyResult(emptyDailyState(), 400, 9);
  const next = recordDailyResult(s, 399, 20);
  assert.deepEqual(next, s);
});

test('corrupt/garbage state is replaced, never crashes', () => {
  for (const bad of [null, undefined, 'junk', 42, { streak: 'NaN' }, { lastDayNumber: 1.5 }]) {
    const s = recordDailyResult(bad, 100, 5);
    assert.equal(s.streak, 1);
  }
});

test('non-integer dayNumber is a no-op (never corrupts state)', () => {
  const s = recordDailyResult(emptyDailyState(), undefined, 5);
  assert.equal(s.streak, 0);
  assert.equal(s.lastDayNumber, null);
});

test('hasPlayedDay only matches the exact recorded day', () => {
  const s = recordDailyResult(emptyDailyState(), 150, 5);
  assert.equal(hasPlayedDay(s, 150), true);
  assert.equal(hasPlayedDay(s, 151), false);
  assert.equal(hasPlayedDay(emptyDailyState(), 150), false);
});

test('displayStreak: alive if last play was today or yesterday, else 0', () => {
  const s = recordDailyResult(emptyDailyState(), 150, 5);
  assert.equal(displayStreak(s, 150), 1); // played today
  assert.equal(displayStreak(s, 151), 1); // yesterday — still alive, play to extend
  assert.equal(displayStreak(s, 152), 0); // dead
  assert.equal(displayStreak(emptyDailyState(), 152), 0);
});

test('load/save round-trip through an injected storage; failures fall back clean', () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const s = recordDailyResult(emptyDailyState(), 123, 8);
  saveDailyState(s, storage);
  assert.deepEqual(loadDailyState(storage), s);

  const broken = {
    getItem: () => {
      throw new Error('nope');
    },
    setItem: () => {
      throw new Error('nope');
    },
  };
  assert.deepEqual(loadDailyState(broken), emptyDailyState());
  assert.doesNotThrow(() => saveDailyState(s, broken));
});
