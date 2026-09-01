# JOB 11 — Micro-interaction & micro-detail audit (REPORT ONLY)

Date: 2026-09-01 · Branch: chore/micro (off main) · No code changed.
Fine-grained pass on the small stuff — focus/press feedback, keyboard reachability, micro-copy —
distinct from the layout sweep (JOB 4) and comprehension pass (JOB 7).

## MOSTLY A CLEAN BILL OF HEALTH

**Keyboard focus is fully covered — app-wide.** 13 component CSS files have `:hover`/`:active` but
no focus rule of their own, which looked like a gap — but `src/index.css:77` defines a global
`:focus-visible { outline: 3px solid #FFE94A; outline-offset: 2px }` catch-all that reaches every
native button, input, link, and `role="button"` card/splash. `:focus-visible` (not `:focus`) keeps
the ring off mouse/touch presses so it never fights the flat look. WCAG 2.4.7 is satisfied. **Not a
gap** — recording it so it isn't "found" again.

**No keyboard-inaccessible controls.** Every primary action is a native `<button>`. The only three
`<div onClick>` in the codebase are convenience overlays, each with a keyboard equivalent:
`game-wrap` (tap-to-fast-forward the win celebration), and the two dialog scrims (`lp-scrim`,
`mode-dialog-scrim`) — both dismissable with **Escape** (wired in the dialog components). Nothing a
keyboard user can't reach.

**Press feedback is broad and consistent.** 21 CSS files carry `:active` translate/shadow presses
and 16 carry `:hover` lifts — the hard-offset-shadow cartoon idiom is applied consistently across
buttons, cards, and chips.

**WINS labeling is better than JOB 7 implied (a correction).** The menu wins chip does carry an
`aria-label` ("N wins. Open shop", `MenuXp.jsx:146`) AND there is a one-time 3-second
"WINS BUY UPGRADES IN THE SHOP" explainer on first appearance (`MenuXp.jsx:225`). So screen-reader
users and first-timers-who-read-the-hint are covered. JOB 7's finding narrows to: **no PERSISTENT
VISIBLE "WINS" label** next to the counter after that one-time hint — still worth the tiny fix, but
it's not "never named."

## THE ACTUAL MICRO NITS (small, safe, batchable — a "chore/micro" fix branch's punch-list)

1. **WB player avatar clips the name "YOU" to two lines ("YO / U").** The fixed-size avatar circle
   wraps a 3-letter name. Small but visible every WB turn. Fix: `white-space:nowrap` + shrink the
   avatar font, or drop the name from the avatar (the card already labels YOU/RIVAL beside it).
   Shot: `claude/wb-blitz-look/shots/wb-play-settled-mobile.png`.
2. **SAT menu card's big "5×" has no word.** Reads as an unfinished label rather than a reward.
   Fix: "5× WINS" (one word) so a cold viewer parses it. (Also noted JOB 7.)
3. **No persistent visible "WINS" label** by the HUD/shop counter (see correction above). Fix: add
   the word next to the coin in the HUD chip and the shop header — a few characters.
4. **"NEXT · BOLT FRAME · LV 3" is unexplained jargon** on the menu (unlock-ladder teaser). Micro-copy
   fix or a tooltip; low harm. (Noted JOB 7.)

## NOT MICRO (pointers, don't fix here)
The ~150px empty band above the menu cards (JOB 12) and the ragged 5-card set (JOB 7) are layout,
not micro — they belong to a menu-layout job, not this punch-list.

## BOTTOM LINE
Micro-interaction and micro-a11y are in genuinely good shape — global focus ring, consistent press
feedback, no orphan clickables, Escape on dismissables. The only true micro nits are the four copy/
label items above, all tiny and safe to batch. Report only; nothing changed.
