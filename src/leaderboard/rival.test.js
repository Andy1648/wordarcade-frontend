// rival.test.js — extensions-spec a (RIVAL PINGS): the pure decision + copy, and the client's storage path.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  rankChange, ownDropSince, levelGap, rivalGap, rivalPing, nextRivalLog, rivalCopy, rivalGapLine, rivalGapSpoken,
  RIVAL_MAX_RANK, RIVAL_PER_DAY, RIVAL_MAX_RB_GAP,
} from './rival.js';
import { rivalCheck, getRankBaseline, setRankBaseline } from './client.js';

// The board ranks REBIRTHS first, then level, then words (PR #178): the passer row carries rebirths.
const base = {
  before: 5, now: 6,
  prev: { rb: 2, lv: 40 }, cur: { rb: 2, lv: 41 },
  passer: { username: 'Xavi', level: 43, rebirths: 2 },
  log: null, today: '2026-10-03',
};

test('rankChange: drop vs rise vs nothing', () => {
  assert.equal(rankChange(5, 6), 'drop');
  assert.equal(rankChange(6, 5), 'rise');
  assert.equal(rankChange(5, 5), null);
  assert.equal(rankChange(null, 5), null, 'no baseline: no move');
  assert.equal(rankChange(5, 0), null);
});

test('a drop names the passer and the gap (same rebirths → the level gap)', () => {
  assert.deepEqual(rivalPing(base), { name: 'Xavi', from: 5, to: 6, rebirths: 0, levels: 2 });
});

test('rivalGap: rebirths first, like nextTarget — a rebirth lead zeroes the level gap', () => {
  assert.deepEqual(rivalGap({ rebirths: 3, level: 2 }, { rb: 2, lv: 300 }), { rebirths: 1, levels: 0 });
  assert.deepEqual(rivalGap({ rebirths: 2, level: 43 }, { rb: 2, lv: 41 }), { rebirths: 0, levels: 2 });
  assert.deepEqual(rivalGap({ rebirths: 2, level: 41 }, { rb: 2, lv: 41 }), { rebirths: 0, levels: 0 });
  assert.deepEqual(rivalGap({ level: 43 }, { rb: 0, lv: 41 }), { rebirths: 0, levels: 2 }, 'a row without rebirths reads as R0');
  assert.deepEqual(rivalGap({ rebirths: 0, level: 50 }, { rb: 1, lv: 3 }), { rebirths: 0, levels: 47 }, 'never negative');
});

test('a passer one rebirth up pings with the rebirth gap, whatever the levels', () => {
  // they rebirthed past me: LV 2 vs my LV 41, but R3 beats R2 on this board
  const p = rivalPing({ ...base, passer: { username: 'Xavi', level: 2, rebirths: 3 } });
  assert.deepEqual(p, { name: 'Xavi', from: 5, to: 6, rebirths: 1, levels: 0 });
  // a level lead past RIVAL_MAX_GAP does not matter when the rebirths differ
  assert.ok(rivalPing({ ...base, passer: { username: 'Xavi', level: 200, rebirths: 3 } }));
});

test('a passer more than one rebirth up is not catchable', () => {
  assert.equal(RIVAL_MAX_RB_GAP, 1);
  assert.equal(rivalPing({ ...base, passer: { username: 'Xavi', level: 1, rebirths: 4 } }), null, '2 RB is noise');
  assert.equal(rivalPing({ ...base, passer: { username: 'Xavi', level: 41, rebirths: 9 } }), null);
});

test('a rise never pings (that is the rank-up card)', () => {
  assert.equal(rivalPing({ ...base, before: 6, now: 5 }), null);
  assert.equal(rivalPing({ ...base, before: 6, now: 6 }), null);
});

test('own rebirth is suppressed (my rebirths changed: the move is mine, not a pass)', () => {
  // rebirth: count rose, level back to 1 — rebirths lead the board, so my own standing moved under me
  assert.equal(ownDropSince({ rb: 2, lv: 300 }, { rb: 3, lv: 1 }), true);
  assert.equal(rivalPing({ ...base, before: 5, now: 40, prev: { rb: 2, lv: 300 }, cur: { rb: 3, lv: 1 }, passer: { username: 'Xavi', level: 2, rebirths: 3 } }), null);
});

test('own reset is suppressed (level fell, rebirths fell)', () => {
  assert.equal(ownDropSince({ rb: 0, lv: 50 }, { rb: 0, lv: 1 }), true);
  assert.equal(ownDropSince({ rb: 3, lv: 50 }, { rb: 0, lv: 50 }), true);
  assert.equal(rivalPing({ ...base, prev: { rb: 2, lv: 45 }, cur: { rb: 2, lv: 41 } }), null);
});

test('no baseline yet = cannot tell = no ping', () => {
  assert.equal(ownDropSince(null, { rb: 0, lv: 5 }), true);
  assert.equal(rivalPing({ ...base, prev: null }), null);
});

test('same rebirths, level held or rose = a real pass', () => {
  assert.equal(ownDropSince({ rb: 1, lv: 40 }, { rb: 1, lv: 40 }), false);
  assert.equal(ownDropSince({ rb: 1, lv: 40 }, { rb: 1, lv: 44 }), false);
});

