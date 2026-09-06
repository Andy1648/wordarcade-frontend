# Stale-Closure / Missing-Dependency Audit

**Summary:** ~70 hook calls scanned across `src/` (≈58 `useEffect`, 9 `useCallback`/`useMemo`, plus the custom hooks built on them). **Real bugs found: 0.** **Benign / intentional omissions: 10 notable cases (all listed below).** **`react-hooks/exhaustive-deps` disables: 10** (all justified).

The known-intentional App.jsx `room_update` case is present in its CORRECT functional-`setView` form (NOT rewritten to read `view` directly) — verified, see the Benign section. No effect was found in the broken `if (view !== 'game')` shape.

---

## REAL BUGS

None found. Every effect/callback that omits a value it reads either (a) reads it through a ref, (b) reads it through a functional state updater, (c) reads a value that is stable for the lifetime of the component (e.g. `myId`, `onComplete`, `sound`), or (d) is a deliberate mount-only timeline. No omission was found that can produce wrong runtime behavior.

---

## BENIGN / INTENTIONAL

Ordered roughly by how "interesting" the omission is (most likely to alarm a reviewer first).

### 1. `src/App.jsx:249` — the big WebSocket message effect — deps `[lastMessage]`
- **Omitted from deps:** `view` (read indirectly), plus many state setters/refs.
- **Why staleness would matter:** if the `room_update` branch read `view` directly (e.g. `if (view !== 'game')`), a `room_update` landing just after `game_started` would read a stale `view` and kick non-host players back to the waiting room.
- **Verdict:** BENIGN / INTENTIONAL. This is the documented CLAUDE.md case. The code uses the correct live-read form at line 265: `setView((prev) => (prev === 'game' ? prev : 'room'))`. Everything else the effect touches is a stable setter or ref. `[lastMessage]` is the complete, intended dep list (each message processed exactly once). Correct as written — do NOT "fix" it.

### 2. `src/components/GameScreen.jsx:1263` — heart-shatter / elimination diff — deps `[gameState, gameType]`
- **Omitted from deps:** `myId`, and the in-component functions `freeze` / `flashBombPose`.
- **Why staleness would matter in theory:** `shatterIds.some((id) => id !== myId)` decides whether the bomb mascot taunts; a stale `myId` could mis-attribute "an opponent went down."
- **Verdict:** BENIGN. `myId` is assigned once on the `connected` message (App.jsx:253) and never changes for the session, so it is effectively constant by the time any game runs. `freeze`/`flashBombPose` are plain functions recreated each render but only call `setState` + touch refs (lines 1202, 1216), so a "stale" copy behaves identically. No wrong behavior possible.

### 3. `src/components/GameScreen.jsx:1245` — bomb accept/reject interaction — deps `[lastWordResult, gameType]`
- **Omitted from deps:** `freeze`, `flashBombPose` (and it reads `submitTimerRef.current` / `lastSubmitWordRef.current`, but those are refs).
- **Verdict:** BENIGN. Guarded by an identity check on `lastWordResult` (fires once per submission); the omitted helpers are setState/ref-only and stable in effect. Refs are intentionally dep-free.

### 4. `src/components/GameScreen.jsx:1159` — clear draft when it stops being our turn — deps `[isMyTurn]` (eslint-disable at 1166)
- **Omitted from deps:** `onTypingUpdate`.
- **Verdict:** BENIGN / INTENTIONAL. `onTypingUpdate` is a fresh closure each parent render; the author deliberately fires this only on the `isMyTurn` transition. `onTypingUpdate` ultimately calls `send(...)` from a `useCallback([])` stable function, so the stale closure relays correctly. Documented in-code.

### 5. `src/components/GameScreen.jsx:1128` — duck music volume — deps `[gameOver, musicSetVolume]`
- **Verdict:** BENIGN. `musicSetVolume` is `useMusicPlayer`'s `setVolume`, a `useCallback`-stable function. Fully specified.

### 6. `src/components/GameScreen.jsx:1142-1143` — `onShakeRef` ref-mirror pattern
- **Note:** `onShake` is held in a ref (`onShakeRef.current = onShake`) so the sound effects at lines 1430/1448 can call `onShakeRef.current?.(...)` without listing `onShake` as a dep.
- **Verdict:** BENIGN / INTENTIONAL and correct — the ref is reassigned every render so it's never stale. Documented in-code.

### 7. `src/hooks/useMascotPose.js:32` and `:56` (eslint-disables at 51, 67)
- **Omitted from deps:** `flash` (a setState/ref-only helper). The deps `[gameState, myId, gameOver]` / `[lastWordResult, gameState, myId, gameOver]` actually cover every reactive value read.
- **Verdict:** BENIGN. `flash` is stable in effect (setState + ref only). Both effects are guarded by ref-based identity/diff checks. No staleness consequence.

