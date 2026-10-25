-- 067_daily_wheel.sql - THE DAILY WHEEL (Andy oct24: "maybe next addictive direction is gacha? we can maybe add a daily
-- wheel spin (with like gems, boost, or guaranteed rolls, or cosmetics)").
--
-- ONE free spin per local day (+ ONE extra spin a day for watching a rewarded ad, OFF until private.wheel_config.ad_on is
-- flipped - AdSense H5 is not approved yet). The SERVER rolls every spin; the browser only animates to the answer.
--
--   * lb_wheel_spin(secret, day, kind) -> today's spin for `kind` ('free' | 'ad'). The FIRST call rolls it and stores it
--     (one row per player / day / kind - unique), every later call returns the SAME row ('again'), so a reload, a
--     second tab or a second device can never re-roll. The day is the browser's local day index (streak.js
--     localDayIndex), within 1 of the server's UTC day (every real time zone is), and a FREE spin's day must be
--     strictly after the last free spin's day - one step per day, no replays.
--   * lb_wheel_claim(secret, spin) after the reveal LANDED and the browser paid it (gems / boost / cosmetic live in the
--     save). An 'again' reply carries `claimed`, so another device shows the result and never pays it twice.
--   * THE ODDS ARE PUBLISHED (the wheel's ODDS sheet = src/progress/wheel.js WHEEL_SLOTS - wheel.test.js reads this
--     file and fails if the two ever differ). 8 equal slices; the weights:
--       0 +25 GEMS 30 | 1 XP BOOST 10 MIN 18 | 2 +60 GEMS 17 | 3 RARE+ ROLL 8 | 4 WINS BOOST 10 MIN 12 |
--       5 LEGENDARY+ ROLL 2 | 6 +120 GEMS 9 | 7 WHEEL COSMETIC 4                                       (= 100)
--   * TICKETS are minted here, server side, through 060's private.grant_ticket (grant key 'wheel:<spin id>' - a spin
--     pays its ticket once). They show up on the ROLL screen like every other guaranteed roll.
--   * COSMETICS: the wheel-only set (lucky / jackpot / confetti). The server picks one this player has NOT won on the
--     wheel yet; with all three won the slot pays an EPIC+ ROLL ticket instead (no dead dupes).
--   * THE STREAK (free spins only): a spin the day after the last one +1, ONE missed day is forgiven (+1 still), two or
--     more start again at 1. Every 3rd+ day is HOT (gems x1.5); every 7th day is SUPER (gems x2, boosts 20 MIN, a ticket
--     one tier up: RARE+ -> EPIC+, LEGENDARY+ -> MYTHIC+). The odds never change - only what a slot pays.
--   * FREE ONLY: nothing here can be bought. No paid spins, no currency bought with money feeds it (loot-box rules:
--     claude notes wheel-research.md). The ad spin is capped at 1 a day and uses the same odds.
--   * LOGGED: private.wheel_spins IS the log (prize, amount, streak, bonus, rolled_at, claimed_at).
--
-- RESET ACCOUNT (058/060) also wipes the wheel (lb_reset_ack below = 060's body + two deletes).
-- ORDER: after 060 (needs private.grant_ticket). WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL
-- editor. Safe to re-run. ASCII only.

-- ---- config: the ad spin switch (Andy flips it once rewarded ads are live) ------------------------------------------
create table if not exists private.wheel_config (
  id integer primary key default 1 check (id = 1),
  ad_on boolean not null default false
);
insert into private.wheel_config (id) values (1) on conflict (id) do nothing;
revoke all on private.wheel_config from public;
revoke all on private.wheel_config from anon, authenticated;

-- ---- the spins (one row per player / day / kind) ----------------------------------------------------------------------
create table if not exists private.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day integer not null,                                        -- the browser's local day index
  kind text not null check (kind in ('free', 'ad')),
  slot integer not null check (slot between 0 and 7),
  prize text not null check (prize in ('gems', 'xp', 'wins', 'ticket', 'cosmetic')),
  amount integer not null default 0,                           -- gems, or boost minutes
  ticket_id uuid,
  ticket_tier text,
  cosmetic text,
  streak integer not null default 0,
  bonus text,                                                  -- null | 'hot' | 'super'
  rolled_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (profile_id, day, kind)
);
create index if not exists wheel_spins_profile_idx on private.wheel_spins (profile_id, rolled_at desc);
revoke all on private.wheel_spins from public;
revoke all on private.wheel_spins from anon, authenticated;

create table if not exists private.wheel_track (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  last_day integer not null default 0,                         -- the last FREE spin's local day index
  streak integer not null default 0,
  spins integer not null default 0
);
revoke all on private.wheel_track from public;
revoke all on private.wheel_track from anon, authenticated;

-- ---- the published table: slot -> weight (the ONE place the odds live server side) -----------------------------------
create or replace function private.wheel_pick()
returns integer language plpgsql volatile set search_path = public, private, pg_temp as $$
declare u double precision := random() * 100; acc integer := 0; r record;
begin
  for r in select * from (values
      (0, 30),  -- +25 GEMS
      (1, 18),  -- XP BOOST 10 MIN
      (2, 17),  -- +60 GEMS
      (3, 8),   -- RARE+ ROLL
      (4, 12),  -- WINS BOOST 10 MIN
      (5, 2),   -- LEGENDARY+ ROLL
      (6, 9),   -- +120 GEMS
      (7, 4)    -- WHEEL COSMETIC
    ) as t (slot, w) order by slot loop
    acc := acc + r.w;
    if u < acc then return r.slot; end if;
  end loop;
  return 0; -- float dust
