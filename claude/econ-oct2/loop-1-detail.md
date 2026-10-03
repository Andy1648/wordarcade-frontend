# LOOP-1 detail: baseline measurements, root causes, probes

This is a companion to `loop-1.md`, which a parallel session rewrote after its own fix1 run. This file keeps the baseline detail and the probe results.

Sim: `loop-sim.mjs`, run against `origin/main` @ c4f395e. The sim header lists the model assumptions. Results are in `loop-sim.json` and `loop-sim-console.txt`.

How to re-run:
- The `../sim-wt` worktree has been removed. Re-create it with `git worktree add ../sim-wt origin/main`, or point `SIM_SRC` at a src tree.
- To probe a constant change: `SIM_PATCH='[[file, find, replace]]' node claude/econ-oct2/loop-sim.mjs --tag=X`.

## Baseline (main as shipped)

| skill | window | max / p90 gap (limit) | strict max (no FORGE buys) | worst KEY interval (realised) | next shop item ETA | state at window end |
|---|---|---|---|---|---|---|
| casual | 0–10 m | 0.67 / 0.33 (0.75) | 0.67 | 6.5 m | 21 m* | LV153 R6 T11 |
| casual | 50–70 m | 0.83 / 0.5 (3) | 1.0 | **93.8 m** (T14) | 1.7 m | LV469 R17 T13 |
| casual | 4.5–5.5 h | 3.8 / 1.7 (8) | 5.0 | **753.7 m** (T16) | 2.9 m | LV631 R20 T15 |
| casual | 18.5–20 h | 5.3 / 4.2 (12) | 9.3 | **256.8 m, still open** | 5.4 m | LV729 R22 T16 |
| median | 0–10 m | 0.4 / 0.1 | 0.4 | 3.7 m | 1.0 m | LV213 R8 T12 |
| median | 50–70 m | 0.7 / 0.4 | 0.7 | **45.2 m** | 0.9 m | LV597 R19 T15 |
| median | 4.5–5.5 h | 2.3 / 1.2 | 3.4 | **139.1 m** | 1.5 m | LV757 R23 T17 |
| median | 18.5–20 h | 4.8 / 3.8 | **18.5** | **595.9 m, still open** | 4.6 m | LV1094 R29 T24 |
| strong | 0–10 m | 0.31 / 0.13 | 0.31 | 2.5 m | 2.9 m | LV244 R6 T12 |
| strong | 50–70 m | 0.75 / 0.31 | 1.0 | **33.1 m** | 0.25 m | LV784 R23 T18 |
| strong | 4.5–5.5 h | 2.3 / 1.3 | 4.9 | **1,071.9 m, still open** | 0.9 m | LV1057 R31 T25 |
| strong | 18.5–20 h | 4.0 / 2.9 | **13.9** | **1,071.9 m, still open** | 1.4 m | LV1220 R32 T25 |

\* Projected at LV1 right after a rebirth, while trailing income lags. Realised buys in that window landed within minutes.

### Pass/fail by criterion

| # | criterion | result |
|---|---|---|
| 1 | gaps | PASS for every skill and window. The strict view, without LETTER FORGE buys, fails at 20 h: 18.5 m median, 13.9 m strong. |
| 2 | next KEY ≤ 15 m | FAIL from the 1 h window on, for every skill. |
| 2 | next shop item ≤ 15 m | PASS: the next FORGE is always 1–6 m away. |
| 3 | runaway | FAIL (detail below) |
| 4 | formatNum | PASS: 0 of 58 checks fail (detail below) |
| 5 | mechanics reached | FAIL for casual only: FRENZY never fires in 20 h (0.1% of FUSE runs). |

**Criterion 3, worst lumps:**
- WALKING DICTIONARY pays 4.8e19 wins (median) and 1.1e20 wins (strong). That is 106k–633k minutes of play, and one claim buys KEY T19 through T24.
- PAPER CHASE pays 5.1M wins at 6 minutes for casual: 7.9 minutes of play, about 670 levels' worth.
- Mastery milestones pay 3.5 to 7.4 minutes of play each.

