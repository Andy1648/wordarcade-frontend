# CONFUSION AUDIT 2 (read-through)

Branch `fix/confusion-2`, cut from origin/main 15ece21c. This was a source read only: no browser, Playwright or sim.
I read every screen's component and copy twice. Pass 1 was as a brand-new LV1 player. Pass 2 was as an LV150+ veteran (several rebirths, a worn mark, KEY POWER tiers, forges, automation).
Every number was checked against the code or backend that produces it. The first audit (`claude/finetune/confusion-audit.md`, H1–H16 / M1–M21 / L1–L9) is not repeated here.

**Severity:** HIGH = a wrong or contradicting number or claim · MED = confusing · LOW = polish.
**Count:** 8 HIGH · 13 MED · 9 LOW. **FIXED in this PR: 10** (all copy-only, marked **FIXED**).
Lines marked "fenced" are in files this job was told not to touch (PROGRESSION v11 rework). Their fixes are proposed for the main session.

---

## HIGH — wrong or contradicting numbers or claims

### C1. Category Blitz dialog says "~60 SECONDS"; a game is 3 × 30s rounds — **FIXED**
- `src/components/modeExamples.js:22` (`MODE_ROUND_LENGTH['category-blitz']`)
- **Quote:** "~60 SECONDS"
- **Why:** backend `categoryBlitzLogic.js` has `TOTAL_ROUNDS = 3` and `ROUND_TIME_SECONDS = 30`, so a game is 90s of play plus intermissions. The solo results screen itself says "CATEGORY BLITZ · 3 ROUNDS".
- **Fix:** "3 ROUNDS · 30s EACH".

### C2. The game calls itself "AI CATEGORY BLITZ"; the menu says "CATEGORY BLITZ", and no AI judges answers — **FIXED**
- `src/components/GameScreen.jsx:2974, 4400, 5007, 5279`; `src/components/RoomScreen.jsx:20`
- **Quote:** "AI CATEGORY BLITZ" (header, spray-reveal title, room game-mode picker, solo results)
- **Why:** the card, dialog, phone row and SEO page all say CATEGORY BLITZ. gameData's `aiJudged` comment says scoring is list-only (STEP 9) and the card ribbon is "AI BUILT" (the lists were built with AI). "AI CATEGORY BLITZ" reads as "an AI decides if my answer counts", which is the opposite of what happens. It also looks like a different mode from the one the player picked.
- **Fix:** "CATEGORY BLITZ" everywhere in-game.

### C3. "HARD" means the hardest bot and the 2nd-easiest timer tier, on the same room screen — **FIXED**
- `src/components/RoomScreen.jsx:45-49` (BOT_DIFFICULTIES) vs `src/difficulty.js:17-20`
- **Quote:** bot picker "EASY / MEDIUM / **HARD** (fast · brutal)" sits above the DIFFICULTY row "CHILL / **HARD** / CRAZY / HELL"
- **Why:** HARD the bot is the top tier (key `hard`). HARD the difficulty is tier 2 of 4 (key `easy`). A host who wants it hard has to guess which HARD is meant.
- **Fix:** rename the bot tier to "TOUGH".

### C4. Word Bomb 1v1 status rail shows "STREAK ×5", a count dressed as a multiplier (H12 again) — **FIXED**
- `src/components/GameScreen.jsx:3747-3753` (`.wb-status`, rendered at ≤2 players)
- **Quote:** "STREAK ×5"
- **Why:** H12 established that "×" is for multipliers only, and changed the ComboMeter to "5 HITS". This rail still prints the same count as "×5". It also calls it a third name (STREAK), right next to the daily streak 🔥 and the receipt's real COMBO ×1.5.
- **Fix:** key "HITS", value "5", matching the ComboMeter.

### C5. New-mark reveal: "+100% WINS ON EVERY WORD, + +20% wins & XP in every mode." — **FIXED**
- `src/claims/ClaimReveal.jsx:42`
- **Why:** there is a double "+ +". The case is mixed inside a caps sticker. And the MAIN bonus says WINS only, even though it sits in the one stack (wins and XP, H6/M3). The tutorial says "YOUR MAIN MULTIPLIES EVERY WORD".
- **Fix:** "WEAR IT AS YOUR MAIN: +100% ON EVERY WORD. PLUS +20% WINS & XP IN EVERY MODE."

### C6. The Word Bomb card says "WIN → YOUR GAME ×7", but PLAY SOLO (vs a bot) pays ×1.5
- `src/components/GameCard.jsx:293, 302` (also the phone mode row via the dialog)
- **Why:** `WINNER_MATCH.wordBomb.mult = 6` only pays against a human (`WINNER_NOTES.bots: 'MATCH BONUS NEEDS A HUMAN RIVAL'`). A bot game falls back to `WINNER_FALLBACK.wordBomb = 0.5`, which is ×1.5. The dialog says "VS A HUMAN RIVAL", but the card does not. A new player taps PLAY SOLO, wins, and gets ×1.5 against the ×7 the card promised.
- **Fix:** "BEAT A HUMAN →" + " YOUR GAME ×7". **Not fixed:** the card head is fit-measured (card-fit e2e), so a longer head needs a Playwright run.

