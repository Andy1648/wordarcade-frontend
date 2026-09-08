# RUN MODE — rebalance (fix/run-balance)

**Branch:** `fix/run-balance` (based on `origin/fix/run-deck`, the branch that FIXED the modifier
bugs — SNOWBALL/MOMENTUM read `clean`, `wprMul`/`luckyOdds` honoured live, RARE BREED ×6, dominated
caps made reachable). This branch REBALANCES that corrected deck.
**Harness:** `claude/run-balance.mjs` — the `chore/run-sim-deep` sim, brought into this branch and
made faithful to the fixed hook (its old LIVE model faked the now-fixed bugs; it now honours every
engine knob, so LIVE == DESIGNED). Deterministic, seedable, reuses the pure `src/runMode/engine.js`.
**Report-only file; the shipped change is `src/runMode/engine.js` (+ its two test files).**

## The three targets (all must hold, confirmed at N=2000)
1. No single strategy wins >35%.
2. No single modifier appears in >60% of winning runs.
3. At least two strategies within 10 points of each other.
Plus sanity: the best strategy's win rate stays a real challenge (~15–45%).

Reproduce: `node claude/run-balance.mjs 2000` (2000/strategy) — the report ends with a `TARGETS` block.

---

## BASELINE — the corrected deck BEFORE this rebalance

The fix/run-deck modifier-bug fixes ALREADY solved the *strategy-spread* half of the original
problem (the old broken deck was GREEDY 22% / BALANCED 4% / RISK-AVERSE ~0% / RANDOM ~0%). On the
corrected deck, faithful model, **N=500**:

| strategy | win rate |
|---|---|
| GREEDY | 32.0% |
| BALANCED | 23.8% |
| RISK-AVERSE | 15.4% |
| RANDOM | 2.6% |

- T1 PASS (32.0 ≤ 35), T3 PASS (GREEDY/BALANCED 8.2 pts), sanity PASS.
- **T2 FAIL** — winners were still a compounding-multiplier lookup: **momentum 98.6%**, snowball
  95.7%, common-folk 76.2%, double-vowels 67.8%, glass-cannon 65.9%, scrabble-bag 63.7% (six cards
  in >60% of winners).

**Diagnosis.** Two coupled causes:
1. **The ANTE WALL was a ~1.8×/round exponential** (`g2=1.8`, 12143 by round 10). Only
   *compounding* round-multipliers keep pace, so every winner was forced to run MOMENTUM + SNOWBALL
   + GLASS CANNON. This is the real lever the task flagged.
2. **The card power-curve was steep.** A full clear drafts 9 of 18 cards, so the average card sits
   in ~50% of winners; a card only exceeds 60% if a strategy takes it *whenever offered* — i.e. it's
   a runaway best. Three cards towered (glass-cannon EV 2.5, snowball 2.2, momentum 2.16) and ~5
   were dead weight (≤1.0), so winners concentrated on the same top ~8.

