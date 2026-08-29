# PERFORMANCE PLAYBOOK — single source of truth

Written 2026-08-29. Supersedes every scattered perf note, audit `.md`, and commit-body
claim. **Rule for this file: no number goes in unless it was re-verified against current
source, with a `file:line` cite. Anything not re-verifiable is marked
`unverified — needs measurement`, not repeated.**

Verified against `origin/main` @ `b2b70fb` (2026-08-29). CLAUDE.md's `## ANIMATION BUDGET`
section is the canonical prose; this file is the evidence behind it and the correction log
for the wrong numbers that keep circulating.

---

## 1. THE REAL BUDGETS — what is actually enforced, and what each protects

There are exactly **three** build-failing perf guards. Everything else is advisory.

### 1a. ZERO NEW infinite animations — enforced as a DELTA, never an absolute count
**What it protects:** an infinite (`iterations: Infinity`) animation runs forever at rest,
burning a composited layer (or worse, main-thread paint) with nothing on screen changing.
The menu was cut from a large idle-loop count down to a near-silent rest state (see §2), and
the guard exists so new work doesn't quietly re-add loops.

**How it's actually enforced — two e2e specs, both measuring a DELTA, not a fixed number:**
- `e2e/purchase-feel-perf.spec.js:78` — types on the menu (`/?portal=1`,
  `purchase-feel-perf.spec.js:16`) at each of 6 KEY-POWER tiers, samples
  `document.getAnimations()` filtering `iterations === Infinity`
  (`purchase-feel-perf.spec.js:32-36`), and asserts the per-tier infinite count is
  **identical across all tiers** (`new Set(infs).size === 1`). It does **not** assert the
  count equals 1 — only that the tier effects add zero infinite loops.
- `e2e/card-beat.spec.js:52` — asserts `infiniteBeat === infiniteRest`: firing a beat adds
  no infinite animation over the resting baseline.

**Key correction:** NO test pins an absolute infinite-animation count. The invariant is
always "unchanged vs a reference state" (tier-to-tier, or beat-vs-rest). Any claim of the
form "the menu has exactly N infinite animations, and a test enforces it" is false — the
number is neither pinned nor asserted anywhere. `menu-xp.spec.js:123` contains a *comment*
saying "the build-failing invariant is 0 new infinite loops," but that spec has **no**
`expect` on the infinite count (it only measures finite concurrency, advisory — see §1f).

### 1b. transform / opacity ONLY
**What it protects:** transform and opacity are the only two properties the compositor
animates off the main thread. Animating width/height/box-shadow/filter/font-size hits
layout or paint every frame. Not directly asserted by a test at the animation level; enforced
by convention + code review + the will-change guard below (which catches the common symptom —
promoting a layer to animate a non-compositor property).

### 1c. Pool every repeated element
Per-keystroke / per-event effects (pops, particle shards, edge pulses) reuse a fixed pool of
nodes + WAAPI animations rather than creating a node per event. Convention, not test-gated.

### 1d. No layout reads in hot paths
No `getBoundingClientRect` / `offsetWidth` / `getComputedStyle` inside a rAF loop, keydown
handler, or pop/particle spawn — measure once on mount/resize and cache; spawns are pure
writes. Convention, not test-gated.

### 1e. will-change ⊆ {transform, opacity} — build-failing (unit test)
**What it protects:** a `will-change` naming a non-compositor property (box-shadow,
text-shadow, border-color, filter, a custom property, any layout prop) promotes a layer for
nothing — a pure compositor no-op that costs memory and can *degrade* performance.

**How it's enforced:** `src/perf/willChange.test.js` (a `node --test` unit test, so it runs in
`npm test` and fails the build). It scans **every `.css` under `src/`**, strips comments first
(`willChange.test.js:35`), regex-extracts every `will-change` value, splits on commas, and
fails if any token is outside the allow-set `{transform, opacity, auto, inherit, initial,
unset, revert}` (`willChange.test.js:17`, assert `willChange.test.js:49`). Re-run 2026-08-29:
**passes** (1 test, 0 fail).
- Current state: **30 live `will-change` declarations** across `src/**/*.css`, every one
  `transform` and/or `opacity`. (Verified by grep 2026-08-29.) The test pins the PROPERTY, not
  a count or a set of elements.
- CLAUDE.md's companion rule (will-change must also never sit on an idle/pooled/always-present
  node — toggle ON for the animation's life, OFF at rest) is **not** machine-checked; it's a
  review convention. The test only checks the value, not whether the node is idle.

### 1f. Concurrent animation count — ADVISORY ONLY (no longer a budget)
Composited transform/opacity work scales; the old main-thread-era "≤20 concurrent" ceiling is
retired (see §2). The two specs that used to gate on it now only **log** it:
- `menu-xp.spec.js:126` — `console.log('[advisory] menu peak concurrent finite animations: …')`
- `card-beat.spec.js:58` — same treatment (comment: "Log the count," build-failing invariant is
  the infinite count above).
Treat a high concurrent count as a *smell to investigate*, never a build gate.

