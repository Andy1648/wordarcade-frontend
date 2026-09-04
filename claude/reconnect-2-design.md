# JOB 11 — reconnect, properly (feat/reconnect-2, BOTH repos, Tier-1, BRANCH ONLY)

## Diagnosis (why feat/reconnect can't rejoin a live game)
`feat/reconnect` shipped socket backoff + a RECONNECTING overlay, but rejoining a
STARTED game is impossible because:

1. **The backend rejects re-entry.** `roomManager.js joinRoom` returns
   `game_already_started` once `isGameLive(room)` (lines 192 / 691). There is no
   other door into a live room.
2. **Identity is the socket, not the player.** A seat is keyed by `connection.id`
   (per-connection). A reconnect is a NEW socket → a NEW id → the old seat is
   unreachable. There is no persistent player token anywhere.
3. **A disconnect HARD-ELIMINATES the seat.** In the Word Bomb `in_progress` branch
   of the disconnect handler (`roomManager.js:~1075`), a dropped player is set
   `eliminated = true; lives = 0` and their turn is advanced immediately. So even if
   re-entry were allowed, the seat is already dead — score/turn/lives are gone.

This is the actual failure players hit on school wifi: a 2-second drop ends their game.

## The minimal protocol addition
Two new messages + one persistent token. Everything else is additive; the existing
join/create/turn flow is byte-identical when no drop happens.

### 1. `playerToken` (persistent seat identity)
- On `createRoom` and `joinRoom`, the server generates a `playerToken` (a random
  128-bit id, unrelated to `connection.id`) and stores it on the seat:
  `room.players[i].token`. It is returned to that client ONCE in the existing
  `room_created` / `room_joined` payloads (add a `you: { token }` field).
- The client persists it in `sessionStorage` keyed by room code
  (`wa_seat_<CODE>`), so a page reload / socket drop keeps it, but it doesn't leak
  across rooms or survive the tab.

### 2. Disconnect → GRACE, not elimination (the Tier-1 core)
Replace the immediate `eliminated = true; lives = 0` in the Word Bomb disconnect
branch with a **grace hold**:
- Mark the seat `disconnected = true, disconnectedAt = Date.now()` (KEEP lives).
- If it is the disconnected player's turn: DON'T eliminate — advance the turn so the
  game doesn't hang, but leave their lives intact and their seat in the roster
  (rendered "RECONNECTING…" to others via a flag in `turn_update`).
- Start a **grace timer** (`RECONNECT_GRACE_MS`, propose 30s). If it fires before a
  rejoin, THEN run the existing elimination (`eliminated = true; lives = 0`,
  advance/again) — i.e. the current behaviour, just delayed by the grace window.
- Category Blitz (simultaneous, no turns): keep the seat in the roster during grace
  instead of filtering it out (`game.players = game.players.filter(...)` → set the
  `disconnected` flag instead); the round timer keeps running, so a returning player
  simply resumes answering with whatever time is left.

### 3. `rejoin_room { code, playerToken }` (the new door)
A new server handler, tried BEFORE the `game_already_started` gate:
- Find `room` by `code`; find the seat by `token`. If none, or the grace window has
  already elapsed (seat eliminated), fall through to the normal `join`/error.
- **Reclaim the seat**: point the seat's `connection` at the new socket, update its
  `id` to the new `connection.id` everywhere it's referenced (roster + `game.players`
  — both key on `id`), clear `disconnected`/`disconnectedAt`, cancel the grace timer.
- **Resync**: send the client the current live state so it renders exactly where the
  game is — reuse `buildTurnUpdatePayload(room)` (it already carries `currentPlayerId`,
  per-player `lives`, `currentTimerSeconds`, `usedWords`, the fragment). For Blitz,
  resend the round state + scoreboard. No new payload shape needed.
- Broadcast a `turn_update` to the room so everyone drops the "RECONNECTING…" flag.

### 4. Frontend flow
- `useWebSocket`: on a socket reopen while `view === 'game'` and a stored
  `wa_seat_<CODE>` token exists, send `rejoin_room { code, playerToken }` INSTEAD of
  re-running the join.
- App: on the resync `turn_update`, stay in / return to the `game` view with the
  restored state (the existing FIFO drain already applies `turn_update` → the HUD;
  the only new piece is not treating "already started" as a dead end).
- Keep the RECONNECTING overlay from feat/reconnect; clear it on the resync frame.

## Files to change
- **Backend** (`chain-reaction-backend`): `roomManager.js` (token issuance in
  create/join; the disconnect grace branch; the `rejoin_room` handler + grace timer
  + timer map), `server.js` (route the `rejoin_room` message), `gameLogic.js` (seat
  carries `token` + `disconnected`; `buildTurnUpdatePayload` includes a `disconnected`
  flag per player).
- **Frontend** (`wordarcade-frontend`): `useWebSocket.js` (rejoin-on-reopen),
  `App.jsx` (store `you.token`; don't dead-end on re-entry; clear overlay on resync).

## Verification (the harness, before ANY merge)
Add a mock-WS harness spec: create → start a Word Bomb → DROP the non-host mid-turn →
assert the seat stays in the roster with its lives during grace → `rejoin_room` with
the token → assert the client returns to the SAME game with score, turn order and
lives intact, and the grace timer is cancelled. Then the mandatory **2-device live
play-test** (background the phone ~3s mid-round, foreground → back in the same game).

## Why this is design-only in this session
The core change edits the live disconnect/elimination path — the codebase's most
freeze-prone logic, whose CLAUDE.md rule mandates a 2-device live play-test after every
Tier-1 change. That play-test cannot run in an automated session, and the Tier-1 rails
("DIAGNOSE before fixing; if you cannot verify, STOP and report") take precedence over
shipping. This spec is execution-ready for a play-test-equipped session; nothing above
is speculative — every hook (joinRoom gate, disconnect branch, buildTurnUpdatePayload,
the FIFO drain) is cited from the current code.
