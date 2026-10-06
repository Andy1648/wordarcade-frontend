-- 022_season2_board.sql — THE SEASON-2 BOARD (PROGRESSION v3, Andy oct5 phase 3; claude/mockups/v2/progression-v3.md).
--
-- A SEASON-2 ROW is a profile whose last accepted board write came from a season-2 client: econ = 13. The season-2
-- client (SEASON2 flag) submits p_econ = 13 and reads public.leaderboard_s2; a season-1 client (econ 12) is
-- unchanged. Everything here applies to econ-13 rows only:
--   * public.leaderboard_s2 — the season-2 board, ORDER ★ desc, rebirths desc, level desc (then lifetime words,
--     first-come). Same columns + grants as public.leaderboard (021). public.leaderboard is NOT touched.
--   * private.lb_board_write_s2 — the season-2 write rule (v3 levels reach millions):
--       - the FIRST season-2 write of a NEW name is a baseline: rebirths ≤ lifetime words / 100, level ≤ 4 × the gate of
--         those rebirths; no weekly words;
--       - the FIRST season-2 write of a SEASON-1 ROW (Andy oct6, no reset — 025_season2_convert.sql converted its
--         rebirths / stars) KEEPS its progress: rebirths = the stored (converted) count at most — never raised — and the
--         level up to the stored level or 4 × the gate, whichever is higher; no weekly words. (Edited before it ever
--         ran: it was "rebirths ≤ words / 100" for both, which would have clamped a kept R10 with 422 words to R4.)
--       - a submit NEVER raises rebirths (they rise only through lb_rebirth, season 2) and never writes stars (only
--         lb_ascend does);
--       - the level is free up to 4 × ⌈100 × 2.5^R⌉ (8× the gate's XP on the 40·√L curve — two rebirths of
--         headroom), or the stored level + 500 a second since the last accepted write (banking 20 min), whichever is
--         higher — clamped, never rejected; ≤ 2,147,483,647 (the int column);
--       - words / letters rate-checked as 011/013/015 (too fast → rejected); a lower number is a RESET (017).
--   * public.lb_submit3 — p_econ = 13 → lb_board_write_s2; p_econ = 12 → 021's lb_board_write_rr, EXCEPT on a row
--     that is already season 2 (econ 13): a season-1 client can no longer write it ('old_client').
--   * public.lb_rebirth / public.lb_ascend — 021's bodies, plus: a SEASON-2 request needs a SEASON-2 row (econ 13),
--     so a season-1 row can never mint ★ or rebirths on the season-2 board by naming season 2 ('season').
--   * lb_caps adds season2: true and econ2: 13 (the season-2 client submits only when it sees them).
--
-- KEEP IN SYNC WITH src/leaderboard/submitRules.js (decideSubmitS2) and src/leaderboard/rebirthRules.js
-- (decideRebirth / decideAscend, the econ-13 guard) — the same checks, order and constants; submitRules.test.js pins
-- this file against them.
-- NEEDS 021 (the first statement stops with a clear error if 021 is not in). ORDER (Andy): 1. run this whole file in
-- the SQL Editor; 2. `notify pgrst, 'reload schema';`. The live (season-1) game is unaffected: its client sends
-- econ 12 and reads public.leaderboard. WRITE-ONLY: Claude never runs migrations. Safe to re-run.

do $$
begin
  if to_regprocedure('public.lb_rebirth(text,uuid,smallint)') is null then
    raise exception '022 needs 021_server_rebirth.sql — run 021 first, then this file';
  end if;
end $$;

