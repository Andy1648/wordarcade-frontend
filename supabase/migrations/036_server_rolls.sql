-- 036_server_rolls.sql — SERVER-CHECKED GEAR ROLLS (Andy oct12: "this rolling function can at least be checked with
-- server"). Until now a roll was decided in the browser and nothing on the server knew who owned what, so anyone with
-- devtools could hand themselves an ORIGIN and the profile card showed it. From this file on:
--
--   * THE SERVER PICKS. public.lb_roll(secret, luck, n) runs the same odds table as markRolls.js rollTable (the pool
--     below, 1 / x weights × luck, the RARE floor, the EPIC+ pity on roll 10 and the LEGENDARY+ pity on roll 50 of a
--     drought, the ×2 bonus every 10th roll, a flat 1.5% SHINY) with ITS OWN roll / pity counters, and returns the
--     result(s) as a RESERVATION. The client asks when the HOLD starts, so the answer is there before the release.
--     `luck` comes from the browser (it depends on the save) but is clamped to LUCK_CAP — the most a legit save has.
--   * public.lb_roll_claim(secret, seq) commits it on release: ownership (private.gear_owned), the counters, the spend.
--     A cancelled hold leaves the reservation; the next lb_roll returns the SAME one (no re-rolling for a better pick).
--   * THE GEM BUDGET. The server cannot see the gem wallet (it lives in the browser), so it caps what an account can
--     ever spend on rolls at the most it could have EARNED (private.gem_budget): rebirth gems (25 × R each, server-
--     checked rebirths), game words (generous per-word drop + game pay, gem gear included), daily drops by account
--     age, every achievement, gem codes, weekly prizes, the dupe refunds the server itself paid, start + gifts — × 1.5
--     slack. A legit player never meets it; a hand-edited wallet runs into it.
--   * THE SHOWCASE ONLY SHOWS REAL GEARS. lb_showcase_set keeps a rolled gear only if the server owns it for that
--     player. AUDIT, THEN GRANDFATHER (Andy oct12): a gear the server has no record of is accepted ONCE — and recorded
--     as 'grandfather' — only for an account created before ROLL_CUTOFF whose gem budget could plausibly have rolled it
--     (≥ 1% chance at a generous luck); otherwise it is shown as empty and flagged (private.cheat_flags 'gear').
--   * public.lb_gears(secret) returns what the server owns for the caller + any gear the audit refused, so the
--     browser can drop a refused gear from its own save.
--
-- ORDER: after 031 (showcase), 032 (cheat_flags), 034 (weekly prizes — the budget reads them), 035. Then
-- notify pgrst, 'reload schema';  The client falls back to the old local roll until this file runs (lb_roll 404).
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- the pool (= markRolls.js ROLL_MARKS: id, tier, 1-in-x; serverRolls.test.js pins every row) -----------------------
create table if not exists private.gear_pool (mark_id text primary key, tier text not null, x double precision not null, ord integer not null);
revoke all on private.gear_pool from public;
revoke all on private.gear_pool from anon, authenticated;
truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 12.171743297933846, 1),
  ('mk-cyclone', 'rare', 12.171743297933846, 2),
  ('mk-scholar', 'rare', 12.171743297933846, 3),
  ('mk-ouroboros', 'rare', 12.171743297933846, 4),
  ('mk-tinder', 'rare', 12.171743297933846, 5),
  ('mk-slipstream', 'rare', 12.171743297933846, 6),
  ('mk-smith', 'rare', 12.171743297933846, 7),
  ('mk-phoenix', 'rare', 12.171743297933846, 8),
  ('mk-metronome', 'rare', 12.171743297933846, 9),
  ('mk-hotwire', 'rare', 12.171743297933846, 10),
  ('mk-grapple', 'rare', 12.171743297933846, 11),
  ('mk-sparkplug', 'rare', 12.171743297933846, 12),
  ('mk-pyro', 'epic', 700, 13),
  ('mk-nova', 'epic', 700, 14),
  ('mk-golem', 'epic', 700, 15),
  ('mk-brainstorm', 'epic', 700, 16),
  ('mk-flashpoint', 'epic', 700, 17),
  ('mk-voltage', 'epic', 700, 18),
  ('mk-talisman', 'epic', 700, 19),
  ('mk-leviathan', 'legendary', 1250, 20),
  ('mk-eclipse', 'legendary', 1250, 21),
  ('mk-headmaster', 'legendary', 1250, 22),
  ('mk-thunderclap', 'legendary', 1250, 23),
  ('mk-jackpot', 'legendary', 1250, 24),
  ('mk-singularity', 'mythic', 30000, 25),
  ('mk-kraken', 'mythic', 30000, 26),
  ('mk-hydra', 'mythic', 30000, 27),
  ('mk-origin', 'secret', 100000, 28);

