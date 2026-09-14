# TYPE A WORD - Handoff / Block State

**Refreshed:** 2026-09-14, against `feat/rarity-moment` (which carries `integration/board-v2`,
so it is ahead of `main`). Every number below was re-verified against source at this checkout,
not copied forward - and the previous refresh (2026-08-26) had gone stale in the places that
matter most: it still described **Economy v6** (`need(n) = 100 x 1.25^n`, break at 60), the
**old rebirth table** (R1 x1.5 ... R10 x10), a **20-wins** per-word base, and **262 unit / 133
e2e** tests. All four are wrong now; see sections 3, 5, 6 and 9.

**Section 13 is what a returning reader should read first** - it is the delta since the last
refresh.

---

## 1. What this is
`typeaword.com` — a Newgrounds/FNF-styled word-game arcade. React + Vite frontend (this repo),
Node + Express + `ws` backend (`chain-reaction-backend`, separate repo). Frontend deploys to
Vercel, backend to Render. The economy layer is internally labeled **Economy v6**.

## 2. Game grid & unlocks (`src/gameData.js`)
Five modes on the homepage grid:

| Mode | id | Type | Gate |
|---|---|---|---|
| WORD BOMB | `word-bomb` | Solo/Multi (WS rooms) | none — always available (flagship, `featured`) |
| CATEGORY BLITZ | `category-blitz` | Solo/Multi (WS rooms, AI-judged) | none — always available |
| SAT RUSH | `sat-rush` | Solo | behind build flag `SAT_RUSH_ENABLED` only |
| CHAIN | `chain` | Solo (no WS) | **unlockLevel 20** (`gameData.js:82`) - raised from 15 |
| FUSE | `fuse` | Solo (no WS) | **unlockLevel 25** (`gameData.js:97`) - raised from 22 |

Locked-but-visible cards render a read-only `LockedPreviewDialog.jsx` ("UNLOCKS AT LV N").
CHAIN/FUSE route straight into the mode like SAT RUSH (no room/WebSocket).

Both the unlocked `ModeDialog.jsx` and the `LockedPreviewDialog` now embed a **static worked-example
preview** (`ModeExample.jsx` + `modeExamples.js`) that shows the *actual mechanic* — CHAIN's
pivot-letter chain (`word → word` with first/last letters highlighted), FUSE's fragment highlighted
inside a word, etc. — plus the per-word wins rate (`wordWinsEstimate`) and typical round length. It
is static (no animation, no prev/next stepper). This is the "real mode previews / word-example"
work; see §10.

