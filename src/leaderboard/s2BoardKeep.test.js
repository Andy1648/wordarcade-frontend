// s2BoardKeep.test.js — 028_season2_board_keep_place.sql and its JS mirror (s2Board.compareS2 / hasEarned): after the
// reset everyone keeps their season-1 place and shows "—" until they earn something in season 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareS2, hasEarned } from './s2Board.js';

const sql = () => readFileSync(join(process.cwd(), 'supabase', 'migrations', '028_season2_board_keep_place.sql'), 'utf8').replace(/\r\n/g, '\n');
const has = (s, t) => assert.ok(s.includes(t), `028 is missing: ${t}`);

test('028: season-2 stats desc, ties by the season-1 rank from the snapshot, then created_at; earned + s1_rank columns', () => {
  const s = sql();
  has(s, "if to_regclass('public.season1_snapshot') is null then");
  has(s, "if to_regclass('public.leaderboard_s2') is null then");
  has(s, 'drop view if exists public.leaderboard_s2;');
  has(s, 'create view public.leaderboard_s2 with (security_invoker = false) as');
  // the season-1 rank: the season-1 board's own order (018 / 021 public.leaderboard)
  has(s, 'row_number() over (order by s.rebirths desc, s.level desc, s.lifetime_words desc, p.created_at asc) as s1_rank');
  has(s, 'from public.season1_snapshot s');
  // the board order
  has(s, 'row_number() over (order by p.stars desc, p.rebirths desc, p.level desc, p.lifetime_words desc,');
  has(s, 's1.s1_rank asc nulls last, p.created_at asc) as rank,');
  has(s, '(p.rebirths > 0 or p.level > 1 or p.lifetime_words > 0 or p.stars > 0) as earned,');
  has(s, 'p.id, p.username, p.level, p.rebirths, p.lifetime_words, p.lifetime_letters, p.wins_per_word, p.econ, p.stars,');
  has(s, 'where p.econ = 13;');
  has(s, 'grant select on public.leaderboard_s2 to anon, authenticated;');
  has(s, 'WRITE-ONLY: Claude never runs migrations');
  assert.doesNotMatch(s, /grant [a-z, ]+ on (table )?public\.season1_snapshot/i, 'the snapshot itself stays closed');
  assert.doesNotMatch(s, /create or replace function public\.lb_caps/, '028 leaves lb_caps alone');
});

test('compareS2: stats first; equal stats → the lower season-1 rank first; no season-1 rank last', () => {
  const z = { stars: 0, rebirths: 0, level: 1, lifetime_words: 0 };
  const rows = [
    { id: 'c', ...z, s1_rank: 3 },
    { id: 'new', ...z, s1_rank: null },
    { id: 'a', ...z, s1_rank: 1 },
    { id: 'earned', ...z, level: 2, s1_rank: 9 },
    { id: 'b', ...z, s1_rank: 2 },
  ];
  assert.deepEqual(rows.slice().sort(compareS2).map((r) => r.id), ['earned', 'a', 'b', 'c', 'new']);
});

test('hasEarned: only an explicit earned === false hides the stats (a pre-028 row has no field)', () => {
  assert.equal(hasEarned({ earned: false }), false);
  assert.equal(hasEarned({ earned: true }), true);
  assert.equal(hasEarned({ level: 5 }), true);
  assert.equal(hasEarned(null), true);
});
