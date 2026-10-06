-- 024_season2_weekly.sql — THE SEASON-2 "THIS WEEK" BOARD (P8, claude/mockups/v2/Leaderboard.dc.html; PROGRESSION v3).
--
-- WHY: 022 gave season 2 its ALL TIME board (public.leaderboard_s2, ★ → rebirths → level) and that already IS the
-- order P8 asks for — 022 is reused as is. What season 2 still lacks is a THIS WEEK board in the same currency: the
-- live weekly view (013/017/021 public.leaderboard_weekly) ranks every row (season 1 and 2 mixed) by words typed.
-- The v2 board's THIS WEEK tab ranks season-2 rows by what they GAINED this ET week: ★ gained → rebirths gained →
-- levels gained (then words typed this week, then first-come) — the ALL TIME order, applied to the week's climb.
--
--   * profiles gains the week's BASELINE: s2_week_key (the ET week it belongs to), s2_week_stars0, s2_week_rb0,
--     s2_week_lv0 — where the row stood when its week began.
--   * private.lb_s2_week_stamp — a BEFORE UPDATE trigger, so EVERY write path stamps it (lb_submit3's season-2 write,
--     lb_rebirth, lb_ascend, a reset) without touching their bodies: on a season-2 row's FIRST change of a new week the
--     baseline is the row as it stood before that change; a row's first season-2 write (econ → 13) is its own
--     baseline (its season-1 numbers are not season-2 gains).
--   * public.leaderboard_s2_weekly — the gains + the order above; season-2 rows with this week's baseline and any gain.
--     An ascension this week (★ up) resets rebirths and levels, so after one the gains are the climb since it.
--     KEEP IN SYNC with src/leaderboard/s2Board.js s2WeekGains / compareWeekS2 (s2Board.test.js pins this file).
--
-- The client reads leaderboard_s2_weekly only with the SEASON2 flag; until this file runs it falls back to the live
-- weekly view filtered to econ 13 (words this week). lb_caps is NOT changed (no new cap — the client tries the view).
-- The live (season-1) game is unaffected: public.leaderboard / leaderboard_weekly and every write rule stay as they are.
-- NEEDS 022 (the first statement stops with a clear error if 022 is not in). ORDER (Andy): 1. run this whole file in the
-- SQL Editor; 2. `notify pgrst, 'reload schema';`. WRITE-ONLY: Claude never runs migrations. Safe to re-run.

do $$
begin
  if to_regclass('public.leaderboard_s2') is null then
    raise exception '024 needs 022_season2_board.sql — run 022 first, then this file';
  end if;
end $$;

-- ---- the week's baseline ---------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists s2_week_key date;
alter table public.profiles add column if not exists s2_week_stars0 integer not null default 0;
alter table public.profiles add column if not exists s2_week_rb0 integer not null default 0;
alter table public.profiles add column if not exists s2_week_lv0 integer not null default 1;

create or replace function private.lb_s2_week_stamp()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare wk date := (date_trunc('week', now() at time zone 'America/New_York'))::date;
begin
  if new.econ is distinct from 13 then return new; end if;
  if old.econ is distinct from 13 then
    -- the row's FIRST season-2 write: its own baseline (season-1 numbers are not season-2 gains)
    new.s2_week_key := wk;
    new.s2_week_stars0 := coalesce(new.stars, 0);
    new.s2_week_rb0 := coalesce(new.rebirths, 0);
    new.s2_week_lv0 := greatest(1, coalesce(new.level, 1));
  elsif old.s2_week_key is distinct from wk then
    -- the week's FIRST change: the baseline is where the row stood before it
    new.s2_week_key := wk;
    new.s2_week_stars0 := coalesce(old.stars, 0);
    new.s2_week_rb0 := coalesce(old.rebirths, 0);
    new.s2_week_lv0 := greatest(1, coalesce(old.level, 1));
  end if;
  return new;
end $$;
revoke all on function private.lb_s2_week_stamp() from public;
revoke all on function private.lb_s2_week_stamp() from anon, authenticated;

drop trigger if exists lb_s2_week_stamp on public.profiles;
create trigger lb_s2_week_stamp before update on public.profiles
  for each row execute function private.lb_s2_week_stamp();

-- ---- the season-2 THIS WEEK board: ★ gained → rebirths gained → levels gained ----------------------------------------
drop view if exists public.leaderboard_s2_weekly;
create view public.leaderboard_s2_weekly with (security_invoker = true) as
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
     where p.econ = 13 and p.s2_week_key = cur.wk
  )
  select row_number() over (order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc) as rank,
         id, username, level, rebirths, stars, econ, week_stars, week_rebirths, week_levels, week_words
    from g
   where week_stars > 0 or week_rebirths > 0 or week_levels > 0 or week_words > 0;
grant select on public.leaderboard_s2_weekly to anon, authenticated;
