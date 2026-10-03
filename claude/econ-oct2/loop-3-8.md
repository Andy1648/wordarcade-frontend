# Fine-tune loops 3–8 (Oct 2, 19:00–21:15 ET)

Loops 3–8 found no new economy violation, so they spent their time on B (copy = code) and C (visual).
Final re-sim on main after #147 (`loop-sim-final.json` / `-console.txt`, tag `final`):

| window | gap max (limit) casual / median / fast | worst KEY eta | worst shop eta |
|---|---|---|---|
| 10 m | 0.67 / 0.40 / 0.31 m (0.75) PASS | 204 / 97 / 192 m* | 12.4 / 2.9 / 1.5 m |
| 1 h  | 0.83 / 1.1 / 0.81 m (3) PASS | 14.7 / 22.9 / 16.9 m | 1.5 / 1.1 / 0.3 m |
| 5 h  | 3.8 / 2.9 / 2.0 m (8) PASS | 35 / 29 / 107 m | 3.7 / 1.5 / 1.7 m |
| 20 h | 5.8 / 4.8 / 3.9 m (12) PASS | 33 / 40 / 31 m | 6.0 / 2.7 / 1.1 m |

\* the 10 m KEY eta is a post-rebirth LV1 sample: KEY prices are flat in rebirth, and the next tier was
bought within ~2 min in every run (the realised waits), so it is not a wall.

- **Runaway:** 0 failing lumps (casual 0/413, median 0/681, fast 0/1396). Before loop 1: 3/3/2, with
  WALKING DICTIONARY paying 4.8e19 wins (≈633,000 min of play). The largest lump now is ≈2.8 min of play.
- **formatNum:** every extreme (to 1e17 in the sim, and the 1e300 unit tests) formats with a suffix. PASS.
- **Mechanics reached:** weekly board at the first word; a mark + the first rebirth by 2.4–4.3 min; FRENZY at
  1.5 min (fast) / 47 min (median). The casual sim bot never fires FRENZY, but loop 2 showed that's a sim artifact
  (the real FUSE engine reaches it in 44% of runs). BOOST only comes from a code, and the sim redeems one at 5 h.
- **Wall (KEY ≤15 min):** still FAILs from 1 h. This is the v8 ladder (KP2). Andy decides (ANDY TODO).
  Shop items (FORGE) stay ≤6 min at every window, so there is always something to buy.

| loop | PR | fix |
|---|---|---|
| 3 | #146 | earned achievements say ✓ EARNED; the board card shows the viewed board's rank (#N THIS WEEK) |
| 4 | #146 | MARKS index opens on your next mark, not a copy of the hero |
| 5 | #146 | LETTER FORGE opens at its level (stale "CLAIM IT IN REWARDS" copy removed) |
| 6 | #146 | a live BOOST pill on the phone menu |
| 7 | #147 | BOOST/FRENZY pills fit Word Bomb's docked stack at 1366x625; the FUSE HUD stays on one row |
| 8 | loop8 | MARKS "UP TO +300%" → the computed ceiling (+480%, LEGENDARY rank V); SET AS MAIN back on screen at 1280x551 / 1366x625 with a MAIN worn (was 176 / 108 px below the fold) |

Text sweep (`claude/finetune/text-sweep.mjs`, fresh LV1, prod, 1280x551 / 1366x625 / 390x844 / 1920x1080,
menu + stats + shop + board): **0 visible text elements under 13 px.** Prod smoke
(`claude/finetune/prod-smoke.mjs`, returning visitor): 0 console errors.
