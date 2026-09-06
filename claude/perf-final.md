# PERFORMANCE — FINAL MEASUREMENT PASS

Measured 2026-09-05 against a production `vite build` served at `http://127.0.0.1:4173`.
Tooling: Playwright (chromium, headless) with a per-context CDP session for
`Emulation.setCPUThrottlingRate` (1× / 4×) and `Network.emulateNetworkConditions` (3G) +
`Network.setCacheDisabled` (cold cache). Frame time = in-page rAF delta stream over a 5–6 s
window per sample → median / p95 / count of frames > 50 ms. Scripts (untracked):
`perf-measure.mjs` (menu + solo entry + TTI), `perf-games.mjs` (real solo gameplay), plus a
manual live-backend pass through the actual Word Bomb / Category Blitz game screens for the
infinite-animation counts.

## READ THIS FIRST — what the baseline actually is

`claude/perf-playbook.md` (origin/docs/perf-playbook) contains **no numeric frame-time
baseline**. Every timing row in its baseline table is marked *"unverified — needs measurement"*,
and §3 states plainly that this sandbox's timing is unreliable: headless rAF is **bimodal
(~16.7 / 33.3 ms) and does not correlate with tier**, so a single frame-time reading is a report
line, not a pass/fail signal. The only build-failing guards are structural, not numeric:
(1) `willChange ⊆ {transform, opacity}` (`src/perf/willChange.test.js`), and (2) *zero new
infinite animations*, enforced as a DELTA (`purchase-feel-perf.spec.js`, `card-beat.spec.js`).

Therefore "regression vs baseline" here means: **does the surface hold the 60 fps / 16.7 ms rAF
cadence, and does it obey the structural guards?** A number that stays pinned at 16.7 ms is
"no regression"; anything that sits at a clean multiple (33.3 ≈ 30 fps, 66.7 ≈ 15 fps) is flagged
with the element responsible. The reliable, load-independent metric — the running
infinite-animation count via `getAnimations()` — I measured on every surface; it also **fills the
playbook's single explicit open item** (resting-menu infinite count, previously ">1, unverified").

## FRAME TIME — median ms @ 1× / 4× CPU (p95, and count of frames >50 ms in the window)

| Surface | 1× median | 4× median | Flag |
|---|---|---|---|
| Menu — idle | 16.7 (p95 16.7, 0 long) | 16.7 (p95 16.7, 0 long) | — 60 fps both |
| Menu — "music" (beat pulsed ~120 bpm, proxy) | 16.7 (p95 16.8) | 16.7 (p95 16.8) | — beat effects are free |
| **Menu — 30 keys/s burst** | 16.7 (p95 33.4, 0 long) | **33.3 (p95 66.7, 27 long)** | **FLAG** — ~30 fps @4× |
| SAT Rush — live play, calm | 16.7 (p95 16.8, 0 long) | 16.7 (p95 33.3, 0 long) | — |
| **SAT Rush — live play, typing** | 16.7 (p95 16.8, 0 long) | 16.7 (**p95 66.7, 13 long**, ~40 fps eff.) | **FLAG** — typing jank @4× |
| CHAIN — live play, calm / typing | 16.7 / 16.7 | 16.7 / 16.7 | — 60 fps throughout |
| FUSE — live play, calm / typing | 16.7 / 16.7 | 16.7 / 16.7 | — 60 fps throughout |
| Word Bomb — in-game (late-timer "HURRY") | *not captured* (see caveat) | *not captured* | advisory ↓ |
| Category Blitz — in-game (full solo round) | *not captured* (see caveat) | *not captured* | advisory ↓ |

At **1× everything holds a rock-steady 60 fps**, including both "pressure" cases for the solo
modes. The **only two surfaces that drop below 60 fps do so at 4× CPU, and both are the same
element**: per-keystroke pop/particle spawns (the menu's `useXpCapture` pops and the in-game
juice pops). Under a 30 keys/s burst at 4× the menu falls to ~30 fps with 27 frames > 50 ms; SAT
under typing at 4× keeps a 16.7 ms median but its tail blows out (p95 66.7 ms, ~40 fps effective).
Idle, beat, and calm play are unaffected by the 4× throttle — consistent with the composited
transform/opacity model doing the resting work and the main thread only being taxed per keystroke.

## INFINITE ANIMATIONS RUNNING AT REST — the reliable metric (getAnimations, playState running)

| Surface | Running infinite loops | What they are |
|---|---|---|
| Menu (resting) | **0** | Idle loops removed (MENU MOTION LAW); card art paused via `--art-play`. **Refines the playbook's ">1, unverified".** |
| SAT / CHAIN / FUSE — entry screens | 0 | — |
| SAT Rush — in play | **1** | `sr-caret-blink` (the caret — by design: "only the caret loops at rest") |
| CHAIN — in play | 0 | — |
| FUSE — in play | 0 | — |
| Category Blitz — in play (solo) | **1** | `mascot-breathe` only — very light |
| **Word Bomb — in play (late timer)** | **12** | `wb-tension-vignette/breathe`, `wb-tension-line-scroll` ×3, `wb-danger-breathe`, `bomb-danger-rattle`, `bomb-wobble`, `flame-flicker`, `player-active-pulse`, `player-rock`, `combo label-pulse`, `combo prompt-throb` |
| **Room / lobby (waiting screen)** | **11** | `letter-bounce-forever` ×5 (title letters), `chip-rock` ×2 (player chips), `room-btn-breathe` (difficulty buttons), etc. |

