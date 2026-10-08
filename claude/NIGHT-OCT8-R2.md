# NIGHT OCT 8 — ROUND 2 (cloud run, visual refinement)

Started 07:31 UTC (03:31 ET). Andy up 11:00 UTC. Round 1 (local) merged #258–#270 through the night.

## Rules I re-read before each step
- Touch ONLY: Season2Welcome.*, results/*, ShopV2.* (season-2 shop), StatsV2.*, MarksIndex.*, MobileMenu.*, LeaderboardV2.*.
- NEVER: Homepage.*, MenuNav.*, MenuXp.*, kit/*, rollScreen/*, markCard/*, markGlyphs*, GameScreen.jsx, CardPager.*, GameCard.*, src/progress/*, season.js, migrations, economy.
- One branch + one PR per step, from a FRESH `git pull origin main`. Merge myself only when CI (CI + E2E) is green.
- Text ≥ 14px, numbers ≥ 18px, one headline ≥ 36px per screen; nothing leaves its box at 1366x657 / 390x844.
- transform/opacity only, finite, pooled. Two screenshots per PR body.
- Research 3 findings per step before building.

## Plan
- [x] Step 1 — EDITOR'S NOTE (Season2Welcome): proportions, gem number ≥ 48px, OLD RUN line readable, COLLECT/PLAY states (rest/hover/pressed/disabled while flying), landing ticks + bumps the pill.
- [ ] Step 2 — RESULTS (results/ResultsCard): each win line (base × mode × rebirth × gear → total), TOTAL ≥ 40px, no essay.
- [ ] Step 3 — UPGRADES (ShopV2): "XP / LETTER" → "XP / KEY" (season 2), POWER price + "×2 → ×4" big, hold-to-buy stays, fits at 390.
- [ ] Step 4 — STATS (StatsV2): TOTAL multiplier first + biggest, BASE × POWER × REBIRTH × GEAR number-first rows; numbers verified vs numbersAudit tests (no math change).
- [ ] Step 5 — MARKS INDEX (MarksIndex): rarity by colour only, dupes "×N", no stars, names ≥ 18px, locked = black silhouettes + odds. No markCard/* edits.
- [ ] Step 6 — MOBILE MENU (MobileMenu, ≤480px): slabs label + number, gear chip = slot, "+N XP / KEY", fits 360x640 + 390x844.
- [ ] Step 7 (if time) — LEADERBOARD rows (LeaderboardV2): rank plate, name, one stat ≥ 18px, "—" state, white podium icon (round 1 #266 already did the icon — verify only).

## Log
(appended per step)

### Step 1 — EDITOR'S NOTE → PR #271 (night2/editors-note)
Research (3): (a) Clash Royale chest-open: the reward NUMBER is the largest glyph on screen, the screen title is a fraction of it — our 100px wordmark was out-shouting the 96px gift. (b) Balatro's score pop: the counter ticks AND the plate bumps on every landing — ours already does (gains #262); keep it. (c) Pet Sim 99 / Genshin claim screens: the claim button goes dead for the whole flight so the player can't leave the reward mid-air — ours flipped to PLAY instantly on the server ok. Built: title 76px (clears the pill at 1366), captions 20/18, R7 76px + shadow, rolls 20, SHOWS ONCE 16 Bungee, phone gift 68px + band behind the trade, 'flying' phase → KitButton disabled until GainLayer onDone. Shots: claude/night-oct8-r2/s1-note-1366x657.jpg, s1-note-states-390x844.jpg. e2e season2-reset 2/2 local green.

## REPORT
(filled last)
