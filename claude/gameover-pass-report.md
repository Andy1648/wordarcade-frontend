# JOB 3 — the five game-over screens, to Blitz's standard (fix/gameover-pass)

BLITZ is the model (mascot → YOU WIN! → +100 WINS → clean scoreboard → REMATCH/LEAVE, all fits).
Shots: `claude/gameover-pass/shots/{before,after}/`.

## BE-PICKY verdicts (before) and fixes
- **CATEGORY BLITZ — POLISH (model).** Unchanged.
- **WORD BOMB — BROKEN → fixed.** The full stats panel (HIGHLIGHTS + per-player WORDS/LONGEST/
  AVG LEN/TIMEOUTS/SKIPS) made the card overflow a 768/900px window, pushing REMATCH/LEAVE below
  the scroll fold — the primary action was hidden. Fix: the `.game-over-actions` are now a
  **sticky footer** (flat opaque bg) pinned to the bottom of the scroll-capped card, so
  REMATCH/LEAVE are ALWAYS visible while the stats scroll above. Verified REMATCH in-view at
  900 / 768 / 551px. Sticky is a no-op where the card already fits (BLITZ), so it is safe for all.
- **SAT RUSH "CASE CLOSED" — LOOKS UNFINISHED → fixed.** The tall paper used `margin:auto` in a
  scroll container — the flexbox centring-overflow bug clipped CASE CLOSED at the top into an
  unreachable, unscrollable cut, and the "empty lower half" was the results strip/actions still at
  opacity 0 before their reveal animation. Fix: `.sr-results { justify-content: safe center }` +
  symmetric block padding — centre when it fits, top-align (scrollable) when it overflows. CASE
  CLOSED is now fully visible and the page fills top-to-bottom once revealed; RUN IT BACK / MENU
  fit at ≥900px and are scrollable below that.
- **CHAIN / FUSE — LOOKS UNFINISHED → enriched.** The solo death card had no face. Added the
  **Mascot** (panic/slump) at the top of `.solo-deathcard`, like Blitz / Word Bomb, giving it a
  first read above the copy. (The composed mode-motif backdrop + full dim landed in the prior pass.)

## Not done
- WB game-over still bleeds a dim of the play screen through the overlay sides — but so does the
  BLITZ model (same `.game-over-overlay`), so it is consistent, not a regression.
- SAT results at <900px height still needs a scroll to reach MENU; a full fit would want the big
  ante/score/wins panels sized by `vh`. Deferred (POLISH).
