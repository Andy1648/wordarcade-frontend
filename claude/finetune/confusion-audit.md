# CONFUSION AUDIT — H6 (with H2d "SHOP/NUMBERS/REBIRTH make sense" + H7 "wording / location / font-size")

Branch `feat/marks-rolls-engine` @ fe24135, built with `npx vite build`, served by `vite preview --port 4193`.
I read it twice: once as a **brand-new LV1 player** (empty save) and once as a **LV300 veteran**
(R8, KEY POWER T12, 88 forges, SMITH rank IV worn, 9-day streak, 48.2B wins). Every number
below was checked against the function that computes it. No spec files were run.

Screenshots: `claude/finetune/confusion/` (scripts `shots.mjs`, `shots2.mjs`, `shots3.mjs`, `small.mjs` alongside).
Viewports: 1280x551, 390x844, 2560x1440.

**Severity:** HIGH = a wrong or contradicting number/claim · MED = confusing · LOW = polish.
**Count:** 16 HIGH · 21 MED · 9 LOW.

**Themes in one line each**
1. Every live "+N WINS" pill is an *estimate* (5-letter word, no rarity/combo/forge) and disagrees with what is banked.
2. "×N" means at least four different things: payout multiplier, a streak *count*, a score-only multiplier, and a SAT ante.
3. Several multipliers are labelled "XP" but also pay WINS (one stack since Economy v8). The cosmetics labelled "+X% XP" pay nothing in games.
4. Copy that names a rule the code does not have: answer sooner, 3 lives, first to 12, every mode.
5. One word, many meanings: WINS, RANK, STREAK, ★, ETERNAL, PHOENIX, MYTHIC.

---

## HIGH — wrong or contradicting numbers

### H1. The live "+N WINS" pill disagrees with what you are actually paid (every mode)
- **Where:** `src/App.jsx:1464`, `:1638` (WB/Blitz); `src/solo/ChainGame.jsx:196`; `src/solo/FuseGame.jsx:267`; `src/satRush/SatRushGame.jsx:172`. The pill renders in `WinsHud.jsx:17`.
- **What you see:** CHAIN, 6 links: the pill says **+120 WINS** (LV1) or **+421M WINS** (LV300). The balance actually moved by **+305** and **+1.04B**. See `chain-run-lv300.png`.
- **Why it's wrong:** the pill is `awardWins({wordsAccepted})`, which is word count × the rate for a 5-letter COMMON word. The bank pays each word's real length × rarity × combo × lucky × forge (`bankWordWins`). The game-over WINS EARNED is correct, so the HUD and the end card always disagree, usually by 2–3×.
- **Fix:** drive the pill from the banked running total (`winsEarned` / `winsEarnedTotal`). Delete the `awardWins` tally.

### H2. The XP-bar hint "TYPE ANYWHERE · 30 LETTERS TO LEVEL 2" is off by 2× (and by about 9× for a veteran)
- **Where:** `src/components/Homepage.jsx:1125` (shown via `MenuXp.jsx:355`).
- **What you see:** LV1: "TYPE ANYWHERE · **30 LETTERS** TO LEVEL 2" (`menu-lv1-desk.png`). LV300: "**5 LETTERS** TO LEVEL 301".
- **Why it's wrong:** the hint divides by the FEATURED card's rate (Word Bomb ×2). Typing on the menu earns the menu rate (×1, `xpPerInput`), so it takes 60 keystrokes, not 30. For the veteran a menu keystroke is ~6.9M XP against 321M needed, so it takes ~46 keys, not 5. The line says "TYPE ANYWHERE" and then quotes a game-only rate.
- **Fix:** on first run, compute with `xpPerInput({mode:'menu',…})`. Otherwise say where the rate applies: "5 LETTERS IN WORD BOMB TO LV 301".

### H3. CHAIN HUD: "LINKS · BEST 1840" puts your best SCORE next to your LINK count
- **Where:** `src/solo/ChainGame.jsx:309-311` (`g.best` is the score PB, `getScore: e.state.score` at `:86`).
- **What you see:** "**6** LINKS · BEST **1840**" (`chain-run-lv300.png`). It reads as a best of 1,840 links.
- **Fix:** `<span>LINKS</span>` here, and move BEST under SCORE ("SCORE · BEST 1,840").

