// s2Board.test.js — the v2 LEADERBOARD's maths (P8): v3 rank plates, the ★ → R → level order, ▲▼ from the last look,
// CHASE / CLIMB, and the THIS WEEK gains mirrored from 024_season2_weekly.sql (pinned against the SQL text).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rankPlate, compareS2, boardMoves, boardSnapshot, chaseTarget, climbTarget, s2WeekGains, compareWeekS2 } from './s2Board.js';

const sql = (f) => readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf8').replace(/\r\n/g, '\n');

test('rank plates are the v3 ladder (by rebirths, then ★): KEYMASH … LEXIBEAST, VOIDTYPER … ENDGAME', () => {
  assert.equal(rankPlate({ rebirths: 0 }).name, 'KEYMASH');
  assert.equal(rankPlate({ rebirths: 5, level: 9e6 }).name, 'WORDSMITH', 'the level never matters');
  assert.equal(rankPlate({ rebirths: 10 }).name, 'LEXIBEAST');
  assert.equal(rankPlate({ rebirths: 0, stars: 1 }).name, 'VOIDTYPER', 'any ★ outranks every R');
  assert.equal(rankPlate({ stars: 10 }).name, 'FINAL BOSS');
  const end = rankPlate({ stars: 25 });
  assert.deepEqual([end.name, end.bg, end.ink], ['ENDGAME', '#000', '#FFE94A']);
  assert.equal(rankPlate({ rebirths: 3 }).bg, '#2EFFE0');
});

test('board order: ★ → rebirths → level (022 leaderboard_s2), words last', () => {
  const rows = [
    { id: 'd', stars: 0, rebirths: 2, level: 9999 },
    { id: 'b', stars: 0, rebirths: 9, level: 900 },
    { id: 'a', stars: 1, rebirths: 0, level: 5 },
    { id: 'c', stars: 0, rebirths: 9, level: 100 },
    { id: 'e', stars: 0, rebirths: 9, level: 100, lifetime_words: 50 },
  ];
  assert.deepEqual(rows.slice().sort(compareS2).map((r) => r.id), ['a', 'b', 'e', 'c', 'd']);
  // 022 really orders the view that way
  assert.match(sql('022_season2_board.sql'), /order by stars desc, rebirths desc, level desc, lifetime_words desc, created_at asc/);
});

test('▲▼: the place held at the last look vs now; unseen rows read 0', () => {
  const rows = [{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }, { id: 'c', rank: 3 }, { id: 'n', rank: 4 }];
  assert.deepEqual(boardMoves(rows, { a: 3, b: 1, c: 3 }), { a: 2, b: -1, c: 0, n: 0 });
  assert.deepEqual(boardMoves(rows, null), { a: 0, b: 0, c: 0, n: 0 });
  assert.deepEqual(boardSnapshot(rows.slice(0, 2), { id: 'me', rank: 40 }), { a: 1, b: 2, me: 40 });
});

test('CHASE passes the row above in the board order: ★, then R, then LV', () => {
  assert.equal(chaseTarget({ rank: 1, rebirths: 9 }, null), null);
  assert.equal(chaseTarget({ rank: 1 }, { rank: 0 }), null, 'nothing to chase at #1');
  const r = chaseTarget({ rank: 4, stars: 0, rebirths: 59, level: 10 }, { rank: 3, stars: 0, rebirths: 141, level: 5 });
  assert.deepEqual([r.unit, r.need, r.from, r.to, r.target], ['R', 83, 59, 142, 3]);
  const s = chaseTarget({ rank: 2, stars: 1, rebirths: 9 }, { rank: 1, stars: 3, rebirths: 0 });
  assert.deepEqual([s.unit, s.need, s.to], ['★', 3, 4]);
  const l = chaseTarget({ rank: 3, stars: 0, rebirths: 4, level: 100 }, { rank: 2, stars: 0, rebirths: 4, level: 250 });
  assert.deepEqual([l.unit, l.need], ['LV', 151]);
  assert.ok(l.pct >= 4 && l.pct <= 100);
});

test('CLIMB: rebirths to the next R rank, ★ to the next star rank; null at ENDGAME', () => {
  const a = climbTarget({ rebirths: 4 });
  assert.deepEqual([a.unit, a.need, a.next.name], ['R', 1, 'WORDSMITH']);
  const b = climbTarget({ rebirths: 10 });
  assert.deepEqual([b.unit, b.need, b.next.name], ['★', 1, 'VOIDTYPER']);
  const c = climbTarget({ stars: 4, rebirths: 3 });
  assert.deepEqual([c.unit, c.need, c.next.name], ['★', 1, 'OMNIKEY']);
  assert.equal(climbTarget({ stars: 20 }), null);
});

test('THIS WEEK gains mirror 024: ★ gained → R gained → LV gained; an ascension resets the climb', () => {
  const g = (o) => s2WeekGains({ s2_week_stars0: 0, s2_week_rb0: 3, s2_week_lv0: 200, stars: 0, rebirths: 3, level: 200, ...o });
  assert.deepEqual(g({ level: 950 }), { week_stars: 0, week_rebirths: 0, week_levels: 750 });
  assert.deepEqual(g({ rebirths: 5, level: 40 }), { week_stars: 0, week_rebirths: 2, week_levels: 39 });
  assert.deepEqual(g({ stars: 2, rebirths: 1, level: 80 }), { week_stars: 2, week_rebirths: 1, week_levels: 79 });
  assert.deepEqual(g({ level: 150 }), { week_stars: 0, week_rebirths: 0, week_levels: 0 }, 'a lower level (a reset) is no gain');
  const rows = [
    { id: 'lv', week_levels: 9000 },
    { id: 'rb', week_rebirths: 1 },
    { id: 'st', week_stars: 1 },
    { id: 'w', week_levels: 9000, week_words: 40 },
  ];
  assert.deepEqual(rows.sort(compareWeekS2).map((r) => r.id), ['st', 'rb', 'w', 'lv']);
  // the SQL says the same
  const s = sql('024_season2_weekly.sql');
  assert.match(s, /order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc/);
  assert.match(s, /greatest\(0, coalesce\(p\.stars, 0\) - p\.s2_week_stars0\) as week_stars/);
  assert.match(s, /case when coalesce\(p\.stars, 0\) > p\.s2_week_stars0 then p\.rebirths\s+else greatest\(0, p\.rebirths - p\.s2_week_rb0\) end as week_rebirths/);
  assert.match(s, /then greatest\(0, p\.level - p\.s2_week_lv0\)\s+else greatest\(0, p\.level - 1\) end as week_levels/);
  assert.match(s, /create trigger lb_s2_week_stamp before update on public\.profiles/);
  assert.match(s, /where p\.econ = 13 and p\.s2_week_key = cur\.wk/);
  assert.doesNotMatch(s, /create or replace function public\.lb_caps/, '024 leaves lb_caps alone');
});
