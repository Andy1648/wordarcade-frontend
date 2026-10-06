# SEASON 2 — checklist + queue (re-read before every step; write result + PR # after each)
Source of truth: Andy's goal (oct5 ~19:00) + claude/mockups/v2/progression-v3.md (North star). Andy's notes outrank everything.
Rules: merge each PR when green · never stop to ask except SQL Andy must run · Claude never runs migrations · one heavy local job at a time · e2e + sims on GitHub Actions only · kill preview servers after every run · after a usage limit resume from THIS file · never end a turn while steps remain.
Every screen: 1280×551, 1366×657, 1920×1080, 390×844 · no text < 13px · no scrollbars · formatNum · transform/opacity only · REDUCE MOTION · before/after shots of each size attached to the PR · screenshot next to its mockup before merging.

## ANDY'S DEFINITIONS (verbatim, oct6 — these rule; order P0 → P2 → P3 → P5 → P6 → P7 → P8 → P4 code → P9 → P10)
Each = its own PR(s), mockup in claude/mockups/v2/ is the target (build the look exactly, real logic underneath), spec numbers from claude/mockups/v2/progression-v3.md. New screens render v3 behind the SEASON2 flag; live players see no change until the flip.

P3 REBIRTH + SHOP + ACHIEVEMENTS screens
 - Rebirth.dc.html: HOLD to rebirth (1s charge, shake, flash, slam), ONE at a time, calls lb_rebirth (server-checked, idempotent request id; button disabled until the server answers). YOU GET panel (×2 XP/wins, +gems), UNLOCKS diamond track (R1 ROLL, R2 AUTO ROLL, R3 2nd boost slot, R5 2nd MARK slot, R7 LUCK ×1.25, R10 ASCEND), hexagon plate (NO cog). At R10 an ASCEND action via lb_ascend (★ += R−9).
 - Shop.dc.html: POWER panel (wins only buy POWER: cost 100×4^P, hold-to-buy, tilted square plate). STOCK grid of 6 gem-priced items with odd prices (45/65/120/150/225/495), rarity bands, ×N LEFT, 5:00 restock timer, SOLD OUT stamp. Everything except POWER costs gems.
 - Achievements.dc.html: hero next-claim panel, 4×2 grid, tiers I–V, CLAIM pays GEMS (40–200) that fly to the counter, CLAIMED stamp. This is the ONLY place anything is claimed.

P4 THE RESET (code only — Andy runs the SQL and the flip)
 - Write supabase/migrations/0xx_season2_reset.sql + claude/run-season2.sql: wipe everything except usernames (levels, rebirths, stars, wins, POWER, marks, gems, achievements); gems = round to 5 of (300 + 40 × old rebirths). Safe to re-run (one-shot guard). Never run it.
 - Season2.dc.html welcome: shown ONCE after the reset — SEASON 2, "SORRY FOR THE MAINTENANCE · EVERYONE STARTS FRESH", OLD RUN R → YOU GET gems, rolls count with "EPIC+ GUARANTEED" when ≥50 rolls, COLLECT flies gems into the wallet. Never a basic popup.
 - The SEASON2 flag flip is one config line Andy approves ("flip SEASON2").

P5 MENU = #215 (Menu.dc.html): left column wins/gems pills + SHOP/ROLL/INDEX/REBIRTH; top-right leaderboard/stats/achievements; logo; simple XP bar (LV left, xp/need right, starts at 0, wraps on level-up); type-anywhere; game cards centred, scroll sideways; fits 1280×551, 1366×657, 1920×1080, phone.

P6 ROLL + INDEX (Roll.dc.html, Index.dc.html, MarkCard.dc.html): 75 gems a roll; decelerating reel swinging through marks; rarity-scaled reveals; AUTO roll until a chosen rarity; pity bars (EPIC 50 / LEGENDARY 500); INDEX separate screen with locked silhouettes, ★ dupe pips, x/y → ★n; cog ring on marks only (spins EPIC+, rainbow SECRET). No paid luck, no paid-only marks.

P7 POPUP PURGE: remove every centre-screen popup and every menu claim notification (incl. "claimed wins" toasts). Rank-ups pay nothing (status only, shown via the KitLevelUp top-edge banner). Unlocks = edge toasts. Gains = motion on the bar/counters. Achievements page is the only claim place.

