# JOB 2 — Fill the winning direction (ART-LED → ART-LED v2)

**Target:** new `public/proto-cards-3.html` (branch `proto/cards-3`). PROTOTYPE ONLY —
the live `GameCard` is untouched. Job 1's winner (ART-LED) pushed until every card is
composed for its own mode, art bleeds off the edges, the mode colour carries flat
tonal depth, and the type is bigger. Measured the same way (pixel largest-empty-rect,
`claude/_tools/cap.mjs`). Screenshots in `claude/card-fill/shots/`.

## What changed vs Job-1 art-led (per-mode, not one template)
- **WORD BOMB** — the bomb now *craters the bottom-left edge* (r=140, half off-frame), the
  fuse arcs to a spark-burst that crops the top-right corner, letter tiles crop the left
  and right edges. A darker-orange flat wedge gives the field depth. FEATURED corner ribbon.
- **CATEGORY BLITZ** — brain scaled 2.15× as the centre hero, five bolts crop all four
  edges, flat darker-blue wedge behind. AI-JUDGED corner ribbon.
- **SAT RUSH** — re-composed as a **manga masthead**, not a bottom scrim: "SAT RUSH" ink
  title + double-rule at the top, full-bleed speed-lines from a low focal point, a huge
  82px "5×" in the one violet spot colour, and 60px SAT tiles as the hero. Genuinely a
  different *layout*, not a recolour. (Fixed a title/badge collision found in the first pass.)
- **CHAIN** — the chain now runs **wall-to-wall**, links cropping both side edges; E/R tiles
  enlarged; handoff arrow up top.
- **FUSE** — the burnt cord runs the **full width off both edges**, the flame burns off the
  **right edge** (2.1×), the AIN fragment tile is the centre hero.
- **Locked state upgraded** — instead of dimming to near-black (data-forward's failure), the
  scene stays *visible* (saturate .55 / brightness .62), the gate text is white-on-shadow, and
  the mode name stays **bright** in the bottom bar. A locked card still reads as its mode.

## Largest empty rectangle — BEFORE (Job-1 art-led) → AFTER (v2)

| Mode | @1920 | @1366 | @390 |
|---|---|---|---|
| word-bomb | 9.3 → **7.9** | 10.4 → **10.3** | 10.5 → **10.3** |
| category-blitz | 5.3 → 5.9 | 4.1 → 4.9 | 4.7 → 5.0 |
| sat-rush | 4.7 → **1.6** | 3.9 → **1.6** | 4.1 → **1.2** |
| chain (locked) | 7.6 → **6.0** | 6.8 → **5.6** | 7.4 → **6.1** |
| fuse (locked) | 8.6 → **6.9** | 7.3 → **5.7** | 7.5 → **6.6** |

**Worst cell: 10.3%** (word-bomb) — comfortably under the 18% "clean" line at every width;
**no card has a large empty region.** SAT RUSH more than halved (4.7 → 1.6). category-blitz
ticks up ~0.5pt because the bigger brain leaves two small pockets beside the neck — still
5%, still clean.

Honest note: art-led *already* passed the fill bar in Job 1 (that's why it won), so the
headline here isn't a dramatic %-drop — the real deliverable is **per-mode composition,
edge-bleed, bigger type, and a locked state that isn't empty**. The number confirms the
fill held (and improved) while the composition got specific.

## BE-PICKY re-check
- Largest empty rectangle: **PASS** all modes/widths (≤10.3%).
- Set, not template (#4): **PASS** — SAT is a different layout; the four neon scenes each
  bleed differently. You could not generate these by swapping a hue.
- Locked legibility (#11): **PASS** — scene visible, gate white-on-shadow, name bright.
- Type hero (#5): **PASS** — titles up to 40px, two-line, ink-stroked.
- One nit remaining (POLISH): SAT's ink masthead sits over the top of the speed-lines; the
  double-rule separates it and it reads, but a faint cream backing would harden it. Left as
  a knob for the real port.

**Stranger, first second:** "five different posters that clearly belong to the same game —
and the manga one is doing its own thing on purpose."

Before/after: `shots/row-1920.png`, `shots/row-390.png`, `shots/empty-rect.json`.
