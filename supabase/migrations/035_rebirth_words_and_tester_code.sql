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
