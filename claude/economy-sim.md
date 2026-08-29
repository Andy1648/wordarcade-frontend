# Economy simulation — 200 play-hours, 3 archetypes (Job 12, REPORT ONLY)

Branch `sim/economy`. Sim script: `claude/econ-sim.mjs` (run `node claude/econ-sim.mjs`).

The sim **imports the real economy source** (`src/progress/xp.js`, `wins.js`, `wordSense.js`,
`shop.js`, `rarity.js`, `mastery.js`, `src/theme/themes.js`) — every curve, cost, and multiplier
is the shipped one — and **samples the real word corpora** (`words.recall.txt`, SAT deck) to derive
per-mode rarity. No economy number is invented. Only the **play assumptions** below are estimates.

## The live economy it models

- **5 live modes** (all on the shipped menu): Word Bomb, Category Blitz, SAT Rush from LV1;
  **CHAIN visible-but-locked to LV20**, **FUSE to LV25** (`gameData.js`). SAT_RUSH_ENABLED = true.
- **Wins per word** = `20 × modeMult × difficulty × rebirthMult`, then × a rarity/combo/lucky
  **weight** (per accepted word) and × **Word Sense** (an *uncapped* multiplier on rarity excess).
  modeMult: WB/Blitz ×1, SAT ×2, CHAIN ×10, FUSE ×15.
- **XP per word** = `keyTierXp(tier) × wordLen × modeMult × rebirthMult × weight × streak × mastery`.
  modeMult: WB/Blitz ×2, SAT ×3, CHAIN ×4, FUSE ×5. Key Power tier XP goes 10 → 25 → 60 → … **×2.5/tier**.
- **Sinks:** Key Power tiers and Word Sense tiers (both on the **same cost ladder**: 500 · 3k · 18k ·
  108k · 648k · 3.89M · 23.3M · 140M, then **×6/tier**), pop styles (150–2000), sound packs (250–1200),
  themes (600 · 2500 · 8000 · 25000; midnight/toxic also free at LV10/30), LV-frame ladder (LV3/11/19/27/35),
  ~30 achievements, 5 collection milestones (100 → 5000 distinct), rebirths (LV15→R1 … LV225→R11 with the
  ×10→×100 jump).
- **Passive:** daily streak (XP ×1.05→×1.25), return bonus (≥6h away → `min(h,12)×100×rebirthMult`, once/day).

## Play assumptions (the only invented inputs)

| Assumption | Value | Note |
|---|---|---|
| Valid words/min (local player) | WB 5, Blitz 14, SAT 9, CHAIN 16, FUSE 11 | Turn-based multiplayer is slow for one player; solo runs at full speed |
| Mode mix | <LV20: WB/Blitz/SAT · <LV25: +CHAIN · else: FUSE/CHAIN-heavy | rational drift to the ×10/×15 solo earners once unlocked |
| WB/Blitz difficulty | `medium` (×1.5) | App default for returning players |
| CHAIN/FUSE combo | time-avg ×2.2 | constant; not simulated run-by-run |
| Lucky (1/40 → ×5) | mean factor ×1.1 | `(39·1 + 1·5)/40` |
| Distinct-word growth | Heaps `6.7·N^0.55`, cap 8000 | **least-certain input** — see caveats |
| bestWpm | CASUAL 45 / REGULAR 65 / GRINDER 85 | drives 3 speed achievements |
| Buying policy | cheapest affordable new thing first, every session | Rebirth greedily when eligible |

Each archetype is simulated until **200 cumulative play-hours** (equal *play* investment, different
calendars): CASUAL 10min/day → 1201 days, REGULAR 30min/day → 400 days, GRINDER 120min/day → 100 days.

Per-mode rarity (Monte Carlo over the real corpora): **WB/Blitz meanMult 1.23**, **SAT 3.50 (56% OBSCURE)**,
**CHAIN 1.21**, **FUSE 1.30** — matches the repo's own `rarity-sim.mjs`.

## Per-archetype timelines (REGULAR shown; all three are near-identical in *play-hours*)

The dead-stretch analysis is measured in **play-hours**, and the economy is play-hour-invariant
(income and costs scale together regardless of calendar pace), so all three archetypes land within
±1h of each other.

**REGULAR — reached 200h in 400 days, final LV245 R11, KeyPower T15, WordSense T15, lifetime 157T wins.**

| play-h | LV | R | KP | WS | milestone reached |
|---|---|---|---|---|---|
| 0.5–1 | — | — | T1 | T1 | CHAIN + FUSE gates cleared (**first session**), R1 |
| 2.5 | 55 | 3 | T6 | T6 | all cosmetics + midnight/inferno themes bought |
| ~6 | — | 4–6 | T7 | T7 | toxic + prism themes, most achievements |
| 17.5 | 125 | 7 | T10 | T10 | KP/WS T10 (5B wins each) |
| 33.5 | — | 8 | **T12** | T11 | — |
| 61.5 | — | 9 | **T13** | T12 | — |
| 93.5 | — | 10 | T13 | T13 | last variety event (sec-eternal achievement, R10) |
| **114.5** | — | 10 | **T14** | T13 | — |
| **147** | — | 10 | T14 | **T14** | — |
| **182.5** | — | **11** | T14 | T14 | **REBIRTH 11 (×100)** — end of the worst gap |
| 187.5 / 195 | — | 11 | T15 | T15 | KP/WS T15 (39T wins each) |

**Key Power / Word Sense tier cadence (play-hours to buy):** T8 ≈ 4h · T10 ≈ 11h · T12 ≈ 34–43h ·
T13 ≈ 62–79h · **T14 ≈ 115–147h · T15 ≈ 188–195h**. The gap between tiers grows geometrically:
each new tier costs ×6 the last, income grows only ~×2.5 (Word Sense) per tier, so gaps balloon
**~×2.4 per tier** (12h → 14h → 21h → 32h → 35h).

