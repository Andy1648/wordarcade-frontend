# Progression sim — BEFORE (live src/progress on feat/marks-shop)

`node claude/progression/econ-sim.mjs` (about 25 s) drives the live modules (`awardWordXp`, `bankWordWins`, `buy*`,
`doRebirth`, `checkAchievements`, `recordAcceptedWord`) against a Map-backed localStorage. Data: `before.json`, `before-console.txt`,
`before-level-vs-time.svg`, `before-gaps.svg`. Players play daily: CASUAL 10 min at 12 words/min, REGULAR 30 at 15, GRINDER 60
at 18. Mix is WB 30 / CHAIN 25 / FUSE 20 / SAT 15 / Blitz 10. The player buys the cheapest affordable item every round, rebirths
at once, and the 30-day window is the start of one run to 200 h.

## Verdict in one paragraph
The economy does not break after L100 because it gets too slow. It breaks because it runs away and then
hits a wall. A median player reaches **L100 in 9–15 minutes of play (about 170 words)** and **L150 in 24–37
minutes**. By then every cosmetic, theme and all 200 MOMENTUM buys are gone (sinks exhausted by minute
4–11). One word pays **1e9 wins at L100 and 5e10 at L125**. A rebirth costs nothing, because the first word
after it puts you back at about 95% of the level you left. After about L175 the curve wins. Rebirths go
R10 at 3–4 h, R11 at 8–11 h, R12 at 49–70 h, and L300 is never reached in 200 h. Over the last 150 hours the only
rewards are a mastery level or a KEY POWER tier every few hours. Andy's "upgrades seem insane" at L125 is
what the numbers show: 13-digit prices, an instant reset, and nothing left to buy except the next ×2.5 KEY
POWER at ×6 the price.

## 1. Time to first reach a level (play time / accepted words, rebirth resets counted)
| level | casual | regular | grinder |
|---|---|---|---|
| L10 | 1.2 m (15 w) R0 | 56 s (14 w) R0 | 50 s (15 w) R0 |
| L50 | 6.4 m (77 w) R3 | 4.5 m (68 w) R3 | 4.2 m (75 w) R3 |
| L100 | 14.6 m (175 w) R5 | 11.5 m (173 w) R5 | 8.7 m (156 w) R5 |
| L125 | 20.1 m (241 w) R6 | 17.5 m (263 w) R6 | 12.4 m (224 w) R6 |
| L150 | 36.6 m R7 | 30.4 m R7 | 23.7 m R7 |
| L200 | 4.4 h R9 (day 27) | 3.8 h R9 | 3.2 h R9 |
| L250 | 32.8 h R11 (day 197) | 27.4 h R11 | 23.7 h R11 |
| L300 | never (200 h) | never | never |

- Day 30: casual L204 / R10, regular L238 / R11, grinder L252 / R11. At 200 h all three are at L280–286 / R12
  with KEY T32–33. Total level-ups about 1,750.
- **The reset is cosmetic.** Level reached by the first word after a rebirth (regular player): R4 L55,
  R5 L76, R6 **L94** (left at L100), R7 L113, R8 L134. One word can grant up to **214 levels**.
- Rebirth spacing: R1–R8 1–12 min apart, then 48 m → 2.5 h → 5.8 h → **48 h** (R9–R12).

## 2. Gaps between meaningful rewards (strict view: no MOMENTUM buys, no purchases under 10 s of income)
| player | 30 days: median / p90 / max | 200 h: median / p90 / max |
|---|---|---|
| casual | 1.4 m / 9.6 m / 33 m | 7.7 m / 3.5 h / **16.3 h** |
| regular | 2.5 m / 23 m / 66 m | 7.4 m / 4.0 h / **16.8 h** |
| grinder | 3.3 m / 57 m / 2.4 h | 5.4 m / 3.9 h / **22.0 h** |

By level band (regular player): **L26–125 median gap 12–40 s**, so rewards arrive several times a minute,
which is too fast to mean anything. L126–150 is 2.3 m, the only band on target. **L151+ is 18.6 m median,
6.1 h p90, 16.8 h max.** All of the longest gaps fall at R12, L277–285, 130–185 h in, between two
mastery level-ups. Nothing else happens there: about 69 gaps per player run longer than 10 minutes, and
nearly all of them come after L150.

## 3. Affordability at first reach (income = all wins over the trailing 10 min)
| | income/min | next KEY POWER | next MOMENTUM | cheapest unowned cosmetic |
|---|---|---|---|---|
| L100 (R5) | 2.4–3.0e9 | T13 2.18e10 = 7–9 m | maxed at 200/200 since min 7–11 | none (all owned since min 4–5.5) |
| L125 (R6) | 3.5–4.0e11 | T16 4.70e12 = 12–13 m | maxed | none |
| L150 (R7) | 4.4–5.3e13 | T19 1.02e15 = 19–23 m | maxed | none |

The KEY POWER price is not a wall at these levels. The problem is that it is the **only** sink left, its price
is a 11–16 digit number, and later it becomes a wall: T24 = 1.6 h of income, T29 = 7.5 h, T32 = **27–37 h**, T33 = 65 h.
Cosmetic prices top out at 7,500 (PRISM pop) and 2,500 (SILENT, PRISM theme). The last MOMENTUM buy costs
about 8.3e6. Measured against income of 1e9+ per minute, all of them cost nothing.

