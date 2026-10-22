-- 060_streak_legendary_roll.sql — DRAFT, NOT APPLIED (Tier 1: the server roll path). The STREAK CALENDAR's DAY 7
-- (Andy oct21: "at the end of 7 days, you could get a legendary roll"): ONE guaranteed LEGENDARY-or-better gear roll.
--
-- HOW: a NEW door beside lb_roll — lb_roll / lb_roll_claim are NOT changed. lb_roll_streak reserves one pick at the
-- next seq exactly like lb_roll does, but asks private.pick_gear with the LEGENDARY pity already full (since_leg =
-- 49 → f = 'legendary': only LEGENDARY / MYTHIC / SECRET can come out, weighted by luck as the pity roll is). The
-- browser then claims it with the existing lb_roll_claim (gear_owned + the pity counters, as every roll).
--   * once per 6 days 12 hours per account (private.streak_rolls) — a week's track can't be farmed by clock games;
--   * free: no gem price is checked (lb_roll_claim still adds its 75 to s2_roll_spent — the budget is far above it);
--   * logged in private.roll_log with forced = 'streak' so the 036 audit / cheat review can tell it apart;
--   * the server cannot see the browser's streak (it lives in the browser), so the weekly cap IS the guard.
-- Client (feat/streak-calendar): calendar.js DAY 7 calls lb_roll_streak, then the normal ROLL reveal + lb_roll_claim.
-- Until this runs the preview pays DAY 7 as 300 gems.

create table if not exists private.streak_rolls (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_at timestamptz not null default now(),
  total integer not null default 0
);
revoke all on private.streak_rolls from public, anon, authenticated;

create or replace function public.lb_roll_streak(p_secret text, p_luck double precision)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; L double precision; pk record; sh boolean; last timestamptz;
        LUCK_CAP constant double precision := 15;   -- as lb_roll
        SHINY constant double precision := 0.015;   -- as lb_roll
        LEG_PITY constant integer := 50;            -- private.pick_gear's LEG_PITY
        GAP constant interval := interval '6 days 12 hours';
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  v_seq := p.s2_roll_seq + 1;
  -- an open reservation at this seq (a streak roll OR a normal one) is returned as-is: no re-roll for a better pick
  if exists (select 1 from private.roll_log where profile_id = pid and roll_log.seq = v_seq and state = 'reserved') then
    return json_build_object('ok', true, 'seq', v_seq, 'again', true, 'picks',
      (select coalesce(jsonb_agg(jsonb_build_object('mark', l.mark_id, 'tier', l.tier, 'shiny', l.shiny) order by l.idx), '[]'::jsonb)
         from private.roll_log l where l.profile_id = pid and l.seq = v_seq and l.state = 'reserved'));
  end if;
  select s.last_at into last from private.streak_rolls s where s.profile_id = pid;
  if last is not null and last > now() - GAP and not coalesce(p.is_tester, false) then
    return json_build_object('ok', false, 'reason', 'week', 'next', last + GAP);
  end if;
  L := least(LUCK_CAP, greatest(1, coalesce(p_luck, 1)));
  select * into pk from private.pick_gear(L, 0, LEG_PITY - 1); -- the LEGENDARY pity, full: LEGENDARY+ only
  sh := random() < SHINY;
  insert into private.roll_log (profile_id, seq, idx, mark_id, tier, shiny, luck, forced, bonus)
  values (pid, v_seq, 0, pk.mark_id, pk.tier, sh, L, 'streak', false);
  insert into private.streak_rolls as s (profile_id, last_at, total) values (pid, now(), 1)
  on conflict (profile_id) do update set last_at = now(), total = s.total + 1;
  return json_build_object('ok', true, 'seq', v_seq, 'picks', jsonb_build_array(jsonb_build_object('mark', pk.mark_id, 'tier', pk.tier, 'shiny', sh)));
end $$;
revoke all on function public.lb_roll_streak(text, double precision) from public;
grant execute on function public.lb_roll_streak(text, double precision) to anon, authenticated;
