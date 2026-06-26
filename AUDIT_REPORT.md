# AUDIT REPORT — wordarcade-frontend (READ-ONLY)
_Branch: `night/audit` · 2026-06-26 · reconnaissance only — NOTHING was changed, fixed, or deleted_

> ⚠️ Branch-only scratch. This branch holds **only** this report; no code was modified. Triage with Claude tomorrow. Delete before any merge. A separate `AUDIT_REPORT.md` exists on `night/audit` in the backend repo.

Severity = likelihood × blast radius. **No Critical or High code defects were found.** The known CLAUDE.md traps are all currently CLEAN (verified — see §Known Traps). Findings are fixes worth scheduling, not fires.

---

## TOP 5 TO FIX FIRST
1. **`ImposterWordScreen.jsx:202` — unguarded `[...results.scores]`** (Medium, crash-into-render). A `vote_results` frame missing `scores`/`votes` white-screens the round. One-line `|| []` guard.
2. **`main.jsx:77` — unthrottled `resize` → full-app restyle storm** (Medium, perf). `applyAppScale` rewrites `--app-scale` on `<html>` every resize event; rAF-coalesce it.
3. **Always-on background layers during gameplay** (Medium, perf/mobile). WallScene (15 self-drawing SVGs + drifts/halftone) + ParticleField + CursorTrail keep running behind the time-critical type loop; gate the heavy decor off (or scale counts down) when `view==='game'`, esp. on coarse-pointer/small viewports.
4. **Sub-44px touch targets on non-phone viewports** (Medium, mobile a11y). `CreditsScreen.css:29` back-btn (~31px) has no `min-height` at any width; `game-leave/mute` + `lobby-back` only get 44px under `max-width:600px`, so tablets >600px miss it.
5. **`SplashScreen.jsx:131` — `role="button"`+`tabIndex` with no keyboard dismissal** (Medium, a11y). Keyboard/switch users can focus the splash but can't dismiss it. Add Enter/Space handler or drop the role.

---

## KNOWN TRAPS (CLAUDE.md landmines) — ALL CLEAN ✅
- **room_update functional setView guard:** PRESENT/correct — `App.jsx:478` `setView((prev) => (prev === 'game' ? prev : 'room'))`. No broken `if (view !== 'game')` form.
- **Screen renders off live `view`:** correct — `App.jsx:1367` `<div key={view}>`; transition overlay (`:1371`) is cosmetic `position:fixed`, never gates the screen. No `renderedView`/setTimeout-lagged copy.
- **useWebSocket FIFO queue:** correct — `useWebSocket.js:53` appends every frame, drained in order at `App.jsx:454`. No single overwriting slot.
- **Nested calc() in animationDelay:** none — JS delays are flat ms; CSS `calc()` delays are single-level.

---

## MEDIUM
- **`ImposterWordScreen.jsx:202` — [BUG] `[...results.scores]` spread with no guard** — a `vote_results` payload missing `scores` throws a TypeError into render (parent only checks `results` exists, not its shape) → white-screen mid-round. Fix: `[...(results.scores || [])]`. Same file `:184,187` — `results.votes.length`/`.map` unguarded (Low/Medium, same cause); guard with `(results.votes || [])`.
- **`main.jsx:77` — [PERF] raw `resize` listener** runs `applyAppScale` (reads layout + writes `--app-scale` on `<html>`, which transforms the whole app) on every resize tick → restyle storm during window drag. Fix: rAF-coalesce.
- **`App.jsx:1364-1365` (+ `WallScene.jsx`, `ParticleField.jsx`) — [PERF/MOBILE]** all decorative background animation keeps running during `view==='game'` (6 infinite drifts + halftone + up to 15 stroke-dash SVGs + 12 tags + 12 particle loops + cursor trail + juice canvas) — heavy always-on compositing behind the type loop on low-end mobile. Fix: gate ParticleField + heavy WallScene decor off in game; scale element counts down on small/touch viewports.
- **`juice/motion.js:73` — [DEAD] `shake()`** exported + re-exported (`index.js:18`) but never called (in-app shake is CSS `app-shake`); its `setShakeRoot`/`shakeRoot`/`getShakeRoot` plumbing (`:14`) exists only to feed it. ~25 dead lines. Fix: remove together. *(Note: the juice/ layer is a staged toolkit, so some unused surface may be intentional — confirm before removing.)*
- **`juice/particles.js:199` — [DEAD] `mark()`** exported/re-exported, never called; its whole persistent-mark subsystem (`marks[]`, `ensureBg`, `bgCanvas/bgCtx`, `drawMark`, mark branch of `onResize`) + `clearMarks()` (`:213`) are therefore dead. Fix: drop the persistent-mark layer if no planned feature needs it.
- **`GameScreen.css:1230` — [DEAD CSS] `.bomb-spark`** never referenced (distinct from the live `.bomb-spark-burst`/`.burst-spark`); its `@keyframes spark-drift` (~1238) is dead too. Fix: remove rule + keyframes.
- **`CreditsScreen.css:29` — [MOBILE] `.credits-back-btn`** padding `7px 12px` + 11px font, no `min-height` at any breakpoint (~31px) — under the 44px touch floor everywhere. Fix: `min-height:44px; display:inline-flex; align-items:center;`.
- **`SplashScreen.jsx:131` — [A11Y]** root has `role="button"`+`tabIndex={0}`+aria-label but dismissal is wired only to a `window` click listener (no keyboard handler, `:112-113` intentionally excludes it) — focusable but not operable by keyboard/switch. Fix: add Enter/Space `onKeyDown` (the keypress is itself the unlock gesture), or drop `role`/`tabIndex`.