---

## 2. KNOWN-WRONG CLAIMS — corrected, each verified against current source

Six wrong or misleading claims have been circulating. Corrections below.

### WRONG #1 — "the menu has exactly 1 infinite animation" / "went 59 → 1"
CLAUDE.md's ANIMATION BUDGET says *"the menu went 59 → 1 looping animation,"* and commit
`4565c18` claimed *"exactly 1 infinite animation runs (the caret)."*

**Correction (verified in current source):** the resting menu keeps **more than one** unpaused
infinite loop. Card art is paused at rest via `animation-play-state: var(--art-play, paused)`
(`GameCardArt.css:258`) and only runs on hover/focus/press — BUT two selectors are
deliberately **exempted** from that gate (`GameCardArt.css:251-253`):
- `.cb-brain` (Category Blitz card art) runs **two** infinite loops — `cb-throb` +
  `cb-illuminate` (`GameCardArt.css:81-82`) — and is absent from the pause list
  (`GameCardArt.css:254-257`).
- `.sr-caret` (SAT Rush card art) runs `sr-caret-blink`, infinite (`GameCardArt.css:175`), also
  unpaused.

Both cards mount unconditionally on the menu (`Homepage.jsx:688-699` maps every game; the art
renders regardless of lock state, `GameCard.jsx:333-337`, markup in `GameArt.jsx:84` `.cb-brain`
and `:183` `.sr-caret`). So the resting-menu infinite count is **at least 3** (cb-throb,
cb-illuminate, sr-caret-blink), plus `.connecting-spinner`'s `connecting-spin`
(`Homepage.css:901`) *while a connection is pending only*.

The exact live integer is a `getAnimations()` runtime metric and needs a browser run —
**unverified — needs measurement** (Playwright is not installed in this worktree; see §3). What
IS verified: it is **>1**, the "exactly 1" claim is stale, and — critically — no test enforces
any absolute value (§1a), so the wrong number was never load-bearing.

### WRONG #2 — the "45 / 46 / 96" confusion (three numbers, three different things)
These three numbers circulated as if interchangeable. They are not:
- **96** — the count of static `infinite`-keyword **declarations in CSS source**, all files
  (a grep count). An old audit reported "96 infinite animations (doc claims 1)" — conflating a
  source-declaration grep with a runtime menu count. Re-counted 2026-08-29: ~**90** `animation …
  infinite` declarations across 14 `.css` files, the heaviest being **`GameScreen.css` (37 —
  in-game, never on the menu)**, `SplashScreen.css` (8), `GameCardArt.css` (~22, mostly
  play-state-paused at rest), `RoomScreen.css` (5), `LoadingScreen.css` (4). This is a
  whole-app source metric and says nothing about what runs on the menu at rest.
- **46** — a *runtime* `getAnimations()` infinite count measured on `main` during earlier
  card-feel work ("MEASURED baseline infinite-animation count on main = 46").
- **45** — a *wrong* asserted baseline ("count must stay at 45"); the measured value was 46, so
  "45" was an off-by-one that some doc/assertion carried.

**Correction:** never compare these to each other. Source-declaration count (≈90), resting-menu
runtime count (>1, exact value unverified), and a broader-render runtime count (historically 46)
are three distinct measurements. The current runtime figures are **unverified — need
measurement** and must not be quoted as fixed.