### H4. "ANSWER SOONER, EARN MORE" is false in CHAIN and backwards in FUSE
- **Where:** `src/components/TeachStrip.jsx:29` (the default `payLine`). Both solo modes use the default.
- **What you see:** the first-run teach strip in CHAIN/FUSE (`solo-chain-desk.png`).
- **Why it's wrong:** neither mode pays for speed. CHAIN's ×multiplier comes from ending on a *new* letter (`chain.js:150`). Wins come from length × rarity × combo. FUSE's only time-based payout, CLUTCH, pays **more for answering late** (≤2 s left, `frenzy.js` CLUTCH_MS).
- **Fix:** CHAIN: "END ON A NEW LETTER → ×MULT". FUSE: "LONGER WORDS PAY MORE".

### H5. The CHAIN/FUSE death card hides a real run: "FIRST TRY. GET 3 WORDS." after 6 words, with no WINS EARNED
- **Where:** `src/solo/ChainGame.jsx:318` and `FuseGame.jsx:310` (`firstRun = runs === 1 || …`). `runs` is component state, so it resets every time the mode is opened. Copy is in `chainCards.jsx:62`.
- **What you see:** after 6 links (305 wins banked) the card says "FIRST TRY. GET 3 WORDS." … "A REAL WORD. NEXT TIME IT COUNTS." It shows no WINS EARNED, SCORE or BEST (`chain-over-lv1.png`). A LV300 veteran gets the same card on the first run of every visit.
- **Fix:** `firstRun = s.k < 3 && !hasPlayedMode(mode)`. Always render `WinsEarnedTotal` when the run banked anything.

### H6. FUSE preview says "SURVIVAL · 3 LIVES"; you start with 2
- **Where:** `src/components/modeExamples.js:24` vs `src/solo/fuse.js` (`FUSE_START_LIVES = 2`, max 3).
- **What you see:** "SURVIVAL · 3 LIVES" in the FUSE dialog and locked preview (`dialog-fuse-tall.png`). The HUD then shows ♥♥♡.
- **Fix:** "SURVIVAL · 2 LIVES (UP TO 3)".

### H7. WORD RACE contradicts itself on one panel: "FIRST TO 12" vs "FIRST TO 25", and "SAME LETTERS" vs "SAME WORDS"
- **Where:** `src/components/modeDialogConfig.js:37-38` (liner and sub) vs `modeExamples.js:25` and `gameData.js:136`. `race/config.js` has `RACE_WORDS = 25`.
- **What you see:** "SAME LETTERS. FIRST TO 12 WINS." right above "FIRST TO 25 · 1:00 CAP", with an example of whole words (`dialog-word-race-tall.png`). The card says "SAME WORDS FOR EVERYONE. FIRST TO 25 WINS."
- **Fix:** liner "SAME WORDS. FIRST TO 25." and sub "TYPE THE SAME 25 WORDS FASTEST". Drop "WINS" here (see H16).

### H8. SMITH mark says "+X% WINS IN EVERY MODE". It only applies in SAT RUSH and CHAIN
- **Where:** `src/progress/marks.js:212` (`markBlurbAt` reads `e.mode` only; SMITH uses `e.modes`). Shown by the rank-up announce `Homepage.jsx:674` and the new-mark reveal `ClaimReveal.jsx:42`.
- **What you see:** "RANK IV · SMITH MARK · **+36% WINS IN EVERY MODE**" (`menu-lv300-phone.png`).
- **Fix:** in `markBlurbAt`, `const where = e.modes ? 'in ' + e.modes.map(label).join(' and ') : …`. Also add `chain: 'CHAIN', fuse: 'FUSE'` to `MODE_LABEL`, so LINKER/PYRO stop reading "in chain"/"in fuse".

