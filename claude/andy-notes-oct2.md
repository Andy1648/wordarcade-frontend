# Andy's notes — Oct 2 (outrank everything else queued)

A box is checked ONLY with evidence: a merged PR #, a measured number, or a screenshot path.
Andy's emphasis on every item: **OBVIOUS and MAKES SENSE** (mechanics AND visuals), never
overcrowded with useless info, and **updated EVERYWHERE** when something changes (cards,
receipts, dialogs, tutorials, leaderboard).

Specs verbatim: `claude/QUEUE-specs.md` (§ Oct 2).

## Andy's newest notes (Oct 2, later)
- [x] N1 Buying a cosmetic AUTO-EQUIPS it — PR #76 (shop.js `buy` equips; unit test + e2e/shop.spec.js 'auto-equips')
- [ ] N2 "Bigger text" includes ANIMATED text — reward pops, level-ups
- [ ] N3 Every screen picks ONE thing to make big and shrinks the rest
- [ ] N4 The end-game "WHERE YOUR WINS CAME FROM" breakdown is cut down

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
- [ ] O12 PARTIAL — cards: WINS / WORD (base word) + POWER ×N / FRENZY ×5 + LONGER = MORE; the (×N) tag is only what the player built (PR #76). OPEN: the game has no end-of-round WINNER bonus to advertise yet — building one (Tier 1, game-over path) is queued after STEP 54.
- [x] O13 Cards, dialog, SAT cover, phone solo band, receipt rows (FRENZY, FORGE), shop, rebirth; no stale MOMENTUM / XP-per-word copy left (grep) — PR #76
- [x] O14 econ-sim extended (forge, frenzy, claims, stars/perks/automation, bad-time rebirths) — claude/econ-oct2/report.md: median gap 1.0–2.6 m, p90 ≤ 13 m, max 24 m
- [x] O15 CI green, merged — PR #76 (b3a50c3)

## STEP 49 — MARKS rework
- [ ] M1 ONE marks system (collectibles); the other "marks" merged/removed
- [ ] M2 Equip one as MAIN / title → real bonus ≥100%, tiered by rarity
- [ ] M3 Current mark art direction kept
- [ ] M4 Marks unlock at a level/rebirth gate with a mechanic-REVEAL moment
- [ ] M5 More reveal moments across progression
- [ ] M6 Claiming a new mark = a click, with a notification icon until claimed
- [ ] M7 CI green, merged

## STEP 50 — Worlds instead of themes
- [ ] W1 Themes removed from the shop
- [ ] W2 Border tiers: many more steps, planned to L1000+ and through rebirth tiers
- [ ] W3 Each border-tier change swaps the background to a new WORLD (same art style)
- [ ] W4 Swish-upward transition, one transform; no lag at 4× CPU throttle (measured)
- [ ] W5 Level-up star animation + every level-up moment checked and polished
- [ ] W6 CI green, merged

## STEP 51 — Leaderboard upgrades
- [ ] L1 Main stat = LIFETIME LETTERS TYPED (+1 per accepted letter)
- [ ] L2 Also shows level and current WINS/WORD
- [ ] L3 Rebirth stars removed → rebirth tier = name colour/frame
- [ ] L4 More ranks
- [ ] L5 Chinese (CJK) usernames allowed + Chinese profanity list in the same DB-enforced filter
- [ ] L6 Supabase Realtime live ticker on the menu ("NAME just hit LV 50", "NAME took #3")
- [ ] L7 Live online count
- [ ] L8 Uncrowded (screenshot)
- [ ] L9 Verified on production

## STEP 52 — Cloud save
- [ ] C1 Cause of the friend's reset investigated (Safari ITP 7-day wipe, cleared data, economy migration, other)
- [ ] C2 Progress backed up to Supabase, tied to the claimed username's device secret
- [ ] C3 Automatic restore when local data is missing
- [ ] C4 New device: one-time recovery code shown at claim time
- [ ] C5 A restore never lowers progress (test)
- [ ] C6 Verified on production

## STEP 53 — Word Bomb board + font sizes
- [ ] B1 WB board spread out; proportions per the step-8 rules (measured)
- [ ] B2 Bigger reward text (what you earned is unmissable)
- [ ] B3 Bigger fonts generally while playing
- [ ] B4 Bigger tutorial prompts in every mode

## STEP 54 — Join mid-game
- [ ] J1 Room code visible on screen during the game
- [ ] J2 Join-by-code mid-round → spectator, dealt in at the next turn/round (backend, additive, unit-tested, WB rules intact)
- [ ] J3 Verified on production with two browsers (revert via PR if WB smoke fails)

## STEP 55 — Word lists
- [ ] V1 Accept lists expanded for every mode, especially FUSE
- [ ] V2 Proper nouns that are common words (months, days, countries, major cities)
- [ ] V3 Mild insults (idiot, loser, moron); NO slurs / hate terms
- [ ] V4 Measured: % of fragments where common real words are rejected, before → after

## STEP 56 — FUSE CLUTCH
- [ ] F1 Word accepted with ≤2s left → CLUTCH moment (big, spread-out animation)
- [ ] F2 Payout bonus, shown on the receipt (payout-honest)

## STEP 57 — SAT Rush rework
- [ ] S1 "CASE CLOSED" screen clear, satisfying, consistent with the other modes

## STEP 58 — Menu layout
- [ ] N1 3 layouts built (top corner, side rail, current), screenshots
- [ ] N2 One picked, with the reason

## STEP 59 — Animation headroom
- [ ] H1 Frame time measured at 4× CPU throttle on the menu and every mode
- [ ] H2 More / higher-quality animation where there is headroom; simplified where there isn't

## STEP 60 — Fine-tune loop
- [ ] T1 STEP 30 method over every screen touched since Oct 1, until scores stop improving (score table)

## STEP 61 — Redeem codes
- [ ] R1 CODES entry in the shop
- [ ] R2 Codes server-side in Supabase (expiry, one use per player)
- [ ] R3 Andy creates codes by adding rows in the Table Editor (instructions)
