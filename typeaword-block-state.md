# TYPE A WORD — Handoff / Block State

**Refreshed:** 2026-08-26 (branch `docs/block-state-2` off `main`). Every number below was
re-verified against source at this checkout, not copied forward. **§12 (Recent changes) is the
part a returning reader should read first** — it covers the mobile scroll fix, the word-attribution
race fix, the card-feel pass, the ART VS MOTION rule, the CSS-art audit, and the current test
counts, none of which the previous handoff knew about. File references are `path:line`.

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
| CHAIN | `chain` | Solo (no WS) | **unlockLevel 15** (`gameData.js:79`) |
| FUSE | `fuse` | Solo (no WS) | **unlockLevel 22** (`gameData.js:94`) |

Locked-but-visible cards render a read-only `LockedPreviewDialog.jsx` ("UNLOCKS AT LV N").
CHAIN/FUSE route straight into the mode like SAT RUSH (no room/WebSocket).

Both the unlocked `ModeDialog.jsx` and the `LockedPreviewDialog` now embed a **static worked-example
preview** (`ModeExample.jsx` + `modeExamples.js`) that shows the *actual mechanic* — CHAIN's
pivot-letter chain (`word → word` with first/last letters highlighted), FUSE's fragment highlighted
inside a word, etc. — plus the per-word wins rate (`wordWinsEstimate`) and typical round length. It
is static (no animation, no prev/next stepper). This is the "real mode previews / word-example"
work; see §10.