create or replace function private.tier_rank(t text) returns integer language sql immutable as $$
  select case t when 'rare' then 0 when 'epic' then 1 when 'legendary' then 2 when 'mythic' then 3 when 'secret' then 4 else -1 end;
$$;

-- ---- what the server knows a player owns, and every roll it made -------------------------------------------------------
create table if not exists private.gear_owned (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mark_id text not null,
  copies integer not null default 1,
  shiny boolean not null default false,
  source text not null default 'roll' check (source in ('roll', 'grandfather')),
  first_at timestamptz not null default now(),
  primary key (profile_id, mark_id)
);
revoke all on private.gear_owned from public;
revoke all on private.gear_owned from anon, authenticated;

create table if not exists private.roll_log (
  id bigserial primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seq integer not null,
  idx integer not null default 0,
  mark_id text not null,
  tier text not null,
  shiny boolean not null default false,
  luck double precision not null,
  forced text,
  bonus boolean not null default false,
  state text not null default 'reserved' check (state in ('reserved', 'claimed')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (profile_id, seq, idx)
);
create index if not exists roll_log_profile_idx on private.roll_log (profile_id, state, seq);
revoke all on private.roll_log from public;
revoke all on private.roll_log from anon, authenticated;

-- a gear the audit refused (the browser drops it from its save via lb_gears)
create table if not exists private.gear_refused (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mark_id text not null,
  at timestamptz not null default now(),
  primary key (profile_id, mark_id)
);
revoke all on private.gear_refused from public;
revoke all on private.gear_refused from anon, authenticated;

alter table public.profiles add column if not exists s2_roll_seq integer not null default 0;     -- last CLAIMED seq
alter table public.profiles add column if not exists s2_rolls integer not null default 0;        -- server rolls made
alter table public.profiles add column if not exists s2_since_epic integer not null default 0;
alter table public.profiles add column if not exists s2_since_leg integer not null default 0;
alter table public.profiles add column if not exists s2_roll_spent bigint not null default 0;    -- gems the server rolls cost

-- 032's flag log learns a third reason: a showcased gear the audit refused
alter table private.cheat_flags drop constraint if exists cheat_flags_reason_check;
alter table private.cheat_flags add constraint cheat_flags_reason_check check (reason in ('rejected', 'clamped', 'gear'));

-- ---- the gem budget: the most this account could ever have EARNED --------------------------------------------------
create or replace function private.gem_budget(p_pid uuid)
returns bigint language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; r bigint; days numeric; codes bigint := 0; weekly bigint := 0; dupes bigint := 0;
        REBIRTH_GEMS_PER_R constant integer := 25;   -- v3/econ.js
        PER_WORD constant integer := 40;             -- drop 1/10 × ≤12 + game pay, × the +800% gem gear — generous
        DAILY_MAX constant integer := 150;           -- dailyDrop.js best tier
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
  return floor(SLACK * (REBIRTH_GEMS_PER_R * r * (r + 1) / 2 + PER_WORD * greatest(0, coalesce(p.lifetime_words, 0))
                        + DAILY_MAX * days + ACH_TOTAL + START_AND_GIFTS + codes + weekly + dupes))::bigint;
end $$;
revoke all on function private.gem_budget(uuid) from public;
revoke all on function private.gem_budget(uuid) from anon, authenticated;

-- ---- ONE pick: markRolls.js rollTable + roll, on the server's counters -----------------------------------------------
create or replace function private.pick_gear(p_luck double precision, p_since_epic integer, p_since_leg integer)
returns table (mark_id text, tier text, forced text)
language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare EPIC_PITY constant integer := 10; LEG_PITY constant integer := 50;
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

-- ---- lb_roll: reserve n picks (or hand back the open reservation) -----------------------------------------------------
create or replace function public.lb_roll(p_secret text, p_luck double precision, p_n integer default 1)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; v_seq integer; n integer; i integer; L double precision; bonus boolean;
        se integer; sl integer; rolls integer; pk record; sh boolean; budget bigint; recent integer; out jsonb := '[]'::jsonb;
        LUCK_CAP constant double precision := 15;   -- the most a legit save reaches (every pip, perm, milestone, boost, unlock)
        ROLL_PRICE constant integer := 75;          -- v3/econ.js ROLL_PRICE
        SHINY constant double precision := 0.015;   -- markRollsCore.js SHINY_CHANCE
        BONUS_EVERY constant integer := 10;         -- markRolls.js BONUS_ROLL_EVERY (×2 luck)
        RATE_PER_SEC constant integer := 3;
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
  if recent >= RATE_PER_SEC then return json_build_object('ok', false, 'reason', 'rate'); end if;
  budget := private.gem_budget(pid);
  if p.s2_roll_spent + ROLL_PRICE > budget then
    return json_build_object('ok', false, 'reason', 'budget', 'budget', budget, 'spent', p.s2_roll_spent);
  end if;
  n := least(2, greatest(1, coalesce(p_n, 1)));        -- SINGULARITY's double roll: one price, two picks
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

-- ---- lb_roll_claim: the release — ownership, counters, spend ---------------------------------------------------------
create or replace function public.lb_roll_claim(p_secret text, p_seq integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; l record; se integer; sl integer; rolls integer; k integer := 0;
        ROLL_PRICE constant integer := 75;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into p from public.profiles where id = pid for update;
  if p_seq is null or p_seq <> p.s2_roll_seq + 1 then
    -- already claimed (a retry) → ok; anything else → nothing to claim
    return json_build_object('ok', p_seq is not null and p_seq <= p.s2_roll_seq, 'reason', 'seq', 'seq', p.s2_roll_seq);
  end if;
  se := p.s2_since_epic; sl := p.s2_since_leg; rolls := p.s2_rolls;
  for l in select * from private.roll_log where profile_id = pid and seq = p_seq and state = 'reserved' order by idx loop
    insert into private.gear_owned as o (profile_id, mark_id, copies, shiny, source)
    values (pid, l.mark_id, 1, l.shiny, 'roll')
    on conflict (profile_id, mark_id) do update set copies = o.copies + 1, shiny = o.shiny or excluded.shiny;
    se := case when private.tier_rank(l.tier) >= 1 then 0 else se + 1 end;
    sl := case when private.tier_rank(l.tier) >= 2 then 0 else sl + 1 end;
    rolls := rolls + 1;
    k := k + 1;
  end loop;
  if k = 0 then return json_build_object('ok', false, 'reason', 'seq', 'seq', p.s2_roll_seq); end if;
  update private.roll_log set state = 'claimed', claimed_at = now() where profile_id = pid and seq = p_seq;
  update public.profiles set s2_roll_seq = p_seq, s2_rolls = rolls, s2_since_epic = se, s2_since_leg = sl,
         s2_roll_spent = s2_roll_spent + ROLL_PRICE where id = pid;
  return json_build_object('ok', true, 'seq', p_seq);
end $$;
revoke all on function public.lb_roll_claim(text, integer) from public;
grant execute on function public.lb_roll_claim(text, integer) to anon, authenticated;

-- ---- the audit: could this account plausibly have rolled `mark`? -----------------------------------------------------
-- RARE / EPIC / LEGENDARY: always (cheap, common). MYTHIC / SECRET: the rolls its gem budget buys, at a GENEROUS luck,
-- must give ≥ 1% chance of that exact gear. Not proof either way — a filter on the impossible.
create or replace function private.gear_plausible(p_pid uuid, p_mark text)
returns boolean language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare g private.gear_pool; rolls numeric;
        AUDIT_LUCK constant numeric := 4; ROLL_PRICE constant integer := 75; MIN_CHANCE constant numeric := 0.01;
begin
  select * into g from private.gear_pool where mark_id = p_mark;
  if not found then return true; end if;                 -- not a rollable gear (a PERMANENT / legacy mark)
  if private.tier_rank(g.tier) <= 2 then return true; end if;
  rolls := private.gem_budget(p_pid) / 1.5 / ROLL_PRICE; -- the budget WITHOUT its slack
  return 1 - power(1 - least(1, AUDIT_LUCK / g.x), rolls) >= MIN_CHANCE;
end $$;
revoke all on function private.gear_plausible(uuid, text) from public;
revoke all on function private.gear_plausible(uuid, text) from anon, authenticated;

-- a showcased gear: owned by the server, or (once) grandfathered by the audit for an old account, else refused
create or replace function private.gear_check(p_pid uuid, p_mark text)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created timestamptz;
        ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00'; -- accounts made after this roll on the server only
begin
  if p_mark is null then return null; end if;
  if not exists (select 1 from private.gear_pool where mark_id = p_mark) then return p_mark; end if; -- PERMANENT / legacy
  if exists (select 1 from private.gear_owned where profile_id = p_pid and mark_id = p_mark) then return p_mark; end if;
  if exists (select 1 from private.gear_refused where profile_id = p_pid and mark_id = p_mark) then return null; end if;
  select created_at into created from public.profiles where id = p_pid;
  if created < ROLL_CUTOFF and private.gear_plausible(p_pid, p_mark) then
    insert into private.gear_owned (profile_id, mark_id, source) values (p_pid, p_mark, 'grandfather') on conflict do nothing;
    return p_mark;
  end if;
  insert into private.gear_refused (profile_id, mark_id) values (p_pid, p_mark) on conflict do nothing;
  begin
    insert into private.cheat_flags (profile_id, reason, detail)
    values (p_pid, 'gear', jsonb_build_object('mark', p_mark, 'budget', private.gem_budget(p_pid)));
  exception when others then null; end;
  return null;
end $$;
revoke all on function private.gear_check(uuid, text) from public;
revoke all on function private.gear_check(uuid, text) from anon, authenticated;

-- ---- 031's lb_showcase_set + the gear check ----------------------------------------------------------------------------
create or replace function public.lb_showcase_set(p_secret text, p_show jsonb)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g1 text; g2 text; bw numeric; wpw double precision; gf integer; gt integer; pw integer;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  if p_show is null or jsonb_typeof(p_show) <> 'object' or length(p_show::text) > 2000 then
    return json_build_object('error', 'bad_show');
  end if;
  g1 := p_show->>'gear1'; if g1 is not null and g1 !~ '^mk-[a-z0-9-]{1,24}$' then g1 := null; end if;
  g2 := p_show->>'gear2'; if g2 is not null and g2 !~ '^mk-[a-z0-9-]{1,24}$' then g2 := null; end if;
  g1 := private.gear_check(pid, g1); -- 036: only gears the server knows (or the audit grandfathered)
  g2 := private.gear_check(pid, g2);
  begin bw := (p_show->>'base_wins')::numeric; exception when others then bw := null; end;
  if bw is not null and (bw < 0 or bw > 1e12) then bw := null; end if;
  begin wpw := (p_show->>'wins_per_word')::double precision; exception when others then wpw := null; end;
  if wpw is not null and (wpw < 0 or wpw > 1e300 or wpw = 'NaN'::double precision) then wpw := null; end if;
  begin gf := (p_show->>'gears_found')::integer; exception when others then gf := null; end;
  if gf is not null and (gf < 0 or gf > 500) then gf := null; end if;
  begin gt := (p_show->>'gears_total')::integer; exception when others then gt := null; end;
  if gt is not null and (gt < 0 or gt > 500) then gt := null; end if;
  begin pw := (p_show->>'power')::integer; exception when others then pw := null; end;
  if pw is not null and (pw < 0 or pw > 1000) then pw := null; end if;
  insert into public.profile_showcase as s (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, updated_at)
  values (pid, g1, g2, bw, wpw, gf, gt, pw, now())
  on conflict (profile_id) do update set
    gear1 = excluded.gear1, gear2 = excluded.gear2, base_wins = excluded.base_wins, wins_per_word = excluded.wins_per_word,
    gears_found = excluded.gears_found, gears_total = excluded.gears_total, power = excluded.power, updated_at = now()
  where s.updated_at < now() - interval '20 seconds';
  return json_build_object('ok', true);
end $$;
revoke all on function public.lb_showcase_set(text, jsonb) from public;
grant execute on function public.lb_showcase_set(text, jsonb) to anon, authenticated;

-- ---- lb_gears: what the server owns for me + what the audit refused (the browser drops those) --------------------------
create or replace function public.lb_gears(p_secret text)
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('owned', '[]'::json, 'refused', '[]'::json); end if;
  return json_build_object(
    'owned', (select coalesce(json_agg(json_build_object('mark', mark_id, 'copies', copies, 'shiny', shiny, 'source', source)), '[]'::json)
                from private.gear_owned where profile_id = pid),
    'refused', (select coalesce(json_agg(mark_id), '[]'::json) from private.gear_refused where profile_id = pid));
end $$;
revoke all on function public.lb_gears(text) from public;
grant execute on function public.lb_gears(text) to anon, authenticated;

-- ---- the ONE-TIME AUDIT of what is on show today: every showcased gear goes through the check now --------------------
do $$
declare s record;
begin
  for s in select profile_id, gear1, gear2 from public.profile_showcase loop
    update public.profile_showcase
       set gear1 = private.gear_check(s.profile_id, s.gear1), gear2 = private.gear_check(s.profile_id, s.gear2)
     where profile_id = s.profile_id;
  end loop;
end $$;

-- REVIEW (SQL editor): what the audit refused, and why
--   select p.username, r.mark_id, private.gem_budget(p.id) as budget from private.gear_refused r join public.profiles p on p.id = r.profile_id;
-- OVERRIDE a refusal (you decide it was real):
--   delete from private.gear_refused where profile_id = (select id from public.profiles where lower(username) = 'name') and mark_id = 'mk-origin';
--   insert into private.gear_owned (profile_id, mark_id, source) select id, 'mk-origin', 'grandfather' from public.profiles where lower(username) = 'name';

notify pgrst, 'reload schema';
