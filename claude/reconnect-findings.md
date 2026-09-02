# JOB A — reconnect recovery (feat/reconnect, TIER-1, branch-only)

## 1. Reproduce — what a mid-round drop looks like TODAY
Mock-WS harness: reach a live Word Bomb turn, then `dropClient()` (close the socket) mid-round.
**Result (before):** within ~2s a full-screen **CONNECTION LOST** overlay appears — *"You were dropped
from the game. Your seat is gone — hop back to the menu to play again."* — whose **only** action is
**BACK TO MENU**. The board is rendered behind it but the game is dead, and **no reconnect is even
attempted** (auto-reconnect was gated OFF during a session). One socket blip = the game is over.
(`claude/reconnect-shots/before-drop.png`, `claude/_tools/repro-drop.mjs`.)

## 2. The blocker: rejoin-to-a-LIVE-game is impossible with existing messages
Checked the backend (`chain-reaction-backend/roomManager.js` `joinRoom`): a `join_room` on a room whose
game is live returns **`{ error: 'game_already_started' }`** (guarded by `isGameLive`), and every socket
is a **fresh player id with no resume**. So the existing protocol **cannot** put a dropped player back
into the *same live game* with their seat/lives/score. Per the instruction, I **stop the live-rejoin
part** and specify the message it would need:

> **PROTOCOL CHANGE NEEDED (backend):** a **`rejoin_room { code, playerToken }`** message.
> - The server issues a `playerToken` in the first `connected`/`room_update` for a seat; the client
>   persists it (sessionStorage) for the current game.
> - `rejoin_room` looks the token up in the live room and **rebinds the existing seat** to the new
>   socket (same player id, lives, score, turn position) — bypassing the `game_already_started` guard
>   for a KNOWN prior player only. Without a token match it falls through to the normal rejection.
>
> This is the only way to truly resume a live seat; it is a backend change and out of scope for this
> frontend branch.

## 3. What I implemented (frontend, existing messages only)
A two-phase reconnect that never dead-ends and never loses earned progress:

- **Auto-reconnect is now always allowed** (the hook already does exponential backoff 1→2→4→cap 8s +
  jitter); the old "block reconnect during a session" gate is removed, because the drop is now
  orchestrated instead of surrendered.
- **Phase 1 — `RECONNECTING…`** (`claude/reconnect-shots/1-reconnecting.png`): the instant the socket
  leaves `open` during a session, a RECONNECTING overlay shows **with the board still mounted behind
  it** (verified: `game-player-bar` present). A hard 12s deadline backs it so a socket that never
  returns still lands somewhere sane.
- **Rejoin-by-code:** when the socket comes back, the client sends the existing `join_room { code }`.
  - A **waiting/finished** room accepts it → the overlay clears and the player is back
    (verified: rejoin `room_update` → overlay gone).
  - A **live** room replies `game_already_started` (or the room is gone → `room_not_found`) → phase 2.
- **Phase 2 — wins-preserved landing** (`claude/reconnect-shots/2-lost-wins-safe.png`): *"Couldn't get
  back into that game — it moved on without you. **Your wins are safe**; jump back to the menu."* +
  BACK TO MENU. **Never a blank screen.** Wins are genuinely safe because they are **banked to
  localStorage per accepted word** (`bankWordWins`), independent of the socket — a drop cannot lose
  them, and `goHome` resets only React state, not the stored wins.

## 4. Verification
- Reconnect flow both outcomes (`claude/_tools/verify-reconnect.mjs`): `[fail]` drop → RECONNECTING
  (board kept) → reconnect → `join_room` → `game_already_started` → CONNECTION LOST (wins-safe) + BACK
  TO MENU. `[ok]` → `room_update` → overlay gone (restored).
- Gate: build ✓ · lint 0 errors · unit **415** · e2e websocket-boundary + coverage + word-bomb-scoring
  + gameover-coverage **24/24** (no existing test asserted the old drop behaviour, so none modified).

## 5. Net effect
Before: one blip = instant game-over. After: a real reconnect attempt with the board intact, an
actual rejoin for any non-live room, and — for the live case the protocol can't resume — a calm,
wins-safe landing instead of a knockout. Full live seat-restore is unlocked by the one backend
message above.

**TIER-1, BRANCH ONLY — needs a 2-device play-test before merge** (this touches App.jsx's WS
lifecycle: the reconnect gate + two guarded hooks in the drain for the rejoin outcome).
