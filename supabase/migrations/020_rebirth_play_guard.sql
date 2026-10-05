-- 020_rebirth_play_guard.sql — Andy oct5: imbetterthanandy reached R100 with 422 words. CAUSE (claude/andy-notes-oct2.md):
-- not the economy — on the shipped economy an honest FAST player (every reward on) is at R5 after ~2,500 words — but
-- this board-write rule: rebirths were bounded only by wall time (1 token a minute, 60 banked) and a FIRST submit
-- was taken as-is, so an edited or imported local save landed any rebirth count. 020 bounds rebirths by PLAY too:
--     * rebirths ≤ floor(lifetime words / 40)  (honest fast ≥ 80 words for R1, more for every later one → ≤ ~2×)
--     * tokens: 1 per 5 min, 12 banked (honest fast ≈ 6 an hour early on → ≤ 2×)
--     * a FIRST submit: rebirths ≤ that play cap + 7 (the legit one-time conversion), level ≤ its gate + 50
-- EXISTING ROWS KEEP WHAT THEY HAVE: a row already above its play cap is never lowered; it rises again once its
-- words catch up. The one-time conversion is unchanged (it converts levels already earned).
-- THIS FILE SUPERSEDES 019 (it carries 019's round-gate level cap, 25 × (R+1) + 50): if 019 was never run, run only
-- this one. Re-declares ONLY private.lb_board_write_rr. KEEP IN SYNC WITH src/leaderboard/submitRules.js
-- (decideSubmitRR). WRITE-ONLY: Claude never runs migrations; safe to re-run.
-- ORDER: deploy the client first, then run this file, then `notify pgrst, 'reload schema';`.

create or replace function private.lb_board_write_rr(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric, p_econ smallint)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean;
        old_gate bigint; conv bigint; eff_clock timestamptz; tokens bigint; spent bigint; clk timestamptz;
        lv_cap bigint;
        RB_SECS constant integer := 300;    -- 020: one rebirth token per 5 min of wall time (≈ 2× an honest fast player)
        RB_BURST constant integer := 12;    -- 020: the bucket holds ≤ 12 tokens (one hour)
        WORDS_PER_RB constant integer := 40;    -- 020: rebirths ≤ lifetime words / 40 (honest fast: ≥ 80 words for R1)
        FIRST_CONV_ALLOW constant integer := 7; -- 020: a FIRST submit may carry the legit one-time conversion (max +7)
        play_cap bigint;
        LV_HEADROOM constant integer := 50; -- levels allowed past the next rebirth gate (two rebirths' worth at 25 a rebirth)
        CONV_CAP constant integer := 15;    -- the one-time conversion bonus never exceeds 15 rebirths (legit max +7):
                                            -- a forged old level must not become hundreds of rebirths
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
  play_cap := floor(w / WORDS_PER_RB)::bigint; -- 020: the rebirths this much verified play can carry
  if old.submitted_at is null then
    -- 020: the first submit is still a baseline, but bounded by its own play (+ the conversion allowance)
    rb := least(rb::bigint, play_cap + FIRST_CONV_ALLOW)::integer;
    lv := least(lv::bigint, 25 * (rb::bigint + 1) + LV_HEADROOM)::integer;
  end if;
  if old.submitted_at is not null then
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    -- 015's level allowance: ≤ 0.5 a second since the last accepted submit, banking ≤ 20 min (600 levels)
    max_rise := greatest(1, floor(least(secs, 1200) * 0.5)::bigint);
    -- RR: the one-time conversion bonus (row still on an older economy), from the STORED row
    old_gate := 15 + 18 * old.rebirths::bigint;
    conv := case when coalesce(old.econ, 0) < 12 and old.level >= old_gate
                 then least(CONV_CAP, floor((old.level - old_gate) / 18.0)::bigint + 1) else 0 end;
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
    -- 020: and ≤ the play cap; a row already above it keeps what it has (rises again once its words catch up)
    rb := least(rb::bigint, old.rebirths::bigint + conv + tokens, greatest(old.rebirths::bigint + conv, play_cap))::integer;
    spent := greatest(0, rb::bigint - old.rebirths - conv);
    if spent > 0 then clk := eff_clock + make_interval(secs => RB_SECS * spent); end if;
    -- RR: the level is free up to the next gate + headroom (or 015's allowance above base, if that is higher)
    base_lv := case when is_reset or rb > old.rebirths then 1 else old.level end;
    lv_cap := greatest(25 * (rb::bigint + 1) + LV_HEADROOM, base_lv + max_rise); -- 019: the gate is 25 × (R+1)
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
