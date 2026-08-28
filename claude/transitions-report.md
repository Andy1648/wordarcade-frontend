# JOB 12 — SCREEN TRANSITIONS (feat/transitions)

One consistent transition language, used for EVERY screen change: a single directional WIPE panel,
**transform + opacity only**, **240ms** (≤250ms), fired through the app's single `runTransition`
helper. Direction encodes nav sense — **menu → deeper = "forward"** (panel sweeps in from the right),
**→ menu = "back"** (sweeps from the left) — so entering the game feels like entering and returning
feels like returning.

Shared timing tokens live in `Transitions.css :root` (`--transition-ms: 240ms`, `--transition-ease:
cubic-bezier(0.22,1,0.36,1)`), referenced by the wipe AND the modal so the whole app speaks one
language (the ModeDialog already used that exact easing).

## Before → after
- **Before:** a 500ms Persona-5 five-bar whoosh (`TransitionOverlay`) — one shared overlay already,
  but 500ms (> the 250ms budget) and non-directional (identical for enter and return).
- **After:** one directional wipe panel, transform+opacity, 240ms, forward/back — same single helper,
  now within budget and directional.

## Every screen change + its transition (all through the one helper)
`runTransition(word, dir)` fires on every real `view` change (App's `[view]` effect) plus the two
in-screen reveals that don't switch `view`. Direction from `NAV_DEPTH` (home 0, overlays 1, live
game/room 2):

| Change | Direction | Word |
|--------|-----------|------|
| home → SHOP / STATS / COLLECTION / ACHIEVEMENTS / CREDITS | forward | (per view) |
| home → lobby / browse | forward | READY? / JOIN ROOM |
| home → SAT RUSH / CHAIN / FUSE | forward | (mode word) |
| lobby/browse → room | forward | SQUAD UP |
| room → game | forward | READY? |
| game → results (in-`game` reveal) | forward | RESULTS |
| any overlay/game → home | **back** | PEACE OUT |
| cg-arm entry | forward | GET READY |

Every one is the SAME component (`TransitionOverlay`) with the SAME keyframes; **no screen uses a
bespoke screen transition.** Verified in-browser: home→stats reports `data-dir="forward"`, stats→home
reports `data-dir="back"`.

## Modals (the "dialog" case)
`ModeDialog` and the small menu cards (return-bonus/achievement, on other branches) open as MODALS,
not screen swaps — they scale+fade in place (transform+opacity, 200ms, the SAME easing token). A
full-screen wipe to open an in-place modal would read wrong, so modals keep an in-place scale but now
share the language's timing/easing. `TransitionIntro` (the one-time boot sequence) is the app launch,
not a screen change, and is left as its bespoke intro.

## Measurement
- Transition **frame-time, median of 3** during a forward screen change (Playwright, real Chromium,
  rAF deltas): **17.3ms** (samples 17.2 / 17.3 / 18.8). The wipe itself is GPU-composited
  (transform/opacity); the ~17ms frame is the React remount of the incoming screen during the swap,
  not the animation. Essentially 58–60fps, imperceptible for a one-frame swap.
- Zero console/page errors across the navigations. Reduced-motion collapses the animation to 1ms.
- Full test suite 352 green; build clean.

## Honest gaps
- The frame during the swap is ~17ms (a hair over 16.7) because the incoming screen mounts on the same
  frame — inherent to the instant-swap architecture (the CLAUDE.md trap forbids gating the screen
  behind the transition, so we can't defer the mount). The animation frames are composited and smooth.
- Modals scale rather than wipe (deliberate — see above); if you want them to wipe too, that's a
  one-line switch but I judged it wrong for in-place dialogs.
