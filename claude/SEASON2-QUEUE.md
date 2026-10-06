# SEASON 2 — checklist + queue (re-read before every step; write result + PR # after each)
Source of truth: Andy's goal (oct5 ~19:00) + claude/mockups/v2/progression-v3.md (North star). Andy's notes outrank everything.
Rules: merge each PR when green · never stop to ask except SQL Andy must run · Claude never runs migrations · one heavy local job at a time · e2e + sims on GitHub Actions only · kill preview servers after every run · after a usage limit resume from THIS file · never end a turn while steps remain.
Every screen: 1280×551, 1366×657, 1920×1080, 390×844 · no text < 13px · no scrollbars · formatNum · transform/opacity only · REDUCE MOTION · before/after shots of each size attached to the PR · screenshot next to its mockup before merging.

## DONE
- [x] #206 board rebirth play guard (migration 020 — superseded by 021)
- [x] #207 REDUCE MOTION toggle · #208 menu stars/chip · #209 roll-v1 visuals
- [x] #211 v2 KIT (src/components/kit)
- [x] #210 PHASE 1 server rebirth (lb_rebirth / lb_ascend, CI spammer hard check) — ANDY: RUN 021

## IN PROGRESS (agents running — do not interrupt)
- [~] PHASE 2a MENU — PR #215 open (payload −4.7 KB; JOIN ROOM via mode dialogs; KEY TIER → POWER copy). HOLD merge until P0 confirms main green. After merge: CLAUDE.md CANONICAL MENU TITLE section must be updated (wordmark now follows the mockup).
- [~] PHASE 3 progression v3 behind SEASON2 — PR #214 open, CI sims tuning (agent running) — sims must hit median R1 ~12 min / R5 ~1.5 h / R10 ~7 h, fast ≤ 2×

## QUEUE (in order)
- [~] P0 (agent running; also: unit test '021 SQL mirrors rebirthRules' red on main since #210) main E2E red since ~14:00 (1 shard fails per merge): find the flaky/broken spec, fix for real (no skip / no retry bump), confirm 3 green main runs in a row. BLOCKS every new screen PR.
- [ ] PHASE 2b ROLL / INDEX / MARK CARD finish vs Roll/Index/MarkCard.dc.html
- [ ] PHASE 2c REBIRTH (hold-to-rebirth → performRebirth, one at a time, YOU GET, unlocks track "SOON" until v3)
- [ ] PHASE 2d SHOP (POWER panel hold-to-buy; gems STOCK grid behind a flag)
- [ ] PHASE 2e STATS · ACHIEVEMENTS · LEADERBOARD (rank titles, top-3 case, real data)
- [ ] PHASE 4 THE RESET (ready, OFF): migration snapshots old rebirths, resets all but usernames, gems = round5(300 + 40 × old rebirths); SEASON 2 welcome (Season2.dc.html) once per player, server-flagged; SQL → claude/run-season2.sql; tell Andy; SEASON2 flips on only after he runs it
- [ ] PHASE 5 every other screen with the kit (no centre popups): level-up/rank-up/secrets/reward popups → top banners or gone; results; KO; WB HUD; SAT case closed; FUSE frenzy; CHAIN + RACE HUDs; tutorial spotlights; room code + username; settings
- [ ] P9 mockups — COMMITTED via #212 (merged); then, then one PR each, in order:
  - [ ] 9a KitLevelUp: XP-bar wrap + "+N LV" chip, top-edge rank-up banner (v3 rank names), 16 rank plates next to names on the board, edge unlock toasts. Nothing mid-screen. No wins for rank-ups.
  - [ ] 9b Results/KO: one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big; every credited win its own line (no unexplained wins); replaces "where your wins came from".
  - [ ] 9c Word Bomb HUD: bomb + chunk centre, fuse ring, players on a ring (never sideways/stretched cards), hearts, alphabet bonus row; PAUSE-TO-LEARN ~2 s "NEXT TIME: SING" on blow-up. TIER 1 (WS) → 2 Playwright contexts + bot locally before merge.
  - [ ] 9d JOIN ROOM / LOBBY / SETTINGS: letter tiles for the code, 8-seat lobby, 5-row settings (REDUCE MOTION, NUMBER STYLE); no JOIN ROOM on the menu.

## ANDY TODO (SQL)
- [ ] run supabase/migrations/021_server_rebirth.sql then `notify pgrst` (skip 019 + 020)
- [ ] P10 MODE HUDs (mockups committed via docs/v2-mockups-p10 PR) — one PR each, real rules/payouts kept (mockup numbers are placeholders, NOT economy; e.g. SAT stays ×3), every win its own line, before/after shots at 1280×551 / 1366×657 / 1920×1080 / 390×844; WS/game-logic changes = Tier 1 → 2-context Playwright play-test before merge:
  - [ ] 10a KitTutorial: section 02 version B (typed letters fill the XP bar's slots, LV 2 at 8 letters) = first-30-seconds hook for new players; section 01 spotlight steps advance by DOING the action (no OK buttons); section 03 PAUSE-TO-LEARN edge card ("NEXT TIME: SING") in every mode where you can lose a word
  - [ ] 10b Fuse — version A: fuse line across the screen, 26-letter strip on the floor, ×5 FRENZY badge at the right edge, clutch = edge hazard bands, nothing in the centre
  - [ ] 10c Chain — version B: chain stacks up the left, huge next letter, wins/word column on the right; KEEP today's CHAIN texture quality (Andy loves it)
  - [ ] 10d SatRush — version A: giant "THIS WORD PAYS" number + base × ante × SAT chips, CASE CLOSED stamped file; NO scrollbars
  - [ ] 10e Race — version A: the RACE card's pink lanes + cars, current word huge with per-letter colour; whole words only
  - [ ] 10f Blitz — BLITZ tab: huge category, found/total, answers land as rarity tiles, AI BUILT ribbon, never claim AI judging; SKIP the IMPOSTER tab (no Imposter code; Andy decides later)
