# JOB 9 — WORD BOMB vs CATEGORY BLITZ in-game look (REPORT ONLY)

Date: 2026-09-01 · Branch: chore/wb-blitz-look (off main) · No code changed.
Captured the two competitive modes MID-PLAY at 390×844 and 1440×900 via the mock.
Shots: `claude/wb-blitz-look/shots/` (`wb-play-settled-*`, `blitz-play-settled-*`).

CAPTURE NOTE (same gotcha as JOB 4's WB-gameover): both play screens run a turn/round-start
countdown that DIMS the whole screen for ~4s. `cap-ingame.mjs` waits only 1.4–1.7s, so its
`wb-play`/`blitz-play` frames caught the dimmed "1" countdown and look broken. The real resting look
needs a ≥4.5s settle (`cap-wb-blitz-settle.mjs`) — the `*-settled-*` shots. Not a bug; a tooling note.

## VERDICT: both are strong. WB edges it on character; Blitz trails only on mascot presence.

Both screens are vivid, on-brand, one-screen-fit at 390px, and share the same chrome (the "N WORDS
TO EARN" wins pill top-right, audio + LEAVE, the same input/SEND treatment) — good cross-mode
consistency. Neither has a layout defect on mobile portrait (the shippable view). This is a
look-comparison, not a defect hunt; nothing here needs a fix.

### WORD BOMB — the more alive of the two
- **Hero = the bomb mascot** (real asset, angry face, lit fuse, live "22" timer) dead-center. It's
  the screen's focal point and gives WB its personality.
- Fragment prompt "TYPE A WORD CONTAINING · STR" in a bordered orange box, big and legible.
- USED WORDS chips, SEND (cyan), SKIP · -1 LIFE (yellow) — clear, complete, juicy.
- Player cards: YOU (orange, active-turn highlight + YOUR TURN badge) vs RIVAL (purple), hearts as
  lives. Reads instantly. (Tiny nit: the "YOU" name inside the small avatar wraps to "YO / U".)

### CATEGORY BLITZ — clean and clear, but text-forward
- **Hero = the category text** ("CRYPTIDS & FOLKLORE MONSTERS", big yellow). The mascot is a small
  element tucked in the category box's top-right corner — easy to miss.
- ROUND 1/3 badge, "NAME AS MANY AS YOU CAN", NEW CATEGORY (reroll) button, a horizontal timer bar
  + "45s", input/SEND, YOUR ANSWERS chips, OTHER PLAYERS list. Everything needed, well-ordered.
- Timer metaphor differs from WB (bar+seconds vs the bomb's countdown number) — appropriate to each.

## THE ONE ASYMMETRY WORTH NAMING
**Mascot presence.** WB puts a big animated character at the heart of the screen; Blitz relegates
its mascot to a ~40px corner glyph and leans entirely on type. The result: WB feels like a *character
moment*, Blitz feels like a *form*. Both are legitimate, and Blitz's category-as-hero is defensible
(the category IS the content). But if the goal is parity of *feel* between the two headline
competitive modes, Blitz is the one with room to grow — a more present mascot beat (a reaction on a
correct answer, say) would close the juice gap without touching its clean layout. Flagging as an
intent call for a future feature job, NOT a fix.

## DESKTOP
Both render as the same centered phone-width column on a wide dark canvas (consistent with JOB 4's
desktop observation). Intentional given the mobile-first target; no action.

## BOTTOM LINE
Two well-built game screens. WB is the juicier; Blitz is the cleaner. The only substantive
observation is the mascot-presence gap — a feel/parity opportunity, not a defect. Report only.
