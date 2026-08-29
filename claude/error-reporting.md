# ERROR TELEMETRY AUDIT (JOB 19)

Branch `feat/error-reporting`. Sentry (`@sentry/react` v10) is installed and initialised in
`main.jsx` (`initSentry()` before mount; dormant with no `VITE_SENTRY_DSN`).

## What was ALREADY captured
| Error class | Captured? | How |
|---|---|---|
| **Render crash** (a component throws) | ✅ | `Sentry.ErrorBoundary` wraps the app root (`main.jsx:89`) + shows `CrashFallback` instead of a white screen. |
| **Unhandled promise rejection** | ✅ | Sentry's default `globalHandlers` integration installs `unhandledrejection` automatically (no app code needed). |
| **Uncaught error** (`window.onerror`) | ✅ | Same default integration. |

There is NO explicit `addEventListener('unhandledrejection'/'error')` in app code — it relies on
Sentry's defaults, which is correct and sufficient (verified: `Sentry.init({dsn})` enables them).

## What was SILENTLY SWALLOWED (try/catch, no capture) — the gaps
These are try/caught for graceful degradation, so they were invisible in telemetry:
1. **Audio-context / analyser failure** (`useMusicPlayer.ensureAnalyser` catch) — kills beat-sync +
   music analysis for the session.
2. **Terminal WS drop during an active room/game** (`useWebSocket` `onerror`, reconnect-disallowed
   branch) — the player is stranded on the disconnect overlay.
3. **localStorage failures** (~30 sites, all `try { … } catch {}`) — a blocked store (private mode)
   is expected + fine, but a **QuotaExceededError** means progress can no longer be saved.

## What I ADDED (PII-safe, deduped, non-blocking)
New helper `reportError(tag, err)` in `lib/analytics.js`:
- **PII-SAFE:** never sends the original error message (it can carry typed words / user text) — only
  a static `swallowed:<tag>` label + the error CLASS/code as tags.
- **Deduped** once per tag per session (a repeating failure can't flood Sentry).
- No-op when Sentry is dormant; wrapped so reporting can never throw into the app.

Wired at the two React-layer gaps:
- `useMusicPlayer.js` → `reportError('audioctx-analyser', e)` on analyser-graph failure.
- `useWebSocket.js` → `reportError('ws-terminal', …)` on a terminal mid-session drop ONLY (routine
  cold-start retries never reach that branch, so no cold-start noise).

## NOT wired, and why (owner decision)
- **localStorage QuotaExceededError.** The obvious home is the save path in `progress/xp.js`, but
  that module is deliberately **pure / framework-free** (unit-tested under `node --test`, no Sentry
  import) — importing analytics there would break that contract and the node tests. The right fix is
  a small non-pure `safeStorage.set(key,val)` wrapper that all `progress/*` modules call, which
  reports a QuotaExceededError once. That's a broader refactor (~30 call sites) — left for review.
- **Routine WS errors / reconnects** — intentionally NOT reported (cold-start blips are expected;
  only the terminal in-session drop is worth a signal).

## Verification
- Build exit 0; lint 0 errors; unit tests pass (the pure modules are untouched — the two wired
  files are hooks, already outside the node-test set).
- e2e `websocket-boundary` still green (the WS error path change is additive).
