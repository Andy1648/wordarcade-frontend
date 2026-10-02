# Andy's notes — Oct 2 (outrank everything else queued)

A box is checked ONLY with evidence: a merged PR #, a measured number, or a screenshot path.
Andy's emphasis on every item: **OBVIOUS and MAKES SENSE** (mechanics AND visuals), never
overcrowded with useless info, and **updated EVERYWHERE** when something changes (cards,
receipts, dialogs, tutorials, leaderboard).

Specs verbatim: `claude/QUEUE-specs.md` (§ Oct 2).

## PR #75 — Economy v9 (re-check against the Oct 2 notes)
- [ ] e2e shard 2/4 failure found + fixed (cause, not a retry)
- [ ] KEY POWER price / XP-per-letter curve LESS exponential
- [ ] Pop styles / sound packs cost MORE
- [ ] Pop styles / sound packs visually SMALLER in the shop
- [ ] Nothing caps at a dead end (in #75's scope: mastery; MOMENTUM → STEP 48)
- [ ] CI green, merged

## STEP 48 — Economy rules
- [ ] O1 NO dead-end caps: shop MOMENTUM ("marks", caps at 200, no gameplay) replaced by an UNCAPPED boost with a VISIBLE effect
- [ ] O2 SAT Rush earns much more per word than Word Bomb (its card power is real in the payout)
- [ ] O3 CHAIN: higher wins per word than Word Bomb
- [ ] O4 FUSE: SAME wins per word as Word Bomb; FRENZY (5 min, ×5 wins, persists across runs) is why its bar is higher — OBVIOUS on the card
- [ ] O5 … and in the FUSE dialog
- [ ] O6 … and in-game (FUSE HUD countdown + trigger moment)
- [ ] O7 Late game: 1–2 new layers/systems (Sell-Lemons logic: each prestige layer unlocks a new system)
- [ ] O8 Rebirth panel shows "REBIRTH TO GET: N" and warns when it's a bad time
- [ ] O9 Wins ONLY from playing games
- [ ] O10 Achievements / titles / badges / rank-ups are CLAIMED (popup or click) with a notification icon until claimed
- [ ] O11 "XP per word" removed from game-mode screens
- [ ] O12 Cards show the BASE + "LONGER WORDS = MORE" + end-of-round bonus (animated winner's-multiplier example only if it earns its space)
- [ ] O13 Updated everywhere: cards, receipts, dialogs, tutorials, leaderboard
- [ ] O14 econ-sim extended; before/after report
- [ ] O15 CI green, merged

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
