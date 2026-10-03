# PROGRESSION v11 — spec (Andy oct3 17:45, AMENDED 18:15) — overrides v10's power scaling

Branch `feat/pv11` (PR #169). Estimate: `claude/econ-oct2/v11-estimate.mjs` (arithmetic, NOT the economy
sim — outputs `v11-estimate.txt`, `v11-estimate-stretch3.txt`). The real measurement is `loop-sim.mjs` on
CI (it imports `src/progress`, so it measures this code with no patch; on main it measures v10).

## Andy's rules (amended 18:15 wins where they conflict with 17:45)
1. **GAME WORDS GIVE WINS ONLY.** No XP / bar progress from accepted game words. Option F (bar floor) and
   its "LEVEL FLOOR" receipt row are removed.
2. **THE BAR fills from typing LETTERS** (menu + in-game) × KEY tier XP/letter × rebirth/mark XP boosts —
   "play → wins → buy KEY → more XP per letter → level faster". Every card, receipt, shop line and tutorial
   says it plainly with the word BASE ("BASE 10 XP / LETTER").
3. **CURVE:** one fixed curve for everyone (no power scaling), smoother and QUICKER than live v10, each
   level only a BIT harder than the last — between v9 (L^4, too soft) and v10 (too steep).
4. **SIM (CI, 3 skills):** wins buy a KEY tier every few minutes early; each KEY tier visibly speeds levels;
   no dead bar; no runaway; a rebirth re-climb that starts fast. Minutes per level at LV10/50/100/200,
   median, before vs after.
5. **Existing players** keep `{lv, into-fraction}`; nobody loses levels.

## The model
    XP per LETTER = BASE 10 × KEY 1.2^T × REBIRTH (1 + R) × MARK
- **KEY:** ×1.2 a tier, compounding — every tier is "+20% XP / LETTER" (T5 ×2.49, T10 ×6.19, T20 ×38).
  Each tier needs ~17% fewer letters for the same level: a visible speed-up at every tier, not just the
  first few (an additive +25% fades to +4% a tier by T20 — V3 below shows what that costs).
- **REBIRTH:** ×(1 + R) — the same multiplier wins get (+100% a rebirth).
- **MARK:** the worn MAIN mark: COMMON +10%, RARE +20%, EPIC +30%, LEGENDARY / PERMANENT +50%.
- **No mode, word-weight or streak term:** a letter is a letter. The menu adds only its own cosmetic
  "+X% MENU XP" pop/sound multipliers. WINS keep their whole exponential stack (KEY ×2.5 a tier, etc.).
- **Letters counted:** a–z added to a game input (Word Bomb / Blitz `GameScreen`, CHAIN / FUSE `SoloShell`,
  WORD RACE), or an ACCEPTED letter in SAT RUSH (its rejected keys stay worthless). A jump of 3+ letters in
  one change (paste / autocomplete) is 0. Same anti-mash cap as the menu: 30 letters a rolling second.

## The curve (picked)
    need(n) = round10(100 + 15 · n² · 1.004^(n−1))
| LV | 1 | 10 | 50 | 100 | 200 | 300 | 400 |
|---|---|---|---|---|---|---|---|
| need | 120 | 1,650 | 45,700 | 222,800 | 1.33M | 4.45M | 11.8M |
| step to next | +33% | +21% | +4.4% | +2.4% | +1.4% | +1.1% | +0.9% |
A quadratic with a gentle exponential lean — between v9's L^4 and v10's power-scaled exponential: steep in
ratio early (where KEY ramps ×10 in the first 15 minutes) and gentle late (where income grows only through
slow KEY tiers and rebirths), so each level is only a bit harder than the last and the bar never dies.