### H9. Shop cosmetics promise "+5% … +200% XP" that never applies to a game word
- **Where:** `src/components/ShopScreen.jsx:500`; the multiplier only feeds `xpPerInput` (menu keystrokes) via `useXpCapture.js:61`. `xpPerWord`/`perWordFactors` never read it.
- **What you see:** "CHROME +5% XP … LEGEND +200% XP" on pop styles priced up to ~2.9e11 wins.
- **Why it's wrong:** it boosts menu-typing XP only. It gives no XP in any mode and no wins, and no receipt ever shows it. `shop.js:2` itself says cosmetics are "PURE FLAIR … NOT XP".
- **Fix:** label it "+5% MENU XP", or apply it to `perWordFactors.bonus` if the shop should mean it.

### H10. Rebirth "GAIN: a permanent ×10" is your new total, not what this rebirth adds
- **Where:** `src/components/ShopScreen.jsx:59, 370, 404, 420`. `nextMult = rebirthMult(rc+1) = 1 + rc + 1`.
- **What you see (R8):** "REBIRTH 9 TO GET ×10 WINS" and "GAIN: a permanent ×10 on wins and XP" (`rebirth-lv300-desk.png`).
- **Why it's wrong:** you are already ×9, so this rebirth adds ×1.11 (+11%). "×10" reads as a tenfold boost. At R1 the same copy is honest (×2), so the copy gets more misleading the more you play.
- **Fix:** "GAIN: ×9 → ×10 (+11%) on wins and XP". Hero: "×9 → ×10".

### H11. Rebirth "LOSE: all XP — back to LEVEL 1" is wrong for anyone with HEAD START
- **Where:** `src/components/ShopScreen.jsx:398` vs `stars.js headStartLevel` (`1 + 5 × perk`, up to half the next gate).
- **What you see:** the veteran (HEAD START 2) reads "back to LEVEL 1" and lands on LV 11. The ceremony then says "HEAD START: YOU BEGIN AT LV 11".
- **Fix:** "LOSE: all XP — back to LEVEL {headStartLevel(rebirths+1)}".

### H12. "COMBO ×5" (a count) and "COMBO ×1.5" (a multiplier) appear on the same Word Bomb screen
- **Where:** `src/components/ComboMeter.jsx:52-53` (`×{count}` of words in a row) vs the receipt row `COMBO ×1.5` (`payout.js`, `combo.js`: +0.1 per word). `ComboPill.jsx` ("WIN COMBO ×1.5") exists but is mounted nowhere.
- **What you see:** "✦ COMBO ×5" floating over the input, while the receipt beside it says "COMBO ×1.5".
- **Fix:** ComboMeter → "5 IN A ROW", or show the real `×{comboMultiplier(count)}`. Mount ComboPill or delete it.

### H13. VOLUME achievements ("Accept 1,000 words") ignore CHAIN, FUSE and WORD RACE words
- **Where:** `src/progress/achievements.js:26` reads `readWordCount()`. `wordCount.addWords` is only called for WB/Blitz/SAT (`App.jsx:1359,1590`, `useSatRushGame.js:229`; `wordCount.js:27`).
- **What you see:** the player card says "WORDS TYPED 14.6K" (the sum of mastery words over all 5 modes, `StatsScreen.jsx:224`), but WORDSMITH (1,000) can stay locked for a CHAIN/FUSE player.
- **Fix:** base `s.words` on the same mastery sum the player card uses, or call `addWords` from the solo accept path.

### H14. The stated mark bonus range "+100% to +300%" disagrees with "UP TO ×5.8"
- **Where:** `src/progress/marks.js:286` (the NEW SYSTEM claim blurb) vs `MarksIndex.jsx:111` (rank-V legendary = 1 + 3 × 1.6 = ×5.8).
- **What you see:** the reveal says +100%…+300%. The index says "UP TO ×5.8" (+480%).
- **Fix:** "+100% to +300% (×2–×4), growing with rank to ×5.8".

### H15. SAT RUSH results "+N wins earned" leaves out bonuses credited during the run
- **Where:** `src/satRush/SatRushResults.jsx:115`. It uses `winsEarned` only; SAT never subscribes to `subscribeWins` like `ChainGame.jsx:139`.
- **What you see:** a mastery milestone or collection milestone in the run shows as a toast, then disappears from the results. The balance moves by more than the card says, which is the exact "800 vs 2k" bug fixed elsewhere.
- **Fix:** collect `kind:'bonus'` ledger lines per run, as CHAIN/FUSE do, and list them under the wins line.