## 4. Magnitudes the player sees (regular player; same order for all three)
| level | XP to next level | XP / word (CHAIN) | wins / word | words per level | balance |
|---|---|---|---|---|---|
| L50 (R3,T5) | 2.37e6 | 1.04e6 | 1.0e5 | 2.8 | 1.5e6 |
| L100 (R5,T12) | **4.93e10** | **1.00e10** | **1.00e9** | 6 | 1.9e10 |
| L125 (R6,T15) | 7.11e12 | 4.8e11 | 4.8e10 | 18 | 2.4e12 |
| L150 (R7,T18) | 1.02e15 | 2.3e13 | 2.3e12 | 54 | 2.8e14 |
| L200 (R9,T24) | **2.13e19 (> 2^53)** | 6.8e16 (> 2^53) | 6.8e15 | 392 | 2.5e17 (> 2^53) |

Every displayed number passes 1e9 at about L100. XP per level, XP per word and the wins balance all pass
`Number.MAX_SAFE_INTEGER` (9e15) before L200, so the integer arithmetic in `bankWordWins` and the carried
tenths stops being exact there.

## 5. CHAIN / FUSE mastery
`MASTERY_MAX = 20`. Reaching M20 takes **104,411 words in one mode** (`masteryWordsToReach(20)`). M10 takes 3,440.
- Day 30: CHAIN M7 / M11 / M13 and FUSE M6 / M9 / M12 (casual / regular / grinder).
- At 200 h: CHAIN M18–19 and FUSE M16–17. **Nobody maxes either in 200 h.** At 25% of words, CHAIN M20 needs
  about 460 h for the median player.
- CHAIN M5 at 80–103 m, M10 at 9–13 h, M15 at 48–73 h. The gaps between levels grow ×1.4 each level
  (`MASTERY_GROWTH`), from minutes to more than 16 h.
- The perk is +3% XP per level (`MASTERY_XP_STEP`), at most ×1.57. That is invisible next to ×3^rc rebirth and
  ×2.5 per KEY tier. There are no milestone rewards on the bar. The only payouts tied to it are the M5
  achievements, `m-all-3` and the secret `sec-truemaster` at M10.

## Root causes, most likely first
1. **Three multipliers compound inside one product, and wins buy more of it** (`xp.js`
   `xpPerWord`, `REBIRTH_MULT_BASE = 3` / `rebirthMult` = 3^rc, `TIER_XP_STEP = 2.5` / `keyTierXp`;
   `wins.js` `perWordWins` = XP ÷ 10). KEY POWER is bought with wins, which are XP/10. So every tier raises
   the income that buys the next tier, and every rebirth multiplies both by 3. Per-word value goes from
   2e2 XP at L1 to 7e16 XP at L200, about 14 orders of magnitude. This is the direct source of the
   "insane" numbers.
2. **Rebirth gates are too close together for the multiplier, so the reset costs nothing early on**
   (`xp.js` `REBIRTH_TABLE` levels 15/25/40/60/75/100/125 against `REBIRTH_MULT_BASE`). Through R8,
   (×3 rebirth) × (KEY tiers bought in the same minute) is worth more than the 15–25 levels the gate asks
   for. The first word after the reset climbs back to about 95% of the old level, and R1–R8 all land
   inside the first 30 minutes.
3. **The top of the level curve beats the rebirth payout once KEY POWER slows down** (`xp.js`
   `TOP_CURVE_EXP = 1.22` above `CURVE_BREAK = 30`; `REBIRTH_PAST_LEVEL_STEP`). Each +25-level gate costs
   1.22^25 ≈ **144×** more XP and pays only ×3. The base-XP effort per rebirth grows about ×48 per step
   (curve facts in the console). KEY tiers (`TIER_COST_STEP = 6` vs effect ×2.5) also need 2.4× more
   words each. Together these turn the runaway into a wall: rebirths come 48 m → 2.5 h → 5.8 h → 48 h
   apart, and gaps run 16–22 h after L150.
4. **Every non-KEY sink has a fixed price that does not scale with income** (`shop.js` `POP_PRICE_BASE` 60,
   `SOUND_PRICE_BASE` 100, `COSMETIC_PRICE_STEP` 5, only 4 + 3 paid items; `theme/themes.js` `THEMES`
   prices 60–2,500; `momentum.js` `MOMENTUM_BASE` 500, `MOMENTUM_RATIO` 1.05, `MOMENTUM_MAX` 200). Everything
   is bought by minute 4–11. Past that point KEY POWER is the only reason to earn wins.
5. **Level-gated content stops early** (`unlockLadder.js` `LADDER` ends at L35; `rank.js` `RANKS` ends at
   UNREAL L100; `menuTier.js` `MAX_TIER` 7 is reached at about R7; themes free at L10 / L30). Above L100, a
   level-up unlocks nothing, so the 1,700 level-ups a player collects are almost all trivial.
6. **The mastery curve is geometric and has no milestones** (`mastery.js` `MASTERY_GROWTH = 1.4`,
   `MASTERY_MAX = 20`, `MASTERY_XP_STEP = 0.03`). Early levels come in minutes and late ones take 16 h+.
   The perk does not register against the rest of the stack.

## Assumptions to sanity-check
- Pace 12–18 accepted words/min incl. overhead (WB is turn-based, likely lower). Times scale ~linearly with pace;
  the word counts in table 1 are the robust figure.
- Greedy shop-every-round + instant rebirth; a hoarder is slower in hour 1 but faces the same multipliers.
- Not modelled: `returnBonus`, Word Race, menu-typing XP, LINGUIST/METRONOME in-game effects.
