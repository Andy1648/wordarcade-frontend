# MARK ROLLS — sim results (M5) and rule P

Spec: `marks-spec.md`. Engine: `src/progress/markRolls.js`. Sim: `loop-sim.mjs`, the real modules,
20 h of play (60 min/day), casual / median / strong bots, **5 seeds** (`SIM_SEED` 0–4). Base tree =
main @ 383ea63e. Raw tables: `marks-summary-rolls.txt`, `marks-summary-spec.txt`,
`marks-compare-*.txt`. Re-run:

```
bash claude/econ-oct2/compare.sh <main src> <branch src> m3A 5                 # rolls only
SIM_SPEC_CUT=1 bash claude/econ-oct2/compare.sh <main src> <branch src> m3B 5  # rolls + achievement cuts
SIM_ROLLS=0 bash claude/econ-oct2/compare.sh <main src> <branch src> m3C 2     # engine present, unused
node claude/econ-oct2/marks-summary.mjs m3A 5
```

**Bot roll policy.** **20% of every wins credit** goes to a roll purse once rolls unlock (LV10 or R1).
AUTO-KEY/AUTO-FORGE and the shop never spend the purse. The bot rolls while the purse covers
`rollPriceNow(level)`. A roll rarer than the worn MAIN auto-equips, and the bot then wears the best
mark by value. The MARKS unlock gives one free starter roll.

## 1. Headline numbers (5-seed mean, min–max in brackets)

| | casual | median | strong |
|---|---|---|---|
| **paid rolls per hour** (20 h mean) | **4.0** (4.0–4.1) | **15.6** (15.2–16.1) | **85** (83–89) |
| rolls in hour 1 / hour 20 | 7 / 4.6 | 13.4 / 19.2 | 44 / 95 |
| income, reference words per min of play | ~40 | ~95 → ~190 | ~170 → ~1,200 |
| **first EPIC+** | **67 min** (13–84), roll #7.6 | **33 min** (16–43), roll #8.4 | **16 min** (12–18), roll #8 |
| **first LEGENDARY** | **561 min (~9 h)** in 3 of 5 seeds; **not in 20 h** in 2 | **642 min (~11 h)** (243–962), roll #157 | **98 min** (55–198), roll #89 |
| EPIC pity hits / LEGENDARY pity hits (20 h) | 0.8 / 0 | 0.8 / 0 | 0.8 / 0 |
| GOLD step-ups / RAINBOW step-ups by 20 h | 0 / 0 | 17 / 0 | 156 / 5.8 |
| luck at 20 h (excluding the ×2 bonus roll) | 1.4 | 2.4 | 3.1 |
| **largest single paid roll, in levels** | **1.3** (1.1–1.7) | **1.4** (1.3–1.6) | **1.5** (1.4–1.6) |
| paid rolls worth > 3 levels | **0** | **0** | **0** |
| INDEX-milestone lumps among the top 27 lumps | none | none | none |

- **Levels per roll** = `ln(income step) / ln(need(L+1)/need(L))`. This is the loop-sim buy metric:
  how many levels of the curve the permanent income change is worth at the level where it
  happens. The largest single rolls are a first LEVIATHAN / SINGULARITY / ORIGIN, worth +4–5% income
  (a new +6% all-mode PERK) at LV600–900. **No paid roll in any seed is worth more than 1.7 levels.**
- **The starter roll is not counted as paid.** It is the system unlock: a free ×2 MAIN when nothing
  is worn, 4.5–5.5 levels at LV1–14. That is the same size as today's first achievement mark
  (STUDENT ×2 at LV15). It can only happen once.
- The EPIC+ pity barely fires: 0.8 hits per run, all of them the **first-EPIC-by-roll-10**
  guarantee. Natural EPIC+ (4% × luck) comes well before 40. The LEGENDARY pity (300) never fires in
  20 h: luck reaches 1.4–3.1, so the natural rate is 1 in 90–200. Pity is the safety net, not the
  schedule.
