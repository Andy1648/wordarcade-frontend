-- 021_server_rebirth.sql — SERVER-CHECKED REBIRTH (Andy oct5, progression-v3 "Anti-exploit", phase 1).
--
-- WHY: imbetterthanandy posted R100 with 422 words. Rebirth was purely client-side (localStorage) and the board
-- accepted whatever rebirth count a submit carried (018 bounded it by a wall-time token bucket, 020 also by words —
-- but both still let the SUBMIT raise rebirths, so a forged or double-fired local count reached the board). From
-- this file on, a rebirth is a SERVER action:
--   * public.lb_rebirth(p_secret, p_request_id, p_season) — recomputes the gate from the STORED row, does ONE rebirth
--     per call, and is IDEMPOTENT: (profile, request id) is logged with its result in public.rebirth_requests; the
--     same id again returns the stored result (+ replay: true) and changes nothing. A double click, a retry after a
--     lost response, or a replayed request can never mint a second rebirth. ≤ 2 logged calls a second per profile
--     (a rate refusal is not logged). ≤ 12 granted rebirths in any rolling hour (020's 1-per-5-min / 12-banked
--     token bucket, carried over so 021 is never weaker than 020; counted from the request log, rb_clock untouched).
--   * public.lb_ascend(p_secret, p_request_id, p_season) — progression v3 ascension (season 2 only; unused until the
--     SEASON2 flag): needs ≥ 10 stored rebirths; stars += rebirths − 9, rebirths = 0, level = 1. Same log/idempotency.
--   * private.lb_board_write_rr — 020's rule, except a SUBMIT NEVER RAISES REBIRTHS above the stored count (the only
--     exception is 018's one-time conversion for a row still on econ < 12). Lower rebirths are still a RESET (017).
--     The rebirth token bucket no longer lifts anything (profiles.rb_clock is kept and written back unchanged).
--   * profiles.stars (new, 0) and both board views carry it as a trailing column. BOARD ORDER UNCHANGED
--     (rebirths desc, level desc, lifetime_words desc, created_at asc); ★ → R → level is phase 3.
--   * lb_caps adds rebirth_rpc: true — the client uses lb_rebirth only when it sees it.
--
-- SUPERSEDES 019 AND 020: this file re-declares private.lb_board_write_rr with everything 019 (round gate
-- 25 × (R+1) + 50 headroom) and 020 (first submit ≤ words / 40 + 7, level ≤ its gate + 50) carried forward. If 019
-- and/or 020 were never run, SKIP THEM and run only this one. It needs 018 (profiles.rb_clock, lb_submit3 on econ 12):
-- the first statement below stops with a clear error if 018 is not in.
--
-- ORDER (Andy): 1. deploy the client (it keeps today's local rebirth until lb_caps says rebirth_rpc, so it is safe
-- BEFORE this file runs); 2. run this whole file in the SQL Editor; 3. `notify pgrst, 'reload schema';`.
-- If 018 is ever re-run, re-run THIS file after it (018 re-declares the board write with its token bucket).
--
-- KEEP IN SYNC WITH src/leaderboard/rebirthRules.js (decideRebirth / decideAscend) and src/leaderboard/submitRules.js
-- (decideSubmitRR) — the same checks, order and constants; rebirthRules.test.js / submitRules.test.js pin both.
-- WRITE-ONLY: Claude never runs migrations. Safe to re-run (if not exists / create or replace).

do $$
begin
  if to_regprocedure('private.lb_board_write_rr(text,integer,integer,bigint,bigint,numeric,smallint)') is null then
    raise exception '021 needs 018_rebirth_rush.sql — run 018 first, then this file';
  end if;
end $$;

-- ---- columns ------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists rb_clock timestamptz; -- 018's; kept, no longer moved
alter table public.profiles add column if not exists stars integer not null default 0;

-- ---- the request log ------------------------------------------------------------------------------------------
-- One row per answered rebirth/ascend request (rate refusals and bad ids are not logged). RLS on, no policies, no
-- grants: only the SECURITY DEFINER functions below read or write it.
create table if not exists public.rebirth_requests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null,
  action text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, request_id)
);
create index if not exists rebirth_requests_recent_idx on public.rebirth_requests (profile_id, created_at desc);
alter table public.rebirth_requests enable row level security;
revoke all on table public.rebirth_requests from public;
revoke all on table public.rebirth_requests from anon, authenticated;

