# Dead-code sweep #2 (deeper than imports-only) — JOB 18

Branch `chore/dead-code-2`. Method: import-graph from `src/main.jsx`, per-symbol export
usage grep across `src` + `scripts` + tests, CSS-class-to-JSX matching (dynamic classNames
treated as USED), `useState` read/write scan. Verified with `npx vite build` (exit 0) and
`npm test` (401/401 pass).

Rule followed: **delete only HIGH-confidence, provably-unused items**; a false delete that
breaks the build or removes parked work is worse than leaving dead code. Everything MEDIUM/LOW
is listed for owner review, not touched.

## Summary of candidates
- **HIGH (deleted): 17** — 3 unused JS re-exports + 14 dead CSS shell classes.
- **MEDIUM (left for owner): ~15** — unused exports that carry an intent comment or are test
  scaffolding, plus ~70 unverified CSS candidates that need per-class dynamic-construction checks.
- **LOW (left for owner): ~75** — symbols that are exported but only used inside their own
  module (`export` keyword is redundant; the code still runs — this is not dead code).

---

## 1. Unused exports (grep-verified: zero importers anywhere in src/scripts/tests)

### HIGH — DELETED
| Symbol | File | Evidence |
|---|---|---|
| `resultSfx` | `src/satRush/juice.js:133` | aliased re-export (`sfx as resultSfx`); the only occurrence in the entire codebase is the export declaration. No `juice.resultSfx` / dynamic `juice[...]` access exists. Left `export { scoreTick }` intact (scoreTick IS used by SatRushResults.jsx). |
| `resultBurst` | `src/satRush/juice.js:133` | same — `burst as resultBurst`, zero references. |
| `resultFlash` | `src/satRush/juice.js:133` | same — `screenFlash as resultFlash`, zero references. |

### MEDIUM — left for owner (zero importers, but intent comment or test-scaffolding)
| Symbol | File | Why not deleted |
|---|---|---|
| `voiceStats` | `src/audio/audioCore.js:119` | diagnostic export referenced by `claude/sound-report.md` as a measurement hook; plausibly a manual/test probe. |
| `__resetAudioForTest` | `src/audio/audioCore.js:175` | test-reset scaffolding; no test currently imports it — deleting a `__forTest` affordance is presumptuous. |
| `sndStreakExtended` | `src/audio/gameSounds.js:110` | `sound-report.md` says "defined but left unwired **pending a decision** on daily-streak vs combo-milestone" — parked feature. |
| `sndAchievement` | `src/audio/gameSounds.js:117` | same report notes it is defined for achievement/level-up SFX but not yet wired — parked feature. |
| `isEarned` | `src/progress/achievements.js:107` | one-line public predicate `loadEarned().includes(id)`; orphaned but a natural companion API. |
| `__resetCollectionForTest` | `src/progress/collection.js:170` | test-reset scaffolding, unused. |
| `allMasteryStates` | `src/progress/mastery.js:84` | comment: "Every mode's state, **for the menu/stats**" — intended UI consumer not wired yet. |
| `masteryPerkLabel` | `src/progress/mastery.js:110` | comment: "The perk description ... **for the dialog copy**" — intended consumer not wired. |
| `isRarityIndexLoaded` | `src/progress/rarityIndex.js:34` | load-guard predicate, pairs with the test-set hook; unused. |
| `__setRarityIndexForTest` | `src/progress/rarityIndex.js:45` | test scaffolding, unused. |
| `WPM_MODE_LABELS` | `src/progress/wpm.js:17` | comment: "Human-readable labels **drive the Stats readout**" — intended consumer; StatsScreen currently doesn't import it. |
| `isSoloAcceptExtLoaded` | `src/solo/words.js:72` | load-guard predicate, unused. |
| `__setSoloWordsForTest` | `src/solo/words.js:79` | test scaffolding, unused. |