### H16. "WINS" is both the currency and the act of winning
- **Where:** `gameData.js:136` ("FIRST TO 25 WINS"), `modeDialogConfig.js:37` ("FIRST TO 12 WINS"), `ModeExample.jsx:133` ("WIN THE GAME +50% OF ITS WINS"), `GameCard.jsx:289` ("WIN +50%").
- **What you see:** on the card where currency is "N WINS / WORD", "FIRST TO 25 WINS" reads as a payout of 25.
- **Fix:** keep WINS for the currency only: "FIRST TO 25 WORDS", "WINNER: +50% BONUS".

---

## MED — confusing

### M1. A mode's multiplier appears two ways: "POWER ×5" on the card, "MODE ×10" on the receipt
- `GameCard.jsx:288`, `ModeExample.jsx:128` (power vs WB) vs `payout.js:25` (raw `XP_MULTIPLIERS`: WB ×2, SAT ×10, CHAIN ×4). The card says SAT is ×5; the Word Bomb receipt says MODE ×2. A player comparing them can't connect them.
- **Fix:** print the receipt row as `MODE` = power ×N with base ×2 folded into BASE, or rename the card line "×5 WORD BOMB".

### M2. The unnamed "(×69.06)" on every card differs per card with no reason given
- `GameCard.jsx:274`. The LV300 cards show ×69.06 / ×53.12 / ×82.4 / ×87.41 / ×55.57 / ×40.86 (`menu-lv300-desk.png`). It's rebirth × streak × mark × per-mode mastery × stars, but nothing says so, and two decimals on a ×69 is noise.
- **Fix:** "(×69 BONUS)" with a tooltip, formatted via `formatMult`.

### M3. The XP-only labels also pay WINS: streak, mastery, STUDENT/VETERAN/LEGEND marks
- `MenuXp.jsx:235` "×1.1 XP"; `ModeDialog.jsx:27` "+N% XP THIS MODE"; marks.js blurbs "+20% XP in every mode". All of these sit in the one stack (wins = XP ÷ 10), so they raise wins equally. The labels make "XP" vs "wins" marks look like a real choice when they're the same lever.
- **Fix:** relabel to "×1.1 (XP + WINS)" / "+N% THIS MODE". Merge the XP-vs-wins mark wording.

### M4. CHAIN's visible multiplier only affects SCORE; the one that affects wins is hidden
- `ChainGame.jsx:308` "X1.00" is the score multiplier (fresh end letter). Wins use `g.combo.mult` (consecutive accepts), which no solo screen shows (`SoloShell.jsx` comment: the WIN-COMBO chip was removed "as a duplicate").
- **Fix:** label the chip "SCORE ×1.25" and put "COMBO ×1.3" on the wins side.

### M5. SAT RUSH: the big "REWARD 5×" ante changes score only, not wins
- `AnteMeter.jsx` (`sr-mult`) / the SAT card art "5×" next to "POWER ×5". The ante decays 5×→1× per stage, but `SatRushGame.jsx` weights wins by rarity × combo × lucky × typed-share, so the reward poster promises a bounty the wins never see. The card art's 5× and POWER ×5 are unrelated fives.
- **Fix:** label it "SCORE 5×", and/or let the ante feed the wins weight.

### M6. "STREAK" means the daily streak and the in-run combo, sometimes on the same panel
- `payout.js:126,130`: the inactive rows say COMBO "streak under 2" and STREAK "streak under 3 days". `StatsScreen.jsx:70` "BEST STREAK" (combo) sits next to "LONGEST DAILY STREAK". SAT HUD "streak" is a third thing.
- **Fix:** COMBO "fewer than 2 in a row"; records "BEST COMBO".

### M7. "RANK" names three ladders
- Level rank (ROOKIE…BEYOND), mark rank (I–V), and leaderboard #rank. The "RANK UP" claim (`claims.js:52`) and the "RANK IV" mark announce both read as the same thing.
- **Fix:** call mark ranks "MARK LV II" or "★II". Keep RANK for level titles.