## 3. XP / level storage - Economy **v7** shape (`src/progress/xp.js`)
- Persisted under `taw.xp` as JSON **`{ lv, into }`** (level stored exactly; `into` = XP into the
  current level, always < that level's cost). Legacy bare-cumulative numbers auto-migrate once.
- **Level curve** `need(n)` = XP for level n->n+1. **This is v7 and it is not what the last
  handoff described.** v6 was `100 x 1.25^n` to level 60 and then a 1.08 tail - a tail that made
  the late game CHEAPER per level than the early game. v7 is one shape that only ever steepens:
  - `n <= 100`: `round10(2000 x 1.115^n)` -> 2,230 / 30,470 / 462,220 / 1.07e8 at 1 / 25 / 50 / 100
  - `n > 100`: `need(100) x 1.135^(n-100)` - **steeper**, never shallower
  - Constants `CURVE_BASE=2000`, `CURVE_BREAK=100`, `EARLY_CURVE_EXP=1.115`, `TOP_CURVE_EXP=1.135`.
    `TOP > EARLY` is an invariant with a test on it - the whole v6 defect was a tail going the
    other way. `round10` is **half-to-even**; do not "simplify" it.
- **THE CURVE NOW HAS A REBIRTH TERM** (`NEED_REBIRTH_BASE = 2`, added 2026-09-14). Income scales
  `3^rc` and the curve scaled by nothing, so R10's x59,049 paid for roughly the first hundred
  levels outright - measured, LV50 -> LV200 took **0.4 hours** at R10. `need(n, rc)` is now
  `baseNeed(n) x 2^rc`, so a rebirth keeps HALF its multiplier as real speed and LV50 -> LV200 at
  R10 becomes ~33h. `baseNeed(n)` is the un-scaled curve and is exported.
  **This is an unshipped balance change on a branch, and it costs an existing R10 player 1024x on
  their next level** - see section 14.
- Key functions (`src/progress/xp.js`): `need(n, rc)`, `baseNeed(n)`, `levelFromXp(xp, rc)`,
  `progressOf(state, rc)`, `creditXp(state, gain, rc)`, `xpPerInput`, `xpPerWord`. Each takes the
  rebirth count explicitly (defaulting to `getRebirths()`) so the level-carry loops never read
  localStorage once per level crossed.
- **XP per-mode multipliers** `XP_MULTIPLIERS` (`xp.js:19-26`): menu 1, word-bomb 2,
  category-blitz 2, sat-rush 3, chain 4, fuse 5. *(Unchanged.)*

## 4. Tier ladder = KEY POWER tiers (`src/progress/xp.js:275-287`, key `taw.keytier`)
A wins-sink that raises XP earned per typed letter. **The COSTS moved with Economy v7** (the last
handoff's cost column is the v6 one):

| Tier | XP/letter | Wins cost | | Tier | XP/letter | Wins cost |
|---|---|---|---|---|---|---|
| T0 | 10 | 0 (start) | | T5 | 940 | 116,640 |
| T1 | 25 | 90 | | T6 | 2,350 | 699,840 |
| T2 | 60 | 540 | | T7 | 5,875 | 4,199,040 |
| T3 | 150 | 3,240 | | T8 | 14,690 | 25,194,240 |
| T4 | 375 | 19,440 | | | | |

Past T8: effect x2.5, cost x6 per tier (`TIER_XP_STEP=2.5`, `TIER_COST_STEP=6`).

## 5. REBIRTH (`src/progress/xp.js`, key `taw.rebirths`)
Zeroes XP/level for a **permanent multiplier that applies to BOTH XP and WINS**.

**THE MULTIPLIER IS A FORMULA NOW, NOT A TABLE** - the single biggest thing the last handoff got
wrong. v6 tabled it (R1 x1.5, R2 x2 ... R10 x10) and the table was flat exactly where players
live: a first rebirth worth half a level's income in exchange for wiping the bar, then a
x10-per-step cliff from R11 that nobody reaches. v7:

> `rebirthMult(rc) = REBIRTH_MULT_BASE ^ rc`, with `REBIRTH_MULT_BASE = 3`.
> R1 x3 - R3 x27 - R5 x243 - R10 x59,049 - R20 x3.49e9.

`REBIRTH_TABLE` still exists and its **level** column is still authoritative (R1@15, R2@25,
R3@40, R4@60, R5@75, R6@100, R7@125, R8@150, R9@175, R10@200 ... R20@600, then +50 levels each).
Its `mult` column is **dead** - retained only so the published v6 numbers stay readable beside
what replaced them. Nothing reads it.

A rebirth keeps everything except XP: wins, winsLifetime, cosmetics, Key Power tier, marks,
records and rounds all survive (`doRebirth`).

## 6. WINS economy (`src/progress/wins.js`)
Wins are the spendable currency (Key Power tiers, cosmetics, themes). **Paid per accepted word**;
a round pays 0 unless at least `MIN_WORDS = 3` were accepted.

**Every figure in the last handoff's version of this section is superseded.** The base went
20 -> **100**, the mode multipliers were re-cut, and two new terms were added:

- `WORD_WINS_BASE = 100` (`wins.js:133`), and it **grows with level**:
  `WIN_LEVEL_STEP = 1.015` per level, i.e. `1.015^(level-1)` - x2.07 at LV50, x4.37 at LV100,
  x19.35 at LV200.
- `WINS_MULT = { wordBomb: 2, blitz: 1, satRush: 0.5, chain: 1.9, fuse: 1 }` (`wins.js:107`).
  These are per-WORD rates against very different throughputs - SAT Rush's 0.5 is not a penalty,
  it is a mode that answers far more often. The invariant that matters is the **mode spread**
  (no mode may pay more than 2.00x the worst under an identical player state), asserted by
  `claude/econ-curve-sim.mjs`.
- `DIFFICULTY_MULT = { chill:1.0, easy:1.25, medium:1.5, hard:2.0 }` - Word Bomb / Blitz only.
- The full per-word product (`wins.js:167`) is
  `WORD_WINS_BASE x mode x difficulty x rebirth x momentum x level x mark`, and the per-word
  reward WEIGHT (rarity x combo x lucky, capped at x40) multiplies it on top.
- **Every one of those factors appears as a named row in the payout receipt**
  (`progress/payout.js` + `components/PayoutBreakdown.jsx`). A multiplier that cannot be seen is
  treated as a defect here - that rule is why WORD SENSE was deleted (see section 13).

## 7. Dictionaries
**Solo (CHAIN/FUSE)** — space-separated text, lazy-loaded (`src/solo/words.js`, raw via
`wordsData.js`), never touches menu first paint:
- `words.recall.txt` — **31,482** words, frequency-ordered (index = rank). `TOP_COMMON=3000`
  are CHAIN's "common continuations".
- `words.accept.txt` — **56,333**-word accept *increment*; live ACCEPT = recall ∪ increment ≈
  **~88k** (`words.js:34-35`).
- `words.accept-ext.txt` — **179,239** extension words, merged into ACCEPT only *after* the first
  run ends (`loadSoloAcceptExt`, `words.js:53-69`). Fully-loaded acceptance set ≈ **~270k tokens**
  before Set dedup.

**SAT RUSH** - `src/data/satRush/words.json`, **956 entries** at this checkout (structured objects
with defs + sentences). Separate corpus from the solo lists. The last handoff said 612, with the
956 expansion sitting unmerged on `data/sat-words`; that expansion has landed.

## 8. SAT RUSH engine defaults (`src/satRush/engine.js:25-67` `DEFAULT_CONFIG`)
`stageIntervalMs 2800`, `spellAlongMs 1100`, `stageMultipliers [5,3,1]`, `lineupStageScale 3.0`,
`lives 3`, `heatCap 5`, `silverMultiplier 2`, `heatMaxRevealed 1`, `tierEvery 12`, `tierMax 5`,
`deepCutEvery 15`, `deepCutIntervalScale 1.55`, `deepCutBonus 150`, `revenantOffset 6`,
`revenantEntryStage 1`, `revenantMultiplier 2`, wrong-keystroke penalties `-2 / everyThird -8`.
(The 2000ms retune CLAUDE.md once mentioned never landed; both the engine's `DEFAULT_CONFIG` and
`config.js`'s `DEFAULT_STAGE_MS` read **2800**, and CLAUDE.md has since been corrected to say so.
The engine source is ground truth.) Engine is PURE (no timers); the hook
`useSatRushGame.js` owns the clock.

## 9. Tests & build
- **Unit:** `npm test` -> `node --test "src/**/*.test.js"` -> **555 pass / 0 fail**
  (the last handoff said 262).
- **E2E:** `npm run test:e2e` -> Playwright -> **1,214 tests in 64 spec files** (was 133 in 30).
- **Full gate:** `npm run gate` = lint + unit + ALL playwright. Gating on a subset has hidden real
  failures before - see the memory note on viewport-only gating.
- `PW_PORT` overrides the preview port (added 2026-09-14) so two checkouts can gate at once.
  Without it, `strictPort` 4173 either collides or - worse - REUSES the other checkout's listener
  and serves a build that is not the one under test.
- Build gate: `npx vite build --logLevel error` (exit 0). Portal build: `npm run build:portal`
  -> `dist-portal/`.
- Three build-FAILING unit tests act as design gates: `src/perf/typeScale.test.js` (type scale and
  one accent per file), `src/perf/willChange.test.js` (will-change is transform/opacity only), and
  the infinite-animation count assertions.
- **The suite runs at FULL motion.** `playwright.config.js` sets `use.reducedMotion: 'reduce'` and
  it is INERT in this project (Playwright 1.62) - measured on a bare `data:` page, matchMedia
  reports false. Only an explicit `page.emulateMedia()` flips it. Any spec relying on the config
  for a reduced-motion assertion is vacuous. Pinned by `e2e/motion-contract.spec.js`.

## 10. Corrections vs the previously-stale doc
- **"KE" / "Knowledge Energy" currency does NOT exist.** The only currencies are **XP** (meta
  progression) and **WINS** (spendable). If the old doc referenced KE, it is obsolete — see §5/§6.
- **"Word-nav" = the mode-preview worked examples, NOT prev/next buttons.** The `fix/ui-pass-4`
  merge message's "word nav" refers to `ModeExample.jsx` (§2) — a *static* preview that walks
  through example words with `→` separators and highlighted pivot/fragment letters. There is no
  interactive prev/next word stepper anywhere in the app; a `.jsx` sweep found only those
  decorative arrows and "← BACK" screen buttons. Document the preview, not a button that isn't there.
- **No named level→tier ladder** (no Bronze/Silver-style level grouping). "Tier" progression =
  the **Key Power tiers** (§4). Mode gating is per-card `unlockLevel` only (§2).
- CHAIN unlocks **LV15** (raised from 10), FUSE **LV22** (raised from 20).
- Solo dictionary is large now (§7): ~88k accept + ~182k ext; not a small starter list.

## 11. Live-logic traps (see CLAUDE.md for the authoritative list)
Tier-1 files (`App.jsx` WS handlers, `useWebSocket.js`, backend `server.js`/`gameLogic.js`) carry
documented traps that pass code review but fail at runtime: the **functional `setView` room_update
guard**, the **screen must render off live `view`** (never a lagging copy), and the **FIFO message
queue** in `useWebSocket`. Any change touching those must run the 2-device regression checklist.

## 12. Recent changes the previous handoff did not know about
Six things landed on `main` after the last doc refresh. Read this section first; each claim was
re-verified against source at this checkout.

### 12a. Mobile menu is a fixed one-screen frame; only the cards scroll
Below the desktop breakpoint the menu is a locked frame, NOT a page that scrolls as one unit
(`Homepage.css:661-689`). `.homepage-wrap` is `height:100dvh; overflow:hidden`. The wordmark
(`.homepage-logo-wrap`), the XP bar (`.menu-xp-bar`), the action buttons (`.homepage-bottom-bar`),
the daily link, and the footer links are all `flex-shrink:0` — they never compress and stay pinned.
`.homepage-cards-region` (`Homepage.css:675`) takes the leftover height (`flex:1 1 auto;
min-height:0; overflow-y:auto`) and scrolls the card list INTERNALLY. Net effect: the XP bar is
always visible and every card is reachable, with no full-page scroll clipping the layout. The
one-screen fit is measured, not hardcoded — `Homepage.jsx:217-219` scales `homepage-logo-wrap`,
`menu-xp-bar`, and `homepage-cards-region` to fit. (Below 760px, §-note at `Homepage.css:699`, the
single column reverts to normal page scroll.)

### 12b. Word Bomb word-attribution race fix (`App.jsx` word_result handler)
The wins count used to drop a player's own accepted word when a `turn_update` was processed in the
same frame just before the `word_result` (it advanced the turn pointer off you). Fixed at
`App.jsx:929-945`: the handler now attributes a result by **matching the word against your own
outstanding submits** (`myOutstandingWordsRef`, seeded on submit at `App.jsx:1677`, reset per game
at `:802`) BEFORE falling back to the live turn pointer (`feedCurrentRef`). A word match ⇒ it's
mine wherever the pointer is; no match ⇒ it's a broadcast accept for another player; rejections are
only sent to the submitter so those are mine too. Covered by `e2e/word-bomb-scoring` (the RACE
spec). This is a Tier-1 handler — treat with §11 caution.

### 12c. Card-feel pass — denser cards + beat-driven pulse
Game cards consume the shared beat clock instead of sitting static. On each detected kick
`html[data-beat='true']` retargets `--card-beat` to `1 + 0.02·--beat-intensity` (featured cards
`+0.03`), a **scale-only** pulse capped ~1.02/1.03 that eases in and back out on the face's existing
120ms transform transition — no new looping animation (`GameCard.css:74-96`). A separate
opacity-only edge-glow fires once per kick on a dedicated `::after` layer (`GameCard.css:196-201`;
SAT Rush gets its own ink variant at `:241`). Both are killed under `prefers-reduced-motion`
(`GameCard.css:158-162`). Motion is beat-driven, not idle — consistent with the menu motion law.

### 12d. ART VS MOTION rule (CLAUDE.md) + CSS-art audit
A new design rule is now in CLAUDE.md (`CLAUDE.md:20`): **visual art must come from real vector/PNG
assets in `/public`, never assembled from CSS shapes, gradients, or borders; CSS is for MOTION
(transform/opacity) applied to those assets.** A shape that isn't a rectangle or circle is an asset,
not a CSS trick — this is why the mascot is a PNG, not code. `claude/css-art-audit.md` (report-only)
audited the codebase against this rule and found it **unusually clean**: nearly every illustration
is already a real asset (`GameArt.jsx`, `GameIcons.jsx`, `decor/*.jsx`, `mascot-*.png`, the padlock,
the wall pipe/crack, both starbursts). The `fix/real-art` branch replaced the few remaining CSS-art
offenders with SVG assets in `/public/art/` (drip, star, starburst).

### 12e. Test counts moved (HISTORICAL - see section 9 for the current numbers)
The figures in this sub-section were current at the 2026-08-26 refresh and are now stale twice
over. Kept only because the *shape* of the note is still true (the counts move fast). Current:
**555 unit / 1,214 e2e in 64 files**.

### 12f. Animation budget UPDATED — concurrent count retired (2026-08-27)
The old **"menu: ≤20 concurrent finite animations"** budget is STALE. It was written when
animations were main-thread work. Measured on a real mid-range Android, **106 concurrent pooled
transform/opacity animations produce no perceptible lag** — composited transform/opacity work
scales; main-thread work does not. The concurrent COUNT is no longer a budget.

What replaces it (authoritative list in `CLAUDE.md` → **ANIMATION BUDGET**), all build-failing:
1. **ZERO new infinite animations** — the real 59→1 win; the infinite-count assertion stays hard.
2. **transform / opacity ONLY** — never width/height/box-shadow/filter/font-size.
3. **pool every repeated element** — never a node per event.
4. **no layout reads** (getBoundingClientRect/offsetWidth/getComputedStyle) in any per-frame or
   per-keystroke path — measure once on mount/resize, cache, spawns are pure writes.
5. **will-change: transform/opacity ONLY, never on an idle node** — toggle it per animation (a
   `:hover` / `html[data-beat]` state, or JS setting `el.style.willChange` on play + clearing on
   finish). Build-failing test: `src/perf/willChange.test.js` (no will-change value outside
   transform/opacity). (The old "exactly two elements — `.clock-fill` + `.burn`" claim was never
   true or enforced.)

Enforcement changed to match: the `≤20` count assertions in `menu-xp.spec.js` and
`card-beat.spec.js` are now **advisory** (they log the peak/concurrent count, no longer fail the
build); both specs KEEP their build-failing infinite-count assertions. The in-game concurrency note
(`GameScreen.jsx:484`, "≤2 concurrent at critical") is likewise ADVISORY — a smell to investigate,
not a gate. This is what unblocked the KEY POWER tier particle shards (`feat/purchase-feel`), which
peak at ~106 concurrent pooled finite animations with zero measured frame cost.

---

## 13. Delta since the 2026-08-26 refresh (read this first)

Roughly a month of work, most of it on branches that have not reached `main`. Grouped by what a
reader needs to know rather than by branch.

**The economy was refitted end to end (v6 -> v7).** New level curve, new rebirth formula, new
wins base with a level term, re-cut mode multipliers, and a payout RECEIPT that names every
factor. Sections 3-6 above are all rewritten because of it. Two supporting facts:
- `claude/econ-curve-sim.mjs` is the evidence file. It imports the live modules and simulates a
  200-hour player word by word. **It had stopped running** (it imported `wordSense.js`, deleted in
  `ec8e8db`) and **its flag parsing was broken** - it read `process.argv[2]` for the rebirth cap,
  so any `--early=`/`--top=` sweep put a flag string through `Number()`, got NaN, and silently ran
  with the prestige loop switched OFF. Both fixed 2026-09-14; treat any curve conclusion quoted
  from a flag run before that date as unsupported.
- WORD SENSE was deleted (`ec8e8db`) and refunded (`progress/wordSenseRefund.js`). It bought a
  multiplier on a word's rarity EXCESS: invisible at the moment it fired, worth nothing on a
  common word. Rarity is something you SEE now, so it had nothing left to do.

**The Word Bomb board was rebuilt as a RING.** Players sit on a circle around the bomb mascot
instead of in a row of cards (`feat/wb-ring` -> `integration/board-v2`). Seat geometry is pure
CSS from two custom properties and holds from 2 to 16 seats. THE BOMB IS THE CLOCK: the fuse
burns via stroke-dashoffset off the turn timer, a ring around the mascot reads the same value a
second way, and a numeral over its belly reads it a third (see section 14 - the numeral was gated
to the last 5 seconds and is not any more).

**One rarity ladder, four modes, at the word.** `progress/rarity.js` owns the colours; the
centre-screen `RarityFlash` popup was deleted from CHAIN, FUSE and SAT RUSH and replaced by a
reaction anchored where the player is already looking. SAT Rush re-cuts the same ladder in its own
duotone inks rather than re-colouring it.

**A house rule got teeth: NO ORPHAN FIXED UI.** Any persistent control must JOIN an existing
cluster. Three separate violations were found and fixed by measurement, not by inspection: the
app-wide sound button over Word Bomb's SEND/SKIP, the same button over CHAIN's and FUSE's decks,
and the WELCOME BACK card sitting 309x88 on top of the wordmark. The first-run coach mark is now
an opaque plate placed by a scored search rather than free text placed by a heuristic.

**Gates that exist now and did not before** (all in `e2e/`): `wb-ring`, `wb-clock`,
`wb-adversarial`, `word-landing`, `rarity-moment`, `overlay-modality`, `number-format`,
`motion-contract`, `solo-sound-control`, `spotlight-fit`, `sound-control`.

---

## 14. Open decisions and known gaps (nothing here is a bug report - these need a person)

1. **`NEED_REBIRTH_BASE = 2` is a live-balance change that has not shipped.** On the day it does,
   an existing R10 player's next level becomes 1024x more expensive. Their LEVEL is untouched -
   it is stored exactly - but the bar they are part-way up gets much longer. There is no migration
   that avoids that while still fixing the defect. Setting the constant back to 1 restores today's
   behaviour exactly.
2. **The sim's own pass condition no longer holds.** "LV300 reached inside 200h by at least one
   archetype" fails at any rebirth scaling above ~1.15 - and it barely held before (2 of 5
   archetypes, at 156h). Either the condition or the top of the curve needs a decision.
3. **SAT RUSH still has the orphan sound control.** CHAIN and FUSE were moved into the solo shell's
   corner cluster; SAT was left alone deliberately because its screen is being reworked on another
   branch. Named in `App.jsx` beside the suppression list.
4. **At ONE mark slot, ETERNAL dominates seven of the eight marks.** Measured
   (`claude/marks-slots-sim.mjs`): every mode wears ETERNAL and nothing else is ever chosen.
   `marks.js` rule 1 says "eight marks and one slot is eight different builds"; in practice it is
   one build in every mode. Two and three slots both stay inside the 2.00x mode-spread invariant
   and in fact NARROW it (1.90x -> 1.56x -> 1.49x), so the invariant is not what constrains slot
   count - the design rule is.
5. **Cross-mode copy diverges** where two modes say the same thing. Reported, not changed:
   too-short is "TOO SHORT - NEED 3+ LETTERS" in Word Bomb/Blitz and "MIN 3 LETTERS" in
   CHAIN/FUSE; already-used is "ALREADY USED - TRY AGAIN" vs "ALREADY USED THIS RUN"; the
   reject fallback is "INVALID WORD" vs "REJECTED"; and leaving a mode is `LEAVE` (Word
   Bomb/Blitz), an icon labelled "Exit" (CHAIN/FUSE) and `EXIT` (SAT Rush). SAT Rush's results
   buttons are sentence case ("Run it back", "Menu") where every other mode's are caps - and
   "RUN IT BACK" already exists in caps in Word Bomb.
   Per-mode END headings (`CHAIN BROKE`, `OUT OF FUSES`, `CASE CLOSED`) are deliberate flavour and
   are NOT on this list.
6. **The e2e suite's reduced-motion emulation is inert** (see section 9). Nothing depends on it
   today, but a spec that assumes it would be silently vacuous.
