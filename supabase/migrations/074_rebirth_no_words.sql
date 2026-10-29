-- 074_rebirth_no_words.sql: a rebirth no longer needs 10 game words since the last one (Andy oct28: "remove the
-- requirement that you need to type 10 words to rebirth … people deserve to rebirth if they can rebirth").
-- lb_rebirth = 042's body with WORDS_PER_RB 0: the level gate, the 12/h + 40/24h pace and the tester skips stay.
-- rb_words0 is still written (harmless; kept so a future barrier can reuse it). Mirrors src/leaderboard/rebirthRules.js
-- WORDS_PER_RB and src/progress/rebirthWords.js WORDS_PER_REBIRTH (both 0).
-- RE-RUNNABLE (create or replace). WRITE-ONLY: Claude never runs migrations.
-- HOW: Supabase → SQL editor → paste the WHOLE file (nothing selected) → Run.

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
        WORDS_PER_RB constant integer := 0;       -- 074: no words gate (was 10, 037)
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
