# JOB 3 — The menu as one composition (poster critique)

**Target:** the live Homepage menu (branch `chore/menu-critique`). REPORT ONLY — nothing
implemented. Captured via the e2e backend mock + `gotoMenu` (skips intro, freezes motion),
at **1920×1080, 1568×675, 390×844**. Shots in `claude/menu-critique/shots/`.

Judged as a **poster / single image**, not as a set of components.

---

## Where the eye goes
1. The pink **"TYPE A WORD"** wordmark (brightest thing, top-centre).
2. The warm **orange WORD BOMB** card (only warm mass in a cool field).
3. …then it **pinballs** — yellow SHOP chip, cyan JOIN ROOM, the white manga SAT card — with
   no designed second/third read. There is no path; there is a hero and then scatter.

## What is competing
- **Background graffiti** (WORD / BOOM / NOOB / WOW / RIP / EPIC + paint blobs) fills the dark
  margins as low-contrast static. It's texture with no hierarchy — it competes with the cards
  for the eye in the very regions that should recede.
- **Stray yellow accents** with no rhythm: SHOP (yellow), ROOKIE (yellow), FEATURED (yellow),
  the LV chip — four unrelated yellow spots scattered around the frame.
- The **XP bar** draws a thin horizontal line straight across the composition, cutting the
  wordmark off from the cards rather than joining them.

## Dead space (measured by eye against the three frames)
- **The empty 6th grid cell (bottom-right).** Five cards in a 3+2 grid leave one hole. At
  1920 and especially at **1568×675** this is the single largest dead zone in the image — a
  whole card's worth of black bottom-right, with one stray teal splatter floating in it.
- **The top-left corner** is empty (only faint "WORD" graffiti), while the top-**right** holds
  the SHOP/STATS/audio cluster — so the top reads lopsided.
- **The margins flanking the wordmark** at the top — big dark gaps left and right of it.

## The three questions
- **Is the wordmark doing enough?** At 1920, nearly — but it *floats*, with dead air on both
  sides and nothing anchoring it. At **390 it loses hero status entirely**: it shrinks, wraps
  to "TYPE A / WORD", and sits shoulder-to-shoulder with the SHOP button in a cramped top strip.
- **Is the XP row carrying its weight?** **No.** It's the weakest horizontal in the picture —
  a skinny centered bar plus two lines of small text ("TYPE ANYWHERE TO EARN XP", "NEXT BOLT
  FRAME LV 3"). It reads as the *gap* between the header and the cards, not as a band of its own.
- **Does the corner cluster balance the composition?** It **tips it right.** There is no
  left-side counterweight, so the top-heavy right cluster unbalances the frame; on mobile it
  actively collides with the wordmark's space.

## Also seen (hand-off to Jobs 4/5, not this report's job)
- **BROKEN @1568×675:** the WORD BOMB and CATEGORY BLITZ **`SOLO/MULTI` badge clips off the
  card's bottom edge** — the card is too short for its content at 675px height.
- The card *internals* being mostly empty flat fields is the Job 1/2 problem; this critique is
  about the whole image, so it's noted, not re-argued.

---

## The ONE change that would most improve it as a whole image

**Promote the featured mode (WORD BOMB) to a large HERO tile that spans the empty 6th cell —
turning the flat 3+2 grid of five equal cards into a composed "1 hero + 4 supporting" poster.**

Why this one, above the others:
- It **kills the largest dead zone** (the empty bottom-right cell) by design, not by
  decoration — the grid becomes intentional instead of "five things and a hole".
- It **creates the missing hierarchy**: right now every card is the same size so there's no
  second read. A hero tile gives the eye an unambiguous 1 → 2 → 3 path (hero → supporting row →
  actions) and finally justifies the existing FEATURED flag with actual visual weight.
- It **re-balances the frame**: a big warm hero mass on the left anchors against the top-right
  control cluster, and the wordmark now sits *on top of a structured grid* rather than floating
  above a lopsided one.
- One layout change, cascading fix.

**Other levers I considered and did *not* pick (per "one change"):**
- *Mascot in the top-left void* — great for brand + left/right balance, but leaves the empty
  6th cell untouched; smaller whole-image win than the hero tile.
- *Fold the XP strip into a real header block under the wordmark* — fixes the weak middle band
  but not the dead grid cell.
- *Tighten/remove the margin graffiti* — removes static but doesn't add structure.

Recommend the hero tile; the mascot-anchor is the natural second move once the grid is composed.

Shots: `shots/menu-1920x1080.png`, `shots/menu-1568x675.png`, `shots/menu-390x844.png`.