---

## LOW
- **`App.jsx:454-842` — [BUG-hardening]** the message-drain loop reads `lastMessage.payload.*` directly with no per-message try/catch; one malformed frame throwing aborts the whole drain (Sentry boundary is the only backstop → tears down app vs skipping the frame). Fix: wrap the per-message body in try/catch + `continue`.
- **`GameScreen.jsx:1340` — [DEAD/PERF] `typingFast`** state is set (`:1353/1355`) but never read; its support refs `keyTimesRef`/`fastTimerRef` + the keystroke-counting block in `pulseInput` (`:1348-1356`) allocate an array + schedule a timeout on EVERY keypress for zero output. Fix: remove `typingFast`/refs/block (keep the `typingActive` pulse).
- **`useWebSocket.js:96` — [DEAD] `lastMessage` shim** returned but no consumer reads it. `:36` `error` state set but never read. **`useBeatSync.js:48` `isAnalysing`** computed/returned, never consumed. Fix: drop the unused returns.
- **`GameScreen.jsx:987-1078` (GameOverStats) — [PERF]** multi-pass award/leaderboard derivation (several sort/map/filter/reduce + Set/Map) runs inline unmemoized on every results-screen render. Fix: `useMemo` keyed on `gameStats`/`players`.
- **`useBeatSync.js:69-114` (+ `useMusicPlayer.js:133-178`) — [PERF]** rAF loop writes 3 `:root` custom props every frame whenever music plays (incl. in-game), invalidating style for every subscriber. Fix: only write a var when its rounded value changes; pause halftone reactivity in game.
- **`juice/particles.js:55-59` — [PERF]** `onResize` is passive (good) but not throttled — re-rasters both canvases + redraws every mark per event. Fix: trailing rAF.
- **`juice/audio.js:202` `unlockAudio()` + `index.js:21-27` barrel re-exports (`setMotion`/`setSound`/`getSettings`/`prefersReducedMotion`) — [DEAD]** never consumed. Fix: trim the barrel.
- **`GameScreen.css:188/216`, `LobbyScreen.css:31` — [MOBILE]** `.game-leave-btn`/`.game-mute-btn`/`.lobby-back-btn` only get 44px inside `@media (max-width:600px)`; ~24-28px on touch tablets >600px. Fix: move `min-height:44px` to base rule or gate on `@media (pointer:coarse)`.
- **`index.css:185-186` — [DEAD CSS]** `.homepage-burst`/`.homepage-speedlines` appear only in a reduced-motion reset list; nothing defines them. Fix: drop from the list.
- **`GameCard.jsx:17` — [DEAD-borderline]** `topper` prop fully wired but no caller passes it (Homepage.jsx:194) → branch unreachable. Fix: remove, or keep as an intentional hook.
- **`LobbyScreen.css:141` / `PublicRoomsScreen.css:158` — [A11Y]** `::placeholder` `#ccc`/`#BBB` on light fill ≈1.6-2:1 contrast — effectively invisible. Fix: darken to ~`#8a8a8a`.
- **`App.jsx:531` — [INFO]** spectator-reaction removal `setTimeout` has no cleanup, but App is the never-unmounting root, so no unmounted-setState risk. No action needed.

---

## CLEAN CATEGORIES (checked, nothing to report)
- **React keys / collisions:** sibling lists correctly namespaced (`impact-`/`ko-`/`explosion-`, `fly-`/`shatter-`); index keys only on static/append-only lists. No collision hazard.
- **Effect deps:** intentional omissions are eslint-disable-documented and read live values via refs (no stale closures).
- **High-frequency handlers:** CursorTrail (30ms throttle, 30-node cap, passive), WallScene/TransitionIntro pointermove (rAF + reduced-motion/coarse gating), App pointerover (70ms debounce) — all clean except `main.jsx` resize (above).
- **Console hygiene:** clean — only `useWebSocket.js:57` `console.error` + `:80` `console.warn` (legit error paths). No raw `console.log`/`debugger`/TODO/FIXME in `src/`.
- **prefers-reduced-motion:** comprehensive (global block + per-file reduce blocks).

---

## DEPENDENCY / SECURITY (`npm audit`, read-only — no fix applied)
- **2 vulnerabilities (1 moderate, 1 high), both DEV-only build deps:**
  - `esbuild <=0.24.2` (moderate, GHSA-67mh-4wv8-2f99) — dev server can be made to send requests + read responses. Dev-time only.
  - `vite <=6.4.2` (high) — depends on the vulnerable esbuild. Dev/build only; not shipped to users.
- Fix requires `npm audit fix --force` → `vite@8` (a **breaking** major bump) — do NOT run unattended; schedule a deliberate Vite upgrade + build/test pass. Production runtime is not exposed (these are not in the client bundle).
- No obviously-unused runtime deps flagged; the dead juice surface above is first-party code, not packages.
