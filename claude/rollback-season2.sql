-- claude/rollback-season2.sql — UNDO THE SEASON 2 RESET (023_season2_reset.sql / claude/run-season2.sql).
--
-- WHEN: only if the season-2 launch has to be taken back. ORDER (Andy):
--   1. Claude flips SEASON2 back OFF (src/progress/season.js SEASON2_LIVE = false) and that deploy is live —
--      a season-2 client must not keep writing econ-13 rows while they are being restored;
--   2. run THIS WHOLE FILE in the Supabase SQL Editor;
--   3. notify pgrst, 'reload schema';
--
-- WHAT IT DOES (one statement = one transaction):
--   * every profile that is in public.season1_snapshot gets back level, rebirths, stars, lifetime_words,
--     lifetime_letters, wins_per_word, econ, week_key, week_words, rb_clock, submitted_at, reset_all exactly as
--     snapped (season-2 progress made since the flip is LOST — the snapshot is the season-1 board);
--     024's s2_week_* columns (if present) go back to their defaults; profiles created after the reset are untouched;
--   * private.cloud_saves gets the snapped season-1 saves back (overwriting any season-2 save of the same profile);
--   * the marker row in public.season2_reset is deleted → lb_caps.season2_reset is false again, and lb_save2 /
--     lb_load2 speak econ 12 again (023 gates them on the marker).
-- KEPT ON PURPOSE: public.season1_snapshot, private.season1_cloud_saves (re-run 023 → it re-snaps and resets again),
-- and public.season2_grants WITH claimed_at — so a later re-run never pays a claimed gift twice. Gems already collected
-- live in browsers (taw.s2.gems, the season-2 save) and are not touched by this file. The 021 rebirth request log is
-- not restored (it is only a 30-day idempotency / pace log).
-- SAFE TO RE-RUN: with no marker row it prints a NOTICE and changes nothing. WRITE-ONLY: Claude never runs it.

do $$
declare n integer; has_week boolean; has_trig boolean;
begin
  if to_regclass('public.season2_reset') is null or not exists (select 1 from public.season2_reset) then
    raise notice 'no season 2 reset to roll back — nothing to do';
    return;
  end if;
  lock table public.profiles in share row exclusive mode;

  has_week := exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'profiles' and column_name = 's2_week_key');
  has_trig := exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'lb_s2_week_stamp');
  if has_trig then execute 'alter table public.profiles disable trigger lb_s2_week_stamp'; end if;
  update public.profiles p
     set level = s.level, rebirths = s.rebirths, stars = s.stars, lifetime_words = s.lifetime_words,
         lifetime_letters = s.lifetime_letters, wins_per_word = s.wins_per_word, econ = s.econ,
         week_key = s.week_key, week_words = s.week_words, rb_clock = s.rb_clock, submitted_at = s.submitted_at,
         reset_all = s.reset_all, updated_at = now()
    from public.season1_snapshot s
   where s.profile_id = p.id;
  get diagnostics n = row_count;
  if has_week then
    execute 'update public.profiles p set s2_week_key = null, s2_week_stars0 = 0, s2_week_rb0 = 0, s2_week_lv0 = 1
               from public.season1_snapshot s where s.profile_id = p.id';
  end if;
  if has_trig then execute 'alter table public.profiles enable trigger lb_s2_week_stamp'; end if;

  insert into private.cloud_saves as c (profile_id, blob, score, saved_at)
  select profile_id, blob, score, saved_at from private.season1_cloud_saves
  on conflict (profile_id) do update set blob = excluded.blob, score = excluded.score, saved_at = excluded.saved_at;

  delete from public.season2_reset;
  raise notice 'season 2 reset rolled back: % profiles restored', n;
end $$;
