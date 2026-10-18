-- 055_more_legendaries.sql - FIVE NEW GEARS (Andy oct18 "rarer ones like more legendaries"): MONSOON, INFERNO,
-- MAINFRAME, SHAMROCK (LEGENDARY) and CHRONOS (MYTHIC). The server picks every roll (036), so its pool must match the
-- game's (src/progress/markRollsCore.js; serverRolls.test.js pins THIS file now). The TIER odds do not move:
--   LEGENDARY stays 1 in 100 (9 gears x 1/900)   MYTHIC stays 1 in 2,000 (4 gears x 1/8,000)
-- EPIC, SECRET and RARE are byte-identical to 048. Pity and luck are unchanged. The 036 audit reads this table too.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run. ASCII only.
-- UNDO: re-run 048_rarer_friendlier.sql (the new gears then stop dropping; owned copies stay owned).

truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 12.335949011410753, 1),
  ('mk-cyclone', 'rare', 12.335949011410753, 2),
  ('mk-scholar', 'rare', 12.335949011410753, 3),
  ('mk-ouroboros', 'rare', 12.335949011410753, 4),
  ('mk-tinder', 'rare', 12.335949011410753, 5),
  ('mk-slipstream', 'rare', 12.335949011410753, 6),
  ('mk-smith', 'rare', 12.335949011410753, 7),
  ('mk-phoenix', 'rare', 12.335949011410753, 8),
  ('mk-metronome', 'rare', 12.335949011410753, 9),
  ('mk-hotwire', 'rare', 12.335949011410753, 10),
  ('mk-grapple', 'rare', 12.335949011410753, 11),
  ('mk-sparkplug', 'rare', 12.335949011410753, 12),
  ('mk-pyro', 'epic', 420, 13),
  ('mk-nova', 'epic', 420, 14),
  ('mk-golem', 'epic', 420, 15),
  ('mk-brainstorm', 'epic', 420, 16),
  ('mk-flashpoint', 'epic', 420, 17),
  ('mk-voltage', 'epic', 420, 18),
  ('mk-talisman', 'epic', 420, 19),
  ('mk-leviathan', 'legendary', 900, 20),
  ('mk-eclipse', 'legendary', 900, 21),
  ('mk-headmaster', 'legendary', 900, 22),
  ('mk-thunderclap', 'legendary', 900, 23),
  ('mk-jackpot', 'legendary', 900, 24),
  ('mk-monsoon', 'legendary', 900, 25),
  ('mk-inferno', 'legendary', 900, 26),
  ('mk-mainframe', 'legendary', 900, 27),
  ('mk-shamrock', 'legendary', 900, 28),
  ('mk-singularity', 'mythic', 8000, 29),
  ('mk-kraken', 'mythic', 8000, 30),
  ('mk-hydra', 'mythic', 8000, 31),
  ('mk-chronos', 'mythic', 8000, 32),
  ('mk-origin', 'secret', 15000, 33)
;

-- CHECK (each tier's chance, should read 0.0166 / 0.01 / 0.0005 / 0.0000666 and RARE the rest):
-- select tier, sum(1 / x) from private.gear_pool group by tier order by min(ord);
