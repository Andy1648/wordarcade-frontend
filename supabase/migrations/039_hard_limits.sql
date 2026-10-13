-- 039_hard_limits.sql — Andy oct13 ("do more than flagging … outright making something not work"). A console can fake
-- the level and the game-word count the browser reports; the server's caps were loose enough that a faked account could
-- rebirth 12 times an hour, 24/7, without playing. Two HARD limits (testers — 032 is_tester — skip both):
--   1. private.lb_board_write_s2 (029's body): game words may rise at most 4 a SECOND since the last accepted write
--      (was 20). A write over it is rejected whole, as before. 4/s = 240 wpm sustained — above any real game.
--   2. public.lb_rebirth (035's body): at most 40 granted rebirths in any rolling 24 hours (on top of 12 an hour).
--      Refusal = the same 'wait' + retry_in the client already shows.
-- MIRRORED in src/leaderboard/finalRules.js (WORDS_PER_SEC) + rebirthRules.js (RB_PER_DAY); hardLimits.test.js pins them.
-- ORDER: after 035 (and 029). Then notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- 1. the season-2 board write: words ≤ 4 / s -------------------------------------------------------------------
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
        -- 039: game words arrive at most 4 a second (240 wpm — no human types faster in a game; was 20)
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
      if w - old.lifetime_words > 4 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
    base_lv := case when is_reset then 1 else old.level end;
    lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, base_lv + max_rise));
    if is_reset then
      lv := least(lv, greatest(old.level::bigint, lv_cap));
      w := least(w, old.lifetime_words + floor(4 * secs)::bigint);
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

-- ---- 2. lb_rebirth: ≤ 40 a day --------------------------------------------------------------------------------------
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
        RB_PER_DAY constant integer := 40;        -- 039: granted rebirths allowed in any rolling 24 h
        day_n integer; day_oldest timestamptz;
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
    select count(*), min(created_at) into day_n, day_oldest from public.rebirth_requests
     where profile_id = pid and action = 'rebirth' and (result->>'ok')::boolean and created_at > now() - interval '24 hours';
    if day_n >= RB_PER_DAY and not coalesce(old.is_tester, false) then -- 039: ≤ 40 a day (testers skip)
      res := jsonb_build_object('ok', false, 'reason', 'wait', 'rebirths', old.rebirths,
               'retry_in', greatest(1, ceil(extract(epoch from (day_oldest + interval '24 hours' - now())))::integer));
    elsif granted >= RB_PER_WINDOW and not coalesce(old.is_tester, false) then -- 033: testers skip PACE
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

notify pgrst, 'reload schema';