- **The casual player is the weak spot.** At ~4 rolls/h, 2 of 5 casual seeds see no legendary in
  20 h, and the casual never makes a GOLD. See open question 2.
- Rolls per hour grows with skill much faster than words per minute does (strong earns ~6× the
  median's reference words per minute: FRENZY, longer runs, combo). The price is in words at YOUR
  rate, so skill buys more rolls. Whether strong should get ~85/h is open question 3.

## 2. With the achievement CUTS (spec §9) — `SIM_SPEC_CUT=1`

Same rolls/hour and first-epic/legendary times (± a few minutes). One thing changes: new players no
longer get STUDENT / PHOENIX / NOVA … from easy achievements, so **a rolled MAIN matters more early**.

| | casual | median | strong |
|---|---|---|---|
| largest single paid roll, levels | **5.8 mean (1.3–19.3)** | 1.5 (1.3–1.7) | 1.5 (1.4–1.7) |
| paid rolls > 3 levels (per run) | **0.4** (2 of 5 seeds) | 0 | 0 |

The two casual violations: **SINGULARITY at LV121 (×1.89 income, 19.3 levels)** and
**TINDER at LV87 (×1.26)**. In both, a casual wearing only a ×2 common rolled a much rarer mark,
and it auto-equipped (a ×4 or ×2.5 MAIN). Without the cuts, the achievement marks (ETERNAL at ~12
min) already sit above any rolled MAIN, so this never happens. **This breaks the "≤ ~3 levels per
roll" rule for low-level players whenever the cuts ship.** Options are in open question 5.

## 3. Rule P — `compare.sh`, 5 seeds, mean of each window metric (lower is better)

**SIM_ROLLS=0** (the engine and payout hook present, nobody rolls). **0 WORSE windows, VERDICT
MERGE.** Every number is byte-identical to main (same levels, lifetime wins and windows). The hook
is exactly ×1 for a save that never rolled, so **this branch changes no live payout**.

**Rolls at 20% (m3A) — 9 WORSE windows, VERDICT HOLD (rule P):**

| skill | window | metric | before | after |
|---|---|---|---|---|
| casual | 1h | maxGapMin | 0.90 | 0.93 |
| casual | 20h | maxGapMin | 4.63 | 4.93 |
| casual | all | runawayFails | 2.60 | 3.00 |
| median | 5h | maxGapMin | 2.38 | 2.66 |
| median | 20h | maxGapMin | 3.92 | 4.34 |
| median | all | runawayFails | 0.00 | 0.20 |
| strong | 1h | worstShopEtaMin | 0.38 | 0.48 |
| strong | 5h | worstKeyEtaMin | 45.82 | **74.38** |
| strong | 5h | worstShopEtaMin | 0.82 | 1.07 |

**Rolls + cuts (m3B) — 12 WORSE windows, VERDICT HOLD (rule P):** casual 1h / 5h / 20h maxGap
(0.90→0.97, 2.83→3.17, 4.63→5.10), casual 20h KEY eta (36.7→39.9), casual runaway (2.6→2.8),
median 10m shop eta (1.30→1.33), median 5h / 20h maxGap (2.38→2.54, 3.92→4.00), median runaway
(0→0.2), strong 1h maxGap (0.81→0.81, a hair), strong 1h shop eta (0.38→0.40), strong 20h maxGap
(3.35→3.49).

What the WORSE windows are:
- **maxGap (+0.03 to +0.47 min).** The purse holds back 20% of income, so KEY/forge buys and
  level-ups land slightly later. A new mark from a roll counts as a "good event", but most rolls are
  dupes, which do not count, so they don't fill the gaps.
- **runawayFails (+0.2 to +0.4).** None are roll lumps. They are existing MASTERY / RANK UP lumps
  that were already at 2.8–3.0 min and now land just over the 3-minute line, partly because the
  wins diverted into rolls slow the trailing income the metric divides by. The casual baseline
  already has 2.6 fails per run.
- **strong 5h KEY eta 46 → 74 min.** One worse sample in the strong 5 h window. The purse is not
  counted as KEY money (that fix is in this branch), so this is real: the strong bot spends ~20%
  of a very large income on ~85 rolls/h.
- Most windows got **better**. KEY eta: casual 1h 35→12 min, median 1h 41→19, median 5h 36→22,
  strong 10m 117→62. Late in the run the summed PERKs outweigh the 20% spend.

**Verdict: HOLD under rule P.** Rolls as specified are a net income gain over 20 h. Final level is
up: median 865 → 905, strong 1,073 → 1,145. But they slightly widen the gaps between good events
and push a few borderline lumps over the line. Before the UI branch can merge, one of the levers in
open question 6 has to clear the WORSE list.

### Earlier run (superseded)
The first 5-seed run counted the roll purse as KEY money in the ETA sample, and KEY eta looked
better than it is. That run had 7 / 10 WORSE windows; with the fix it is 9 / 12 (above).
`loop-sim.mjs` now subtracts the purse.

## 4. Calibration that set the price (median, 20 h, 1 seed)

| ROLL_BASE_WORDS | casual / median / strong paid rolls per hour | note |
|---|---|---|
| 12 (the forge's number, WB rate) | 35 / 137 / 411 | luck inflated (+0.01 per gold); commons disappear by mid-run |
| 60 | 7 / 28 / 148 | |
| **100** | **4 / 16 / 85** | median inside the research's 10–20 per active day → **shipped** |
| 150 | 0 / 3 / 22 | casual walled |
| 400 | 0 / 0 / 0.7 | walled |

## 5. Open questions for Andy
1. **lv-300 and sec-eternal are easy today** (13 and 12 median minutes). They are kept as hard only
   on the assumption that PV10 ships. If it does not, should they be cut, or replaced with harder
   new ids (LV1000, 25 rebirths)?
2. **Casual rolls ~4 per hour.** Raise the casual's rate (a lower base price, e.g. 60 words → ~7/h,
   which gives strong ~150/h), or accept it?
3. **Strong rolls ~85 per hour** (luck 3.1, 156 golds, ~6 rainbows in 20 h). Fine because skill is
   rewarded, or should the price follow the player's actual mode mix rather than the reference word?
4. **Flat 10/10 GOLD/RAINBOW for every tier** (Andy's rule) makes a GOLD legendary basically
   unreachable (11 copies at 1 in 90–280). Keep it as the deep flex, or use the research's
   per-tier thresholds (legendary 2 / 3)?
5. **The rolled MAIN jump with the cuts.** A casual with a ×2 common who rolls a legendary gets ×4,
   up to 19 levels in one roll. Options: (a) auto-equip only when the new MAIN beats the current
   one by ≤ ×1.5; the rest go into the index with a SET AS MAIN prompt and the player decides.
   (b) Compress the rolled MAIN ladder (×2 / ×2.2 / ×2.4 / ×2.7). (c) Accept it as the jackpot.
   Also: with rarity-only auto-equip, a rank-V common (×2.6) can be replaced by a rank-I rare
   (×2.5). Should auto-equip require a higher MAIN too?
6. **Rule P levers** to clear the WORSE windows: a smaller default spend (the UI can't decide that,
   but the 20% policy here is the player model); slightly larger PERKs (common +3%) so income gains
   offset the purse sooner; or treat a GOLD/RAINBOW step-up and a new mark as "good events" (they
   are visible moments) in the gap metric. The third changes the yardstick, so it needs your call.
7. **PERMANENT MAIN**: ×4 (same as LEGENDARY, the current spec) or ×5? CURATOR and LINGUIST owners
   go up to ×4 either way. That is a live payout increase; it is not wired here and needs its own
   rule-P run.
8. **Tags:** "MAIN ×N" on the worn mark and "PERK +X%" everywhere else. Or show only PERK in the
   index and only MAIN in the hero slot?
