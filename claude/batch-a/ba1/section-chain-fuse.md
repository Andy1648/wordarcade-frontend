# BA1 — CHAIN + FUSE (solo) unfun moments

**Method.** `chain-sim.mjs` and `fuse-sim.mjs` import the real engines from origin/main
(`src/solo/chain.js`, `src/solo/fuse.js`, via `solo-common.mjs`; set `BA1_SRC` to point elsewhere). Word
data is built the same way `words.js` builds it (recall, accept, famous, common). The clock mirrors
`useSoloGame.js`:
- The budget is read when the turn starts (lines 130-138).
- Word 1 is armed on its first typed character (lines 166-178), so its think time is free.
- An accept restarts the clock (line 212). A FUSE expire serves the next fragment and restarts the clock (lines 153-156).
- A CHAIN timeout is always death (`ChainGame.jsx:82-85`).

**The median-human model** reuses the calibrated produce-time model from `claude/fuseThroughput.mjs:11`,
`winsmin-sim.mjs:85` and `econ-oct2/frenzy-sim.mjs:62`:

`produce = 1600 + U(0,4600) + 300·len + scarcity`

- Candidates are the first 30 unused known words for the prompt.
- Vocabulary is the top 15k of `words.recall.txt`. The 9k calibrated value was run as a sensitivity check; the results are within noise.
- Depletion: after the easiest remaining candidate passes rank 3000, recall slows by 500 ms per doubling of its rank.
- Typos: 4% of submissions, each costing 900 ms. A reject keeps the input.
- Aim: 0.5 (the frenzy-sim median value). FUSE aims at a still-dark letter; CHAIN aims at a fresh end letter.

**Runs.** Each sim ran 50 seeded games, which are the headline numbers. Each also ran 1000 games for stable percentages (`*-1000.*`). Fixes were re-measured by loading patched engine copies through `FUSE_JS=` / `CHAIN_JS=` (`*.probe-*.js` in this directory); `src` was not touched.

---

## FUSE

### F1. FRENZY stalls on z / j / x / q: steering serves fragments that don't lead there (most frequent × worst)
**Evidence**
- Only 30% of runs reach FRENZY (50 games). At 1000 games it is 20.8%, which matches econ-oct2's 19.2%.
- 60% of runs (62.3% at 1000 games) die with 23–25 letters lit and no FRENZY. The mean peak is 24.0 lit.
- Dark letters at death in runs with ≥20 lit (1000 games): **z 566, j 377, q 341, x 341**. The next letter is k at 76. In the 50-game set, z was still dark in 32 of 35 such runs.
- `fuse-diag.txt`: when steering serves a "lead" fragment for z, a random median-known answer lights z only 8.8% of the time. For j it is 3.6%, x 13.4%, q 18.5%. For k/v/w/y/b it is 52–73%.
  - Typical z leads are `io` (0 of 386 known words contain z), `ral` 0/67, `tal` 0/87.
  - j's best leads are `ct` (22/336) and `ad` (11/376).

**Root cause**
- `src/solo/fuse.js:149-156`: the "leads to" rule is a 3× lift over base rate, measured on the full 88k ACCEPT set. For z and j that lift comes from obscure `-ization` / `-ject` words that a median player never types.
- `fuse.js:169-173`: steering picks a random lead and does not prefer fragments that contain the letter.
- `fragmentPools.json`: j has no fragment in any pool, as `fuse.js:46` itself notes.

**Fix (minimal)**
1. `fuse.js:169-173`: before the lift-based leads, try the direct leads (`lead[t].filter(f => f.includes(ch))`) across the tier order. This is a 4-line patch; see `fuse.probe-direct.js`.
2. Data: add `jo ju` to the `m` pool in `fragmentPools.json`. Median players know plenty of words for these (job, join, major, enjoy, just, judge, injury).

**Measured (1000 games)**

| Change | FRENZY reached | Died at 23–25 lit | Frenzy at word | Words per run | Expire % |
|---|---|---|---|---|---|
| Main (no fix) | 20.8% | 62% | 18 | 18 | 11.0% |
| Fix 1 (direct leads) | **58.3%** | 35% | 16 | 18→19 | 11.0→12.1% |
| Fix 1 + Fix 2 | **73.9%** | 21% | 15 (91 s) | 19 | 12.5% |
| Fix 2 alone | 23.5% | | | | |

- Fix 2 does almost nothing on its own, because steering never prefers the new fragment. Fix 1 is the lever.
- If 74% is too generous for a ×5-wins event, ship Fix 1 alone, or keep both and raise `STEER_FROM` from 19 to 21.

