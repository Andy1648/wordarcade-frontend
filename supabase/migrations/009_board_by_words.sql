-- 009_board_by_words.sql — RECORDS a change Andy made by hand in Supabase on Oct 2, 2026:
-- public.leaderboard ranks by LIFETIME WORDS, not letters. Letters only began counting at PR #79
-- with no backfill, so under 005's letters-first order everyone but the newest players showed 0.
-- Already live on production (verified: the board is strictly descending by lifetime_words).
-- This file exists so the repo matches the DB; re-running it is harmless. Tiebreaks follow 005's
-- shape (level, rebirths, created_at). lifetime_letters stays in the view as a secondary column.
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by lifetime_words desc, level desc, rebirths desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;
