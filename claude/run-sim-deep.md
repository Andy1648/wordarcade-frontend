# RUN MODE — deep draft simulation

**Branch:** `chore/run-sim-deep` (based on `origin/feat/run-wall`, the newest branch that
carries the full run engine + the ANTE WALL; `origin/feat/endgame`, named in the task, does
NOT contain `src/runMode/` at all — the run stack was never merged into it).
**Harness:** `claude/run-sim-deep.mjs` — headless, deterministic, seedable. Reuses the SHIPPED
pure engine (`src/runMode/engine.js`) for every bit of scoring / wall / modifier / draft math.
**Report-only. No production code changed.**

## How the run works (from the engine, read thoroughly)

- 10 rounds. Each round you must beat a **per-round** wall (NOT cumulative):
  `passed = roundScore >= wallAt(round) && !fumbled`. Miss it once → run over.
- Wall schedule: `225, 293, 380, 494, 643, 1157, 2082, 3748, 6746, 12143`
  (`W0=225, g1=1.3` to the knee at round 5, then `g2=1.8`/round — an ~1.8× exponential from
  round 6 on: **19× harder over the last five rounds**).
- Between rounds you're dealt **3 distinct un-owned modifiers** (`dealOffers`) and keep 1.
  18 modifiers total; 15 are two-sided (`down:true`), 3 are pure upside
  (`deep-pockets`, `scrabble-bag`, `momentum`).
- Scoring reuses the shipped rarity × combo × lucky maths; round-level mods
  (`applyRoundMods`) and sudden-death (`GLASS CANNON` 8%/round) apply at round end.

