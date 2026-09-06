# Word Bomb input-lag diagnosis (measure-only)

Branch `perf/wordbomb-measure`. **No app code changed.** Measured in Chromium via
Playwright + the mock WebSocket harness (`e2e/support/backendMock.js`), with real
motion (the default `reducedMotion: reduce` was overridden so animations run).
Layout reads were counted by wrapping `Element.prototype.getBoundingClientRect`,
`getComputedStyle`, and the offset/client getters **at the DOM level via
`addInitScript`** (the app itself is untouched). Word Bomb was driven to a live
turn (my turn, combo `TRA`); the **critical** tier was produced with a
`timer_tick` dropping the round clock to ~10% (ratio < 0.3).

## TL;DR
The keystroke path is **cheap and clean** — ~1 ms of synchronous work, **zero
layout reads**, and the menu XP-capture hook is **not** running in-game. The lag
that shows up under time pressure is **rendering/compositing jank from the
critical-tension animation load**, which jumps from **8 → 42** concurrently
running animations. keydown→paint goes from ~1 frame (17 ms) in calm to ~1.5
frames (25 ms) in critical. Nothing in the input handler is the bottleneck; the
tension VFX are.

## 1. keydown → character on screen (median of 50)
| tier | synchronous handler cost | keydown → next painted frame |
|---|---|---|
| calm (timer > 60%) | **1.1 ms** | **17.0 ms** (≈ one 16.7 ms frame) |
| critical (timer < 30%) | **1.0 ms** | **24.9 ms** (≈ 1.5 frames — frames drop) |

The `onChange` handler (sound tick + `setDraft` + `onTypingUpdate` WS send) plus
React's synchronous commit costs ~1 ms — the character is committed same-tick and
painted on the next frame. In **calm** that next frame lands on schedule (17 ms).
In **critical** the next frame is delayed/jittery (median 25 ms, i.e. some frames
are missed) because the compositor/paint is saturated by the tension VFX (see #5).
So the extra ~8 ms of felt lag is **dropped frames under animation load**, not
handler cost.

## 2. Enter → word_result rendered (median of 30)
**20.6 ms** (≈ 1.25 frames). Path: `handleKeyDown` → `submit()` (synchronous WS
send) → mock replies `word_result` → `useHypeFeedback` fires the accept FX. The
mock reply is in-process (sub-ms), so this figure is essentially submit + accept-FX
render. One `getBoundingClientRect` is done in this path (see #3); no thrashing.

## 3. Layout reads in the keystroke / submit path (with file:line)
Measured during 50 keystrokes: **`getBoundingClientRect` = 0, `getComputedStyle`
= 0, offset/client getters = 0** — in **both** calm and critical. Measured per
accepted submit: **`getBoundingClientRect` = 1**.

- **Keystroke path: none.** The only layout read reachable from `onChange` is the
  floating-letter flourish at `src/components/GameScreen.jsx:2874`
  (`inputRef.current.getBoundingClientRect()`), and it is **gated off** by
  `JUICE.FLOATERS` — set to `false` at `src/juice/config.js:8`. So it never runs.
  The particle layer (`src/juice/particles.js`) is canvas-based and takes
  coordinates as arguments; it does no layout reads.
- **Submit / result path (fires on the accepted word_result, not per keystroke):**
  - `src/components/GameScreen.jsx:1342` — `useHypeFeedback` reads the input rect to
    anchor the accept burst. **This is the 1 read measured per submit.**
  - `src/components/GameScreen.jsx:1858`, `:1915` — burst/shockwave FX anchors
    (fire on accept, combo-dependent).
  - `src/components/GameScreen.jsx:1974-1975` — `FlyingWord` from/to rects (the
    word-toss animation; only when a flight is in progress).
  - `:3124`, `:3140` are in **CategoryBlitzScreen**, not Word Bomb.

  None of these are on the keystroke path, none read-then-write in a loop, and the
  submit path totals a single rect read — layout thrashing is **not** a factor here.

## 4. Is the XP-capture hook firing on the Word Bomb screen?
**No.** `useXpCapture` is mounted only by the menu (`Homepage`)/splash; on
`view === 'game'` the homepage is unmounted and its window `keydown`/`pointer`
listeners are torn down. Evidence:
- The menu FX layer `.menu-xp-fx` is **not present** in the DOM on the WB screen
  (`menuXpFxMounted: false`).
- Typing 10 characters into the WB input changed **neither** `taw.xp` nor
  `taw.taps` in localStorage (both stayed `null`). If the capture hook were
  listening, every keystroke would credit XP and bump those keys.

So XP capture adds **no** work to the in-game keystroke path.

## 5. Concurrent running animations while typing
| tier | running animations |
|---|---|
| calm | **8** |
| critical | **42** |

The critical tier is the cost. Breakdown of what turns on (running-animation
counts by element class):

- **`wb-tension-line` ×12** — the single biggest contributor (twelve animated
  tension/speed lines).
- `bomb-num-pulse` ×3, `sweat-drop` ×3, `wb-danger-vignette` ×2, `bomb-fuse` ×2,
  `game-player-card` ×2.
- Plus one each of: `wb-tension-vignette`, `wb-tension-throb`, `wb-tension-getout`,
  `wall-red`, `bomb-vignette`, `bomb-scale`, `bomb-rattle`, `bomb-body-wrap`,
  `bomb-flame-core`, `bomb-flame-pos`, `game-stage`, `game-header`,
  `game-player-bar`, `game-used`, `game-combo`, `game-combo-box`,
  `game-combo-label`, and a bare `DIV`.

Calm, by contrast, runs only: `bomb-rattle`, `bomb-body-wrap`, `bomb-flame-core`,
`bomb-flame-pos`(≈), `game-combo`, `game-combo-label`, `game-player-card` ×2,
`wb-danger-vignette` ×1.

Several of the critical-only animations are **full-viewport washes** (the
`wb-tension-*` vignettes/lines, `wall-red`, `bomb-vignette`) that repaint large
areas every frame. That large-area compositing/paint load — not the JS in the
keystroke handler — is what pushes frames past their 16.7 ms budget and makes
typing feel laggy exactly when the timer is low.

## Where to look next (not changed here)
The input path is already lean. If input smoothness under tension is the goal, the
lever is the **critical-tier VFX budget** — most cheaply the `wb-tension-line ×12`
set and the stacked full-screen vignette/`wall-red` layers (reduce count, or make
them `will-change`/transform-only so they composite without repaint), and/or gating
some of them behind the existing reduced-motion path. That is a follow-up change,
outside this measure-only pass.

### Method caveats
- Timings are Chromium on this machine; treat them as relative (calm vs critical),
  not absolute hardware truth.
- keydown was driven with a native value-setter + `input` event (how a controlled
  React input actually updates) and, for submit, a synthetic `Enter` keydown; the
  mock reply is in-process so #2 excludes real network.
- "Running animations" is `document.getAnimations()` filtered to `playState ==
  'running'` (WAAPI + CSS), sampled during the typing window.