## Three versions (estimate, 200 h per bot; letters per word = length × (1 + miss rate); mark ×1)
| | **V1 — PICK** | V2 — pure exponential | V3 — additive KEY |
|---|---|---|---|
| curve | 100 + 15·n²·1.004^(n−1) | 300·1.04^(n−1) | as V1 |
| KEY / rebirth | ×1.2 a tier / ×(1+R) | ×1.2 / ×(1+R) | +25% of base a tier / ×(1+R) |
| median LV100 / LV200 / LV400 | **3.6 h / 20.5 h / 135 h** | 24 m / 5.0 h / — | 10.6 h / 84 h / — |
| median min/level LV10 · 50 · 100 · 200 | **0.6 · 1.2 · 2.2 · 4.8** | 0.3 · 0.1 · 0.3 · 3.9 | 0.9 · 3.7 · 8.9 · 28.7 |
| median min % of a level per word (LV≤400) | **0.48%** | 0.036% (dead from ~LV300) | 0.19% |
| casual / strong LV100 | 7.6 h / 1.4 h | 43 m / 16 m | 21.6 h / 5.3 h |
| median LV1→15: first → after R1 → R3 → R10 | 7.5 m → 1.8 m → 42 s → 6 s | 4.3 m → 60 s → 18 s → 6 s | 9.7 m → 3.4 m → 1.5 m → 24 s |
| verdict | **pick** — monotone pace, no dead bar, a few hundred levels | levels 50–100 take seconds (KEY outruns it), dead bar late | KEY fades; slower than v10 past LV100 |
Sensitivity (V1, KEY tiers 3× slower than the measured timeline): median LV100 4.4 h, pace 1.5 · 1.6 · 3.2 ·
7.0 min, min 0.40% — still quicker than v10 and no dead bar.

## BEFORE vs AFTER — median minutes per level (first time the level is reached)
| | LV10 | LV50 | LV100 | LV200 | first LV100 |
|---|---|---|---|---|---|
| **before — live v10** | 0.7 | 5.0 | 3.6 | 7.3 | 10.1 h (CI main 16:40: 7.7 h) |
| **after — v11 (estimate)** | **0.6** | **1.2** | **2.2** | **4.8** | **3.6 h** |
| casual before → after | 1.6 → 0.8 | 13.1 → 3.2 | 11.4 → 6.0 | 22.4 → 13.2 | 27 h → 7.6 h |
| strong before → after | 0.3 → 0.6 | 2.0 → 0.5 | 1.3 → 0.9 | 4.1 → 1.9 | 4.0 h → 1.4 h |
BEFORE is derived from v10's own 3-skill 200 h loop-sim run (`loop-sim-v10-chosen-3skill.json`): the climb
that first passed each level, split by v10's need curve (minutes of the climb × need(L) ÷ Σ need over the
climb). v10 was non-monotone (LV50 slower than LV100: the K ×10 ramp at LV30–40); v11 rises smoothly.
**Exact numbers come from CI:** loop-sim now prints `v11 pace` for both trees (rule P runs main too).

## Option F — REMOVED
`src/progress/barFloor.js` and its test are deleted; the receipt's LEVEL FLOOR row, its CSS and the sim's
floor counter are gone. Words give no XP, so there is nothing to floor; the estimate's minimum is 0.48% of a
level per word's letters (median, LV1–400).

## Implementation
- `src/progress/xp.js`: `needAt(n)` = the curve above (finite, capped at MAX_VALUE ≈ LV171k; any v10 power
  argument ignored); `need = needAt`. `LEVEL_XP_PER_LETTER` 10, `KEY_XP_STEP` 1.2, `REBIRTH_XP_STEP` 1,
  `keyXpMult` (1.2^T, finite), `rebirthXpMult`, `levelXpPerLetter(kt, rc, markMult)`. `xpPerInput` = one
  letter (+ menu cosmetics, + mark); its `mode` / `streakMult` args are ignored. `xpPerWord` (WINS)
  unchanged. `needV9` kept for legacy conversion; `creditXp`/`progressOf` ignore v10's power argument.
- `src/progress/letterXp.js` (new): THE shared in-game path. `noteTypedLetters(prev, next, mode)` /
  `noteLetters(n, mode)` only bump a counter (rate-capped, no storage, no layout, no React state) and
  schedule ONE flush per animation frame; `flushLetterXp` → `creditLetterXp` reads the level once, credits
  letters × `letterXpNow()`, writes once, and fires the mid-game LV chip on a level-up. `markXpBoost`,
  `MARK_XP_BOOST`, `lettersAdded`.
- Inputs: `GameScreen.jsx` (WB DraftInput + Blitz input), `SoloShell.jsx` (CHAIN/FUSE), `WordRaceScreen.jsx`,
  `useSatRushGame.js` (accepted letters). One added line each. **App.jsx untouched** (no change needed).
- `src/progress/wins.js`: `awardWordXp` credits NOTHING to the bar; it still returns `{ state, level,
  leveledUp: false, gain, mastery, mark }` (gain = the wins product) and does mastery / mark / letters /
  the mastery milestone as before. `perWordRateNow` drops `levelXp`.
