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

P9 now has pictures — the untracked files in claude/mockups/v2/ (Results.dc.html, BombHUD.dc.html, KitLevelUp.dc.html, RoomSettings.dc.html): commit them on their own docs branch first, then build each as its own PR, in this order:
 9a KitLevelUp → XP-bar wrap + "+N LV" chip, top-edge rank-up banner (v3 rank names), 16 rank plates next to names on the board, edge unlock toasts. Nothing in the middle of the screen. No wins for rank-ups.
 9b Results/KO → one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big. Every win credited must appear as its own line (no unexplained wins). Replaces the old "where your wins came from" breakdown.
 9c Word Bomb HUD → bomb + chunk centre, fuse ring, players on a ring (NEVER sideways/stretched cards), hearts, alphabet bonus row. PAUSE-TO-LEARN: when you blow up, show for ~2s one valid word containing the chunk ("NEXT TIME: SING") before the bomb moves on. This is Tier-1 (game logic touches the WS) → play-test with 2 Playwright contexts + bot locally before merging, as the backend rule says.
 9d JOIN ROOM / LOBBY / SETTINGS → letter tiles for the code, 8-seat lobby, 5-row settings (REDUCE MOTION, NUMBER STYLE). No JOIN ROOM button on the menu (players click a mode).
Every screen: check 1280×551, 1366×657, 1920×1080 and 390×844 phone; no text <13px; no scrollbars; numbers through formatNum; transform/opacity only; works with REDUCE MOTION on. Attach before/after shots of each size to the PR.