**Re-measure**
```
GAMES=1000 FUSE_JS=<abs>/fuse.probe-direct.js POOL_ADD="m:jo,ju" node claude/batch-a/ba1/fuse-sim.mjs
```
After shipping, plain `GAMES=1000 node …/fuse-sim.mjs`. Check `frenzyRunPct` and `darkLetterAtDeath_whenLit20plus`.

### F2. The same fragment is served twice in one run (steering's no-repeat filter is a no-op)
**Evidence**
- 36% of runs serve a repeated fragment (50 games; 34.2% at 1000 games). That is 0.44 repeats per ~20-turn run.
- Examples: `mu`, `iti` (served three times), `lly`, `ia`.
- With steering off (`STEERP=0`), repeats drop to **0.1%**, so steering causes all of them.

**Root cause:** `src/solo/fuse.js:171`. The filter `!state.used.has(f)` tests a fragment against the set of used words, so it never excludes anything. Steering also bypasses the no-repeat bag (`fuse.js:63-81`, `fuse.js:182`). The 405 fragments that appear in more than one tier add a small remainder.

**Fix:** add `servedFrags: new Set()` to the state, add each fragment in `serve()`, and test `!state.servedFrags.has(f)` at line 171. See `fuse.probe-norepeat.js`.

**Measured:** repeats drop from 34.2% to **3.6%** of runs. FRENZY is 20.8% → 23.1% and nothing else changes. This is a bug fix, not a retune.

**Re-measure:** `GAMES=1000 FUSE_JS=<abs>/fuse.probe-norepeat.js node …/fuse-sim.mjs` and check `runsWithRepeatFragment`.

### F3. Difficulty cliff: about a minute with no tension, then death within ~8 words
**Evidence (1000 games, expire rate per turn by words solved × tier)**

| Words solved | Expire rate |
|---|---|
| 0–9 | **0–1.2%** (0 of 5,002 turns at words 0–4) |
| 10–14 | 8–12% |
| 15–19 | 24% (h) / 33% (m) |
| 20–24 | 42% (h) / 51% (m) |

- Runs end at 14–23 words (p10–p90), at 96–147 s.
- The brutal tier (`b`, ×1.3) is almost never served: 1 of 1,021 turns in the 50-game set. Runs die before `selectTier` (`fuse.js:33-37`) reaches it.

**Root cause:** `src/solo/fuse.js:13-15`, `fuseBase(w) = 3500 + 9000·e^(−w/15)`.
- At words 0–9 the fuse is 12.5 s down to 9.2 s, against a median need of about 6 s.
- It reaches the 3.5 s floor, which is below the median need, so the end is a cliff.

**Fix (constant):** `fuseBase = 4200 + 6000·e^(−w/18)`. See `fuse.probe-direct-curve.js`, which stacks it on F1's fix.

**Measured**
- Early expire rate: 0.4–5%.
- At words 20–29: 34–39% instead of 42–63%.
- Median run is still 18 words, and the spread widens (p10–p90 12–25).

**Caution:** `fuse.js:4-7` says these constants were adversarially fitted. Re-run the shortest-word-bot attack (`lenFactor`) before shipping. This is the lowest-priority of the three.

**Re-measure:** `GAMES=1000 FUSE_JS=<abs>/fuse.probe-direct-curve.js node …/fuse-sim.mjs` and check `hazardByWordsTier`.

**Non-issues measured**
- Dead turns (no known answer): **0%**.
- Thin turns (fewer than 3 known answers): 0%.
- Runs under 30 s: 0%.
- Static audit: no pool fragment has fewer than 3 median-known words.

---

## CHAIN

### C1. Heat kills normal play on E and S, the most common English endings (most frequent × worst)
**Evidence**
- 34% of deaths (50 games; 28.6% at 1000 games) happen on a heated letter, meaning `heatMul < 0.85` (≥3 prior endings on that letter).
- E is **20.2% of deaths but only 13.2% of landings** (1.53×).
- For a player who ignores end letters (`AIM=0`), **61% of deaths** are on a heated letter.
- Deaths happen at a 6.5 s budget (p50) against a median need of about 6.5 s. Heat's 12–18% cut is what tips the turn.

**Root cause**
- `src/solo/chain.js:58-60`: `heatMul = 1 − min(0.95, 0.06·endCount)`, with "no grace period". It is applied at `chain.js:130-132`.
- A non-exploiting player naturally ends on e or s 3–4 times in a 16-word run.

**Fix (constant):** add a grace of 2: `0.06·Math.max(0, endCount − 2)`. See `chain.probe-grace2.js`.

