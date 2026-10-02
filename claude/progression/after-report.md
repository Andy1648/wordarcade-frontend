# STEP 19 — Economy v9: result (Andy A6)

Same simulator, same three players (10 / 30 / 60 min a day, 30 days + 200 h tail), live modules.
Before: `before-report.md`. Raw: `after-summary.json` (per-run series dropped; re-run the sim for them), `after-console.txt`. Charts: `before-after-gaps.png`,
`before-after-level-vs-time.png`. Tuning trail: `v9a…v9h-console.txt`, `sweep.mjs`, `sets1.json`.

## What changed and why
| lever | v8 | v9 | why |
|---|---|---|---|
| KEY POWER effect | ×2.5 XP a tier past T8 | **+15 XP per letter a tier** (T1 = 25 as before) | wins (= XP ÷ 10) buy the next tier, so a multiplicative tier compounded per-word value through 14 orders of magnitude |
| KEY POWER price | ×6 a tier | **priced in WORDS**: 40 × (1 + t/60) reference words at your current rate × rebirth | a tier is always "a few minutes of play" away — never pocket change, never a wall |
| rebirth | ×3^r (R10 = ×59,049) | **×(1 + r)** (R10 = ×11) | the reset was cosmetic (first word back = 95% of the old level) |
| level curve above L30 | ×1.22 a level | **(L/30)^4** to L300, then ×1.03 a level | geometric tail made L175+ a multi-hour wall and 19-digit costs |
| cosmetic ladders | 4 pops / 3 sounds, ×5, top 7,500 | **12 pops / 9 sounds, ×6 a rung**, top ~1.5e10 | every sink was empty by minute 11 |
| MOMENTUM | ×1.05 a buy | **×1.10** | all 200 buys were gone in the first 2 h |
| mastery | M20, ×1.4 a level, no rewards | **M50**, 30 + 1.2·l² words, **wins milestone every 5 levels** (40 × l/5 words' worth) | "CHAIN and FUSE bars much higher with better rewards" |
| saves | — | one-time `econMigrate.js`: keep level / rebirths / tiers / cosmetics / mastery; cap the inflated v8 balance at 10 v9 KEY prices | a 1e12 balance would otherwise buy thousands of tiers in one click |

## Targets (`targets.md`)
| | target | before | after |
|---|---|---|---|
| T1 | median gap 1–4 m (<L50), 2–8 m after | 4–12 s mid-game, 5–8 m tail | **1.0–1.2 m (30 d), 4.4–4.7 m (200 h tail)** ✅ |
| T2 | p90 ≤ 20 m, max ≤ 60 m in 200 h | p90 3.5–4 h, max 16–22 h | **p90 6.5–7.1 m, max 10.4–13.1 m** ✅ |
| T3 | every number < 1e12 | XP to level 2e19 at L200 (> 2^53) | L200 level cost 8.8e7, wins/word 5e5, lifetime wins ~2e9 at 200 h ✅ |
| T4 | rebirth climb-back ≥ 40% of previous climb | ~5% | **~50–55%** (e.g. R7: 15 m back vs 18 m before) ✅ |
| T5 | no sink empty before 50 h | 4–11 min | cosmetics 160 h / never; MOMENTUM never maxed in 200 h ✅ |
| T6 | mastery far higher + milestones | M20 never reached, 16 h gaps | CHAIN M50 at 126–186 h, FUSE M43–47; a wins milestone every 5 levels ✅ |
| T7 | L100 in 3–8 h, L200 in 25–70 h | L100 9–15 min, L300 never | **L100 27–37 min, L200 2–2.7 h, L300 3.7–5.4 h** ❌ (kept the fast early hook on purpose — Andy's friends found the start "VERY addicting"; the walls, not the speed, were what made him quit) |
| T8 | payout-honesty / free-wins / SAT-spam green | — | see PR gate |

## What a player will notice
- Numbers stay readable: a L150 player sees thousands-to-millions, not "1.02QA".
- Every few minutes something to buy (KEY tier ~5 min apart late), plus cosmetics that stay out of reach for days.
- Rebirth costs ~15–30 minutes to climb back late, and pays ×(1+r) permanently.
- CHAIN / FUSE dialogs show the next mastery bonus ("BONUS AT M10").
