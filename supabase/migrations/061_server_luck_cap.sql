-- 061_server_luck_cap.sql - THE SERVER SIZES YOUR LUCK (Andy oct22 "ensure no source code bs").
-- lb_roll took p_luck from the browser and only clamped it to a flat LUCK_CAP 10, so a console user sent 10 on every
-- roll and got x10 odds above RARE (a fresh legit save rolls at ~x1). From this file on the clamp is PER ACCOUNT:
-- private.luck_cap(pid) rebuilds markRolls.js luck() from what the server knows, adds a fixed allowance for what it
-- can't see, and lb_roll uses least(10, that) instead of 10. The browser still sends its own luck; a legit save's luck
-- is always <= its cap (serverLuckCap.test.js proves it for a maxed save and for random ones), so nothing changes for
-- a real player whose gears the server rolled. Only a number the save could not have made is cut down.
--
--   SEEN (private.gear_owned, profiles):
--     * PIPS        +0.01 a star, each owned gear's stars = (copies - 1) / its tier's dupes-per-pip, max 5 (the
--                   pre-v4 rule; v4 froze stars, so the copies the server counted are an upper bound).
--     * INDEX       each COLLECTION_MILESTONES luck whose % is reached, the % over MIN_POOL (28 = the smallest pool
--                   since 036): a milestone paid on a smaller pool stays paid after the pool grew, so this never
--                   undercounts.
--     * WORN LUCK   the best owned gear's ROLL LUCK (MAIN + L substats, x stars x SHINY) - the best TWO from R5 (the
--                   2nd gear slot). EARNED (permanent) and UNLISTED gears are candidates too, at their star-0 value.
--     * R7 UNLOCK   x1.25 from profiles.rebirths (or any star). R5 / R7 take one rebirth of slack: the row can trail
--                   the browser by a rebirth in flight.
--   NOT SEEN (a fixed allowance, always given):
--     * BOOST +1.0, every PERMANENT (hard-achievement) mark +0.1 each (all 10: +1.0), the STOCK's x2 LUCK.
--   NOT IN THE CAP: the x2 bonus roll. The browser sends luck() WITHOUT it and lb_roll doubles every 10th roll on the
--   server's own count (unchanged), so the bonus stays on top of the capped luck.
--   FLAT 10 STAYS for an account created before ROLL_CUTOFF (it rolled on its own device; the server can't size it,
--   and its pre-v2 GOLD / RAINBOW floors live only there) and for the TESTER code.
--
-- A fresh account's cap is (1 + 1 + 1 + 0.3 best unseen gear) x 2 = 6.6 (was 10); a maxed save reaches the 10 ceiling.
-- THE ONE GAP: a gear this account rolled OFF the server (offline, over budget, or before it had a name) is not in
-- gear_owned, so its luck is not in the cap. A cut-down request is flagged ('clamped', once an hour) so such a save
-- shows up for review instead of silently.
-- lb_roll below = 047's body (pity sync, budget, double-roll check, rate limit unchanged) with luck_cap in place of
-- LUCK_CAP. ORDER: after 059 (the pool). No browser change: ship this SQL; the client is unchanged.
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run. ASCII only.

-- ---- every gear's ROLL LUCK at star 0, in % (= markRollsCore statOf + substatsOf luckPct, season 2; serverLuckCap.test.js pins every row)
create table if not exists private.gear_luck (mark_id text primary key, luck_pct double precision not null);
revoke all on private.gear_luck from public;
revoke all on private.gear_luck from anon, authenticated;
truncate private.gear_luck;
insert into private.gear_luck (mark_id, luck_pct) values
  ('mk-cyclone', 5),
  ('mk-slipstream', 50),
  ('mk-hotwire', 5),
  ('mk-highlighter', 5),
  ('mk-flashcards', 2.5),
  ('mk-gumball', 7.5),
  ('mk-pyro', 10),
  ('mk-talisman', 150),
  ('mk-lavalamp', 10),
  ('mk-fortune', 20),
  ('mk-hoarder', 15),
  ('mk-leviathan', 15),
  ('mk-jackpot', 30),
  ('mk-monsoon', 15),
  ('mk-shamrock', 400),
  ('mk-longshot', 22.5),
  ('mk-arcadestick', 15),
  ('mk-kraken', 50),
  ('mk-firebird', 25),
  ('mk-paradox', 60),
  ('mk-marathon', 15),
  ('mk-ritual', 30),
  ('mk-linguist', 30),
  ('mk-ul-og', 15),
  ('mk-ul-wishbone', 30),
  ('mk-ul-mirror', 15),
  ('mk-ul-midas', 15);

-- ---- the cap ---------------------------------------------------------------------------------------------------------
create or replace function private.luck_cap(p_pid uuid)
returns double precision language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; base_n integer; gold_n integer; rainbow_n integer; pip_add double precision;
        ms double precision; worn double precision; slots integer; reb integer;
        LUCK_CAP constant double precision := 10;      -- the hard ceiling (038)
        ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00';
        MIN_POOL constant integer := 28;               -- the smallest gear pool since 036 (036 / 044 / 048)
        PIP constant double precision := 0.01;        -- markRolls.js LUCK_SOURCES.pip
        MAX_PIPS constant integer := 5;                -- markRollsCore.js MAX_PIPS
        PIP_STEP constant double precision := 0.2;    -- markRollsCore.js PIP_STEP
        SHINY_MULT constant double precision := 2;    -- markRollsCore.js SHINY_MULT
        PERM_ALLOW constant double precision := 1;    -- LUCK_SOURCES.permanent 0.1 x all 10 PERMANENT_MARKS
        BOOST constant double precision := 1;         -- LUCK_SOURCES.boost
        STOCK_MULT constant double precision := 2;    -- v3/stock.js LUCK BOOST x2
        UNLOCK_MULT constant double precision := 1.25; -- v3/unlocks.js LUCK_UNLOCK_MULT
        UNLOCK_AT constant integer := 7; MARK2_AT constant integer := 5; REBIRTH_SLACK constant integer := 1;
