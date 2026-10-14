-- 048_rarer_friendlier.sql - RARE GEAR, FRIENDLIER (Andy oct14 "make rates even more friendly for rarer gear").
-- The server picks every roll (036), so its pool must match the game's (src/progress/markRollsCore.js TIER_ODDS;
-- serverRolls.test.js pins this file). EPIC is unchanged; only the rarer tiers move:
--   LEGENDARY 1 in 150 -> 1 in 100   MYTHIC 1 in 4,000 -> 1 in 2,000   SECRET 1 in 40,000 -> 1 in 15,000
-- Pity (EPIC+ every 10, LEGENDARY+ every 50) and luck are unchanged. The 036 audit reads this table too, so it simply
-- becomes more lenient. Each gear's x is its tier's 1-in-X times the gears in the tier; RARE takes the rest.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run.
-- UNDO: re-run 044_easier_rolls.sql

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
  ('mk-leviathan', 'legendary', 500, 20),
  ('mk-eclipse', 'legendary', 500, 21),
  ('mk-headmaster', 'legendary', 500, 22),
  ('mk-thunderclap', 'legendary', 500, 23),
  ('mk-jackpot', 'legendary', 500, 24),
  ('mk-singularity', 'mythic', 6000, 25),
  ('mk-kraken', 'mythic', 6000, 26),
  ('mk-hydra', 'mythic', 6000, 27),
  ('mk-origin', 'secret', 15000, 28);

-- CHECK (each tier's chance, should read 0.0166 / 0.01 / 0.0005 / 0.0000666 and RARE the rest):
-- select tier, sum(1 / x) from private.gear_pool group by tier order by min(ord);