P8 STATS + LEADERBOARD (Stats.dc.html, Leaderboard.dc.html): stats = total multiplier FIRST (Balatro-style), tabs, replay. Leaderboard = white podium, rank-title plates (v3 ladder KEYMASH…ENDGAME), ▲▼, pulsing own row (also correct when you ARE top 3), ALL TIME / THIS WEEK. In season 2 board order is ★ → rebirths → level (write that view change as a migration for Andy; never run it).

Then P9, P10 as already queued. STANDING RULES: re-read this checklist before every step; record result + PR # after each; resume from it after a usage limit; never end the turn while steps remain; one heavy local job at a time, CI on GitHub; Claude never runs migrations.

## STATUS BY P
- P0: #213 merged; #216 open; main E2E green on 4aec9e8 + 9c9b3aa, c13f436 running (agent confirming 3 in a row)
- P2: progression v3 — #214 MERGED + LIVE (c13f436), flag OFF
- P3: next to build (after P0 frees the machine)
- P4: reset — partial work in ../s2reset (paused); merges in its turn (after P8)
- P5: #215 open, CI red, fix paused (resumes after P0)
- P6, P7, P8, P9, P10: queued

## GOAL (Andy): every item P0–P10 merged on main with CI green — except P4's SQL run and the SEASON2 flip (Andy's).

