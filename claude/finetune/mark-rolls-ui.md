# MARK ROLLS UI — three reveal versions (H1 quality protocol)

Branch `feat/mark-rolls-ui`. All three versions are in the same build. Switch with `?mrv=a|b|c`; the
default is `a`. The timelines are pure data in `src/components/markRolls/revealTimelines.js`. The
lengths and hold pacing are in `revealPlan.js`. Both are unit-tested.

**Status: not screenshotted.** Memory rules for this run: no dev server, `vite preview` or Playwright.
Everything below comes from the code and the tests, not from looking at it. Andy's screenshot pass and
the adversarial reviewer decide.

## What every version shares

- **The stage.** It sits in the MARKS panel under the MAIN hero, and its nodes are pooled and mounted
  once: a face-down card, the result card, a tier-coloured flash, and a 6-slot name reel. EPIC and
  LEGENDARY results also use the **cutscene layer**: a dark plate, a 4-bar tier ladder, a tier word and
  a "1 IN X" stamp. That layer is portalled into the MARKS overlay, so it adds no new fixed element.
- **Lengths in ms.** "Rare" is the short build-up; epic and legendary are the cutscene.

  | | common | rare | epic | legendary |
  |---|---|---|---|---|
  | A | 300 | 700 | 1800 | 2500 |
  | B | 320 | 900 | 2000 | 2500 |
  | C | 300 | 650 | 1600 | 2400 |

- **Animation.** WAAPI plays every step, finite, with `fill: both`. The keyframes are transform and
  opacity only (a test checks every keyframe). `will-change` is set while a reveal plays and cleared
  when it ends, and nothing is measured. When a reveal ends its animations are cancelled, so the CSS
  rest state takes over. That rest state is also the reduced-motion state.
- **Input.** The roll runs on `pointerdown`. The reveal starts in a layout effect, so the first frame
  of the reveal is the frame after the tap. A tap during a reveal skips to the result and never queues
  a second roll.
- **Hold to roll.** It rolls again 120 ms after the previous reveal finishes, never on a fixed clock.
  It stops on EPIC+, a NEW mark, GOLD or RAINBOW, an EQUIP? question, or a short balance.
- **No spoilers.** The grid, % COLLECTED and an auto-equipped MAIN update when the reveal lands, not
  on the tap.
- **Reduced motion.** There is no animation. The static result card holds for the same time.
- **The card (rule U).** It shows the glyph, name, tier · 1 IN X, and ONE tag: MAIN ×N if worn,
  PERK +X% otherwise. Chips: NEW, GOLD, RAINBOW, or ×copies on a plain dupe. When a jump is over ×1.5
  it also shows `EQUIP? ×N → ×M` with EQUIP / KEEP.

## A — FLIP (Starr-Drop ladder) — default

- **Common:** the face-down coin squashes shut (scaleX → 0, 130 ms), then the result card opens with a
  small overshoot.
- **Rare:** the face-down coin wobbles and swells over three beats, a tier-yellow flash hits, then the
  card flips open.
- **Epic / legendary:** the dark plate covers the panel and the tier ladder climbs one bar at a time:
  COMMON, RARE, EPIC, then LEGENDARY. Each bar slams in from the left, so the player watches it
  "almost stop" at each tier. Then **1 IN X** stamps in at a tilt, the plate drops, and the card flips
  open underneath.
- **Strength:** it reads at a glance, and each step of the build-up is a word the player already
  knows. A common is a quiet little flip, so a held run of commons stays calm.
- **Risk:** the ladder at ~266 ms per step (epic) is close to too fast to read every bar. Legendary
  gets 375 ms per step.

## B — REEL (Sol's RNG cycle)

- **Every tier:** a strip of six names, coloured by tier, slides through a window and slows onto the
  result. The decoys climb toward the result's tier. Then the reel fades and the card scales in.
- **Rare:** a slower slide plus a flash.
- **Epic / legendary:** the reel decelerates for 0.9–1.4 s. Then the dark plate takes the panel, the
  tier word stamps, then **1 IN X**, and the card lands with a pop.
- **Strength:** it is the most literal Sol's RNG, and the "it's slowing down… is it?" tension is the
  genre's signature.
- **Risk:** on commons, six names pass in 260 ms. A held run of commons is a constant flicker of text
  in the busiest place on screen. The reel is also the one place that re-renders text per roll (six
  spans), which is cheap but not zero.

## C — STAMP (bounty press)

- **Common:** the card drops in from above, squashes on impact and settles.
- **Rare:** a slanted tier-colour band sweeps across the stage, then the card drops.
- **Epic / legendary:** the plate covers the panel, and **1 IN X** slams first, huge, from scale 3.
  The tier word stamps under it. The whole plate shrinks away toward the stage, and the card drops in.
- **Strength:** it has the most physical feel, and leading with the odds ("1 IN 1,000") makes the
  number itself the event.
- **Risk:** it leans on the SAT Rush print style, not the neon house look, so the menu may feel
  inconsistent. Showing the odds before the tier also gives the result away a beat early.

## Recommendation: **A (FLIP)**

1. It is the only version where a held run of commons is calm. A is a 300 ms flip, B is a text
   flicker, and C is a drop that moves the stage up and down. Hold-to-roll is where players spend the
   most time.
2. Its build-up is made of the game's own vocabulary (the tier names in tier colours), so the moment
   teaches the rarity ladder without any prose. That fits rule U.
3. Its cutscene reads at reduced attention: count the bars.

If the reviewer wants the literal Sol's RNG feel, take **B's reel for EPIC+ only** and keep A's flip
for common and rare. The timelines are per tier, so that hybrid is a ~10-line change in
`revealTimelines.js`. Drop C unless the screenshots show the stamp reads much better than expected.

## Left for Andy

- Screenshots of a, b and c at 1280×800, 1280×551 and 390×844. Each needs a common, a rare, and
  a forced epic or legendary. Seed `taw.markRolls` with `sinceEpic: 39, everEpic: true` to force an
  epic.
- Run `e2e/mark-rolls.spec.js`, which was written but never run. `e2e/marks.spec.js` was updated to
  the new tags (PERK while not worn, `ROLL · 1 IN` on locked tiles) and was not run either.
- Delete the two losing versions: their branches in `revealTimelines.js`, the `mrv-b` / `mrv-c` CSS
  rules in `MarkRolls.css`, and `REVEAL_VERSIONS`.
