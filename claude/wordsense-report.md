# JOB 4 — MORE WINS SINKS: WORD SENSE (feat/wins-sinks)

Wins had two sinks (KEY POWER, themes). Added **WORD SENSE** — a second permanent upgrade track
bought with wins, parallel to KEY POWER, same tier shape (**effect ×2.5 / cost ×6**). It buys the
**wins multiplier per rarity tier**: it scales a word's rarity EXCESS (mult − 1), so **COMMON words
are never boosted** — the reward is strictly for vocabulary. Applied OUTSIDE the ×40 combined cap
(that cap governs rarity×combo×lucky; WORD SENSE is a separate layer). XP stays on the unboosted,
capped weight — WORD SENSE is wins-only, by spec.

## Tier table

| Tier | rarity-excess ×mult | OBSCURE(×4) word wins | RARE(×2.5) word wins | cost to reach |
|------|---------------------|-----------------------|----------------------|---------------|
| T0 | ×1.00 | ×1.0 | ×1.0 | 0 |
| T1 | ×2.50 | ×5.5 | ×3.3 | 500 |
| T2 | ×6.25 | ×16.8 | ×8.9 | 3,000 |
| T3 | ×15.63 | ×44.9 | ×22.9 | 18,000 |
| T4 | ×39.06 | ×115 | ×58 | 108,000 |
| T5 | ×97.66 | ×291 | ×146 | 648,000 |
| T6 | ×244 | ×730 | ×366 | 3,888,000 |
| T7 | ×610 | ×1,829 | ×915 | 23,328,000 |
| T8 | ×1,526 | ×4,576 | ×2,288 | 139,968,000 |

(Same ×6 cost ladder as KEY POWER, so the two tracks are genuine parallel sinks competing for wins.)

## Does a player run out of things to buy in the first 20 hours? — NO.
From `claude/wordsense-sim.mjs` (three transparent income scenarios, income doubling on a multi-hour
idle clock):

| Scenario | 20h wins earned | Both tracks maxable to | Next tier |
|----------|-----------------|------------------------|-----------|
| Casual   | ~556K   | ~T4 | both-to-T5 = 1.56M — **still unaffordable** |
| Regular  | ~3.27M  | ~T5 | both-to-T6 = 9.33M — **still unaffordable** |
| Hardcore | ~17.7M  | ~T6 | both-to-T7 = 56M — **still unaffordable** |

**Verdict:** the player never runs out. Both sinks grow ×6/tier while income doubles on a
multi-hour clock, so the next tier is always out of reach at hour 20 — and indefinitely beyond,
since WORD SENSE self-scales the target (rare words pay more → income rises, but the next tier rose
6× faster).

## Implementation
- `wordSense.js` — pure model + guarded store (`taw.wordsense`), survives rebirth. `wordSenseFactor`,
  `wordSenseWinsFactor(rarityMult)`, `wordSenseCost` (reuses KEY POWER's ×6 ladder).
- `shop.js buyWordSense()` mirrors `buyKeyPower()`.
- Wired into all 5 accept sites: the WINS weight = `cappedWeight × wordSenseWinsFactor(rarity.mult)`;
  the XP weight stays the unboosted capped value.
- Shop UI: a WORD SENSE section directly under KEY POWER (same card component).
- `wordSense.test.js` (5). Full suite 373 green. Shop section verified via screenshot.

## Flag for Job 8 (chain audit)
WORD SENSE massively amplifies wins for rare words at high tiers (T8 OBSCURE ×4,576). It is a huge
late-game wins multiplier that will dominate the wins economy for a vocabulary-strong player — this
is intended (it's the point of the sink) but the chain audit should note it as the dominant late
wins lever, compounding with rebirth + mastery + KEY POWER.
