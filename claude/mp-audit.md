# JOB 15 — two-player end-to-end audit (chore/mp-audit, REPORT ONLY)

Walked the full two-player Word Bomb path against the code (`App.jsx` WS drain →
`useGameSocket`, backend `roomManager.js` create/join/start/submit/leave, `gameLogic.js`).
Multiplayer is the mode the game is named around and has had the least design attention;
below is every state that is confusing, unhandled, or silently wrong — plus what's
actually solid, so the fixes don't break it.

## What's SOLID (don't regress)
- **Host reassignment on leave** (`roomManager.js:~1058`): host leaving hands the role to a
  non-bot player; an empty or all-bot room is torn down with its timers. No brick.
- **Turn doesn't hang on a drop**: a Word Bomb disconnect advances the turn so the game
  progresses (`removePlayer`, in_progress branch).
- **The three documented traps are guarded** (functional `setView`, live-`view` render, FIFO
  message queue) — the machinery that keeps the non-host from getting stuck at start.
- **Local reject is same-frame** for the 3 client-determinable cases (too_short / missing
  fragment / already_used); only `not_a_word` round-trips.

## HIGH — confusing / broken
1. **You cannot rejoin a live game.** `joinRoom` returns `game_already_started`
   (`roomManager.js:192`) once the game is live, and seats are keyed by `connection.id`
   (no persistent token). So a player who drops for 2s (school wifi — the common case) is
   **out for good**, and a friend who taps the code just after START gets a bare
   `game_already_started` error with no "the game already started" affordance. *(This is
   Job 11; feat/reconnect-2 designs the fix.)*
2. **A disconnect is an instant, silent elimination.** In Word Bomb, `removePlayer` sets the
   dropped seat `eliminated = true; lives = 0` immediately — no grace window, no
   "RECONNECTING…" hold. From the other player's side an opponent simply vanishes and they
   win by default; from the dropped player's side they just lost, with no explanation. The
   two most common real-world multiplayer events (a blip, a backgrounded phone) both resolve
   as a silent loss.

## MEDIUM — dead-ends / asymmetry
3. **Rematch is host-only.** `resetGame` (host-triggered) is the only rematch path. If the
   host leaves after game-over, the remaining player has **no way to play again** except
   leave + re-create + re-share a new code. The non-host never sees a working "rematch"
   affordance.
4. **The start handoff is a runtime-only fragility, not a code-review-catchable one.** The
   `game_started` → `room_update` pair arrives in one tick; only the FIFO queue + functional
   `setView` stop the non-host being stranded on the waiting screen. This passes every static
   check and has frozen prod before — so any change near `App.jsx`/`useGameSocket`/
   `useWebSocket` MUST be re-validated with the 2-device REGRESSION CHECKLIST, not a diff read.
5. **Late-join has no lobby-return.** Beyond the bare error (#1), there's no "this room is
   mid-game — wait for the next round / spectate" state. The second human is just bounced.

## LOW — worth a live check
6. **Blitz leaver mid-round**: the leaver is filtered from `game.players`; if they were the
   only opponent, confirm the round/scoreboard/game-over resolves cleanly for the one
   remaining player (simultaneous mode has no turn to advance, so verify it doesn't wait).
7. **`not_a_word` latency**: the only reject that round-trips; on a slow connection the
   buzz/shake lands a beat late vs the 3 local rejects. Minor feel inconsistency.

## Recommended priority
Fix **#1 + #2 together** (they're one change — the rejoin protocol + a disconnect grace
window, designed in `claude/reconnect-2-design.md`): it converts the single most common
multiplayer experience (a network blip) from "silent loss" to "back in the game." Then **#3**
(a non-host rematch request, or auto-offer rematch to whoever remains). #4 is a standing
process rule, not a code change. All Tier-1 — verify each with the mock-WS harness AND a
2-device play-test before merge.
