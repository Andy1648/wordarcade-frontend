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
- [x] Step 2 — RESULTS (results/ResultsCard): each win line (base × mode × rebirth × gear → total), TOTAL ≥ 40px, no essay.
- [x] Step 3 — UPGRADES (ShopV2): "XP / LETTER" → "XP / KEY" (season 2), POWER price + "×2 → ×4" big, hold-to-buy stays, fits at 390.
- [x] Step 4 — STATS (StatsV2): TOTAL multiplier first + biggest, BASE × POWER × REBIRTH × GEAR number-first rows; numbers verified vs numbersAudit tests (no math change).
- [ ] Step 5 — MARKS INDEX (MarksIndex): rarity by colour only, dupes "×N", no stars, names ≥ 18px, locked = black silhouettes + odds. No markCard/* edits.
- [ ] Step 6 — MOBILE MENU (MobileMenu, ≤480px): slabs label + number, gear chip = slot, "+N XP / KEY", fits 360x640 + 390x844.
- [ ] Step 7 (if time) — LEADERBOARD rows (LeaderboardV2): rank plate, name, one stat ≥ 18px, "—" state, white podium icon (round 1 #266 already did the icon — verify only).

## Log
(appended per step)

### Step 1 — EDITOR'S NOTE → PR #271 (night2/editors-note)
Research (3): (a) Clash Royale chest-open: the reward NUMBER is the largest glyph on screen, the screen title is a fraction of it — our 100px wordmark was out-shouting the 96px gift. (b) Balatro's score pop: the counter ticks AND the plate bumps on every landing — ours already does (gains #262); keep it. (c) Pet Sim 99 / Genshin claim screens: the claim button goes dead for the whole flight so the player can't leave the reward mid-air — ours flipped to PLAY instantly on the server ok. Built: title 76px (clears the pill at 1366), captions 20/18, R7 76px + shadow, rolls 20, SHOWS ONCE 16 Bungee, phone gift 68px + band behind the trade, 'flying' phase → KitButton disabled until GainLayer onDone. Shots: claude/night-oct8-r2/s1-note-1366x657.jpg, s1-note-states-390x844.jpg. e2e season2-reset 2/2 local green.

## REPORT
(filled last)

### Step 2 — RESULTS → PR #272 (night2/results)
Research (3): (a) Balatro's round-end: one number dominates (the hand total), its parts sit in a strip at half the size — ours had the WORDS line (44px) bigger than the TOTAL (34px), inverted. (b) Vampire Survivors results: every reward is one row "label · number", no prose; a row with nothing to say isn't drawn — our season-2 "+0 XP" block was an always-empty row. (c) Clash Royale battle-end: the equation shape "base × mult = total" reads only when the operators are singletons — ours printed "× ×15.74". Built: TOTAL 44px (42 on the Chromebook, floor 38; phones 44), WORDS 34, bonus 28, chips/×tag/LV 18, every 13 floor → 14, +0 XP block hidden (it pushed a 2-bonus WIN tally under MENU at 1366×657), equation boxes flex:none, GEMS 32% + no word label, phones stack GEMS/TOTAL + wallets never clip. Shots: claude/night-oct8-r2/s2-results-1366x657.jpg, s2-results-phones.jpg. e2e v2-results + ko-screen 46/46 local green.

### Step 3 — UPGRADES → PR #273 (night2/upgrades)
Research (3): (a) Clash Royale's upgrade card: the price lives ON the button in the biggest type on the panel — ours was a 16px sub-line. (b) Pet Sim 99 enchant / upgrade sheets: "×4 → ×8" effect figure is the headline, the current value dim, the next value loud in the accent colour. (c) Genshin's talent level-up: the per-level stat row under the multiplier is kept but small (the honest rate), never competing. Built: the POWER multiplier line "×4 → ×8" (next 60px cyan + shadow; 44 on short laptops/phones) is the headline, the rate "12 → 24 XP / KEY" sits under it at 22/26 with the unit at 16, the price on the HOLD TO BUY button is 28px (24 short/phone), "XP / LETTER" → "XP / KEY" (ShopV2 is season 2 only; ShopScreen's season-1 copy untouched), every 13px floor on phones → 14. Shots: claude/night-oct8-r2/s3-upgrades-1366x657.jpg, s3-upgrades-phones.jpg (390 · NEED WINS state · 360x640). e2e v2-shop + numbers-audit + season2 8/8 local green.

### Step 4 — STATS → PR #274 (night2/stats)
Research (3): (a) Balatro's run-info multiplier chain: the product first and biggest, every factor a tile with the FIGURE as its first line and the source under it — ours had the name line first and the figure last. (b) Vampire Survivors' stat sheet: label rows carry the number flush and loud, the icon decorative under/next to it. (c) Pet Sim 99 multiplier breakdown: unchanged tiles (×1) stay in the row, dimmed, so the formula always reads BASE × A × B × C × D — kept. Built: chip FIGURE is the first line (order:-1), icon + name + tag sit under it (phones 32px figures); XP tab unit "XP / LETTER" → "XP / KEY"; MARK chip → GEAR, INDEX tag → GEARS (component-level label map; statBoard ids untouched). Verified: WINS ×3 = 10 × 1 × 3 × 1 × 1 → 30 WINS / WORD; XP ×12 = 1 × 4 × 3 × 1 × 1 → 12 XP / KEY; numbersAudit.s2 + statChain.s2 + statBoard unit 11/11, numbersAudit.live 3/3 (no math touched). e2e v2-stats 10/10 local (its XP / LETTER expectation updated to XP / KEY). Shots: claude/night-oct8-r2/s4-stats-1366x657.jpg, s4-stats-390x844.jpg.