### M8. One name, many things: ETERNAL ×4, PHOENIX ×2, MYTHIC ×2, VETERAN/CURATOR
- ETERNAL is a level rank (LV650), a mark, a secret achievement, and a leaderboard rebirth title (`LeaderboardScreen.jsx:58`). PHOENIX is a mark and a rebirth title. Achievement MYTHIC = "Reach level 300" (`achievements.js:73`) while rank MYTHIC is LV150–199. Marks VETERAN/CURATOR read "VETERAN — GET: VETERAN", which is the bug the SAVANT rename (`marks.js:74`) was meant to stop.
- **Fix:** rename the achievement MYTHIC → ORACLE (or "THREE HUNDRED"), and the marks VETERAN → OLD HAND and CURATOR → ARCHIVIST.

### M9. ★ means both your rebirth count and the STARS currency
- `MenuFrame.jsx:106` draws "★★★★★ ×8" (8 rebirths), while the rebirth screen sells "+7 ★" stars (balance 21 ★). The stats card says "R8".
- **Fix:** use a different glyph for rebirths on the frame (e.g. ⟳ ×8 or "R8").

### M10. A locked mark's "HOW TO GET IT" names the achievement, not the task
- `MarksIndex.jsx:36,137`. You see "GET: QUICK THINKER", "GET: UNBROKEN", "GET: COLLECTOR"; the task (e.g. "Reach Category Blitz Mastery 5") is only in another tab.
- **Fix:** pass `achievements.hint` instead of the name: "GET: REACH BLITZ MASTERY 5".

### M11. Marks of the same tier look identical; the perk that differs is never shown
- `MarksIndex.jsx:16` (`tag = MAIN ×N` only). BOMBER, STUDENT and VETERAN all read "MAIN ×2" (`marks-lv300-desk.png`), and LINGUIST's rarity chance is invisible. The choice is blind.
- **Fix:** add one perk line in the Detail panel (`markBlurbAt(m, rank)`).

### M12. The worn mark's multiplier uses three formats
- Menu chip "SMITH ×3.2" (`MenuXp.jsx:278`, ad-hoc rounding), index "MAIN ×3.18", receipt BONUS ×(main × perk × mastery × stars).
- **Fix:** use `formatMultExact` in the chip.

### M13. KEY POWER is priced in WINS but its effect is stated in XP per letter
- `ShopScreen.jsx:233-245`: "574K XP PER LETTER · NEXT TIER: 1.43M XP · 21.8B WINS · YOUR RATE: 39.6M WINS / WORD". The tier's effect on the wins rate (×2.5) is never stated.
- **Fix:** "NEXT TIER: ×2.5 → 99M WINS / WORD".

### M14. KEY POWER tier is written three ways
- "KEY POWER — TIER 12" (shop), "KEY POWER XII" (purchase sticker, `ShopScreen.jsx:114`, numerals only up to X), "T12" (stats + rebirth ceremony).
- **Fix:** use "TIER 12" everywhere.

### M15. "+5% PER FORGED LETTER" is ambiguous
- `ShopScreen.jsx:282,295`. It's +5% per forged *level* of each letter *in the word* (twice for a doubled letter). A veteran with 88 forges sees "+5% PER FORGED LETTER" and reasonably expects +440%.
- **Fix:** "+5% PER FORGE LEVEL OF EACH LETTER IN THE WORD".

### M16. STATS "WHERE YOUR XP COMES FROM" only explains menu typing
- `StatsScreen.jsx:196-201,355`. It lists KEY POWER / BASE XP / REBIRTH / MENU XP; mode, forge, marks, mastery, streak and stars are missing. "XP INTO LEVEL" (`:188`) has no "/ cost".
- **Fix:** retitle it "MENU TYPING XP", or list the full `perWordFactors`. Show "123M / 444M".

### M17. STATS "ROUNDS PLAYED" lists 3 of 6 modes
- `StatsScreen.jsx:202-206` (`ROUND_MODES` in `wins.js:41`). CHAIN, FUSE and RACE rounds are never counted.
- **Fix:** add the missing modes to `ROUND_MODES`, or retitle "ROOM ROUNDS".

