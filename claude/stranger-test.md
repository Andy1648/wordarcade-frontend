# STRANGER TEST — the first 60 seconds (JOB 9)

Branch `chore/stranger-test`. Cleared localStorage, 390×844, no `?portal=1`. Screenshots in
`claude/stranger/01…07.png` in the exact order a new visitor sees them. Harsh on purpose.

## The sequence they actually see
1. `01-first-paint` / `02-splash-3s` — a black screen, the "TYPE A WORD" wordmark, a bomb mascot
   lighting a fuse, and **"Lighting the fuse…"**. A real loading screen with personality.
2. `03-after-tap` / `04-menu-firstrun` — the menu: XP bar (LV1 · 10/120 · 0 wins), "TYPE ANYWHERE
   TO EARN XP", a NEXT-unlock teaser, then the WORD BOMB (orange) and CATEGORY BLITZ (blue) cards,
   a third card peeking, and a big JOIN ROOM button.
3. `05-typed-on-menu` — typing on the menu earns XP (the caption pays off).
4. `06-first-card` — tapping WORD BOMB opens a clean dialog: "Beat the bomb", an EXAMPLE
   "TRA → TRAIN", and a big PLAY button.

## What would confuse them
- **The wordmark collides with the SHOP button.** At 390px the title reads "TYPE A WO" with the
  yellow SHOP chip sitting over the "RD" (`04-menu-firstrun`). First impression of the brand name is
  that it's cut off. This is the single worst first-impression detail. (It passes viewport-integrity
  because SHOP is `position:fixed` and excluded from clip checks — the test is blind to it.)
- **"20 WINS / WORD" before you know what a WIN is.** Every card and the mode dialog quote a wins
  rate, but a 0-wins newcomer has no model for wins yet (the shop that spends them is one tap away
  but unexplained). The number reads as noise on run one.
- **JOIN ROOM is the biggest button on the menu but is the wrong door.** The cards are the primary
  action; JOIN ROOM (bottom, full width, high-contrast) is secondary and leads to a room *browser*
  ("SCANNING FOR GAMES…", `browser` screen), not into a game. A stranger drawn to the loudest button
  lands in an empty-feeling list instead of playing.

## What looks unfinished
- The **third card peeking below the fold is cream/print-styled with a "LIMITED" tag** while the two
  above it are neon stickers — the visual language changes mid-list, which reads as two different
  apps stitched together (it's the SAT-Rush retro sub-style, intentional in isolation, jarring as a
  menu sibling).
- Nothing is broken-broken; the app is more *polished-but-drifting* than *unfinished*.

## What would make them close the tab
- Nothing hard-fails. The realistic bail risk is **tapping JOIN ROOM → an empty room browser →
  "there's nobody here" → leave**, having never seen that the cards are the way in. Second risk is
  the clipped wordmark reading as low quality before they engage.

## The single best thing they see
**The loading screen** (`01-first-paint`): the bomb lighting its own fuse under a hand-painted
wordmark with "Lighting the fuse…". It has more character than most games' entire onboarding, and it
sets the Newgrounds tone instantly. The WORD BOMB **dialog** (`06`) is a close second — "TRA → TRAIN"
teaches the whole mechanic in three characters.

## Fixes worth making (for the owner, not done here — this is REPORT ONLY)
1. Stop the wordmark colliding with SHOP at ≤400px (scale the title down, or reserve the corner-nav
   width). Highest impact for the lowest effort.
2. Make the primary action unmistakable: de-emphasise JOIN ROOM on first run, or relabel it, so the
   cards are clearly "play" and JOIN ROOM is clearly "join a friend's code".
3. One-line "what are WINS?" the first time they're shown, or hide the wins rate until after run one.
