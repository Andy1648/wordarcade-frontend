-- 018_rebirth_rush.sql — PROGRESSION FINAL "REBIRTH RUSH" (claude/econ-oct2/PROGRESSION-FINAL.md).
-- Replaces the never-run 018_econ_v11.sql (same slot; that file was renamed to this one before anyone ran it).
-- Andy's run notes: claude/econ-oct2/rr-migration-notes.md.
--
-- WHY: under Rebirth Rush a run goes LV1 → LV100–375 in minutes, a rebirth lands every ~2–12 min (~36 in 10 h),
-- and the one-time save conversion adds SEVERAL rebirths in one submit (snapplemelon R4 LV195 → R11 LV1). 017's
-- rule (private.lb_board_write) was built for the old slow curve and gets all three wrong:
--   * fast level climb — 015's clamp (+0.5 level/s, banking ≤ 600) holds an honest row BELOW its real level;
--   * rebirth — rebirths may rise only +1 per accepted submit, and the client submits only on menu load / board
--     open, so two rebirths between submits show as one (the row lags, then catches up one per submit);
--   * the conversion — +7 rebirths arrives as +1, and the row sits at R5 LV1, BELOW its old R4 LV195 neighbours'
--     order, until seven more submits land;
--   * huge wins_per_word — fine already: profiles.wins_per_word is plain numeric since 011 (no ceiling), the
--     write is round(…, 1). JSON numbers up to ~1.8e308 reach it intact (5^80 ≈ 8e55); a non-finite client value
--     arrives as JSON null and is written as 0.
--
-- WHAT THIS FILE DOES (all create-or-replace / if-not-exists: SAFE TO RE-RUN; NO existing row is changed):
--   * profiles.rb_clock timestamptz (new, nullable) — the rebirth token bucket's clock (below).
--   * private.lb_board_write_rr — 017's write rule with the REBIRTH RUSH rebirth/level rule (below). 017's
--     private.lb_board_write is left as it was (it is only reachable through 017's pre-016 lb_submit2 path).
--   * lb_submit3(…, p_econ) — gated on p_econ = 12 (10 and 11 → 'old_client'); writes through the rule above
--     and marks the row econ = 12.
--   * lb_save2 / lb_load2 — 016's bodies (throttle, never-lower score, reset_all), gated on p_econ = 12.
--   * lb_submit2 / lb_submit / lb_save — re-asserted as 016's no-ops (pre-v10 bundles may not write), so a later
--     re-run of 011/013/015 followed by this file still leaves them closed.
--   * public.leaderboard — rebuilt in the board order Andy runs on prod: rebirths desc, level desc,
--     lifetime_words desc, created_at asc (same columns/grants as 017). leaderboard_weekly is NOT touched.
--   * lb_caps reports econ: 12 (and board_econ: true, as 017).
--
-- WHICH CLIENTS: 12 ONLY. A stale v11 tab sends 11 (its econRpcArg caps at 11), a stale v10 tab sends 10 — both
-- are refused (board submit raises 'old_client', save returns saved:false/'old_client', load raises), so an old
-- curve can neither move a board row nor overwrite / restore a cloud save. The Rebirth Rush client sends 12 when
-- lb_caps says 12, 10 when it says 10 (016/017 only — so it works BEFORE this file runs), else the old RPCs.
--
-- ===== THE REBIRTH RUSH WRITE RULE (private.lb_board_write_rr) ==============================================
-- Unchanged from 017: the 5 s throttle; the first submit is a baseline as submitted; any LOWER number (rebirths,
-- words, letters, or level at the same rebirth count) is a RESET → new baseline (017(a)); words > 20/s or
-- letters > 150/s on an increase → rejected; 013's weekly counter.
-- NEW (replaces 015's "+1 rebirth per submit" and its level clamp):
--  REBIRTHS — a TOKEN BUCKET: one rebirth token accrues per 60 s of wall time, the bucket holds at most 60
--    (= one hour). profiles.rb_clock is the moment the bucket was empty (null = full). A submit may raise
--    rebirths by at most  conversion_bonus + floor(tokens); tokens actually spent move rb_clock forward by 60 s
--    each. Spamming submits does not mint rebirths (no free "+1 per submit"): the bucket only refills with time.
--    Honest play: the fastest runs are ~2 min early (≈ 0.5 token/min of spend vs 1/min of refill), so the bucket
--    sits near full; an OVERDRIVE / mythic burst of quick rebirths, or an hour of play with no menu load, draws
--    on the 60-token burst. If it is ever exceeded the row is CLAMPED (never rejected) and catches up as the
--    bucket refills — a clamped row only ever shows LESS than the truth.
--  THE CONVERSION — ONCE per row: while the stored row's econ < 12 (its last accepted submit was on an older
--    economy), the submit also gets  conversion_bonus = floor((L − gate) / 18) + 1  when L ≥ gate, where
--    L = the STORED level, gate = 15 + 18·(stored rebirths) — exactly econMigrate.rebirthRushConvert on the row
--    the board already shows (snapplemelon R4 LV195 → +7). Bonus rebirths cost no tokens. The accepted write
--    sets econ = 12, so the bonus can never be claimed twice. A row whose stored level lags its real level
--    (015's clamp) gets the rest from the full bucket.
--  LEVEL — free within the run: level ≤ max(gate(R) + 36, base + 015's allowance), where R = the rebirths being
--    written, gate(R) = 15 + 18·R (the NEXT rebirth's gate) and +36 = two rebirths of headroom (each 18 levels
--    costs ~×12 XP, so nobody holds a level far past the gate for long). base = 1 after a rebirth or a reset,
--    else the stored level; 015's allowance (+0.5 level/s, banking ≤ 20 min) still lets a player who refuses to
--    rebirth climb past the headroom at the old rate. A reset (lower numbers) keeps 017's "never forced below the
--    stored level". Level only orders rows of EQUAL rebirths now, so a free level inside the gate buys a cheater
--    nothing that the rebirth bucket does not already allow.
--  WHAT A CHEATER CAN STILL DO: +60 rebirths at once, then +60/hour sustained (honest is ~4/hour). That is the
--    deliberate trade for never clamping an honest burst; tighten RB_SECS (60) / RB_BURST (60) below if needed.
--
-- KEEP IN SYNC WITH src/leaderboard/submitRules.js (decideSubmitRR) — the same branches, order and constants;
-- src/leaderboard/submitRules.test.js pins both.
--
-- DEPENDENCIES: 016 (lb_save2 / lb_load2 shape) and 017 (profiles.econ, private schema, the views).
-- ORDER (Andy): deploy the Rebirth Rush client FIRST (it works on 016/017 by sending 10), THEN run this file,
-- then `notify pgrst, 'reload schema';`. If 011, 013, 015, 016 or 017 is ever re-run, re-run THIS file after it.
-- WRITE-ONLY: Claude never runs migrations.

-- ---- the rebirth token bucket's clock ---------------------------------------------------------------------
alter table public.profiles add column if not exists rb_clock timestamptz;

-- ---- the Rebirth Rush write rule ----------------------------------------------------------------------------
-- Not callable by anon/authenticated (private schema, execute revoked); lb_submit3 (SECURITY DEFINER) runs it.
create or replace function private.lb_board_write_rr(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric, p_econ smallint)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean;
        old_gate bigint; conv bigint; eff_clock timestamptz; tokens bigint; spent bigint; clk timestamptz;
        lv_cap bigint;
        RB_SECS constant integer := 60;     -- one rebirth token per 60 s of wall time
        RB_BURST constant integer := 60;    -- the bucket holds ≤ 60 tokens (one hour)
        LV_HEADROOM constant integer := 36; -- levels allowed past the next rebirth gate (two rebirths' worth)
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
  delta := 0;            -- 013: the first submit is a baseline only
  clk := old.rb_clock;   -- unchanged unless tokens are spent
  if old.submitted_at is not null then
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    -- 015's level allowance: ≤ 0.5 a second since the last accepted submit, banking ≤ 20 min (600 levels)
    max_rise := greatest(1, floor(least(secs, 1200) * 0.5)::bigint);
    -- RR: the one-time conversion bonus (row still on an older economy), from the STORED row
    old_gate := 15 + 18 * old.rebirths::bigint;
    conv := case when coalesce(old.econ, 0) < 12 and old.level >= old_gate
                 then floor((old.level - old_gate) / 18.0)::bigint + 1 else 0 end;
    -- RR: rebirth tokens — 1 per RB_SECS since rb_clock, at most RB_BURST (null clock = full bucket)
    eff_clock := greatest(coalesce(old.rb_clock, '-infinity'::timestamptz), now() - make_interval(secs => RB_SECS * RB_BURST));
    tokens := least(RB_BURST, floor(extract(epoch from (now() - eff_clock)) / RB_SECS)::bigint);
    is_reset := rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
                or (lv < old.level and rb = old.rebirths);
    if not is_reset then
      -- INCREASE: words/letters rate-checked exactly as 011/013/015 (too fast → the whole submit is rejected)
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    -- RR: rebirths rise ≤ conversion bonus + tokens (both paths; a reset that lowers rebirths spends nothing)
    rb := least(rb::bigint, old.rebirths::bigint + conv + tokens)::integer;
    spent := greatest(0, rb::bigint - old.rebirths - conv);
    if spent > 0 then clk := eff_clock + make_interval(secs => RB_SECS * spent); end if;
    -- RR: the level is free up to the next gate + headroom (or 015's allowance above base, if that is higher)
    base_lv := case when is_reset or rb > old.rebirths then 1 else old.level end;
    lv_cap := greatest(15 + 18 * rb::bigint + LV_HEADROOM, base_lv + max_rise);
    if is_reset then
      -- 017 RESET → a new baseline: lower values land as submitted; anything that went UP is bounded (level by
      -- the cap, never forced below the stored level; words/letters by the rate limit). No weekly words.
      lv := least(lv::bigint, greatest(old.level::bigint, lv_cap))::integer;
      w := least(w, old.lifetime_words + floor(20 * secs)::bigint);
      l := least(l, old.lifetime_letters + floor(150 * secs)::bigint);
    else
      lv := least(lv::bigint, lv_cap)::integer;
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
         rb_clock = clk,
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function private.lb_board_write_rr(text, integer, integer, bigint, bigint, numeric, smallint) from public;
revoke all on function private.lb_board_write_rr(text, integer, integer, bigint, bigint, numeric, smallint) from anon, authenticated;

-- ---- lb_submit3: gated on 12; the Rebirth Rush rule; marks the row econ = 12 --------------------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if p_econ is distinct from 12 then raise exception 'old_client'; end if;
  perform private.lb_board_write_rr(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                    p_wins_per_word, (12)::smallint); -- econ = 12
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- lb_save2: 016's body, gated on 12 ---------------------------------------------------------------------
create or replace function public.lb_save2(p_secret text, p_blob text, p_score numeric, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old private.cloud_saves;
begin
  if p_econ is distinct from 12 then return json_build_object('saved', false, 'reason', 'old_client'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 65536 then raise exception 'bad_blob'; end if;
  select * into old from private.cloud_saves where profile_id = pid for update;
  if found then
    if old.saved_at >= now() - interval '20 seconds' then return json_build_object('saved', false, 'reason', 'throttled'); end if;
    if coalesce(p_score, 0) < old.score then return json_build_object('saved', false, 'reason', 'lower'); end if;
    update private.cloud_saves set blob = p_blob, score = coalesce(p_score, 0), saved_at = now() where profile_id = pid;
  else
    insert into private.cloud_saves (profile_id, blob, score) values (pid, p_blob, coalesce(p_score, 0));
  end if;
  return json_build_object('saved', true);
end $$;
revoke all on function public.lb_save2(text, text, numeric, integer) from public;
grant execute on function public.lb_save2(text, text, numeric, integer) to anon, authenticated;

-- ---- lb_load2: 016's body (reset_all included), gated on 12 -------------------------------------------------
create or replace function public.lb_load2(p_secret text, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text; rst boolean;
begin
  if p_econ is distinct from 12 then raise exception 'old_client'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select username, reset_all into uname, rst from public.profiles where id = pid;
  select * into s from private.cloud_saves where profile_id = pid;
  if not found then
    return json_build_object('id', pid, 'username', uname, 'blob', null, 'score', 0, 'reset_all', coalesce(rst, false));
  end if;
  return json_build_object('id', pid, 'username', uname, 'blob', s.blob, 'score', s.score, 'saved_at', s.saved_at,
                           'reset_all', coalesce(rst, false));
end $$;
revoke all on function public.lb_load2(text, integer) from public;
grant execute on function public.lb_load2(text, integer) to anon, authenticated;

-- ---- the OLD write paths stay no-ops (016), re-asserted so this file alone keeps them closed -----------------
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return; -- 016/018: pre-v10 bundles may not write the board (lb_submit3 is the current path)
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return; -- 016/018: no-op
end $$;
revoke all on function public.lb_submit(text, integer, integer, bigint, numeric) from public;
grant execute on function public.lb_submit(text, integer, integer, bigint, numeric) to anon, authenticated;

create or replace function public.lb_save(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return json_build_object('saved', false, 'reason', 'old_client'); -- 016/018: lb_save2 is the current path
end $$;
revoke all on function public.lb_save(text, text, numeric) from public;
grant execute on function public.lb_save(text, text, numeric) to anon, authenticated;

-- ---- the board view: REBIRTHS FIRST, THEN LEVEL (Andy ran this order on prod oct3 19:55) -------------------
-- rebirths desc, level desc, lifetime_words desc, created_at asc — the same order #178 puts in 017. Same columns
-- and grants as 017. Every migration that (re)builds public.leaderboard MUST carry this order.
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by rebirths desc, level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word, econ
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

-- ---- feature detection: 017's caps, econ: 12 ---------------------------------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 12)
$$;
grant execute on function public.lb_caps() to anon, authenticated;