## PIPELINE (Andy, oct5 late)
- While a PR is in CI, start building the next queue item on a fresh branch off main. Up to 2 PRs in CI at once.
- Merges in order, one at a time: before each merge rebase on main and let CI go green again.
- Local work: ONE heavy job at a time (CI doesn't count). Two PRs touching the same files (menu/kit): finish the first before starting the second.
- ORDER (Andy): P2 → P3 → P5 → P6 → P7 → P8 → P4 code (behind the flag) → P9 → P10, after P0.
  ANDY'S MAPPING (correction): P2 = progression v3 (#214) · P4 = the reset (code behind the flag) · P5 = the menu (#215) and the screen rebuilds. P3 / P6 / P7 / P8 = not defined in any file this session — asked Andy; until then P3 = next after P2 is taken as the remaining phase-2 screens? NO — held: next build after P0 is #215's fix (P5).
  P6 / P7 / P8: NOT DEFINED in any queue/notes file this session — skipped until Andy's definitions land (flagged in the report).

## DONE
- [x] #206 board rebirth play guard (migration 020 — superseded by 021)
- [x] #207 REDUCE MOTION toggle · #208 menu stars/chip · #209 roll-v1 visuals
- [x] #211 v2 KIT (src/components/kit)
- [x] #210 PHASE 1 server rebirth (lb_rebirth / lb_ascend, CI spammer hard check) — ANDY: RUN 021

## IN PROGRESS (agents running — do not interrupt)
- [~] PHASE 2a MENU — PR #215 open, CI RED (menu-vgap ×5, claims-via-stats ×2, game-fill fuse ×2, viewport-integrity fuse @1366, reduce-motion-toggle ×2) — fix PAUSED (one heavy local job: P0 first), resumes after P0; (payload −4.7 KB; JOIN ROOM via mode dialogs; KEY TIER → POWER copy). HOLD merge until P0 confirms main green. After merge: CLAUDE.md CANONICAL MENU TITLE section must be updated (wordmark now follows the mockup).
- [x] P2 (Andy's numbering) progression v3 behind SEASON2 — #214 MERGED + LIVE (c13f436), flag OFF. CI 10 h sim: median R1 13.0 min / R5 1.23 h / R10 6.94 h; fast R1 7.4 min / R5 47.9 min / R10 4.33 h (×1.6–1.75 median); casual R1 22.6 min / R5 2.82 h / R10 not in 10 h; spammer 0 extra. Tuned XP_BASE 7→8.4, POWER_XP_STEP 1.8→1.65, POWER_COST_STEP 4→4.8 (±20%). OVERDRIVE off in S2. SQL 022_season2_board.sql written (Andy runs before the flip). — sims must hit median R1 ~12 min / R5 ~1.5 h / R10 ~7 h, fast ≤ 2×

## QUEUE (in order)
- [~] P0 (agent running; also: unit test '021 SQL mirrors rebirthRules' red on main since #210) main E2E red since ~14:00 (1 shard fails per merge): find the flaky/broken spec, fix for real (no skip / no retry bump), confirm 3 green main runs in a row. BLOCKS every new screen PR.
- [ ] PHASE 2b ROLL / INDEX / MARK CARD finish vs Roll/Index/MarkCard.dc.html
- [ ] PHASE 2c REBIRTH (hold-to-rebirth → performRebirth, one at a time, YOU GET, unlocks track "SOON" until v3)
- [ ] PHASE 2d SHOP (POWER panel hold-to-buy; gems STOCK grid behind a flag)
- [ ] PHASE 2e STATS · ACHIEVEMENTS · LEADERBOARD (rank titles, top-3 case, real data)
- [~] PHASE 4 THE RESET (agent PAUSED for the one-heavy-local-job rule — resume after P8; partial work in ../s2reset, feat/season2-reset stacked on #214; SQL → claude/run-season2.sql + rollback) (ready, OFF): migration snapshots old rebirths, resets all but usernames, gems = round5(300 + 40 × old rebirths); SEASON 2 welcome (Season2.dc.html) once per player, server-flagged; SQL → claude/run-season2.sql; tell Andy; SEASON2 flips on only after he runs it
- [ ] PHASE 5 every other screen with the kit (no centre popups): level-up/rank-up/secrets/reward popups → top banners or gone; results; KO; WB HUD; SAT case closed; FUSE frenzy; CHAIN + RACE HUDs; tutorial spotlights; room code + username; settings
- [ ] P9 mockups — COMMITTED via #212 (merged); then, then one PR each, in order:
  - [ ] 9a KitLevelUp: XP-bar wrap + "+N LV" chip, top-edge rank-up banner (v3 rank names), 16 rank plates next to names on the board, edge unlock toasts. Nothing mid-screen. No wins for rank-ups.
  - [ ] 9b Results/KO: one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big; every credited win its own line (no unexplained wins); replaces "where your wins came from".
  - [ ] 9c Word Bomb HUD: bomb + chunk centre, fuse ring, players on a ring (never sideways/stretched cards), hearts, alphabet bonus row; PAUSE-TO-LEARN ~2 s "NEXT TIME: SING" on blow-up. TIER 1 (WS) → 2 Playwright contexts + bot locally before merge.
  - [ ] 9d JOIN ROOM / LOBBY / SETTINGS: letter tiles for the code, 8-seat lobby, 5-row settings (REDUCE MOTION, NUMBER STYLE); no JOIN ROOM on the menu.

## ANDY TODO (SQL)
- [ ] (at the SEASON2 flip, not before) run supabase/migrations/022_season2_board.sql, then claude/run-season2.sql (phase 4), then `notify pgrst`
- [x] 021 RUN (Andy, oct5 late: lb_caps rebirth_rpc true, leaderboard has stars) — server rebirth is live
- [ ] P10 MODE HUDs (mockups committed via #217, merged) — one PR each, real rules/payouts kept (mockup numbers are placeholders, NOT economy; e.g. SAT stays ×3), every win its own line, before/after shots at 1280×551 / 1366×657 / 1920×1080 / 390×844; WS/game-logic changes = Tier 1 → 2-context Playwright play-test before merge:
  - [ ] 10a KitTutorial: section 02 version B (typed letters fill the XP bar's slots, LV 2 at 8 letters) = first-30-seconds hook for new players; section 01 spotlight steps advance by DOING the action (no OK buttons); section 03 PAUSE-TO-LEARN edge card ("NEXT TIME: SING") in every mode where you can lose a word
  - [ ] 10b Fuse — version A: fuse line across the screen, 26-letter strip on the floor, ×5 FRENZY badge at the right edge, clutch = edge hazard bands, nothing in the centre
  - [ ] 10c Chain — version B: chain stacks up the left, huge next letter, wins/word column on the right; KEEP today's CHAIN texture quality (Andy loves it)
  - [ ] 10d SatRush — version A: giant "THIS WORD PAYS" number + base × ante × SAT chips, CASE CLOSED stamped file; NO scrollbars
  - [ ] 10e Race — version A: the RACE card's pink lanes + cars, current word huge with per-letter colour; whole words only
  - [ ] 10f Blitz — BLITZ tab: huge category, found/total, answers land as rarity tiles, AI BUILT ribbon, never claim AI judging; SKIP the IMPOSTER tab (no Imposter code; Andy decides later)