-- ---- lb_rebirth ---------------------------------------------------------------------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON → GATE → PACE → GRANT (one rebirth).
create or replace function public.lb_rebirth(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; gate numeric; recent integer;
        granted integer; oldest timestamptz;
        RATE_PER_SEC constant integer := 2;       -- logged calls per profile per rolling second
        RB_WINDOW_SECS constant integer := 3600;  -- the pace window (020: 1 token / 5 min, 12 banked)
        RB_PER_WINDOW constant integer := 12;     -- granted rebirths allowed inside one window
        LOG_KEEP_DAYS constant integer := 30;     -- request-log rows older than this are pruned
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
  -- the gate, from the STORED row: season 0 = 25 × (R+1) (019); season 2 = ⌈100 × 2.5^R⌉ (progression v3)
  gate := case when p_season = 0 then 25 * (old.rebirths::numeric + 1)
               when p_season = 2 then ceil(100 * power(2.5::numeric, old.rebirths::numeric))
               else null end;
  if gate is null then
    res := jsonb_build_object('ok', false, 'reason', 'season');
  elsif old.level < gate then
    res := jsonb_build_object('ok', false, 'reason', 'gate', 'gate', gate, 'level', old.level, 'rebirths', old.rebirths);
  else
    -- PACE: ≤ RB_PER_WINDOW granted rebirths in any rolling RB_WINDOW_SECS
    select count(*), min(created_at) into granted, oldest from public.rebirth_requests
     where profile_id = pid and action = 'rebirth' and (result->>'ok')::boolean
       and created_at > now() - make_interval(secs => RB_WINDOW_SECS);
    if granted >= RB_PER_WINDOW then
      res := jsonb_build_object('ok', false, 'reason', 'wait', 'rebirths', old.rebirths,
               'retry_in', greatest(1, ceil(extract(epoch from (oldest + make_interval(secs => RB_WINDOW_SECS) - now())))::integer));
    else
      -- ONE rebirth: rebirths + 1, level 1 (rb_clock untouched)
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

-- ---- lb_ascend (season 2 only) --------------------------------------------------------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON (2) → GATE (≥ ASCEND_AT rebirths) → GRANT.
create or replace function public.lb_ascend(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; recent integer; st integer;
        RATE_PER_SEC constant integer := 2;
        ASCEND_AT constant integer := 10;         -- stars += rebirths − (ASCEND_AT − 1)
        LOG_KEEP_DAYS constant integer := 30;
begin
  if p_request_id is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  select * into prev from public.rebirth_requests where profile_id = pid and request_id = p_request_id;
  if found then
    if prev.action <> 'ascend' then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
    return (prev.result || jsonb_build_object('replay', true))::json;
  end if;
  select count(*) into recent from public.rebirth_requests
   where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC then return json_build_object('ok', false, 'reason', 'rate'); end if;
  if p_season is distinct from 2 then
    res := jsonb_build_object('ok', false, 'reason', 'season');
  elsif old.rebirths < ASCEND_AT then
    res := jsonb_build_object('ok', false, 'reason', 'gate', 'need', ASCEND_AT, 'rebirths', old.rebirths);
  else
    st := coalesce(old.stars, 0) + old.rebirths - (ASCEND_AT - 1);
    update public.profiles set stars = st, rebirths = 0, level = 1, updated_at = now() where id = pid;
    res := jsonb_build_object('ok', true, 'stars', st, 'rebirths', 0, 'level', 1);
  end if;
  insert into public.rebirth_requests (profile_id, request_id, action, result) values (pid, p_request_id, 'ascend', res);
  delete from public.rebirth_requests where profile_id = pid and created_at < now() - make_interval(days => LOG_KEEP_DAYS);
  return res::json;
end $$;
revoke all on function public.lb_ascend(text, uuid, smallint) from public;
grant execute on function public.lb_ascend(text, uuid, smallint) to anon, authenticated;

-- ---- the board write: 020's rule, but a SUBMIT NEVER RAISES REBIRTHS (supersedes 018 / 019 / 020) ----------------
-- Not callable by anon/authenticated (private schema, execute revoked); 018's lb_submit3 (SECURITY DEFINER) runs it.
create or replace function private.lb_board_write_rr(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric, p_econ smallint)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean;
        old_gate bigint; conv bigint; lv_cap bigint; play_cap bigint;
        WORDS_PER_RB constant integer := 40;    -- 020: a FIRST submit's rebirths ≤ lifetime words / 40 …
        FIRST_CONV_ALLOW constant integer := 7; -- 020: … + the legit one-time conversion (max +7)
        LV_HEADROOM constant integer := 50; -- levels allowed past the next rebirth gate (two rebirths' worth at 25 a rebirth)
        CONV_CAP constant integer := 15;    -- the one-time conversion bonus never exceeds 15 rebirths (legit max +7):
                                            -- a forged old level must not become hundreds of rebirths
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, coalesce(p_level, 1));
  rb := greatest(0, coalesce(p_rebirths, 0));
  w := greatest(0, coalesce(p_lifetime_words, 0));
  l := greatest(0, coalesce(p_lifetime_letters, 0));
  delta := 0;            -- 013: the first submit is a baseline only
  play_cap := floor(w / WORDS_PER_RB)::bigint;
  if old.submitted_at is null then
    -- 020: the first submit is still a baseline, but bounded by its own play (+ the conversion allowance)
    rb := least(rb::bigint, play_cap + FIRST_CONV_ALLOW)::integer;
    lv := least(lv::bigint, 25 * (rb::bigint + 1) + LV_HEADROOM)::integer;
  end if;
  if old.submitted_at is not null then
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    -- 015's level allowance: ≤ 0.5 a second since the last accepted submit, banking ≤ 20 min (600 levels)
    max_rise := greatest(1, floor(least(secs, 1200) * 0.5)::bigint);
    -- RR: the one-time conversion bonus (row still on an older economy), from the STORED row
    old_gate := 15 + 18 * old.rebirths::bigint;
    conv := case when coalesce(old.econ, 0) < 12 and old.level >= old_gate
                 then least(CONV_CAP, floor((old.level - old_gate) / 18.0)::bigint + 1) else 0 end;
    is_reset := rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
                or (lv < old.level and rb = old.rebirths);
    if not is_reset then
      -- INCREASE: words/letters rate-checked exactly as 011/013/015 (too fast → the whole submit is rejected)
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    -- 021: a submit NEVER raises rebirths past the stored count (+ the one-time conversion); they rise only through
    -- lb_rebirth. A lower count is a reset (017) and lands as submitted.
    rb := least(rb::bigint, old.rebirths::bigint + conv)::integer;
    -- RR: the level is free up to the next gate + headroom (or 015's allowance above base, if that is higher)
    base_lv := case when is_reset or rb > old.rebirths then 1 else old.level end;
    lv_cap := greatest(25 * (rb::bigint + 1) + LV_HEADROOM, base_lv + max_rise); -- 019: the gate is 25 × (R+1)
    if is_reset then
      -- 017 RESET → a new baseline: lower values land as submitted; anything that went UP is bounded (level by
      -- the cap, never forced below the stored level; words/letters by the rate limit). No weekly words.
      lv := least(lv::bigint, greatest(old.level::bigint, lv_cap))::integer;
      w := least(w, old.lifetime_words + floor(20 * secs)::bigint);
      l := least(l, old.lifetime_letters + floor(150 * secs)::bigint);
    else
      lv := least(lv::bigint, lv_cap)::integer;
      -- 013: the words typed since the last accepted submit
      delta := greatest(0, w - coalesce(old.lifetime_words, 0));
    end if;
  end if;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = coalesce(p_econ, econ),
         rb_clock = old.rb_clock, -- 021: kept, no longer moved
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function private.lb_board_write_rr(text, integer, integer, bigint, bigint, numeric, smallint) from public;
revoke all on function private.lb_board_write_rr(text, integer, integer, bigint, bigint, numeric, smallint) from anon, authenticated;

-- ---- the board views: + stars (trailing). ORDER UNCHANGED (rebirths, level, words, first-come) ------------------
-- Same columns, order and grants as 018 (leaderboard) and 017 (leaderboard_weekly), plus `stars` at the end.
-- Every migration that (re)builds public.leaderboard MUST carry this order (★ first is phase 3).
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by rebirths desc, level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word, econ, stars
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

drop view if exists public.leaderboard_weekly;
create view public.leaderboard_weekly with (security_invoker = true) as
  select row_number() over (order by week_words desc, level desc, created_at asc) as rank,
         id, username, level, rebirths, week_words, econ, stars
    from public.profiles
   where week_key = (date_trunc('week', now() at time zone 'America/New_York'))::date and week_words > 0;
grant select on public.leaderboard_weekly to anon, authenticated;

-- ---- feature detection: 018's caps + rebirth_rpc ----------------------------------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 12,
                           'rebirth_rpc', true)
$$;
grant execute on function public.lb_caps() to anon, authenticated;
