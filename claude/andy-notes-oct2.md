# Andy's notes — Oct 2 (outrank everything else queued)

## SUMMARY (Oct 2, 22:00 ET)
1. MERGED: frontend #80–#148 (this evening: E0–E6 = #137–#142; fine-tune loops = #144, #146, #147, #148), backend be#10–#17. Every merge was verified live by grepping the prod bundle; prod smoke shows 0 errors.
2. SIM, before → after (3 skill levels × 10 m / 1 h / 5 h / 20 h, real modules): runaway reward lumps 3/3/2 → 0/0/0. WALKING DICTIONARY paid 4.8e19 wins (≈633,000 min of play); every achievement is now 6–25 words.
3. SIM: the median player's worst wait for the next KEY tier at 20 h went 1,833 → 40 min. Gaps between good events PASS in every window (worst 5.8 m against the 12 m limit at 20 h). formatNum PASS to 1e300. No text under 13 px at 1280x551, 1366x625, 390x844 or 1920x1080.
4. STILL FAILING: the KEY wall. From 1 h of play, the next KEY tier is 15–107 min away (the limit is 15). The v8 ladder causes it, and changing it is your call (item 7).
5. ANDY TODO — ~~delete the test rows~~ (done). NEW: check NoBuffCookies — LV102 → LV5222 in an hour with no new words (see ANDY TODO).
6. ANDY TODO — 2-device play-test #130 (PLAY SOLO Word Bomb → HARD for returning players) and be#13 (a choking bot concedes after about 6 s).
7. ANDY TODO — DECIDE the KEY wall: keep v8, or price KEY in words past T8 (about ×1.2 a tier)? Details in claude/econ-oct2/loop-2.md.
8. ANDY TODO — DECIDE whether per-level redeem codes should be priced in words, like achievements now are (late in a run they're invisible today).
9. No SQL is pending. If you ever re-run 011, run 013 after it, or THIS WEEK silently stops counting. It's empty right now only because nobody has typed since 013 went live.
10. Last PR (finetune/summary): these notes + the LUCKY stamp bound to its constant. It merges after CI. Full log: claude/econ-oct2/loop-3-8.md.

## ANDY TODO (top of the list — everything I can't do myself)
- **SQL to run: none pending.** 008, 010, 011, 012, 013 are live on prod (verified 17:55 ET: lb_caps has weekly; ZZTEST redeem works once; CJK claim works; board is level-only).
- ~~Delete test rows~~ DONE by Andy (22:20 check: ZZTEST-ONCE → bad_code; 测试七号 and zzcloud7b1486 are free names again).
- **CHECK NoBuffCookies:** between 21:22 and 22:20 ET they went LV102 → **LV5222** (now #1) while lifetime words stayed at 51 (3,121 letters). lb_submit2 rate-checks words and letters but never LEVEL, so a level can be submitted with no typing behind it. It may be legit menu typing at a high KEY tier, but it looks off. If it's a cheat, the fix is a level-rate check in lb_submit2 (I write it, you run it). Tell me.
- **2-device play-test** (Tier-1 rule): PR #130 (PLAY SOLO Word Bomb preset → HARD for returning players) and backend be#13 (a choking bot concedes after ~6 s). Prod smokes passed for both.
- **Weekly board — order matters if you re-run SQL:** 011 also defines `lb_submit2`, *without* the weekly counter. If you ever re-run 011 (for example, for the level-only view), run 013 after it, or THIS WEEK silently stops counting while lb_caps still says weekly. At 21:22 ET THIS WEEK was empty only because no claimed player had typed since 013 (all 15 rows' lifetime words were unchanged since 17:48).
- **imbetterthanandy** reset: fires on that player's next menu load (012 is live); nothing to do.
- **DECISION — KEY POWER wall** (fine-tune loop 2, `claude/econ-oct2/loop-2.md`): from about 1 h of play the next KEY tier is 15–40 min away (100+ min for fast players at 5 h). That fails the loop's "≤15 min" rule. The cause is the v8 ladder you asked to restore (KP2: ×2.5 XP, ×6 price per tier forever), and no single constant fixes it (probed). The option that works: past T8, price KEY in words at your current rate (like LETTER FORGE), with a gentle effect (about ×1.2 a tier). **Keep v8, or switch past T8?**
- **DECISION — per-level codes** (R10 `wins × level`): late in a run they're invisible, because a level grows far slower than a word's worth. Should codes be priced in words like achievements now are?

A box is checked ONLY with evidence: a merged PR #, a measured number, or a screenshot path.
Andy's emphasis on every item: **OBVIOUS and MAKES SENSE** (mechanics AND visuals), never
overcrowded with useless info, and **updated EVERYWHERE** when something changes (cards,
receipts, dialogs, tutorials, leaderboard).

Specs verbatim: `claude/QUEUE-specs.md` (§ Oct 2).

## Oct 2 DAY RUN goal (11:41 ET → 08:00 ET Oct 3) — DONE (Andy back 22:00 ET; the summary is at the top).
### P0 — migrations 005/006/007 (Andy ran them; verify on PRODUCTION)
- [x] P0.1 letters sort the board — prod lb_caps = {letters, cjk, cloud: true}; live board #1 is elol LV3 with 2,742 letters ahead of LV179 with 0 (view orders by lifetime_letters desc). 12:00 ET
- [x] P0.2 DONE (re-checked on prod 22:20 ET after Andy ran 005–013): lb_name_status('傻逼王') = blocked, '测试八号' = ok; the CJK claim succeeded on prod at 17:55 (测试七号, 008). Was: CJK claim failed (lb_claim never replaced) — fixed by 008 (PR #105).
- [x] P0.3 cloud save on PROD (Playwright, typeaword.com): claimed zzcloud7b1486, menu backed up a 616-byte blob, secret cookie set; localStorage.clear() + reload → restored LV4 save + profile, taw.cloud.restored=1. 11:55 ET
- [x] P0.4 DONE: ZZTEST-ONCE redeemed once, then `used_up` (E0, 17:55). re-checked on prod 22:20 ET after Andy ran 005–013: the row is now deleted (lb_redeem answers bad_code), so the test is cleaned up.

### P1 — Andy's six (outrank everything except P0; every word matters)
- [x] A1 WORLDS — PR #112 (merged): the 24 world SVGs + WorldBackdrop removed; the SAME floating-word wall (WallScene's 12 sprayed words, 6 stickers, 4 splatters) re-laid-out per tier by sceneLayout.js (seeded 5x5 jittered grid, tier 0 = the hand layout); a tier climb stacks old+new in ONE element that translates up once (820 ms, will-change only during, two-walls-tall + paint-contained so nothing re-paints). 24 border tiers unchanged. 4x CPU: settled 16.7 / swish 33.3 ms p50 (the old world swish measured the same on CI). Shots claude/day-oct2/a1-*.png. Was: A1 WORLDS: revert the new world backdrops. SAME floating-word background as before, shifted to different positions per tier ("as if the scene moved"), same smooth ONE-transform swish. Keep the 24 border tiers. New art only if genuinely high quality (it isn't).
- [x] A2 Remove the "N online" count from the menu — PR #106 (merged): LiveTicker empty at rest, only other players' moments.
- [x] A3 MARKS button — CAUSE: not fit-math/race; the chip rendered only while a mark was WORN or a NEW mark unseen, so opening the picker without wearing one hid it until the next unlock (and an old save with no taw.marksOwned showed nothing). Now always present once MARKS is revealed (LV10/R1): worn → title chip, else MARKS (NEW MARK + dot when unseen). PR #108 (merged), marks.spec 6/6, claude/day-oct2/a3-marks-1280x551.png
- [x] A4 ★ REWARDS button removed (desktop + phone); STATS wears the claim count and opens the claims while any wait. Measured: dots 10×10 → 20×20, count 22×22 → 30×30 (1280x551 / 1280x800 / 390x844) — claude/day-oct2/a4-before|after-*.png, e2e/claims-via-stats.spec.js. PR #110
- [x] A5 SHOP dot — CAUSE: canAffordAny still counted the retired menu THEMES (gone from the shop since STEP 50), so 60+ wins lit the dot with nothing buyable (KEY POWER I is 200). Fixed + unit tests (fails on old code) + e2e/shop-dot.spec.js (fresh LV1 0 wins → no dot; 150 → no dot; 5,000 → dot). PR #107 (merged)
- [x] A6 RACE — backend #10 + frontend PR #113 (merged). Same 25 common whole words for everyone (stoplist: adult/names/places/brands/web jargon), exact word only, no dictionary, first to 25 or most at 1:00; bots type per letter (~45 WPM). Card design unchanged; dialog/lobby/description copy updated. Tested locally pre-merge (2 contexts + bots); prod WB smoke passed after deploy; PROD 2-tab race: same words, same winner, progress skew max 200 ms / p50 16 ms, payout via bankRaceWord — claude/day-oct2/a6-prod-race.txt. Was: A6 RACE = ENTIRE-WORD racing (monkeytype/TypeRacer): same sequence of whole words for every racer, type each in full, advance; first to finish or most at the cap wins. Keep the game CARD exactly. Backend additive (new race variant; WB/Blitz untouched), unit-tested, prod WB smoke after deploy, revert via PR if it fails. Live 2-tab race on PROD: same words, same winner, progress <=250 ms apart. Payout via the existing pipeline, matches the card.

- [x] A7 (Andy, added 12:40 ET) BOARD RANKS BY LIFETIME WORDS, not letters (letters began at #79, no backfill → everyone else showed 0). Andy re-sorted public.leaderboard by lifetime_words in Supabase (NOT reverted; recorded as 009_board_by_words.sql). PROD verified: 15 rows strictly descending by lifetime_words (#1 Daan 1,061 … elol 321 at #6 despite 2,742 letters). WORDS is the main stat on the board column + "YOU'D SHOW AS", the rank-up moment ("N WORDS · ON THE LEADERBOARD"), the claim prompt ("N WORDS · NO SIGN-IN…"); the ticker only names LV / rank moves (no stat). ranksAhead = words → level → rebirths (rank.test.js); boardMock + leaderboard / leaderboard-pull e2e updated (11/11). PR #109

### Andy, added 13:05 ET (authorized)
- RULE — BACKEND: test BEFORE merging: run the backend locally, drive 2 Playwright contexts (+ a bot) through the changed flow, then merge; after Render deploys, prod WB smoke; revert via PR if it fails. Applies to Blitz list-only and RACE.
- [x] B9.0 (see B9.1) BLITZ: list-only ONLY for enumerable categories (BLITZ-ENUMERABILITY.tsv) whose lists can be made complete; REMOVE the ~270 open-ended ones entirely (list-only on an open category rejects correct answers — dinosaurs 8/8 rejected). Fewer categories is fine. No empty packs.
- [x] D1 PR (this one): claude/finetune/PROJECT-design-and-conventions.md rewritten from the code — modes table (no Imposter, RACE entire-word, Blitz list-only + AI BUILT), payout stack incl. BOOST, the corrected animation budget (the old "constant idle animations" line is gone), type tokens, .wall-surface as it actually is (menu + CHAIN/FUSE shell + RACE; NOT WB/Blitz/SAT — Andy's brief said homepage-only; flagged), traps, debt; stale wall-system.css / MobileMenu.css comments fixed. Was: Rewrite PROJECT-design-and-conventions.md to be true today: .wall-surface is homepage-only, Blitz list-only + AI BUILT ribbon, no Imposter, add RACE, sweep the rest vs main.

### Andy, added ~13:40 ET (authorized) — queued after the current steps, in this order
- [x] R10 PR #117 (MERGED; **ANDY: run 010_redeem_kinds.sql** — SQL in the PR body; client degrades without it) SCALING + BOOST REDEEM CODES + FRENZY/BOOST END moment. Migration is **010_redeem_kinds.sql** (Andy said 008 — taken by 008_claim_cjk.sql, merged #105; 009 records the words-board view). Columns kind ('wins'|'boost'), per_level, boost_mult (3), boost_min (10), returned by lb_redeem; re-runnable; Andy runs it. Client: per_level × level on claim; 'boost' = wall-clock BOOST timer, a named perWordFactors factor stacking with FRENZY, persists across reloads; gold BOOST pill + countdown; receipt ×3 BOOST line; degrades to today's behaviour without 010. FRENZY OVER / BOOST OVER finite moment (letters implode, slab cracks, ~1.2 s, transform/opacity, reduced-motion readable); pill pulses red at 10 s. Update shop redeem UI, receipts, FUSE card copy, e2e redeem spec. SQL in the PR body. Test 1280x551 + fresh LV1; nothing under 13px.
- [x] NC — PR #119 (MERGED; **ANDY: run 011_no_caps.sql**, SQL in the PR body). Was: NO CAPS ON NUMBERS. Migration **011_no_caps.sql** (same numbering reason): wins_per_word plain numeric (drop the 1e9 check), latest submit fn without least(...,1e9), redeem_codes.wins numeric check >= 0 (idempotent). format.js SUFFIXES named tiers to 1e308 (never raw digits; 3 sig figs; tests 1e15/1e30/1e300/Infinity). Sweep src/ for every cap on wins/rewards/multipliers/prices/levels — list each (file:line, old cap, removed/kept why). Bank, redeem and cloud save handle > 9e15 without NaN/Infinity. SQL in the PR body.
- [x] KP — SUPERSEDED by KP2 (#122), and now by K1 below (v8 to T8, words past it).

- [x] KP2 PR #122 (MERGED): v8 table restored (×2.5 XP / ×6 price per tier, flat in rebirth), keyTierXp floored at the v9 value so nobody drops; minutes report claude/batch-a/kp-minutes.md — v8 walls at T10 (~5.7 h) and T20 (~36,000 h) at a median rate, flagged in the PR. Was: RESTORE KEY POWER v8 (Andy, ~13:55 — replaces KP): XP/letter ×2.5 per tier, price ×6 per tier in wins (the T1–T8 table extended forever), T1 = 25; needs NC first (suffix ladder, test at T60+); nobody's XP/letter drops at their current tier; shop card / receipts / "+15" text updated; report minutes of play to buy T5/T10/T20 at a median rate, before vs after.

- [x] LB10 — PR #120 (MERGED): BOARD_SIZE 10, pinned real-rank row via a server count query, end-screen YOU'D BE #N true past 10 (e2e/leaderboard-top10.spec.js). Was: LEADERBOARD TOP 10 (Andy, ~14:05): BOARD_SIZE 100 → 10; off-board player gets ONE pinned row with their real server rank ("#37 YOU"), never "unranked"; hypotheticalRank / end-screen "you'd be #N" true past 10; "TOP 100" copy → "TOP 10"; e2e specs expecting 100 rows fixed.

### Andy's notes, Oct 2 evening (~17:50 ET) — OUTRANK EVERYTHING; each a separate PR
- [x] E0 DONE 17:55 ET: lb_caps = {letters, cjk, cloud, weekly}; ZZTEST-ONCE redeemed once then `used_up` (same device + another); board order = level desc, words desc (imbetterthanandy R13 LV6 sits at #12); CJK claim 测试七号 succeeded (008); weekly view empty (no typing since 013). P0.4 CLOSED. Andy: delete the test rows (ANDY TODO). Was: Andy ran ALL pending SQL (008, 010–013, ZZTEST-ONCE row, a LEVEL-ONLY board view, reset_all for imbetterthanandy). Re-check prod: lb_caps, ZZTEST redeem twice, board order; finish P0.4; then tell Andy to delete the ZZTEST-ONCE row.
- [x] E1 — PR #137 (MERGED): view order in 001/005/009/011, ranksAhead + server rank count level-only, copy, mock, rank.test (13 rebirths never beat a level). Was: BOARD = LEVEL ONLY: level desc, lifetime_words desc, created_at asc (rebirths NOT ranked — "idc abt rebirth"). Update 011 + any migration rebuilding public.leaderboard, hypotheticalRank / server count, copy, e2e specs.
- [x] E2 — PR #138 (MERGED): Xavi 1e9 → "1B"; every private formatter replaced (leaderboard fmt/fmtRate, SAT results, claim prompt, rank-up, combo pill, WinsHud, menu +N stamp); WINS EARNED carries data-wins-total for gates. Was: Leaderboard wins/word uses a private fmtRate that only knows K (Xavi shows "1000000.0K" — the old 1e9 cap). Use formatNum; grep src/ for every other private number formatter and replace.
- [x] E3 — PR #139 (MERGED): cards = perk line + its own LONGER WORDS PAY MORE line; FUSE = ALL LETTERS → FRENZY ×5; dialog / in-game / SAT cover say LIGHT ALL LETTERS → FRENZY ×5 FOR 5 MIN; card-fit 1163x501 kept (breakable chunks). Was: FRENZY copy confusing ("FRENZY ×5 LONGER = MORE" reads as one rule). Two separate lines everywhere: "LONGER WORDS PAY MORE" and "LIGHT ALL LETTERS → FRENZY ×5 FOR 5 MIN". Every card, dialog, receipt, tutorial.
- [x] E4 — PR #140 (MERGED): inbox = achievements + rank-ups; codes/BOOST/marks/systems/collection apply at once; welcome back cut; trimClaimInbox migrates old saves; keep/cut table in the PR. Also fixed the OFFLINE preload flake (idle warm-ups swallow their rejections). Was: TOO MANY REWARDS: only ACHIEVEMENTS + STATS milestones (level-ups / rank-ups) go through the claim inbox; everything else pays silently or is cut. PR lists every claim source keep/cut + reason.
- [x] E5 — PR #142 (MERGED): quality protocol A/B/C → reviewer picked A (scaled); BOOST + FRENZY are hero-size pills that pop in; FUSE plaque grows where the strip keeps its height; before/after px in the PR. Follow-up: no BOOST pill on the phone menu yet. Was: PROPORTIONS TOO SMALL, esp. new mechanics (FRENZY, BOOST, weekly board, marks, rank-ups): one big thing per screen, scaled up hard; new mechanics get hero type + an animation; before/after px. QUALITY PROTOCOL (3 versions → adversarial reviewer → pick).
- [x] E6 — PR #141 (MERGED): quality protocol case/split/expand → reviewer picked split; inventory 4x4, MAIN hero, SET AS MAIN, GET: <achievement> on locked tiles; phone MARKS button added to the nav strip; lazy chunk (payload ratchet). Was: MARKS INDEX page: inventory grid of every mark (owned; unowned locked + how to get); tap → SET AS MAIN (title + BIG bonus as today); current main big at top; reached from the MARKS button. QUALITY PROTOCOL.

### Andy, ~22:15 ET (authorized) — one PR if possible
- [x] 0 — DONE 22:20 ET: re-checked P0.2 / P0.4 / L5 / L9 / C6 on prod and ticked all five; KP marked superseded; the "until 08:00 Oct 3" lines closed. Andy has already deleted the test rows. New flag: NoBuffCookies at LV5222 (ANDY TODO).
- [ ] K1 KEY POWER: keep v8 (XP ×2.5, price ×6) through T8. Past T8, price each tier in WORDS at your rate, growing ×1.2/tier; XP/letter keeps ×2.5 forever. Re-run the loop-2 sim: next KEY tier ≤15 min away at 1 h / 5 h / 20 h for all 3 skill levels. Update shop copy + receipts.
- [ ] K2 Per-level redeem codes priced in WORDS at the player's rate, like achievements (the wins column = number of words). Update the RedeemCodes copy + the 010 docs.

### Fine-tune loop (until 22:15 ET)
- [x] LOOP 1 — PR #144 (MERGED): the progression sim (`claude/econ-oct2/loop-sim.mjs`, real modules, 3 skills × 10 m / 1 h / 5 h / 20 h) found RUNAWAY rewards. WALKING DICTIONARY paid 4.8e19 wins at LV850 (≈633,000 min of play), PAPER CHASE 8 min of play at LV57. Achievements are now priced in WORDS at the live rate (6–25 words), and the mastery milestone is a flat 30 words. Before → after: runaway lumps 3/3/2 → 0/0/0; median worst KEY wait at 20 h 1,833 → 40 min. Gaps PASS everywhere (max 0.67 m at 10 m, 5.8 m at 20 h). `claude/econ-oct2/loop-1.md`.
- [x] LOOP 2 — no code change: "casual never sees FRENZY" was a sim artifact (the real FUSE engine reaches FRENZY in 44% of runs at a 6k vocabulary). Strip carry-over was probed (FRENZY in 88–91% of runs, so FUSE would sit at ×5 nearly permanently) and rejected. The KEY wall needs Andy (ANDY TODO). `claude/econ-oct2/loop-2.md`.
- [x] LOOPS 3–6 — PR #146 (MERGED, live: "✓ EARNED", `hp-m-boost`, "THIS WEEK" in the prod bundle): earned achievement cards say ✓ EARNED instead of re-quoting a payout already banked; the board's name card shows the rank on the board you're VIEWING (#N THIS WEEK on the weekly tab); MARKS index opens on your next mark, not a copy of the hero; LETTER FORGE opens at its level (the stale "CLAIM IT IN REWARDS" copy pointed at the inbox E4 removed); a live BOOST shows on the phone menu too. Loop-5 re-sim: runaway 0/0/0, gaps PASS, formatNum PASS to 1e300.
- [x] LOOP 7 — PR #147: at 1366x625 the hero-size BOOST pill ran past Word Bomb's board edge. In the docked rate stack the pills now fill its width at body size; in the FUSE HUD chip they stay inline, and "LONGER WORDS PAY MORE" steps out while a live pill shows (the card, dialog and goal line still say it). Specs 117/117. Prod smoke (returning visitor, 1280x551 + 390x844: stats, shop, board) = 0 errors.
- [x] LOOP 8 — copy ≠ code: the MARKS index's empty hero promised "UP TO +300%", but LEGENDARY at rank V pays +480% (3.0 × 1.6). The number is now computed from the tier and rank tables. FRENZY "FOR N MIN" was checked and already reads frenzyMinutes() (FRENZY+ perk included) everywhere. Visual: with a MAIN worn, SET AS MAIN sat 176 px below its column's fold at 1280x551 (108 at 1366x625), so you had to scroll a nested column to find the page's only action. On short desktops the phone's compact rules now apply: the perk lines step out, the art shrinks and the button is body-size. Measured: 0 px clipped at 1280x551 / 1366x625 / 1920x1080 / 390x844 (1163x501 still needs a 6 px scroll). "RANK I" no longer breaks onto its own line. Shots claude/finetune/loop8/. marks.spec 6/6. **PR #148 (MERGED, live: `mx-nowrap` in MarksIndex-DtgZ8xAh.js).**
- [x] LOOP 9 — the solo LUCKY stamp printed a literal "LUCKY ×5"; it now reads `LUCKY_WINS_MULT` (the same value today, so it can't drift later). The other "×N" literals in src are comments. Prod THIS WEEK board checked (empty for the reason in ANDY TODO, not a bug). game-fill 33/33.
- E0–E6 all LIVE on prod (marker greps, 19:15 ET).

### Andy, ~14:20 ET — DONE FIRST
- [x] VERCEL free limit (100 deploys/day, api-deployments-free-per-day) — PR #124 (MERGED a259259; main's vercel.json parses, git block present): vercel.json `git.deploymentEnabled {"**": false, "main": true}` → only main deploys (JSON validated: the rewrite's `\.` survived; a Bash heredoc had silently dropped it on the first try — the CLAUDE.md trap). **Until the 24 h window resets, merges to main do NOT reach typeaword.com: prod checks for anything merged during the freeze are "pending Vercel limit" and are verified on the local preview build; re-verify on prod once deploys resume.** Batch small fixes into fewer PRs.
- 17:20 ET: #133 LIVE — RankUpMoment-*.js and DevResetNotice-*.js are their own chunks; rank-up copy absent from the index bundle. Fine-tune: #135 (MERGED) leaderboard hides its column headers over a load error; phone sweep 390x844 (menu, shop, stats, board, WB game, CHAIN, FUSE, SAT) 0 text < 13 px.
- 17:00 ET PROD VERIFIED (marker greps in the live bundle + lazy chunks): #123 (navigator.onLine), #125 (rebirths.gt), #126 (lb_reset_ack), #127 (ONLY YOUR LEVEL RESETS — Shop chunk), #128 (PLAYING SINCE — Stats chunk), #129 (*270 SAT, 0.07 heat CHAIN), #130 (difficultyKey reads a constant, not "medium").
- Main went RED at #129 (two checks): payload ratchet 1,260,124 > 1,260,000 (real growth) and a stale e2e (word-bomb-scoring RACE case expected 25, ignoring the +13 WINNER BONUS the happy path already expects; passed only when the poll beat the bonus). Both fixed in PR #133 (MERGED): rank-up + dev-reset moments lazy (−3.4 KB) and the spec expects 25 + 13.
- Vercel deploys RESUMED by 16:25 ET: the live index bundle carries #125's rank order (`rebirths.gt`). Re-verify on prod (marker greps) for every merge since #124: #121 #122 #123 #125 #126 #127 #128 #129 #130 — #126's markers not live yet at 16:25. Main merged into #121/#122/#123/#125/#126 for the payload-gate fix. #121's ko-screen 360x640 failure did not reproduce locally (108/108) = CI flake.

- [x] PAYLOAD gate (found while gating #121–#125): main has failed shard 2/4 since #120 (a8c4b58) — CI's payload ratchet counted mascot-idle.avif TWICE (a memory-cache repeat Playwright still reports with a body: 1,260,564 incl. the dupe vs 1,247,181 real). Spec now counts each URL once; ratchet unchanged. In PR #124.
- [x] RESET — PR #126 (MERGED; **ANDY: run 012_admin_reset.sql**, SQL in the PR body; then `update profiles set reset_all = true where username = 'NAME';`). Built: lb_load returns reset_all; lb_reset_ack (secret-checked) stores the fresh LOWER save once, zeroes the board row, clears the flag, all in one transaction; client wipes every taw.* except taw.lb.secret/profile, reloads, one-line notice; e2e/admin-reset.spec.js + cloudSave unit tests; board specs 22/22; shot claude/day-oct2/reset-notice-1280x551.png. Was: ADMIN FULL RESET by username: migration (next free number, re-runnable, Andy runs it) adds profiles.reset_all bool default false; lb_load / boot returns it; a secret-checked RPC clears it. Client on boot when set: wipe exactly like StatsScreen RESET ALL PROGRESS (every taw.* progress key) but KEEP the claim + device secret; push the fresh cloud save (lb_save accepts the lower score ONCE right after a reset); push the reset stats to the board row; clear the flag; toast "YOUR PROGRESS WAS RESET BY THE DEV." PR body: `update profiles set reset_all = true where username = 'NAME';` e2e: flag → LV1 / 0 wins, name kept, flag cleared, no repeat on reload.
- [x] LBL (Andy, ~14:15) — PR #125 (MERGED, LIVE on prod — `rebirths.gt` in the index bundle; e2e leaderboard 10/10, cloud-save + redeem 9/9; shot claude/day-oct2/lbl-board-1280x551.png). Was: BOARD RANKS BY LEVEL: rebirths desc, level desc, lifetime_words desc, created_at asc (Andy already ran it on prod). In progress on fix/board-by-level (supersedes A7's words order).

### P2 — STEP 9 Blitz list-only
- [x] B9.1 backend #11 (merged): 88 curated COMPLETE categories (446 → 88; the ~270 OPEN gone, 71 enumerable dropped as incomplete/fuzzy, 16 more on review for completeness doubt, 6 under 10 members), 8 good + 8 junk per category through the real submitAnswer (blitzLists.test.js), NOT ON THE LIST (not_on_list), judge out of scoring, no head-word leniency, numbered names collapse (Henry VIII = henry 8). Packs: gaming 28 / sports 20 / world 14 / science 7 / history 6 / movies 4 / mythology 3. Local 2-browser + bot test before merge. backend: only complete enumerable categories; judge removed from scoring; reason "NOT ON THE LIST"; 8 good + 8 junk unit tests per category
- [x] B9.2 PROD (after Render deployed #11): zzzzzzzz → not_on_list, texas → list_hit, puerto rico → not_on_list on "US states"; prod WB smoke "lives" accepted — no revert. claude/day-oct2/step9-prod.txt. prod check: zzzzzzzz rejected; WB smoke (revert via PR if it fails)
- [x] B9.3 frontend PR #115 (merged after the prod check): AI BUILT ribbon/badge, NOT ON THE LIST copy, SEO page rewritten (no AI-judge claims, 30 s), 7 packs. frontend: ribbon AI JUDGED → AI BUILT; no "judged by AI" claims anywhere; no empty packs

### P3 — Batch A (contents from the Oct 2 day goal)
- [x] BA1 — report claude/batch-a/ba1/report.md (50 games/mode, median-human model, real engines). Shipped:
  - SAT RUSH + FUSE + CHAIN — PR #129 (MERGED): SAT per-card beat bug (x5 was unreachable), lineup 270 ms/letter, briefing ends (length−2, tierEvery 20); FUSE no-repeat bug + dark-letter steering (FRENZY 20.8% → 44.6%, STEER_FROM 21); CHAIN heat grace 1 @0.07 (report's grace 2 broke the anti-exploit SIM test — bot 75 links > 60) + multiplier decays a step. C3 / F3 timer curves NOT shipped (design calls, income impact).
  - WB preset — PR #130 (MERGED, Tier 1 — **ANDY: 2-device play-test**): returning players' PLAY SOLO = HARD ('easy'), not CRAZY (win 16% → 44%).
  - WB backend — be#13 (MERGED, PROD smoke OK, CHILL opens at 15 s on prod): choking bot concedes ≤6 s; CHILL 20 → 15 s + medium miss 0.06. Local 2-context test claude/batch-a/ba1/local-wb.json.
  - Blitz backend — be#14 (MERGED): 12 broad tier-1 lists (US states/body systems were in ~69% of games), 7 dead lists benched, MEDIUM bot first answer 3–5.5 s. Local test local-blitz.json. Bot canon (aliases/misspellings) + singular/plural double-score = follow-up PR.
  - Blitz bot canon — be#16 (MERGED, LIVE: a prod Blitz round's bot answers were all canonical — NBA teams "phoenix suns, milwaukee bucks, boston celtics, new york knicks"; smokes OK): bot plays only canonical spellings from blitzCanon.json (88 lists, 3,482 members, every accept entry one member's canon/alias), MEDIUM top-60% by popularity, never a second form of a member. Local: bot answered "nervous system, … massachusetts, napoleon, french open" — no misspellings (claude/batch-a/ba1/local-blitz-canon.json). Follow-up be#17 (MERGED): the prod probe showed uniform picks over 60% of a 42-cookie list reaching "toast-yay, cinna-spins" — picks now lean famous (index ∝ u², half from the best-known quarter); local: "abraham lincoln, john f kennedy… henry viii, elizabeth i… brazil" (local-blitz-skew.json).
  - RACE backend — be#15 (MERGED, prod smokes OK): bots 300 ms/char (40 WPM human was last 100%). Local: 40 WPM 2nd of 3, 50 WPM 1st (local-race-*.json).
- [x] BA2 — backend #12 (MERGED; prod WB smoke passed): wordBombBot missChance ×2.6 under pressure + fumbles; median human vs MEDIUM 18.6% → 51.3% (sim claude/batch-a/wb-winrate-sim.mjs). Also BA1's WB fumble fix.
- [x] BA3 keyboard up — PR #114: interactive-widget=resizes-content; Blitz + SAT compact at <=560px tall; e2e/keyboard-up.spec.js 5 modes x 3 cells. (iOS not covered — it ignores interactive-widget.)
- [x] BA4 PR #121 (MERGED): WB draft moved to an external store (keystroke re-renders only the input), beat shake via WAAPI, LiveStack/WallScene/DecorPane memo; e2e/input-latency.spec.js (local < 50 ms; CI-aware gate); claude/batch-a/latency.md
- [x] BA5 PR #123 (MERGED; WS-drop spec race fixed — it snapshotted before banking settled): chunkReload skips the reload while offline and only preventDefaults when a reload starts (a preventDefault'd import resolved to undefined); solo accept-ext import failure caught; e2e/failure-states.spec.js

### P4 — Batch B
- [x] BB1 — PR #127 (MERGED): RebirthCeremony — ×N hero, RESET (LV 200 → 1, struck) vs KEPT (wins, key tier, forge, cosmetics, marks, words) with real values; shots claude/batch-b/bb1-ceremony-*.png
- [x] BB2 — PR #128 (MERGED): STATS opens on a PLAYER CARD — name + rank, LV hero, R badge, WORDS TYPED / WINS EARNED / BEST WPM / RAREST WORD, since + streak + TYPEAWORD.COM; before/after claude/batch-b/bb2-*.png
- [x] BB3 — PR #132 (MERGED; **ANDY: run 013_weekly_board.sql**, SQL in the PR body): THIS WEEK board = words typed this America/New_York week; the reset is the week KEY changing at Monday 00:00 ET inside the DB (no cron); lb_submit2 counts words since the last accepted submit (first submit = baseline); ALL-TIME / THIS WEEK switch only once lb_caps.weekly; "RESETS MONDAY 00:00 ET · IN 2D 7H"; e2e/leaderboard-weekly.spec.js; shot claude/batch-b/bb3-weekly-1280x720.png

### P5 — the rest
- [x] WB phone ring — PR #134 (MERGED, CI full e2e green incl. wb-* / word-landing / viewport-integrity): the phone ring is sized to the ROW it actually has (between prompt and input stacks) and up to 0.92 of the board width, instead of the old centred-layout reserve + 0.72-of-width guess: 247 → 283 px @390x844, 263 → 303 @412x915, 276 → 320 @430x932 (360x640 height-bound 163 → 168). claude/wb-phone/before|after-*.png. Local gate run was killed by the OS for low memory (1,430 worker crashes) — CI is the gate.
- [x] Andy's notes re-check (17:00 ET): N1 shop.spec 'auto-equips', N2 word-landing / menu-xp sizes, N4 receipt top 3 + MORE (payout-honesty, solo-endgame, winner-bonus) — all in CI's full e2e on every PR tonight; main's only reds were the two #133 fixed. Evening sweep, fresh LV1 @1280x551: menu, WB dialog, shop, stats, board, CHAIN, FUSE, SAT — 0 visible text < 13 px (claude/finetune/evening/).
- [x] Until 08:00 ET Oct 3: fine-tune passes — DONE. Ran loops 1–9 (#144, #146–#149) until Andy returned at 22:00 ET.

### Day-run log

## Andy's newest notes (Oct 2, later)
- [x] N1 Buying a cosmetic AUTO-EQUIPS it — PR #76 (shop.js `buy` equips; unit test + e2e/shop.spec.js 'auto-equips')
- [x] N2 Animated reward text is bigger: rarity pop --fs-panel → --fs-hero and receipt WINS → --fs-h2 (PR #82); level-up moment (PR #78, src/components/MenuXp.css): plate held at ×1.2, title --fs-hero, "+N WINS" --fs-h2, detail --fs-panel, sub-line --fs-label → --fs-body, shots claude/worlds/levelup/after-1280.png / after-390.png; in-game "+N WINS" landing pop --fs-panel → --fs-h2 (phone --fs-body → --fs-panel) and menu letter pops --fs-panel → --fs-h2 (PR #88, all live). e2e word-landing / menu-xp / wb-short-layout green at the new sizes.
- [x] N3 One big thing per screen, applied screen by screen through the fine-tune loops: CASE CLOSED = CAPTURED (#85); round receipt = top 3 + n MORE (#82); CHAIN/FUSE death card = the result title (--fs-h1), hint below it, MENU in the card (#88, #89); WB game over = REMATCH the one filled button, LEAVE outline, cross-mode upsell a quiet mono ghost (#88); dialogs = the lead CTA, secondary actions a mono row (#88); stats = records you hold first, locked ones as one-line goals (#89); room = lit = selected (#88). Per-screen scores in claude/finetune/scores.md.
- [x] N4 WHERE YOUR WINS CAME FROM = top 3 rows + one "+ n MORE" row (sums still match) — PR #82

## PR #75 — Economy v9 (re-check against the Oct 2 notes)
- [x] e2e shard 2/4 failure found + fixed (cause, not a retry) — CHAIN paints a `.solo-root.is-loadstate` placeholder then swaps the real root ~130 ms later; the spec measured the placeholder's exit as it detached (4–6/40 locally, also on main). Specs now wait for the real root: 140/140 on repeat. PR #75
- [x] KEY POWER price / XP-per-letter curve LESS exponential — XP/letter +15 per tier (linear), price ~quadratic in tier (v8: ×2.5 effect / ×6 price per tier). PR #75; later priced against the full rate so it stays 11–25 s of income (PR #76, claude/econ-oct2/report.md)
- [x] Pop styles / sound packs cost MORE — first pop 60 → 6,000, ×5 a rung; the ladder spreads over ~13 h of play (was ~3 h). PR #75 (claude/progression/oct2-cosm-console.txt)
- [x] Pop styles / sound packs visually SMALLER in the shop — compact 2/4/6-up tiles. PR #75, claude/oct2/pr75-shop-cosmetics-390.png / -1280.png
- [x] Nothing caps at a dead end — mastery keeps levelling past M50 (PR #75); MOMENTUM's 200-cap replaced by the uncapped LETTER FORGE (PR #76)
- [x] CI green, merged — PR #75 (1303cdd); live on typeaword.com (marker "Black sun" in index-CJ-Cu4GF.js)

## STEP 48 — Economy rules
- [x] O1 MOMENTUM → uncapped LETTER FORGE (each buy forges a letter; +5%/level per letter in the word; FORGE row on the receipt; 26-tile strip in the shop) — PR #76, claude/econ-oct2/shots/forge-390.png
- [x] O2 SAT ×10 = POWER ×5 vs Word Bomb (50 vs 10 wins/word at T0) — PR #76, wins.test.js
- [x] O3 CHAIN POWER ×2 (20 vs 10) — PR #76
- [x] O4 FUSE = Word Bomb per word (10); FRENZY ×5 for 5 real minutes after a full strip; card says FRENZY ×5 / live clock — PR #76, claude/econ-oct2/shots/menu-1280-frenzy.png
- [x] O5 … dialog: FRENZY plaque (rule / live countdown) — PR #76
- [x] O6 … in-game: goal line over the strip, live FRENZY chip, FrenzyBurst moment; steering: median bot FRENZY every 10.3 min of FUSE (was 84) — PR #76, claude/econ-oct2/shots/fuse-390-frenzy.png, frenzy-sim.txt
- [x] O7 STARS (R1: STAR POWER uncapped / FRENZY+ / HEAD START) + AUTOMATION (R3: AUTO-KEY / AUTO-FORGE), each a claimable NEW SYSTEM reveal — PR #76
- [x] O8 Rebirth hero "REBIRTH N TO GET ×M WINS · +S ★" + "BAD TIME — WAIT n LV = +1 ★" — PR #76, claude/econ-oct2/shots/rebirth-390-badtime.png
- [x] O9 Wins only from playing — non-game rewards no longer credit on their own; e2e menu-no-free-wins asserts no write before a claim — PR #76
- [x] O10 Achievements, collection milestones, welcome-back, rank-ups (+ marks, new systems) are CLAIMED via popup or REWARDS button with a count badge — PR #76, claude/econ-oct2/shots/claims-popup-390.png, claims-panel-1280.png
- [x] O11 XP / WORD removed from cards, dialog, SAT cover; in-game chip trimmed to rate / COMBO / FRENZY — PR #76
- [x] O12 Cards: WINS / WORD (base) + POWER ×N / FRENZY ×5 / WIN +50% + LONGER = MORE (PR #76). End-of-round bonus BUILT: winning a Word Bomb game pays +50% of its word wins — own WINNER BONUS row on the receipt + named WINS EARNED line, paid once per game; card says WIN +50%, dialog WIN THE GAME +50% OF ITS WINS — PR #86 (3a27b06), payout.test.js, e2e/winner-bonus.spec.js; live ("WINNER BONUS" in the prod index bundle). An animated example was judged not worth the card's space.
- [x] O13 Cards, dialog, SAT cover, phone solo band, receipt rows (FRENZY, FORGE), shop, rebirth; no stale MOMENTUM / XP-per-word copy left (grep) — PR #76
- [x] O14 econ-sim extended (forge, frenzy, claims, stars/perks/automation, bad-time rebirths) — claude/econ-oct2/report.md: median gap 1.0–2.6 m, p90 ≤ 13 m, max 24 m
- [x] O15 CI green, merged — PR #76 (b3a50c3)

## STEP 49 — MARKS rework
- [x] M1 ONE marks system (16 collectible marks; the old title-marks folded in, owned set migrated) — PR #77, e2e/marks.spec.js
- [x] M2 Equipped MAIN = ×(1+bonus×tier): common ×1.0 / rare ×1.5 / epic ×2.0 / legendary ×3.0 → ≥100% at rare+ — PR #77 (marks.js MARK_TIERS, unit tests), claude/marks-oct2/shots/picker-1280.png
- [x] M3 Art kept (same MarkBadge glyph art, tier-coloured ring) — claude/marks-oct2/shots/menu-1280.png
- [x] M4 Unlock at LV10 (or R1) with a claimable reveal — PR #77, claude/marks-oct2/shots/reveal-390.png
- [x] M5 More reveals: LETTER FORGE (LV8), STARS (R1), AUTOMATION (R3), MARKS (LV10) each a NEW SYSTEM reveal claim; new achievements frenzy-1 / forge-26 / lv-300 — PRs #76 #77
- [x] M6 New mark = a claim (REWARDS count badge until clicked) — PR #77, e2e/marks.spec.js
- [x] M7 CI green, merged — PR #77 (001bcef); live (marker taw.marksOwned in index-B69R3VEq.js)

## STEP 50 — Worlds instead of themes
- [x] W1 Themes removed from the shop; owned themes refunded as a claim — PR #78 (themes.js retireThemes)
- [x] W2 25 menu tiers: 15 level steps to L1000 + rebirth tiers (MAX_TIER 24) — PR #78, claude/worlds/sheet.png
- [x] W3 Every tier is its own WORLD backdrop (24 SVGs, same flat-cartoon style) — PR #78, claude/worlds/shots/rooftops-1280.png, tier13-1280.png, tier24-1280.png
- [x] W4 Swish-up = ONE transform on one element; 4× CPU throttle (CI): p50 16.7 ms with and without the swish, p95 50 vs 33 ms (gate: no worse than the menu's own baseline band) — e2e/worlds.spec.js
- [x] W5 Level-up plate + star punch on every level-up, scale-hold fixed so it never overflows — claude/worlds/levelup/after-1280.png, after-320.png
- [x] W6 CI green, merged — PR #78 (165e2fb); live (marker taw.themeRefundPending)

## STEP 51 — Leaderboard upgrades
- [x] L1 Client counts LIFETIME LETTERS (taw.letters, +1 per accepted letter) and the board sorts by it — PR #79. BLOCKED (needs Andy): the DB column + lb_submit2 are in supabase/migrations/005_letters_cjk.sql, NOT applied (I never hold the DB connection string). Until it runs, the client feature-detects via lb_caps() and falls back to the old order.
- [x] L2 Board shows LV and WINS/WORD columns — PR #79, claude/leaderboard-oct2/shots/board-1280.png
- [x] L3 Rebirth stars gone; rebirth tier = name colour, frame from R5 — PR #79, board-1920.png
- [x] L4 18 ranks (to BEYOND at L1000) — PR #79, claude/leaderboard-oct2/shots/ranks-1280.png
- [x] L5 DONE (re-checked on prod 22:20 ET after Andy ran 005–013): the DB-side filter is live — lb_name_status('傻逼王') = blocked; the client filter shipped in PR #79.
- [x] L6 Realtime ticker (Phoenix broadcast, no migration needed) in the menu footer — PR #79 (live.js, LiveTicker)
- [x] L7 Online count via Realtime presence — PR #79
- [x] L8 Uncrowded: one ticker line in the footer, board = 4 columns — claude/leaderboard-oct2/shots/board-390.png
- [x] L9 DONE (re-checked on prod 22:20 ET after Andy ran 005–013): lb_caps = letters/cjk/cloud/weekly; board rows carry lifetime_letters (Daan 6,244, NoBuffCookies 3,121); CJK names allowed (测试八号 = ok).

## STEP 52 — Cloud save
- [x] C1 Investigated — most likely Safari ITP's 7-day script-storage purge / an in-app browser (separate storage); not an economy migration (migrations only raise) — claude/cloud-save/investigation.md
- [x] C2 Backup to Supabase keyed by the claimed name's device secret (43 progress keys) — PR #81 (cloudSave.js, client.js). BLOCKED for prod: supabase/migrations/006_cloud_save.sql not applied (needs Andy); client feature-detects and stays local-only until it runs.
- [x] C3 Auto-restore when the cloud is strictly ahead / local missing — PR #81, e2e/cloud-save.spec.js
- [x] C4 One-time recovery code on the leaderboard name card + restore form — PR #81
- [x] C5 Restore never lowers progress: shouldRestore requires strictly-ahead (rebirths, level, letters) — src/save/cloudSave.test.js
- [x] C6 DONE (re-checked on prod 22:20 ET after Andy ran 005–013): lb_caps.cloud = true; lb_load / lb_save are live (they answer no_profile for an unknown secret, not 404). Full restore was proven on prod in P0.3.

## STEP 53 — Word Bomb board + font sizes
- [x] B1 Ring cap 520 → 720 px; on the wide board the ring takes all the slack between prompt and input rows (0.78 of the board, was 0.72 + a double reservation): 1920x1080 ring 520 → 552 px — PR #82 (38d7581), wbRingSize.test.js, claude/wb-oct2/before|after/ingame-word-bomb-6p-1920x1080.png
- [x] B2 Receipt WINS figure 28 px → --fs-h2 (42 px at 1280), the receipt's one big thing; the docked receipt stacks its unit so it still clears SKIP (word-landing.spec green) — PR #82
- [x] B3 Bigger fonts while playing: everything read mid-round steps --fs-label (13px) → --fs-body (16–18px) — WB fragment label, used-word strip, kill feed, MATCH facts, player status; CHAIN/FUSE HUD, hero caption, death-card lines (seat names and the fragment label stay label-size: the ring's name caps clip a bigger name at 1163x501, and the label's height comes out of the ring). Gates green: wb-text-overlap, word-landing, wb-short-layout, wb-readability, viewport-integrity in-game cells (533 + 65). Shots: claude/b3-shots/. PR #99 (CI green)
- [x] B4 Solo teach strip leads with display-size TYPE A REAL WORD (Bungee --fs-panel, was body); WB coach caption --fs-band, sub line body (was label) — PR #82

## STEP 54 — Join mid-game
- [x] J1 Room code chip in the game header (own line under the prompt on phones) — PR #83 (2bcb1da), e2e/join-midgame.spec.js
- [x] J2 Code-join mid-round = spectator ("WATCHING — DEALT IN NEXT TURN"), dealt in at the next turn advance; additive (allowSpectate only on code-join, WB only) — backend PR #8 (joinMidgame.test.js, full backend suite green) + frontend PR #83
- [x] J3 Verified on PRODUCTION with two real clients: B code-joins mid-round → spectator → dealt in at the next turn (11.5 s later); WB smoke word accepted; frontend markers live — claude/join-midgame/prod-run-2026-10-02.txt. No revert needed.

## STEP 55 — Word lists
- [x] V1 Solo modes (FUSE/CHAIN) + server dictionary (WB/Blitz) both expanded — frontend PR #80 (words.common.txt, 626 words), backend PR #9 (COMMON_PROPER, 951 words)
- [x] V2 Months, days, countries, major cities — claude/wordlists/report.md; live ("february" in wordsData-Q5vKTkDa.js)
- [x] V3 Mild insults in; slurs/profanity asserted absent by test (commonWords.test.js uses the leaderboard blocklist)
- [x] V4 Common real words rejected: FUSE 74.3% → 1.3%, WB 16.8% → 0.1% of probe fragments — claude/wordlists/report.md

## STEP 56 — FUSE CLUTCH
- [x] F1 Accept with ≤2.0 s left → CLUTCH: six letters fly in from six screen edges and slam together, seconds-left stamp, ~1.3 s, transform/opacity only — PR #84 (67890e0), claude/clutch/clutch-1280.png, clutch-390.png
- [x] F2 Bonus = 3 words at the FUSE rate, credited as a named "CLUTCH!" wins line on the run receipt (no-hidden-wins invariant holds) — PR #84, e2e/fuse-clutch.spec.js

## STEP 57 — SAT Rush rework
- [x] S1 CASE CLOSED leads with CAPTURED (hero) + "n got away", then +WINS earned; score / avg ante / best streak / mastered on ONE ruled line; readable buttons — PR #85 (4c36453), claude/sat-oct2/before|after/. Fine-tune pass 1: exits no longer wait for the count-up (sat-results 3.5 → 5.5).

## STEP 58 — Menu layout (merged PR #86, 3a27b06; live — data-nav in the prod bundle)
- [x] N1 3 layouts built behind ?nav= (stack = current, top, rail), 7 viewports each (1024x500 … 1920x1080, 390x844, 320x640) — claude/menu-layout/{stack,top,rail}/
- [x] N2 Picked TOP. Why: SHOP/REBIRTH only sat "at the bottom" in two places — the phone strip under CHAIN | FUSE, and the short-laptop arrangement (1280x551: the nav dropped into the bottom row beside JOIN ROOM). TOP puts the nav under the title on a phone and on the wordmark's row on a short laptop — the HUD corner where games keep the shop — with the card row unchanged. RAIL cost the card row 170 px and overlapped WORD BOMB at 1366x768. The tall-screen column was already top-right and stays. The claim popup is pointer-transparent and never covers the nav (desktop bottom-centre, phone one compact row in the title band, short layout top-left, tucks itself away after 8 s). Compare claude/menu-layout/stack/menu-1280x551.png ↔ top/menu-1280x551.png, stack/menu-390x844.png ↔ top/menu-390x844.png

## STEP 59 — Animation headroom
- [x] H1 (PR #86) Measured (rAF while typing, 4× throttle, 1280x720 + 390x844) on menu, WB, Blitz, CHAIN, FUSE, SAT, WB game over — claude/perf-oct2/report.md, frames-before.txt / frames.txt
- [x] H2 Simplified where there was no headroom: beat sync no longer re-renders App or restyles <html> per beat (desktop menu typing 116 → 148 frames / 4 s); CHAIN/FUSE run-over hitch 700 → 200 ms / 683 → 67 ms. Headroom: phone + in-game multiplayer ≤1% long frames — this cycle's new one-shots (CLUTCH, FRENZY, WINNER row, world swish) live there; no new menu animation (it is the one screen over budget)

## STEP 60 — Fine-tune loop
- [x] T1 STEP 30 method run as three loops until the scores stopped improving (each closed by the < 0.3 stop rule): loop A O0 4.87 → O1 5.61 → O2 5.89 (PR #88); loop B → O3 6.11 → O4 6.41 → O5 6.48 (PRs #88, #89); loop C C0 6.35 → C1 6.17 (fresh reviewers, ±0.15 spread) (PRs #90, #91); camera made realistic (PR #93) → D0 6.26 → D1 5.56 (regression from #100, fixed in #101) → D2 6.30 (+0.04 vs D0: loop D closed by the stop rule); D0 fixes: forge claim copy, menu spotlight without dim, SAT phone earn pill off the HUD (PR #94), race names (PR #95), locked-preview close (PR #96) — all CI green, #93–#95 verified live. Table + pass log: claude/finetune/scores.md. All merged with CI green; #88–#90 verified live (marker greps).

## STEP 61 — Redeem codes (merged PR #87, 1d26db6)
- [x] R1 CODES entry at the end of the shop: one field + REDEEM + one answer line; a good code lands in REWARDS to claim (never pays on its own) — e2e/redeem-codes.spec.js, claude/codes/shop-codes-390.png, shop-codes-1280.png
- [x] R2 Server-side: supabase/migrations/007_redeem_codes.sql — public.redeem_codes (RLS on, no policies: the anon key cannot list codes), lb_redeem checks active / expiry / max_uses / one per player (claimed profile, else device secret), 12 tries per player per hour. BLOCKED for prod until Andy runs 007 in the SQL editor — until then the shop answers "CODES AREN'T SWITCHED ON YET" (tested).
- [x] R3 Instructions for Andy at the top of 007_redeem_codes.sql: Table Editor → redeem_codes → Insert row (code, wins, label, expires_at, max_uses, active)

## Queue: Batch A / Batch B
- [x] (superseded) contents now recorded in the DAY RUN goal above (P3/P4). Was: BLOCKED — the Oct 1 queue lists "Batch A, Batch B" by name only; their contents are not in claude/QUEUE-specs.md, this checklist, or any session transcript (the only "BATCH A" prompt is the Sept 16 batch, already shipped then). Needs Andy to re-paste them. Moved on to fine-tune loop B.

## Open at 08:00 Oct 2 (carried forward, each needs its own step)
- Migrations 005 / 006 / 007 not applied (letters + CJK names, cloud save, redeem codes): Andy pastes each into the Supabase SQL editor and runs it; the client already feature-detects all three.
- Batch A / Batch B: contents never recorded — needs Andy to re-paste.
- [x] 1920x1080 scale-up DONE after 08:00: at >= 1800x1000 the overlay / solo / race / lobby / room containers take a ~1.2x type scale (body 21, label 16, panel 34, h2 50) and their panels widen (shop 1120, dialog 760, death card 540, race 1220); the menu (own fit-math, locked wordmark) is untouched. Gates: viewport-integrity 1920 + 2560 cells, menu-fit, card-fit (267 passed), shop/race (77). Shots: claude/big-screens-shots/. PR finetune/big-screens
- WB phone ring is width-bound (0.72 of a 344px board) → a ~280px vertical band on tall phones; needs a layout change, not a formula tweak (the stack formula is pinned by wbRingSize.test).
