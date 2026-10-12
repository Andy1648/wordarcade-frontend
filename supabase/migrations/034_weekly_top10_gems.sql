-- 034_weekly_top10_gems.sql — THE WEEKLY TOP 10 PAY GEMS (Andy oct12: "make it so that the top 10 on leaderboard get
-- gems after every week (scaling upwards with spot)").
--
-- THE PROBLEM: 024's THIS WEEK board keeps no history. A row's week baseline is re-stamped on its FIRST change of a new
-- ET week, so once a top-10 player types in the new week their last-week gains are gone. This file keeps them:
--   1. private.s2_week_final — the moment the 024 trigger rolls a season-2 row into a new week it first writes that row's
--      FINAL gains for the week it is leaving (the same ★ / R / LV / words formulas as public.leaderboard_s2_weekly).
--   2. private.s2_week_top(week) — a finished week's ranking: every row's snapshot for that week, plus the rows still
--      stamped with that week (they have not changed since, so their stored numbers ARE their final gains). The same
--      order as the board: ★ gained → rebirths gained → levels gained → words → first-come.
--   3. public.lb_week_prize(secret) — the client calls it on menu load. For each of the last 4 finished weeks (from
--      FIRST_WEEK on) where the caller finished top 10 and has not been paid: logs the payout (once per player per week,
--      private.s2_week_prizes) and returns { prizes: [{ week, rank, gems }] }. The client queues each as a claim; the
--      gems are client-side like every other gem (gemsCore).
--
-- PRIZES (#1 → #10): 1000 · 750 · 600 · 500 · 400 · 350 · 300 · 250 · 200 · 150 gems. MIRRORED in
-- src/leaderboard/weeklyPrize.js WEEK_PRIZES (the board shows them) — weeklyPrize.test.js pins the two together.
-- FIRST_WEEK = 2026-10-12: the first week with snapshots from its start (earlier weeks have lost their data).
-- Testers (032 is_tester) are ranked like anyone (so Andy can see a payout happen).
--
-- ORDER: after 024 (re-declares its trigger function with the same body + the snapshot) and 032. Then:
-- notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- 1. the week's final gains, kept at rollover ---------------------------------------------------------------------
create table if not exists private.s2_week_final (
  wk date not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_stars integer not null default 0,
  week_rebirths integer not null default 0,
  week_levels integer not null default 0,
  week_words bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (wk, profile_id)
);
revoke all on private.s2_week_final from public;
revoke all on private.s2_week_final from anon, authenticated;

create table if not exists private.s2_week_prizes (
  wk date not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  gems integer not null,
  paid_at timestamptz not null default now(),
  primary key (wk, profile_id)
);
revoke all on private.s2_week_prizes from public;
revoke all on private.s2_week_prizes from anon, authenticated;

-- 024's trigger, unchanged, plus: on the week's FIRST change, snapshot the week being left
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
    -- 034: keep the week being left — its gains exactly as leaderboard_s2_weekly computed them
    if old.s2_week_key is not null then
      insert into private.s2_week_final (wk, profile_id, week_stars, week_rebirths, week_levels, week_words)
      values (
        old.s2_week_key, old.id,
        greatest(0, coalesce(old.stars, 0) - old.s2_week_stars0),
        case when coalesce(old.stars, 0) > old.s2_week_stars0 then old.rebirths
             else greatest(0, old.rebirths - old.s2_week_rb0) end,
        case when coalesce(old.stars, 0) = old.s2_week_stars0 and old.rebirths = old.s2_week_rb0
             then greatest(0, old.level - old.s2_week_lv0)
             else greatest(0, old.level - 1) end,
        case when old.week_key = old.s2_week_key then coalesce(old.week_words, 0) else 0 end
      )
      on conflict (wk, profile_id) do nothing;
    end if;
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

-- ---- 2. a finished week's ranking ---------------------------------------------------------------------------------------
create or replace function private.s2_week_top(p_wk date)
returns table (rank bigint, profile_id uuid)
language sql stable security definer set search_path = public, private, pg_temp as $$
  with g as (
    select f.profile_id, f.week_stars, f.week_rebirths, f.week_levels, f.week_words, p.created_at
      from private.s2_week_final f
      join public.profiles p on p.id = f.profile_id
     where f.wk = p_wk
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
     where p.econ = 13 and p.s2_week_key = p_wk
       and not exists (select 1 from private.s2_week_final f where f.wk = p_wk and f.profile_id = p.id)
  )
  select row_number() over (order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc),
         profile_id
    from g
   where week_stars > 0 or week_rebirths > 0 or week_levels > 0 or week_words > 0;
$$;
revoke all on function private.s2_week_top(date) from public;
revoke all on function private.s2_week_top(date) from anon, authenticated;

-- ---- 3. the payout: once per player per finished week ------------------------------------------------------------------
create or replace function public.lb_week_prize(p_secret text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; cur date; w date; rk bigint; g integer; out jsonb := '[]'::jsonb;
        WEEK_PRIZES constant integer[] := array[1000, 750, 600, 500, 400, 350, 300, 250, 200, 150];
        FIRST_WEEK constant date := date '2026-10-12';
        LOOK_BACK constant integer := 4;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('prizes', out); end if;
  cur := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  for i in 1..LOOK_BACK loop
    w := cur - 7 * i;
    continue when w < FIRST_WEEK;
    continue when exists (select 1 from private.s2_week_prizes where wk = w and profile_id = pid);
    select t.rank into rk from private.s2_week_top(w) t where t.profile_id = pid;
    continue when rk is null or rk > array_length(WEEK_PRIZES, 1);
    g := WEEK_PRIZES[rk];
    insert into private.s2_week_prizes (wk, profile_id, rank, gems) values (w, pid, rk, g)
      on conflict (wk, profile_id) do nothing;
    if found then out := out || jsonb_build_object('week', w, 'rank', rk, 'gems', g); end if;
  end loop;
  return json_build_object('prizes', out);
end $$;
revoke all on function public.lb_week_prize(text) from public;
grant execute on function public.lb_week_prize(text) to anon, authenticated;

notify pgrst, 'reload schema';