**Criterion 4:**
- Values up to 1.78e21 print correctly: "1.78Sx" and "284Qi". Synthetic inputs print 1e300 as "1Nong" and 1e303 as "1Ce".
- Note 1: `format.js:24` groups digits with U+2009 THIN SPACE, but its comment at lines 6-11 says the grouping is a comma.
- Note 2: 9999.6 prints as "10 000" rather than "10K".

**Criterion 5, first time each mechanic fires:**

| | marks + first rebirth | FRENZY | BOOST | weekly board |
|---|---|---|---|---|
| casual | 4.3 m | never in 20 h | at the 5 h code | first word |
| median | 2.4 m | 14.9 m | at the 5 h code | first word |
| strong | 3.1 m | 1.5 m | at the 5 h code | first word |

**Per-level code:** the 1,000-wins per_level code at 1 h pays 451k–767k wins. At that point income is 1e10–1e14 wins per minute, so the code is worth about 1e-6 minutes of play: it is dead on arrival. The cause is `claims.js:144`, which scales by level (linear) while income grows exponentially. The fix is to pay a per_level code in words at the current rate.

**The shape of the crash:**
- The first rebirth lands at 2.4–4.3 minutes. By 10 minutes the bots are at R6–R8 and LV150–245; by 1 hour, R17–R23.
- The causes:
  - KEY T1 and T2 cost only 10 and 60 wins.
  - The RANK UP ladder re-pays at every rebirth (`achievements.js:256` × `RANK_UP_WORDS` 25).
  - PAPER CHASE and the REBIRTH achievement land in the same minutes.
- After R20, rebirth gates grow by +50 levels on the 1.03 geometric tail (`xp.js:94-95`, `xp.js:177`). The KEY price grows ×6 per tier while its effect grows ×2.5 (`xp.js:278-279`).
- So from about 1 h on, KEY tiers are bought only in clumps when a lump arrives (mastery milestones, which come at fixed word counts; rebirth claim bursts; secrets). Between clumps the bots get 9–14 level-ups per 90 minutes.

## Probes (constant patches; outputs `loop-sim-<tag>*`)

| tag | patch | KEY interval: worst at 1 h / 5 h / 20 h | note |
|---|---|---|---|
| base | – | casual 94 / 754 / 257; median 45 / 139 / 596; strong 33 / 1,072 / 1,072 | |
| p2-winlevel1 | `WIN_LEVEL_STEP 1.035→1` (wins.js:193) | casual 144 / 835 / 175; median 45 / 139 / 97; strong 33 / 890 / 890 | 1e19–1e20 lumps gone |
| p1-keystep3 | `TIER_COST_STEP 6→3` | casual 139 / 382 / 132; median 14 / 72 / 596; strong 9 / 664 / 226 | T50 by 1 h, a faster crash |
| p12 | p1 + p2 | median 14 / 72 / 54 | |
| p4-step2.75 | step 2.75 + p2 | walls of 30–226 m remain | runs away to 1e72 wins/min |
| p4-step3.5 | step 3.5 + p2 | 26–542 m | |
| p5-soft | `TIER_XP_STEP 1.5`, `TIER_COST_STEP 1.65` + p2 | median 7 / 39 / 54; strong 6 / 57 / 226 | |
| p3 (killed, not saved) | KEY priced at a words-at-rate cap, ×2.5 effect kept | T79 and 1e37 wins inside 1 h | pure runaway |
| p6-capsoft (`probe-p6.json`) | KEY cost = min(×6 ladder, 40·(1+t/40) words at your full rate) + `TIER_XP_STEP 1.2` + p2 | **casual 22.5 / 20.5 / 29.3** | Median and strong were not completed: the run was too slow and was stopped. Make the cap flat (no 1+t/40 growth) to bring casual to ≤ 15 m. |

**Conclusion on criterion 2:** no single constant removes the KEY wall. A constant either moves the wall later or turns it into a runaway. The fix that works has two parts: the KEY price follows the player's rate (the way `forgeCost` already prices the forge), and the per-tier effect shrinks so that following the rate does not compound into a runaway.