test('only catchable gaps: rank ≤ 50 and, at equal rebirths, ≤ 5 levels', () => {
  assert.equal(rivalPing({ ...base, before: 50, now: RIVAL_MAX_RANK + 1 }), null);
  assert.ok(rivalPing({ ...base, before: 49, now: RIVAL_MAX_RANK }));
  assert.equal(rivalPing({ ...base, passer: { username: 'Xavi', level: 47, rebirths: 2 } }), null, '6 LV is not catchable');
  assert.equal(rivalPing({ ...base, passer: { username: 'Xavi', level: 46, rebirths: 2 } }).levels, 5);
});

test('no passer row / blank name: nothing', () => {
  assert.equal(rivalPing({ ...base, passer: null }), null);
  assert.equal(rivalPing({ ...base, passer: { username: '  ', level: 41 } }), null);
});

test('never the same passer twice in a row; 3 a day', () => {
  assert.equal(rivalPing({ ...base, log: { day: base.today, n: 1, last: 'XAVI' } }), null);
  assert.ok(rivalPing({ ...base, log: { day: base.today, n: 1, last: 'Daan' } }));
  assert.equal(rivalPing({ ...base, log: { day: base.today, n: RIVAL_PER_DAY, last: 'Daan' } }), null);
  assert.ok(rivalPing({ ...base, log: { day: '2026-10-02', n: RIVAL_PER_DAY, last: 'Daan' } }), 'a new day resets the cap');
  assert.deepEqual(nextRivalLog({ day: base.today, n: 2, last: 'Daan' }, 'Xavi', base.today), { day: base.today, n: 3, last: 'Xavi' });
  assert.deepEqual(nextRivalLog({ day: '2026-10-02', n: 3, last: 'Daan' }, 'Xavi', base.today), { day: base.today, n: 1, last: 'Xavi' });
});

test('levelGap: never negative, level-tied is 0', () => {
  assert.equal(levelGap(43, 41), 2);
  assert.equal(levelGap(41, 41), 0);
  assert.equal(levelGap(39, 41), 0);
});

test('copy: name upper-cased, ranks + gap through formatNum, level-tied wording', () => {
  assert.deepEqual(rivalCopy({ name: 'Xavi', from: 5, to: 6, levels: 2 }), { title: 'XAVI PASSED YOU', sub: '#5 → #6 · 2 LV BEHIND' });
  assert.equal(rivalCopy({ name: 'elol', from: 1234, to: 1235, levels: 1 }).sub, '#1,234 → #1,235 · 1 LV BEHIND');
  assert.equal(rivalCopy({ name: 'elol', from: 12345, to: 12346, levels: 1 }).sub, '#12.3K → #12.3K · 1 LV BEHIND');
  assert.equal(rivalGapLine(0), 'LEVEL-TIED · MORE WORDS TAKE IT');
  assert.equal(rivalCopy({ name: 'Daan', from: 3, to: 4, levels: 0 }).sub, '#3 → #4 · LEVEL-TIED · MORE WORDS TAKE IT');
});

test('copy: a rebirth gap reads "N RB BEHIND" first (formatNum), and the spoken line spells it out', () => {
  assert.equal(rivalGapLine(0, 1), '1 RB BEHIND');
  assert.equal(rivalGapLine(7, 1), '1 RB BEHIND', 'rebirths outrank levels');
  assert.equal(rivalGapLine(0, 1234), '1,234 RB BEHIND');
  assert.equal(rivalCopy({ name: 'Xavi', from: 5, to: 6, levels: 0, rebirths: 1 }).sub, '#5 → #6 · 1 RB BEHIND');
  assert.equal(rivalGapSpoken(0, 1), '1 rebirth behind');
  assert.equal(rivalGapSpoken(0, 2), '2 rebirths behind');
  assert.equal(rivalGapSpoken(1, 0), '1 level behind');
  assert.equal(rivalGapSpoken(1234, 0), '1,234 levels behind');
  assert.equal(rivalGapSpoken(0, 0), 'level-tied, more words take it');
});

// ---- the client path: flag off = no board read, nothing stored ------------------------------------
let mem;
beforeEach(() => {
  mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
});
afterEach(() => { delete globalThis.localStorage; });

test('rivalCheck: flag off → null, no log written', async () => {
  const r = await rivalCheck({ before: 5, now: 6, prev: { rb: 0, lv: 40 }, cur: { rb: 0, lv: 40 } });
  assert.equal(r, null);
  assert.equal(mem.has('taw.lb.rival'), false);
});

test('rivalCheck: own rebirth → null before any board read (flag on)', async () => {
  mem.set('taw.flag.rival', '1');
  let fetched = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetched += 1; return { ok: false }; };
  try {
    const r = await rivalCheck({ before: 5, now: 40, prev: { rb: 1, lv: 300 }, cur: { rb: 2, lv: 1 } });
    assert.equal(r, null);
    assert.equal(fetched, 0, 'a suppressed drop costs no request');
    const up = await rivalCheck({ before: 6, now: 5, prev: { rb: 1, lv: 40 }, cur: { rb: 1, lv: 41 } });
    assert.equal(up, null, 'a rise costs no request either');
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('baseline round-trips; missing reads as null', () => {
  assert.equal(getRankBaseline(), null);
  setRankBaseline({ rb: 3, lv: 12 });
  assert.deepEqual(getRankBaseline(), { rb: 3, lv: 12 });
});