end $$;
revoke all on function private.wheel_pick() from public;
revoke all on function private.wheel_pick() from anon, authenticated;

create or replace function private.wheel_json(s private.wheel_spins, p_again boolean)
returns json language sql stable set search_path = public, private, pg_temp as $$
  select json_build_object('ok', true, 'again', p_again, 'spin', s.id, 'day', s.day, 'kind', s.kind, 'slot', s.slot,
    'prize', s.prize, 'amount', s.amount, 'cosmetic', s.cosmetic, 'streak', s.streak, 'bonus', s.bonus,
    'claimed', s.claimed_at is not null,
    'ticket', case when s.ticket_id is null then null else json_build_object('id', s.ticket_id, 'tier', s.ticket_tier) end);
$$;
revoke all on function private.wheel_json(private.wheel_spins, boolean) from public;
revoke all on function private.wheel_json(private.wheel_spins, boolean) from anon, authenticated;

-- ---- lb_wheel_state: today's spins + the streak (read-only; the menu's dot) -------------------------------------------
create or replace function public.lb_wheel_state(p_secret text, p_day integer)
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid; tr private.wheel_track; f private.wheel_spins; a private.wheel_spins; adon boolean;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into tr from private.wheel_track where profile_id = pid;
  select * into f from private.wheel_spins where profile_id = pid and day = p_day and kind = 'free';
  select * into a from private.wheel_spins where profile_id = pid and day = p_day and kind = 'ad';
  select ad_on into adon from private.wheel_config where id = 1;
  return json_build_object('ok', true, 'day', p_day,
    'streak', coalesce(tr.streak, 0), 'last_day', coalesce(tr.last_day, 0), 'ad_on', coalesce(adon, false),
    'free', case when f.id is null then null else private.wheel_json(f, true) end,
    'ad', case when a.id is null then null else private.wheel_json(a, true) end);
end $$;
revoke all on function public.lb_wheel_state(text, integer) from public;
grant execute on function public.lb_wheel_state(text, integer) to anon, authenticated;

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
    select c into v_cos from unnest(array['lucky', 'jackpot', 'confetti']) as c
     where not exists (select 1 from private.wheel_spins w where w.profile_id = pid and w.cosmetic = c)
     order by random() limit 1;
    if v_cos is null then v_prize := 'ticket'; v_tier := 'epic'; end if; -- all three won: an EPIC+ ROLL instead
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

-- ---- lb_wheel_claim: the reveal landed and the browser paid it ---------------------------------------------------------
create or replace function public.lb_wheel_claim(p_secret text, p_spin uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.wheel_spins;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_spin is null then return json_build_object('ok', false, 'reason', 'no_spin'); end if;
  select * into s from private.wheel_spins where id = p_spin and profile_id = pid for update;
  if not found then return json_build_object('ok', false, 'reason', 'no_spin'); end if;
  if s.claimed_at is not null then return json_build_object('ok', true, 'again', true); end if;
  update private.wheel_spins set claimed_at = now() where id = s.id;
  return json_build_object('ok', true);
end $$;
revoke all on function public.lb_wheel_claim(text, uuid) from public;
grant execute on function public.lb_wheel_claim(text, uuid) to anon, authenticated;

-- ---- RESET ACCOUNT: 060's body + the wheel ------------------------------------------------------------------------------
create or replace function public.lb_reset_ack(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; rst boolean;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 1048576 then raise exception 'bad_blob'; end if;
  select reset_all into rst from public.profiles where id = pid for update;
  if not coalesce(rst, false) then return json_build_object('reset', false, 'reason', 'not_flagged'); end if;
  insert into private.cloud_saves as c (profile_id, blob, score, saved_at)
       values (pid, p_blob, greatest(0, coalesce(p_score, 0)), now())
  on conflict (profile_id) do update set blob = excluded.blob, score = excluded.score, saved_at = excluded.saved_at;
  update public.profiles
     set level = 1, rebirths = 0, stars = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
         week_words = 0, s2_week_stars0 = 0, s2_week_rb0 = 0, s2_week_lv0 = 1, rb_words0 = null,
         s2_roll_seq = 0, s2_rolls = 0, s2_since_epic = 0, s2_since_leg = 0, s2_roll_spent = 0,
         reset_all = false, submitted_at = now(), updated_at = now()
   where id = pid;
  delete from public.unlisted_finds where profile_id = pid;
  delete from private.gear_owned where profile_id = pid;
  delete from private.roll_log where profile_id = pid;
  delete from private.gear_refused where profile_id = pid;
  delete from public.profile_showcase where profile_id = pid;
  delete from public.rebirth_requests where profile_id = pid;
  delete from private.roll_tickets where profile_id = pid;
  delete from private.streak_track where profile_id = pid;
  -- 067: the wheel
  delete from private.wheel_spins where profile_id = pid;
  delete from private.wheel_track where profile_id = pid;
  return json_build_object('reset', true);
end $$;
revoke all on function public.lb_reset_ack(text, text, numeric) from public;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';

-- ADMIN (SQL editor):
-- TURN ON the ad spin (only once rewarded ads are live):   update private.wheel_config set ad_on = true where id = 1;
-- SEE the last spins:
--   select p.username, w.day, w.kind, w.prize, w.amount, w.ticket_tier, w.cosmetic, w.streak, w.bonus, w.rolled_at, w.claimed_at
--     from private.wheel_spins w join public.profiles p on p.id = w.profile_id order by w.rolled_at desc limit 50;
-- CHECK the odds over real spins (should approach 30 / 18 / 17 / 8 / 12 / 2 / 9 / 4):
--   select slot, round(100.0 * count(*) / sum(count(*)) over (), 1) from private.wheel_spins group by slot order by slot;