- `useXpCapture.js`: menu keys priced with the worn-mark boost. `racePayout.js`: `xp: 0`.
- Receipt (`payout.js`, `PayoutBreakdown`): WINS only — no XP headline, no floor row; the base term reads
  in WINS in #168's style: "BASE 1 WINS / LETTER × 5 LETTERS ×2 MODE" multiplies out to "+10 WINS".
- Copy: cards' tail "BASE 10 XP / LETTER" (beside WINS / WORD); mode dialog + teach strip "WORDS PAY WINS ·
  BASE 10 XP / LETTER"; shop KEY "BASE 10 XP / LETTER × KEY T6 ×2.99 (+20%)"; rebirth "+100% XP / LETTER &
  WINS — ×4 → ×5"; Stats BASE XP / LETTER 10 · KEY ×… XP · REBIRTH · MARK +N% XP · GAME XP / LETTER · MENU
  XP / LETTER; menu hint "N LETTERS TO LEVEL X"; the one-time notice "LETTERS FILL THE BAR — BASE 10 XP /
  LETTER · WORDS PAY WINS. YOU KEPT EVERY LEVEL."; WORD RACE shows WINS only; streak says "wins".
- Migration unchanged from the first v11 pass: stamp 11 (`migrateEconomyV11`), `{lv, f, rc, v:10}` kept
  byte for byte, so every save keeps its level and bar fraction under the new need.
- `loop-sim.mjs`: credits each word's typed letters through `letterXp.creditLetterXp` (length, + length
  again on a fumbled attempt); word XP is whatever the tree's `awardWordXp` does (0 here, word XP on main).
  New per skill: `v11.pace` (min/level LV10/50/100/200), `v11.key` (KEY buys in the first hour, max gap,
  median XP-per-letter step per tier), plus the existing dead-bar bands and re-climb clock. Option F output
  removed. The workflow summary greps the `v11 ` lines.

## Tests (node --test, 921 pass)
- `pv11.test.js` (26): the published curve; need independent of KEY / rebirths; monotone with a step of
  +0.4%…+5% from LV50; finite at LV1e6; KEY ×1.2 a tier (+20%) while wins keep ×2.5; rebirth ×(1+R) and
  the mark boost; `awardWordXp` moves nothing; letters counted (deletions / pastes / digits skipped),
  batched to one write; the 30/s cap; menu and game price a letter the same; each KEY tier needs < 85% of
  the letters; a re-climb after a rebirth takes fewer letters than the first; a v10 save keeps level +
  fraction; legacy conversion; stale tabs; grandfathered gate.
- `xp.test.js`, `streak.test.js`, `payout.test.js`, `race.test.js` updated; `barFloor.test.js` deleted.
- e2e (not run here): `payout-honesty` (a word moves the bar 0 XP, no XP line, wins == card × rows, base in
  wins), `word-landing` (wins base parse, no XP headline), `menu` (hint = ceil(cost / 10) letters, the
  featured card says BASE 10 XP / LETTER).