### WRONG #3 — "≤20 concurrent finite animations" budget
Retired (commit `a6e69cb`, CLAUDE.md ANIMATION BUDGET §"CONCURRENT COUNT IS NO LONGER A
BUDGET"). It was written when animations were main-thread work. Measured on a real mid-range
Android, **106 concurrent pooled transform/opacity animations produced no perceptible lag** —
composited work scales. The `≤20` assertions in `menu-xp.spec.js` and `card-beat.spec.js` were
downgraded from failing to logging (§1f). Do not gate on concurrency; gate on the rules in §1.

### WRONG #4 — "will-change on exactly 2 elements site-wide (`.clock-fill` + `.burn`)"
Stated in commit `a6e69cb`'s body and older notes. **Never true and never enforced.** Current
source has **30** `will-change` declarations (§1e), and the actual test
(`willChange.test.js`) checks the *value* (transform/opacity only), not a count or an element
list. CLAUDE.md already retracts this; recorded here so it doesn't come back.

### WRONG #5 — "menu-xp.spec.js keeps a build-failing infinite-count assertion"
Commit `a6e69cb` said "both specs keep their build-failing infinite-count assertions."
**Half wrong:** `card-beat.spec.js` does (`:52`); `menu-xp.spec.js` does **not** — it only has
a *comment* to that effect (`menu-xp.spec.js:123`) and measures finite concurrency (advisory).
The infinite-count guards live in `card-beat.spec.js:52` and `purchase-feel-perf.spec.js:78`.

### WRONG #6 — audit claim "only 4 play-state-gated; 24 always-on menu loops"
From the perf-audit that reported the 96 figure. **Stale vs current source:** the `--art-play`
pause gate covers ~13 card-art selector groups (`GameCardArt.css:254-258`), pausing the great
majority of card-art loops at rest; only `.cb-brain` (×2) and `.sr-caret` (×1) stay live
(§WRONG #1). "24 always-on menu loops" does not match the code as it stands today.

---

## 3. MEASUREMENT METHODOLOGY that actually works in this sandbox

The sandbox is a shared, loaded machine. Timing numbers are only trustworthy under strict
discipline; some metrics (counts) are reliable, most timing is not.

**Reliable here (deterministic, load-independent):**
- Infinite-animation counts and concurrent counts via `document.getAnimations()` — integers,
  not timing. If you can run the browser, these are trustworthy on the first run.
- Static source counts (grep for `infinite`, `will-change`, `@keyframes`).
- The unit test `willChange.test.js` — pure file scan, runs in `npm test`.

**Unreliable here (timing) — protect against machine load:**
- **Median of 3 runs, back-to-back, same load, nothing else running.** A single run is noise.
- **Headless rAF frame time is bimodal (~16.7 / 33.3 ms) and does NOT correlate with tier** —
  documented in the spec itself (`purchase-feel-perf.spec.js:80-82`): "headless rAF is bimodal
  … and does NOT correlate with tier … a real jank regression would blow well past the rAF
  cadence." So the per-tier frame medians are a *report line*, not a pass/fail signal; the spec
  only guards against a runaway (`< 50ms`, `:83`). Do not read tier-to-tier frame-time
  differences as real.
- **Machine load produces false readings.** A "33 ms before" has been pure CPU starvation, not
  a real regression — the classic trap is measuring a "before" while something else pins the
  cores, then crediting a "fix" for the recovery. If a baseline looks 2× worse than expected,
  suspect load first and re-measure idle.
- **Read `test-results/.last-run.json`, never a piped `tail` of console output.** The JSON is
  the authoritative pass/fail record; a scrolled/piped terminal tail drops lines and misleads.
  (Note: `.last-run.json` is generated by a Playwright run and is absent until `npm run
  test:e2e` / `npm run gate` has run in this tree.)

**To measure the resting-menu infinite count (the number §2 leaves open):**
run `npx playwright test purchase-feel-perf` and read the `PERF | T0 | … | infinite N` log line
(`purchase-feel-perf.spec.js:73`) — N is the per-tier infinite count. Playwright is **not
installed in this worktree**, so this was not run here.

---

## 4. MEASURED BASELINES — with date + method, or marked unverified

| Metric | Value | Date | How / cite |
|---|---|---|---|
| `willChange.test.js` result | PASS (1 test, 0 fail) | 2026-08-29 | `node --test src/perf/willChange.test.js`, this tree |
| Live `will-change` declarations in `src/**/*.css` | 30, all transform/opacity | 2026-08-29 | grep, this tree (§1e) |
| Static `animation … infinite` declarations, all CSS | ~90 (heaviest `GameScreen.css`=37) | 2026-08-29 | grep, this tree (§2 WRONG #2) |
| Unpaused infinite loops on resting menu | **>1** (≥3 identified: cb-throb, cb-illuminate, sr-caret-blink) | 2026-08-29 | static read of `GameCardArt.css:81-82,175,251-258` — exact runtime integer **unverified — needs measurement** |
| Menu resting-loop count "= 1" | **wrong** (see above) | — | historical claim, corrected |
| Runtime infinite count "= 46" (card-feel era) | **unverified — needs measurement** | — | prior runtime metric, not re-measured here |
| Peak concurrent finite anims on menu keystroke burst | **unverified — needs measurement** | — | `menu-xp.spec.js:126` logs it; not run here |
| Per-tier menu frame-time medians | **unverified — needs measurement** (and see §3: not a reliable signal) | — | `purchase-feel-perf.spec.js:73`; not run here |
| "106 concurrent = no perceptible lag" (basis for retiring the count budget) | as documented | 2026-08-27 | real mid-range Android, commit `a6e69cb` / CLAUDE.md; **not re-measurable in this sandbox** |

**Anything above marked "unverified — needs measurement" requires a Playwright run** (`npx
playwright test …`) on a quiet machine, read via `test-results/.last-run.json` and the `PERF` /
`[advisory]` console lines. None of those numbers should be quoted as fact until re-measured.

---

## 5. TL;DR for the next change

1. Every effect is a **finite one-shot**; add **zero** new infinite loops. Guards:
   `purchase-feel-perf.spec.js:78`, `card-beat.spec.js:52` (both DELTA checks).
2. Animate **transform / opacity only**.
3. **Pool** repeated per-event nodes; **no layout reads** in rAF / keydown / spawn paths.
4. `will-change` lists **only** transform/opacity, toggled on for the animation and off at
   rest. Guard: `src/perf/willChange.test.js` (build-failing).
5. Concurrency is **advisory** — a smell, not a gate.
6. Don't trust sandbox timing: median-of-3, idle machine, read `.last-run.json`, and remember
   headless rAF is bimodal and tier-uncorrelated.
