-- 025_season2_convert.sql — THE SEASON 2 CONVERSION (Andy oct6: "NO RESET … players keep their progress … a one-time
-- CONVERSION when SEASON2 flips"). The SAME SQL as claude/run-season2-convert.sql (convert.test.js pins the two
-- identical, and the constants below against src/progress/v3/convert.js). REPLACES the cancelled reset (023 /
-- claude/run-season2.sql — deleted, never run).
--
-- ===== THE ORDER (Andy) ===========================================================================================
--   1. The client is deployed with SEASON2 still OFF (nothing changes for players).
--   2. In the Supabase SQL Editor run, in this order: 022_season2_board.sql, 024_season2_weekly.sql, then THIS WHOLE
--      FILE (claude/run-season2-convert.sql is the same text). It stops with a clear error if 022 / 024 are not in.
--   3. Run:  notify pgrst, 'reload schema';
--   4. Tell Claude "flip SEASON2" — the ONE line src/progress/season.js SEASON2_LIVE = true. Nothing before that.
--
-- ===== WHAT IT DOES (once) =========================================================================================
--   It touches ONLY two columns of public.profiles — rebirths and stars — and only on season-1 rows (econ ≠ 13):
--     rebirths = least(rebirths, 10)                                (the season-2 ascend point)
--     stars    = stars + floor(greatest(rebirths − 10, 0) / 10)     (1 ★ per 10 rebirths above R10: R100 → ★9,
--                                                                    R29 / R20 → ★1, R13 / R11 / R10 and below → 0)
--   Level, words, letters, wins/word, econ, names, timestamps — untouched (players KEEP their progress; POWER, wins,
--   gems, marks and achievements live only in the browser and the client converts them at the flip, v3/convert.js).
--   a. SNAPSHOT first: private.season2_convert holds every season-1 row's rebirths + stars BEFORE and AFTER (the
--      rollback, claude/rollback-season2-convert.sql, restores BEFORE from it). The table is locked against
--      concurrent writes for the few milliseconds the snapshot + update take, so no rebirth can slip between them.
--   b. CONVERT the rows whose numbers change.
--   c. The ONE-SHOT marker private.season2_convert_run (id 1). Re-running this file is a no-op (a notice says so).
--   Nothing is deleted. No gems, no gift. The rebirth log (021) is kept.
--
-- ===== THE NEW SURFACE =============================================================================================
--   * public.lb_season2_conv(p_secret) — the UPDATE card's numbers for MY row: { found, rebirths_before,
--     stars_before, rebirths, stars, seen } (found:false + ran:true/false when there is nothing to report). A season-1 row with no snapshot (a name claimed between this file and the
--     flip) is converted here by the SAME rule, once (its snapshot row is the guard). A season-2 row (econ 13) is never
--     converted. found:false before this file ran.
--   * public.lb_season2_seen(p_secret) — the card was shown: stamps seen_at (the server half of "shown once").
--   * lb_caps — 022's keys + season2_convert: true (the client's signal that the server half ran).
-- 022 is consistent with this: a season-1 row's FIRST season-2 write keeps the server's (converted) rebirths and the
-- kept level (022's switch branch — it never clamps a converted row to its words / 100).
-- WRITE-ONLY: Claude never runs migrations. Safe to re-run.

do $$
begin
  if to_regclass('public.leaderboard_s2') is null or to_regclass('public.leaderboard_s2_weekly') is null then
    raise exception '025 needs 022_season2_board.sql and 024_season2_weekly.sql — run them first, then this file';
  end if;
end $$;

-- ---- the snapshot + the one-shot marker (private: no anon / authenticated access) ---------------------------------
create table if not exists private.season2_convert (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  rebirths_before integer not null,
  stars_before    integer not null,
  rebirths_after  integer not null,
  stars_after     integer not null,
  converted_at    timestamptz not null default now(),
  seen_at         timestamptz
);
create table if not exists private.season2_convert_run (
  id             smallint primary key default 1 check (id = 1),
  ran_at         timestamptz not null default now(),
  rows_snapshot  integer not null default 0,
  rows_converted integer not null default 0
);
revoke all on table private.season2_convert from public;
revoke all on table private.season2_convert from anon, authenticated;
revoke all on table private.season2_convert_run from public;
revoke all on table private.season2_convert_run from anon, authenticated;

-- ---- THE RULE (one row) — KEEP IN SYNC WITH src/progress/v3/convert.js convertRow -----------------------------------
create or replace function private.season2_convert_one(pid uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare old public.profiles;
        C_ASCEND_AT constant integer := 10;        -- convert.js ASCEND_AT: rebirths kept up to R10
        C_STARS_PER_EXCESS constant integer := 10; -- convert.js RATES.STARS_PER_EXCESS: 1 ★ per 10 rebirths above R10
begin
  select * into old from public.profiles where id = pid for update;
  if not found or old.econ = 13 then return; end if; -- a season-2 row is never converted
  insert into private.season2_convert (profile_id, rebirths_before, stars_before, rebirths_after, stars_after)
  values (pid, greatest(coalesce(old.rebirths, 0), 0), greatest(coalesce(old.stars, 0), 0),
          least(greatest(coalesce(old.rebirths, 0), 0), C_ASCEND_AT),
          greatest(coalesce(old.stars, 0), 0) + greatest(coalesce(old.rebirths, 0) - C_ASCEND_AT, 0) / C_STARS_PER_EXCESS)
  on conflict (profile_id) do nothing;
  if not found then return; end if; -- converted before: one-shot per row
  update public.profiles p
     set rebirths = c.rebirths_after, stars = c.stars_after
    from private.season2_convert c
   where c.profile_id = pid and p.id = pid
     and (p.rebirths is distinct from c.rebirths_after or p.stars is distinct from c.stars_after);
end $$;
revoke all on function private.season2_convert_one(uuid) from public;
revoke all on function private.season2_convert_one(uuid) from anon, authenticated;

-- ---- THE ONE-SHOT RUN ---------------------------------------------------------------------------------------------
do $$
declare n_snap integer; n_conv integer;
        C_ASCEND_AT constant integer := 10;
        C_STARS_PER_EXCESS constant integer := 10;
begin
  if exists (select 1 from private.season2_convert_run) then
    raise notice '025: the season-2 conversion already ran — nothing changed';
    return;
  end if;
  lock table public.profiles in share row exclusive mode; -- reads go on; writes wait for these few ms
  -- a. SNAPSHOT (before + after) of every season-1 row
  insert into private.season2_convert (profile_id, rebirths_before, stars_before, rebirths_after, stars_after)
  select id, greatest(coalesce(rebirths, 0), 0), greatest(coalesce(stars, 0), 0),
         least(greatest(coalesce(rebirths, 0), 0), C_ASCEND_AT),
         greatest(coalesce(stars, 0), 0) + greatest(coalesce(rebirths, 0) - C_ASCEND_AT, 0) / C_STARS_PER_EXCESS
    from public.profiles
   where econ is distinct from 13
  on conflict (profile_id) do nothing;
  get diagnostics n_snap = row_count;
  -- b. CONVERT — rebirths + stars only, and only where they change
  update public.profiles p
     set rebirths = c.rebirths_after, stars = c.stars_after
    from private.season2_convert c
   where c.profile_id = p.id
     and (p.rebirths is distinct from c.rebirths_after or p.stars is distinct from c.stars_after);
  get diagnostics n_conv = row_count;
  -- c. the marker
  insert into private.season2_convert_run (id, rows_snapshot, rows_converted) values (1, n_snap, n_conv);
  raise notice '025: snapshot % season-1 rows, converted %', n_snap, n_conv;
end $$;

-- ---- lb_season2_conv: MY conversion (the UPDATE card) — converts a late season-1 row once, by the same rule ----------
create or replace function public.lb_season2_conv(p_secret text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; c private.season2_convert;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if not exists (select 1 from private.season2_convert_run) then
    return json_build_object('found', false, 'ran', false);
  end if;
  select * into c from private.season2_convert where profile_id = pid;
  if not found then
    perform private.season2_convert_one(pid);
    select * into c from private.season2_convert where profile_id = pid;
    if not found then return json_build_object('found', false, 'ran', true); end if; -- a season-2 row: nothing to convert
  end if;
  return json_build_object('found', true, 'rebirths_before', c.rebirths_before, 'stars_before', c.stars_before,
                           'rebirths', c.rebirths_after, 'stars', c.stars_after, 'seen', c.seen_at is not null);
end $$;
revoke all on function public.lb_season2_conv(text) from public;
grant execute on function public.lb_season2_conv(text) to anon, authenticated;

-- ---- lb_season2_seen: the card was shown (once) ---------------------------------------------------------------------
create or replace function public.lb_season2_seen(p_secret text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  update private.season2_convert set seen_at = coalesce(seen_at, now()) where profile_id = pid;
  return json_build_object('ok', found);
end $$;
revoke all on function public.lb_season2_seen(text) from public;
grant execute on function public.lb_season2_seen(text) to anon, authenticated;

-- ---- feature detection: 022's caps + season2_convert ---------------------------------------------------------------
-- SECURITY DEFINER now: it reads the private marker (anon cannot). Same keys and grant as 022's.
create or replace function public.lb_caps()
returns json language sql stable security definer set search_path = public, private, pg_temp as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 12,
                           'rebirth_rpc', true, 'season2', true, 'econ2', 13,
                           'season2_convert', exists (select 1 from private.season2_convert_run))
$$;
grant execute on function public.lb_caps() to anon, authenticated;
