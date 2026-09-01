# JOB 23 — Error boundaries: assessment (REPORT, mostly already done)

Date: 2026-09-01 · Branch: chore/error-boundaries-check (off main) · No code changed.

## FINDING: the core of JOB 23 already ships.
`src/main.jsx:89` wraps the whole app in a **`Sentry.ErrorBoundary`** with an on-brand
**`CrashFallback`** ("SOMETHING BROKE." + a Space-Mono line + a reload button, on the #0d0618
ground, Bungee/pink). It stands up BEFORE mount (`initSentry()` first), so an early render crash is
both **caught** (no white screen — the fallback shows) and **reported** to Sentry when a DSN is set
(dormant no-op otherwise). This is exactly the "a render crash must never white-screen the app"
guarantee JOB 23 exists to provide. **It's done at the level that matters.**

## THE ONLY GAP: granular per-screen recovery — and it has a Tier-1 edge
The current boundary is app-level and all-or-nothing: any render crash drops the player to the
full-screen fallback and a **reload** (losing the session). A finer net would wrap individual routes
so a crash in one screen shows a "this screen broke — back to menu" without nuking everything.

Split by risk:
- **SAFE (Tier 2/3), if wanted:** wrap the non-multiplayer surfaces — Shop / Stats overlays and the
  solo modes (CHAIN / FUSE / SAT). They own no WebSocket or room state, so a boundary that catches
  and returns to menu is self-contained. Modest incremental value over the app-level fallback.
- **TIER-1 (do NOT do autonomously):** wrapping the GAME / ROOM / LOBBY screens. A boundary there
  that "returns to menu" must ALSO leave/close the room and unwind WS + view/state lifecycle
  (App.jsx handlers, the documented functional-setView / FIFO-queue traps). A naive boundary that
  resets `view` without cleaning up the socket/room leaves the player in a half-joined ghost state.
  This needs the App.jsx WS-lifecycle owner + a 2-device play-test, per the Tier-1 rules.

## RECOMMENDATION
JOB 23 is effectively satisfied — ship-blocking crash coverage exists. Treat granular boundaries as
optional polish: the safe overlay/solo boundaries could be added in a small Tier-2 pass if desired,
but the high-value game/room recovery is Tier-1 and belongs with the App.jsx WS work (near JOB 20
app-split / JOB 27 reconnect), reviewed and play-tested. No autonomous change made here — adding a
boundary around live game/room screens without the lifecycle cleanup would be a net risk, not a win.
