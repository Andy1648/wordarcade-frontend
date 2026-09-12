# OVERNIGHT RUN — 2026-09-12

Rails held: no merge to main, no push to main, no deploy, no backend. Branches + reports only.
Taste calls are built BOTH ways, screenshotted, and stopped for Andy.

STATUS: in progress. Newest entries at the bottom of each batch.

---

## BATCH 1 — five defects on `feat/cut-secrets-rarity`

All five reproduced in one frame before touching anything (`1280x720`, rare word landing).
Pinning `Math.random = () => 0.99` was necessary: the hype phrase is random, so the frame Andy
saw is not otherwise reproducible — a layout gate on a random draw is not a gate.

| # | Defect | Root cause | State |
|---|--------|-----------|-------|
| 1 | "FINGERS BLESSED" banner huge + diagonal over prompt / card / title | `.hype-popup` was stage-centred at `top:42%`, up to 48px, scaled to **1.6x** and rotated **±15°**. Measured worst case: a **904x371** box over the title, prompt and a player card simultaneously. | fixed |
| 2 | PAID 0 under five live multipliers | The caller passed the BANKED amount, which is 0 for the first two words of a round (3-word gate). The panel printed a total that contradicted every row above it. | fixed |
| 3 | Breakdown panel over the prompt box | It floated (`position:absolute` above the input row). | fixed |
| 4 | Title reads "WORD BOME" | **Same cause as #1** — see below. | fixed |
| 5 | Duplicate ghost of the landed word, bottom-left | The accept toast (`NICE! "MINSTREL" ACCEPTED`) says the word again, far from the word, at the same moment the landing shows it with its band and payout. | fixed |

### #4 — the shared cause Andy asked about

There is one, and it is #1. Andy listed three stray-paint bugs in this area (the bomb glyph in the
stat row, the pointer arm through ANDY, this). The shared cause is not a single element — it is a
**pattern**: a decorative element positioned in absolute/stage coordinates rather than anchored to
the thing it is about, whose box then grows past what its author pictured.

- pointer arm: a beam sized off the ring's radius, run through the band where a seat's name lives.
- hype banner: a phrase rotated 15°. **Rotating a wide element adds bounding-box height in
  proportion to its width** — a 900px line tilted 15° gains ~230px of box. That is how a "banner"
  reached a title 400px away, and its stroked letters are what took the right bowl off the B,
  leaving a stem and three bars: an E.

Measured proof, worst-case phrase at 1280x720: `hype box = [188,131,904,371]`,
`overTitle: true, overPrompt: true, overCard: true`. After the fix: `[535,573,363,57]`, all false.

The standing rule this run enforces: **a transient element is anchored to the element it is about,
sized so "at" is a real constraint, and gated against every protected box at every viewport.**

### What the SCREENSHOTS caught that the gates did not

Three, and every one of them was green on numbers first:

1. **The RARE stamp drawn straight through the hype word.** `.wl-stamp` is absolutely positioned
   and overhangs its chip, and `getBoundingClientRect` on an ancestor does **not** include an
   out-of-flow descendant that overflows it. Gating `.wl` could never see the stamp. The gate now
   names `.wl-stamp` and `.wl-wins` directly.
2. **The hype word painted through "USED WORDS (0) / NONE YET".** Text over text, unreadable. This
   is what killed the hype-plus-landing pairing: side by side they needed ~100px above the field and
   a 1280x720 board has ~60px. Resolved by design rather than geometry — **one reaction per word**:
   the hype is the COMMON-word reaction, the landing takes over from UNCOMMON up. They were saying
   the same thing anyway, and the landing says it better.
3. **The docked rail pushed the phone board past the bottom of the screen.** The overlap gate
   measured transients against the STAGE, and the stage had simply grown taller than the viewport —
   so nothing "overlapped". The gate now measures page scroll and stage-below-fold too, and the rail
   is hidden under 900px (the round breakdown on the end screen is where a phone reads it).

Also caught by the numbers once they were pointed at the right thing: the rail's reserved width was
taken out of the middle column and narrowed the input until its own placeholder clipped by 6px at
1280x720 (`wb-short-layout`). The width now comes out of the bomb column, which has slack.

`parity-wb-blitz` "combo RESETS when I lose a life" failed once in the full run and passed 3/3 on
re-run — recorded as flake, not a finding.

**Gate:** `e2e/word-landing.spec.js` — 4 viewports x {no transient over prompt / input / player
card / title, nothing off the board, no page scroll, title intact, PAID == rounded product of the
listed rows, zero accept toasts}. Shots in `claude/wb-frame-shots/`.
