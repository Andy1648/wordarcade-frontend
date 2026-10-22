-- 060_guaranteed_rolls.sql - GUARANTEED ROLLS (Andy oct22: "still need to work on guaranteed rolls (whether its rare,
-- epic+, legendary+, or mythic+, but make sure this system is flawless - no source code bs)").
--
-- A guaranteed roll is a TICKET the SERVER mints and owns. The browser can only LIST its tickets and SPEND one; it can
-- never make one, pick its tier, or spend one twice.
--
--   * private.roll_tickets - one row per ticket: its floor tier (RARE+ / EPIC+ / LEGENDARY+ / MYTHIC+), where it came
--     from, its grant key (unique per player = a grant can never pay twice), and once spent the gear it rolled. No
--     anon / authenticated access at all: the only doors are the security-definer functions below.
--   * MINTED only by server code: private.grant_ticket (Andy, from the SQL editor - see ADMIN at the bottom) and the
--     STREAK CALENDAR check-in (lb_streak_checkin, below: DAY 4 = a RARE+ ticket, DAY 7 = a LEGENDARY+ ticket). There is
--     no public grant function.
--   * SPENT with lb_ticket_roll(secret, ticket) -> a RESERVATION (the pick is stored on the ticket; asking again returns
--     the SAME pick, so a cancelled reveal can never re-roll for a better gear), then lb_ticket_claim(secret, ticket) on
--     the reveal's landing -> the gear goes into private.gear_owned and the ticket is SPENT. Both are idempotent by the
--     ticket id (it is the request id): a retried claim is ok, a spent ticket never rolls again.
--   * THE PICK (private.pick_ticket_gear): the TIER is drawn from the tiers at or above the floor with the game's own
--     tier odds at luck x1 (a LEGENDARY+ ticket: LEGENDARY ~94.7%, MYTHIC ~4.7%, SECRET ~0.6%), then the GEAR inside
--     that tier is one the player does NOT own yet when there is one (collecting all 12 LEGENDARIES takes 12 tickets,
--     not ~37). A ticket NEVER reads the browser's luck - no parameter can tilt it. SHINY is the flat 1.5%.
--   * PITY: untouched. A ticket roll is outside the gacha - it does not use the s2_roll_seq / lb_roll_claim protocol
--     (so an open normal reservation is never disturbed), does not move s2_since_epic / s2_since_leg / s2_rolls (your
--     EPIC+ / LEGENDARY+ countdown stays exactly where it was) and costs nothing (s2_roll_spent does not move).
--   * LOGGED: the ticket row IS the log - granted_at + source + grant_key + note, then reserved_at, the gear, spent_at.
--
-- THE STREAK CALENDAR, SERVER-CHECKED (replaces the draft 060_streak_legendary_roll.sql on feat/streak-calendar, which
-- handed out a LEGENDARY roll once a week to anyone who asked - the server could not see the streak). The server now
-- keeps its OWN copy of the 7-day track (private.streak_track) and only moves it on a check-in it can believe:
--   - the day is the browser's local day index (streak.js localDayIndex) but must be within 1 of the server's UTC day
--     (every real time zone is), and strictly after the last check-in: one step per day, no replays;
--   - PLAYED: the board's word count (server rate-capped, 057) went UP since the last check-in, by a board write in
--     the last 24 hours - a check-in without playing is refused;
--   - the same missed-day rule as calendar.js: one missed day holds the place, two or more send the track to DAY 1;
--   - REAL TIME: day N of a run is never less than N - 2 days after its DAY 1 (DAY 7 >= 5 days) - a clock / time-zone
--     game can squeeze a day, never a week. (The TESTER code skips only this span check.)
-- Gems for the other days stay in the browser, as today. Only the two ROLL days are server tickets.
--
-- RESET ACCOUNT (058) also wipes the player's tickets and streak track (Andy oct21 "reset resets everything").
-- ORDER: after 059. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.
-- ASCII only.

-- ---- the tickets -------------------------------------------------------------------------------------------------------
create table if not exists private.roll_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null check (tier in ('rare', 'epic', 'legendary', 'mythic')), -- the FLOOR: this tier or better
  source text not null,                                                        -- 'streak' / 'admin' / ...
  grant_key text not null,                                                     -- unique per player: a grant pays once
  note text,
  state text not null default 'owned' check (state in ('owned', 'reserved', 'spent', 'revoked')),
  mark_id text,                                                                -- the reserved / rolled gear
  pick_tier text,
  shiny boolean not null default false,
  granted_at timestamptz not null default now(),
  reserved_at timestamptz,
  spent_at timestamptz,
  unique (profile_id, grant_key)
);
create index if not exists roll_tickets_profile_idx on private.roll_tickets (profile_id, state);
revoke all on private.roll_tickets from public;
revoke all on private.roll_tickets from anon, authenticated;