## What CI should show
- long run: median first LV100 ≈ 3–5 h, LV200 ≈ 15–30 h, LV400 inside 200 h; `v11 pace` median ≈ 0.6 · 1.2 ·
  2.2 · 4.8 min (each below main's); `dead bar: PASS` for all skills; `v11 KEY first hour` many buys with a
  max gap of a few minutes and step ×1.2; re-climbs faster than the first. Wins/KEY eta should be close to
  main (wins untouched; the rebirth pace moves the ×(1+R) wins multiplier).
- The sim does NOT model menu typing or mark XP, so live players level somewhat faster than it shows.
- If too slow: lower `CURVE_V11_A` (15 → 12). If a dead bar shows late: lower `CURVE_V11_LEAN` (1.004 → 1.002).

## ROUND 2 (adversarial review + coordinator, oct3)
1. **MENU MASHING.**
   - ONE limiter for menu + every game input: `letterXp.LETTER_RATE_CAP = 12` credited letters per rolling
     second (≈ 140 WPM — above any honest burst). `useXpCapture` and `noteLetters` share it (wall clock).
   - COSMETICS ARE LOOKS ONLY: pop styles / sound packs no longer multiply XP (`xpPerInput` ignores
     popMult/soundMult; the "+N% MENU XP" card line is gone; `xpMult` stays in the data as a legacy field).
   - MENU letters are HALF a game letter: `MENU_LETTER_SHARE = 0.5` → MENU 5 XP / LETTER × KEY × rebirth ×
     mark (game letters BASE 10). Estimate (`v11-estimate.mjs --masher`: a masher at 12/s, no wins → no KEY,
     rebirthing at every gate, vs the median bot), cumulative level-ups masher ÷ median:
     | menu price | 10 min | 30 min | 1 h | 5 h | 20 h |
     |---|---|---|---|---|---|
     | ×1 (BASE 10) | **×1.97** | ×1.43 | ×1.01 | ×0.84 | ×0.74 |
     | **×0.5 (shipped)** | **×1.10** | ×0.89 | ×0.82 | ×0.61 | ×0.52 |
     | ×0.25 | ×0.66 | ×0.49 | ×0.51 | ×0.42 | ×0.36 |
     At full price a masher out-levels a player ~2× in the first 10 minutes (before wins buy KEY); at half
     price it never beats ×1.5 and falls behind as KEY compounds. `loop-sim.mjs` now runs a MASHER bot on the
     real modules (`v11 MASHER … PASS/FAIL (limit ×1.5)`; 20 h max). If CI shows FAIL: lower
     `MENU_LETTER_SHARE` (0.5 → 0.35).
   - Residual: a masher typing into a GAME input gets the full game price (inside the same 12/s cap). Game
     inputs only exist during a live round (WB/Blitz turns, CHAIN/FUSE/RACE clocks; SAT credits ACCEPTED
     letters only), so it is bounded by playing; not in the sim.
2. **ECON RPC 11.** `cloudSave.ECON_RPC_VERSION = 11`; the client sends the p_econ the server reports
   (`econRpcArg`): 018 run → 11; only 016 → 10 (as before, so the client works until Andy runs 018);
   neither → the old RPCs. `supabase/migrations/018_econ_v11.sql` (WRITE ONLY): lb_submit3 / lb_save2 /
   lb_load2 accept **p_econ = 11 ONLY**, lb_caps reports econ 11 (+ board_econ). 10 is NOT accepted: a stale
   v10 tab's board writes are clamped and monotone, but its cloud SAVE would still be stored on an equal or
   higher score and copied to other devices by a restore. A v11 tab opened before 018 runs sends 10 until
   its next reload (refused 'old_client', nothing lost). Board rows from econ 10 keep their wins/word (v11
   did not change wins). ORDER: deploy the client, then run 018, then `notify pgrst, 'reload schema';`.
3. **COPY** — rule: "words pay WINS; letters fill the bar: BASE 10 XP / LETTER × KEY × rebirth × mark".
   - MenuXp streak chip / aria: "wins" only. Menu hint: "N LETTERS IN A GAME TO LEVEL X" (toNext ÷ the
     game letter price). WORD RACE: WINS only (`racePayout` xp 0).
   - Tutorials: MARKS "EARN THEM AS YOU PLAY." (true with rolls on or off); MAIN "MORE WINS A WORD, MORE XP
     A LETTER."; FRENZY / BOOST "PAYS … WINS"; REBIRTH "BACK TO 1 — FOR +100% WINS & XP, FOR GOOD."; the
     one-time notice "LETTERS FILL THE BAR — BASE 10 XP / LETTER · WORDS PAY WINS".
   - Shop: rebirth hero "×N WINS & XP" = GAIN "+100% WINS & XP / LETTER — ×a → ×b"; KEY "BASE 10 XP /
     LETTER × KEY Tn ×m (+20%)"; cosmetics: no XP line. Numbers through formatNum (TIER, KEY tier, %).
   - Stats: section "XP — LETTERS FILL THE BAR": BASE XP / LETTER 10 · KEY POWER TIER n ×m XP · REBIRTH ·
     MARK +n% XP · WORDS PAY WINS · GAME XP / LETTER · MENU XP / LETTER (half).
   - Receipt: "BASE n WINS / LETTER × formatNum(letters) LETTERS" + wins headline; no XP.

## Risks
- In-game inputs credit any letters typed into the field during a live round (SAT: accepted letters only),
  at the game price, inside the shared 12/s cap.
- Server 015 level clamp (0.5 level/s, 600-level bank) can lag a very fast late re-climb; it catches up.
- KEY tier pace is borrowed from a pre-v10 run (sensitivity above).
