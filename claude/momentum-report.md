# FEAT — MOMENTUM, the repeatable sink (feat/repeatable-sink)

Branch `feat/repeatable-sink` off `main` (`449a759`). Builds the top recommendation from
`claude/dead-stretch-report.md`: one repeatable upgrade that fixes the ~162 h end-game "nothing to
buy" dead stretch, with a permanent visible mark on the menu per buy.

## What it is
- **ONE upgrade, bought forever.** Base **5,000 wins**, cost **×1.05 per buy**, **200 buys** available
  (top unit ~86M wins; cumulative ~1.7B — a 200 h whale never exhausts it, so there is always a next
  buy). Each buy grants **+1% wins, stacking** (×1 → ×3.0 at 200). Survives rebirth (own key
  `taw.momentum`). Pure module `src/progress/momentum.js`.
- **Wins wiring:** `momentumMult` folds into `perWordWins` as a global, rebirth-like factor — defaults
  to ×1 at 0 buys, so every pre-existing payout is byte-identical until the player buys in.
- **Shop:** a third track "MOMENTUM" sits alongside KEY POWER and WORD SENSE, reusing the existing
  hold-to-buy ritual (`HoldBuy`) and the next-goal + progress readout. Shows the running ×multiplier,
  the mark count, the next cost, and a "BUY AGAIN, FOREVER" descriptor; caps at "MAXED".

## The visible mark — the MOMENTUM RAIL (the design I chose)
The brief: 200 buys must read as **200 marks of evidence**, not a hidden 1.05ⁿ number; real SVG (ART
VS MOTION); legible 1→200; no menu-space growth; no infinite animation.

**Chosen:** a **STAGED board of flat diamond STUDS** on a thin rail under the XP bar (joining the XP
cluster — no orphan fixed UI). Each stud is real vector art — a solid diamond with a thick darker
outline and a hard offset shadow (the house flat-cartoon look).

Two rules keep it reading well at every count:
- The board WIDTH grows in stages — **10 → 15 → 20 → 30 → 50** columns (row cap 1 → 2 → 3 → 4 → 4):
  `1–10 = 10×1 · 11–30 = 15×2 · 31–60 = 20×3 · 61–120 = 30×4 · 121–200 = 50×4`.
- Only the rows actually IN USE are drawn — `ceil(count / cols)` rows — with faint outline cells filling
  just the remainder of the current partial row. So the filled studs are always a COMPLETE RECTANGLE
  plus one filling row, **never a full-width grid with empty rows sitting under it**.

Studs shrink as rows are added and the board widens; the rail's fixed 22 px height never changes.
Grouped every 10 columns (countable in tens). A purchase pops ONLY the newest stud once (one-shot flag,
like the wins stamp) — nothing loops, so the menu-motion-law holds. `null` at 0 buys (fresh menu unchanged).

**How it reads** (preview screenshot delivered):
- **1 buy** — one LARGE solid diamond, left-aligned, 9 faint cells → a deliberate single mark, not a speck.
- **5 buys** — 5 large solids + 5 faint → clearly five, half the first row.
- **20 buys** — 15-wide, 2 rows: a full row of 15 + 5 filling the second row.
- **45 buys** — 20-wide, 3 rows: two full rows + 5 filling the third.
- **80 buys** — 30-wide, 3 rows: two full rows + 20 filling the third.
- **120 buys** — 30-wide, four full rows (stage complete).
- **200 buys** — 50-wide, four full rows: a dense field of 200 studs, every 10-group legible. "Maxed."

Files: `src/components/MomentumRail.jsx` + `MomentumRail.css`; mounted in `Homepage.jsx` under the XP bar.

## Dead-stretch verification (the requirement: < 15 h for every archetype)
`claude/momentum-sim.mjs` — 200 h with BOTH sinks live (KEY POWER + MOMENTUM), earn rate compounded
by momentum's +1%/buy, buying the cheapest affordable next purchase across both tracks:

| archetype | longest dead stretch | reaches |
|-----------|----------------------|---------|
| Word Bomb main | 8.26 h | key T5 / mom 89 |
| Blitz main | 8.28 h | key T5 / mom 86 |
| SAT Rush main | **8.39 h** | key T5 / mom 91 |
| Chain main | 8.09 h | key T5 / mom 92 |
| Fuse grinder | 8.19 h | key T5 / mom 94 |

**Worst: 8.39 h (SAT Rush) — under 15 h for every archetype ✓.** Baseline before the sink was 161.6 h
(a **19× reduction**). Each archetype now gets ~90–99 reward events over 200 h (roughly one every ~2 h,
worst gap ~8 h) instead of a single 160 h wall.

## Tests + gate
- `src/progress/momentum.test.js` (5 tests): rising cost + cap, stacking multiplier, clamp/persistence,
  buy flow (deduct + refuse broke/maxed), and the perWordWins fold.
- `e2e/momentum.spec.js` (3 tests): the menu rail renders marks for a bought-in player, is absent at 0,
  and the shop track hold-to-buy adds a mark + deducts the rising cost.
- Full gate green (lint 0 errors, unit 408, e2e all pass). Build exit 0.

## Files
- New: `src/progress/momentum.js`, `src/progress/momentum.test.js`, `src/components/MomentumRail.jsx`,
  `src/components/MomentumRail.css`, `e2e/momentum.spec.js`.
- Edited: `src/progress/wins.js` (perWordWins fold), `src/progress/shop.js` (buyMomentum),
  `src/components/ShopScreen.jsx` (MOMENTUM track), `src/components/Homepage.jsx` (mount the rail).
- Tools (untracked): `claude/momentum-sim.mjs`.
