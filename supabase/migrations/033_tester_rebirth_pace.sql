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
