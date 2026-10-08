-- 029_progression_final_v3.sql — PROGRESSION FINAL v3 "START AT 1" on the server (claude/progression-FINAL.md v3, Andy
-- Oct 7 21:27) + v4 "SIMPLE" (Andy Oct 7 23:20 — XP from menu keys only). On the server that is the REBIRTH GATE: v3 had
-- moved 027's LV 15 + 18 × R to 18 + 20 × R; v4 puts it back at LV 15 + 18 × R (the client's v3/econ.js
-- REBIRTH_GATE_BASE / _STEP, CI-sim tuned for an 18–25 min first rebirth). The SQL is unchanged apart from those numbers. Everything else is 027's:
--   * public.lb_rebirth (season 2): needs LEVEL ≥ 15 + 18 × R on the STORED row → rebirths + 1, level = 1. ONE rebirth per
--     call; idempotent request id; ≤ 2 logged calls a second; ≤ 12 granted rebirths in any rolling hour. A season-2
--     request needs an econ-13 row. A refusal reports the LEVEL needed ('gate'). Season 0 is 021's (25 × (R+1) → 1).
--   * public.lb_ascend: still HIDDEN — a season-2 call on a season-2 row is refused ('off').
--   * private.lb_board_write_s2: the level allowance follows the gate — 15 + 18 × R + 100 (the first write and the room);
--     every other cap as 027.
--   * lb_caps is NOT touched.
--
-- ===== ORDER (claude/FLIP-STEPS.md) ===================================================================================
--   022_season2_board.sql → 024_season2_weekly.sql → 027_progression_final_v2.sql → THIS FILE (029) →
--   claude/run-season2.sql (= 023, the reset) → 028_season2_board_keep_place.sql → `notify pgrst, 'reload schema';`.
--   029 re-declares all three of 027's functions, so it is self-contained after 022 (running 027 first is harmless);
--   if 022 or 027 is ever re-run, re-run 029 after it.
--
-- KEEP IN SYNC WITH src/leaderboard/rebirthRules.js (decideRebirth / decideAscend, season 2) and
-- src/leaderboard/finalRules.js (decideSubmitFinal) — the same checks, order and constants; finalRules.test.js pins
-- this file against them. WRITE-ONLY: Claude never runs migrations. Safe to re-run (create or replace).

do $$
begin
  if to_regprocedure('private.lb_board_write_s2(text,integer,integer,bigint,bigint,numeric)') is null then
    raise exception '029 needs 022_season2_board.sql — run 022 (then 024) first, then this file';
  end if;
end $$;

-- ---- the season-2 board write (FINAL v3 caps) ------------------------------------------------------------------
-- Not callable by anon/authenticated (private schema, execute revoked); lb_submit3 (SECURITY DEFINER) runs it.
create or replace function private.lb_board_write_s2(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv bigint; rb bigint; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean; lv_cap bigint;
        F_ECON constant smallint := 13;
        F_GATE_BASE constant integer := 15;        -- the rebirth gate: LV 15 + 18 × R
        F_GATE_STEP constant integer := 18;
        F_LV_HEADROOM constant integer := 100;     -- levels allowed past the next gate
        F_LEVELS_PER_SEC constant integer := 1;    -- or + 1 level a second since the last accepted write …
        F_LEVEL_BANK_SECS constant integer := 1200; -- … banking 20 min
        F_WORDS_PER_RB constant integer := 100;    -- a first season-2 write: rebirths ≤ lifetime words / 100
        F_LV_MAX constant bigint := 2147483647;    -- the int column
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
  if old.submitted_at is null or old.econ is distinct from F_ECON then
    -- FIRST season-2 write: a baseline, bounded by its own play
    rb := least(rb, floor(w / F_WORDS_PER_RB)::bigint);
    lv := least(lv, least(F_LV_MAX, F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM));
  else
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    max_rise := floor(least(secs, F_LEVEL_BANK_SECS) * F_LEVELS_PER_SEC)::bigint;
    is_reset := rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
                or (lv < old.level and rb = old.rebirths);
    if not is_reset then
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
    base_lv := case when is_reset then 1 else old.level end;
    lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, base_lv + max_rise));
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
         econ = F_ECON,
         submitted_at = now(), updated_at = now()
   where id = pid; -- stars are never written here (lb_ascend only)
end $$;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;

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
    -- PACE: ≤ RB_PER_WINDOW granted rebirths in any rolling RB_WINDOW_SECS
    select count(*), min(created_at) into granted, oldest from public.rebirth_requests
     where profile_id = pid and action = 'rebirth' and (result->>'ok')::boolean
       and created_at > now() - make_interval(secs => RB_WINDOW_SECS);
    if granted >= RB_PER_WINDOW then
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

-- ---- lb_ascend (season 2): HIDDEN in FINAL v3 — every season-2 call is refused ('off') ------------------------------
-- CHECK ORDER: bad id → profile + row lock → REPLAY → RATE → SEASON (2, econ-13 row) → OFF.
create or replace function public.lb_ascend(p_secret text, p_request_id uuid, p_season smallint default 0)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; prev public.rebirth_requests; res jsonb; recent integer;
        RATE_PER_SEC constant integer := 2;
        LOG_KEEP_DAYS constant integer := 30;
        S2_ECON constant smallint := 13;          -- only a season-2 row could ascend
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
  else
    res := jsonb_build_object('ok', false, 'reason', 'off'); -- FINAL v3: no ascension for now
  end if;
  insert into public.rebirth_requests (profile_id, request_id, action, result) values (pid, p_request_id, 'ascend', res);
  delete from public.rebirth_requests where profile_id = pid and created_at < now() - make_interval(days => LOG_KEEP_DAYS);
  return res::json;
end $$;
revoke all on function public.lb_ascend(text, uuid, smallint) from public;
grant execute on function public.lb_ascend(text, uuid, smallint) to anon, authenticated;
