# Andy's notes — Oct 2 (outrank everything else queued)

A box is checked ONLY with evidence: a merged PR #, a measured number, or a screenshot path.
Andy's emphasis on every item: **OBVIOUS and MAKES SENSE** (mechanics AND visuals), never
overcrowded with useless info, and **updated EVERYWHERE** when something changes (cards,
receipts, dialogs, tutorials, leaderboard).

Specs verbatim: `claude/QUEUE-specs.md` (§ Oct 2).

## Oct 2 DAY RUN goal (11:41 ET → 08:00 ET Oct 3). Order: P0 migration checks → P1 Andy's six → the rest
### P0 — migrations 005/006/007 (Andy ran them; verify on PRODUCTION)
- [x] P0.1 letters sort the board — prod lb_caps = {letters, cjk, cloud: true}; live board #1 is elol LV3 with 2,742 letters ahead of LV179 with 0 (view orders by lifetime_letters desc). 12:00 ET
- [ ] P0.2 HALF (PR #105 merged — 008 still needs Andy to RUN it): Chinese slur rejected by the DB (lb_name_status('傻逼王') = blocked) ✔. Chinese CLAIM FAILS ON PROD: lb_name_status says ok but lb_claim raises username_shape — 005 widened the constraint + name check but never replaced lb_claim (004 still has the ASCII-only regex). FIX = supabase/migrations/008_claim_cjk.sql (PR #105) + migrationShape.test.js. **ANDY: paste 008 into the SQL editor and Run** — I re-test the claim on prod once it's applied.
- [x] P0.3 cloud save on PROD (Playwright, typeaword.com): claimed zzcloud7b1486, menu backed up a 616-byte blob, secret cookie set; localStorage.clear() + reload → restored LV4 save + profile, taw.cloud.restored=1. 11:55 ET
- [ ] P0.4 BLOCKED (needs Andy): lb_redeem is live (an unknown code answers bad_code) and the anon key cannot read or insert redeem_codes (401 — correct). I hold no admin credential, so I can't add the test row. **ANDY: Table Editor → redeem_codes → Insert: code ZZTEST-ONCE, wins 1, max_uses 1, active true.** I poll for it during the run, redeem it twice from a fresh device (expect ok, then already_used), and then you delete the row (anon can't delete either).

