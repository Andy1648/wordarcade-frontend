# PV10 — what happens to today's players (oct3 03:10, from the K8 r1.025 α0.95 200 h median sim)

The candidate curve is need(n) = K·need(30)·r^(n−30)·P^α (power-scaled at every level, K = 8, r = 1.025, α = 0.95).
Because need scales with P^0.95 while XP income scales with P, a player's minutes per level depend almost only on
the LEVEL (a P^−0.05 term), not on their KEY tier or rebirths. So the fresh-player sim gives each level's pace for
everyone, and today's players can be read straight off it.

## Fresh median player on the candidate (the sim)
| milestone | reached at | pace there |
|---|---|---|
| LV50 | 2.5 h | ~3 min / level |
| LV100 | 8.5 h | ~11 min / level (100→150: 529 min / 50 levels) |
| LV150 | 17.3 h | ~15 min / level (150→225) |
| LV225 | 35.9 h | ~30 min / level (225→300) |
| LV300 | 73.6 h | ~40+ min / level |
| max at 200 h | LV393 | |

## Option K (keep every level) — the top-8 board rows
| # | LV | R | today's pace near their level | candidate pace | a median NEWCOMER reaches their level at |
|---|---|---|---|---|---|
| 1 snapplemelon | 195 | 4 | seconds per level (LV400 in 18 min on main) | ~20 min | ~28 h |
| 2 Xavi | 168 | 8 | same | ~17 min | ~21 h |
| 3 elol | 156 | 7 | same | ~16 min | ~19 h |
| 4 NoBuffCookies | 147 | 6 | same | ~15 min | ~17 h |
| 5 Daan | 144 | 9 | same | ~14 min | ~16 h |
| 6 Tangie | 126 | 10 | same | ~12 min | ~13 h |
| 7 maSON_im_cRYAN | 119 | 8 | same | ~12 min | ~12 h |
| 8 creator | 118 | 6 | same | ~12 min | ~12 h |

What this means for Option K:
- Nobody loses anything, and board order is untouched (shift 0%).
- The top 8 keep a lead that a median newcomer needs 12–28 h of play to close. That is fair: they earned it under
  the old rules, and the new climb is the same for them as for everyone at that level.
- The cost: their NEXT level goes from seconds to 12–20 minutes. That is the whole point of PV10, but it is a
  sudden feel change for them, so the migration notice must say it plainly: "LEVELS NOW TAKE LONGER — YOU KEPT EVERY LEVEL."
- Rebirth: a player at LV195 R4 can rebirth at once (R5 needs LV75). Rebirth resets the level, so the candidate's
  re-climb applies to them like anyone else; nothing about K lets them skip it.

## Option H (convert to hours-equivalent)
Each player's actual typing time is ~0.5–2 h (lifetime words 0–1,196). On the candidate, a median player reaches
LV10–20 in that time, so H would move LV195 to roughly LV15–25 (−90%). Board order is preserved (monotone), but
H fails the amendment's "fair" test outright. **Not recommended.**

## Spendable WINS (failure mode 1)
Unchanged recommendation: keep levels (K), but cap the spendable balance at N KEY-tier prices on migration (as the
v9 migration did), so a 1e9 wins/word balance (Xavi) can't buy 40 tiers on day one. Exact N needs the top-8
cloud saves (SQL in ANDY TODO).

## Still open before implementation
- One more calibration probe (K8 r1.028) to push LV225 from 36 h toward 50 h; LV400 is at ~200 h already.
- Verification across all 3 skills at 200 h, then the adversarial reviewer (only job: break existing players),
  then the branch. ANDY decides K vs H (recommendation: K + capped wins).