### 8. `src/components/GameScreen.jsx:348` & `src/components/ImposterWordScreen.jsx:60` — countdown `onStep`/`sound` per-step beep — deps `[index]`
- **Omitted from deps:** `onStep` (GameScreen) / `sound` (Imposter) and `COUNTDOWN_STEPS`/`CD_STEPS` (module-level constants, never change).
- **Verdict:** BENIGN. The callbacks are stable-enough at the call site and the array is a module constant. Reacting only to `index` is the intent.

### 9. Mount-only timeline / lifecycle effects (deps `[]`, intentional)
All read only stable props (`onComplete`, `sound`) or are pure mount/unmount teardown:
- `src/components/TransitionIntro.jsx:52` (disable at 83) — schedules the whole intro timeline once; `onComplete` is stable from App, guarded by `completedRef`.
- `src/components/LoadingScreen.jsx:102` (disable at 119) — `onComplete` stable, reacts to `status` flip; reads stable callback.
- `src/components/ImposterWordScreen.jsx:138` (disable at 146) — `ImposterReveal` one-shot reveal timeline; `sound`/`onShake` stable.
- `src/components/ImposterWordScreen.jsx:246` (disable at 249) — `ImposterGameOver` win/lose sting once; reads `iWon`/`sound` captured at mount (component is remounted per game), correct.
- `src/components/GameScreen.jsx:335`, `490`, `735`, `272`(KOOverlay), `2187`, `2237`, and `ImposterWordScreen.jsx:46` — interval/timeout setups and pure unmount-cleanup effects; no reactive reads.
- `src/hooks/useWebSocket.js:30` (`[]`), `useMusicPlayer.js:61`/`:86` cleanup, `useSoundEffects.js:556` cleanup, `useMascotPose.js:71` cleanup — all lifecycle-only.
- **Verdict:** BENIGN. Standard mount-only patterns; nothing reactive is read.

### 10. App.jsx supporting effects — all fully/correctly specified
- `:240` beatCount shake (disable at 246) — reacts to `beatCount`; `triggerShake`/`prevBeatRef` are stable (function + ref). BENIGN.
- `:592` toast auto-dismiss `[lastWordResult, gameType]`, `:606` view-wipe `[view]`, `:622` ws-open wipe `[wsStatus]` — each uses refs for the "previous" value it needs and lists every reactive dep. `sound` is stable. BENIGN.

(Other small effects — `GameScreen.jsx:1014`/`1352`/`1373`/`1391`/`1414`/`1430`/`1441`/`1448`/`1459`/`1150`, `ImposterWordScreen.jsx:75`/`149`/`348`/`371`, the `CountUp` effects, `CategoryBlitz` effects at `2162`/`2181`/`2191`/`2200`/`2230` — all list their reactive deps and use refs for prior-value bookkeeping; the only omissions are stable `sound`/setters/refs or constant `myId`. All BENIGN.)

---

## `eslint-disable react-hooks/exhaustive-deps` INVENTORY

| # | File | Line | Justified? | Note |
|---|------|------|-----------|------|
| 1 | `src/App.jsx` | 246 | YES | `beatCount`-only shake; `triggerShake`/ref are stable. |
| 2 | `src/hooks/useMascotPose.js` | 51 | YES | `flash` is setState/ref-only and stable; real deps listed. |
| 3 | `src/hooks/useMascotPose.js` | 67 | YES | Same; guarded by `prevResultRef` identity check. |
| 4 | `src/components/GameScreen.jsx` | 348 | YES | Countdown per-step beep reacts to `index`; `onStep` stable, steps are a const. |
| 5 | `src/components/GameScreen.jsx` | 1166 | YES | Intentional: fire `onTypingUpdate('')` only on `isMyTurn` transition; `send` is `useCallback`-stable underneath. |
| 6 | `src/components/ImposterWordScreen.jsx` | 60 | YES | Countdown beep reacts to `index`; `sound` stable, `CD_STEPS` const. |
| 7 | `src/components/ImposterWordScreen.jsx` | 146 | YES | `ImposterReveal` mount-only reveal timeline; `sound`/`onShake` stable. |
| 8 | `src/components/ImposterWordScreen.jsx` | 249 | YES | `ImposterGameOver` mount-only win/lose sting; component remounts per game. |
| 9 | `src/components/LoadingScreen.jsx` | 119 | YES | Reacts to `status` flip; `onComplete` stable from App. |
| 10 | `src/components/TransitionIntro.jsx` | 83 | YES | Mount-only intro timeline; `onComplete` stable, guarded by `completedRef`. |

All 10 disables are justified. None hides a real missing-dependency bug.

---

## Verdict
No real stale-closure bugs. The codebase consistently uses three correct patterns to keep effects lean: functional state updaters (`setView(prev => ...)`, `setX(prev => ...)`), refs for "previous value" diffing and for unstable callbacks (`onShakeRef`), and `useCallback`/ref-backed stable APIs (`send`, `useMusicPlayer`, `useSoundEffects`, `sound`). The CLAUDE.md-flagged `room_update` handler is present in its correct functional form.
