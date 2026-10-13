-- 037_gear_grandfather_fix.sql — Andy oct13 (WIDESTWHALE: ORIGIN + KRAKEN on the card, no server roll, no flag).
--
-- THE BUG (036): private.gear_check grandfathered a gear the server had no record of whenever the ACCOUNT was older than
-- ROLL_CUTOFF and its gem budget made the gear "plausible" — on EVERY showcase update, not only in 036's one-time audit.
-- An old, active account has a big budget, so any gear rolled on its own device (or typed into devtools) after the
-- cutoff went straight onto the card as 'grandfather'. The intent was: forgive what was ALREADY on show when the audit
-- ran, then only server-rolled gears.
--
-- THE FIX:
--   1. Every 'grandfather' row written AFTER the audit (the audit's rows all share its one transaction timestamp — the
--      earliest grandfather time) is removed, recorded in private.gear_refused (hidden, NEVER reverted from the save)
--      and flagged ('gear', { late_grandfather }). Review + override lines at the end.
--   2. private.gear_check no longer grandfathers: a rolled gear shows only if the server rolled it (or the audit already
--      forgave it). Anything else is HIDDEN from the card and flagged — never taken from the player's own save.
--   3. Every showcase is re-checked now.
--   4. lb_roll: the double roll (SINGULARITY) needs SINGULARITY on the server's record for an account made after the
--      cutoff; an older account is only flagged (it may have rolled it on its own device before the cutoff).
--
-- NO HARM: nothing is removed from any save and no roll is refused for an old account. The one visible cost: an old
-- account that had a real pre-cutoff MYTHIC / SECRET but did not have it ON SHOW when 036 ran will see it hidden from
-- its card until you override it (the review query lists every case). The TESTER code skips all of it.
--
-- ORDER: after 036. Then notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- 1. undo the late grandfathers -----------------------------------------------------------------------------------
do $$
declare audit_at timestamptz;
begin
  select min(first_at) into audit_at from private.gear_owned where source = 'grandfather';
  if audit_at is null then return; end if;
  insert into private.gear_refused (profile_id, mark_id, revert)
  select g.profile_id, g.mark_id, false from private.gear_owned g
   where g.source = 'grandfather' and g.first_at > audit_at + interval '5 seconds'
  on conflict do nothing;
  begin
    insert into private.cheat_flags (profile_id, reason, detail)
    select g.profile_id, 'gear', jsonb_build_object('mark', g.mark_id, 'late_grandfather', g.first_at)
      from private.gear_owned g
     where g.source = 'grandfather' and g.first_at > audit_at + interval '5 seconds';
  exception when others then null; end;
  delete from private.gear_owned where source = 'grandfather' and first_at > audit_at + interval '5 seconds';
end $$;

