# STEP 59 — frame time at 4x CPU throttle (Oct 2)

Method: `frames.probe.spec.js` (copy into e2e/ to run). Each screen is opened, left to settle 6 s
(past the 3-2-1-GO / load state), then CDP `Emulation.setCPUThrottlingRate 4` and 4 s of rAF
intervals are sampled while typing a letter every 130 ms (Enter every 6th). Production build,
1280x720 and 390x844. "long" = frames over 34 ms (a dropped 30 fps frame).

Before (frames-before.txt) → after (frames.txt):

| screen | 1280 frames / long | 1280 max | 390 long | 390 max |
|---|---|---|---|---|
| menu (typing = type-to-earn) | 116 / 28.4% → 148 / 22.3% | 150 → 100 ms | 0% → 0% | 33 ms |
| Word Bomb in-game | 203 / 1.5% → 213 / 0.9% | 50 → 67 | 0% | 33 |
| Category Blitz in-game | 223 / 0% → 231 / 0.9% | 34 → 50 | 0% | 33 |
| CHAIN | 178 / 2.2% → 210 / 3.3% | **700 → 200 ms** | 2.8 → 1.8% | **667 → 183** |
| FUSE | 187 / 1.6% → 222 / 2.3% | **683 → 67 ms** | 1.6 → 1.8% | **667 → 83** |
| SAT Rush play | 194 / 4.1% → 195 / 6.2% | 83 → 183 | 5.0 → 0.4% | 150 → 50 |
| WB game over | 182 / 5.5% → 204 / 2.9% | 83 → 50 | 0.9 → 0% | 50 → 33 |

(Single runs; ±10 frames is noise on this box.)

## What was simplified (no headroom)
1. **Beat sync re-rendered the whole App on every beat** (`setBeatCount`) and wrote two inherited
   custom properties on `<html>` per beat. Bisected on the desktop menu: music on 93 frames / 2.6 s,
   1.09 s style recalc; muted 139 frames, 0.32 s. Now beats go through a callback ref (no React
   render), `--flash-color` and `--beat-intensity` are written once when the music starts
   (intensity is a constant 1 — every pop at full strength). Menu typing: 116 → 148 frames / 4 s.
2. **CHAIN / FUSE run-over hitch**: merging the 182k-word extended accept list into a Set was one
   ~150 ms task (620 ms throttled) right as the death card animates in. Merged in 6,000-word slices
   across tasks: worst frame 700 → 200 ms (CHAIN), 683 → 67 ms (FUSE).

## Where there is headroom
Every phone screen and every in-game multiplayer screen runs ≤1% long frames at 4x throttle — the
new one-shot moments this cycle (CLUTCH, FRENZY burst, WINNER BONUS row, world swish) all sit inside
that budget. The desktop menu is the one screen still over (22% long while typing with music on):
what is left is the `html[data-beat]` toggle itself (the sanctioned beat moments). No new
animation was added to the menu.

Startup note: the first ~1.5 s after a Word Bomb game mounts (behind the 3-2-1-GO overlay) is the
heaviest window on any screen (≈1.4 s of main-thread work at 4x); it is covered by the countdown,
so it does not land on play.
