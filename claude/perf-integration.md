# Perf report — integration/run-stack (perf/integration)

Measured with `claude/perf-integration.mjs` (playwright core, own `vite preview`, reducedMotion:no-preference so real loops run, CDP `Emulation.setCPUThrottlingRate` 1x/4x, rAF frame deltas sampled 4000ms, first frame dropped, median + p95). Viewport 1440x900. 60fps = 16.7ms/frame. Sandbox timing is load-sensitive (playbook §3) — read medians as ballpark, p95 as jank signal.

## Scenario × throttle (ms/frame)

| Scenario | 1x median | 1x p95 | 4x median | 4x p95 |
|---|---|---|---|---|
| a. menu idle | 16.7 | 16.7 | 16.7 | 16.7 |
| b. menu keyburst ~30/s | 33.3 | 50.0 | 33.3 | 100.0 |
| c. WORD BOMB calm | 16.7 | 16.8 | 16.7 | 16.8 |
| c. WORD BOMB max (low timer + type) | 33.3 | 50.0 | 66.6 | 100.0 |
| c. CATEGORY BLITZ calm | 16.7 | 16.7 | 16.7 | 16.7 |
| c. CATEGORY BLITZ max (low timer + type) | 16.7 | 33.3 | 16.7 | 49.9 |
| c. CHAIN calm | 16.7 | 16.8 | 16.7 | 33.3 |
| c. CHAIN max (mid-combo typing) | 16.7 | 16.8 | 16.7 | 33.4 |
| c. FUSE calm | 16.7 | 16.8 | 16.7 | 33.3 |
| c. FUSE max (mid-combo typing) | 16.7 | 16.7 | 16.7 | 33.4 |
| c. SAT RUSH calm | 16.7 | 16.7 | 16.7 | 33.4 |
| c. SAT RUSH max (endgame speed-lines) | 16.7 | 16.8 | 16.7 | 33.4 |
| d. RUN draft screen | 16.7 | 16.7 | 16.7 | 16.8 |
| e. RUN round (typing) | 16.7 | 16.7 | 16.7 | 33.4 |

## Runtime animation + will-change audit (per screen, at 1x settled)

Menu baseline running infinite animations: **0**.

| Scenario | total anims | infinite (running) | Δ vs menu | bad will-change |
|---|---|---|---|---|
| a. menu idle | 2 | 0 | +0 | none |
| b. menu keyburst ~30/s | 2 | 0 | +0 | none |
| c. WORD BOMB calm | 11 | 8 | +8 | none |
| c. WORD BOMB max (low timer + type) | 18 | 8 | +8 | none |
| c. CATEGORY BLITZ calm | 5 | 1 | +1 | none |
| c. CATEGORY BLITZ max (low timer + type) | 6 | 2 | +2 | none |
| c. CHAIN calm | 13 | 0 | +0 | none |
| c. CHAIN max (mid-combo typing) | 16 | 0 | +0 | none |
| c. FUSE calm | 12 | 0 | +0 | none |
| c. FUSE max (mid-combo typing) | 14 | 0 | +0 | none |
| c. SAT RUSH calm | 35 | 1 | +1 | none |
| c. SAT RUSH max (endgame speed-lines) | 9 | 1 | +1 | none |
| d. RUN draft screen | 0 | 0 | +0 | none |
| e. RUN round (typing) | 24 | 0 | +0 | none |

### Infinite-animation names per screen

- **a. menu idle**: (none)
- **b. menu keyburst ~30/s**: (none)
- **c. WORD BOMB calm**: wb-danger-breathe×1, player-active-pulse×1, player-rock×1, bomb-danger-rattle×1, bomb-idle×1, flame-flicker×1, label-pulse×1, prompt-throb×1
- **c. WORD BOMB max (low timer + type)**: wb-danger-breathe×1, player-active-pulse×1, player-rock×1, bomb-danger-rattle×1, bomb-idle×1, flame-flicker×1, label-pulse×1, prompt-throb×1
- **c. CATEGORY BLITZ calm**: mascot-breathe×1
- **c. CATEGORY BLITZ max (low timer + type)**: mascot-breathe×1, timer-pulse×1
- **c. CHAIN calm**: (none)
- **c. CHAIN max (mid-combo typing)**: (none)
- **c. FUSE calm**: (none)
- **c. FUSE max (mid-combo typing)**: (none)
- **c. SAT RUSH calm**: sr-caret×1
- **c. SAT RUSH max (endgame speed-lines)**: sr-caret×1
- **d. RUN draft screen**: (none)
- **e. RUN round (typing)**: (none)

---

## Findings, regressions, and confirmations

### The three build-failing guards (playbook §1) — status
- **Gate green:** `npm run lint` = 0 errors; `node --test "src/**/*.test.js"` = 487 pass / 0 fail
  (includes `src/perf/willChange.test.js` — "will-change lists only compositor props" PASS);
  `npx vite build` exit 0.

