# JOB — decompose App.jsx (refactor/app-split, TIER-1, branch-only)

## Honest status
App.jsx is **2275 lines** on main. I branched `refactor/app-split` and did the full structural +
dependency analysis below. **I did NOT ship a code extraction**, and here is exactly why — with the
evidence — plus the concrete, de-risked plan to execute it safely.

## The blocking finding: the WS-drain effect is coupled to ~51 App-owned dependencies
The core of App.jsx is ONE `useEffect` (lines 785–1321, ~536 lines, keyed `[messages,
consumeMessages]`) that drains the FIFO message queue and handles every server frame. Measured, it
references:
- **34 state setters** — `setView, setRoom, setGameState, setTimerSeconds, setLastWordResult,
  setGameOver, setGameType, setGameNonce, setFeedEvents, setTypingText, setReactions, setMyId,
  setPublicRooms, setRoomClosedNotice, setServerError, setServerEventId, setWinsTally, setWinsWords,
  setWinsEarnedTotal, setGameStats, setCategoryRound, setMyAnswers, setPlayerProgress, setRoundResults,
  setCategoryScores, setCategoryTotals, setCategoryRerolls, setLastReroll, setCheckingAnswer,
  setDailyState, setDailyResult, setIsDailyGame, setLinkJoinPending` (+ `setTimeout`).
- **18 refs** — `feedCurrentRef, feedPrevLivesRef, feedReasonRef, myIdRef, myNameRef, myWbAcceptedRef,
  myWbWeightRef, myBlitzAcceptedRef, myBlitzWeightRef, myOutstandingWordsRef, gameModeRef,
  gameDifficultyRef, gameStartMsRef, categoryTotalsRef, dailyStateRef, playerCountRef, reactionIdRef,
  rerollKeyRef`.
- ~16 module imports (`bankWordWins, awardWordXp, rarityOf, track, snd*`, …) — these move with the
  code, not a concern.

**Crucially, that ONE effect writes state that belongs to ALL FOUR target hooks:** `setView` →
`useOverlays`; `setRoom/setPublicRooms/setMyId/setServerError/setRoomClosedNotice/setServerEventId` →
`useRoom`; `setDailyState/setDailyResult/setIsDailyGame` → `useProgressionEvents`; everything else →
`useGameSocket`. So the WS handler is inherently CROSS-CUTTING — it cannot be "moved into
useGameSocket" without that hook reaching into the other three's state.

## Why I did not mechanically extract it now
1. **Coupling** — a verbatim move needs a ~51-field dependency bag and a rename of every `setX(` /
   `xRef` across 536 lines. That volume of mechanical rename on the single most dangerous file is
   exactly where a subtle scope error hides.
2. **The file's history** — App.jsx caused 3 production freezes; the CLAUDE.md notes the key-collision
   freeze "passed every code check and still froze." So the e2e harness is necessary but NOT sufficient
   proof — the file's own rule is a **2-device live play-test after every Tier-1 change**, which I
   cannot perform in this session.
3. **Environment** — this session's `npm ci` just hit the documented `EPERM esbuild.exe` corruption and
   a killed gate; not the moment to land a 536-line god-effect move.

Shipping a rushed, un-play-tested 51-dependency extraction would be the precise pattern that froze prod
before. The safe unit of work here is a STAGED refactor with a play-test between steps.

## The de-risked plan (ownership map + safe order)
Target: App.jsx becomes composition-only; the drain stays whole (never split mid-effect) but lives in
`useGameSocket`, which RECEIVES the other hooks' setters — so the cross-cutting writes are explicit and
the effect body is unchanged.

1. **`useOverlays` (safest first, smallest)** — owns `view` + `transition` + the shop/stats/rebirth
   view routing + `goHome`/the bar-wipe. Returns `{ view, setView, transition, goHome, ... }`. The
   drain calls the returned `setView`. Verify: full harness (view transitions are exercised by every
   spec) + 2-device play-test of every screen swap.
2. **`useRoom`** — owns `room, publicRooms, lobbyMode, lobbyPublicDefault, myId, serverError,
   roomClosedNotice, serverEventId` + the create/join/quickplay/leave send-handlers + the one-shot
   guards. Returns those + their setters. Verify: `websocket-boundary`, `coverage` (ROOM/LOBBY/BROWSE)
   + 2-device create/join play-test (the exact freeze surface).
3. **`useProgressionEvents`** — owns the Daily-Challenge state (`dailyState/dailyResult/isDailyGame` +
   `dailyStateRef`) and the menu XP/wins/rebirth celebration consumption. Verify: `daily` specs + a
   daily play-test.
4. **`useGameSocket` (last, largest)** — owns `useWebSocket` + the WHOLE drain effect + the in-game
   state (game/feed/blitz/wins-in-game + the 18 refs). Receives `setView` (from useOverlays), the
   room setters (useRoom), and the daily setters (useProgressionEvents) as params. The effect body and
   its `[messages, consumeMessages]` dep array move VERBATIM — the functional-`setView` guard, the FIFO
   drain, and the live-`view` render are preserved because nothing inside the body changes.

**Guardrails per step (from the instruction):** run the full mock-WS harness after each extraction;
every existing test must pass UNMODIFIED — if a test needs a change, behaviour changed → revert that
step. Then the mandatory 2-device play-test (REGRESSION CHECKLIST) before the branch is merged.

## Recommendation
Execute this in a focused session with the 2-device play-test available between steps, in the order
above (each step is independently shippable + revertible). The analysis here removes the discovery risk;
what remains is the careful, play-tested mechanical work that this file specifically requires. App.jsx
line target after all four: composition + render only, roughly ~700–900 lines (the ~536-line drain and
its state move into `useGameSocket`).
