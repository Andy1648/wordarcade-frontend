-- 041_board_bots.sql — 50 BOARD BOTS (Andy oct13: "add like 50 bot accts to the leaderboard … i want to make the
-- leaderboard bigger and it promotes more competition for players (i wont use the leaderboard as a metric or anything)").
--
--   * profiles gains `is_bot` (default false) — every bot row is marked, so it is one query to find, count or remove
--     them (bottom of this file), and Andy's cheat review can skip them.
--   * 50 season-2 rows (econ 13) with handles, levels and rebirths spread where real players are: mostly R0–R3, a
--     handful R4–R7, never above R7 — the real top players stay on top; a new player has people to pass.
--   * STATIC: bots never move. A moving bot would gain levels inside a week and show on THIS WEEK, pushing a real player
--     out of the paid top 10 (034). Static rows have no week gains, so the weekly board and its gem prizes stay real
--     players only. (Prizes are also only ever paid through lb_week_prize(secret) — a bot has no secret.)
--   * No secret, no login, no gear: nobody can play as a bot, and a bot never submits.
-- Names that are already taken are skipped (on conflict). ADDITIVE and re-runnable.
-- HOW: Supabase → SQL editor → paste this file → Run.

alter table public.profiles add column if not exists is_bot boolean not null default false;

insert into public.profiles (username, level, rebirths, lifetime_words, lifetime_letters, econ, stars, is_bot, created_at)
select v.username, v.level, v.rebirths, v.words, v.letters, 13, 0, true, v.born
  from (values
  ('PixelPanda', 50, 2, 683, 4781, now() - interval '12 days 15 hours'),
  ('Zoomies_77', 51, 3, 1067, 7469, now() - interval '3 days 10 hours'),
  ('quietkeys', 39, 3, 515, 3090, now() - interval '16 days 15 hours'),
  ('LexiTypes', 24, 1, 141, 987, now() - interval '10 days 9 hours'),
  ('moonbyte', 27, 2, 416, 2496, now() - interval '5 days 23 hours'),
  ('NovaRush', 75, 4, 335, 1675, now() - interval '18 days 13 hours'),
  ('Tw1stedTongue', 25, 2, 500, 3500, now() - interval '3 days 22 hours'),
  ('keysmash_kid', 16, 1, 409, 2863, now() - interval '11 days 9 hours'),
  ('BeanTyper', 7, 0, 114, 798, now() - interval '7 days 7 hours'),
  ('spellcheckd', 57, 2, 452, 3164, now() - interval '10 days 22 hours'),
  ('Glyphling', 24, 2, 587, 4109, now() - interval '9 days 23 hours'),
  ('turbo_tom', 6, 0, 213, 1491, now() - interval '7 days 7 hours'),
  ('Wordsworth99', 41, 1, 327, 1962, now() - interval '6 days 10 hours'),
  ('inkdrop', 82, 4, 1110, 7770, now() - interval '2 days 23 hours'),
  ('RazzleDazz', 31, 1, 161, 1127, now() - interval '9 days 18 hours'),
  ('typo_queen', 38, 1, 515, 2575, now() - interval '4 days 8 hours'),
  ('ByteSizedBen', 39, 1, 311, 1866, now() - interval '18 days 6 hours'),
  ('FrostedFlakez', 21, 2, 194, 970, now() - interval '13 days 14 hours'),
  ('LuckyLetters', 71, 3, 1051, 7357, now() - interval '2 days 7 hours'),
  ('sk8rgrl_88', 27, 2, 197, 985, now() - interval '13 days 11 hours'),
  ('MangoMochi', 5, 0, 259, 1813, now() - interval '9 days 22 hours'),
  ('QWERTYuiop_', 40, 5, 1337, 9359, now() - interval '16 days 23 hours'),
  ('wordnerd42', 19, 0, 163, 815, now() - interval '9 days 21 hours'),
  ('CaptainCaps', 14, 0, 126, 756, now() - interval '8 days 1 hours'),
  ('LetterLord', 147, 7, 671, 4697, now() - interval '4 days 23 hours'),
  ('DizzyDolphin', 67, 3, 927, 5562, now() - interval '6 days 14 hours'),
  ('nightowl_jay', 33, 1, 319, 2233, now() - interval '17 days 21 hours'),
  ('VowelPower', 22, 0, 175, 875, now() - interval '16 days 8 hours'),
  ('ClickClack', 6, 0, 156, 780, now() - interval '1 days 15 hours'),
  ('Kibbles_n_Bits', 9, 0, 62, 372, now() - interval '12 days 11 hours'),
  ('HexaHero', 21, 0, 259, 1295, now() - interval '1 days 8 hours'),
  ('sundaeSunday', 48, 3, 415, 2490, now() - interval '5 days 5 hours'),
  ('PopcornPilot', 36, 2, 227, 1589, now() - interval '8 days 20 hours'),
  ('grumpy_gecko', 17, 0, 235, 1410, now() - interval '20 days 4 hours'),
  ('JellyJam', 37, 1, 373, 2611, now() - interval '17 days 11 hours'),
  ('ScrabbleSam', 5, 0, 190, 1330, now() - interval '12 days 13 hours'),
  ('TacoTuesday21', 74, 5, 827, 4962, now() - interval '11 days 13 hours'),
  ('mintchip_mia', 12, 1, 407, 2849, now() - interval '16 days 3 hours'),
  ('RocketRaccoon7', 45, 3, 259, 1554, now() - interval '15 days 23 hours'),
  ('WaffleWizard', 13, 0, 246, 1476, now() - interval '5 days 17 hours'),
  ('chunky_monkey', 17, 1, 239, 1195, now() - interval '16 days 21 hours'),
  ('Snorlaxin', 5, 0, 208, 1456, now() - interval '10 days 11 hours'),
  ('breadstick_bri', 59, 4, 1140, 5700, now() - interval '19 days 5 hours'),
  ('Zigzag_Zed', 59, 3, 271, 1355, now() - interval '7 days 21 hours'),
  ('BubbleT0ast', 9, 0, 144, 864, now() - interval '17 days 19 hours'),
  ('OctoTyper', 63, 5, 1337, 8022, now() - interval '14 days 13 hours'),
  ('SpeedySpud', 56, 4, 1275, 8925, now() - interval '13 days 3 hours'),
  ('lilbitlucy', 22, 1, 497, 2982, now() - interval '12 days 7 hours'),
  ('AstroAxolotl', 44, 6, 1536, 9216, now() - interval '3 days 10 hours'),
  ('Fizzbang', 35, 2, 224, 1568, now() - interval '6 days 14 hours')
  ) as v(username, level, rebirths, words, letters, born)
 where not exists (select 1 from public.profiles p where lower(p.username) = lower(v.username));

-- CHECK:   select username, rebirths, level from public.profiles where is_bot order by rebirths desc, level desc;
-- REMOVE:  delete from public.profiles where is_bot;
