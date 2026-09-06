# JOB B — economy rebalance (sim/rebalance)

## Part 1 — mode wins/min spread (diagnosis + solution; NOT shipped, see why)

Tool: `claude/winsmin-sim.mjs` (faithful — reuses rarity-sim's per-mode word models; CHAIN throughput
is DERIVED from the real engine's produce-time model; BOMB/BLITZ/SAT/FUSE throughput is explicit &
documented). wins/min = throughput(words/min) × mean rarity-weighted wins/word, at ×1 difficulty, R0.

**Baseline (current mults `{satRush:2, chain:10, fuse:15}`, WB/Blitz ×1):**

| mode      | words/min | wins/word | wins/min | ×lowest |
|-----------|-----------|-----------|----------|---------|
| Word Bomb | 8.0       | 24.5      | 196      | 1.00×   |
| Blitz     | 14.0      | 24.6      | 344      | 1.76×   |
| SAT Rush  | 12.0      | 140.5     | 1686     | 8.59×   |
| Chain     | 11.6      | 206.9     | 2403     | 12.24×  |
| Fuse      | 20.0      | 370.0     | 7400     | 37.70×  |

**Spread = 37.7× — far over the 2× target.** (Matches the ~45× the brief cited; small diff = throughput
assumptions.)

**Degenerate-strategy check: already PASSES.** Short-common spam (len 3–4, top-2k vocab, +40% typing
speed) earns only **1.14× honest play** in every steerable mode (WB/Blitz/Fuse) — the rarity band +
length bonus already make honest, rarer, longer words worth more per word than fast junk. So JOB B's
"no degenerate strategy >1.5×" requirement needs no change; only the mode spread does.

**Solution that hits ≤2× (verified in-sim):** set per-word bases so throughput × rarity is equalized —
`WINS_MULT = { wordBomb: 2, blitz: 1, satRush: 0.5, chain: 1.5, fuse: 1 }` → wins/min WB 392 · Blitz 344 ·
Chain 358 · SAT 421 · Fuse 492 → **spread 1.43× ✓**. (Compensates each mode's throughput + rarity so the
choice of mode stops being a grind-efficiency decision.)

**Why this is NOT shipped on this branch (logged to DECISIONS.md):** those mults CUT absolute solo-mode
earning 4–15× (Fuse 7400→492/min, Chain 2403→358, SAT 1686→421). The entire cost economy — shop prices,
the `need()` level curve, the Key-tier ladder, the 200-h pacing — is calibrated to the CURRENT earn
rates. Part 2 below already measures **130–160 h dead stretches at today's earn**; cutting earn 4–15×
would multiply those to 500–2000 h — a knowingly-broken economy. Re-balancing the *ratio* to ≤2× is
therefore inseparable from re-tuning every downstream cost proportionally — a coupled, economy-wide
redesign. Per the RISK TIERS (economy = **Tier 1**: diagnose-first, supervised review) and the run's
"most conservative option" rail, shipping the flatten alone — even green-on-a-branch, because I'd have
to lower the test expectations to the new low payouts to make it pass — would look done while being
broken. So Part 1 is delivered as **diagnosis + the exact verified mult set + the reusable sim**, for
supervised application together with the cost re-tune. It is not blind-shipped overnight.

## Part 2 — TIER_COST_STEP 6→5 + 200-hour archetype dead-stretch sim (SHIPPED)

Tool: `claude/archetype200h-sim.mjs` (each archetype mains one mode at its wins/min above; buys the Key
ladder greedily; dead stretch = longest span with no new tier, over 200 h of play). Faithful to the
shipped `KEY_TIERS` table; the past-T8 step is parameterized so 6 and 5 run in one pass.

**Result — TIER_COST_STEP 6 vs 5 is a measured NO-OP for realistic play:**

| archetype      | reaches | longest dead stretch (STEP 6) | (STEP 5) |
|----------------|---------|-------------------------------|----------|
| Word Bomb main | T5      | 133.9 h → T6                  | 133.9 h  |
| Blitz main     | T5      | **162.3 h → T6**              | 162.3 h  |
| SAT Rush main  | T6      | 153.9 h → T7                  | 153.9 h  |
| Chain main     | T7      | 161.8 h → T7                  | 161.8 h  |
| Fuse grinder   | T7      | 137.0 h → T8                  | 137.0 h  |

**Longest dead stretch: 162.3 h (Blitz main → T6) — identical for STEP 6 and 5.** Because the step only
applies PAST T8 and **no archetype reaches past T8 in 200 h** (even the Fuse grinder tops out at T7), the
6→5 change moves nothing a real player experiences. The change is applied (as requested — it does
cheapen the T9+ deep-whale endgame, `keyTierCostAt(9)` 839.8M→699.8M) but its practical effect is nil.

**The real pacing lever (finding):** the dead stretches are set by the **T7/T8 table prices themselves**
(23.3M / 140M wins), which are a 100+ h grind PER TIER at every archetype's earn rate — a genuine
end-game wall that sits entirely below where TIER_COST_STEP begins. If the goal is to shorten the
top-end grind, the change that matters is lowering the T6–T8 table entries (or the earn side), not the
past-T8 step. Flagged for the same supervised economy pass as Part 1.

## Shipped in this commit
- `src/progress/xp.js`: TIER_COST_STEP 6→5 (+ the no-op caveat in-comment).
- `src/progress/xp.test.js`: T9 cost assertion updated ×6→×5.
- Tools (untracked, per the never-commit-reports convention): `winsmin-sim.mjs`, `archetype200h-sim.mjs`.
- NOT shipped: the Part-1 mult flatten (coupled Tier-1 economy redesign — diagnosis + spec above).
