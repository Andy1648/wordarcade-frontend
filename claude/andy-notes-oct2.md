# Andy's notes — Oct 2 (outrank everything else queued)

A box is checked ONLY with evidence: a merged PR #, a measured number, or a screenshot path.
Andy's emphasis on every item: **OBVIOUS and MAKES SENSE** (mechanics AND visuals), never
overcrowded with useless info, and **updated EVERYWHERE** when something changes (cards,
receipts, dialogs, tutorials, leaderboard).

Specs verbatim: `claude/QUEUE-specs.md` (§ Oct 2).

## Andy's newest notes (Oct 2, later)
- [x] N1 Buying a cosmetic AUTO-EQUIPS it — PR #76 (shop.js `buy` equips; unit test + e2e/shop.spec.js 'auto-equips')
- [ ] N2 IN PROGRESS — rarity pop --fs-hero, receipt WINS --fs-h2 (PR #82); level-up plate 1.2× hold (PR #78); in-game "+N WINS" landing pop --fs-panel → --fs-h2 (phone body → panel) and menu letter pops --fs-panel → --fs-h2 (fine-tune pass 2, finetune/oct2)
- [ ] N3 IN PROGRESS — applied per screen in the fine-tune loop: CASE CLOSED = CAPTURED (#85); death card = the result title (--fs-h1), hint steps down; WB game over: REMATCH the one filled button, LEAVE outline, upsell mono ghost; WB dialog: PLAY SOLO leads, PLAY/JOIN a mono row; round receipt top 3 + n MORE (#82)
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
- [ ] B3 PARTIAL — tutorial + reward text bigger (B2, B4); a general in-play type pass is queued for the fine-tune loop (STEP 60)
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
- [ ] T1 IN PROGRESS — claude/finetune/scores.md: loop A O0 4.87 → O1 5.61 → O2 5.89 (PR #88); loop B O3 6.11 → O4 6.41 → O5 6.48 (PRs #88, #89); both closed by the < 0.3 stop rule; loop C running from C0 6.35 (Andy /goal: keep going until 08:00 ET)

## STEP 61 — Redeem codes (merged PR #87, 1d26db6)
- [x] R1 CODES entry at the end of the shop: one field + REDEEM + one answer line; a good code lands in REWARDS to claim (never pays on its own) — e2e/redeem-codes.spec.js, claude/codes/shop-codes-390.png, shop-codes-1280.png
- [x] R2 Server-side: supabase/migrations/007_redeem_codes.sql — public.redeem_codes (RLS on, no policies: the anon key cannot list codes), lb_redeem checks active / expiry / max_uses / one per player (claimed profile, else device secret), 12 tries per player per hour. BLOCKED for prod until Andy runs 007 in the SQL editor — until then the shop answers "CODES AREN'T SWITCHED ON YET" (tested).
- [x] R3 Instructions for Andy at the top of 007_redeem_codes.sql: Table Editor → redeem_codes → Insert row (code, wins, label, expires_at, max_uses, active)

## Queue: Batch A / Batch B
- [ ] BLOCKED — the Oct 1 queue lists "Batch A, Batch B" by name only; their contents are not in claude/QUEUE-specs.md, this checklist, or any session transcript (the only "BATCH A" prompt is the Sept 16 batch, already shipped then). Needs Andy to re-paste them. Moved on to fine-tune loop B.