**Rebirths:** R1–R6 all fire in the **first ~8 play-hours**; then R7@14h, R8@25h, R9@49h, R10@93h,
R11@182h — spacing roughly doubles each time.

## Dead-stretch table (longest span with NOTHING new to buy/unlock)

| Archetype | Longest dead stretch | In calendar days | Where it falls |
|---|---|---|---|
| **CASUAL** (10 min/d) | **35.3 play-hours** | ~212 days | after WORD SENSE T14 → REBIRTH 11 |
| **REGULAR** (30 min/d) | **35.5 play-hours** | ~71 days | after WORD SENSE T14 → REBIRTH 11 |
| **GRINDER** (120 min/d) | **36.0 play-hours** | ~18 days | after WORD SENSE T14 → REBIRTH 11 |

The **top-5** stretches (REGULAR) are **all** in the T13–T15 climb, and all ≥12h:

| rank | length | window | after → next |
|---|---|---|---|
| 1 | **35.5h** | 147 → 182.5h | WS T14 → REBIRTH 11 |
| 2 | 32.5h | 114.5 → 147h | KP T14 → WS T14 |
| 3 | 21.0h | 93.5 → 114.5h | last achievement → KP T14 |
| 4 | 14.5h | 78.5 → 93h | WS T13 → REBIRTH 10 |
| 5 | 12.5h | 49 → 61.5h | REBIRTH 9 → KP T13 |

### The churn point

**Everything except Key Power, Word Sense, and rebirth is exhausted by ~90–110 play-hours** (all
cosmetics by ~3h, all themes by ~6h, all achievements by ~110h, distinct-word collection saturates
below the 5000 milestone). From there to the horizon the game is *only* "grind wins for the next
KP/WS tier," and those tiers are spaced **21h → 32h → 35h** apart. The worst single gap — **~35 play-hours
staring at a rising wins counter with one far-off goal** — is **71 calendar days for a REGULAR player,
212 for a CASUAL.** That is the churn risk.

## The single change that most reduces the dead stretch

**Lower the Key Power / Word Sense past-T8 cost step from ×6 to ×5** (`TIER_COST_STEP` in `xp.js`,
shared by `wordSense.js`). This drops the cost step's ratio to the ×2.5 effect step from 2.4 to 2.0,
so gaps grow more slowly and each tier arrives sooner.

Measured effect on the longest dead stretch (all archetypes; `EXP_STEP` knob in the sim):

| cost step | longest dead stretch | notes |
|---|---|---|
| **×6 (live)** | **35–36h** | — |
| ×5.5 | 43h | *worse* — a tier/rebirth resonance; the lever is non-monotonic |
| **×5 (recommended)** | **~22h** | **−37%, no runaway, tiers stay at T15** |
| ×4.5 | ~19h | also safe (−47%) |
| ×4 | 14–26h + horizon voids | **runaway begins** — the *uncapped* Word Sense wins multiplier (2.5^tier on rarity excess) starts to outrun the cheaper cost |
| ×3 | **82–132h** | catastrophic: player exhausts the ladder, then a huge void to the horizon |

**Recommendation: ×6 → ×5** (conservative). It cuts the worst stretch from ~35 to ~22 play-hours
(71 → 44 calendar days for a REGULAR) with zero runaway risk. ×4.5 reaches ~19h but sits only one
step from the runaway, so I recommend staying at ×5. Note the lever is **noisy** (×5.5 is worse than
×6) — a content fix (a third, cheaper-cadence endgame sink) would be more robust, but the cost-step
change is the single-number lever with a clean, safe, measured win.

## Secondary findings (worth a look, not the ask)

1. **Level-gating provides ~zero pacing.** Key Power multiplies XP-per-letter **×2.5/tier**, which the
   `1.25^n` level curve cannot restrain. All three archetypes clear the **LV20 CHAIN and LV25 FUSE gates
   inside the first session (0.5–2h)** and fire **R1–R6 in the first ~8 play-hours**. Any content hung on
   a level threshold is consumed almost immediately.
2. **Key Power and Word Sense are redundant twins** — identical ×6 cost ladder, bought in lock-step,
   they stall at the same moment. Two sinks that share a schedule act like one.
3. **Word Sense's wins multiplier is uncapped** (`2.5^tier` on rarity excess, explicitly outside the
   ×40 cap). The ×6 cost is the *only* throttle on a wins runaway; that is *why* lowering the cost step
   below ~×4.5 is dangerous.

## Modules / effects I could not fully model (caveats)

- **Collection distinct-word growth** — modeled with Heaps' law (`6.7·N^0.55`, cap 8000); the
  least-certain input. Real distinct discovery depends on player vocabulary + repetition. Milestone
  timing (esp. 2500 / 5000) is therefore soft; CASUAL/REGULAR never reach the 5000 milestone in the sim.
- **Combo (CHAIN/FUSE)** modeled as a constant time-avg ×2.2, not a simulated streak/break run.
- **SAT Rush** heat / silver-tongue / spell-along miss-and-life mechanics not modeled; SAT payout is
  rarity × Word Sense only (heat bonus ignored — small).
- **WPM / records / rank** modules not economically modeled beyond the 3 bestWpm-gated achievements.
- **Difficulty** fixed at `medium` for WB/Blitz throughout; **return bonus** assumed to fire daily.
- Per-word wins/XP use **mean-field** rarity/combo/lucky/word-sense (means over thousands of words/day),
  not per-word rounding — accurate for accumulation, but the ×40 cap and per-word `round10` are applied
  to means rather than each word.