**Measured (1000 games)**
- Hot-letter deaths drop from 28.6% to **2.5%**.
- Median run goes from 16 to 18 words.
- For `AIM=0` players, hot-letter deaths go from 61% to 22%.
- The plural-pump exploit stays closed. A bot that always ends on s (`AIM=pump`) dies at **9 words** (8 on main), half of natural play.

**Re-measure**
```
GAMES=1000 CHAIN_JS=<abs>/chain.probe-grace2.js node …/chain-sim.mjs
GAMES=1000 AIM=pump CHAIN_JS=… node …/chain-sim.mjs   (exploit check)
```

### C2. The multiplier collapses mid-run: one repeated end letter resets it to ×1.0
**Evidence (1000 games)**

| Words linked (k) | Words at base ×1.0 | Words at cap ×2.5 |
|---|---|---|
| 5–9 | 26% | 30% |
| 10–14 | **39%** | 9% |
| 15+ | **46%** | 4% |

The advertised multiplier (`ChainGame.jsx:307`) mostly resets in the second half of a run. Only ~8 end letters are common, so a fresh one runs out quickly. Typo rejects also reset it (`chain.js:166`).

**Root cause:** `src/solo/chain.js:174-176`. A non-fresh end letter does `state.multiplier = CHAIN_MULT_BASE`, a full reset.

**Fix:** decay one step instead: `Math.max(CHAIN_MULT_BASE, state.multiplier − CHAIN_MULT_STEP)`. See `chain.probe-multdecay.js`.

**Measured:** at k 10–14, words at base drop from 39% to **0.6%** and words at the cap rise from 9% to 46%. Median score rises from 1263 to 1677 (+33%). The multiplier only feeds score and personal best (`ChainGame.jsx:86`), not wins, so this has no economy impact.

**Re-measure:** `GAMES=1000 CHAIN_JS=<abs>/chain.probe-multdecay.js node …/chain-sim.mjs` and check `multiplierByK`.

### C3. No tension for the first 10 links, then a fixed-length treadmill
**Evidence (1000 games)**
- At k < 10, **0 of 10,000 turns timed out**.
- Hazard then climbs: 6.8% at k 10–14, 29% at k 15–19, 46% at k 20+.
- Every run ends at 13–19 words (p10–p90, 71–105 s), so personal-best runs feel like reruns.

**Root cause**
- `src/solo/chain.js:50-52`: `chainT(k) = 4500 + 13500·e^(−k/10)`. That is 18 s for word 1, even though the clock is already armed-on-type, and 12.7 s at k=5.
- The 4.5 s floor (`chain.js:46`) is below the median need of about 5.9 s, so a cliff is guaranteed.

**Fix (constant, pair it with C1):** `chainT = 4500 + 6500·e^(−k/16)`. That gives 11 s at k=0, 9.3 s at k=5 and 6.4 s at k=20. See `chain.probe-grace2-curve.js`.

**Measured with grace2**
- Median run is 15 words (main: 16), and p10–p90 widens to 11–20.
- Late hazard softens to 23% / 39% instead of 29% / 46%.
- The pump bot dies at 7 words.
- Early hazard is only 0.6%. Real early tension would need a lower curve, which is a design call. This is the lowest-priority of the three.

**Re-measure:** `GAMES=1000 CHAIN_JS=<abs>/chain.probe-grace2-curve.js node …/chain-sim.mjs` and check `hazardByK` and `wordsPerRun`.

**Dead-end letters (x, q, z, j, k, y) are NOT an unfun moment (measured)**
- **0 of 1000 runs died on x, q, z or j.** k accounts for 3.7% of deaths and y for 5.1%, both roughly proportional to how often the chain lands there.
- The dead-end reroute (`chain.js:189-195`, `DEAD_END_BELOW=3` against the top 3000) fires 0.03 times per run.
- No landing left the median with fewer than 30 known unused starters (thin landings: 0%), and scarce turns were 0%.
- Every death was a plain clock death, never a no-words death. Of the ~1000 deaths, 0% were flagged dead end.
- No run died in its first 15 s of clock, and none ended under 5 words.

## Files
- `chain-sim.mjs` and `fuse-sim.mjs` are the sims. `solo-common.mjs` holds the shared loader and human model. `fuse-diag.mjs` / `fuse-diag.txt` contain the steering lead audit.
- `chain-sim.txt` / `.json` and `fuse-sim.txt` / `.json` are the 50-game runs. `*-1000*` are the 1000-game runs, and `*-v9k` is the vocabulary sensitivity run.
- `*-probe-*` are the fix re-measurements. `chain.probe-*.js` and `fuse.probe-*.js` are patched engine copies (src is untouched).