### (1) Zero NEW infinite animations on any play screen — CONFIRMED for the run-stack
Menu resting baseline = **0** running infinite animations (measured, `getAnimations()` filtered
`iterations===Infinity && playState==='running'`).
- **RUN draft = 0 total / 0 infinite. RUN round = 24 finite / 0 infinite.** The new RUN mode adds
  ZERO infinite loops. Every RUN effect is a finite one-shot (pops/toast), matching the "no idle
  loops, menu motion law" note in RunMode.jsx.
- **PlayBackdrop contributes 0 animations of any kind.** The clearest proof: the RUN draft screen
  shows **0 total** `getAnimations()` while `<PlayBackdrop/>` is mounted — the backdrop's ~28 decor
  nodes are painted once and animate nothing. None of the infinite-animation NAMES on any play
  screen is a `play-backdrop`/`wall-*` selector.
- The infinite loops that DO run on the play screens are the **games' own pre-existing in-game
  idle loops**, not run-stack additions:
  - WORD BOMB: 8 (`wb-danger-breathe`, `player-active-pulse`, `player-rock`, `bomb-danger-rattle`,
    `bomb-idle`, `flame-flicker`, `label-pulse`, `prompt-throb`) — the bomb/HUD idle set. Same 8 at
    calm and at max, so max-pressure adds none.
  - CATEGORY BLITZ: 1 calm (`mascot-breathe`) → 2 at low-timer (`timer-pulse` arms under 5s) — a
    danger cue coded as a loop; pre-existing GameScreen behaviour.
  - SAT RUSH: 1 (`sr-caret` blink) at both calm and endgame — the sanctioned "only the caret loops
    at rest" from the SAT sub-style. Endgame speed-lines did NOT add an infinite loop
    (`.sr-speedlines` is composited transform/opacity, finite).
  - CHAIN / FUSE: **0** infinite at calm AND under typing — cleanest of all five.
  In-game infinite count is ADVISORY per playbook §1f; the build-failing guard is menu-scoped and
  the menu is unchanged at 0.

### (2) will-change ⊆ {transform, opacity} — CONFIRMED
Runtime audit of every element's computed `will-change` on all 14 scenarios: **0 bad values**
anywhere (nothing outside {auto, transform, opacity}). Corroborated by the build-failing
`willChange.test.js` (CSS-source scan) passing.

### (3) PlayBackdrop memo held — CONFIRMED
`src/components/PlayBackdrop.jsx` still ends `export default memo(PlayBackdrop);` (line 197). Body is
static module-level config (TAGS/STICKERS/SPLATTERS/DRIPS) with no timers, no rAF, no layout reads,
no state — transform/opacity only, as static values. Runtime confirms it re-renders/animates
nothing: RUN draft (whose parent re-renders on the run clock) shows 0 total animations with the
backdrop mounted.

### Frame-time flags
Playbook §3 caveats apply: sandbox timing is load-sensitive, headless rAF is bimodal (16.7/33.3),
and driver-paced keystrokes put a ~33 ms floor under the "typing" rows — read these as relative
signals, not absolutes.
- **All CALM play screens + both RUN screens = 16.7 ms/frame (60fps) at BOTH 1x and 4x.** The
  backdrop + redesign leave the resting play surfaces at a clean 60fps even at 4x throttle — the
  headline result.
- **WORD BOMB under sustained max-pressure typing is the one outlier** — 33.3 ms median @1x,
  **66.6 ms median / 100 ms p95 @4x** (vs BLITZ max 16.7 / 49.9 @4x). Responsible element: the WB
  per-keystroke path is the heaviest — 8 concurrent in-game infinite loops running *while* each
  keydown fires the local-reject buzz/shake (combo `at`; most typed words miss the fragment →
  `game-shake` on `.game-stage` + toast) plus the BombVisual and optimistic-accept re-render. NOT a
  new-infinite-loop regression (count is flat 8 calm→max); it is main-thread churn per keystroke
  that 4x throttling magnifies. At 1x it degrades to ~30fps only during a continuous ~30-key/s
  burst (faster than human sustained typing); single words recover to 60fps between them.
- **Menu keyburst** (33.3 @1x, 100 p95 @4x) is the pre-existing purchase-feel key-power effect, not
  a run-stack change; comparable magnitude to WB and expected.
- CHAIN / FUSE / SAT / BLITZ max-pressure all hold 16.7 median (p95 only rises to ~33 @4x) — no
  concern.

### Verdict
**The backdrop + RUN mode + ingame redesign keep the play screens at/near 60fps.** At 1x every calm
screen and both RUN screens hold a clean 16.7 ms/frame; at 4x they stay at 16.7 ms median. The
PlayBackdrop is confirmed inert (0 animations, memo held, static-only). The RUN mode adds zero
infinite animations and zero bad will-change. No screen janks at rest. The single elevated cell is
WORD BOMB under artificial sustained-typing pressure at 4x (66.6 ms median), driven by its
pre-existing 8 in-game loops + per-keystroke reject-shake churn — a smell to watch (advisory), not a
guard breach and not introduced by this integration. Ship-safe from a perf standpoint; the three
build-failing guards are all green.