All named loops are transform/opacity (breathe / scroll / rattle / wobble / flicker / pulse /
throb / bounce / rock) — i.e. composited, matching the budget. But two surfaces stand out and are
flagged **advisory** (the playbook keeps in-game concurrency as a smell to investigate, not a
build gate):

- **Word Bomb in-game = 12 concurrent infinite loops**, the heaviest surface by far — the tension
  + danger vignettes, three scrolling tension lines, the bomb rattle/wobble, the flame flicker,
  and two combo loops. Its frame time could not be captured in this sandbox (see caveat), so this
  is the **top candidate to verify on real low-end hardware**: 12 composited loops *plus*
  per-keystroke juice at 4×-equivalent CPU is exactly the combination that jangled the two
  measured typing cases.
- **Room / lobby screen = 11 idle loops** at rest (`letter-bounce-forever`, `chip-rock`,
  `room-btn-breathe`). The "no idle/ambient loops" MENU MOTION LAW was only ever applied to the
  homepage; the room screen still ambient-loops while players sit and wait. Cheap (composited) but
  worth knowing it exists.

## TTI — slow 3G, COLD cache (CDP 3G: ~400 kbps, 400 ms RTT; cache disabled)

| Metric | Value |
|---|---|
| Menu interactive (SHOP + cards present) | **9.18 s** |
| Dictionary-ready (play-ready) | 9.19 s |
| `domInteractive` (Navigation Timing) | 2.90 s |
| `domContentLoaded` | 6.54 s |
| Total transfer on the menu route | **220 KB** (148 KB JS) across 17 requests |

~9.2 s to an interactive, play-ready menu on emulated 3G from a cold cache. Only 220 KB crosses
the wire for the menu (the heavy ~357 KB word chunk is lazy — it loads when a word mode is entered,
not on the menu), so the menu route itself is lean; the 9.2 s is dominated by 3G latency across the
17 serialized-ish requests, not payload size. No numeric TTI baseline exists in the playbook to
compare against; this is the first recorded figure.

## REGRESSIONS / FLAGS (summary)

1. **Menu 30 keys/s burst @4× CPU → ~30 fps** (median 33.3 ms, p95 66.7 ms, 27 frames > 50 ms).
   Element: per-keystroke pop/particle spawns (`useXpCapture`). Fine at 1×.
2. **SAT Rush typing @4× CPU → p95 66.7 ms (~40 fps effective)**, median still 16.7. Same element
   (per-keystroke juice pops). Fine at 1×.
3. **Advisory — Word Bomb in-game runs 12 concurrent infinite loops** (tension/danger/bomb/flame/
   combo), the heaviest surface. Frame time not captured here; verify on real low-end hardware.
4. **Advisory — Room/lobby screen runs 11 idle infinite loops** at rest (letter-bounce, chip-rock,
   button-breathe); the homepage's "no idle loops" rule was never extended to it.

No structural-guard regression: at rest the menu is at **0** running infinite loops (better than
the playbook's last recorded state), and every observed loop was transform/opacity.

## CAVEATS (environment — reported honestly)

- **Sandbox timing is bimodal and not a per-run signal** (playbook §3). Values here are the median
  of a 5–6 s rAF window, and were rock-stable at exactly the rAF cadence (16.7 / 33.3 / 66.7),
  which is why the degradations read cleanly as fps halvings rather than noise — but treat absolute
  ms as indicative, not exact. Not median-of-3-separate-runs.
- **Word Bomb & Category Blitz frame time could not be captured.** Both are server-authoritative
  (live Render backend + solo-vs-bot room flow). Scripting the multi-step card→lobby→room→(add
  bot)→start flow headlessly was unreliable (the blind automation drifted to the SAT mode-select),
  and driving them through the interactive browser doesn't yield frame timing because rAF throttles
  on a non-foreground tab. I *did* reach both real game screens via the live backend and captured
  their in-game infinite-loop counts (WB = 12 at the "HURRY" late-timer state; Blitz = 1);
  screenshot of the live WB late-timer screen: `claude/perf-wordbomb-ingame.jpg`.
- **"Menu during music" is a beat-simulation proxy** (`html[data-beat]` pulsed ~120 bpm during the
  window). Real audio needs a user-gesture unlock; the beat-driven title-pop + frame-glow are the
  only menu motion tied to music, and the proxy exercises exactly those. Result: no measurable cost
  (16.7 ms at both throttles).
- Solo "pressure" for SAT/CHAIN/FUSE was exercised as sustained typing + the stage timer running,
  not a hand-isolated single mechanic (e.g. the SAT spell-along endgame frame was not isolated);
  the typing case is the load that actually taxes the main thread, and it is the one that flagged.
- Headless chromium, desktop viewport. A true mid-range Android (the playbook's reference device
  for the "106 concurrent loops = no lag" finding) was not available.
