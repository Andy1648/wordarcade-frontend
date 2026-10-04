-- 017_board_reality.sql — BOARD MUST MATCH REALITY (Andy oct3 13:01).
--
-- CAUSE (verified on prod): NoBuffCookies' row is LV12 R7. Andy's in-game RESET ALL PROGRESS wiped only the
-- browser (014 lb_self_reset was not live, so the client took the local-only fallback), his local rebirths
-- dropped below 7, and every submit since hit lb_submit2's monotone check
--     if rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters then return;
-- and was silently dropped — the row froze at LV12 R7 while he played to LV175.
--
-- FIX:
--  (a) A LOWER submit is a RESET, not a rejection. Lowering numbers can never help a cheater climb. When the
--      submitted rebirths < stored, OR words < stored, OR letters < stored, OR (level < stored AND the same
--      rebirth count), the submit is accepted as a NEW BASELINE: values lower than stored are written as
--      submitted (no clamp), the weekly counter does not count that submit, submitted_at = now().
--      Increases stay rate-checked exactly as 011/013/015 (words 20/s, letters 150/s → rejected; rebirths
--      +1 max; level +0.5/s banking ≤ 20 min, counted from 1 after a rebirth), and 016's p_econ = 10 gate
--      stays on lb_submit3.
--      MIXED CASE (a reset that also went UP — rebirths 7 → 0 but level 12 → 175): the level is capped at
--      max(stored level, 1 + allowance), i.e. 015's clamp COUNTED FROM 1 (a reset restarts the climb at 1),
--      never forced below what the row already showed (keeping a level that was already on the board is not
--      a climb; the lowered rebirths/words already drop the row). So "reset, then climb fast inside one
--      submit window" cannot jump past the clamp. Rebirths rise ≤ 1; words/letters that went UP in a reset
--      are capped at the rate limit instead of rejecting the submit.
--  (b) public.profiles.econ smallint (default 0). lb_submit3 sets econ = 10. Both board views expose it; the
--      client renders wins/word as "—" when econ < 10 (a row that has not submitted on PV10 — e.g. XAVI's
--      stale 1e9 — never shows a stale or capped number; it recomputes on that player's next v10 submit).
--      lb_caps reports board_econ: true so the client only selects `econ` once this file has run.
--  (c) NO one-off UPDATE for Andy's row is needed: his next submit (one menu load) has rebirths 0 < 7, so it
--      becomes a baseline at his real level (his last ACCEPTED submit is hours old → the 600-level bank).
--
-- KEEP IN SYNC WITH src/leaderboard/submitRules.js (decideSubmit) — the same branches, order and constants;
-- src/leaderboard/submitRules.test.js pins both.
--
-- DEPENDENCIES: needs 001 (profiles, private.profile_for_secret), 005 (lifetime_letters), 011 (uncapped
-- columns) and 013 (week_key / week_words). Does NOT need 014 / 015 / 016:
--   * the write rule (incl. 015's level clamp) lives in private.lb_board_write below, used by both entry points;
--   * lb_submit2 checks AT RUN TIME whether 016 is in (lb_save2 exists): if so it stays 016's no-op for old
--     bundles; if not it writes with the rule above (so it fixes Andy's row even before 016);
--   * lb_caps reports econ: 10 only when 016's lb_save2 / lb_load2 exist.
--
-- ORDER (Andy): run each file on its own, in the project oajvvwptwifspmwiohlt: 014 → 015 → 016 → 017, read the
-- output of each, then `notify pgrst, 'reload schema';`. Run 017 LAST: if 011, 013, 015 or 016 is ever
-- re-run later, re-run 017 after it (they redefine lb_submit2 / lb_submit3 / lb_caps without the reset rule).
-- If 016 is NOT run, every row shows "—" wins/word (nobody submits through lb_submit3 yet) — run 016.
-- WRITE-ONLY: Claude never runs migrations. Safe to re-run (if not exists / create or replace).

-- ---- (b) the econ column --------------------------------------------------------------------------------
alter table public.profiles add column if not exists econ smallint not null default 0;

-- ---- (a) the one write rule, shared by lb_submit2 and lb_submit3 -----------------------------------------
-- Not callable by anon/authenticated (private schema, execute revoked); the SECURITY DEFINER entry points run
-- it as their owner. p_econ = the value stored in profiles.econ on write, or null to leave it unchanged.
create or replace function private.lb_board_write(p_secret text, p_level integer, p_rebirths integer,
                                                  p_lifetime_words bigint, p_lifetime_letters bigint,
                                                  p_wins_per_word numeric, p_econ smallint)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv integer; max_rise bigint;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, coalesce(p_level, 1));
  rb := greatest(0, coalesce(p_rebirths, 0));
  w := greatest(0, coalesce(p_lifetime_words, 0));
  l := greatest(0, coalesce(p_lifetime_letters, 0));
  delta := 0; -- 013: the first submit is a baseline only
  if old.submitted_at is not null then
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    -- 015: the level may rise by ≤ 0.5 a second since the last accepted submit, banking ≤ 20 min (600 levels)
    max_rise := greatest(1, floor(least(secs, 1200) * 0.5)::bigint);
    if rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
       or (lv < old.level and rb = old.rebirths) then
      -- 017 RESET → a new baseline. Lower values land as submitted; anything that went UP is bounded:
      -- level by the clamp counted from 1 (never below the stored level), rebirths +1, words/letters by rate.
      lv := least(lv::bigint, greatest(old.level::bigint, 1 + max_rise))::integer;
      rb := least(rb, old.rebirths + 1);
      w := least(w, old.lifetime_words + floor(20 * secs)::bigint);
      l := least(l, old.lifetime_letters + floor(150 * secs)::bigint);
      -- delta stays 0: a reset counts no weekly words
    else
      -- INCREASE: rate-checked exactly as 011/013/015
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
      -- 015: rebirths rise at most 1 per accepted submit; a rebirth restarts the level count at 1
      rb := least(rb, old.rebirths + 1);
      base_lv := case when rb > old.rebirths then 1 else old.level end;
      lv := least(lv::bigint, base_lv::bigint + max_rise)::integer;
      -- 013: the words typed since the last accepted submit
      delta := greatest(0, w - coalesce(old.lifetime_words, 0));
    end if;
  end if;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = coalesce(p_econ, econ),
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function private.lb_board_write(text, integer, integer, bigint, bigint, numeric, smallint) from public;
revoke all on function private.lb_board_write(text, integer, integer, bigint, bigint, numeric, smallint) from anon, authenticated;

-- ---- lb_submit3 (016's v10 path): p_econ = 10 gate + the rule above; marks the row econ = 10 -------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if p_econ is distinct from 10 then raise exception 'old_client'; end if;
  perform private.lb_board_write(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                 p_wins_per_word, (10)::smallint); -- econ = 10
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- lb_submit2: 016's no-op once 016 is in; before 016, the writer (with the reset rule) ----------------
-- It never touches econ: an old-bundle / pre-016 submit cannot mark a row as v10.
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if to_regprocedure('public.lb_save2(text,text,numeric,integer)') is not null then
    return; -- 016 is in: pre-v10 bundles may not write the board (lb_submit3 is the v10 path)
  end if;
  perform private.lb_board_write(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                 p_wins_per_word, null);
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

-- ---- (b) the views: 011's leaderboard and 013's leaderboard_weekly, + econ (same columns, order, grants) ---
-- BOARD = REBIRTHS FIRST, THEN LEVEL (Andy ran this order on prod oct3 19:55; supersedes oct2's level-only):
-- rebirths desc, level desc, lifetime_words desc, created_at asc. Every migration from 017 on that (re)builds
-- public.leaderboard MUST carry this order, so a re-run never reverts it. KEEP IN SYNC WITH
-- src/leaderboard/client.js (ranksAhead / serverRankFor) and e2e/support/boardMock.js.
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by rebirths desc, level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word, econ
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

-- THIS WEEK's board (013): only rows that typed this ET week. Most words first; then level; first-come.
drop view if exists public.leaderboard_weekly;
create view public.leaderboard_weekly with (security_invoker = true) as
  select row_number() over (order by week_words desc, level desc, created_at asc) as rank,
         id, username, level, rebirths, week_words, econ
    from public.profiles
   where week_key = (date_trunc('week', now() at time zone 'America/New_York'))::date and week_words > 0;
grant select on public.leaderboard_weekly to anon, authenticated;

-- ---- feature detection: 013's caps + board_econ; econ: 10 only when 016's functions exist -----------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select (jsonb_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true)
          || case when to_regprocedure('public.lb_save2(text,text,numeric,integer)') is not null
                   and to_regprocedure('public.lb_load2(text,integer)') is not null
                  then jsonb_build_object('econ', 10) else '{}'::jsonb end)::json
$$;
grant execute on function public.lb_caps() to anon, authenticated;
