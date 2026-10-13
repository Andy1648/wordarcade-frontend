-- 038_ticker_check.sql — Andy oct13 (a friend "used commands"): the live ticker is a public Realtime channel, so a
-- browser console could post "NAME ROLLED SECRET" (or any name, any level) with nothing behind it. Every client now
-- asks this function before showing a tick, and shows it only when the server's own records back it:
--   roll  v=4/5 → that player has a CLAIMED server roll (036 roll_log) of MYTHIC / SECRET in the last 15 minutes
--   lv    v     → that player's stored level is at least v
--   rb    v     → that player's stored rebirths are at least v
--   rank  v     → that player is at #v or better on the season-2 board (2 places of slack for a board that moved)
-- ALSO: lb_roll's LUCK_CAP 15 → 10. The luck a roll claims comes from the browser; the most a fully maxed legit save
-- reaches is ×9.2 (every gear ★5, every milestone, every PERMANENT, two luck gears, a BOOST, the R7 ×1.25 — measured
-- with markRolls.luck), so 10 never touches a real player and cuts a forged claim by a third. Body = 037's otherwise.
-- ORDER: after 037. Read-only check, a few index lookups; callable by anyone (it only answers yes / no about public facts).
-- Until this runs the client shows ticks as before (the RPC 404s). ORDER: after 037. Then notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

create or replace function public.lb_tick_ok(p_k text, p_n text, p_v integer)
returns boolean language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; rk bigint;
begin
  if p_k is null or p_n is null or p_v is null or length(p_n) > 32 then return false; end if;
  select * into p from public.profiles where lower(username) = lower(btrim(p_n)) limit 1;
  if not found then return false; end if;
  pid := p.id;
  if p_k = 'roll' then
    return exists (select 1 from private.roll_log l
                    where l.profile_id = pid and l.state = 'claimed'
                      and l.tier = case p_v when 4 then 'mythic' when 5 then 'secret' else '-' end
                      and l.claimed_at > now() - interval '15 minutes');
  elsif p_k = 'lv' then
    return coalesce(p.level, 0) >= p_v;
  elsif p_k = 'rb' then
    return coalesce(p.rebirths, 0) >= p_v;
  elsif p_k = 'rank' then
    select b.rank into rk from public.leaderboard_s2 b where b.id = pid;
    return rk is not null and rk <= p_v + 2;
  end if;
  return false;
end $$;
revoke all on function public.lb_tick_ok(text, text, integer) from public;
grant execute on function public.lb_tick_ok(text, text, integer) to anon, authenticated;

-- ---- lb_roll: 037's body, LUCK_CAP 10 ------------------------------------------------------------------------------
create or replace function public.lb_roll(p_secret text, p_luck double precision, p_n integer default 1)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; n integer; i integer; L double precision; bonus boolean;
        se integer; sl integer; rolls integer; pk record; sh boolean; budget bigint; recent integer; out jsonb := '[]'::jsonb;
        LUCK_CAP constant double precision := 10;   -- 038: a fully maxed legit save measures ×9.2 (was 15)
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


notify pgrst, 'reload schema';