### LOW — left for owner (exported but used INTERNALLY in the same file)
~75 symbols across `src/progress/*`, `src/solo/*`, `src/satRush/*`, `src/theme/themes.js`,
`src/playerColors.js`, `src/moderation/blockedTerms.js`, etc. are exported yet imported by no
other module, but ARE referenced within their own file (constants, helpers). Examples:
`WINS_KEY`, `WINS_MULT`, `WORD_WINS_BASE`, `ROUND_MODES` (`wins.js`); `REBIRTH_TABLE`,
`CURVE_BREAK` (`xp.js`); `itemById`, `xpMultOf` (`shop.js`); `CHAIN_MULT_BASE`, `pickOpener`
(`solo/chain.js`); `THEME_KEY`, `THEMES_OWNED_KEY` (`themes.js`). Removing the `export` keyword
is cosmetic (the code runs) and risky (a test may import via a path this scan didn't model), so
NOT touched. Full list reproducible via `scratchpad/exports.mjs`.

---

## 2. Files with zero importers from `src/main.jsx`
Import graph (568 modules built by vite; 193 files reachable). Only ONE non-test file is
unreachable from the app entry:
- `src/moderation/blockedTerms.js` — **NOT dead**: imported by build scripts
  `scripts/build-words.mjs` and `scripts/build-accept-ext.mjs` (content-safety filtering) and by
  `src/moderation/generationAssets.test.js`, and has an open backlog task (name moderation).
  KEEP. No file deletions.

---

## 3. CSS classes matched by nothing (1172 distinct classes; 91 with no literal JSX match)

### HIGH — DELETED (provably dead: documented component refactor + zero DOM references + flat rules with no active descendant selectors)
Both `AchievementsScreen.jsx` and `CollectionScreen.jsx` were refactored from standalone
overlays into body-only tab content rendered inside the shared Stats panel (each file's own
header comment states this and the old overlay `view` was removed). Their overlay-shell classes
are now rendered by nothing in the codebase:

- `AchievementsScreen.css`: `.ach-overlay` (+`:focus`), `.ach-panel`, `.ach-header`, `.ach-title`,
  `.ach-close` (+`:active`), `.ach-body` (+3 `::-webkit-scrollbar*`), `.ach-back` (+`:active`) — 7 classes.
- `CollectionScreen.css`: `.coll-overlay` (+`:focus`), `.coll-panel`, `.coll-header`, `.coll-title`,
  `.coll-close` (+`:active`), `.coll-body` (+3 `::-webkit-scrollbar*`), `.coll-back` (+`:active`) — 7 classes.

Verified: the only dynamic class construction in those files is `ach-card${...}` and
`coll-ms-row${...}` — none of the deleted shells is built dynamically, and none is a parent in a
descendant selector of a still-used class. The live content classes (`.ach-progress`,
`.ach-grid`, `.ach-card*`, `.coll-total*`, `.coll-milestone*`, `.coll-tier*`, `.coll-find*`,
`.coll-ms-row*`, etc.) were kept.

### FALSE POSITIVES — treated as USED, NOT dead (dynamic classNames)
- `emote-*` (Mascot) — `` `emote-${emote}` ``
- `wb-pending-{accept,reject,flight,waiting}` (GameScreen) — `` `wb-pending-${pending.phase}` ``
- `shake-{light,medium,heavy}` (App) — `` `shake-${shake}` ``
- `is-earned`/`is-secret`/`is-done`/`is-equipped`/`is-locked` — conditional template appends
- `homepage-splatter-1..4`, `intro-flash--*`, `iw-*`, `wb-spark-*`, `splash-*` — likely
  decorative/dynamic; NOT verified individually.

### MEDIUM — left for owner (the remaining ~70 flagged classes)
The analyzer flags any class with no literal JSX substring. Beyond the 14 confirmed-dead shells
and the dynamic false positives above, ~70 classes remain (e.g. `.celeb-pre-reveal`,
`.celeb-stage-3`, `.clutch-*`, `.pass-left/right`, `.submit-accept/reject`, `.explosion-flash`,
`.bomb-spark`, `.mode-dialog-pay*`, `.lp-pay*`, `.shop-confirm*`, `.wall-tag-panel`). Each needs
a per-class check for dynamic construction / JS-driven `classList.add` before it can be judged
dead — not safe to bulk-delete without a preview to verify visually. Full list in the console
output of `scratchpad/css.mjs`.

---

## 4. Unused component props
Not individually deleted. Prop-level dead code has a high false-positive rate (props consumed
directly in JSX, spread via `...rest`, or passed through), and removing a prop from a signature
without also updating call sites risks a behavior change with no build error. No HIGH-confidence,
zero-risk prop deletion was found; deferred to owner review.

## 5. State declared but never read / handlers never bound
Scanned every `.jsx` for `const [x, setX] = useState(...)` where `x` is never read or `setX` is
never called (`scratchpad/state.mjs`). **Zero** unused `useState` found — every value and setter
is referenced. No unbound-handler HIGH-confidence finding surfaced.

---

## What was deleted
- `src/satRush/juice.js` — 3 unused aliased re-exports (kept `scoreTick`).
- `src/components/AchievementsScreen.css` — 7 dead overlay-shell classes.
- `src/components/CollectionScreen.css` — 7 dead overlay-shell classes.

## Verification
- `npx vite build` → exit 0 (568 modules).
- `npm test` → 401 pass / 0 fail.
- Bundle (sum of per-file dist kB, uncompressed): before **4002.10 kB** (JS 3753.53 + CSS 248.57)
  → after **3998.93 kB** (JS 3753.53 + CSS 245.40). CSS −3.17 kB; JS unchanged (the removed
  re-exports pointed at functions still bundled/used elsewhere).
