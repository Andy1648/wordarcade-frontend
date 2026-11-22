-- 092_board_hide.sql - a row 091 HID (profiles.lb_hidden) stays off the boards and out of the weekly gem prizes.
--
--   1. ALL TIME (public.leaderboard_s2): the real board view (043's, or 090's if that runs) is kept as
--      private.leaderboard_s2_all and public.leaderboard_s2 becomes the same rows minus hidden ones, RANKED AGAIN with no
--      gap (#2 becomes #1). Same columns, same order, same grants - the client needs no change. The live ticker's rank
--      check (038) reads this view too, so a hidden row can't post a rank line.
--   2. THIS WEEK (public.leaderboard_s2_weekly): 024's body + "not hidden".
--   3. WEEKLY GEM PRIZES (private.s2_week_top, 034): 034's body + "not hidden" - a hidden row wins no prize and its place
--      goes to the next player.
-- Nothing is deleted or reset: the row, its save and its gear stay exactly as they are.
-- ORDER: after 091. IF 090 (living bots) IS RUN AFTER THIS FILE, RUN THIS FILE AGAIN (090 rewrites the board view; this
-- file then wraps the new one). RE-RUNNABLE. ASCII only. WRITE-ONLY: Claude never runs migrations.
-- HOW: Supabase -> SQL editor -> paste the WHOLE file -> Run.

do $$
declare def text;
begin
  if to_regclass('public.leaderboard_s2') is null then raise exception '092 needs 022 + 043 (public.leaderboard_s2)'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'lb_hidden') then
    raise exception '092 needs 091 (profiles.lb_hidden): run 091_econ_guard.sql first';
  end if;
  def := pg_get_viewdef('public.leaderboard_s2'::regclass);
  if position('leaderboard_s2_all' in def) = 0 then
    -- public.leaderboard_s2 is the REAL board (first run, or 090 rewrote it since): keep it as private.leaderboard_s2_all
    if to_regclass('private.leaderboard_s2_all') is not null then
      drop view private.leaderboard_s2_all; -- an older copy the current board replaced
    end if;
    alter view public.leaderboard_s2 set schema private;
    alter view private.leaderboard_s2 rename to leaderboard_s2_all;
  end if;
end $$;
revoke all on private.leaderboard_s2_all from public;
revoke all on private.leaderboard_s2_all from anon, authenticated;

create or replace view public.leaderboard_s2 with (security_invoker = false) as
  select row_number() over (order by a.rank) as rank,
         a.id, a.username, a.level, a.rebirths, a.lifetime_words, a.lifetime_letters, a.wins_per_word, a.econ, a.stars,
         a.earned, a.s1_rank
    from private.leaderboard_s2_all a
    join public.profiles p on p.id = a.id
   where not p.lb_hidden;
grant select on public.leaderboard_s2 to anon, authenticated;

-- ---- 2. THIS WEEK (024 + not hidden) -----------------------------------------------------------------------------------
create or replace view public.leaderboard_s2_weekly with (security_invoker = true) as
  with cur as (select (date_trunc('week', now() at time zone 'America/New_York'))::date as wk),
  g as (
    select p.id, p.username, p.level, p.rebirths, coalesce(p.stars, 0) as stars, p.econ, p.created_at,
           greatest(0, coalesce(p.stars, 0) - p.s2_week_stars0) as week_stars,
           case when coalesce(p.stars, 0) > p.s2_week_stars0 then p.rebirths
                else greatest(0, p.rebirths - p.s2_week_rb0) end as week_rebirths,
           case when coalesce(p.stars, 0) = p.s2_week_stars0 and p.rebirths = p.s2_week_rb0
                then greatest(0, p.level - p.s2_week_lv0)
                else greatest(0, p.level - 1) end as week_levels,
           case when p.week_key = cur.wk then p.week_words else 0 end as week_words
      from public.profiles p, cur
     where p.econ = 13 and p.s2_week_key = cur.wk and not p.lb_hidden
  )
  select row_number() over (order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc) as rank,
         id, username, level, rebirths, stars, econ, week_stars, week_rebirths, week_levels, week_words
    from g
   where week_stars > 0 or week_rebirths > 0 or week_levels > 0 or week_words > 0;
grant select on public.leaderboard_s2_weekly to anon, authenticated;

-- ---- 3. WEEKLY GEM PRIZES (034 + not hidden) ---------------------------------------------------------------------------
create or replace function private.s2_week_top(p_wk date)
returns table (rank bigint, profile_id uuid)
language sql stable security definer set search_path = public, private, pg_temp as $$
  with g as (
    select f.profile_id, f.week_stars, f.week_rebirths, f.week_levels, f.week_words, p.created_at
      from private.s2_week_final f
      join public.profiles p on p.id = f.profile_id
     where f.wk = p_wk and not p.lb_hidden
    union all
    -- rows still stamped with that week: unchanged since, so the stored numbers are final
    select p.id,
           greatest(0, coalesce(p.stars, 0) - p.s2_week_stars0),
           case when coalesce(p.stars, 0) > p.s2_week_stars0 then p.rebirths
                else greatest(0, p.rebirths - p.s2_week_rb0) end,
           case when coalesce(p.stars, 0) = p.s2_week_stars0 and p.rebirths = p.s2_week_rb0
                then greatest(0, p.level - p.s2_week_lv0)
                else greatest(0, p.level - 1) end,
           case when p.week_key = p_wk then coalesce(p.week_words, 0) else 0 end,
           p.created_at
      from public.profiles p
     where p.econ = 13 and p.s2_week_key = p_wk and not p.lb_hidden
       and not exists (select 1 from private.s2_week_final f where f.wk = p_wk and f.profile_id = p.id)
  )
  select row_number() over (order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc),
         profile_id
    from g
   where week_stars > 0 or week_rebirths > 0 or week_levels > 0 or week_words > 0;
$$;
revoke all on function private.s2_week_top(date) from public;
revoke all on function private.s2_week_top(date) from anon, authenticated;

notify pgrst, 'reload schema';

-- CHECK: who is hidden, and the top of the board as players see it
--   select username, rebirths, lb_hidden_at, lb_hidden_why from public.profiles where lb_hidden;
--   select rank, username, rebirths, level from public.leaderboard_s2 order by rank limit 5;
