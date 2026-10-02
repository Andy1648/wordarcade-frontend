-- UPDATED (Andy oct2, later): the board now ranks by LEVEL — rebirths desc, level desc, lifetime_words
-- desc, created_at asc — which Andy ran on prod. This file and 011 carry THAT order so a re-run never
-- reverts it. (Original note below.)
-- 009_board_by_words.sql — RECORDS a change Andy made by hand in Supabase on Oct 2, 2026:
-- public.leaderboard ranks by LIFETIME WORDS, not letters. Letters only began counting at PR #79
-- with no backfill, so under 005's letters-first order everyone but the newest players showed 0.
-- Already live on production (verified: the board is strictly descending by lifetime_words).
-- This file exists so the repo matches the DB; re-running it is harmless. Tiebreaks follow 005's
-- shape (level, rebirths, created_at). lifetime_letters stays in the view as a secondary column.
drop view if exists public.leaderboard;
-- BOARD = LEVEL ONLY (Andy oct2 evening: "idc abt rebirth"; he ran this view on prod): level desc,
-- lifetime_words desc, created_at asc. Every migration that (re)builds public.leaderboard carries it, so a
-- re-run of any one of them can never put rebirths (or letters) back into the ranking.
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;
