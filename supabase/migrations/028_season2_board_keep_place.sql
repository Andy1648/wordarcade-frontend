-- 028_season2_board_keep_place.sql — THE SEASON-2 BOARD AFTER THE RESET (SEASON 2 checklist step 3, Andy oct6).
--
-- After the reset (023) every row is LV1 R0 with nothing earned, so 022's leaderboard_s2 (★ → R → level → words →
-- created_at) would shuffle the whole board into sign-up order. Instead EVERYONE KEEPS THEIR OLD POSITION:
--   * order = season-2 stats desc (★ → rebirths → level → words), ties broken by the SEASON-1 RANK from the reset
--     snapshot (public.season1_snapshot, taken by 023 — ranked in the season-1 board's own order: rebirths desc, level
--     desc, lifetime words desc, created_at asc, as 018 / 021's public.leaderboard), then created_at (a name made after
--     the reset has no season-1 rank and sits after every snapshot row it ties with);
--   * `earned` = the row has earned something in season 2 (any rebirth, level, word or ★) — the client shows "—" for
--     every stat of a row that has not;
--   * `s1_rank` = that season-1 rank (null for a name made after the reset).
-- Same columns as 022's view + earned + s1_rank, same grants. The view runs as its OWNER (security_invoker off) because
-- public.season1_snapshot is closed to anon / authenticated (023); it exposes only the board's public columns and a
-- rank number — never the snapshot itself.
--
-- ===== ORDER (claude/FLIP-STEPS.md) ===================================================================================
--   022 → 024 → 027 → claude/run-season2.sql (= 023, the reset) → THIS FILE (028) → `notify pgrst, 'reload schema';`.
--   028 needs 022 (the season-2 rows) and 023 (the snapshot table): the first statement stops with a clear error
--   otherwise. If 022 is ever re-run (it re-creates leaderboard_s2 in its old order), re-run 028 after it.
-- KEEP IN SYNC WITH src/leaderboard/s2Board.js (compareS2) and e2e/support/boardMock.js — s2BoardKeep.test.js pins
-- this file. WRITE-ONLY: Claude never runs migrations. Safe to re-run.

do $$
begin
  if to_regclass('public.season1_snapshot') is null then
    raise exception '028 needs 023 (claude/run-season2.sql) — the season-1 snapshot table is missing';
  end if;
  if to_regclass('public.leaderboard_s2') is null then
    raise exception '028 needs 022_season2_board.sql — public.leaderboard_s2 is missing';
  end if;
end $$;

drop view if exists public.leaderboard_s2;
create view public.leaderboard_s2 with (security_invoker = false) as
  with s1 as (
    select s.profile_id,
           row_number() over (order by s.rebirths desc, s.level desc, s.lifetime_words desc, p.created_at asc) as s1_rank
      from public.season1_snapshot s
      join public.profiles p on p.id = s.profile_id
  )
  select row_number() over (order by p.stars desc, p.rebirths desc, p.level desc, p.lifetime_words desc,
                                     s1.s1_rank asc nulls last, p.created_at asc) as rank,
         p.id, p.username, p.level, p.rebirths, p.lifetime_words, p.lifetime_letters, p.wins_per_word, p.econ, p.stars,
         (p.rebirths > 0 or p.level > 1 or p.lifetime_words > 0 or p.stars > 0) as earned,
         s1.s1_rank
    from public.profiles p
    left join s1 on s1.profile_id = p.id
   where p.econ = 13;
grant select on public.leaderboard_s2 to anon, authenticated;
