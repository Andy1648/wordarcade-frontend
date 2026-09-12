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

---

## BATCH 2 — `integration/board-v2`: the two chains merged

Branch: `integration/board-v2`, cut from `feat/cut-secrets-rarity` (c3b0c1b), with `feat/wb-ring`
merged in. The two chains had been building on opposite sides of a fork for a week:

- **chain A** (`econ-curve` -> `progression-clarity` -> `cut-secrets-rarity`): the payout receipt,
  the tiered word landing, Economy v7, marks, the shared number formatter.
- **the ring branch** (`feat/wb-ring`): the Word Bomb board itself — the ring, the rails, the
  header, and `feat/type`'s build-failing type scale, which it carried along with it.

### The merge

Conflicts in exactly one file, `GameScreen.css`, four hunks, resolved by rule rather than by
taste: the BOARD LAYOUT hunk goes to the ring (it is the ring's whole subject), the two
`.hype-popup` hunks go to chain A (Batch 1 had just rebuilt the hype as a small in-flow reaction at
the field; the ring's copy was the old stage-centred banner), the last hunk keeps both.

One rename was forced: chain A's payout rail was `.wb-rail`, and the ring board already owns
`.wb-rail--left` / `.wb-rail--right` off a shared `.wb-rail` base. Chain A's is now
`.wb-receipt-rail` in both the CSS and the JSX.

### The type scale, which the merge made load-bearing

`src/perf/typeScale.test.js` came across with the ring branch and is build-failing. Chain A's
newer components were written on the other side of the fork and had never had to satisfy it —
twelve offenders across three rules. Worth recording what the fixes actually were, because two of
them are judgment calls a future reader should not have to re-derive:

- Raw font-sizes to tokens: `.hype-popup`'s `clamp(14px,1.7vw,19px)` -> `--fs-panel`,
  `.mark-icon` 26px and `.menu-mark-icon` 1.15em -> tokens.
- `Num.css`'s unit suffix KEEPS its `0.45em`. It labels the NUMERAL and has to shrink with it
  wherever the number is set — the same figure appears at `--fs-panel` in a receipt and `--fs-h2`
  on a card. The test says to justify an exception in-file rather than widen its matcher, so the
  ratio moved into `theme/type.css` as `--fs-unit` and the scale still owns it in one place.
- Three Bungee labels moved to **Space Mono 700** rather than being made bigger: `.marks-close`,
  `.mark-name`, `.stats-secret-name` sit at `--fs-body`/`--fs-label` where Bungee's counters close
  up, and `.mark-name`'s 2px stroke was filling them in completely. The rule the test states is
  "small UI text belongs in Space Mono", and that is the fix it is asking for.

### The board gate after the merge

23/23 at **2 / 3 / 4 / 8 players x 1366x768, 1280x720, 1536x864, 390x844, 320x640**. Ring at
46.1% / 48.7% / 52.4% / 71.8% / 64.6% of the stage's short side; rails equal-height with zero skew
and `railClip=none`; gutter 18-22px at two players; no page scroll anywhere; `nameStrike=none`.
All 20 shots re-shot into `claude/wb-ring-shots/` and reviewed one by one.

### What the SCREENSHOTS caught that the gates did not

**Four, and the board gate was 23/23 green on all of them.** Each fix ships with a gate that was
first checked to FAIL on the defect it describes — a gate that has never been seen red is a guess.

1. **The app-wide sound button sat on top of SKIP.** A 44x44 `position:fixed` control at
   `right:16/bottom:16`, measured 20px into SEND/SKIP at 390x844 and 320x640. A decorative control
   over the button that costs a life. This is CLAUDE.md's NO ORPHAN FIXED UI rule word for word,
   and the board gate had a check for exactly this shape of failure — pointed at `.wins-hud` **by
   name**, so it saw nothing. Naming one orphan cannot catch the next one. The gate now enumerates
   every `position:fixed` element under 40% of the viewport and checks all of them against every
   board control.
   The fix follows the precedent the menu already set: on the game view the fixed control is
   suppressed and the same component goes INLINE into the header cluster. That turned up a second
   thing worth knowing — the Word Bomb header already had its own speaker button, muting only the
   SFX engine, so the board carried two speaker glyphs controlling two different sound systems.
   Folded: the SFX mute is now a GAME SFX row of the one panel. Blitz's two headers had no sound
   control at all and now host the same slot.
   COST, and the reason this is not free: the header is CHROME, subtracted from the play area once
   by `wbRingSize`, so at a 44px button the ring at 1280x720 fell to **44.7%** of the short side —
   under the gate's own 45% floor. The button is sized to the cluster and carries its 44x44 touch
   target in an out-of-flow `::after`. Hit area and layout box are different things; only one of
   them has to be 44px.
2. **SEND and SKIP clipped their own labels.** 45px of "SEND" in a 40px inner box at 390x844; 53px
   of scrollWidth in a 45px client box at 320x640 — the D sliced in half. The buttons declared no
   `flex`, so they took the default `0 1 auto` and the row squeezed them below their own text.
   `min-width: 52px` could not save them: min-width floors the flex BASIS, and the shrink was
   happening to the content box on top of it. This is invisible to every geometry gate on the
   board, because a clipped label does not move, overlap or resize anything — the box is exactly
   where it should be and the TEXT is what does not fit.
3. **The input's placeholder was sliced mid-glyph** — "TYPE A WORI" at 320x640. The field is set at
   `--fs-panel` because the typed word is the hero of the input, but a typed Word Bomb word is 3-10
   characters and a placeholder is a sentence. Under 430px the placeholder drops to `--fs-body`;
   under a 300px board, where the field shares its row with SEND and SKIP and is left 69px of inner
   box, it trims to "WORD…" (the prompt directly above still says TYPE A WORD CONTAINING in full,
   and the aria-label is untouched). 12px -> 9px of field padding buys the last pixel: "WAIT YOUR
   TURN…" measured 132px in a 131px box.
4. **Eight seat names drawn through each other and through the 12 o'clock avatar** at 320x640. The
   name hangs out of flow under its seat with a flat 130px cap — a cap on nothing, because the space
   a seat actually owns is the chord to its neighbour, about 50px there. Now clamped to that arc at
   every size and count; and under 360px with 5+ players only the seat on the clock is named,
   because eight labels ellipsised to "PLAYE…" is not information.
   The gate's tolerance is the interesting part. The board's general overlap tolerance is 4px and
   the pre-fix collision measured **2px of box** — it passed, while on screen it read as one word
   drawn through another, because stroked 13px type fills its box and then some. Name labels get a
   required 2px GAP, not a 4px tolerance.

### The defect the FULL SUITE found that the board gate could not

The board gate was 23/23 and the shots were reviewed and clean — and the merge still had a
serious bug in it, because **the board gate never accepts a word.** Chain A's own frame gate
(`word-landing.spec.js`) failed at all three desktop viewports, and what it reported was a 14-27px
overlap. That was the symptom. The disease, found by measuring the board before and after the
word:

> **At 1280x720 the ring was 322px before the accepted word and 58px after it.**

Chain A built the payout receipt as a THIRD GRID COLUMN of chain A's board. The ring board
replaced that grid wholesale (`head / top / feed-ring-used / bot`), so `.wb-receipt-rail` matched
no area at all, fell into the implicit grid as a full-width row, and the first accepted word added
158px of board height out of nowhere. `wbRingSize` then did exactly what it exists to do and took
the height back off the only elastic thing on the board. A 58px ring, on every accepted word, on
every desktop viewport.

This is the merge failure mode worth remembering: **a selector that lost its grid area does not
error — it lands in the implicit grid**, which is a full-width row, which is the most expensive
possible default. Nothing in the type system, the linter, the unit tests or the board gate can see
it, and it only appears in a state (a word has been accepted) that the board gate does not enter.

Fixes, in the order they were found:

1. The receipt docks **absolute against the stage's bottom-right corner**. Against the stage, not
   the viewport — this is not the orphan-fixed-UI shape — so it occupies no track and can never
   take a pixel from the ring again. It sits in the gutter to the right of the input row, which is
   width-capped at 760px and centred, so on a board wide enough to have that gutter they cannot
   meet.
2. Its "hidden below 900px" rule was `(0,1,0)` and the new dock rule is `(0,2,0)`, so the dock won
   the cascade and a 152x171 receipt landed on the input row at 390x844. Specificity, not source
   order — the same trap that put the WINS pill on top of LEAVE.
3. The reaction slot **hugs the left of the field** on the rails board. Centred, it sits directly
   under the ring's 6 o'clock seat and shared 4px of box with an avatar at 1280x720.
4. On the stacked board it **lifts over the used-words strip** by that strip's measured height
   (`--wb-usedh`, written by the pass that already sizes the ring) — but only when the band above
   the strip is empty. That band is the ring, and at 320x640 the gap is smaller than the chip:
   lifting there put 16px of chip over a PLAYER CARD, at four AND eight players. Covering a seat is
   worse than covering the used-words list, so when the gap does not fit, it stays put — which is
   the trade `word-landing.spec.js` already documents and accepts, and which the shot at 320x640
   confirms reads as a chip on a list rather than as a collision.

NEW GATES:

- **the ring may not change size by more than 2% when a word is accepted.** This is the check that
  finds the disease instead of the symptom. Not zero, and the reason is worth stating: on the
  stacked board the used-words strip gains a real chip when the word lands, which is content
  changing, not a transient taking space — measured, 3px on a 247px ring. The failure it guards
  against was -82%.
- **the stacked board at EIGHT players, at both phone sizes, with a word landed.** Every other
  frame test enters at two players, and two is the one seat count where the phone board has room to
  spare: the ring is small and the band above the strip is empty. At eight the ring fills it.

### Open, not fixed — evidence for later

- **A thin teal circle, roughly 180px across, is drawn over the input row and past the board's left
  edge** at phone widths, about 300ms after an accepted word. It is not an element inside the stage
  and not a pseudo-element of one (both enumerated), so it is a pooled transient painted above the
  board from outside it. It is cosmetic and pre-dates this merge — it is in the chain A frames too
  — but it does leave the board. Carried to the Batch 5 overlay audit with this evidence rather
  than chased now.
- **The bomb appears missing in any shot taken ~300ms after an accept.** It is not: the element is
  in the DOM at the ring's centre with a 104x120 box. It is mid-animation and transparent at that
  instant. Worth knowing before someone files it from a screenshot.

### Observations, not defects — for Andy to rule on

- **A rail card whose content is one line still takes the taller card's height.** That is the rule
  agreed in round 2 (height = max of the two naturals, clamped to the play area) and it is doing
  exactly what it was asked to. The visible cost, at the START of a game: LIVE FEED holds "WAITING
  FOR ACTION…" in a 216px box, and at two players MATCH holds four rows in the same 216px. Both
  read as half-empty panels for the first few words, then fill. Equal heights or tight heights —
  the shots show both costs and it is a taste call, so it is stopped here rather than changed.
- `USED WORDS (7)` showing six chips on a phone is the cap behaving as specified (count in the
  header, newest first).
