-- 023_season2_reset.sql — THE SEASON 2 RESET (PROGRESSION v3, Andy oct5 phase 4; claude/mockups/v2/progression-v3.md
-- "The reset", claude/mockups/v2/Season2.dc.html). The SAME SQL as claude/run-season2.sql (season2Reset.test.js pins it).
--
-- ===== THE ORDER (Andy) ===========================================================================================
--   1. The client is deployed with SEASON2 still OFF (progression v3 #214 + this PR merged; nothing changes for players).
--   2. In the Supabase SQL Editor run, in this order: 022_season2_board.sql, then 024_season2_weekly.sql (the P8 board),
--      then THIS WHOLE FILE (claude/run-season2.sql is the same text). It stops with a clear error if 022 is not in.
--   3. Run:  notify pgrst, 'reload schema';
--   4. Tell Claude "flip SEASON2". Claude flips the ONE line (src/progress/season.js SEASON2_LIVE = true) — nothing
--      before that: until the flip every live client is season 1, and a season-1 client can no longer write the
--      board (the rows are econ 13 → 'old_client', 022) or the cloud save (see lb_save2 below), so the reset sticks.
--
-- ===== WHAT IT DOES (once) =========================================================================================
--   a. SNAPSHOT every profile into public.season1_snapshot (and every cloud save into private.season1_cloud_saves) —
--      the reset is REVERSIBLE: claude/rollback-season2.sql restores both from these tables.
--   b. GRANTS: public.season2_grants gets one row per profile, gems = round5(300 + 40 × old rebirths) — the nearest
--      multiple of 5, spelled out as 5 × round(x / 5) (300 and 40 are multiples of 5, so for a whole rebirth count it
--      is exact; the rounding is the rule, kept for any future constant). R0 → 300, R1 → 340, R100 → 4,300.
--      (Andy's formula; it overrides the spec's 150 × old rebirths.) Uncapped, as written; bigint math, int-clamped.
--   c. RESET every profile EXCEPT its identity (id, username, name_changed_at, created_at, the secret in
--      private.profile_secrets). COLUMNS WRITTEN on public.profiles:
--        level = 1, rebirths = 0, stars = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
--        week_words = 0, week_key = null, rb_clock = null, submitted_at = null (the next submit is a fresh season-2
--        baseline, 022), reset_all = false, econ = 13 (a season-2 row), updated_at = now();
--        and, if 024 is in: s2_week_key = null, s2_week_stars0 = 0, s2_week_rb0 = 0, s2_week_lv0 = 1 (024's
--        week-stamp trigger is switched off for this one update so it cannot stamp a pre-reset baseline).
--   d. CLEARS public.rebirth_requests (021's rebirth/ascend log — a fresh pace window for everyone).
--   e. WIPES private.cloud_saves (after the snapshot), so restoreFromCloud can never pull a season-1 save back.
--   f. Writes the one-shot marker public.season2_reset (id 1). lb_caps reports season2_reset: true from then on.
--   Everything else a season-1 save held (POWER, marks, gems, achievements, wins, records …) lives only in the browser;
--   the season-2 client wipes it once it sees season2_reset (src/progress/v3/season2Boot.js).
--
-- ===== THE NEW SURFACE =============================================================================================
--   * public.lb_season2_grant(p_secret)              — peek: { found, gems, rebirths, claimed } (the welcome's numbers)
--   * public.lb_season2_claim(p_secret, p_request_id) — { ok: true, gems } ONCE (sets claimed_at); any later claim →
--     { ok: false, reason: 'claimed', gems }. The SAME request id again (a retry after a lost answer) → its answer
--     again ({ ok: true, gems, replay: true }) — never a second grant. No grant row → { ok: false, reason: 'no_grant' }.
--   * lb_save2 / lb_load2 — 018's bodies; after the reset they speak econ 13 only (a season-1 client gets 'old_client':
--     it can neither write a season-1 save back nor read one).
--   * lb_caps — 022's keys, unchanged, + season2_reset (true once this file's reset ran).
--
-- SAFE TO RE-RUN: the tables / functions are `if not exists` / `create or replace`; the reset itself runs only while
-- public.season2_reset is empty — a second run prints a NOTICE and changes no row.
-- KEEP IN SYNC WITH src/leaderboard/season2Rules.js (season2Gems / decideSeason2Claim) — season2Reset.test.js pins
-- the constants below against it. WRITE-ONLY: Claude never runs migrations.

do $$
begin
  if to_regprocedure('private.lb_board_write_s2(text,integer,integer,bigint,bigint,numeric)') is null then
    raise exception '023 needs 022_season2_board.sql — run 022 (then 024) first, then this file';
  end if;
end $$;

-- ---- tables (RLS on, no policies, no grants: only the SECURITY DEFINER functions below touch them) -----------------
create table if not exists public.season2_reset (
  id smallint primary key check (id = 1),
  ran_at timestamptz not null default now(),
  profiles integer not null default 0,
  gems_total bigint not null default 0
);
alter table public.season2_reset enable row level security;
revoke all on table public.season2_reset from public;
revoke all on table public.season2_reset from anon, authenticated;

create table if not exists public.season1_snapshot (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null,
  rebirths integer not null,
  level integer not null,
  stars integer not null,
  lifetime_words bigint not null,
  lifetime_letters bigint not null,
  wins_per_word numeric not null,
  econ smallint not null,
  snapped_at timestamptz not null default now(),
  -- the rest of what the reset writes, so the rollback is exact
  week_key date,
  week_words bigint not null default 0,
  rb_clock timestamptz,
  submitted_at timestamptz,
  reset_all boolean not null default false
);
alter table public.season1_snapshot enable row level security;
revoke all on table public.season1_snapshot from public;
revoke all on table public.season1_snapshot from anon, authenticated;

create table if not exists private.season1_cloud_saves (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  blob text not null,
  score numeric(30, 0) not null default 0,
  saved_at timestamptz not null,
  snapped_at timestamptz not null default now()
);
revoke all on private.season1_cloud_saves from public, anon, authenticated;

create table if not exists public.season2_grants (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  gems integer not null check (gems >= 0),
  rebirths integer not null default 0, -- the old (season-1) rebirths the gems came from (the welcome's "OLD RUN R")
  claimed_at timestamptz null,
  claim_request uuid null              -- the request id that claimed (a retry with it replays the answer)
);
alter table public.season2_grants enable row level security;
revoke all on table public.season2_grants from public;
revoke all on table public.season2_grants from anon, authenticated;

-- ---- the grant formula: round5(300 + 40 × old rebirths) ------------------------------------------------------------
create or replace function private.season2_gems(p_rebirths bigint)
returns integer language plpgsql immutable as $$
declare
  GRANT_BASE constant integer := 300;       -- every player
  GRANT_PER_REBIRTH constant integer := 40; -- per old (season-1) rebirth
  GRANT_ROUND constant integer := 5;        -- round to the NEAREST multiple of 5 (half up)
  raw bigint;
begin
  raw := GRANT_BASE::bigint + GRANT_PER_REBIRTH::bigint * greatest(0, coalesce(p_rebirths, 0));
  return least(2147483647, (GRANT_ROUND * round(raw::numeric / GRANT_ROUND))::bigint)::integer;
end $$;
revoke all on function private.season2_gems(bigint) from public;
revoke all on function private.season2_gems(bigint) from anon, authenticated;

-- ---- THE RESET (one-shot: only while public.season2_reset is empty; one statement = one transaction) ----------------
do $$
declare n integer; total bigint; has_week boolean; has_trig boolean; ran timestamptz;
begin
  select ran_at into ran from public.season2_reset where id = 1;
  if found then
    raise notice 'season 2 reset already ran at % — nothing to do', ran;
    return;
  end if;
  lock table public.profiles in share row exclusive mode; -- no board write lands between the snapshot and the reset

  -- a. snapshot (upsert: a run after claude/rollback-season2.sql re-snapshots the restored season-1 rows)
  insert into public.season1_snapshot as s (profile_id, username, rebirths, level, stars, lifetime_words, lifetime_letters,
                                            wins_per_word, econ, snapped_at, week_key, week_words, rb_clock, submitted_at, reset_all)
  select id, username, rebirths, level, coalesce(stars, 0), lifetime_words, lifetime_letters, wins_per_word, coalesce(econ, 0),
         now(), week_key, coalesce(week_words, 0), rb_clock, submitted_at, coalesce(reset_all, false)
    from public.profiles
  on conflict (profile_id) do update
     set username = excluded.username, rebirths = excluded.rebirths, level = excluded.level, stars = excluded.stars,
         lifetime_words = excluded.lifetime_words, lifetime_letters = excluded.lifetime_letters,
         wins_per_word = excluded.wins_per_word, econ = excluded.econ, snapped_at = excluded.snapped_at,
         week_key = excluded.week_key, week_words = excluded.week_words, rb_clock = excluded.rb_clock,
         submitted_at = excluded.submitted_at, reset_all = excluded.reset_all;
  insert into private.season1_cloud_saves as c (profile_id, blob, score, saved_at, snapped_at)
  select profile_id, blob, score, saved_at, now() from private.cloud_saves
  on conflict (profile_id) do update
     set blob = excluded.blob, score = excluded.score, saved_at = excluded.saved_at, snapped_at = excluded.snapped_at;

  -- b. grants (a re-run after a rollback keeps claimed_at / claim_request: a claimed gift is never paid twice)
  insert into public.season2_grants as g (profile_id, gems, rebirths)
  select id, private.season2_gems(rebirths), rebirths from public.profiles
  on conflict (profile_id) do update set gems = excluded.gems, rebirths = excluded.rebirths;

  -- c. reset (024's week-stamp trigger off for this one update, if 024 is in)
  has_week := exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'profiles' and column_name = 's2_week_key');
  has_trig := exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'lb_s2_week_stamp');
  if has_trig then execute 'alter table public.profiles disable trigger lb_s2_week_stamp'; end if;
  update public.profiles
     set level = 1, rebirths = 0, stars = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
         week_words = 0, week_key = null, rb_clock = null, submitted_at = null, reset_all = false,
         econ = 13, updated_at = now();
  get diagnostics n = row_count;
  if has_week then
    execute 'update public.profiles set s2_week_key = null, s2_week_stars0 = 0, s2_week_rb0 = 0, s2_week_lv0 = 1';
  end if;
  if has_trig then execute 'alter table public.profiles enable trigger lb_s2_week_stamp'; end if;

  -- d. the rebirth / ascend request log
  delete from public.rebirth_requests;
  -- e. the cloud saves (snapshotted above)
  delete from private.cloud_saves;

  -- f. the marker
  select coalesce(sum(gems), 0) into total from public.season2_grants;
  insert into public.season2_reset (id, ran_at, profiles, gems_total) values (1, now(), n, total);
  raise notice 'season 2 reset: % profiles reset, % gems granted', n, total;
end $$;

-- ---- lb_season2_grant: the welcome's peek -------------------------------------------------------------------------
create or replace function public.lb_season2_grant(p_secret text)
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g public.season2_grants;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into g from public.season2_grants where profile_id = pid;
  if not found then return json_build_object('found', false, 'gems', 0, 'rebirths', 0, 'claimed', false); end if;
  return json_build_object('found', true, 'gems', g.gems, 'rebirths', g.rebirths, 'claimed', g.claimed_at is not null);
end $$;
revoke all on function public.lb_season2_grant(text) from public;
grant execute on function public.lb_season2_grant(text) to anon, authenticated;

-- ---- lb_season2_claim: ONCE --------------------------------------------------------------------------------------
-- CHECK ORDER: bad id → profile → grant row (locked) → already claimed (same id = replay, else 'claimed') → CLAIM.
create or replace function public.lb_season2_claim(p_secret text, p_request_id uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g public.season2_grants;
begin
  if p_request_id is null then return json_build_object('ok', false, 'reason', 'bad_request', 'gems', 0); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into g from public.season2_grants where profile_id = pid for update;
  if not found then return json_build_object('ok', false, 'reason', 'no_grant', 'gems', 0); end if;
  if g.claimed_at is not null then
    if g.claim_request = p_request_id then
      return json_build_object('ok', true, 'gems', g.gems, 'rebirths', g.rebirths, 'replay', true);
    end if;
    return json_build_object('ok', false, 'reason', 'claimed', 'gems', g.gems);
  end if;
  update public.season2_grants set claimed_at = now(), claim_request = p_request_id where profile_id = pid;
  return json_build_object('ok', true, 'gems', g.gems, 'rebirths', g.rebirths);
end $$;
revoke all on function public.lb_season2_claim(text, uuid) from public;
grant execute on function public.lb_season2_claim(text, uuid) to anon, authenticated;

-- ---- the cloud save: 018's lb_save2 / lb_load2, econ 13 only once the reset ran ------------------------------------
create or replace function public.lb_save2(p_secret text, p_blob text, p_score numeric, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old private.cloud_saves;
begin
  if p_econ is distinct from (case when exists (select 1 from public.season2_reset) then 13 else 12 end) then
    return json_build_object('saved', false, 'reason', 'old_client');
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 65536 then raise exception 'bad_blob'; end if;
  select * into old from private.cloud_saves where profile_id = pid for update;
  if found then
    if old.saved_at >= now() - interval '20 seconds' then return json_build_object('saved', false, 'reason', 'throttled'); end if;
    if coalesce(p_score, 0) < old.score then return json_build_object('saved', false, 'reason', 'lower'); end if;
    update private.cloud_saves set blob = p_blob, score = coalesce(p_score, 0), saved_at = now() where profile_id = pid;
  else
    insert into private.cloud_saves (profile_id, blob, score) values (pid, p_blob, coalesce(p_score, 0));
  end if;
  return json_build_object('saved', true);
end $$;
revoke all on function public.lb_save2(text, text, numeric, integer) from public;
grant execute on function public.lb_save2(text, text, numeric, integer) to anon, authenticated;

create or replace function public.lb_load2(p_secret text, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text; rst boolean;
begin
  if p_econ is distinct from (case when exists (select 1 from public.season2_reset) then 13 else 12 end) then
    raise exception 'old_client';
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select username, reset_all into uname, rst from public.profiles where id = pid;
  select * into s from private.cloud_saves where profile_id = pid;
  if not found then
    return json_build_object('id', pid, 'username', uname, 'blob', null, 'score', 0, 'reset_all', coalesce(rst, false));
  end if;
  return json_build_object('id', pid, 'username', uname, 'blob', s.blob, 'score', s.score, 'saved_at', s.saved_at,
                           'reset_all', coalesce(rst, false));
end $$;
revoke all on function public.lb_load2(text, integer) from public;
grant execute on function public.lb_load2(text, integer) to anon, authenticated;

-- ---- feature detection: 022's caps (every key kept) + season2_reset ------------------------------------------------
-- SECURITY DEFINER so anon can see the marker (the table itself has no grants).
create or replace function public.lb_caps()
returns json language sql stable security definer set search_path = public, pg_temp as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 12,
                           'rebirth_rpc', true, 'season2', true, 'econ2', 13,
                           'season2_reset', exists (select 1 from public.season2_reset))
$$;
revoke all on function public.lb_caps() from public;
grant execute on function public.lb_caps() to anon, authenticated;
