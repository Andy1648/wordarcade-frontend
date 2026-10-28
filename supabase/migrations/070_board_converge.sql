-- 070_board_converge.sql — daan (Andy oct27: "his leaderboard doesn't reflect his actual rebirths").
--
-- WHY: a board row's rebirths could only ever move through lb_rebirth (+1, server-checked). Whenever the save got ahead
-- of its row — a rebirth done while the name was lost (a wiped browser, a new device: no profile = a LOCAL rebirth), a
-- failed caps probe, or a NEW name claimed on an existing save (the first write clamped rebirths to words / 100: daan's
-- R26+ save landed on R2) — the row stayed behind FOREVER: "a submit never raises rebirths". Each later server rebirth
-- moved row and save up by one together, so the gap never closed. Live examples: dan LV514/R2, PussQueefy LV593/R5.
--
-- WHAT CHANGES (private.lb_board_write_s2 only — 057's body):
--   * the first season-2 write: rebirths ≤ lifetime words / 10 (was / 100);
--   * every later write: rebirths may RISE to the sent count, still ≤ lifetime words / 10 (lb_rebirth's own 10 words a
--     rebirth) — the row converges on the save. A raise sets rb_words0 (the next lb_rebirth needs 10 new words) and is
--     FLAGGED ('catchup' in private.cheat_flags), never refused: flag, don't ban (032 / 037).
--   * unchanged: a LOWER write is refused (054/057), words / letters merge (057), the level rules, the throttle.
-- MIRRORED in src/leaderboard/finalRules.js (decideSubmitFinal(..., { converge: true })); boardConverge.test.js pins it.
-- The client needs nothing from this file: before it runs, the row simply stays where it is (today's behaviour).
-- ORDER: after 057. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- 032's flag log learns a fourth reason
alter table private.cheat_flags drop constraint if exists cheat_flags_reason_check;
alter table private.cheat_flags add constraint cheat_flags_reason_check check (reason in ('rejected', 'clamped', 'gear', 'catchup'));

create or replace function private.lb_board_write_s2(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv bigint; rb bigint; w bigint; l bigint; wk date; delta bigint;
        secs numeric; max_rise bigint; is_reset boolean; lv_cap bigint;
        F_ECON constant smallint := 13;
        F_GATE_BASE constant integer := 15;        -- the rebirth gate: LV 15 + 18 × R
        F_GATE_STEP constant integer := 18;
        F_LV_HEADROOM constant integer := 100;     -- levels allowed past the next gate
        F_LEVELS_PER_SEC constant integer := 1;    -- or + 1 level a second since the last accepted write …
        F_LEVEL_BANK_SECS constant integer := 1200; -- … banking 20 min
        F_RB_WORDS constant integer := 10;         -- 070: rebirths ≤ lifetime words / 10 (lb_rebirth's own 10 words a rebirth)
        raised boolean := false;
        F_LV_MAX constant bigint := 2147483647;    -- the int column
        -- 039: game words arrive at most 4 a second (240 wpm — no human types faster in a game; was 20)
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
  delta := 0;
  if old.submitted_at is null or old.econ is distinct from F_ECON then
    -- FIRST season-2 write: a baseline, bounded by its own play
    -- 070: words / 10 (was / 100 — a real R26 save claiming a new name landed on R2 and could never climb back)
    rb := least(rb, floor(w / F_RB_WORDS)::bigint);
    lv := least(lv, least(F_LV_MAX, F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM));
  else
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    max_rise := floor(least(secs, F_LEVEL_BANK_SECS) * F_LEVELS_PER_SEC)::bigint;
    -- 057: only rebirths down, or the level down at the same rebirths, is a LOWER write (refused, never a reset). Lifetime
    -- words / letters below the row are MERGED (the row keeps its higher count) instead of refusing the whole write:
    -- a device restored from an older copy is behind on words for a while, and refusing everything froze the row's
    -- level at the LV 1 its last rebirth left — lb_rebirth gates on that level, so the player could never rebirth again.
    is_reset := rb < old.rebirths or (lv < old.level and rb = old.rebirths);
    if is_reset then return; end if;
    w := greatest(w, coalesce(old.lifetime_words, 0));
    l := greatest(l, coalesce(old.lifetime_letters, 0));
    if w - old.lifetime_words > 4 * secs then return; end if;
    if l - old.lifetime_letters > 150 * secs then return; end if;
    -- 070 CONVERGE: the row's rebirths RISE to the save's count (they used to stay put forever — "a submit never raises
    -- rebirths"), bounded by the words the row holds (10 a rebirth, lb_rebirth's own rule). FLAG, DON'T BAN: a raise is
    -- logged as 'catchup' for review, and the word count restarts there (lb_rebirth's next one needs 10 new words).
    if rb > old.rebirths then
      rb := least(rb, greatest(old.rebirths::bigint, floor(w / F_RB_WORDS)::bigint));
      raised := rb > old.rebirths;
    end if;
    lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, old.level + max_rise));
    lv := least(lv, lv_cap);
    delta := greatest(0, w - coalesce(old.lifetime_words, 0));
  end if;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = lv::integer, rebirths = rb::integer, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = F_ECON,
         submitted_at = now(), updated_at = now()
   where id = pid; -- stars are never written here (lb_ascend only)
  if raised then
    update public.profiles set rb_words0 = w where id = pid;
    perform private.cheat_flag(pid, 'catchup', jsonb_build_object('from', old.rebirths, 'to', rb, 'sent', p_rebirths,
                                                                    'words', w, 'level', lv));
  end if;
end $$;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;

notify pgrst, 'reload schema';