P10 MODE HUDs — new mockups in claude/mockups/v2/ (commit them on a docs branch first). Ship the version named here; ignore the other:
 10a KitTutorial → section 02 version B (typed letters become the XP bar's slots, LV 2 at 8 letters) as the first-30-seconds hook for new players; section 01 spotlight steps advance by doing the action (no OK buttons); section 03 PAUSE-TO-LEARN edge card ("NEXT TIME: SING") in every mode where you can lose a word.
 10b Fuse → version A (fuse line across the screen, 26-letter strip on the floor, ×5 FRENZY badge at the right edge, clutch = edge hazard bands, nothing in the centre).
 10c Chain → version B (chain stacks up the left, huge next letter, wins/word column on the right). Keep today's CHAIN texture quality — Andy loves it.
 10d SatRush → version A (giant "THIS WORD PAYS" number + base × ante × SAT chips, CASE CLOSED stamped file). NO scrollbars.
 10e Race → version A (the RACE card's pink lanes + cars, current word huge with per-letter colour). Whole words only.
 10f Blitz → BLITZ tab (huge category, found/total, answers land as rarity tiles, AI BUILT ribbon, never claim AI judging). SKIP the IMPOSTER tab — there's no Imposter code in the repo; Andy decides later.
Keep every mode's real rules/payouts; only the look changes. Mockup numbers are placeholders, NOT economy changes (e.g. SAT "8× bomb" is illustrative; the live SAT ×3 stays unless the v3 sim says otherwise). Every win shown as its own line. Each mode = its own PR, before/after shots at 1280×551, 1366×657, 1920×1080 and 390×844 attached. Any change touching WS/game logic = Tier-1 → 2-context Playwright play-test before merge.
(Mockups: P9 committed via #212, P10 via #217 — both merged.)

STANDING RULES: re-read this checklist before every step; record result + PR # after each; resume from it after a usage limit; never end the turn while steps remain; one heavy local job at a time, CI on GitHub; Claude never runs migrations.

## STATUS BY P
- P0: DONE — #213 + #216 merged; main E2E green 4× in a row (37406619410, 37408883717, 37410602426, 37411222042) + unit CI green. Causes: FUSE warm-up scan blocking keystrokes (fuse.js set lookup, 2,593 → 230 ms), roll-robust reveal covering ROLL, kit stamp overflow at 390, CRLF in the 021 SQL test, word-landing secret roll, SAT lineup size
- P2: progression v3 — #214 MERGED + LIVE (c13f436), flag OFF
- P3: PRs open — #218 REBIRTH (updating with main, merging first), #219 SHOP (green; rebase keeps both ShopScreen SEASON2 wrappers), #220 ACHIEVEMENTS (CI). Flag OFF = live screens untouched. Payload ~962.9K (tight).
- P4: reset — partial work in ../s2reset (paused); merges in its turn (after P8)
- P5: #215 fixed + pushed (6a83f86; payload 958,114, −4.8 KB vs main), CI running; merges after P3
- P6: BUILDING (feat/v2-roll-index, only heavy local job)
- P7, P8, P9, P10: queued

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
- [x] P0 DONE (#213, #216; main green 4× in a row) (was: also: unit test '021 SQL mirrors rebirthRules' red on main since #210) main E2E red since ~14:00 (1 shard fails per merge): find the flaky/broken spec, fix for real (no skip / no retry bump), confirm 3 green main runs in a row. BLOCKS every new screen PR.
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
- [ ] (at the SEASON2 flip, not before) run 022_season2_board.sql → 024_season2_weekly.sql → 025_season2_convert.sql (claude/run-season2-convert.sql, from feat/season2-convert) → `notify pgrst` → say "flip SEASON2". NO WIPE: run-season2.sql / 023 are CANCELLED (Andy oct6) and are being deleted from main.
- [x] 021 RUN (Andy, oct5 late: lb_caps rebirth_rpc true, leaderboard has stars) — server rebirth is live
- [ ] P10 MODE HUDs (mockups committed via #217, merged) — one PR each, real rules/payouts kept (mockup numbers are placeholders, NOT economy; e.g. SAT stays ×3), every win its own line, before/after shots at 1280×551 / 1366×657 / 1920×1080 / 390×844; WS/game-logic changes = Tier 1 → 2-context Playwright play-test before merge:
  - [ ] 10a KitTutorial: section 02 version B (typed letters fill the XP bar's slots, LV 2 at 8 letters) = first-30-seconds hook for new players; section 01 spotlight steps advance by DOING the action (no OK buttons); section 03 PAUSE-TO-LEARN edge card ("NEXT TIME: SING") in every mode where you can lose a word
  - [ ] 10b Fuse — version A: fuse line across the screen, 26-letter strip on the floor, ×5 FRENZY badge at the right edge, clutch = edge hazard bands, nothing in the centre
  - [ ] 10c Chain — version B: chain stacks up the left, huge next letter, wins/word column on the right; KEEP today's CHAIN texture quality (Andy loves it)
  - [ ] 10d SatRush — version A: giant "THIS WORD PAYS" number + base × ante × SAT chips, CASE CLOSED stamped file; NO scrollbars
  - [ ] 10e Race — version A: the RACE card's pink lanes + cars, current word huge with per-letter colour; whole words only
  - [ ] 10f Blitz — BLITZ tab: huge category, found/total, answers land as rarity tiles, AI BUILT ribbon, never claim AI judging; SKIP the IMPOSTER tab (no Imposter code; Andy decides later)

## RESUME POINT (usage limit, oct6)
- #218 REBIRTH: merged if green at the limit (check `pulls/218`); else update-branch + merge when green.
- Then in order: #219 SHOP (update-branch, keep both ShopScreen SEASON2 wrappers) → #220 ACHIEVEMENTS (green, needs update-branch) → #215 MENU (CI was running on 6a83f86).
- P6 agent STOPPED mid-build in ../p6roll (feat/v2-roll-index, not pushed) — resume it.
- P4 agent paused in ../s2reset. Then P7, P8, P4 merge, P9, P10.

## STATUS (oct6, resumed)
- #218 REBIRTH: MERGED (d15ba97), behind SEASON2.
- #219 SHOP: conflict with #218 resolved (both SEASON2 wrappers kept), pushed 909f368, CI running → merge next.
- #220 ACHIEVEMENTS: green; update-branch + merge after #219.
- #215 MENU: CI red (FUSE viewport-integrity/game-fill @1366/1280, season2.spec @1280) — menu agent fixing (only heavy local job); merge after the fix goes green.
- P6: paused in ../p6roll (resume after the #215 fix frees the machine). Then P7, P8, P4 merge, P9, P10.
- ANDY (oct6): #215 menu TIMEBOXED to 08:13 local — if still red then: PARK it (PR stays open, reason noted here), menu ships LAST. #219 / #220 merge as soon as green (independent of #215). Order now: P6 (resumed) → P7 → P8 → P4 reset code → P9 → P10 → #215.
- P6: PR #221 open (df91aaf) — v2 roll/index mockups were identical to roll-v1 (#209 already built them); adds AUTO unlock at R2 under SEASON2 + 75-gem season2 e2e. QUESTION for Andy: P6 says "no paid luck" but Shop mockup (#219) sells ×2 LUCK for 120 gems — treated as allowed (gems are earned) unless Andy says otherwise.
- P7: BUILDING (feat/v2-popup-purge)
- #219 SHOP MERGED (c31d447). #215 MENU green (9/9) — merges after #220 (update + green first).
- #220 ACHIEVEMENTS MERGED (d6b98f5) — P3 COMPLETE (#218 #219 #220). #215 conflict (S2Trophy) resolved, CI re-running → merge when green.
- #215 MENU MERGED + LIVE (40ac7bf) — P5 DONE. Prod smoke 1366×657 + 390×844: 0 errors, no scroll. Note: live (S1) achievement claim prompt overlaps the bottom of the Word Bomb card at 1366×657 — P7 removes it under SEASON2. TODO: CLAUDE.md CANONICAL MENU TITLE section to update (wordmark now per mockup). #221 updating with main → merge when green.
- P7: PR #222 open (42c5c82) — every centre popup + menu claim notification removed under SEASON2 (25-row inventory in PR), rank-ups → top-edge banner (pay nothing), unlocks → right-edge toasts; payload 962,337. Merges after #221. P8: BUILDING (feat/v2-stats → feat/v2-leaderboard).
- #221 ROLL/INDEX MERGED (0079e8b) — P6 DONE. #222 conflict (S2Trophy) resolved → CI → merge when green.
- P8: PRs #223 STATS (b863b8b) + #224 LEADERBOARD (e17420a) open; 022 covers ALL TIME; new 024_season2_weekly.sql for THIS WEEK (Andy runs at the flip). Note: no CHANGE NAME on the v2 board (S2 only). Merge after #222.
- P4: reset agent RESUMED (023_season2_reset.sql + claude/run-season2.sql + Season2 welcome + one-line flip prepared, NOT flipped).
- P4: PR #225 open (a7573db) — 023_season2_reset.sql = claude/run-season2.sql + claude/rollback-season2.sql; welcome per Season2.dc.html; flip = SEASON2_LIVE in src/progress/season.js (false). Merges after #223/#224. P9: BUILDING (9a feat/v2-levelup → 9b results → 9c WB HUD (Tier 1, 2-context play-test) → 9d rooms).
- #222 POPUP PURGE MERGED (26918c9) — P7 DONE. #223 updating with main → merge when green, then #224, #225.
- #223 STATS MERGED (216a6ed) · #224 LEADERBOARD MERGED (272a8d8) — P8 DONE. #225 RESET: conflicts (boardMock, installUi) resolved keeping both sides, CI running → merge when green.
- ANDY (oct6): after P4 (#225) merges, make main E2E reliably green again (red after #215 + #223: websocket-boundary create_room, claims-via-stats:57) BEFORE P9. P9 agent PAUSED (partial work in ../p9a etc.); fixer agent on fix/main-flakes-2.
- #225 RESET MERGED + LIVE (7642fa5) — P4 code DONE (flag OFF). Prod check: a live econ-12 save (R3, KEY 4, 5,000 wins) survives two loads untouched, no welcome, 0 errors. ANDY: run 022 → 024 → claude/run-season2.sql → notify pgrst → say 'flip SEASON2'. NEXT: main E2E green (fixer agent) → then P9.
- ANDY (oct6) XP BAR SMOOTH — inserted before P9, after the main-green fix: KitXpBar (menu + everywhere) → 3 layers (dark track, solid yellow fill + one thin top highlight, black ink outline); remove kx-ticks / kx-ticks-low / kx-mid / kx-low / kx-fill-lo / ghost bars; height ~60%; LV left + xp/need right. Motion: scaleX glide 250ms cubic-bezier(.2,.8,.2,1), retarget mid-tween, fast typing = one glide; wrap = glide to 100% → 150ms white sweep → 0 → continue; climbs ≤1s. Kit gallery too. Before/after GIF at 1366×657. Merge when green. — BUILDING (fix/xpbar-smooth)

## ANDY (oct6, later) — BEFORE P9, verbatim:
A) MENU TYPING: remove the visible typed-text box in the middle of the menu. Typing anywhere still works, but what you type shows with the OLD letter animations from before the v2 menu (find them in git history before #215 and restore them exactly). Nothing else on the menu changes.
B) NO RESET. Andy cancelled the Season 2 wipe — players keep their progress. Close/park the P4 reset PR (don't merge 023, delete run-season2.sql from the queue, Andy runs no wipe). Replace it with a one-time CONVERSION when SEASON2 flips:
 - KEEP as-is: username, levels, lifetime words/letters, wins, marks, gems, achievements.
 - REBIRTHS: keep up to R10; rebirths above 10 convert to ★ stars at a rate the sim picks.
 - KEY TIER → POWER: convert at a rate the sim picks.
 - HARD RULE: run the v3 CI sim on a snapshot of the REAL leaderboard rows (incl. R100 imbetterthanandy, R29, R22) after conversion. Nobody may progress faster than 2× the median v3 pace, and nobody may be stuck (every player's next rebirth reachable in under 2h of median play). Pick the conversion rates that pass, and write them + the sim results into the checklist.
 - Server-side: the conversion is a migration Andy runs (write it, never run it). Idempotent, one-shot, and it only touches rebirths/stars/POWER.
 - Season2.dc.html welcome becomes an "UPDATE" card shown once: what's new, your converted stars/POWER. No "everyone starts fresh", no gems gift.
Then continue P9/P10.
STATUS: #225 (reset) had ALREADY merged (7642fa5) before the cancel — nothing ran (flag OFF, no SQL). feat/season2-convert deletes 023/run-season2.sql/rollback from main and replaces the reset client code with the conversion + UPDATE card. A = fix/menu-typing-pops BUILDING. B = feat/season2-convert BUILDING (sims on CI). #227 main-flakes + #228 XP bar in CI.
- #227 MAIN FLAKES MERGED (c6572f3) · #228 XP BAR SMOOTH MERGED (fad6f82) — awaiting main E2E green streak.
- B CONVERSION — PR #229 (459e37e). RATES (CI sim pick): rebirths kept ≤ R10; ★ = floor((R − 10) / 10) (R100 → ★9, R29/R20 → ★1, R13 ≤ → ★0); POWER = floor(KEY × 1.5), capped at 1 + kept rebirths (≤ P11). Kept as-is: level, lifetime words/letters, lifetime wins, gems, marks, achievements.
  HARD RULE (CI, all 26 real rows × min/typical/max KEY/wallet/gems, 1,202 bot runs): PASS — worst pace ×1.75 (limit ×2; pace = minutes of the median's own climb covered per minute, over 2 h), slowest next rebirth 1.14 h (limit 2 h); extra check: a converted player never ranks above a median S2 player at the same rebirth count.
  Per row (typical): R100 → R10 ★9 P11 (ascend 1.1 min) · R29 / R20s → R10 ★1 P11 · R13/R11/R10 → R10 ★0 P11 · R9 → R9 P10 (next 40 min) · R7 → R7 P8 (30 min) · R6/R5 → P7/P6 · R≤4 unchanged.
  ⚠ ANDY DECISION: the S2 WINS WALLET is CAPPED at the next POWER price (lifetime wins + normal wallets untouched; season-1 taw.wins never touched). Uncapped, old wallets (R29 ≈ 10^23 wins) buy POWER instantly and 5 rows break the 2× rule (Xavi ×2.68, elol ×3.0, NoBuffCookies ×2.24, Joseph ×2.43, InnerCityBoy ×3.42). This deviates from "keep wins as-is" — Andy to confirm before the flip.
  022 edited (unrun): converted S1 rows keep server rebirths/level (the words/100 cap applies only to brand-new names).
  FLIP ORDER: 022 → 024 → claude/run-season2-convert.sql (= 025) → notify pgrst → "flip SEASON2". 023 / run-season2.sql / rollback-season2.sql DELETED.
- #229 CONVERSION MERGED + LIVE (0ffd0b8): main has NO wipe (023 / run-season2.sql / rollback-season2.sql gone); 025 + claude/run-season2-convert.sql + rollback present. Prod check: a live R13 KEY6 5,000-wins save is untouched with the flag OFF, 0 errors. B DONE (pending Andy's wallet-cap decision). Next: A menu typing (building), main E2E streak, then P9.
- MAIN GREEN again: 4 E2E in a row (7642fa5, c6572f3, fad6f82, 0ffd0b8). A MENU TYPING — PR #230 (7cb4e6c): the box removed (old pops were the untouched MenuXpFx pool — the box just drew on top); empty slot kept so cards don't move; CI running. P9 RESUMED (9a on the new KitXpBar).
- #230 MENU TYPING MERGED + LIVE (945af23) — A DONE. Remaining: P9 (9a building), P10. Andy decisions pending: S2 wallet cap; empty typed-slot vs cards growing.

## NEW PRIORITY ORDER (Andy, oct6 evening — verbatim; REPLACES the rest of the queue; P9/P10 move to the END)
1. ASAP: remove the "TYPE ANYTHING" label/box in the middle of the menu entirely. Typing anywhere still works with the old letter animations. Ship alone, merge when green.

2. PROGRESSION v3.1 (before the SEASON2 flip — players are spamming cheap rebirths and we can't reset anyone):
 - REBIRTH SPENDS LEVELS instead of resetting to LV1: cost(R) = levels needed for the next rebirth; on rebirth, level -= cost (leftover levels stay). Cost scales up every rebirth.
 - Rebirth worth reduced: ×1.5 XP and wins per rebirth instead of ×2 (stars/POWER/marks unchanged).
 - AUTO REBIRTH: a toggle unlocked at R2; when level ≥ cost it rebirths automatically. Every rebirth still goes through lb_rebirth (server-checked, idempotent, the 12/hour pace cap). Write the migration that changes lb_rebirth from level=1 to level=level−cost (Andy runs it; never run it).
 - Tune the cost curve with the v3 CI sim on the REAL board snapshot: time to R1 ≈ 15 min, R5 ≈ 2 h, R10 ≈ 10 h median; nobody faster than 2× median; a spammer clicking 1000× gains nothing extra; the converted R10 ★9 player can't run away. Write the chosen constants + sim table into the checklist and claude/mockups/v2/progression-v3.md.
 - Update the rebirth screen copy: "COSTS N LEVELS · KEEP THE REST", YOU GET ×1.5.

3. MENU / VISUALS (after 2):
 - Show SHOP/ROLL/INDEX/REBIRTH buttons from the start, LOCKED (padlock + "R1" etc.) until unlocked, so the left side isn't empty.
 - Rename SHOP → UPGRADES everywhere.
 - No mark equipped → the mark chip says "ROLL" with a notification dot.
 - Chromebook (1366×657): game cards are shifted right — centre them exactly. Check 1280×551 and 1920×1080 too.
 - XP bar: slower and smoother. Every gain glides over ~600ms with ease-out, retargeting mid-glide (never steps or restarts). Fast typing = one continuous slow climb. Level wrap: glide to full, soft sweep, continue. Attach a GIF.
 - Buttons look empty: fill each with its icon big, label bigger, a value or state where it has one (UPGRADES: cheapest POWER price; ROLL: gems/75; REBIRTH: progress to next cost).
4. NUMBERS LOGIC CHECK: audit every number shown on the menu, stats, rebirth, upgrades, roll and results screens against the real formulas. The stats screen must read as BASE × each multiplier = TOTAL, and the math must actually multiply out. Fix anything that doesn't add up and list each fix in the PR.
Then the SEASON2 flip prep, then P9/P10. Same standing rules.

STATUS: P9 agent PAUSED (9a partial in ../p9a). Item 1 starting now (#230 removed the box but left an empty slot — removing that too).

## FINAL ORDER (Andy, oct6 ~17:00 — verbatim; REPLACES everything above; DEADLINE before 7 AM oct7)
Andy's decision: the FULL RESET is back ON. The progression is now FROZEN in claude/progression-FINAL.md (read it fully; the python sim is claude/progression-final-sim.py). It REPLACES v3's constants and the no-reset conversion.
1. If not merged yet: remove "TYPE ANYTHING" from the menu entirely (old letter animations stay).
2. PROGRESSION FINAL, behind SEASON2:
 - Swap v3 constants for FINAL's: need(n)=400×1.06^(n−1); XP/letter 10×2.5^POWER×2^R×(1+★)×MARK; game letters ×1, menu ×0.2 real dictionary words only (repeat decay ×0.5/×0.25/0 within 60s, >12 letters/s earns 0); wins/word 22×len/5×MODE×2^R×(1+★)×MARK (WB/Blitz 1, RACE 1.5, CHAIN 2, SAT 3, FUSE 1 + FRENZY ×5); POWER cost 300×8^P wins, ×2.5 XP/tier, kept through rebirth, reset on ascend.
 - REBIRTH spends 25×(R+1) levels, keeps leftovers, ×2. ASCEND at R=10+5×★ → +1★ (NOT R−9), R/POWER→0, LV1. AUTO REBIRTH toggle at R2. Unlocks: ROLL+INDEX from start, R1 AUTO ROLL, R2 AUTO REBIRTH, R5 2nd MARK slot, R7 LUCK ×1.25, R10 ASCEND.
 - Gems from games only (FINAL table). Mark multipliers COMMON ×1.1, RARE ×1.25, EPIC ×1.5, LEGENDARY ×2, MYTHIC ×3, SECRET ×5; pity EPIC+ 50, LEGENDARY+ 500.
 - New migration: lb_rebirth gate = level > 25×(R+1), then level −= that (not level=1); lb_ascend at R ≥ 10+5×★, ★+1. Never run it.
 - Port the FINAL sim into CI (casual/median/fast/menu-only + masher + spammer). It must reproduce the FINAL table ±25%, fast ≤ 2× median, masher ≈ 0, spammer = median. CI fails otherwise.
3. RESET back ON: undo #229's conversion. Restore the reset from git history (023 reset SQL + claude/run-season2.sql + rollback + the Season2Welcome screen from #225). Gems = round5(300 + 40×old rebirths). Everything except usernames resets. Andy runs the SQL; never run it.
4. ROLL system must work end-to-end with the FINAL gem economy (75 gems, pity, AUTO ROLL at R1, INDEX). Play-test it in the season2 preview.
5. Then the menu list: show UPGRADES/ROLL/INDEX/REBIRTH from the start (locked ones with a padlock + "R2" etc.); rename SHOP → UPGRADES; no mark equipped → chip says ROLL + notification dot; centre game cards exactly at 1366×657, 1280×551, 1920×1080; XP bar glides ~600ms ease-out with retargeting, never steps (GIF in the PR); fill the buttons (big icon, bigger label, live value: cheapest POWER price / gems÷75 / levels to next rebirth); stats screen = BASE × each multiplier = TOTAL and the math must multiply out; audit every displayed number against the FINAL formulas and list the fixes.
6. When 1–4 are merged: write claude/FLIP-STEPS.md with the exact SQL files in order for Andy, and stop before the flip.
STANDING RULES: re-read the checklist before every step; record result + PR # after each; resume after usage limits; never end the turn while steps remain; one heavy local job at a time, CI on GitHub; Claude never runs migrations.
NOTE: progression-final-sim.py's __main__ uses NEED0=100/G=1.08 (a rejected tuning per the md); the FROZEN constants are the md's (400 × 1.06). The CI port uses the md's constants and reproduces the md's table.
- FINAL STATUS (oct6 17:40): 1 → PR #233 (TYPE ANYTHING row gone entirely; REWARDS popup reserves its space) in CI. 2 → feat/progression-final BUILDING (026_progression_final.sql). 3 → feat/season2-reset-back BUILDING (restores 023 reset, removes #229 conversion). P9 partial work parked in ../p9a etc.
- FINAL 1 DONE: #233 MERGED + LIVE (53b03b9) — TYPE ANYTHING row gone entirely. 3: #234 updating with main → merge when green.
- FINAL 3 DONE: #234 RESET BACK MERGED + LIVE (e13ef5b) — #229 conversion reverted; 023 / claude/run-season2.sql / rollback / Season2Welcome restored. Prod check: live R13 save untouched with the flag OFF, 0 errors. 2: #235 in CI (1 failure so far, agent on it). 5a menu list BUILDING (feat/menu-list-final).
- FINAL 2 DONE: #235 PROGRESSION FINAL MERGED (5226513), flag OFF. Constants = the md's (none changed). CI hard check PASS (real modules, 40 h):
  | first to | casual | median | fast | menu |
  | R1 | 27 min (+23%) | 14 min (+14%) | 7 min (+22%) | 74 min (+1%) |
  | R3 | 1.6 h (+14%) | 49 min (+12%) | 27 min (+7%) | 11.7 h (0%) |
  | R5 | 3.9 h (+14%) | 2.0 h (+10%) | 64 min (+8%) | — |
  | R10/★1 | 22.2 h (+17%) | 11.5 h (+16%) | 6.1 h (+10%) | — |
  | ★2 | — | 39.3 h (+16%) | 20.7 h (+9%) | — |
  fast ÷ median ×1.85–1.90 (≤ ×2) · spammer = median (238,000 spam calls → 0 granted) · masher 0. Real game ~+10–23% slower than python: only accepted-word letters pay ×1 in games (typed letters ×0.2).
  Migration 026_progression_final.sql (does NOT touch lb_caps). FLIP ORDER: 022 → 024 → 026 → claude/run-season2.sql (023) → notify pgrst → "flip SEASON2".
  NEXT: 4 ROLL end-to-end play-test (season2 preview), 5a menu list (building), 5b stats + number audit.
- FINAL 4 ROLL PLAY-TEST (prod, ?season2=1, after #235): PASS for the roll flow — 75 gems charged once (1000 → 925) · AUTO ROLL locked at R0 ("AUTO · R1"), open at R1 · pity: roll #50 forced EPIC+ (landed LEGENDARY, sinceEpic → 0) · AUTO with 310 gems → exactly 4 rolls (10 left) then AUTO OFF · INDEX opens · 0 console errors.
  BUG (fix rides the 5a menu PR): a FRESH S2 save's rail shows only SHOP — ROLL/INDEX hidden (still gated on S1 marksRevealed/LV10); FINAL says ROLL + INDEX from the start. Told the 5a agent.
  NOTE: a fresh save's FIRST roll is FREE (season-1 starter roll, "YOUR FIRST ROLL IS FREE") — not in FINAL; kept unless Andy says otherwise.
- FINAL 5a: PR #236 menu list (UPGRADES rename · rail from start with padlocks · S2 ROLL/INDEX unlocked from start (fixes the item-4 bug) · ROLL chip + dot · cards centred 291/291 @1366×657, 330/330 @1280×551, 73/73 @1920 · XP bar 600 ms glide, climbs ≤ 900 ms · live values on the buttons; GIF claude/mockups/v2/shots/xpbar-600-typing.gif) — in CI. 5b numbers audit BUILDING (fix/numbers-audit-final).
- FINAL 5b: PR #237 numbers audit (98c8428) — stats = BASE × each multiplier = TOTAL, multiplies out to the real payout (unit tests flag ON + OFF). FIXES: (1) S2 BUG: rolled marks kept S1 tier values (LEGENDARY ×3 not ×2, SECRET ×25 not ×5, MYTHIC +BASE +90 not +20) — now FINAL; (2) chips ≥×10 rounded (×15.625 shown ×16) → 3/2 decimals; (3) MODE added to the wins chain; (4) INDEX bonus its own chip; (5) STARS order/label; (6) POWER chip "TIER n"; (7) UPGRADES XP/LETTER omitted mark/INDEX/BOOST; (8) receipt BASE line ignored +BASE marks; (9) econ.winsPerWord base-mark math; (10) S2 rebirth tutorial said ×5. Audit table in the PR.
  ANDY DECISIONS (left as-is): INDEX bonus (S1 carry-over, not in FINAL) kept in S2? · first EPIC+ by roll 10 + periodic bonus roll (not in FINAL) kept · free first roll kept · menu "+N XP / LETTER" shows the game-letter rate (menu letters pay ×0.2 of it).
  Merge order: #236 → #237 (update + green).
- FINAL 5a DONE: #236 MENU LIST MERGED + LIVE (0b2312d). FINAL 4 RE-TEST PASS: fresh ?season2=1 save → rail shop,roll,index,rebirth:locked; ROLL opens, first roll works; live S1 menu 1366×657 + 390×844: 0 errors, no scroll, UPGRADES shown. Cosmetic: S1 claim popup slightly overlaps the pager arrows at 1366×657 (cleanup).
- FINAL 6: claude/FLIP-STEPS.md → PR #238 (docs). ORDER: 022 → 024 → 026 → claude/run-season2.sql (023) → notify pgrst → check lb_caps season2_reset → "flip SEASON2". Pre-check: #237 merged before the flip. STOP BEFORE THE FLIP (Andy's).
- Remaining after that: #237 merge (in CI), then P9 / P10 (parked partial work in ../p9a…).

- oct6 late: #237 numbers audit (S2 mark tiers paid S1 values + 9 display fixes) MERGED (db5b03ce). #238 claude/FLIP-STEPS.md MERGED. Andy "Do NOT scale gems" → #239 fix/no-gem-scaling (×2 GEM DROPS stock item + stockGemMult removed; drop stays 1/15; gem table = FINAL) — CI green, updated on main, re-running.
- #239 no gem scaling MERGED (b0a05fb3). P9: #226 update-branched, merging in order #226 → #231 → #232 → #240 (9d rooms).
- P9: #226 9a MERGED (fa29fa28). #231 9b MERGED (0049c5d2). #232 9c: main merged in (GameScreen import conflict), unit 1275/0, CI running; 2-context play-test PASS (agent, 3 runs). Then backend #18 (wb-learn-pause), then #240 9d. P10 agent building 10b→10f→10a.
- #232 9c MERGED (a459009e). Backend #18 learn-pause MERGED (804ff23f → Render). #240 9d update-branched, CI running.
- PROD REGRESSION (9c + backend #18): PASS — 2 contexts + bot on typeaword.com, room BAVPK, 4 words accepted, turns pass, blow-up carried learnPauseMs 2000 (Render live), NEXT TIME card on loser only, first tick +3002ms, 0 errors / 0 key-collision. #240 payload trimmed to 961,023 (AudioPanel lazy), CI running.