Corollary found empirically: **low win rate → high dominance** (only the best-stacked runs survive,
so winners look uniform). T2 therefore needs BOTH a flat wall (so many build types clear) AND a flat
power curve (so greedy's picks vary) AND a healthy winner pool (~30%).

---

## Iteration log (each change → sim result)

Win% is the best strategy; "top" is the highest single-modifier share of winners.

| # | change | best win% | top modifier | #cards >60% |
|---|---|---|---|---|
| baseline | corrected deck | GREEDY 32.0 | momentum 98.6% | 6 |
| 1 | wall `g2` 1.8→1.45 only (diagnostic) | 38.4 | momentum 95.1% | 5 |
| 2 | cap+two-side MOMENTUM/SNOWBALL, `g2`=1.55 | 25.8 | momentum 96.9% | 7 |
| 3 | pull the 3 towers into the pack + buff 5 dead cards, `g2`=1.55 | 11.6 | glass 93.7% | 5 |
| 4 | same, `g2`=1.45 | 10.6 | momentum 97.0% | 6 |
| 5 | flatten wall hard `g2`=1.3 | 18.8 | momentum 94.8% | 6 |
| 6 | cap MOMENTUM ×1.5 / SNOWBALL ×1.4 | 11.6 | glass 93.7% | 5 |
| 7 | ease wall `g2`=1.2 | 18.4 | momentum 85.0% | 6 |
| 8 | wall `g1`=1.25 `g2`=1.13 (3-way strategy tie ~30%) | 32.8 | momentum 81.7% | 6 |
| 9 | re-rate META safety for redesigned cards | 30.6 | common-folk 75.2% | 7 |
| 10 | nerf broad cards (common-folk/deep-pockets/glass), buff mid | 18.2 (survivorship) | snowball 77.1% | 6 |
| 11 | buff bottom + shrink compounders, `g1`=1.2 `g2`=1.08 | 34.3 | momentum 71.8% | 7 |
| 12 | nerf current tops (double-vowels/combo-king/glass) | 31.2 | snowball 61.8% | 1 |
| 13 | **buff the 3 dead cards** (rare-breed/lexicographer/long-haul) | 33.8 | snowball 61.8% | 1 |
| 14 | shave snowball/deep-pockets/momentum/combo-king/scrabble | 27.4 | **snowball 58.2%** | **0** |

The decisive moves: (a) **flatten the wall's late growth** (`g2` 1.8→1.08) so non-compounding
builds clear the endgame; (b) **cap the compounders** (MOMENTUM, SNOWBALL) so they stop being the
only answer; (c) **buff the ~5 dead cards** so the *viable* pool is ~16 of 18 — with 9 picks that
pulls the top card from ~9/15 toward ~9/17, i.e. under 60%.

### What changed in `engine.js`

**Wall** — `WALL` now `{ W0:225, g1:1.2, g2:1.08, KNEE:5 }` (was `1.3 / 1.8`). Schedule:
`225, 270, 324, 389, 467, 504, 544, 588, 635, 686` (was …→12143). Late growth flattened; W0 is
pinned ~225 by the round-1 empty-stack round (raising it mass-kills round 1). Per-round death rates
are a healthy 10–16%, peaking mid-game (round 5) — not trivial anywhere.

**Modifiers** (all values retuned toward a flat EV band ~1.0–1.4×):
- MOMENTUM: `×(1+0.5·clean)` no-downside → **two-sided**, `×0.9` every word + `×min(1.35, 1+0.18·clean)`.
- SNOWBALL: capped `×min(1.25, 0.65+0.16·clean)` (was uncapped `0.7+0.3·clean`).
- GLASS CANNON: `×2.5` → `×1.55` (SD 8% kept) — no longer the runaway ceiling.
- COMMON FOLK `×1.8/0.6`→`×1.5/0.5`; DOUBLE VOWELS `×2/0.7`→`×1.8/0.72`; DEEP POCKETS `+150`→`+60`;
  SCRABBLE BAG `×3`→`×2.6`; COMBO KING back to `+0.2 / cap 2.4`.
- Dead-weight lifted into the viable band: LEXICOGRAPHER (no longer zeroes common; `×4.5 / ×0.72`),
  RARE BREED (`RARE ×3 & OBSCURE ×8 / COMMON ×0.85`), LONG HAUL (`+0.28/letter, ≤5 ×0.9`),
  BOOKWORM (`+0.55`), SHORT FUSE (`×1.7`), VOWEL MOVEMENT (`+0.4/vowel`), and the lucky trio
  LUCKY CHARM / JACKPOT / UNCAPPED (better odds/mult).

### Harness-only note (`run-balance.mjs`, not shipped)
The drafters' `META` safety/category ratings were re-rated to match the redesigned cards (they
described the pre-rebalance cards and would otherwise model cards that no longer exist). Key:
MOMENTUM 9→4 defense→offense (now a costed bet, not a safe floor); SNOWBALL 5→3; LEXICOGRAPHER 1→3.
This is sim fidelity, not a target change — the strategies must perceive the shipped cards.

---

## FINAL — N=2000/strategy (stable), all knobs honoured

Wall schedule: `225, 270, 324, 389, 467, 504, 544, 588, 635, 686`

| strategy | wins / 2000 | win rate |
|---|---|---|
| RANDOM | 549 | 27.5% |
| BALANCED | 532 | 26.6% |
| GREEDY | 516 | 25.8% |
| RISK-AVERSE | 391 | 19.6% |

**Modifier presence in the 1988 winning runs (top → bottom):**
snowball 58.2, scrabble-bag 55.4, rare-breed 55.0, short-fuse 55.0, deep-pockets 54.7,
double-vowels 54.5, combo-king 54.3, momentum 53.5, hot-streak 53.3, glass-cannon 52.7,
bookworm 51.7, common-folk 51.7, uncapped 49.5, jackpot 47.0, lucky-charm 46.7,
lexicographer 44.2, vowel-movement 43.3, long-haul 19.4.

### Targets — ALL THREE PASS
- **T1** — best strategy RANDOM **27.4% ≤ 35** ✅
- **T2** — top modifier **snowball 58.2% ≤ 60** ✅ (was momentum 98.6%; now a smooth 58→19 curve, no spike)
- **T3** — closest pair **BALANCED 26.6 & GREEDY 25.8 = 0.8 pts** ≤ 10 ✅
- Sanity — best 27.4% ∈ [15, 45] ✅

**Robustness** — confirmed at **N=2000 across 4 seeds** (default/12345/77/999) and in the DESIGNED
model: top modifier stayed **56.9–58.2%**, best strategy **26.4–27.4%**, closest pair ≤0.8pts —
ALL THREE PASS every time.

No single strategy dominates (the original failure was GREEDY winning by 3–5×; now all four are
within ~8 pts and naive-EV GREEDY is no longer strictly best, because it over-commits to the
GLASS CANNON gamble). No single modifier is an auto-include. Drafting is a real decision.

## Gate
- `node --test "src/**/*.test.js"` → **505 pass / 0 fail** (engine.test.js + modifiers.test.js
  pinned numbers updated for the deliberate balance changes; see those files' `fix/run-balance` comments).
- `npx eslint src` → **0 errors** (32 pre-existing warnings, none in touched files).
- `npx vite build` → **exit 0**.
