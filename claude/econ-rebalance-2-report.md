# JOB — economy rebalance, SHIPPED as a coupled change (sim/rebalance-2)

Branch `sim/rebalance-2` off `main` (`d6c9fd6`). This SHIPS the mode-multiplier flatten the earlier
`sim/rebalance` only diagnosed — coupled with a proportional cost cut so time-to-first-upgrade holds
flat. All numbers measured from the live sims on the actual repo (SAT deck 612), not the earlier
report's figures.

## 0. Reconciling the 2.93× / SAT-lowest claim — it does NOT reproduce here

The proposed set was flagged as measuring 2.93× spread with SAT the lowest payer. On this repo it does
not: live `winsmin-sim.mjs` gives **1.43×** with SAT at 422 wins/min (2nd-highest). The 2.93×/SAT-168
figures are self-consistent only with a SAT mean rarity ≈ 1.4 (a mostly-COMMON deck); the actual SAT
deck is **55.2% OBSCURE · 30.7% RARE · 14.1% UNCOMMON · 0% COMMON** (mean rarity 3.49). Ruled out deck
size (612→SAT 419, 956→SAT 411). Word Bomb's ×2 is confirmed applying (WB 196→393). Decision
(user-confirmed): **proceed on the live sim.**

## 1. WINS_MULT flatten — spread 37.7× → 1.43× (target ≤ 2× ✓)

`WINS_MULT = { wordBomb: 2, blitz: 1, satRush: 0.5, chain: 1.9, fuse: 1 }` (was `{satRush:2, chain:10,
fuse:15}`). `WORD_WINS_MULT` (card preview, game.id keys) updated to match.

**CHAIN raised ×1.5 → ×1.9** so the LV20-gated mode out-earns the ungated WB/Blitz — a gated mode
paying less than an ungated one inverts the unlock ladder. It now sits between SAT and Fuse.

| mode | wins/min (old) | wins/min (new) | ×lowest (new) | gate |
|------|----------------|----------------|---------------|------|
| blitz     | 344  | 344 | 1.00× | ungated |
| wordBomb  | 196  | 393 | 1.14× | ungated |
| satRush   | 1686 | 422 | 1.22× | ungated |
| **chain** | 2403 | **457** | 1.33× | **LV20** |
| fuse      | 7400 | 493 | 1.43× | LV25 |

**SPREAD 1.43× ✓** (was 37.7×). Unlock ladder intact: CHAIN (457, LV20) > every ungated mode; FUSE
(493, LV25) is the top. Degenerate short-common spam stays 1.14× honest (unchanged).

## 2. Cost coupling — KEY POWER + WORD SENSE scaled to hold time-to-first-upgrade flat

Mean wins/min dropped **2406 → 421.8** (factor **0.175**). Every `KEY_TIERS` cost scaled to that,
regenerated as a clean ×6 ladder from `round10(500 × 0.175) = 90` — a **uniform ×0.18** across all
tiers. WORD SENSE reads `keyTierCostAt`, so it scales in lockstep. XP effect values UNCHANGED.
(The CHAIN raise lifted the mean 402→422, >4% — so the cost factor was re-derived: T1 80→90.)

| tier | XP/letter | cost (old) | cost (new) |
|------|-----------|-----------|-----------|
| T1 | 25     | 500         | 90         |
| T2 | 60     | 3,000       | 540        |
| T3 | 150    | 18,000      | 3,240      |
| T4 | 375    | 108,000     | 19,440     |
| T5 | 940    | 648,000     | 116,640    |
| T6 | 2,350  | 3,888,000   | 699,840    |
| T7 | 5,875  | 23,328,000  | 4,199,040  |
| T8 | 14,690 | 139,968,000 | 25,194,240 |

**Time-to-first-upgrade (min to afford T1):**

| player | old (500/wpm) | new (90/wpm) | Δ |
|--------|---------------|--------------|---|
| **MEAN player** | **0.208 m** | **0.213 m** | **+2.7% ✓ within 20%** |
| wordBomb main | 2.551 m | 0.229 m | −91% |
| blitz main | 1.453 m | 0.262 m | −82% |
| satRush main | 0.297 m | 0.213 m | −28% |
| chain main | 0.208 m | 0.197 m | −5% |
| fuse grinder | 0.068 m | 0.183 m | +170% |

The **mean/typical player is within 20%** (the coupling target). Per-mode necessarily diverges — the
point of compressing a 37× spread: Word Bomb and Blitz (underpaid before) reach the first upgrade far
faster, Fuse (overpaid) slower. Every mode is still under ~16 s in absolute terms.

## 3. 200-hour archetype dead stretch (post-rebalance earn + scaled costs)

`archetype200h-sim.mjs`, updated to the new wins/min and reading the scaled `KEY_TIERS`:

| archetype | reaches | longest dead stretch |
|-----------|---------|----------------------|
| Word Bomb main | T6 | 164.4 h |
| Blitz main | T6 | 159.3 h |
| SAT Rush main | T7 | **165.8 h (toward T7)** |
| Chain main | T7 | 153.1 h |
| Fuse grinder | T7 | 142.0 h |

**Longest dead stretch: 165.8 h (SAT Rush main → T7)** — essentially unchanged from the pre-rebalance
162.3 h. The coupled cost cut held pacing flat despite the earn-rate compression. This ~162–166 h wall
is the target of the separate `sim/dead-stretch` report (recommendation there: a repeatable sink →
~9 h).

## 4. Shipped on this branch
- `src/progress/wins.js` — `WINS_MULT` + `WORD_WINS_MULT` flattened (CHAIN ×1.9); comments updated.
- `src/progress/xp.js` — `KEY_TIERS` costs ×0.18 (XP effects unchanged; ×6 ladder + past-T8 extension intact).
- Tests retuned to the new truth (403 unit + affected e2e): `wins.test.js`, `xp.test.js`,
  `shop.test.js`, `wordSense.test.js`, `combo.test.js`; `e2e/word-bomb-scoring.spec.js` (WB 70→140,
  130→260), `e2e/rarity-race.spec.js` (70→140, 60→120), `e2e/purchase-feel-shop.spec.js` (T1-gap seed
  vs the new 90 cost), `e2e/wins.spec.js` (blitz test hardened to poll — a pre-existing async-bank flake).
- Tools (untracked, per convention): `winsmin-sim.mjs`, `archetype200h-sim.mjs` (earn rates updated).
