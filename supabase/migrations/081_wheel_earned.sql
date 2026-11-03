-- 081_wheel_earned.sql - THE DAILY WHEEL IS EARNED, NOT FREE (Andy nov4: "dont have daily spin for free (people say its not
-- fun bc its too free and should be functionality)"). Today's spin unlocks after 15 GAME words since your last spin -
-- about one game. Still ONE spin a day; the odds, the prizes, the streak (one missed day forgiven, every 7th a SUPER)
-- and the claim are unchanged.
--
--   * PROOF OF PLAY = the board's lifetime_words (game words only; menu keys never count) - the same signal 060's streak
--     check-in already trusts: it must have reached wheel_track.last_words + 15, from a board write in the last day.
--   * wheel_track gains last_words: the lifetime_words at your last spin. A player with no mark yet (every existing row,
--     and a new one) is marked at their CURRENT count the first time the wheel asks - so nobody gets a free first spin;
--     everyone plays 15 words first. A spin moves the mark to the count it was earned on.
--   * private.wheel_earn holds the 15 (one row) - tune it without a new function.
--   * lb_wheel_state also returns words / need (lifetime_words and the count today's spin needs) for the progress bar.
--   * lb_wheel_spin refuses {ok:false, reason:'words', have, need} until earned (the free spin only; the ad spin keeps
--     its own rule - the free one first). A spin already rolled today is still handed back as before.
--   * lb_wheel_spin is recreated from 078 (the JACKPOT-only cosmetic pool) - running this file also applies 078's change.
--   * A save reset (lb_reset_ack) wipes lifetime_words to 0: the mark is clamped down to the current count, so the next
--     15 game words earn the spin again (never a negative or endless wait).
--
-- ORDER: after 078 (and 079 / 080). WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe
-- to re-run (add column if not exists, create or replace + the same grants). ASCII only.

alter table private.wheel_track add column if not exists last_words bigint;

create table if not exists private.wheel_earn (id integer primary key default 1 check (id = 1), words integer not null default 15);
insert into private.wheel_earn (id) values (1) on conflict (id) do nothing;
revoke all on private.wheel_earn from public;
revoke all on private.wheel_earn from anon, authenticated;

-- the mark, created / clamped on first sight (never a free spin, never a negative wait); returns it
create or replace function private.wheel_mark(pid uuid)
returns bigint language plpgsql volatile set search_path = public, private, pg_temp as $$
declare w bigint; m bigint;
begin
  select coalesce(lifetime_words, 0) into w from public.profiles where id = pid;
  insert into private.wheel_track (profile_id, last_words) values (pid, w) on conflict (profile_id) do nothing;
  update private.wheel_track set last_words = w where profile_id = pid and (last_words is null or last_words > w);
  select last_words into m from private.wheel_track where profile_id = pid;
  return m;
end $$;
revoke all on function private.wheel_mark(uuid) from public;

-- ---- lb_wheel_state: today's spins + the streak + how far today's spin is (the menu's dot / the progress bar) ----------
-- (volatile now: the first call marks a player who has no mark yet)
create or replace function public.lb_wheel_state(p_secret text, p_day integer)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; tr private.wheel_track; f private.wheel_spins; a private.wheel_spins; adon boolean; w bigint; m bigint; n integer;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  m := private.wheel_mark(pid);
  select coalesce(lifetime_words, 0) into w from public.profiles where id = pid;
  select words into n from private.wheel_earn where id = 1;
  select * into tr from private.wheel_track where profile_id = pid;
  select * into f from private.wheel_spins where profile_id = pid and day = p_day and kind = 'free';
  select * into a from private.wheel_spins where profile_id = pid and day = p_day and kind = 'ad';
  select ad_on into adon from private.wheel_config where id = 1;
  return json_build_object('ok', true, 'day', p_day,
    'streak', coalesce(tr.streak, 0), 'last_day', coalesce(tr.last_day, 0), 'ad_on', coalesce(adon, false),
    'words', w, 'need', m + coalesce(n, 15),
    'free', case when f.id is null then null else private.wheel_json(f, true) end,
    'ad', case when a.id is null then null else private.wheel_json(a, true) end);
end $$;
revoke all on function public.lb_wheel_state(text, integer) from public;
grant execute on function public.lb_wheel_state(text, integer) to anon, authenticated;

-- ---- lb_wheel_spin: roll today's EARNED spin (or hand back the one already rolled) -----------------------------------------
create or replace function public.lb_wheel_spin(p_secret text, p_day integer, p_kind text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; utc_day integer; tr private.wheel_track; s private.wheel_spins; adon boolean; p public.profiles; m bigint; n integer;
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

  m := private.wheel_mark(pid);
  select * into tr from private.wheel_track where profile_id = pid for update;
  select * into p from public.profiles where id = pid;

  if p_kind = 'free' then
    if p_day <= tr.last_day then return json_build_object('ok', false, 'reason', 'spun'); end if; -- a replayed / older day
    -- 081 EARNED: 15 game words since the last spin, on a board write from the last day
    select words into n from private.wheel_earn where id = 1;
    n := coalesce(n, 15);
    if coalesce(p.lifetime_words, 0) < m + n or p.submitted_at is null or p.submitted_at < now() - interval '1 day' then
      return json_build_object('ok', false, 'reason', 'words', 'have', coalesce(p.lifetime_words, 0), 'need', m + n);
    end if;
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
    select c into v_cos from unnest(array['jackpot']) as c
     where not exists (select 1 from private.wheel_spins w where w.profile_id = pid and w.cosmetic = c)
     order by random() limit 1;
    if v_cos is null then v_prize := 'ticket'; v_tier := 'epic'; end if; -- JACKPOT won: an EPIC+ ROLL instead
  end if;

  if v_tier is not null then
    v_tk := private.grant_ticket(pid, v_tier, 'wheel', 'wheel:' || sid, 'wheel day ' || p_day || ' ' || p_kind);
  end if;

  insert into private.wheel_spins (id, profile_id, day, kind, slot, prize, amount, ticket_id, ticket_tier, cosmetic, streak, bonus)
  values (sid, pid, p_day, p_kind, v_slot, v_prize, v_amount, v_tk, v_tier, v_cos, v_streak, v_bonus)
  returning * into s;

  if p_kind = 'free' then
    update private.wheel_track set last_day = p_day, streak = v_streak, spins = spins + 1,
           last_words = coalesce(p.lifetime_words, 0)
     where profile_id = pid;
  else
    update private.wheel_track set spins = spins + 1 where profile_id = pid;
  end if;
  return private.wheel_json(s, false);
end $$;
revoke all on function public.lb_wheel_spin(text, integer, text) from public;
grant execute on function public.lb_wheel_spin(text, integer, text) to anon, authenticated;