### C7. Rebirth drops you down the leaderboard, and nothing says so
- `src/components/ShopScreen.jsx:398` (fenced: rebirth lines); board order in `src/leaderboard/client.js:409-414` and `supabase/migrations/017_board_reality.sql`
- **Quote:** "LOSE: all XP — back to LEVEL 11."
- **Why:** the board ranks by LEVEL only, and "rebirths are not ranked". An LV150 veteran who rebirths falls from (say) #3 to off the page. The rebirth screen lists LOSE / KEEP / GAIN without mentioning the board. The tutorial (below) doesn't either.
- **Fix (for main session):** "LOSE: all XP — back to LEVEL 11, and your board spot."

### C8. The rebirth tutorial still says "BACK TO 1", and the marks tutorial says marks come from achievements
- `src/tutorials/registry.js:71` and `:32` (fenced)
- **Quotes:** "YOUR LEVEL GOES BACK TO 1 — FOR A PERMANENT BONUS." · "MARKS — EARN THEM FROM ACHIEVEMENTS."
- **Why:** HEAD START lifts the new climb (`stars.js headStartLevel`), which the first audit's H11 fixed on the rebirth screen but not here. Marks are now mostly ROLLED (`ROLL_MARKS`, the "ROLL FOR MARKS" tutorial two entries down). Only PERMANENT marks come from achievements.
- **Fix (for main session):** "YOUR LEVEL RESETS — FOR A PERMANENT BONUS." · "ROLL FOR THEM, OR EARN ONE FROM AN ACHIEVEMENT."

---

## MED — confusing

### C9. Word Bomb dialog has "PLAY SOLO" and a second button that says just "PLAY" — **FIXED**
- `src/components/modeDialogConfig.js:13` (`bomb.create`), rendered `ModeDialog.jsx:288`
- **Why:** with PLAY SOLO leading, "PLAY" reads as the same action twice. It actually opens a room you share with a code.
- **Fix:** "WITH FRIENDS" (fits the one-line mono secondary row; tests target `.mode-dialog-btn-create` by class).

### C10. FUSE "SHORT WORD — fuse ×0.8": lowercase, and the "×" hides that it is a penalty — **FIXED**
- `src/solo/FuseGame.jsx:394`
- **Why:** "fuse ×0.8" reads like a multiplier on the score or the payout. It means this fuse burns 20% faster because the last word was short (`fuse.js shortFactor`).
- **Fix:** "SHORT WORD — FUSE 20% SHORTER".

### C11. Word Bomb game-over "BEST STREAK" is the in-game combo; Stats calls it "BEST COMBO" — **FIXED**
- `src/components/GameScreen.jsx:1453`
- **Why:** H6/M6 renamed the Stats record to BEST COMBO, to keep STREAK for the daily streak. The game-over summary still says BEST STREAK for the same run-of-accepts number.
- **Fix:** "BEST COMBO".

### C12. The mode dialog's bonus "(×3.2)" is unnamed; the card says "(×3.2 BONUS)" — **FIXED**
- `src/components/ModeExample.jsx:121`
- **Why:** M2 fixed the card. The dialog, opened from that card, prints the same factor bare, right after "WINS / WORD".
- **Fix:** "(×3.2 BONUS)" with the same tooltip.

### C13. Shop "NEXT" goal card says "YOU HAVE 1,234", which is the balance, not the gap — **FIXED**
- `src/components/ShopScreen.jsx:521`
- **Why:** the comment says the card "always shows the GAP". KEY POWER and FORGE say "NEED n MORE WINS". The cosmetic goal card repeats the balance that's already in the header.
- **Fix:** "NEED 766 MORE".

### C14. The leaderboard climb moment says "RANK UP", the same words as the level-title claim
- `src/leaderboard/RankUpMoment.jsx:43` vs `src/progress/claims.js:53` / `achievements.js:284` ("RANK UP — MYTHIC")
- **Why:** M7 kept RANK for level titles. The board moment "#4 → #3" uses the same kicker, so two different events share one name.
- **Fix:** "BOARD CLIMB". *Next-tier candidate; not in the top 10.*

### C15. SAT RUSH results "avg ante 3.2×": "ante" appears nowhere else, and the × is on the wrong side
- `src/satRush/SatRushResults.jsx:163`
- **Why:** in play the meter is the REWARD / "SCORE — CAPTURE NOW FOR MORE". "ante" is engine vocabulary, and "3.2×" breaks the house "×N" form.
- **Fix:** "avg score ×3.2" (and update `e2e/sat-rush.spec.js:116`, which pins 'avg ante').

### C16. SAT poster "ESCAPED ×3 — REWARD DOUBLED": ×3 is a count, and the doubled reward is score only
- `src/satRush/WordCard.jsx:180`
- **Why:** `revenantMultiplier: 2` multiplies SCORE (`engine.js:460`). Wins never see it (M5). "×3" right before "DOUBLED" reads as a ×3 multiplier.
- **Fix:** "ESCAPED 3 TIMES — SCORE ×2" (the bounty voice is sanctioned, but the numbers should be right).