begin
  select * into p from public.profiles where id = p_pid;
  if not found then return 1; end if;
  if p.created_at < ROLL_CUTOFF or coalesce(p.is_tester, false) then return LUCK_CAP; end if;
  reb := coalesce(p.rebirths, 0) + REBIRTH_SLACK;
  slots := case when reb >= MARK2_AT or coalesce(p.stars, 0) >= 1 then 2 else 1 end;
  with o as (
    select g.mark_id, g.shiny,
           least(MAX_PIPS, floor(greatest(0, g.copies - 1)::numeric /
             case gp.tier when 'rare' then 5 when 'epic' then 3 when 'legendary' then 2 else 1 end))::integer as pips
      from private.gear_owned g join private.gear_pool gp on gp.mark_id = g.mark_id
     where g.profile_id = p_pid
  ), cand as (
    select gl.luck_pct / 100 * (1 + PIP_STEP * o.pips) * (case when o.shiny then SHINY_MULT else 1 end) as v
      from o join private.gear_luck gl on gl.mark_id = o.mark_id
    union all
    select gl.luck_pct / 100 from private.gear_luck gl                       -- EARNED / UNLISTED: not seen, always a candidate
     where not exists (select 1 from private.gear_pool gp where gp.mark_id = gl.mark_id)
  )
  select (select count(*) from o), (select count(*) from o where pips > 0), (select count(*) from o where pips >= MAX_PIPS),
         (select coalesce(sum(pips), 0) * PIP from o),
         (select coalesce(sum(v), 0) from (select v from cand order by v desc limit slots) t)
    into base_n, gold_n, rainbow_n, pip_add, worn;
  -- markRollsCore.js COLLECTION_MILESTONES (track, %, luck)
  select coalesce(sum(m.luck), 0) into ms
    from (values ('base', 25, 0.05), ('base', 50, 0.1), ('base', 75, 0.1), ('base', 90, 0.15), ('base', 100, 0.25),
                 ('gold', 25, 0.1), ('gold', 50, 0.15), ('gold', 75, 0.15), ('gold', 100, 0.25),
                 ('rainbow', 25, 0.15), ('rainbow', 50, 0.2), ('rainbow', 75, 0.2), ('rainbow', 100, 0.5)) m(track, pct, luck)
   where (case m.track when 'base' then base_n when 'gold' then gold_n else rainbow_n end) * 100.0 / MIN_POOL >= m.pct - 1e-9;
  return least(LUCK_CAP, (1 + PERM_ALLOW + BOOST + pip_add + ms + worn)
                         * (case when reb >= UNLOCK_AT or coalesce(p.stars, 0) >= 1 then UNLOCK_MULT else 1 end)
                         * STOCK_MULT);
end $$;
revoke all on function private.luck_cap(uuid) from public;
revoke all on function private.luck_cap(uuid) from anon, authenticated;

-- ---- lb_roll: 047 with the per-account cap ---------------------------------------------------------------------------
create or replace function public.lb_roll(p_secret text, p_luck double precision, p_n integer default 1)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; n integer; i integer; L double precision; bonus boolean;
        se integer; sl integer; rolls integer; pk record; sh boolean; budget bigint; recent integer; out jsonb := '[]'::jsonb;
        cap double precision;                       -- 061: private.luck_cap (was a flat 10)
        ROLL_PRICE constant integer := 75;          -- v3/econ.js ROLL_PRICE
        SHINY constant double precision := 0.015;   -- markRollsCore.js SHINY_CHANCE
        BONUS_EVERY constant integer := 10;         -- markRolls.js BONUS_ROLL_EVERY (x2 luck)
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
    return json_build_object('ok', true, 'seq', v_seq, 'picks', out, 'again', true,
                             'since_epic', p.s2_since_epic, 'since_leg', p.s2_since_leg);
  end if;
  select count(*) into recent from private.roll_log where profile_id = pid and created_at > now() - interval '1 second';
  if recent >= RATE_PER_SEC and not coalesce(p.is_tester, false) then return json_build_object('ok', false, 'reason', 'rate'); end if;
  budget := private.gem_budget(pid);
  -- over budget: refused - the browser then rolls LOCALLY as before (the player never loses a roll; that gear just
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
  -- 061: the luck this account could have, not a flat 10. Asking for more is cut down and flagged (once an hour).
  cap := private.luck_cap(pid);
  L := least(cap, greatest(1, coalesce(p_luck, 1)));
  if coalesce(p_luck, 1) > cap + 1e-9
     and not exists (select 1 from private.cheat_flags where profile_id = pid and reason = 'clamped'
                       and detail ? 'luck' and created_at > now() - interval '1 hour') then
    begin
      insert into private.cheat_flags (profile_id, reason, detail) values (pid, 'clamped', jsonb_build_object('luck', p_luck, 'cap', cap));
    exception when others then null; end;
  end if;
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
  -- 047: the server's pity counters BEFORE these picks, so the browser's EPIC+ / LEGENDARY+ countdown is the server's
  return json_build_object('ok', true, 'seq', v_seq, 'picks', out,
                           'since_epic', p.s2_since_epic, 'since_leg', p.s2_since_leg);
end $$;
revoke all on function public.lb_roll(text, double precision, integer) from public;
grant execute on function public.lb_roll(text, double precision, integer) to anon, authenticated;

notify pgrst, 'reload schema';
