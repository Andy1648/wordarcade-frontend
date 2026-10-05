-- 019_round_rebirth_gate.sql — Andy oct5: the rebirth gate is ROUND numbers, LV 25 × (R+1) (25, 50, 75 …), and KEY
-- TIER is kept across rebirths (client PR "KEY TIER kept + round gate").
--
-- WHY: 018's board-write rule (private.lb_board_write_rr) caps a written level at 15 + 18·R + 36 (the old gate plus
-- two rebirths of headroom). Under the new gate a legit level of 25·(R+1) is ABOVE that cap from R4 up, so honest
-- rows would be clamped low. This file re-declares ONLY that function with the cap following the new gate:
--     level ≤ max(25·(R+1) + 50, base + 015's allowance)
-- THE ONE-TIME CONVERSION IS UNCHANGED (old_gate = 15 + 18·R): every save converts under the rule the first players
-- converted under, so a player who comes back later gets exactly what an early visitor got (fair).
-- Everything else in 018 (econ 12 gating, the rebirth token bucket, the conversion cap, cloud-save rules, the
-- reset rule, the board order) is untouched. WRITE-ONLY: Claude never runs migrations; safe to re-run.
-- ORDER: deploy the client first, then run this file, then `notify pgrst, 'reload schema';`.

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
    rb := least(rb::bigint, old.rebirths::bigint + conv + tokens)::integer;
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

-- ---- lb_submit3: gated on 12; the Rebirth Rush rule; marks the row econ = 12 --------------------------------
