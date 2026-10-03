# PV10 — what happens to today's players (REDONE oct3 11:22 on the CHOSEN curve)

The first version of this file used the K8 r1.025 probe. The adversarial reviewer caught that the chosen curve
(K = 10 ramped in over LV30–40, r 1.028 to LV225, r 1.018 above, P^0.95 at every level) needs about 2× more around
LV195–225, so every pace below is from the chosen curve's 200 h median run (claude/econ-oct2 v10 3-skill check).

Why one table fits everyone: need scales with P^0.95 while XP income scales with P, so minutes per level depend almost
only on the LEVEL (a P^−0.05 term), not on KEY tier or rebirths. A save's pace at its level ≈ a fresh median player's
pace at that level.

## Median pace on the chosen curve
| stretch | minutes per level |
|---|---|
| LV50→100 | ~7 |
| LV100→150 | ~13 |
| LV150→225 | ~22 |
| LV225→300 | ~38 |

## Option K (keep every level) — the top-8 board rows
| player | LV | R | next level takes (median) | a median NEWCOMER reaches their level at |
|---|---|---|---|---|
| snapplemelon | 195 | 4 | ~22 min | ~38 h |
| Xavi | 168 | 8 | ~22 min | ~28 h |
| elol | 156 | 7 | ~22 min | ~23 h |
| NoBuffCookies | 147 | 6 | ~13 min | ~20 h |
| Daan | 144 | 9 | ~13 min | ~20 h |
| Tangie | 126 | 10 | ~13 min | ~16 h |
| maSON_im_cRYAN | 119 | 8 | ~13 min | ~14 h |
| creator | 118 | 6 | ~13 min | ~14 h |

- Nobody loses a level, rebirth, mark, tier or win (fraction storage keeps every bar where it is; no wins cap).
- The top 8 keep a 14–38 h lead over a median newcomer. Their next level goes from seconds to 13–22 minutes:
  the one-time notice says so ("LEVELS NOW TAKE LONGER — YOU KEPT EVERY LEVEL.").
- REBIRTH WALL (review fix 6): saves that exist at migration get a one-time gate for their NEXT rebirth of
  min(table gate, current LV + 25). Tangie (R10, LV126): table LV225 → gate LV151 ≈ 25 levels × ~13 min ≈ 5.5 h
  instead of ~36 h. Daan (R9, LV144) → 169 ≈ 7 h. maSON (R8, LV119) → 144 ≈ 5.5 h. After that one rebirth the
  normal table applies.
- The LV5222 row (NoBuffCookies) is outside the table: its bar is permanently frozen under any curve (need ≈ 5e46);
  ANDY TODO: reset it with 012.

## Option H (convert to hours-equivalent) — not recommended
Their real typing time is ~0.5–2 h, so H would move LV195 to roughly LV10–20 (−90%). Order is preserved but it fails
"fair". (015's level clamp would also freeze their submits.) Recommendation stays **K**.

## Still to run
A real-row simulation (start each bot at its LV/R/tier) needs a start-state option in loop-sim; until then the table
above is the per-level pace argument plus the fresh-player sim, labelled as such. The 8 real cloud saves (ANDY TODO SQL)
would replace the stand-in KEY tiers.
