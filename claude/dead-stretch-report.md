# JOB — the 162-hour dead stretch (sim/dead-stretch, REPORT ONLY — nothing applied)

Branch `sim/dead-stretch` off `main`. Analysis of the retention problem: the longest span a player
goes with **nothing new to buy**. All numbers from `claude/deadstretch-sim.mjs` against main's live
economy (KEY_TIERS ×6 ladder, pre-rebalance earn rates). **No source changed.**

## The problem and its cause

The only deep wins sink is the KEY POWER tier ladder (WORD SENSE mirrors it at the same ×6 cadence,
so it doesn't add reward *events* — it competes for the same wins on the same schedule). Past T4 every
tier costs **×6 the previous** (T5 648K → T6 3.9M → T7 23.3M → T8 140M wins). At 200–7400 wins/min
each of those steps is a **100+ h grind for a single reward event**.

**Baseline longest dead stretch: 161.6 h** (SAT Rush main, grinding toward T7). It is set by the
T6→T7→T8 table prices, which sit *below* where TIER_COST_STEP even begins — so the earlier
`sim/rebalance` step-tuning (×6→×5 past T8) does nothing for it, and the `sim/rebalance-2` cost cut
keeps it ~flat (165 h) because it scales earn and cost together. This wall is structural, not a tuning
artifact.

## Options measured (longest dead stretch, worst archetype over 200 h)

| option | longest dead stretch | vs baseline | note |
|--------|---------------------|-------------|------|
| **Baseline** (×6 ladder) | **161.6 h** | — | one reward event per ×6 tier |
| B) Cheaper late tiers (×6→×3 past T4) | 121.3 h | −25% | weakest — and pulls the endgame wall *inward* |
| A) More tiers (ratio √6 ≈ 2.45 past T4) | 111.5 h | −31% | +4 tiers to reach the T8-equivalent |
| A) More tiers (ratio 1.7 past T4) | 73.7 h | −54% | ~8 extra tiers |
| C) New parallel sink (×1.6 track) | 63.9 h | −60% | always-something-to-buy, but tapers |
| D) Content unlocks (playtime cadence K) | = K h | tunable | a free reward every K h; needs a content pipeline |
| **C-BEST) Repeatable sink (×1.05, 200 buys)** | **9.4 h** | **−94% (17×)** | **RECOMMENDED** |

## Recommendation — a REPEATABLE sink (the top option, with numbers)

The single change that shortens the dead stretch **most** is not touching the tier ladder at all — it
is adding **one repeatable "buy another unit" upgrade** whose price rises *gently*, so the next
purchase is always minutes-to-hours away and it **never runs out**. This is the classic idle-game
answer to "nothing to buy," and it dominates every ladder-tuning option:

**Concrete spec (what the sim modeled):**
- One repeatable purchase, base price **5,000 wins**, rising **×1.05 per buy**, ~**200 purchases**
  available (cumulative ~90M wins — comfortably inside a 200 h whale's reach).
- Each buy grants a small **stacking** benefit so it's a real reward, not busywork — e.g. **+1% wins**
  or **+1% XP per purchase** (a "MOMENTUM"/"INTEREST" track), or a cosmetic-progress tick.
- **Result: worst-case dead stretch 161.6 h → 9.4 h (a 17× reduction)**, and it holds for *every*
  earner from Word Bomb (196 wins/min) to Fuse (7400 wins/min) — the fast earners that suffer the
  worst top-end wall get a purchase every few hours instead of every ~160 h.

**Why it beats the alternatives:**
- **Cheaper late tiers (B)** is the weakest (−25%) AND it drags the endgame wall inward — players hit
  "maxed, nothing left" sooner. Avoid.
- **More tiers (A)** helps (−31% to −54%) but you're still gating on ×-multiple tier costs, so the top
  gaps stay large; it also inflates the KEY POWER UI with many near-identical rows.
- **A parallel ×6-style sink (C)** only reaches −60% because it tapers — its own tiers eventually get
  expensive too.
- **Content unlocks (D)** can hit any target (a new category every K h → longest gap K h) and are the
  best *complement*, but they need a real content pipeline to sustain 200 h; the repeatable sink is
  procedural and ships once.

**Suggested pairing (not required):** repeatable sink as the floor (caps the gap at ~9 h) + a light
content-unlock cadence (D) every ~20 h for variety. Cheaper late tiers (B) is the one option to skip.

## Reproduce
`node claude/deadstretch-sim.mjs` (untracked tool). Nothing in `src/` was modified on this branch —
this is analysis only, per the instruction.
