-- restore-betterthanandy.sql: ONE-OFF hand fix for the player BETTERTHANANDY (oct19 report: "when i rebirthed again
-- on chromebook, it reset my rebirths to 1 (now its 2). i had like 26").
--
-- WHAT HAPPENED: the account's board row (public.profiles.rebirths) had been knocked to about R0 by the pre-054
-- "lower push = reset" bug (a second device's LV 1 push). A submit can never raise rebirths again, so the row stayed low
-- while the real save was R26. A server rebirth then pinned the device's local count to the row's answer (row + 1 = 1).
-- The client fix (PR fix/rebirth-second-device) stops a grant from ever lowering local rebirths. This file heals the ROW
-- and makes sure the CLOUD SAVE holds the high count, so the Chromebook restores it by itself on its next session.
--
-- NOT A MIGRATION. Run it in the Supabase SQL editor, ONE STEP AT A TIME (the editor shows only the last result).
-- Claude never runs it. Safe to re-run: every write only RAISES a number and does nothing if it's already high enough.
--
-- OCT 20 UPDATE: it happened AGAIN ("he rebirthed at rebirth 22 and it brought him back down"), because #440 was not
-- merged yet and this file had not been run. So the target now has a HARD MINIMUM of R23 (the R22 he had + the rebirth he
-- just did), and MANUAL_FLOOR defaults to his original 26. The log peak and the cloud save win if either is higher.
-- Andy's call: the player earned about 20 rebirths on the knocked-down save between oct19 and oct20 (R2 → R22). If you
-- want to credit those ON TOP of the 26, set MANUAL_FLOOR to 26 + (22 − 2) + 1 = 47. STEP 1c lists every grant, so you
-- can count them.
--
-- ORDER: merge #440 FIRST (or at the same time). Healing the row before it is live is fine, but a device still on the
-- old bundle would drop back to the row's answer on its next rebirth again. That is exactly what happened on oct20.

-- =====================================================================================================================
-- STEP 1 (read only): the row, the cloud save, and the rebirth log. Check these before STEP 2.
-- =====================================================================================================================

-- 1a. the board row (expect a low count: the stale row + the grants since; the player had R22 locally on oct20, 26 on oct19)
select id, username, level, rebirths, stars, lifetime_words, wins_per_word, econ, submitted_at, updated_at
  from public.profiles
 where upper(username) = 'BETTERTHANANDY';

-- 1b. the cloud save: what it holds (taw.rebirths in a season-2 blob IS the season-2 count; the client maps the key)
select c.saved_at, c.score,
       (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.rebirths')    as blob_rebirths,
       (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.s2.rebirths') as blob_s2_rebirths,
       (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.econ')        as blob_econ,
       (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.s2.stars')    as blob_stars
  from private.cloud_saves c
  join public.profiles p on p.id = c.profile_id
 where upper(p.username) = 'BETTERTHANANDY';

-- 1c. every server rebirth this season (30-day log): the counts the row climbed through, and where it fell
select r.created_at, r.action, r.result ->> 'ok' as ok, r.result ->> 'rebirths' as rebirths, r.result ->> 'reason' as reason
  from public.rebirth_requests r
  join public.profiles p on p.id = r.profile_id
 where upper(p.username) = 'BETTERTHANANDY'
   and r.created_at >= (select ran_at from public.season2_reset where id = 1)
 order by r.created_at;

-- 1d. the best count we can PROVE: the row, the log's peak grant, the cloud blob. STEP 2 uses the greatest of these,
--     or the manual floor you set there (the player says 26).
select p.rebirths as row_rebirths,
       (select max((r.result ->> 'rebirths')::int) from public.rebirth_requests r
         where r.profile_id = p.id and r.action = 'rebirth' and (r.result ->> 'ok')::boolean
           and r.created_at >= (select ran_at from public.season2_reset where id = 1)) as log_peak,
       (select (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.rebirths')::int
          from private.cloud_saves c where c.profile_id = p.id) as cloud_rebirths
  from public.profiles p
 where upper(p.username) = 'BETTERTHANANDY';

-- =====================================================================================================================
-- STEP 2 (the fix). Set MANUAL_FLOOR below: 0 = trust only what STEP 1 proved, 26 = take the player's word.
-- Lifts the row's rebirths to the target, and if the cloud save holds less, raises the cloud save's rebirth count to
-- the target (the rest of that save is kept as it is) so the Chromebook restores it on its next session.
-- =====================================================================================================================
do $$
declare
  MANUAL_FLOOR constant integer := 26;   -- <-- his original R26 (47 = also credit the ~20 earned oct19→20; see header)
  HARD_MIN constant integer := 23;       -- oct20: the R22 he had + the rebirth that dropped him. Never go below this.
  pid uuid; n integer; row_rb integer; log_peak integer; cloud_rb integer; target integer;
  c private.cloud_saves; j jsonb; new_blob text;
begin
  select count(*) into n from public.profiles where upper(username) = 'BETTERTHANANDY';
  if n <> 1 then raise exception 'expected exactly one BETTERTHANANDY row, found %', n; end if;
  select id, rebirths into pid, row_rb from public.profiles where upper(username) = 'BETTERTHANANDY' for update;

  select max((result ->> 'rebirths')::int) into log_peak from public.rebirth_requests
   where profile_id = pid and action = 'rebirth' and (result ->> 'ok')::boolean
     and created_at >= (select ran_at from public.season2_reset where id = 1);
  select * into c from private.cloud_saves where profile_id = pid for update;
  if found then
    j := convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb;
    cloud_rb := coalesce((j -> 'keys' ->> 'taw.rebirths')::int, 0);
  end if;

  target := greatest(coalesce(row_rb, 0), coalesce(log_peak, 0), coalesce(cloud_rb, 0), MANUAL_FLOOR, HARD_MIN);
  raise notice 'row % / log peak % / cloud % / floor % / min % -> target %', row_rb, log_peak, cloud_rb, MANUAL_FLOOR, HARD_MIN, target;

  -- the board row: rebirths up to the target (level / words untouched; the next push sends the device's real level)
  update public.profiles set rebirths = target, updated_at = now() where id = pid and rebirths < target;
  get diagnostics n = row_count;
  raise notice 'board row raised: %', n = 1;

  -- the cloud save: only when it holds LESS than the target. Score = ★·10^36 + R·10^24 + LV·10^12 + letters
  -- (cloudSave.js progressScoreFromKeys), so raising R by k raises the score by k·10^24, and the restore then wins
  -- against any device below it.
  if c.profile_id is not null and cloud_rb < target then
    j := jsonb_set(j, '{keys,taw.rebirths}', to_jsonb(target::text));
    if j -> 'keys' ? 'taw.s2.rebirths' then
      j := jsonb_set(j, '{keys,taw.s2.rebirths}', to_jsonb(target::text));
    end if;
    new_blob := replace(encode(convert_to(j::text, 'UTF8'), 'base64'), E'\n', '');
    update private.cloud_saves
       set blob = new_blob, score = c.score + (target - cloud_rb)::numeric * power(10::numeric, 24), saved_at = now()
     where profile_id = pid;
    raise notice 'cloud save raised from R% to R%', cloud_rb, target;
  elsif c.profile_id is null then
    raise notice 'NO cloud save on file: the device that holds R% must open the menu once (it backs up within a minute), then the Chromebook restores it', target;
  else
    raise notice 'cloud save already at R% (>= target): nothing to do there', cloud_rb;
  end if;
end $$;

-- =====================================================================================================================
-- STEP 3 (read only): verify. Row rebirths = target; the cloud blob's taw.rebirths = target.
-- Then tell the player: close every TYPE A WORD tab on the Chromebook and open it again (a NEW session). The menu
-- restores the cloud save when it is ahead of that browser.
-- =====================================================================================================================
select p.username, p.rebirths as row_rebirths, p.level,
       (convert_from(decode(c.blob, 'base64'), 'UTF8')::jsonb -> 'keys' ->> 'taw.rebirths') as cloud_rebirths,
       c.score, c.saved_at
  from public.profiles p
  left join private.cloud_saves c on c.profile_id = p.id
 where upper(p.username) = 'BETTERTHANANDY';

-- =====================================================================================================================
-- OPTIONAL (read only): other season-2 rows whose rebirths sit BELOW their own logged peak, i.e. accounts likely hit by
-- the same pre-054 reset. Each is a candidate for the same fix (swap the username above). A player who used
-- RESET ALL PROGRESS on purpose also shows here, so check before healing.
-- =====================================================================================================================
select p.username, p.rebirths as row_rebirths, m.peak as log_peak, p.submitted_at
  from public.profiles p
  join (select r.profile_id, max((r.result ->> 'rebirths')::int) as peak
          from public.rebirth_requests r
         where r.action = 'rebirth' and (r.result ->> 'ok')::boolean
           and r.created_at >= (select ran_at from public.season2_reset where id = 1)
         group by r.profile_id) m on m.profile_id = p.id
 where p.econ = 13 and p.rebirths < m.peak - 1
 order by m.peak - p.rebirths desc;