### C17. Collection "12 TO 100" and "ALL MILESTONES CLAIMED — 2,000 CAP"
- `src/components/CollectionScreen.jsx:51, 55`
- **Why:** "12 TO 100" can read as a range. "CAP" is unexplained: the player can't tell if it's a word cap, a wins cap, or the end.
- **Fix:** "12 MORE TO 100 · +5,000 WINS" · "ALL MILESTONES CLAIMED".

### C18. Three phrasings of the same 3-word payout gate
- `WinsHud.jsx:39` "WORDS TO EARN" · `SatRushResults.jsx:129` "capture 3 to start the bounty" · `race/WordRaceScreen.jsx:328` "3 WORDS START THE BANK"
- **Fix:** one phrase everywhere: "3 WORDS TO START EARNING".

### C19. Automation announce "+3 KEY POWER · +2 FORGE": +3 of what?
- `src/components/Homepage.jsx:725-729`
- **Why:** KEY POWER is "TIER n" everywhere since M14. "+3 KEY POWER" reads as three of a currency.
- **Fix:** "+3 KEY TIERS · +2 FORGES". Not fixed here: the level-up layer's sub line must fit 320px (comment at MenuXp.jsx:960) and that needs a browser check.

### C20. Rebirth hero "REBIRTH 9 TO REACH ×10 WINS" says WINS only; GAIN says "on wins and XP"
- `src/components/ShopScreen.jsx:368-370` (fenced: rebirth lines)
- **Fix:** drop the unit ("×10") or say "×10 WINS & XP".

### C21. Word Race prints "+N WINS · +N XP" in-race and at the finish. No other mode's HUD shows per-run XP since Andy oct2 ("remove XP per word from game-mode screens")
- `src/race/WordRaceScreen.jsx:286, 327`
- **Why:** it is the only XP readout in any game. It also conflicts with v11's "game words = wins only" direction.
- **Fix:** drop the "· +N XP" half (coordinate with v11).

---

## LOW — polish

- **C22.** The SAT RUSH dialog's round line says "SURVIVAL" while CHAIN/FUSE say "SURVIVAL · 1 LIFE" / "· 2 LIVES (UP TO 3)". SAT has 3 lives (`engine.js:48`, and the cover says "3 LIVES · ENDLESS RUN"). `modeExamples.js:28` → "SURVIVAL · 3 LIVES".
- **C23.** Mastery line "BONUS AT M5" doesn't say what the bonus is (`ModeDialog.jsx:35`). → "WINS BONUS AT M5".
- **C24.** The level-up card says "LEVEL 9" with "LV 8 → LV 9" under it, which says the same thing twice (`MenuXp.jsx:924`). Andy: no useless info. → leave the detail empty, or put the next rank title there.
- **C25.** The rebirth celebration sub "PERMANENT MULTIPLIER" doesn't name the number (`MenuXp.jsx:979`). → "×10 WINS & XP, FOR GOOD".
- **C26.** Word Bomb 1v1 rail "MODE CHILL": the menu calls Word Bomb a MODE, and this row is the difficulty (`GameScreen.jsx:3757`). → "LEVEL" is taken too; use "TIER".
- **C27.** FUSE HUD says "WORDS · BEST 15", then the death card says "SCORE 12 · BEST 15" for the same number (FUSE score = wordsSolved, `FuseGame.jsx:144`; `SoloShell.jsx:380`). → let FUSE pass a "WORDS" label to the scoreline.
- **C28.** The same rate-limit error has two different copies: "TOO MANY NEW NAMES FROM HERE. TRY LATER." vs "THE BOARD IS BUSY FROM THIS NETWORK. TRY IN AN HOUR." (`LeaderboardScreen.jsx:51`, `ClaimPrompt.jsx:47`). Pick one.
- **C29.** Mixed-case sentences inside the caps house style: Stats "— active typing only" (`StatsScreen.jsx:390`) and Collection "No RARE or OBSCURE words yet. Play a mode…" (`CollectionScreen.jsx:72`).
- **C30.** The forge is counted three ways: "LETTER FORGE — 12 FORGED" (shop heading), "12 BUYS" (rebirth ceremony KEPT, `ShopScreen.jsx:207`), "+2 FORGE" (automation). Pick "FORGED".

---

## Checked and fine (no change)
- The menu streak/mark chips print their "×" (MenuXp's local `formatMult` wraps `formatMultExact` with the ×; e2e marks.spec pins "×2").
- WORD RACE copy ("FIRST TO 25 · 1:00 CAP", "2–5 RACERS", "BOTS FILL THE GRID TO 3") matches `race/config.js`.
- Difficulty picker "×N WINS" (M21) reads `DIFFICULTY_MULT`.
- Phone STATS→CLAIM slab (M20), board "YOU'D SHOW AS LV n · N WORDS" (the rows do show words as the sub line).

## e2e strings touched by the fixes
Grepped `e2e/` for every changed string. None of them is pinned (`.mode-dialog-btn-create`, `.shop-card-gap`, `.wb-status` are matched by class and visibility only). `wbRailFit.js` measures the rail: "HITS" / "5" is narrower than "STREAK" / "×5". No spec edits were needed.
