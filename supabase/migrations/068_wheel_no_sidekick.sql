-- 068_wheel_no_sidekick.sql - THE DAILY WHEEL drops LUCKY (Andy oct26: the SIDEKICK cosmetic slot was removed from the
-- game, so the wheel can no longer hand one out).
--
--   * lb_wheel_spin is recreated with ONE change from 067: the cosmetic pool is now ['jackpot', 'confetti'] (was
--     ['lucky', 'jackpot', 'confetti']). With both already won the slot still pays an EPIC+ ROLL ticket instead (no dead
--     dupes) - unchanged. Nothing else in 067 changes (odds, streak, tickets, claim, reset).
--   * Old spins that paid 'lucky' stay in private.wheel_spins as the log; they no longer count toward the pool (the
--     pool only checks jackpot / confetti), so nobody is pushed to the EPIC+ fallback early.
--   * A browser that still sees 'lucky' (a server before this file) pays it as 120 GEMS (src/progress/wheel.js
--     RETIRED_COSMETICS).
--
-- ORDER: after 067. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run
-- (create or replace + the same grants). ASCII only.

-- ---- lb_wheel_spin: roll today's spin (or hand back the one already rolled) -------------------------------------------
create or replace function public.lb_wheel_spin(p_secret text, p_day integer, p_kind text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; utc_day integer; tr private.wheel_track; s private.wheel_spins; adon boolean;
        v_slot integer; v_prize text; v_amount integer := 0; v_tier text := null; v_tk uuid := null; v_cos text := null;
        v_streak integer := 0; v_bonus text := null; gap integer; gm numeric := 1; sid uuid := gen_random_uuid();
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  if p_kind is null or p_kind not in ('free', 'ad') then return json_build_object('ok', false, 'reason', 'kind'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  utc_day := floor(extract(epoch from now()) / 86400)::integer;
  if p_day is null or p_day < utc_day - 1 or p_day > utc_day + 1 then
    return json_build_object('ok', false, 'reason', 'day');
  end if;
  perform 1 from public.profiles where id = pid for update; -- one spin at a time per player

  -- the SAME spin again: a reload / second device never re-rolls
  select * into s from private.wheel_spins where profile_id = pid and day = p_day and kind = p_kind;
  if found then return private.wheel_json(s, true); end if;

  insert into private.wheel_track (profile_id) values (pid) on conflict (profile_id) do nothing;
  select * into tr from private.wheel_track where profile_id = pid for update;

  if p_kind = 'free' then
    if p_day <= tr.last_day then return json_build_object('ok', false, 'reason', 'spun'); end if; -- a replayed / older day
    gap := case when tr.last_day = 0 then 99 else p_day - tr.last_day end;
    v_streak := case when gap <= 2 then tr.streak + 1 else 1 end; -- ONE missed day is forgiven
    if v_streak % 7 = 0 then v_bonus := 'super'; gm := 2;
    elsif v_streak >= 3 then v_bonus := 'hot'; gm := 1.5; end if;
  else
    select ad_on into adon from private.wheel_config where id = 1;
    if not coalesce(adon, false) then return json_build_object('ok', false, 'reason', 'ads_off'); end if;
    -- the ad spin is today's SECOND spin: the free one first
    perform 1 from private.wheel_spins where profile_id = pid and day = p_day and kind = 'free';
    if not found then return json_build_object('ok', false, 'reason', 'free_first'); end if;
    v_streak := tr.streak; -- shown, never a bonus
  end if;

  v_slot := private.wheel_pick();
  if v_slot in (0, 2, 6) then
    v_prize := 'gems';
    v_amount := round((case v_slot when 0 then 25 when 2 then 60 else 120 end) * gm)::integer;
  elsif v_slot in (1, 4) then
    v_prize := case when v_slot = 1 then 'xp' else 'wins' end;
    v_amount := case when v_bonus = 'super' then 20 else 10 end;
  elsif v_slot in (3, 5) then
    v_prize := 'ticket';
    v_tier := case when v_slot = 3 then (case when v_bonus = 'super' then 'epic' else 'rare' end)
                   else (case when v_bonus = 'super' then 'mythic' else 'legendary' end) end;
  else
    v_prize := 'cosmetic';
    select c into v_cos from unnest(array['jackpot', 'confetti']) as c
     where not exists (select 1 from private.wheel_spins w where w.profile_id = pid and w.cosmetic = c)
     order by random() limit 1;
    if v_cos is null then v_prize := 'ticket'; v_tier := 'epic'; end if; -- both won: an EPIC+ ROLL instead
  end if;

  if v_tier is not null then
    v_tk := private.grant_ticket(pid, v_tier, 'wheel', 'wheel:' || sid, 'wheel day ' || p_day || ' ' || p_kind);
  end if;

  insert into private.wheel_spins (id, profile_id, day, kind, slot, prize, amount, ticket_id, ticket_tier, cosmetic, streak, bonus)
  values (sid, pid, p_day, p_kind, v_slot, v_prize, v_amount, v_tk, v_tier, v_cos, v_streak, v_bonus)
  returning * into s;

  if p_kind = 'free' then
    update private.wheel_track set last_day = p_day, streak = v_streak, spins = spins + 1 where profile_id = pid;
  else
    update private.wheel_track set spins = spins + 1 where profile_id = pid;
  end if;
  return private.wheel_json(s, false);
end $$;
revoke all on function public.lb_wheel_spin(text, integer, text) from public;
grant execute on function public.lb_wheel_spin(text, integer, text) to anon, authenticated;