-- ---- the season-2 board write ----------------------------------------------------------------------------------
-- Not callable by anon/authenticated (private schema, execute revoked); lb_submit3 (SECURITY DEFINER) runs it.
create or replace function private.lb_board_write_s2(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv bigint; rb bigint; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean; lv_cap bigint;
        S2_ECON constant smallint := 13;
        S2_LV_GATE_MULT constant integer := 4;       -- level room = 4 × the gate (8× its XP on 40·√L)
        S2_LEVELS_PER_SEC constant integer := 500;   -- or + 500 levels a second since the last accepted write …
        S2_LEVEL_BANK_SECS constant integer := 1200; -- … banking 20 min
        S2_WORDS_PER_RB constant integer := 100;     -- a first season-2 write: rebirths ≤ lifetime words / 100
        S2_LV_MAX constant bigint := 2147483647;     -- the int column
        S2_GATE_EXP_CAP constant integer := 30;      -- power(2.5, R) read at R ≤ 30
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
  delta := 0;
  if old.submitted_at is null then
    -- FIRST season-2 write of a NEW name: a baseline, bounded by its own play
    rb := least(rb, floor(w / S2_WORDS_PER_RB)::bigint);
    lv := least(lv, least(S2_LV_MAX, S2_LV_GATE_MULT * ceil(100 * power(2.5::numeric, least(rb, S2_GATE_EXP_CAP)::numeric))::bigint));
  elsif old.econ is distinct from S2_ECON then
    -- FIRST season-2 write of a SEASON-1 ROW (converted by 025): its kept progress — the stored rebirths (never raised)
    -- and the level up to the stored one or 4 × the gate
    rb := least(rb, greatest(coalesce(old.rebirths, 0), 0)::bigint);
    lv := least(lv, greatest(coalesce(old.level, 1)::bigint, least(S2_LV_MAX, S2_LV_GATE_MULT * ceil(100 * power(2.5::numeric, least(rb, S2_GATE_EXP_CAP)::numeric))::bigint)));
  else
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    max_rise := floor(least(secs, S2_LEVEL_BANK_SECS) * S2_LEVELS_PER_SEC)::bigint;
    is_reset := rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
                or (lv < old.level and rb = old.rebirths);
    if not is_reset then
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
    base_lv := case when is_reset then 1 else old.level end;
    lv_cap := least(S2_LV_MAX, greatest(S2_LV_GATE_MULT * ceil(100 * power(2.5::numeric, least(rb, S2_GATE_EXP_CAP)::numeric))::bigint,
                                        base_lv + max_rise));
    if is_reset then
      lv := least(lv, greatest(old.level::bigint, lv_cap));
      w := least(w, old.lifetime_words + floor(20 * secs)::bigint);
      l := least(l, old.lifetime_letters + floor(150 * secs)::bigint);
    else
      lv := least(lv, lv_cap);
      delta := greatest(0, w - coalesce(old.lifetime_words, 0));
    end if;
  end if;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = lv::integer, rebirths = rb::integer, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = S2_ECON,
         submitted_at = now(), updated_at = now()
   where id = pid; -- stars are never written here (lb_ascend only)
end $$;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;

-- ---- lb_submit3: econ 13 → the season-2 write; econ 12 → 021's write (never on a season-2 row) ------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare cur smallint;
begin
  if p_econ = 13 then
    perform private.lb_board_write_s2(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters, p_wins_per_word);
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

-- ---- lb_rebirth: 021's body + a season-2 request needs an econ-13 row ---------------------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON (+ econ-13 row for season 2) → GATE → PACE → GRANT.
create or replace function public.lb_rebirth(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; gate numeric; recent integer;
        granted integer; oldest timestamptz;
        RATE_PER_SEC constant integer := 2;       -- logged calls per profile per rolling second
        RB_WINDOW_SECS constant integer := 3600;  -- the pace window (020: 1 token / 5 min, 12 banked)
        RB_PER_WINDOW constant integer := 12;     -- granted rebirths allowed inside one window
        LOG_KEEP_DAYS constant integer := 30;     -- request-log rows older than this are pruned
        S2_ECON constant smallint := 13;          -- 022: a season-2 request needs a season-2 row
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
               when p_season = 2 and old.econ = S2_ECON then ceil(100 * power(2.5::numeric, old.rebirths::numeric))
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

-- ---- lb_ascend: 021's body + an econ-13 row ----------------------------------------------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON (2, econ-13 row) → GATE (≥ ASCEND_AT) → GRANT.
create or replace function public.lb_ascend(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; recent integer; st integer;
        RATE_PER_SEC constant integer := 2;
        ASCEND_AT constant integer := 10;         -- stars += rebirths − (ASCEND_AT − 1)
        LOG_KEEP_DAYS constant integer := 30;
        S2_ECON constant smallint := 13;          -- 022: only a season-2 row ascends
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
  if p_season is distinct from 2 or old.econ is distinct from S2_ECON then
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

-- ---- the season-2 board: ★ → R → level ----------------------------------------------------------------------------
-- Same columns + grants as public.leaderboard (021); season-2 rows only.
drop view if exists public.leaderboard_s2;
create view public.leaderboard_s2 with (security_invoker = true) as
  select row_number() over (order by stars desc, rebirths desc, level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word, econ, stars
    from public.profiles
   where econ = 13;
grant select on public.leaderboard_s2 to anon, authenticated;

-- ---- feature detection: 021's caps + season2 ----------------------------------------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 12,
                           'rebirth_rpc', true, 'season2', true, 'econ2', 13)
$$;
grant execute on function public.lb_caps() to anon, authenticated;
