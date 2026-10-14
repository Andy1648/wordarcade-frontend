-- 044_easier_rolls.sql - EASIER GEAR ROLLS (Andy oct14: "make rolling rates easier (lower bar for higher rarities) - just a
-- noticeable change - nothing too small and nothing crazy"). The server picks every roll (036), so its pool must match
-- the game's (src/progress/markRollsCore.js TIER_ODDS; serverRolls.test.js pins this file).
--   EPIC 1 in 100 -> 1 in 60   LEGENDARY 1 in 250 -> 1 in 150   MYTHIC 1 in 10,000 -> 1 in 4000   SECRET 1 in 100,000 -> 1 in 40000
-- (1.7x easier for EPIC / LEGENDARY, 2.5x for MYTHIC / SECRET). Pity (EPIC+ every 10, LEGENDARY+ every 50) is unchanged.
-- Each gear's x is its tier's 1-in-X times the gears in the tier; RARE takes the rest. The 036 audit reads this
-- table too, so it simply becomes more lenient. Nothing else changes.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run.
-- UNDO: re-run the gear_pool insert from 036_server_rolls.sql

truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
  ('mk-detonator', 'rare', 12.290149956899127, 1),
  ('mk-cyclone', 'rare', 12.290149956899127, 2),
  ('mk-scholar', 'rare', 12.290149956899127, 3),
  ('mk-ouroboros', 'rare', 12.290149956899127, 4),
  ('mk-tinder', 'rare', 12.290149956899127, 5),
  ('mk-slipstream', 'rare', 12.290149956899127, 6),
  ('mk-smith', 'rare', 12.290149956899127, 7),
  ('mk-phoenix', 'rare', 12.290149956899127, 8),
  ('mk-metronome', 'rare', 12.290149956899127, 9),
  ('mk-hotwire', 'rare', 12.290149956899127, 10),
  ('mk-grapple', 'rare', 12.290149956899127, 11),
  ('mk-sparkplug', 'rare', 12.290149956899127, 12),
  ('mk-pyro', 'epic', 420, 13),
  ('mk-nova', 'epic', 420, 14),
  ('mk-golem', 'epic', 420, 15),
  ('mk-brainstorm', 'epic', 420, 16),
  ('mk-flashpoint', 'epic', 420, 17),
  ('mk-voltage', 'epic', 420, 18),
  ('mk-talisman', 'epic', 420, 19),
  ('mk-leviathan', 'legendary', 750, 20),
  ('mk-eclipse', 'legendary', 750, 21),
  ('mk-headmaster', 'legendary', 750, 22),
  ('mk-thunderclap', 'legendary', 750, 23),
  ('mk-jackpot', 'legendary', 750, 24),
  ('mk-singularity', 'mythic', 12000, 25),
  ('mk-kraken', 'mythic', 12000, 26),
  ('mk-hydra', 'mythic', 12000, 27),
  ('mk-origin', 'secret', 40000, 28);

-- CHECK (each tier's chance, should read 0.0166 / 0.0066 / 0.00025 / 0.000025 and RARE the rest):
-- select tier, sum(1 / x) from private.gear_pool group by tier order by min(ord);
