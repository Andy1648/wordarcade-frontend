-- 058_gear_expansion.sql - FIFTEEN NEW GEARS (Andy oct21 "more really cool gear ... we need to make more"). The server picks
-- every roll (036), so its pool must match the game's (src/progress/markRollsCore.js; serverRolls.test.js pins THIS file
-- now). The TIER odds do not move - each tier's chance is split over more gears:
--   RARE 16 (the remainder)   EPIC stays 1 in 60 (12 gears x 1/720)   LEGENDARY stays 1 in 100 (12 x 1/1,200)
--   MYTHIC stays 1 in 2,000 (6 x 1/12,000)   SECRET stays 1 in 15,000 (2 x 1/30,000)
-- Pity and luck are unchanged. The 036 audit reads this table too. No other table or function changes.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run. ASCII only.
-- UNDO: re-run 055_more_legendaries.sql (the new gears then stop dropping; owned copies stay owned).

truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 16.447932015214338, 1),
  ('mk-cyclone', 'rare', 16.447932015214338, 2),
  ('mk-scholar', 'rare', 16.447932015214338, 3),
  ('mk-ouroboros', 'rare', 16.447932015214338, 4),
  ('mk-tinder', 'rare', 16.447932015214338, 5),
  ('mk-slipstream', 'rare', 16.447932015214338, 6),
  ('mk-smith', 'rare', 16.447932015214338, 7),
  ('mk-phoenix', 'rare', 16.447932015214338, 8),
  ('mk-metronome', 'rare', 16.447932015214338, 9),
  ('mk-hotwire', 'rare', 16.447932015214338, 10),
  ('mk-grapple', 'rare', 16.447932015214338, 11),
  ('mk-sparkplug', 'rare', 16.447932015214338, 12),
  ('mk-highlighter', 'rare', 16.447932015214338, 13),
  ('mk-flashcards', 'rare', 16.447932015214338, 14),
  ('mk-firecracker', 'rare', 16.447932015214338, 15),
  ('mk-gumball', 'rare', 16.447932015214338, 16),
  ('mk-pyro', 'epic', 720, 17),
  ('mk-nova', 'epic', 720, 18),
  ('mk-golem', 'epic', 720, 19),
  ('mk-brainstorm', 'epic', 720, 20),
  ('mk-flashpoint', 'epic', 720, 21),
  ('mk-voltage', 'epic', 720, 22),
  ('mk-talisman', 'epic', 720, 23),
  ('mk-lavalamp', 'epic', 720, 24),
  ('mk-alarmclock', 'epic', 720, 25),
  ('mk-fortune', 'epic', 720, 26),
  ('mk-hoarder', 'epic', 720, 27),
  ('mk-domino', 'epic', 720, 28),
  ('mk-leviathan', 'legendary', 1200, 29),
  ('mk-eclipse', 'legendary', 1200, 30),
  ('mk-headmaster', 'legendary', 1200, 31),
  ('mk-thunderclap', 'legendary', 1200, 32),
  ('mk-jackpot', 'legendary', 1200, 33),
  ('mk-monsoon', 'legendary', 1200, 34),
  ('mk-inferno', 'legendary', 1200, 35),
  ('mk-mainframe', 'legendary', 1200, 36),
  ('mk-shamrock', 'legendary', 1200, 37),
  ('mk-longshot', 'legendary', 1200, 38),
  ('mk-hothand', 'legendary', 1200, 39),
  ('mk-arcadestick', 'legendary', 1200, 40),
  ('mk-singularity', 'mythic', 12000, 41),
  ('mk-kraken', 'mythic', 12000, 42),
  ('mk-hydra', 'mythic', 12000, 43),
  ('mk-chronos', 'mythic', 12000, 44),
  ('mk-firebird', 'mythic', 12000, 45),
  ('mk-trident', 'mythic', 12000, 46),
  ('mk-origin', 'secret', 30000, 47),
  ('mk-paradox', 'secret', 30000, 48)
;

-- CHECK (each tier's chance, should read 0.0166 / 0.01 / 0.0005 / 0.0000666 and RARE the rest):
-- select tier, count(*), sum(1 / x) from private.gear_pool group by tier order by min(ord);
