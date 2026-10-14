-- 042_reconcile_anticheat.sql — two Oct 13 migrations crossed (Andy: "widestwhale gears still arent showing").
--   * 037_softer_anticheat (merged in #363): rebirth needs 10 GAME words (was 25); the gear audit FLAGS, never hides.
--   * 039_hard_limits (this branch, run after it): re-created lb_rebirth from 035 with 25 words + the 40 / 24 h limit —
--     silently putting 25 back. And the earlier 037_gear_grandfather_fix had re-created gear_check to HIDE.
-- This applies BOTH intents on top of whatever ran last:
--   1. lb_rebirth = 039's body (12 / h + 40 / 24 h, testers skip) with WORDS_PER_RB 10 (037). Mirrors
--      src/leaderboard/rebirthRules.js WORDS_PER_RB / RB_PER_DAY and src/progress/rebirthWords.js.
--   2. gear_check = 037_softer's: an unknown showcased gear is flagged ONCE and still SHOWN; nothing reverted.
--   3. Cards the old audit blanked come back on their own: the client now re-sends every showcase once (showcase.js
--      SENT_KEY bumped), and lb_showcase_set runs this gear_check — WidestWhale included, the next time they open the game.
-- RULE (Andy oct13): never hide or revert a gear — remove the player instead. ADDITIVE, re-runnable.
-- HOW: Supabase → SQL editor → paste the WHOLE file (nothing selected) → Run.

-- ---- 1. lb_rebirth: 039's body, WORDS_PER_RB 10 ------------------------------------------------------------------------
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
        WORDS_PER_RB constant integer := 10;      -- 035: game words since the last rebirth
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

-- ---- 2. gear_check: flag, never hide (037_softer) ------------------------------------------------------------------------
create or replace function private.gear_check(p_pid uuid, p_mark text)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare tester boolean;
begin
  if p_mark is null then return null; end if;
  if not exists (select 1 from private.gear_pool where mark_id = p_mark) then return p_mark; end if; -- PERMANENT / legacy
  select coalesce(is_tester, false) into tester from public.profiles where id = p_pid;
  if tester then return p_mark; end if; -- the TESTER code skips every check
  if exists (select 1 from private.gear_owned where profile_id = p_pid and mark_id = p_mark) then return p_mark; end if;
  if exists (select 1 from private.gear_refused where profile_id = p_pid and mark_id = p_mark) then return p_mark; end if; -- flagged already
  -- unknown to the server: flag it ONCE for Andy, never hide it, never revert it
  insert into private.gear_refused (profile_id, mark_id, revert) values (p_pid, p_mark, false) on conflict do nothing;
  begin
    insert into private.cheat_flags (profile_id, reason, detail)
    values (p_pid, 'gear', jsonb_build_object('mark', p_mark, 'budget', private.gem_budget(p_pid),
                                              'chance', private.gear_chance(p_pid, p_mark)));
  exception when others then null; end;
  return p_mark;
end $$;
revoke all on function private.gear_check(uuid, text) from public;
revoke all on function private.gear_check(uuid, text) from anon, authenticated;

-- nothing is reverted any more (lb_gears' 'revert' list comes back empty)
update private.gear_refused set revert = false where revert;

-- ---- 3. nothing is reverted ---------------------------------------------------------------------------------------------
update private.gear_refused set revert = false where revert;

notify pgrst, 'reload schema';