-- ---- 2. gear_check: server-rolled (or audit-forgiven) only ----------------------------------------------------------
create or replace function private.gear_check(p_pid uuid, p_mark text)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare tester boolean;
begin
  if p_mark is null then return null; end if;
  if not exists (select 1 from private.gear_pool where mark_id = p_mark) then return p_mark; end if; -- PERMANENT / legacy
  select coalesce(is_tester, false) into tester from public.profiles where id = p_pid;
  if tester then return p_mark; end if; -- the TESTER code skips every check
  if exists (select 1 from private.gear_owned where profile_id = p_pid and mark_id = p_mark) then return p_mark; end if;
  if exists (select 1 from private.gear_refused where profile_id = p_pid and mark_id = p_mark) then return null; end if;
  -- no server record: hidden from the card + flagged once (never reverted from the player's save)
  insert into private.gear_refused (profile_id, mark_id, revert) values (p_pid, p_mark, false) on conflict do nothing;
  begin
    insert into private.cheat_flags (profile_id, reason, detail)
    values (p_pid, 'gear', jsonb_build_object('mark', p_mark, 'budget', private.gem_budget(p_pid)));
  exception when others then null; end;
  return null;
end $$;
revoke all on function private.gear_check(uuid, text) from public;
revoke all on function private.gear_check(uuid, text) from anon, authenticated;

-- ---- 3. re-check every card now ----------------------------------------------------------------------------------------
update public.profile_showcase s
   set gear1 = private.gear_check(s.profile_id, s.gear1), gear2 = private.gear_check(s.profile_id, s.gear2)
 where s.gear1 is not null or s.gear2 is not null;

-- ---- 4. lb_roll: 036's body + the SINGULARITY check on the double roll ----------------------------------------------
create or replace function public.lb_roll(p_secret text, p_luck double precision, p_n integer default 1)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; n integer; i integer; L double precision; bonus boolean;
        se integer; sl integer; rolls integer; pk record; sh boolean; budget bigint; recent integer; out jsonb := '[]'::jsonb;
        LUCK_CAP constant double precision := 15;   -- the most a legit save reaches (every pip, perm, milestone, boost, unlock)
        ROLL_PRICE constant integer := 75;          -- v3/econ.js ROLL_PRICE
        SHINY constant double precision := 0.015;   -- markRollsCore.js SHINY_CHANCE
        BONUS_EVERY constant integer := 10;         -- markRolls.js BONUS_ROLL_EVERY (×2 luck)
        RATE_PER_SEC constant integer := 3;
        ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00';
        sing boolean;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  -- an open reservation: the SAME picks again (a cancelled hold can never re-roll for a better result)
  v_seq := p.s2_roll_seq + 1;
  if exists (select 1 from private.roll_log where profile_id = pid and roll_log.seq = v_seq and state = 'reserved') then
    select coalesce(jsonb_agg(jsonb_build_object('mark', l.mark_id, 'tier', l.tier, 'shiny', l.shiny) order by l.idx), '[]'::jsonb)
      into out from private.roll_log l where l.profile_id = pid and l.seq = v_seq and l.state = 'reserved';
    return json_build_object('ok', true, 'seq', v_seq, 'picks', out, 'again', true);
  end if;
  select count(*) into recent from private.roll_log where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC and not coalesce(p.is_tester, false) then return json_build_object('ok', false, 'reason', 'rate'); end if;
  budget := private.gem_budget(pid);
  -- over budget: refused — the browser then rolls LOCALLY as before (the player never loses a roll; that gear just
  -- can't go on the card). The TESTER code has no budget.
  if p.s2_roll_spent + ROLL_PRICE > budget and not coalesce(p.is_tester, false) then
    return json_build_object('ok', false, 'reason', 'budget', 'budget', budget, 'spent', p.s2_roll_spent);
  end if;
  n := least(2, greatest(1, coalesce(p_n, 1)));        -- SINGULARITY's double roll: one price, two picks
  -- 037: the double roll needs SINGULARITY. The server knows it for every gear it rolled; an account made before the
  -- cutoff may have rolled it on its own device, so there a claim the server can't back is FLAGGED (once an hour), not
  -- refused (no harm). A newer account has every gear from the server: no SINGULARITY on record = one pick.
  if n = 2 and not coalesce(p.is_tester, false) then
    sing := exists (select 1 from private.gear_owned where profile_id = pid and mark_id = 'mk-singularity');
    if not sing then
      if p.created_at >= ROLL_CUTOFF then
        n := 1;
      elsif not exists (select 1 from private.cheat_flags where profile_id = pid and reason = 'gear'
                          and detail ? 'double_roll' and created_at > now() - interval '1 hour') then
        begin
          insert into private.cheat_flags (profile_id, reason, detail) values (pid, 'gear', jsonb_build_object('double_roll', true));
        exception when others then null; end;
      end if;
    end if;
  end if;
  L := least(LUCK_CAP, greatest(1, coalesce(p_luck, 1)));
  se := p.s2_since_epic; sl := p.s2_since_leg; rolls := p.s2_rolls;
  for i in 0 .. n - 1 loop
    bonus := (rolls + 1) % BONUS_EVERY = 0;
    select * into pk from private.pick_gear(L * (case when bonus then 2 else 1 end), se, sl);
    sh := random() < SHINY;
    insert into private.roll_log (profile_id, seq, idx, mark_id, tier, shiny, luck, forced, bonus)
    values (pid, v_seq, i, pk.mark_id, pk.tier, sh, L, pk.forced, bonus);
    out := out || jsonb_build_object('mark', pk.mark_id, 'tier', pk.tier, 'shiny', sh);
    se := case when private.tier_rank(pk.tier) >= 1 then 0 else se + 1 end;
    sl := case when private.tier_rank(pk.tier) >= 2 then 0 else sl + 1 end;
    rolls := rolls + 1;
  end loop;
  return json_build_object('ok', true, 'seq', v_seq, 'picks', out);
end $$;
revoke all on function public.lb_roll(text, double precision, integer) from public;
grant execute on function public.lb_roll(text, double precision, integer) to anon, authenticated;


-- REVIEW (SQL editor): every gear hidden from a card, newest first
--   select p.username, r.mark_id, f.detail, f.created_at from private.gear_refused r
--     join public.profiles p on p.id = r.profile_id
--     left join private.cheat_flags f on f.profile_id = r.profile_id and f.reason = 'gear' and f.detail->>'mark' = r.mark_id
--    order by f.created_at desc nulls last;
-- OVERRIDE (you decide it was real — e.g. an old player's genuine pre-cutoff gear):
--   delete from private.gear_refused where profile_id = (select id from public.profiles where lower(username) = 'name') and mark_id = 'mk-kraken';
--   insert into private.gear_owned (profile_id, mark_id, source) select id, 'mk-kraken', 'grandfather' from public.profiles where lower(username) = 'name';

notify pgrst, 'reload schema';