## 3. XP / level storage — Economy v5/v6 shape (`src/progress/xp.js`)
- Persisted under `taw.xp` as JSON **`{ lv, into }`** (level stored exactly; `into` = XP into the
  current level, always < that level's cost). In-memory model is `{ level, intoLevel,
  lifetimeLetters }`. `XP_KEY='taw.xp'` (`xp.js:322`); write `xp.js:375-381`; read/migrate
  `xp.js:342-373` (legacy bare-cumulative numbers auto-migrate once).
- **Level curve** `need(n)` = XP for level n→n+1 (`xp.js:44-51`):
  - `n ≤ 60`: `round10(100 · 1.25^n)` → 120 / 160 / 200 / 240 / 310 / 380 / 480 …
  - `n > 60`: `need(60) · 1.08^(n-60)`, round10. Constants `CURVE_BREAK=60`,
    `EARLY_CURVE_EXP=1.25`, `TOP_CURVE_EXP=1.08`. `round10` is **half-to-even** (`xp.js:27-36`,
    matches the published v6 table — don't "simplify" it).
- Key functions (all `src/progress/xp.js`): `levelFromXp` (`:56-73`, migration only),
  `progressOf(state)` (`:402-407`, derives display fields from `{level,intoLevel}`),
  `creditXp(state, xpGain, rawKeys)` (`:264-278`, applies award + carries whole levels),
  `xpPerInput` (`:248-257`).
- **XP per-mode multipliers** `XP_MULTIPLIERS` (`xp.js:12-19`): menu 1, word-bomb 2,
  category-blitz 2, sat-rush 3, chain 4, fuse 5.

## 4. Tier ladder = KEY POWER tiers (`src/progress/xp.js:165-237`, key `taw.keytier`)
A wins-sink that raises XP earned per typed letter. `KEY_TIERS` = `{ xp/letter, wins cost }`:

| Tier | XP/letter | Wins cost | | Tier | XP/letter | Wins cost |
|---|---|---|---|---|---|---|
| T0 | 10 | 0 (start) | | T5 | 940 | 648,000 |
| T1 | 25 | 500 | | T6 | 2,350 | 3,888,000 |
| T2 | 60 | 3,000 | | T7 | 5,875 | 23,328,000 |
| T3 | 150 | 18,000 | | T8 | 14,690 | 139,968,000 |
| T4 | 375 | 108,000 | | | | |

Past T8: effect ×2.5, cost ×6 per tier (`TIER_XP_STEP=2.5`, `TIER_COST_STEP=6`, `xp.js:194-195`).

## 5. REBIRTH (`src/progress/xp.js:75-163`, key `taw.rebirths`)
Zeroes XP/level for a **permanent multiplier that applies to BOTH XP and WINS** (`xp.js:256`,
`wins.js:98`). `REBIRTH_TABLE` (`xp.js:84-105`), index 0 = R1, each `{ level required, mult }`:

| R | Lvl | Mult | | R | Lvl | Mult |
|---|---|---|---|---|---|---|
| R1 | 15 | ×1.5 | | R11 | 225 | ×100 |
| R2 | 25 | ×2 | | R12 | 260 | ×1,000 |
| R3 | 40 | ×2.5 | | R13 | 300 | ×10,000 |
| R4 | 60 | ×3 | | R14 | 340 | ×100,000 |
| R5 | 75 | ×3.5 | | R15 | 380 | ×1e6 |
| R6 | 100 | ×4 | | R16 | 420 | ×1e7 |
| R7 | 125 | ×5 | | R17 | 465 | ×1e8 |
| R8 | 150 | ×6 | | R18 | 510 | ×1e9 |
| R9 | 175 | ×8 | | R19 | 560 | ×1e10 |
| R10 | 200 | ×10 | | R20 | 600 | ×1e11 |

Past R20: +50 levels & ×10 mult per rebirth (`REBIRTH_PAST_LEVEL_STEP=50`,
`REBIRTH_PAST_MULT_STEP=10`). A rebirth keeps everything except XP: wins, winsLifetime, cosmetics,
Key Power tier, lifetimeLetters, taps, rounds all survive (`doRebirth`, `xp.js:156-163`).

## 6. WINS economy (`src/progress/wins.js`)
Wins are the spendable currency (Key Power tiers, cosmetics). **Paid per accepted word**; a round
pays 0 unless ≥ `MIN_WORDS=3` accepted (`wins.js:15`).
- `perWordWins = round10(WORD_WINS_BASE(20) × modeMult × difficultyMult × rebirthMult)`
  (`wins.js:93-99`).
- `WINS_MULT = { satRush:5, chain:10, fuse:15 }`; Word Bomb / Blitz = ×1 (`wins.js:75`).
- `DIFFICULTY_MULT = { chill:1.0, easy:1.25, medium:1.5, hard:2.0 }` — Word Bomb / Blitz only
  (`wins.js:82`); solo modes & SAT Rush pass no difficulty → ×1.
- **R0 per-word rates:** word-bomb/blitz **20**, SAT **100**, **CHAIN 200/link**, **FUSE 300/word**.
- `awardWins({wordsAccepted, mode, difficulty})` = `wordsAccepted × perWordWins` (`wins.js:104-108`).
- Where each mode records: WORD BOMB `App.jsx:1082` (per game), BLITZ `App.jsx:1052` (per round),
  SAT `SatRushGame.jsx:50`, **CHAIN `ChainGame.jsx:106`** (`state.k` links), **FUSE
  `FuseGame.jsx:97`** (`state.wordsSolved`). Solo modes fire once/run (guarded by `winRecordedRef`)
  and show a live tally each render.

## 7. Dictionaries
**Solo (CHAIN/FUSE)** — space-separated text, lazy-loaded (`src/solo/words.js`, raw via
`wordsData.js`), never touches menu first paint:
- `words.recall.txt` — **31,500** words, frequency-ordered (index = rank). `TOP_COMMON=3000`
  are CHAIN's "common continuations".
- `words.accept.txt` — **56,349**-word accept *increment*; live ACCEPT = recall ∪ increment ≈
  **~88k** (`words.js:34-35`).
- `words.accept-ext.txt` — **181,897** extension words, merged into ACCEPT only *after* the first
  run ends (`loadSoloAcceptExt`, `words.js:53-69`). Fully-loaded acceptance set ≈ **~270k tokens**
  before Set dedup.

**SAT RUSH** — `src/data/satRush/words.json`, **612 entries** on `main` (structured objects w/
defs + sentences). Separate corpus from the solo lists. (An unmerged branch `data/sat-words`
expands this to **956** — schema-validated, dedup'd — but it is NOT on `main`; treat 612 as the
shipped number until that branch lands.)

## 8. SAT RUSH engine defaults (`src/satRush/engine.js:25-67` `DEFAULT_CONFIG`)
`stageIntervalMs 2800`, `spellAlongMs 1100`, `stageMultipliers [5,3,1]`, `lineupStageScale 3.0`,
`lives 3`, `heatCap 5`, `silverMultiplier 2`, `heatMaxRevealed 1`, `tierEvery 12`, `tierMax 5`,
`deepCutEvery 15`, `deepCutIntervalScale 1.55`, `deepCutBonus 150`, `revenantOffset 6`,
`revenantEntryStage 1`, `revenantMultiplier 2`, wrong-keystroke penalties `-2 / everyThird -8`.
(NOTE: CLAUDE.md documents retuned defaults `stageIntervalMs 2000 / spellAlongMs 1100 / tierEvery 12
/ deepCutEvery 15`; the shipped `DEFAULT_CONFIG` currently reads `stageIntervalMs 2800` — treat the
engine source as ground truth if they diverge.) Engine is PURE (no timers); the hook
`useSatRushGame.js` owns the clock.

## 9. Tests & build
- **Unit:** `npm test` → `node --test "src/**/*.test.js"` → **262 pass / 0 fail**.
- **E2E:** `npm run test:e2e` → Playwright → **133 tests in 30 spec files**.
- Build gate: `npx vite build --logLevel error` (exit 0). Portal build: `npm run build:portal`
  → `dist-portal/`.

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

### 12e. Test counts moved
Unit **262** (was ~fewer), e2e **133 tests in 30 files** (was 99 in 23) — see §9. Two previously
flaky e2e specs were stabilised with locator/`expect.poll` auto-retry waits instead of fixed sleeps
(`feed-attribution.spec.js`, `word-bomb-scoring.spec.js`).

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
5. **will-change on exactly two elements site-wide** (`.clock-fill` + `.burn`).

Enforcement changed to match: the `≤20` count assertions in `menu-xp.spec.js` and
`card-beat.spec.js` are now **advisory** (they log the peak/concurrent count, no longer fail the
build); both specs KEEP their build-failing infinite-count assertions. The in-game concurrency note
(`GameScreen.jsx:484`, "≤2 concurrent at critical") is likewise ADVISORY — a smell to investigate,
not a gate. This is what unblocked the KEY POWER tier particle shards (`feat/purchase-feel`), which
peak at ~106 concurrent pooled finite animations with zero measured frame cost.
