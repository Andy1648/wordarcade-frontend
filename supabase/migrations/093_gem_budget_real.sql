-- 093_gem_budget_real.sql - the gem budget counts what a rebirth REALLY pays.
--
-- WHY: the gem wallet lives in the browser, so the server caps what an account can ever SPEND on server rolls and shop
-- tickets at private.gem_budget (036 / 089) - the most it could have earned. Its rebirth term still paid 25 x R for every
-- rebirth (R110 = 25 x 110 x 111 / 2 = 152,625 gems, x 1.5 slack), but since nov5 a rebirth pays at most 100 + a 100-gem
-- JACKPOT every 5th (v3/econ.js REBIRTH_GEMS_CAP / JACKPOT_GEMS). So every fake rebirth bought up to 165 more gems of
-- server rolls - R110 made from 384 words was worth ~230,000 gems of budget.
--
-- WHAT CHANGES (089's body, one term): rebirth gems = 25 x r for r = 1..3, then 100 a rebirth, + 150 a jackpot (R5, R10
-- ...; 150 = the old jackpot, generous). R110 -> ~13,000 instead of 152,625. Every other term is unchanged (250 a game
-- word, 3,150 a day, achievements, codes, weekly prizes, dupe refunds, paid gems, x 1.5).
-- NO HARM TO A REAL PLAYER: measured on the live board nov21, the most any honest row has spent is 40% of this NEW budget
-- (most are under 15%); over budget a roll still happens, locally, as it always did (036).
-- ORDER: after 089 (any time after 091). RE-RUNNABLE. ASCII only. WRITE-ONLY: Claude never runs migrations.
-- HOW: Supabase -> SQL editor -> paste the WHOLE file -> Run.

create or replace function private.rebirth_gems_total(p_r bigint)
returns bigint language sql immutable as $$
  select case when greatest(0, coalesce(p_r, 0)) <= 3 then 25 * greatest(0, coalesce(p_r, 0)) * (greatest(0, coalesce(p_r, 0)) + 1) / 2
              else 150 + 100 * (p_r - 3) end
         + 150 * (greatest(0, coalesce(p_r, 0)) / 5)
$$;
revoke all on function private.rebirth_gems_total(bigint) from public;
revoke all on function private.rebirth_gems_total(bigint) from anon, authenticated;

create or replace function private.gem_budget(p_pid uuid)
returns bigint language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; r bigint; days numeric; codes bigint := 0; weekly bigint := 0; dupes bigint := 0; paid bigint := 0;
        PER_WORD constant integer := 250;            -- drops + an 8-player winner's pot every ~10 words, x the +800% gem gear - never short for a real player
        DAILY_MAX constant integer := 3150;          -- the best daily drop (150) + WORD RACE speed gems (not in lifetime_words): 75 races x 40 a day
        ACH_TOTAL constant integer := 4130;          -- every v3 achievement tier (achievements.js)
        START_AND_GIFTS constant integer := 2000;    -- the starter grant + patch-note gifts
        SLACK constant numeric := 1.5;
begin
  select * into p from public.profiles where id = p_pid;
  if not found then return 0; end if;
  r := greatest(0, coalesce(p.rebirths, 0));
  days := greatest(1, ceil(extract(epoch from (now() - coalesce(p.created_at, now()))) / 86400.0) + 1);
  begin
    select coalesce(sum(c.gems), 0) into codes from private.redeem_claims rc join public.redeem_codes c on c.code = rc.code
     where rc.player = extensions.digest('taw-rc:p:' || p_pid::text, 'sha256') and c.kind = 'gems';
  exception when others then codes := 0; end;
  begin
    select coalesce(sum(gems), 0) into weekly from private.s2_week_prizes where profile_id = p_pid;
  exception when others then weekly := 0; end;
  select coalesce(sum(case l.tier when 'rare' then 5 when 'epic' then 25 when 'legendary' then 100 when 'mythic' then 500 when 'secret' then 2500 else 0 end), 0)
    into dupes
    from private.roll_log l
   where l.profile_id = p_pid and l.state = 'claimed'
     and exists (select 1 from private.roll_log e where e.profile_id = p_pid and e.mark_id = l.mark_id and e.state = 'claimed' and e.id < l.id);
  -- 082 / 089: the paid gems, net of refunds / disputes, never x SLACK and not floored at 0
  begin
    select coalesce(sum(delta), 0) into paid from private.pay_gem_ledger where profile_id = p_pid;
  exception when others then paid := 0; end;
  return floor(SLACK * (private.rebirth_gems_total(r) + PER_WORD * greatest(0, coalesce(p.lifetime_words, 0))
                        + DAILY_MAX * days + ACH_TOTAL + START_AND_GIFTS + codes + weekly + dupes))::bigint
         + paid;
end $$;
revoke all on function private.gem_budget(uuid) from public;
revoke all on function private.gem_budget(uuid) from anon, authenticated;

notify pgrst, 'reload schema';