### Player-skill model (identical across all four strategies)
The engine's `simulateRoundPayout` assumes all 16 words land perfectly — that's the regime the
wall was calibrated to (34.5% greedy win rate). A real 30s round lands fewer words with some
misses (a miss resets the combo, exactly as `useRunMode`'s `fail`). The harness models this as
`~20 attempts/round, 93% accuracy` for the headline, generating each accepted word exactly as
the engine does. **The only variable between strategies is which modifier gets drafted** —
same seed, same player, same word stream (common random numbers).

### Two round models
- **LIVE** — mirrors what `useRunMode.js` *actually* applies at run time (headline model).
- **DESIGNED** — honours every engine knob the way `engine.js` intends.
They differ because three modifier knobs are **inert in the shipped live path** (see the
Live-play bugs section). Both models give the *same verdict*; numbers below are LIVE unless noted.

---

## 1. Win rate per strategy (headline: N=50 each, seed 20260906, skill 20/0.93)

| strategy | wins / 50 | win rate | mean round reached |
|---|---|---|---|
| **GREEDY** | 11 / 50 | **22.0%** | 6.20 |
| BALANCED | 2 / 50 | 4.0% | 5.30 |
| RISK-AVERSE | 0 / 50 | 0.0% | 4.16 |
| RANDOM | 0 / 50 | 0.0% | 3.82 |

Confirmed stable at **N=2000/strategy**: GREEDY **20.6%**, BALANCED **5.5%**,
RISK-AVERSE **0.0%** (0 of 2000), RANDOM **0.3%**.

Robust across the whole skill sweep (LIVE, N=2000) — GREEDY always wins by 3–5× over the next
strategy, RISK-AVERSE stays ≈0 everywhere:

| skill (attempts/acc) | GREEDY | BALANCED | RISK-AVERSE | RANDOM |
|---|---|---|---|---|
| 18 / 0.90 | 9.5% | 1.8% | 0.0% | 0.1% |
| 20 / 0.93 | 20.6% | 5.5% | 0.0% | 0.3% |
| 22 / 0.95 | 31.3% | 9.9% | 0.1% | 1.1% |
| 24 / 0.97 | 41.4% | 17.4% | 0.5% | 1.8% |

DESIGNED model (N=2000, 20/0.93) tells the same story: GREEDY 15.8%, BALANCED 6.7%,
RISK-AVERSE 1.0%, RANDOM 0.5%.

## 2. Death-round histogram (pooled, LIVE, 8000 runs = 4 strategies × 2000)

```
round:   1    2    3    4    5    6    7    8    9   10   cleared
count: 864 1118 1116  887  577  762  735  623  445  344    529
```
**Most runs die on ROUND 2** (1118), with rounds 1–4 accounting for ~50% of all deaths.
Round 1 is always the empty-stack round (draft hasn't happened yet), so those 864 deaths are
strategy-independent. From round 6 the deaths are driven by the wall's ~1.8×/round explosion
and by GLASS CANNON sudden-death fumbles (**873 pooled fumbles** — an unavoidable tax on the
mandatory build, see §4). Per strategy, RANDOM/RISK-AVERSE deaths cluster at rounds 2–4;
GREEDY's deaths spread out to rounds 8–10 because it actually reaches the endgame.

## 3. Modifier pick frequency (pooled, LIVE, 8000 runs)

**Most picked:** `common-folk` (2880), `momentum` (2678), `scrabble-bag` (2633),
`combo-king` (2630), `deep-pockets` (2464).

**Least picked (effective dead weight):**
`hot-streak` (935), `uncapped` (893), `long-haul` (892), `rare-breed` (584),
**`lexicographer` (338 — the floor)**.

**NEVER picked: none.** No modifier is literally never taken, because RANDOM picks uniformly
and `dealOffers` sometimes forces a bad card as the only new option. But RANDOM alone would
give every modifier a roughly equal share; the bottom five sit *far* below that, i.e. the three
optimizing strategies avoid them almost entirely. `lexicographer` (RARE+ ×3 but
COMMON/UNCOMMON → **0**) is chosen essentially only when forced — it zeroes ~90% of a typical
word stream, so it's a trap card, not a choice.

## 4. Dominance — is any modifier / pair over-represented in winners?

**Yes, overwhelmingly.** Over 529 winning runs (LIVE, N=2000 each):

| modifier | in winners | in all runs | lift |
|---|---|---|---|
| **momentum** | **100.0%** | 33.5% | 2.99× |
| **glass-cannon** | **98.7%** | 28.7% | 3.44× |
| double-vowels | 84.3% | 30.1% | 2.80× |
| short-fuse | 83.9% | 22.1% | 3.80× |
| common-folk | 81.7% | 36.0% | 2.27× |

**Dominant pair:** `glass-cannon + momentum` appears in **98.7% of winning runs** (5.54× lift).
**Essentially every win runs MOMENTUM, and almost every win runs GLASS CANNON.**

Why: the wall is a ~1.8×/round exponential (12143 by round 10), so only **multiplicative,
compounding** modifiers keep pace. MOMENTUM (`×(1 + 0.5·cleanRounds)` → up to ×5.5 by round 10)
and GLASS CANNON (`×2.5` flat) are the two biggest cheap multipliers in the pool, and MOMENTUM
carries **no downside at all**. Flat/defensive modifiers can't scale: `deep-pockets`'s +150 is
a rounding error against a 12143 wall. That is exactly why **RISK-AVERSE wins 0/2000** — by
refusing the sudden-death gamble and preferring flat safety, it mathematically cannot clear the
back half of the wall.

---

## VERDICT — is drafting a real decision?

**No. One line strictly wins, and the draft is effectively solved.**

- **A strategy strictly dominates:** GREEDY (grab the highest-EV = most multiplicative card
  every time) beats every other strategy by 3–5× at *every* skill level, and beats
  RISK-AVERSE/RANDOM by ∞ (they win ~0%). There is no skill regime where a safer or balanced
  draft is competitive.
- **The winning draft collapses to a forced core:** MOMENTUM (100% of winners) + GLASS CANNON
  (98.7%). Take those two plus any multiplicative filler and you have the only viable build.
  That's the opposite of an interesting draft — there's a dominant line and no real trade-off.
- **~1/3 of the pool is dead weight** (`lexicographer`, `rare-breed`, `long-haul`, `uncapped`,
  `hot-streak`), never worth taking over the multiplicative staples.

### Specific balance changes that would fix it (with numbers)

1. **MOMENTUM is a no-downside auto-include — give it a real cost or cap it.** It's currently
   pure-upside (`down:false`) and reaches ×5.5 by round 10, roughly *half* the winning
   multiplier from one card. Fix: either **cap the running mult at ×2.5** (`min(2.5, 1+0.5·clean)`)
   or make it two-sided like SNOWBALL — e.g. **+0.4×/clean but ×0.7 the round you draft it**.
   This alone breaks the "always take MOMENTUM" auto-pick.

2. **GLASS CANNON is mandatory *and* a coin-flip — decouple those.** It's in 98.7% of winners
   yet its 8%/round sudden death is why the ceiling win rate stalls near 20% (873 fumbles/8000
   runs; ~34% chance of a run-ending fumble over the last 5 rounds even in a winning build).
   Fix: **drop the multiplier to ×2.0** (so it's no longer the single best ceiling option) OR
   **add a competing *safe* multiplier** (e.g. a `high-roller`: `×1.8 all payouts`, `down:false`)
   so the draft has a real "safe ceiling vs risky ceiling" choice instead of one forced card.

3. **Flatten the wall's post-knee growth so defensive/flat lines stay viable.** `g2=1.8` makes
   rounds 6–10 (`1157→12143`) a multiplicative-or-die gauntlet, which is what zeroes RISK-AVERSE.
   **Lower `g2` to ~1.5** (`WALL.g2`), giving rounds 6–10 ≈ `965/1447/2171/3256/4885` — steep
   but clearable with broad/flat stacks, so a non-greedy draft becomes competitive. And/or make
   `deep-pockets` scale (`+150 → +150·round`) so a flat line isn't dead by round 6.

4. **Fix the three live-play knob bugs so the two-sided downsides actually bite** (they make the
   game *more* greedy-friendly than designed):
   - `useRunMode.js` passes `ctx = { owned: 0, clean }` → **SNOWBALL's ramp is dead** (always
     ×0.7, i.e. pure downside live).
   - `wprMul` is never read in the live round → **SHORT FUSE's "20% fewer words" downside is
     dead** (pure ×1.5 upside live — that's why it's in 83.9% of winners).
   - the live lucky oracle is fixed at 1/40 (`knobs.luckyOdds` ignored) → **LUCKY CHARM's
     upside is dead (pure ×0.9 downside live) and JACKPOT's downside is dead (pure ×8 upside).**
   These are pure logic divergences between the calibrated engine and the shipped hook; fixing
   them restores four modifiers' intended trade-offs at zero design cost.

## Reproduce

```
node claude/run-sim-deep.mjs                    # 50/strategy, LIVE, seed 20260906 (headline)
node claude/run-sim-deep.mjs 2000               # 2000/strategy (stable secondary stats)
node claude/run-sim-deep.mjs 2000 designed      # DESIGNED round model
node claude/run-sim-deep.mjs 2000 live 20260906 24 0.97   # custom seed + skill sweep
```