### M18. STATS has two identical "??? UNDISCOVERED" grids: SECRETS and HIDDEN ACHIEVEMENTS
- `StatsScreen.jsx:320-353` (`stats-lv300-desk-mid.png`). Ten masked tiles in two sections that look the same; the difference is only in a code comment.
- **Fix:** merge them or caption them ("SECRETS = things you do · HIDDEN = goals you cross").

### M19. The phone menu shows no level, no XP bar and no wins balance
- `MobileMenu.jsx` (`menu-lv300-phone.png`). The desktop leads with LEVEL / XP / WINS. On a phone you have to open STATS or SHOP to learn your balance, and the rate is nowhere on the mode rows.
- **Fix:** add a one-row "LV 300 · 48.2B WINS" strip to `.hp-m-top` (a cluster member, not a fixed orphan).

### M20. The phone STATS button opens REWARDS while claims are waiting
- `MobileMenu.jsx:329`. The button says STATS (with a count bubble) but opens the claims panel.
- **Fix:** label it "STATS · 3 TO CLAIM", or give rewards their own target.

### M21. The difficulty picker never says harder pays more
- `RoomScreen.jsx:388` shows "15s · 2 lives" only. `DIFFICULTY_MULT` pays CHILL ×1, HARD ×1.25, CRAZY ×1.5, HELL ×2 (`wins.js:158`). The mode card/dialog quote the CHILL rate.
- **Fix:** append the multiplier: "HELL — 7s · 2 lives · ×2 WINS".

---

## LOW — polish

- **L1.** Number grouping prints a thin space, not the comma `format.js`'s own header says replaced it: "6 000", "2 000 WORDS" (`format.js:24`). Set `THIN = ','` as the comment describes.
- **L2.** LiveStack shows "70.1M / WORD" with no unit (`LiveStack.jsx:48`), next to a pill that says WINS. Use "70.1M WINS / WORD".
- **L3.** CHAIN multiplier uses a lowercase "x" and two decimals: "X1.00" (`ChainGame.jsx:308`). Use `×{formatMult}`.
- **L4.** Rebirths appear as "R8" (stats), "★★★★★ ×8" (frame) and "8 REBIRTHS" (rebirth screen). Pick one ("REBIRTH 8").
- **L5.** Marks tutorial: "EARN THEM FROM HARD ACHIEVEMENTS" (`registry.js:23`), yet STUDENT comes from "Reach level 15" and PHOENIX from your first rebirth. Use "EARN THEM FROM ACHIEVEMENTS".
- **L6.** Weekly tutorial: "EVERY WORD YOU TYPE COUNTS" (`registry.js:41`), but menu typing doesn't count (`wins.js:618`). Use "EVERY WORD YOU PLAY IN A GAME COUNTS".
- **L7.** Mastery progress "0/31 TO M2" (`ModeDialog.jsx:29`) and marks "2 000 WORDS → RANK V" have no unit or "more". Use "31 WORDS TO M2" / "2,000 MORE WORDS → RANK V".
- **L8.** Collection milestones are flat 5,000 × rebirth (`collection.js:35`), while achievements and rank-ups are priced in words at your live rate. At LV1 the 100-word milestone is ~500 words' worth (the biggest early payout); at LV300 it's 0.001 of one word. Price them in words like `achievementWords`.
- **L9.** At 2560x1440 the XP cluster (level, wins, streak, mark) renders ~600px wide over a ~1900px card row, with the lower half of the frame empty (`menu-lv300-huge.png`). The main progress readout is the smallest thing on screen. Scale `.menu-xp-cluster` with `--solo-k`-style hero sizing.

Font-size check: an automated pass at 1280x551, 390x844 and 2560x1440 (menu, shop, rebirth) found **no** rendered text under 12px (`small.mjs`), so the min-text sweep holds. The H7 problems are wording and placement (above), not raw size.

**Seed-dependent observations (not counted):** a restored or cloud-synced LV300 save on a new device sees the first-timer "TYPE A WORD 👇 GO" hook and the "TYPE OR CLICK ANYWHERE" spotlight, because both are keyed on per-device flags (`wa_has_played`, spotlight flag) rather than level. Worth gating on `level > 1 || rebirths > 0`.