-- ---- the ONLY mint: server code (the streak check-in below) or Andy in the SQL editor ---------------------------------
create or replace function private.grant_ticket(p_pid uuid, p_tier text, p_source text, p_key text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v uuid;
begin
  if p_pid is null or p_tier is null or p_tier not in ('rare', 'epic', 'legendary', 'mythic') then raise exception 'bad_ticket'; end if;
  if p_source is null or length(p_source) < 1 or length(p_source) > 40 then raise exception 'bad_source'; end if;
  if p_key is null or length(p_key) < 1 or length(p_key) > 120 then raise exception 'bad_key'; end if;
  insert into private.roll_tickets (profile_id, tier, source, grant_key, note)
  values (p_pid, p_tier, p_source, p_key, p_note)
  on conflict (profile_id, grant_key) do nothing
  returning id into v;
  if v is null then -- this grant already paid: the same ticket, never a second one
    select t.id into v from private.roll_tickets t where t.profile_id = p_pid and t.grant_key = p_key;
  end if;
  return v;
end $$;
revoke all on function private.grant_ticket(uuid, text, text, text, text) from public;
revoke all on function private.grant_ticket(uuid, text, text, text, text) from anon, authenticated;

-- ---- the pick: a tier at or above the floor (game odds, luck x1), then a gear the player does not own yet ------------
create or replace function private.pick_ticket_gear(p_pid uuid, p_floor text)
returns table (o_mark text, o_tier text)
language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare fr integer := private.tier_rank(p_floor); s double precision; tot double precision := 0; u double precision;
        acc double precision := 0; tw record; pick_t text := null; last_t text := null;
begin
  if fr < 0 or fr > 3 then raise exception 'bad_floor'; end if;
  -- a plain roll at luck x1: every non-RARE gear 1 / x, RARE the remainder (only a RARE+ ticket can land RARE)
  select coalesce(sum(1 / gp.x) filter (where gp.tier <> 'rare'), 0) into s from private.gear_pool gp;
  for tw in select t.tier, case when t.tier = 'rare' then greatest(0, 1 - s) else t.w end as w
              from (select gp.tier, sum(1 / gp.x) as w, min(gp.ord) as o from private.gear_pool gp group by gp.tier) t
             where private.tier_rank(t.tier) >= fr order by t.o loop
    tot := tot + tw.w;
  end loop;
  if tot <= 0 then raise exception 'empty_pool'; end if;
  u := random() * tot;
  for tw in select t.tier, case when t.tier = 'rare' then greatest(0, 1 - s) else t.w end as w
              from (select gp.tier, sum(1 / gp.x) as w, min(gp.ord) as o from private.gear_pool gp group by gp.tier) t
             where private.tier_rank(t.tier) >= fr order by t.o loop
    if tw.w > 0 then
      last_t := tw.tier;
      if u < acc + tw.w then pick_t := tw.tier; exit; end if;
      acc := acc + tw.w;
    end if;
  end loop;
  pick_t := coalesce(pick_t, last_t); -- float dust at the very end
  -- inside the tier: a gear this player does not own yet first (any one of them, evenly), else any gear of the tier
  select gp.mark_id, gp.tier into o_mark, o_tier
    from private.gear_pool gp
   where gp.tier = pick_t
   order by (exists (select 1 from private.gear_owned ow where ow.profile_id = p_pid and ow.mark_id = gp.mark_id)), random()
   limit 1;
  return next;
end $$;
revoke all on function private.pick_ticket_gear(uuid, text) from public;
revoke all on function private.pick_ticket_gear(uuid, text) from anon, authenticated;

-- ---- the server's copy of the 7-day STREAK CALENDAR track --------------------------------------------------------------
create table if not exists private.streak_track (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  pos integer not null default 0 check (pos between 0 and 6), -- the next day to check in: 0 = DAY 1
  last_day integer not null default 0,                        -- the browser's local day index of the last check-in
  last_at timestamptz,
  last_words bigint not null default 0,                       -- the board's word count at the last check-in
  run_at timestamptz,                                         -- when this run's DAY 1 was checked in
  week integer not null default 1,
  checkins integer not null default 0
);
revoke all on private.streak_track from public;
revoke all on private.streak_track from anon, authenticated;

-- ---- lb_tickets: my unspent tickets (+ a reserved one's pick, so an interrupted reveal lands the SAME gear) + my track -
create or replace function public.lb_tickets(p_secret text)
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid; st private.streak_track;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into st from private.streak_track where profile_id = pid;
  return json_build_object(
    'ok', true,
    'tickets', (select coalesce(json_agg(json_build_object(
                  'id', t.id, 'tier', t.tier, 'state', t.state, 'source', t.source,
                  'pick', case when t.state = 'reserved' then json_build_object('mark', t.mark_id, 'tier', t.pick_tier, 'shiny', t.shiny) end)
                  order by private.tier_rank(t.tier) desc, t.granted_at), '[]'::json)
                  from private.roll_tickets t where t.profile_id = pid and t.state in ('owned', 'reserved')),
    'streak', case when st.profile_id is null then null
                   else json_build_object('pos', st.pos, 'last_day', st.last_day, 'week', st.week) end);
end $$;
revoke all on function public.lb_tickets(text) from public;
grant execute on function public.lb_tickets(text) to anon, authenticated;

-- ---- lb_ticket_roll: reserve a ticket's pick (or hand back the reserved one) ------------------------------------------
create or replace function public.lb_ticket_roll(p_secret text, p_ticket uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; t private.roll_tickets; pk record; sh boolean;
        SHINY constant double precision := 0.015; -- markRollsCore.js SHINY_CHANCE, as lb_roll
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_ticket is null then return json_build_object('ok', false, 'reason', 'no_ticket'); end if;
  perform 1 from public.profiles where id = pid for update; -- one spend at a time per player
  -- the ticket must be THIS player's: another player's id is simply not found
  select * into t from private.roll_tickets where id = p_ticket and profile_id = pid for update;
  if not found or t.state = 'revoked' then return json_build_object('ok', false, 'reason', 'no_ticket'); end if;
  if t.state = 'spent' then return json_build_object('ok', false, 'reason', 'spent', 'ticket', t.id); end if;
  if t.state = 'reserved' then -- the SAME pick again: a cancelled reveal never re-rolls
    return json_build_object('ok', true, 'again', true, 'ticket', t.id, 'tier', t.tier,
                             'pick', json_build_object('mark', t.mark_id, 'tier', t.pick_tier, 'shiny', t.shiny));
  end if;
  select * into pk from private.pick_ticket_gear(pid, t.tier); -- the floor is the ROW's tier, never a parameter
  sh := random() < SHINY;
  update private.roll_tickets set state = 'reserved', mark_id = pk.o_mark, pick_tier = pk.o_tier, shiny = sh, reserved_at = now()
   where id = t.id;
  return json_build_object('ok', true, 'ticket', t.id, 'tier', t.tier,
                           'pick', json_build_object('mark', pk.o_mark, 'tier', pk.o_tier, 'shiny', sh));
end $$;
revoke all on function public.lb_ticket_roll(text, uuid) from public;
grant execute on function public.lb_ticket_roll(text, uuid) to anon, authenticated;

-- ---- lb_ticket_claim: the reveal landed - the gear is owned, the ticket is spent ---------------------------------------
create or replace function public.lb_ticket_claim(p_secret text, p_ticket uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; t private.roll_tickets;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_ticket is null then return json_build_object('ok', false, 'reason', 'no_ticket'); end if;
  perform 1 from public.profiles where id = pid for update;
  select * into t from private.roll_tickets where id = p_ticket and profile_id = pid for update;
  if not found or t.state = 'revoked' then return json_build_object('ok', false, 'reason', 'no_ticket'); end if;
  if t.state = 'spent' then return json_build_object('ok', true, 'again', true, 'ticket', t.id); end if; -- a retry
  if t.state <> 'reserved' then return json_build_object('ok', false, 'reason', 'not_reserved'); end if;
  insert into private.gear_owned as o (profile_id, mark_id, copies, shiny, source)
  values (pid, t.mark_id, 1, t.shiny, 'roll')
  on conflict (profile_id, mark_id) do update set copies = o.copies + 1, shiny = o.shiny or excluded.shiny;
  update private.roll_tickets set state = 'spent', spent_at = now() where id = t.id;
  return json_build_object('ok', true, 'ticket', t.id);
end $$;
revoke all on function public.lb_ticket_claim(text, uuid) from public;
grant execute on function public.lb_ticket_claim(text, uuid) to anon, authenticated;

-- ---- lb_streak_checkin: today's step on the calendar, if the server can believe it ------------------------------------
create or replace function public.lb_streak_checkin(p_secret text, p_day integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; st private.streak_track; utc_day integer; gap integer; d integer;
        pos0 integer; week0 integer; run0 timestamptz; tk uuid := null; tk_tier text := null;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  -- the browser's local day index is within 1 of the UTC day in every real time zone
  utc_day := floor(extract(epoch from now()) / 86400)::integer;
  if p_day is null or p_day < utc_day - 1 or p_day > utc_day + 1 then
    return json_build_object('ok', false, 'reason', 'day');
  end if;
  insert into private.streak_track (profile_id) values (pid) on conflict (profile_id) do nothing;
  select * into st from private.streak_track where profile_id = pid for update;
  if p_day <= st.last_day then -- already checked in today (or a replayed old day): nothing moves
    return json_build_object('ok', true, 'again', true, 'pos', st.pos, 'last_day', st.last_day, 'week', st.week);
  end if;
  -- PLAYED: the board's word count went up since the last check-in, by a board write in the last day
  if coalesce(p.lifetime_words, 0) <= st.last_words or p.submitted_at is null or p.submitted_at < now() - interval '1 day' then
    return json_build_object('ok', false, 'reason', 'play');
  end if;
  -- the missed-day rule (calendar.js settle): 1 = yesterday, 2 = one missed day (held), 3+ = back to DAY 1
  gap := case when st.last_day = 0 then 99 else p_day - st.last_day end;
  pos0 := st.pos; week0 := st.week; run0 := st.run_at;
  if gap >= 3 then pos0 := 0; week0 := 1; end if;
  if pos0 = 0 then run0 := now(); end if;
  d := pos0 + 1; -- the day this check-in claims (1..7)
  -- REAL TIME: day N is never less than N - 2 days after this run's DAY 1 (DAY 7: >= 5 days)
  if d >= 3 and now() < run0 + make_interval(days => d - 2) and not coalesce(p.is_tester, false) then
    return json_build_object('ok', false, 'reason', 'early', 'next', run0 + make_interval(days => d - 2));
  end if;
  if d = 4 then tk_tier := 'rare'; elsif d = 7 then tk_tier := 'legendary'; end if;
  if tk_tier is not null then
    -- the key is the day index: it only goes up, so every grant key is new and a grant can never pay twice
    tk := private.grant_ticket(pid, tk_tier, 'streak', 'streak:' || p_day || ':d' || d, 'day ' || d || ' week ' || week0);
  end if;
  update private.streak_track
     set pos = d % 7, last_day = p_day, last_at = now(), last_words = coalesce(p.lifetime_words, 0), run_at = run0,
         week = case when d = 7 then week0 + 1 else week0 end, checkins = checkins + 1
   where profile_id = pid;
  return json_build_object('ok', true, 'day', d, 'pos', d % 7, 'last_day', p_day,
                           'week', case when d = 7 then week0 + 1 else week0 end,
                           'ticket', case when tk is null then null else json_build_object('id', tk, 'tier', tk_tier) end);
end $$;
revoke all on function public.lb_streak_checkin(text, integer) from public;
grant execute on function public.lb_streak_checkin(text, integer) to anon, authenticated;

-- ---- RESET ACCOUNT: 058's body + the tickets and the streak track ------------------------------------------------------
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
  -- 058: everything else that belongs to this player's progress
  delete from public.unlisted_finds where profile_id = pid;
  delete from private.gear_owned where profile_id = pid;
  delete from private.roll_log where profile_id = pid;
  delete from private.gear_refused where profile_id = pid;
  delete from public.profile_showcase where profile_id = pid;
  delete from public.rebirth_requests where profile_id = pid;
  -- 060: the guaranteed-roll tickets and the server's streak track
  delete from private.roll_tickets where profile_id = pid;
  delete from private.streak_track where profile_id = pid;
  return json_build_object('reset', true);
end $$;
revoke all on function public.lb_reset_ack(text, text, numeric) from public;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';

-- ADMIN (SQL editor). GIVE a player a ticket (tier: 'rare' / 'epic' / 'legendary' / 'mythic'; the key makes it pay once):
--   select private.grant_ticket((select id from public.profiles where lower(username) = lower('<name>')),
--                               'legendary', 'admin', 'admin:2026-10-22:<name>', 'why');
-- SEE every ticket (granted, reserved, spent - with the gear it rolled):
--   select p.username, t.tier, t.source, t.state, t.mark_id, t.pick_tier, t.shiny, t.granted_at, t.spent_at
--     from private.roll_tickets t join public.profiles p on p.id = t.profile_id order by t.granted_at desc;
-- TAKE BACK an unspent ticket:   update private.roll_tickets set state = 'revoked' where id = '<ticket id>' and state = 'owned';
-- CHECK the ticket odds (should read LEGENDARY ~0.947 / MYTHIC ~0.047 / SECRET ~0.006 for a LEGENDARY+ ticket):
--   select tier, sum(1 / x) / (select sum(1 / x) from private.gear_pool where private.tier_rank(tier) >= 2)
--     from private.gear_pool where private.tier_rank(tier) >= 2 group by tier;
