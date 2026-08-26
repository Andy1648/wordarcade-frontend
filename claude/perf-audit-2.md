# Performance Regression Check — typeaword.com

**Date:** 2026-08-26 · **Branch:** perf/audit-2 · **Report-only, no code changed.**
**Method:** Playwright, 1440×900, headless Chromium. Each scenario = median rAF frame time over 3
runs of a ~1.6s window, plus the PEAK concurrent *finite* (non-looping) running-animation count
during that window (`document.getAnimations()`), which is the sensitive number.

**Headless caveat (important):** rAF frame time in headless Chromium is vsync-quantized — it snaps
to **16.7ms (60fps)** or **33.3ms (30fps)**, nothing between. So a 16.7 is "hits 60fps", a 33.3 is
"drops to 30fps"; it cannot show a 3ms drift. The **concurrent-animation peak** is the finer signal
and the one to watch against the budgets.

## Baseline compared against
There is no formal "perf playbook" in the block-state doc. The prior recorded numbers live in
`claude/wordbomb-perf.md` (Word Bomb keydown path): **calm ≈ 17ms / 8 concurrent anims**, **critical
≈ 25ms / 42 concurrent anims**. Those are the comparison points for the game screen; the menu
budget is the documented **20 concurrent finite animations** (guarded by `menu-xp.spec`).

## Results

| Scenario | Median frame time | Peak concurrent finite anims | vs baseline |
|---|---|---|---|
| **Menu — idle** | 16.7ms (60fps) | **0** | matches "quiet at rest" (MENU MOTION LAW) |
| **Menu — during music (beat)** | 16.7ms (60fps) | **12** | within the 20 budget; no frame drop |
| **Menu — 30 keys/sec burst** | **33.3ms (30fps)** | **17** | within the 20 budget; drops to 30fps under the burst |
| **Word Bomb — calm** | 16.7ms (60fps) | **2** | ↑ improved (was 17ms / **8**) |
| **Word Bomb — critical** | 16.7ms (60fps) | **5** | ↑↑ big improvement (was **25ms / 42**) |
| **Category Blitz — in round** | 16.7ms (60fps) | 3 | clean |
| **SAT Rush — playing** | 16.7ms (60fps) | **32** | high count, but no frame cost (see note) |
| **CHAIN — playing** | 16.7ms (60fps) | 1 | clean |
| **FUSE — playing** | 16.7ms (60fps) | 1 | clean |

## Flags

**Nothing regressed on frame time.** Every screen holds 60fps in headless except the menu under a
sustained 30-keys/sec burst, which drops to 30fps — and that is unchanged/expected behaviour, not a
new regression (the XP-pop layer during a level-crossing burst is the app's known worst case; it
still stays under the 20-animation budget at 17).

**Word Bomb improved substantially since `wordbomb-perf.md`.** The prior critical-tension state ran
**42 concurrent animations at ~25ms/frame**; it now runs **5 at 16.7ms**. The perf work that stopped
the stacked full-viewport red washes, the per-frame halftone repaint, and the beat-bright loop
(documented in that file and WallScene.css) landed and is paying off — critical tension is now
essentially free. Calm likewise dropped from 8 → 2.

**One thing to watch, not a regression: SAT Rush shows 32 concurrent finite animations while
playing.** That's above the *menu's* 20 budget, but it's a different screen with its own manga
motion system (speed lines, screentone plates, caret, ante juice). Frame time stays at a solid
16.7ms/60fps, so it is not causing jank today — but it is the highest animation density in the app
and the least headroom if more motion is ever added there. Worth a `will-change`/layer review before
piling on more SAT-screen motion, and worth a dedicated budget guard like the menu has.

**Menu music playback (12 anims) is healthy.** The card-feel beat pulse + card glow + title
beat-pop stack to 12 concurrent on a kick, comfortably under 20, with no frame drop — consistent
with the card-feel job's finding (+0ms frame time at realistic tempo).

## Bottom line
No performance regressions from the menu growth (XP layer, pops, beat-reactive cards, larger text).
The two numbers to keep honest going forward: the **menu burst** (17/20 — don't add more finite
menu animation) and **SAT Rush playing** (32 concurrent — give it its own budget guard before adding
motion). Everything else has margin, and Word Bomb is markedly faster than the last recorded baseline.

**No code changed in this audit.**
