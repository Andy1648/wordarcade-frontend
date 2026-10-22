-- 057_board_merge_counters.sql — the rebirth DEADLOCK (oct21 progression bug audit, B3).
--
-- WHY: lb_rebirth gates on the ROW's level, and a granted rebirth sets that level to 1. When a device's save sits below
-- its own row (a restore from an older cloud copy, a second device, a rebirth answer that never applied), 054 refused
-- EVERY push from it (any lower field = a lower write), and the client refused to send one (boardGuard). The row's level
-- stayed at 1 forever, so every rebirth came back "gate", and the cloud backup (which rides the push) stopped too.
--
-- WHAT CHANGES (private.lb_board_write_s2 only — 054's body with one rule changed):
--   * still REFUSED: rebirths below the row, or the level below the row at the same rebirths (054's second-device fix).
--   * now MERGED: lifetime words / letters below the row — the row keeps its higher count, the rest of the write lands.
-- The client (src/leaderboard/boardGuard.js) now also ADOPTS the row's rebirths when the row is ahead (a rebirth the
-- server granted is real), so its pushes stop being "lower" at all. MIRRORED in src/leaderboard/finalRules.js.
-- ORDER: after 054. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

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
        F_WORDS_PER_RB constant integer := 100;    -- a first season-2 write: rebirths ≤ lifetime words / 100
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
    rb := least(rb, floor(w / F_WORDS_PER_RB)::bigint);
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
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
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
end $$;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;

notify pgrst, 'reload schema';
