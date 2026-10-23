-- 063_legendary_harder.sql - LEGENDARY A BIT HARDER (Andy oct22 "make legendary a bit harder to get").
--   * LEGENDARY tier odds 1 in 100 -> 1 in 130 (each of the 12 LEGENDARIES 1 in 1560). EPIC / MYTHIC / SECRET unchanged;
--     RARE (the floor) takes the remainder, so its rows move a hair.
--   * LEGENDARY+ hard pity 50 -> 60 rolls (private.pick_gear, below = 036's body with LEG_PITY 60). At 1 in 100 the pity
--     handed out ~half of all LEGENDARIES, so the odds alone moved a fresh save only ~3%; together ~20-30% (PR sim).
-- The guaranteed-roll tickets (060 pick_ticket_gear) and the luck cap (061 luck_cap) read gear_pool / luck only, so they
-- follow automatically; lb_roll is untouched. A drought already past 59 rolls is capped one short by the browser (normalize).
-- ORDER: run THIS SQL first, then merge the PR (the browser's odds + pity counter then match). serverRolls.test pins it.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run. ASCII only.
-- UNDO: re-run 059_gear_expansion.sql and 036's pick_gear (LEG_PITY 50).

truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 16.409004967405508, 1),
  ('mk-cyclone', 'rare', 16.409004967405508, 2),
  ('mk-scholar', 'rare', 16.409004967405508, 3),
  ('mk-ouroboros', 'rare', 16.409004967405508, 4),
  ('mk-tinder', 'rare', 16.409004967405508, 5),
  ('mk-slipstream', 'rare', 16.409004967405508, 6),
  ('mk-smith', 'rare', 16.409004967405508, 7),
  ('mk-phoenix', 'rare', 16.409004967405508, 8),
  ('mk-metronome', 'rare', 16.409004967405508, 9),
  ('mk-hotwire', 'rare', 16.409004967405508, 10),
  ('mk-grapple', 'rare', 16.409004967405508, 11),
  ('mk-sparkplug', 'rare', 16.409004967405508, 12),
  ('mk-highlighter', 'rare', 16.409004967405508, 13),
  ('mk-flashcards', 'rare', 16.409004967405508, 14),
  ('mk-firecracker', 'rare', 16.409004967405508, 15),
  ('mk-gumball', 'rare', 16.409004967405508, 16),
  ('mk-pyro', 'epic', 720, 17),
  ('mk-nova', 'epic', 720, 18),
  ('mk-golem', 'epic', 720, 19),
  ('mk-brainstorm', 'epic', 720, 20),
  ('mk-flashpoint', 'epic', 720, 21),
  ('mk-voltage', 'epic', 720, 22),
  ('mk-talisman', 'epic', 720, 23),
  ('mk-lavalamp', 'epic', 720, 24),
  ('mk-alarmclock', 'epic', 720, 25),
  ('mk-fortune', 'epic', 720, 26),
  ('mk-hoarder', 'epic', 720, 27),
  ('mk-domino', 'epic', 720, 28),
  ('mk-leviathan', 'legendary', 1560, 29),
  ('mk-eclipse', 'legendary', 1560, 30),
  ('mk-headmaster', 'legendary', 1560, 31),
  ('mk-thunderclap', 'legendary', 1560, 32),
  ('mk-jackpot', 'legendary', 1560, 33),
  ('mk-monsoon', 'legendary', 1560, 34),
  ('mk-inferno', 'legendary', 1560, 35),
  ('mk-mainframe', 'legendary', 1560, 36),
  ('mk-shamrock', 'legendary', 1560, 37),
  ('mk-longshot', 'legendary', 1560, 38),
  ('mk-hothand', 'legendary', 1560, 39),
  ('mk-arcadestick', 'legendary', 1560, 40),
  ('mk-singularity', 'mythic', 12000, 41),
  ('mk-kraken', 'mythic', 12000, 42),
  ('mk-hydra', 'mythic', 12000, 43),
  ('mk-chronos', 'mythic', 12000, 44),
  ('mk-firebird', 'mythic', 12000, 45),
  ('mk-trident', 'mythic', 12000, 46),
  ('mk-origin', 'secret', 30000, 47),
  ('mk-paradox', 'secret', 30000, 48)
;

create or replace function private.pick_gear(p_luck double precision, p_since_epic integer, p_since_leg integer)
returns table (mark_id text, tier text, forced text)
language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare EPIC_PITY constant integer := 10; LEG_PITY constant integer := 60;
        f text := null; s double precision; top double precision; ew double precision; fw double precision;
        u double precision; acc double precision := 0; g record; last_id text; last_tier text; p double precision;
begin
  if p_since_epic + 1 >= EPIC_PITY then f := 'epic'; end if;
  if p_since_leg + 1 >= LEG_PITY then f := 'legendary'; end if;
  select coalesce(sum(p_luck / gp.x) filter (where gp.tier <> 'rare'), 0),
         coalesce(sum(p_luck / gp.x) filter (where private.tier_rank(gp.tier) >= 2), 0),
         coalesce(sum(p_luck / gp.x) filter (where gp.tier = 'epic'), 0),
         coalesce(sum(1 / gp.x) filter (where gp.tier = 'rare'), 0)
    into s, top, ew, fw from private.gear_pool gp;
  u := random();
  for g in select gp.mark_id, gp.tier, gp.x from private.gear_pool gp order by gp.ord loop
    if f = 'legendary' then
      p := case when private.tier_rank(g.tier) >= 2 then (p_luck / g.x) / top else 0 end;
    elsif f = 'epic' then
      p := case when private.tier_rank(g.tier) >= 2 then (case when top >= 1 then (p_luck / g.x) / top else p_luck / g.x end)
                when g.tier = 'epic' then (case when top >= 1 then 0 else (1 - top) * (p_luck / g.x) / ew end)
                else 0 end;
    elsif s >= 1 then
      p := case when g.tier = 'rare' then 0 else (p_luck / g.x) / s end;
    else
      p := case when g.tier = 'rare' then (1 - s) * (1 / g.x) / fw else p_luck / g.x end;
    end if;
    if p > 0 then
      last_id := g.mark_id; last_tier := g.tier;
      if u < acc + p then mark_id := g.mark_id; tier := g.tier; forced := f; return next; return; end if;
      acc := acc + p;
    end if;
  end loop;
  mark_id := last_id; tier := last_tier; forced := f; return next; -- float dust at the very end
end $$;
revoke all on function private.pick_gear(double precision, integer, integer) from public;
revoke all on function private.pick_gear(double precision, integer, integer) from anon, authenticated;


-- CHECK: select tier, count(*), sum(1 / x) from private.gear_pool group by tier order by min(ord);  -- LEGENDARY 0.00769
