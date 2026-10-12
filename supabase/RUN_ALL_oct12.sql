-- RUN_ALL_oct12.sql — EVERYTHING to run, in order, in ONE paste (Supabase → SQL Editor → paste all → Run).
-- = 032 → 033 → 034 → 035 → 036 (each file unchanged, back to back). Every part is safe to re-run.
--   032  tester flag (profiles.is_tester, millie seeded) + flag-don't-ban cheat log
--   033  testers skip the 12 rebirths / hour pace
--   034  weekly top-10 gem prizes (run before Oct 19)
--   035  season-2 rebirths need 25 GAME words since the last one + the TESTER op code (redeem kind 'tester')
--   036  server-checked gear rolls + gem budget + the showcase audit (refuses implausible MYTHIC / SECRET gears)
-- Verified: all 36 migrations apply cleanly, in order, on a fresh Postgres 16, and 032–036 re-run without errors.
-- WRITE-ONLY: Claude never runs migrations.


-- ================================================================ 032_testers_and_flags.sql

-- ================================================================ 032_testers_and_flags.sql
-- 032_testers_and_flags.sql — ANTI-CHEAT WITHOUT BANNING THE TEST ACCOUNTS (Andy oct11: "is there a way to protect
-- against [cheating] without banning my test accounts if i give myself an op code").
--
-- THE "OP CODE" IS A SERVER COLUMN, never a code in the bundle (the bundle is public — a code in it is a code for
-- everyone). Only the SQL editor can set it.
--
--   1. public.profiles.is_tester (default false). A TESTER's season-2 board write skips 029's rate / level caps: the
--      numbers it submits are stored as sent (still ≥ 0, level ≥ 1, inside the int column). Testers are never flagged.
--      Testers stay ON the public board like anyone else (so the board can be tested). The rebirth GATE / PACE in
--      lb_rebirth are unchanged — a tester meets the gate by submitting the level.
--   2. FLAG, DON'T BAN. Every non-tester season-2 submit that 029's caps REJECT (words > 20/s, letters > 150/s) or
--      CLAMP (stored level / words / letters lower than sent, without a reset) logs one row in private.cheat_flags
--      (≤ 1 per profile per reason per hour). Nothing is auto-removed — Andy reviews private.cheat_review and decides.
--      A false positive costs nothing: a flag is a note, not a penalty.
--
-- REVIEW (SQL editor):  select * from private.cheat_review;
-- ADD A TESTER:         update public.profiles set is_tester = true where lower(username) = lower('<name>');
-- REMOVE A TESTER:      update public.profiles set is_tester = false where lower(username) = lower('<name>');
--
-- ORDER: after 029 (it wraps 029's private.lb_board_write_s2, which is NOT redefined — finalRules.test.js still pins
-- 029). Re-declares 022's public.lb_submit3 with the same signature and the same season-1 branch. If 022 is ever
-- re-run, re-run this file after it. Then: notify pgrst, 'reload schema';
--
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

do $$
begin
  if to_regprocedure('private.lb_board_write_s2(text,integer,integer,bigint,bigint,numeric)') is null then
    raise exception '032 needs 022 + 029 — run them first, then this file';
  end if;
end $$;

-- ---- 1. the tester column (+ the first tester) ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_tester boolean not null default false;
update public.profiles set is_tester = true where lower(username) = lower('millie');

-- ---- 2. the flag log (private: no anon / authenticated access) -----------------------------------------------------
create table if not exists private.cheat_flags (
  id bigserial primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('rejected', 'clamped')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cheat_flags_profile_idx on private.cheat_flags (profile_id, reason, created_at desc);
revoke all on private.cheat_flags from public;
revoke all on private.cheat_flags from anon, authenticated;

-- ---- 3. the tester write: numbers as sent (shape only) -------------------------------------------------------------
create or replace function private.lb_board_write_tester(p_pid uuid, p_level integer, p_rebirths integer,
                                                         p_lifetime_words bigint, p_lifetime_letters bigint,
                                                         p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare old public.profiles; w bigint; wk date; delta bigint;
begin
  select * into old from public.profiles where id = p_pid for update;
  w := greatest(0, coalesce(p_lifetime_words, 0));
  delta := case when old.econ = 13 then greatest(0, w - coalesce(old.lifetime_words, 0)) else 0 end;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = least(2147483647, greatest(1, coalesce(p_level, 1)::bigint))::integer,
         rebirths = least(2147483647, greatest(0, coalesce(p_rebirths, 0)::bigint))::integer,
         lifetime_words = w,
         lifetime_letters = greatest(0, coalesce(p_lifetime_letters, 0)),
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = 13,
         submitted_at = now(), updated_at = now()
   where id = p_pid;
end $$;
revoke all on function private.lb_board_write_tester(uuid, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_tester(uuid, integer, integer, bigint, bigint, numeric) from anon, authenticated;

-- one flag per profile per reason per hour
create or replace function private.cheat_flag(p_pid uuid, p_reason text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if exists (select 1 from private.cheat_flags
              where profile_id = p_pid and reason = p_reason and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into private.cheat_flags (profile_id, reason, detail) values (p_pid, p_reason, p_detail);
end $$;
revoke all on function private.cheat_flag(uuid, text, jsonb) from public;
revoke all on function private.cheat_flag(uuid, text, jsonb) from anon, authenticated;

-- ---- 4. lb_submit3: 022's body + the tester branch + flag-don't-ban around 029's write ------------------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare cur smallint; pid uuid; old public.profiles; nw public.profiles; sent jsonb;
begin
  if p_econ = 13 then
    pid := private.profile_for_secret(p_secret);
    if pid is null then raise exception 'no_profile'; end if;
    select * into old from public.profiles where id = pid;
    if old.is_tester then
      perform private.lb_board_write_tester(pid, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters, p_wins_per_word);
      return;
    end if;
    perform private.lb_board_write_s2(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters, p_wins_per_word);
    -- FLAG, DON'T BAN: compare what was sent with what 029 stored (a season-2 row that was not throttled)
    if old.econ = 13 and old.submitted_at is not null and old.submitted_at < now() - interval '5 seconds' then
      select * into nw from public.profiles where id = pid;
      sent := jsonb_build_object('level', p_level, 'rebirths', p_rebirths, 'words', p_lifetime_words,
                                 'letters', p_lifetime_letters,
                                 'was', jsonb_build_object('level', old.level, 'rebirths', old.rebirths,
                                                           'words', old.lifetime_words, 'letters', old.lifetime_letters),
                                 'secs', round(extract(epoch from (now() - old.submitted_at))));
      if nw.submitted_at is not distinct from old.submitted_at then
        perform private.cheat_flag(pid, 'rejected', sent);       -- 029 refused it (words / letters too fast)
      elsif coalesce(p_rebirths, 0) >= old.rebirths
            and (nw.level < coalesce(p_level, 1) or nw.lifetime_words < coalesce(p_lifetime_words, 0)
                 or nw.lifetime_letters < coalesce(p_lifetime_letters, 0)) then
        perform private.cheat_flag(pid, 'clamped', sent);        -- 029 stored less than was sent
      end if;
    end if;
    return;
  end if;
  if p_econ is distinct from 12 then raise exception 'old_client'; end if;
  select econ into cur from public.profiles where id = private.profile_for_secret(p_secret);
  if cur = 13 then raise exception 'old_client'; end if; -- a season-1 client never writes a season-2 row
  perform private.lb_board_write_rr(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                    p_wins_per_word, (12)::smallint); -- econ = 12
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- 5. the review list (SQL editor only) --------------------------------------------------------------------------
-- Flag counts + a few "odd shape" ratios for EVERY non-tester season-2 row with a flag or an odd ratio:
--   rb_per_kword  rebirths per 1,000 lifetime words (a legit climb needs real typing behind each rebirth)
--   letters_per_word  real words average ~4–9 letters; far outside that = a scripted feed
create or replace view private.cheat_review as
select p.username, p.level, p.rebirths, p.lifetime_words, p.lifetime_letters,
       round(p.rebirths * 1000.0 / greatest(1, p.lifetime_words), 1) as rb_per_kword,
       round(p.lifetime_letters::numeric / greatest(1, p.lifetime_words), 1) as letters_per_word,
       count(f.id) filter (where f.reason = 'rejected') as rejected,
       count(f.id) filter (where f.reason = 'clamped') as clamped,
       max(f.created_at) as last_flag,
       p.id
  from public.profiles p
  left join private.cheat_flags f on f.profile_id = p.id
 where not p.is_tester and p.econ = 13
 group by p.id
having count(f.id) > 0
    or p.rebirths * 1000.0 / greatest(1, p.lifetime_words) > 20
    or (p.lifetime_words >= 200 and p.lifetime_letters::numeric / p.lifetime_words not between 3 and 12)
 order by count(f.id) desc, p.rebirths desc;
revoke all on private.cheat_review from public;
revoke all on private.cheat_review from anon, authenticated;

notify pgrst, 'reload schema';

-- ================================================================ 033_tester_rebirth_pace.sql
-- 033_tester_rebirth_pace.sql — TESTERS SKIP THE REBIRTH PACE (Andy oct12: "lift the 12 rebirths / hour max").
--
-- 029's lb_rebirth caps everyone at 12 granted rebirths per rolling hour (PACE). A TESTER (032's
-- public.profiles.is_tester, SQL-editor only) now skips that one check. Everything else is unchanged and still
-- applies to testers: REPLAY, RATE (≤ 2 calls / s), SEASON, the GATE (level ≥ 15 + 18 × R) and ONE rebirth per call.
-- Non-testers keep the 12 / hour pace exactly as 029.
--
-- ORDER: after 029 and 032 (needs the is_tester column). Re-declares 029's public.lb_rebirth with the same
-- signature; the body is 029's plus the tester guard on PACE. If 029 is ever re-run, re-run this file after it.
-- Then: notify pgrst, 'reload schema';
--
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- lb_rebirth: season 0 = 021's rule; season 2 = FINAL v3 (LV ≥ 15 + 18 × R → level 1) ------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON (+ econ-13 row for season 2) → GATE → PACE → GRANT.
create or replace function public.lb_rebirth(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; gate numeric; recent integer;
        granted integer; oldest timestamptz;
        RATE_PER_SEC constant integer := 2;       -- logged calls per profile per rolling second
        RB_WINDOW_SECS constant integer := 3600;  -- the pace window
        RB_PER_WINDOW constant integer := 12;     -- granted rebirths allowed inside one window
        LOG_KEEP_DAYS constant integer := 30;     -- request-log rows older than this are pruned
        S2_ECON constant smallint := 13;          -- a season-2 request needs a season-2 row
        GATE2_BASE constant integer := 15;        -- v4: LV 15 + 18 × R …
        GATE2_STEP constant integer := 18;        -- … → level 1
begin
  if p_request_id is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update; -- serialises with the board write + itself
  -- REPLAY: the same request id returns the stored answer and changes nothing
  select * into prev from public.rebirth_requests where profile_id = pid and request_id = p_request_id;
  if found then
    if prev.action <> 'rebirth' then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
    return (prev.result || jsonb_build_object('replay', true))::json;
  end if;
  -- RATE: not logged
  select count(*) into recent from public.rebirth_requests
   where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC then return json_build_object('ok', false, 'reason', 'rate'); end if;
  -- the gate, from the STORED row: season 0 = 25 × (R+1) (019); season 2 = FINAL v3 15 + 18 × R
  gate := case when p_season = 0 then 25 * (old.rebirths::numeric + 1)
               when p_season = 2 and old.econ = S2_ECON then GATE2_BASE + GATE2_STEP * old.rebirths::numeric
               else null end;
  if gate is null then
    res := jsonb_build_object('ok', false, 'reason', 'season');
  elsif old.level < gate then
    res := jsonb_build_object('ok', false, 'reason', 'gate', 'gate', gate, 'level', old.level, 'rebirths', old.rebirths);
  else
    -- PACE: ≤ RB_PER_WINDOW granted rebirths in any rolling RB_WINDOW_SECS (033: testers skip it)
    select count(*), min(created_at) into granted, oldest from public.rebirth_requests
     where profile_id = pid and action = 'rebirth' and (result->>'ok')::boolean
       and created_at > now() - make_interval(secs => RB_WINDOW_SECS);
    if granted >= RB_PER_WINDOW and not coalesce(old.is_tester, false) then -- 033: testers skip PACE
      res := jsonb_build_object('ok', false, 'reason', 'wait', 'rebirths', old.rebirths,
               'retry_in', greatest(1, ceil(extract(epoch from (oldest + make_interval(secs => RB_WINDOW_SECS) - now())))::integer));
    else
      -- ONE rebirth: rebirths + 1, level → 1 (both seasons)
      update public.profiles set rebirths = old.rebirths + 1, level = 1, updated_at = now() where id = pid;
      res := jsonb_build_object('ok', true, 'rebirths', old.rebirths + 1, 'level', 1);
    end if;
  end if;
  insert into public.rebirth_requests (profile_id, request_id, action, result) values (pid, p_request_id, 'rebirth', res);
  delete from public.rebirth_requests where profile_id = pid and created_at < now() - make_interval(days => LOG_KEEP_DAYS);
  return res::json;
end $$;
revoke all on function public.lb_rebirth(text, uuid, smallint) from public;
grant execute on function public.lb_rebirth(text, uuid, smallint) to anon, authenticated;

notify pgrst, 'reload schema';

-- ================================================================ 034_weekly_top10_gems.sql
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

-- ================================================================ 035_rebirth_words_and_tester_code.sql
-- 035_rebirth_words_and_tester_code.sql — Andy oct12 (SKUF: R43 / LV789 on 2 lifetime words — menu typing alone climbed
-- the board). Two things:
--
-- 1. WORDS PER REBIRTH. A season-2 rebirth now also needs WORDS_PER_RB words played IN GAMES since the last rebirth
--    (profiles.lifetime_words — the sum of the per-mode mastery words; menu keys never count). The server keeps the
--    count at the last granted rebirth in profiles.rb_words0 (null = 0: every row starts needing 25 lifetime words).
--    A reset (lifetime_words back below rb_words0) counts every word since the reset — never negative. Testers (032 is_tester) skip it,
--    like the pace. Refusal: { ok:false, reason:'words', need, have }. Season 0 is unchanged.
--    MIRRORED in src/leaderboard/rebirthRules.js (decideRebirth) + src/progress/rebirthWords.js (WORDS_PER_REBIRTH).
--
-- 2. THE TESTER OP CODE without SQL. A redeem code of kind 'tester' marks the redeeming (named) player as a tester
--    (032 is_tester). The code lives ONLY in the table — never in the bundle. HOW: Table Editor → redeem_codes →
--    Insert row: code <something long and unguessable>, kind tester, max_uses 1 (one per account you want flagged).
--    Type it in UPGRADES → CODES on that account. lb_redeem's 12-tries-an-hour limit still guards guessing.
--
-- ORDER: after 032 (is_tester), 033 (re-declares its lb_rebirth with the same body + the words gate) and 030 (lb_redeem).
-- Then: notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

alter table public.profiles add column if not exists rb_words0 bigint;

-- ---- 1. lb_rebirth: 033's body + the WORDS gate (season 2, non-testers) -----------------------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON → GATE → WORDS → PACE → GRANT.
create or replace function public.lb_rebirth(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; gate numeric; recent integer;
        granted integer; oldest timestamptz; since bigint;
        RATE_PER_SEC constant integer := 2;       -- logged calls per profile per rolling second
        RB_WINDOW_SECS constant integer := 3600;  -- the pace window
        RB_PER_WINDOW constant integer := 12;     -- granted rebirths allowed inside one window
        LOG_KEEP_DAYS constant integer := 30;     -- request-log rows older than this are pruned
        S2_ECON constant smallint := 13;          -- a season-2 request needs a season-2 row
        GATE2_BASE constant integer := 15;        -- v4: LV 15 + 18 × R …
        GATE2_STEP constant integer := 18;        -- … → level 1
        WORDS_PER_RB constant integer := 25;      -- 035: game words since the last rebirth
begin
  if p_request_id is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  select * into prev from public.rebirth_requests where profile_id = pid and request_id = p_request_id;
  if found then
    if prev.action <> 'rebirth' then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
    return (prev.result || jsonb_build_object('replay', true))::json;
  end if;
  select count(*) into recent from public.rebirth_requests
   where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC then return json_build_object('ok', false, 'reason', 'rate'); end if;
  gate := case when p_season = 0 then 25 * (old.rebirths::numeric + 1)
               when p_season = 2 and old.econ = S2_ECON then GATE2_BASE + GATE2_STEP * old.rebirths::numeric
               else null end;
  -- 035: game words since the last rebirth (a reset that lowered lifetime_words counts from 0)
  since := case when coalesce(old.lifetime_words, 0) < coalesce(old.rb_words0, 0) then coalesce(old.lifetime_words, 0)
                else coalesce(old.lifetime_words, 0) - coalesce(old.rb_words0, 0) end;
  if gate is null then
    res := jsonb_build_object('ok', false, 'reason', 'season');
  elsif old.level < gate then
    res := jsonb_build_object('ok', false, 'reason', 'gate', 'gate', gate, 'level', old.level, 'rebirths', old.rebirths);
  elsif p_season = 2 and since < WORDS_PER_RB and not coalesce(old.is_tester, false) then
    res := jsonb_build_object('ok', false, 'reason', 'words', 'need', WORDS_PER_RB, 'have', since, 'rebirths', old.rebirths);
  else
    select count(*), min(created_at) into granted, oldest from public.rebirth_requests
     where profile_id = pid and action = 'rebirth' and (result->>'ok')::boolean
       and created_at > now() - make_interval(secs => RB_WINDOW_SECS);
    if granted >= RB_PER_WINDOW and not coalesce(old.is_tester, false) then -- 033: testers skip PACE
      res := jsonb_build_object('ok', false, 'reason', 'wait', 'rebirths', old.rebirths,
               'retry_in', greatest(1, ceil(extract(epoch from (oldest + make_interval(secs => RB_WINDOW_SECS) - now())))::integer));
    else
      -- ONE rebirth: rebirths + 1, level → 1; 035: the word count restarts from here
      update public.profiles set rebirths = old.rebirths + 1, level = 1, rb_words0 = coalesce(old.lifetime_words, 0),
             updated_at = now() where id = pid;
      res := jsonb_build_object('ok', true, 'rebirths', old.rebirths + 1, 'level', 1);
    end if;
  end if;
  insert into public.rebirth_requests (profile_id, request_id, action, result) values (pid, p_request_id, 'rebirth', res);
  delete from public.rebirth_requests where profile_id = pid and created_at < now() - make_interval(days => LOG_KEEP_DAYS);
  return res::json;
end $$;
revoke all on function public.lb_rebirth(text, uuid, smallint) from public;
grant execute on function public.lb_rebirth(text, uuid, smallint) to anon, authenticated;

-- ---- 2. the tester op code: lb_redeem (030) + kind 'tester' ----------------------------------------------------------
alter table public.redeem_codes drop constraint if exists redeem_codes_kind_check;
alter table public.redeem_codes add constraint redeem_codes_kind_check check (kind in ('wins', 'boost', 'gems', 'overdrive', 'tester'));

create or replace function public.lb_redeem(p_secret text, p_code text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare who bytea; pid uuid; c text; r public.redeem_codes;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  who := case when pid is not null then extensions.digest('taw-rc:p:' || pid::text, 'sha256')
              else extensions.digest('taw-rc:s:' || p_secret, 'sha256') end;
  delete from private.redeem_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.redeem_attempts where player = who) >= 12 then raise exception 'rate_limited'; end if;
  insert into private.redeem_attempts (player) values (who);

  c := upper(btrim(coalesce(p_code, '')));
  select * into r from public.redeem_codes where code = c for update;
  if not found or not r.active then return json_build_object('error', 'bad_code'); end if;
  if r.expires_at is not null and r.expires_at < now() then return json_build_object('error', 'expired'); end if;
  if r.max_uses is not null and r.uses >= r.max_uses then return json_build_object('error', 'used_up'); end if;
  -- 035: a TESTER code needs a named player (it flags that profile) — nothing is spent without one
  if r.kind = 'tester' and pid is null then return json_build_object('error', 'need_name'); end if;
  if exists (select 1 from private.redeem_claims where code = c and player = who) then
    return json_build_object('error', 'already_redeemed');
  end if;
  insert into private.redeem_claims (code, player) values (c, who);
  update public.redeem_codes set uses = uses + 1 where code = c;
  if r.kind = 'tester' then
    update public.profiles set is_tester = true where id = pid;
  end if;
  return json_build_object('code', c, 'wins', r.wins, 'label', coalesce(r.label, c),
                           'kind', r.kind, 'per_level', r.per_level, 'boost_mult', r.boost_mult, 'boost_min', r.boost_min,
                           'gems', r.gems);
end $$;
revoke all on function public.lb_redeem(text, text) from public;
grant execute on function public.lb_redeem(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ================================================================ 036_server_rolls.sql
-- 036_server_rolls.sql — SERVER-CHECKED GEAR ROLLS (Andy oct12: "this rolling function can at least be checked with
-- server"). Until now a roll was decided in the browser and nothing on the server knew who owned what, so anyone with
-- devtools could hand themselves an ORIGIN and the profile card showed it. From this file on:
--
--   * THE SERVER PICKS. public.lb_roll(secret, luck, n) runs the same odds table as markRolls.js rollTable (the pool
--     below, 1 / x weights × luck, the RARE floor, the EPIC+ pity on roll 10 and the LEGENDARY+ pity on roll 50 of a
--     drought, the ×2 bonus every 10th roll, a flat 1.5% SHINY) with ITS OWN roll / pity counters, and returns the
--     result(s) as a RESERVATION. The client asks when the HOLD starts, so the answer is there before the release.
--     `luck` comes from the browser (it depends on the save) but is clamped to LUCK_CAP — the most a legit save has.
--   * public.lb_roll_claim(secret, seq) commits it on release: ownership (private.gear_owned), the counters, the spend.
--     A cancelled hold leaves the reservation; the next lb_roll returns the SAME one (no re-rolling for a better pick).
--   * THE GEM BUDGET. The server cannot see the gem wallet (it lives in the browser), so it caps what an account can
--     ever spend on rolls at the most it could have EARNED (private.gem_budget): rebirth gems (25 × R each, server-
--     checked rebirths), game words (generous per-word drop + game pay, gem gear included), daily drops by account
--     age, every achievement, gem codes, weekly prizes, the dupe refunds the server itself paid, start + gifts — × 1.5
--     slack. A legit player never meets it; a hand-edited wallet runs into it.
--   * THE SHOWCASE ONLY SHOWS REAL GEARS. lb_showcase_set keeps a rolled gear only if the server owns it for that
--     player. AUDIT, THEN GRANDFATHER (Andy oct12): a gear the server has no record of is accepted ONCE — and recorded
--     as 'grandfather' — only for an account created before ROLL_CUTOFF whose gem budget could plausibly have rolled it
--     (≥ 1% chance at a generous luck); otherwise it is shown as empty and flagged (private.cheat_flags 'gear').
--   * public.lb_gears(secret) returns what the server owns for the caller, what the audit refused (hidden from the card),
--     and what it REVERTS — only a gear under a 0.01% chance, which the browser then drops from its own save.
--   * NO HARM TO A REAL PLAYER (Andy oct12): the budget is far above anything earned by playing (it counts every gem
--     source, generously); over it, the roll simply happens locally as it always did. A refused gear is only HIDDEN
--     and flagged for review unless it is practically impossible. The TESTER code (032 is_tester) skips all of it.
--
-- ORDER: after 031 (showcase), 032 (cheat_flags), 034 (weekly prizes — the budget reads them), 035. Then
-- notify pgrst, 'reload schema';  The client falls back to the old local roll until this file runs (lb_roll 404).
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- the pool (= markRolls.js ROLL_MARKS: id, tier, 1-in-x; serverRolls.test.js pins every row) -----------------------
create table if not exists private.gear_pool (mark_id text primary key, tier text not null, x double precision not null, ord integer not null);
revoke all on private.gear_pool from public;
revoke all on private.gear_pool from anon, authenticated;
truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 12.171743297933846, 1),
  ('mk-cyclone', 'rare', 12.171743297933846, 2),
  ('mk-scholar', 'rare', 12.171743297933846, 3),
  ('mk-ouroboros', 'rare', 12.171743297933846, 4),
  ('mk-tinder', 'rare', 12.171743297933846, 5),
  ('mk-slipstream', 'rare', 12.171743297933846, 6),
  ('mk-smith', 'rare', 12.171743297933846, 7),
  ('mk-phoenix', 'rare', 12.171743297933846, 8),
  ('mk-metronome', 'rare', 12.171743297933846, 9),
  ('mk-hotwire', 'rare', 12.171743297933846, 10),
  ('mk-grapple', 'rare', 12.171743297933846, 11),
  ('mk-sparkplug', 'rare', 12.171743297933846, 12),
  ('mk-pyro', 'epic', 700, 13),
  ('mk-nova', 'epic', 700, 14),
  ('mk-golem', 'epic', 700, 15),
  ('mk-brainstorm', 'epic', 700, 16),
  ('mk-flashpoint', 'epic', 700, 17),
  ('mk-voltage', 'epic', 700, 18),
  ('mk-talisman', 'epic', 700, 19),
  ('mk-leviathan', 'legendary', 1250, 20),
  ('mk-eclipse', 'legendary', 1250, 21),
  ('mk-headmaster', 'legendary', 1250, 22),
  ('mk-thunderclap', 'legendary', 1250, 23),
  ('mk-jackpot', 'legendary', 1250, 24),
  ('mk-singularity', 'mythic', 30000, 25),
  ('mk-kraken', 'mythic', 30000, 26),
  ('mk-hydra', 'mythic', 30000, 27),
  ('mk-origin', 'secret', 100000, 28);

create or replace function private.tier_rank(t text) returns integer language sql immutable as $$
  select case t when 'rare' then 0 when 'epic' then 1 when 'legendary' then 2 when 'mythic' then 3 when 'secret' then 4 else -1 end;
$$;

-- ---- what the server knows a player owns, and every roll it made -------------------------------------------------------
create table if not exists private.gear_owned (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mark_id text not null,
  copies integer not null default 1,
  shiny boolean not null default false,
  source text not null default 'roll' check (source in ('roll', 'grandfather')),
  first_at timestamptz not null default now(),
  primary key (profile_id, mark_id)
);
revoke all on private.gear_owned from public;
revoke all on private.gear_owned from anon, authenticated;

create table if not exists private.roll_log (
  id bigserial primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seq integer not null,
  idx integer not null default 0,
  mark_id text not null,
  tier text not null,
  shiny boolean not null default false,
  luck double precision not null,
  forced text,
  bonus boolean not null default false,
  state text not null default 'reserved' check (state in ('reserved', 'claimed')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (profile_id, seq, idx)
);
create index if not exists roll_log_profile_idx on private.roll_log (profile_id, state, seq);
revoke all on private.roll_log from public;
revoke all on private.roll_log from anon, authenticated;

-- a gear the audit refused (the browser drops it from its save via lb_gears)
create table if not exists private.gear_refused (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mark_id text not null,
  revert boolean not null default false, -- true = practically impossible (< 0.01%): the browser drops it from the save too
  at timestamptz not null default now(),
  primary key (profile_id, mark_id)
);
alter table private.gear_refused add column if not exists revert boolean not null default false;
revoke all on private.gear_refused from public;
revoke all on private.gear_refused from anon, authenticated;

alter table public.profiles add column if not exists s2_roll_seq integer not null default 0;     -- last CLAIMED seq
alter table public.profiles add column if not exists s2_rolls integer not null default 0;        -- server rolls made
alter table public.profiles add column if not exists s2_since_epic integer not null default 0;
alter table public.profiles add column if not exists s2_since_leg integer not null default 0;
alter table public.profiles add column if not exists s2_roll_spent bigint not null default 0;    -- gems the server rolls cost

-- 032's flag log learns a third reason: a showcased gear the audit refused
alter table private.cheat_flags drop constraint if exists cheat_flags_reason_check;
alter table private.cheat_flags add constraint cheat_flags_reason_check check (reason in ('rejected', 'clamped', 'gear'));

-- ---- the gem budget: the most this account could ever have EARNED --------------------------------------------------
create or replace function private.gem_budget(p_pid uuid)
returns bigint language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; r bigint; days numeric; codes bigint := 0; weekly bigint := 0; dupes bigint := 0;
        REBIRTH_GEMS_PER_R constant integer := 25;   -- v3/econ.js
        PER_WORD constant integer := 250;            -- drops + an 8-player winner's pot every ~10 words, × the +800% gem gear — never short for a real player
        DAILY_MAX constant integer := 3150;          -- the best daily drop (150) + WORD RACE speed gems (not in lifetime_words): 75 races × 40 a day
        ACH_TOTAL constant integer := 4130;          -- every v3 achievement tier (achievements.js)
        START_AND_GIFTS constant integer := 2000;    -- the starter grant + patch-note gifts
        SLACK constant numeric := 1.5;
begin
  select * into p from public.profiles where id = p_pid;
  if not found then return 0; end if;
  r := greatest(0, coalesce(p.rebirths, 0));
  days := greatest(1, ceil(extract(epoch from (now() - coalesce(p.created_at, now()))) / 86400.0) + 1);
  begin
    select coalesce(sum(c.gems), 0) into codes from private.redeem_claims rc join public.redeem_codes c on c.code = rc.code
     where rc.player = extensions.digest('taw-rc:p:' || p_pid::text, 'sha256') and c.kind = 'gems';
  exception when others then codes := 0; end;
  begin
    select coalesce(sum(gems), 0) into weekly from private.s2_week_prizes where profile_id = p_pid;
  exception when others then weekly := 0; end;
  select coalesce(sum(case l.tier when 'rare' then 5 when 'epic' then 25 when 'legendary' then 100 when 'mythic' then 500 when 'secret' then 2500 else 0 end), 0)
    into dupes
    from private.roll_log l
   where l.profile_id = p_pid and l.state = 'claimed'
     and exists (select 1 from private.roll_log e where e.profile_id = p_pid and e.mark_id = l.mark_id and e.state = 'claimed' and e.id < l.id);
  return floor(SLACK * (REBIRTH_GEMS_PER_R * r * (r + 1) / 2 + PER_WORD * greatest(0, coalesce(p.lifetime_words, 0))
                        + DAILY_MAX * days + ACH_TOTAL + START_AND_GIFTS + codes + weekly + dupes))::bigint;
end $$;
revoke all on function private.gem_budget(uuid) from public;
revoke all on function private.gem_budget(uuid) from anon, authenticated;

-- ---- ONE pick: markRolls.js rollTable + roll, on the server's counters -----------------------------------------------
create or replace function private.pick_gear(p_luck double precision, p_since_epic integer, p_since_leg integer)
returns table (mark_id text, tier text, forced text)
language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare EPIC_PITY constant integer := 10; LEG_PITY constant integer := 50;
        f text := null; s double precision; top double precision; ew double precision; fw double precision;
        u double precision; acc double precision := 0; g record; last_id text; last_tier text; p double precision;
begin
  if p_since_epic + 1 >= EPIC_PITY then f := 'epic'; end if;
  if p_since_leg + 1 >= LEG_PITY then f := 'legendary'; end if;
  select coalesce(sum(p_luck / gp.x) filter (where gp.tier <> 'rare'), 0),
         coalesce(sum(p_luck / gp.x) filter (where private.tier_rank(gp.tier) >= 2), 0),
         coalesce(sum(p_luck / gp.x) filter (where gp.tier = 'epic'), 0),
         coalesce(sum(1 / gp.x) filter (where gp.tier = 'rare'), 0)
    into s, top, ew, fw from private.gear_pool gp;
  u := random();
  for g in select gp.mark_id, gp.tier, gp.x from private.gear_pool gp order by gp.ord loop
    if f = 'legendary' then
      p := case when private.tier_rank(g.tier) >= 2 then (p_luck / g.x) / top else 0 end;
    elsif f = 'epic' then
      p := case when private.tier_rank(g.tier) >= 2 then (case when top >= 1 then (p_luck / g.x) / top else p_luck / g.x end)
                when g.tier = 'epic' then (case when top >= 1 then 0 else (1 - top) * (p_luck / g.x) / ew end)
                else 0 end;
    elsif s >= 1 then
      p := case when g.tier = 'rare' then 0 else (p_luck / g.x) / s end;
    else
      p := case when g.tier = 'rare' then (1 - s) * (1 / g.x) / fw else p_luck / g.x end;
    end if;
    if p > 0 then
      last_id := g.mark_id; last_tier := g.tier;
      if u < acc + p then mark_id := g.mark_id; tier := g.tier; forced := f; return next; return; end if;
      acc := acc + p;
    end if;
  end loop;
  mark_id := last_id; tier := last_tier; forced := f; return next; -- float dust at the very end
end $$;
revoke all on function private.pick_gear(double precision, integer, integer) from public;
revoke all on function private.pick_gear(double precision, integer, integer) from anon, authenticated;

-- ---- lb_roll: reserve n picks (or hand back the open reservation) -----------------------------------------------------
create or replace function public.lb_roll(p_secret text, p_luck double precision, p_n integer default 1)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; n integer; i integer; L double precision; bonus boolean;
        se integer; sl integer; rolls integer; pk record; sh boolean; budget bigint; recent integer; out jsonb := '[]'::jsonb;
        LUCK_CAP constant double precision := 15;   -- the most a legit save reaches (every pip, perm, milestone, boost, unlock)
        ROLL_PRICE constant integer := 75;          -- v3/econ.js ROLL_PRICE
        SHINY constant double precision := 0.015;   -- markRollsCore.js SHINY_CHANCE
        BONUS_EVERY constant integer := 10;         -- markRolls.js BONUS_ROLL_EVERY (×2 luck)
        RATE_PER_SEC constant integer := 3;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  -- an open reservation: the SAME picks again (a cancelled hold can never re-roll for a better result)
  v_seq := p.s2_roll_seq + 1;
  if exists (select 1 from private.roll_log where profile_id = pid and roll_log.seq = v_seq and state = 'reserved') then
    select coalesce(jsonb_agg(jsonb_build_object('mark', l.mark_id, 'tier', l.tier, 'shiny', l.shiny) order by l.idx), '[]'::jsonb)
      into out from private.roll_log l where l.profile_id = pid and l.seq = v_seq and l.state = 'reserved';
    return json_build_object('ok', true, 'seq', v_seq, 'picks', out, 'again', true);
  end if;
  select count(*) into recent from private.roll_log where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC and not coalesce(p.is_tester, false) then return json_build_object('ok', false, 'reason', 'rate'); end if;
  budget := private.gem_budget(pid);
  -- over budget: refused — the browser then rolls LOCALLY as before (the player never loses a roll; that gear just
  -- can't go on the card). The TESTER code has no budget.
  if p.s2_roll_spent + ROLL_PRICE > budget and not coalesce(p.is_tester, false) then
    return json_build_object('ok', false, 'reason', 'budget', 'budget', budget, 'spent', p.s2_roll_spent);
  end if;
  n := least(2, greatest(1, coalesce(p_n, 1)));        -- SINGULARITY's double roll: one price, two picks
  L := least(LUCK_CAP, greatest(1, coalesce(p_luck, 1)));
  se := p.s2_since_epic; sl := p.s2_since_leg; rolls := p.s2_rolls;
  for i in 0 .. n - 1 loop
    bonus := (rolls + 1) % BONUS_EVERY = 0;
    select * into pk from private.pick_gear(L * (case when bonus then 2 else 1 end), se, sl);
    sh := random() < SHINY;
    insert into private.roll_log (profile_id, seq, idx, mark_id, tier, shiny, luck, forced, bonus)
    values (pid, v_seq, i, pk.mark_id, pk.tier, sh, L, pk.forced, bonus);
    out := out || jsonb_build_object('mark', pk.mark_id, 'tier', pk.tier, 'shiny', sh);
    se := case when private.tier_rank(pk.tier) >= 1 then 0 else se + 1 end;
    sl := case when private.tier_rank(pk.tier) >= 2 then 0 else sl + 1 end;
    rolls := rolls + 1;
  end loop;
  return json_build_object('ok', true, 'seq', v_seq, 'picks', out);
end $$;
revoke all on function public.lb_roll(text, double precision, integer) from public;
grant execute on function public.lb_roll(text, double precision, integer) to anon, authenticated;

-- ---- lb_roll_claim: the release — ownership, counters, spend ---------------------------------------------------------
create or replace function public.lb_roll_claim(p_secret text, p_seq integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; l record; se integer; sl integer; rolls integer; k integer := 0;
        ROLL_PRICE constant integer := 75;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  if p_seq is null or p_seq <> p.s2_roll_seq + 1 then
    -- already claimed (a retry) → ok; anything else → nothing to claim
    return json_build_object('ok', p_seq is not null and p_seq <= p.s2_roll_seq, 'reason', 'seq', 'seq', p.s2_roll_seq);
  end if;
  se := p.s2_since_epic; sl := p.s2_since_leg; rolls := p.s2_rolls;
  for l in select * from private.roll_log where profile_id = pid and seq = p_seq and state = 'reserved' order by idx loop
    insert into private.gear_owned as o (profile_id, mark_id, copies, shiny, source)
    values (pid, l.mark_id, 1, l.shiny, 'roll')
    on conflict (profile_id, mark_id) do update set copies = o.copies + 1, shiny = o.shiny or excluded.shiny;
    se := case when private.tier_rank(l.tier) >= 1 then 0 else se + 1 end;
    sl := case when private.tier_rank(l.tier) >= 2 then 0 else sl + 1 end;
    rolls := rolls + 1;
    k := k + 1;
  end loop;
  if k = 0 then return json_build_object('ok', false, 'reason', 'seq', 'seq', p.s2_roll_seq); end if;
  update private.roll_log set state = 'claimed', claimed_at = now() where profile_id = pid and seq = p_seq;
  update public.profiles set s2_roll_seq = p_seq, s2_rolls = rolls, s2_since_epic = se, s2_since_leg = sl,
         s2_roll_spent = s2_roll_spent + ROLL_PRICE where id = pid;
  return json_build_object('ok', true, 'seq', p_seq);
end $$;
revoke all on function public.lb_roll_claim(text, integer) from public;
grant execute on function public.lb_roll_claim(text, integer) to anon, authenticated;

-- ---- the audit: could this account plausibly have rolled `mark`? -----------------------------------------------------
-- RARE / EPIC / LEGENDARY: always (cheap, common). MYTHIC / SECRET: the rolls its gem budget buys, at a GENEROUS luck,
-- must give ≥ 1% chance of that exact gear. Not proof either way — a filter on the impossible.
create or replace function private.gear_chance(p_pid uuid, p_mark text)
returns double precision language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare g private.gear_pool; rolls numeric;
        AUDIT_LUCK constant numeric := 4; ROLL_PRICE constant integer := 75;
begin
  select * into g from private.gear_pool where mark_id = p_mark;
  if not found then return 1; end if;                    -- not a rollable gear (a PERMANENT / legacy mark)
  if private.tier_rank(g.tier) <= 2 then return 1; end if; -- RARE / EPIC / LEGENDARY: always believable
  rolls := private.gem_budget(p_pid) / 1.5 / ROLL_PRICE; -- the budget WITHOUT its slack
  return 1 - power(1 - least(1, AUDIT_LUCK / g.x), rolls);
end $$;
revoke all on function private.gear_chance(uuid, text) from public;
revoke all on function private.gear_chance(uuid, text) from anon, authenticated;
create or replace function private.gear_plausible(p_pid uuid, p_mark text)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select private.gear_chance(p_pid, p_mark) >= 0.01;
$$;
revoke all on function private.gear_plausible(uuid, text) from public;
revoke all on function private.gear_plausible(uuid, text) from anon, authenticated;

-- a showcased gear: owned by the server, or (once) grandfathered by the audit for an old account, else refused
create or replace function private.gear_check(p_pid uuid, p_mark text)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created timestamptz; tester boolean;
        ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00'; -- accounts made after this roll on the server only
        REVERT_BELOW constant double precision := 0.0001; -- under 0.01%: practically impossible → dropped from the save too
begin
  if p_mark is null then return null; end if;
  if not exists (select 1 from private.gear_pool where mark_id = p_mark) then return p_mark; end if; -- PERMANENT / legacy
  select coalesce(is_tester, false) into tester from public.profiles where id = p_pid;
  if tester then return p_mark; end if; -- the TESTER code skips every check
  if exists (select 1 from private.gear_owned where profile_id = p_pid and mark_id = p_mark) then return p_mark; end if;
  if exists (select 1 from private.gear_refused where profile_id = p_pid and mark_id = p_mark) then return null; end if;
  select created_at into created from public.profiles where id = p_pid;
  if created < ROLL_CUTOFF and private.gear_plausible(p_pid, p_mark) then
    insert into private.gear_owned (profile_id, mark_id, source) values (p_pid, p_mark, 'grandfather') on conflict do nothing;
    return p_mark;
  end if;
  -- refused: hidden from the card + flagged for Andy. Dropped from the player's own save ONLY when practically impossible
  insert into private.gear_refused (profile_id, mark_id, revert)
  values (p_pid, p_mark, created < ROLL_CUTOFF and private.gear_chance(p_pid, p_mark) < REVERT_BELOW)
  on conflict do nothing;
  begin
    insert into private.cheat_flags (profile_id, reason, detail)
    values (p_pid, 'gear', jsonb_build_object('mark', p_mark, 'budget', private.gem_budget(p_pid)));
  exception when others then null; end;
  return null;
end $$;
revoke all on function private.gear_check(uuid, text) from public;
revoke all on function private.gear_check(uuid, text) from anon, authenticated;

-- ---- 031's lb_showcase_set + the gear check ----------------------------------------------------------------------------
create or replace function public.lb_showcase_set(p_secret text, p_show jsonb)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g1 text; g2 text; bw numeric; wpw double precision; gf integer; gt integer; pw integer;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  if p_show is null or jsonb_typeof(p_show) <> 'object' or length(p_show::text) > 2000 then
    return json_build_object('error', 'bad_show');
  end if;
  g1 := p_show->>'gear1'; if g1 is not null and g1 !~ '^mk-[a-z0-9-]{1,24}$' then g1 := null; end if;
  g2 := p_show->>'gear2'; if g2 is not null and g2 !~ '^mk-[a-z0-9-]{1,24}$' then g2 := null; end if;
  g1 := private.gear_check(pid, g1); -- 036: only gears the server knows (or the audit grandfathered)
  g2 := private.gear_check(pid, g2);
  begin bw := (p_show->>'base_wins')::numeric; exception when others then bw := null; end;
  if bw is not null and (bw < 0 or bw > 1e12) then bw := null; end if;
  begin wpw := (p_show->>'wins_per_word')::double precision; exception when others then wpw := null; end;
  if wpw is not null and (wpw < 0 or wpw > 1e300 or wpw = 'NaN'::double precision) then wpw := null; end if;
  begin gf := (p_show->>'gears_found')::integer; exception when others then gf := null; end;
  if gf is not null and (gf < 0 or gf > 500) then gf := null; end if;
  begin gt := (p_show->>'gears_total')::integer; exception when others then gt := null; end;
  if gt is not null and (gt < 0 or gt > 500) then gt := null; end if;
  begin pw := (p_show->>'power')::integer; exception when others then pw := null; end;
  if pw is not null and (pw < 0 or pw > 1000) then pw := null; end if;
  insert into public.profile_showcase as s (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, updated_at)
  values (pid, g1, g2, bw, wpw, gf, gt, pw, now())
  on conflict (profile_id) do update set
    gear1 = excluded.gear1, gear2 = excluded.gear2, base_wins = excluded.base_wins, wins_per_word = excluded.wins_per_word,
    gears_found = excluded.gears_found, gears_total = excluded.gears_total, power = excluded.power, updated_at = now()
  where s.updated_at < now() - interval '20 seconds';
  return json_build_object('ok', true);
end $$;
revoke all on function public.lb_showcase_set(text, jsonb) from public;
grant execute on function public.lb_showcase_set(text, jsonb) to anon, authenticated;

-- ---- lb_gears: what the server owns for me + what the audit refused (the browser drops those) --------------------------
create or replace function public.lb_gears(p_secret text)
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('owned', '[]'::json, 'refused', '[]'::json); end if;
  return json_build_object(
    'owned', (select coalesce(json_agg(json_build_object('mark', mark_id, 'copies', copies, 'shiny', shiny, 'source', source)), '[]'::json)
                from private.gear_owned where profile_id = pid),
    'refused', (select coalesce(json_agg(mark_id), '[]'::json) from private.gear_refused where profile_id = pid),
    'revert', (select coalesce(json_agg(mark_id), '[]'::json) from private.gear_refused where profile_id = pid and revert));
end $$;
revoke all on function public.lb_gears(text) from public;
grant execute on function public.lb_gears(text) to anon, authenticated;

-- ---- the ONE-TIME AUDIT of what is on show today: every showcased gear goes through the check now --------------------
do $$
declare s record;
begin
  for s in select profile_id, gear1, gear2 from public.profile_showcase loop
    update public.profile_showcase
       set gear1 = private.gear_check(s.profile_id, s.gear1), gear2 = private.gear_check(s.profile_id, s.gear2)
     where profile_id = s.profile_id;
  end loop;
end $$;

-- REVIEW (SQL editor): what the audit refused, and why
--   select p.username, r.mark_id, private.gem_budget(p.id) as budget from private.gear_refused r join public.profiles p on p.id = r.profile_id;
-- OVERRIDE a refusal (you decide it was real):
--   delete from private.gear_refused where profile_id = (select id from public.profiles where lower(username) = 'name') and mark_id = 'mk-origin';
--   insert into private.gear_owned (profile_id, mark_id, source) select id, 'mk-origin', 'grandfather' from public.profiles where lower(username) = 'name';

notify pgrst, 'reload schema';