### P1 — Andy's six (outrank everything except P0; every word matters)
- [ ] A1 WORLDS: revert the new world backdrops. SAME floating-word background as before, shifted to different positions per tier ("as if the scene moved"), same smooth ONE-transform swish. Keep the 24 border tiers. New art only if genuinely high quality (it isn't).
- [x] A2 Remove the "N online" count from the menu — PR #106 (merged): LiveTicker empty at rest, only other players' moments.
- [x] A3 MARKS button — CAUSE: not fit-math/race; the chip rendered only while a mark was WORN or a NEW mark unseen, so opening the picker without wearing one hid it until the next unlock (and an old save with no taw.marksOwned showed nothing). Now always present once MARKS is revealed (LV10/R1): worn → title chip, else MARKS (NEW MARK + dot when unseen). PR #108 (merged), marks.spec 6/6, claude/day-oct2/a3-marks-1280x551.png
- [x] A4 ★ REWARDS button removed (desktop + phone); STATS wears the claim count and opens the claims while any wait. Measured: dots 10×10 → 20×20, count 22×22 → 30×30 (1280x551 / 1280x800 / 390x844) — claude/day-oct2/a4-before|after-*.png, e2e/claims-via-stats.spec.js. PR #110
- [x] A5 SHOP dot — CAUSE: canAffordAny still counted the retired menu THEMES (gone from the shop since STEP 50), so 60+ wins lit the dot with nothing buyable (KEY POWER I is 200). Fixed + unit tests (fails on old code) + e2e/shop-dot.spec.js (fresh LV1 0 wins → no dot; 150 → no dot; 5,000 → dot). PR #107 (merged)
- [ ] A6 RACE = ENTIRE-WORD racing (monkeytype/TypeRacer): same sequence of whole words for every racer, type each in full, advance; first to finish or most at the cap wins. Keep the game CARD exactly. Backend additive (new race variant; WB/Blitz untouched), unit-tested, prod WB smoke after deploy, revert via PR if it fails. Live 2-tab race on PROD: same words, same winner, progress <=250 ms apart. Payout via the existing pipeline, matches the card.

- [x] A7 (Andy, added 12:40 ET) BOARD RANKS BY LIFETIME WORDS, not letters (letters began at #79, no backfill → everyone else showed 0). Andy re-sorted public.leaderboard by lifetime_words in Supabase (NOT reverted; recorded as 009_board_by_words.sql). PROD verified: 15 rows strictly descending by lifetime_words (#1 Daan 1,061 … elol 321 at #6 despite 2,742 letters). WORDS is the main stat on the board column + "YOU'D SHOW AS", the rank-up moment ("N WORDS · ON THE LEADERBOARD"), the claim prompt ("N WORDS · NO SIGN-IN…"); the ticker only names LV / rank moves (no stat). ranksAhead = words → level → rebirths (rank.test.js); boardMock + leaderboard / leaderboard-pull e2e updated (11/11). PR #109

### Andy, added 13:05 ET (authorized)
- RULE — BACKEND: test BEFORE merging: run the backend locally, drive 2 Playwright contexts (+ a bot) through the changed flow, then merge; after Render deploys, prod WB smoke; revert via PR if it fails. Applies to Blitz list-only and RACE.
- [ ] B9.0 BLITZ: list-only ONLY for enumerable categories (BLITZ-ENUMERABILITY.tsv) whose lists can be made complete; REMOVE the ~270 open-ended ones entirely (list-only on an open category rejects correct answers — dinosaurs 8/8 rejected). Fewer categories is fine. No empty packs.
- [ ] D1 Rewrite PROJECT-design-and-conventions.md to be true today: .wall-surface is homepage-only, Blitz list-only + AI BUILT ribbon, no Imposter, add RACE, sweep the rest vs main.

### Andy, added ~13:40 ET (authorized) — queued after the current steps, in this order
- [ ] R10 SCALING + BOOST REDEEM CODES + FRENZY/BOOST END moment. Migration is **010_redeem_kinds.sql** (Andy said 008 — taken by 008_claim_cjk.sql, merged #105; 009 records the words-board view). Columns kind ('wins'|'boost'), per_level, boost_mult (3), boost_min (10), returned by lb_redeem; re-runnable; Andy runs it. Client: per_level × level on claim; 'boost' = wall-clock BOOST timer, a named perWordFactors factor stacking with FRENZY, persists across reloads; gold BOOST pill + countdown; receipt ×3 BOOST line; degrades to today's behaviour without 010. FRENZY OVER / BOOST OVER finite moment (letters implode, slab cracks, ~1.2 s, transform/opacity, reduced-motion readable); pill pulses red at 10 s. Update shop redeem UI, receipts, FUSE card copy, e2e redeem spec. SQL in the PR body. Test 1280x551 + fresh LV1; nothing under 13px.
- [ ] NC NO CAPS ON NUMBERS. Migration **011_no_caps.sql** (same numbering reason): wins_per_word plain numeric (drop the 1e9 check), latest submit fn without least(...,1e9), redeem_codes.wins numeric check >= 0 (idempotent). format.js SUFFIXES named tiers to 1e308 (never raw digits; 3 sig figs; tests 1e15/1e30/1e300/Infinity). Sweep src/ for every cap on wins/rewards/multipliers/prices/levels — list each (file:line, old cap, removed/kept why). Bank, redeem and cloud save handle > 9e15 without NaN/Infinity. SQL in the PR body.
- [ ] KP KEY POWER curve: keyTierXp(t) = round(25 × 1.4^(t-1)) for t >= 1, 10 at T0; KEY price in words at your rate growing ×1.15/tier; econ-oct2 sims before/after with minutes-of-play per tier at T5/T20/T50/T100 (target: every tier +40%, next tier 2–15 min, never a wall); nobody's XP/letter drops at their current tier (floor at today's); update shop card, receipts, anything showing "+15"; no caps.

### P2 — STEP 9 Blitz list-only
- [ ] B9.1 backend: only complete enumerable categories; judge removed from scoring; reason "NOT ON THE LIST"; 8 good + 8 junk unit tests per category
- [ ] B9.2 prod check: zzzzzzzz rejected; WB smoke (revert via PR if it fails)
- [ ] B9.3 frontend: ribbon AI JUDGED → AI BUILT; no "judged by AI" claims anywhere; no empty packs

### P3 — Batch A (contents from the Oct 2 day goal)
- [ ] BA1 bot playtest every mode (50 games each); fix the top 3 unfun moments per mode
- [ ] BA2 WB bot win-rate tuning: median human vs MEDIUM wins 45–60%
- [ ] BA3 phone gameplay with the keyboard up: input / prompt / timer always visible
- [ ] BA4 4x-throttled input latency < 50 ms
- [ ] BA5 failure states (offline, WS drop, cold start) — no lost wins

### P4 — Batch B
- [ ] BB1 rebirth ceremony showing kept-vs-reset
- [ ] BB2 stats page redesign worth screenshotting
- [ ] BB3 weekly leaderboard reset Monday 00:00 ET, server-side

### P5 — the rest
- [ ] WB phone ring layout fixed (a layout change, not a formula tweak)
- [ ] Andy's notes re-check: cosmetics auto-equip on buy (N1), animated reward text bigger (N2), ONE big thing per screen — cut the end-game wins breakdown down (N3/N4)
- [ ] Until 08:00 ET Oct 3: keep running fine-tune passes over every screen

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
- [ ] L5 BLOCKED on migration 005 (needs Andy to paste it into the Supabase SQL editor and Run): client CJK names + Chinese blocklist ship in PR #79 (nameFilter.test), the DB-side filter lands with 005
- [x] L6 Realtime ticker (Phoenix broadcast, no migration needed) in the menu footer — PR #79 (live.js, LiveTicker)
- [x] L7 Online count via Realtime presence — PR #79
- [x] L8 Uncrowded: one ticker line in the footer, board = 4 columns — claude/leaderboard-oct2/shots/board-390.png
- [ ] L9 PARTIAL — live in prod (marker taw.letters / lb_caps in index-B69R3VEq.js); the letters + CJK half waits on migration 005

## STEP 52 — Cloud save
- [x] C1 Investigated — most likely Safari ITP's 7-day script-storage purge / an in-app browser (separate storage); not an economy migration (migrations only raise) — claude/cloud-save/investigation.md
- [x] C2 Backup to Supabase keyed by the claimed name's device secret (43 progress keys) — PR #81 (cloudSave.js, client.js). BLOCKED for prod: supabase/migrations/006_cloud_save.sql not applied (needs Andy); client feature-detects and stays local-only until it runs.
- [x] C3 Auto-restore when the cloud is strictly ahead / local missing — PR #81, e2e/cloud-save.spec.js
- [x] C4 One-time recovery code on the leaderboard name card + restore form — PR #81
- [x] C5 Restore never lowers progress: shouldRestore requires strictly-ahead (rebirths, level, letters) — src/save/cloudSave.test.js
- [ ] C6 PARTIAL — client live in prod (marker taw.cloud.restored); server half waits on migration 006

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
