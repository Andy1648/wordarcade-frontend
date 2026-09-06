# JOB 15 — error boundary granularity (fix/error-boundaries)

One global boundary meant a single screen's crash blanked the whole app (exactly what the Stats
ReferenceError and React #310 did). Now every screen + overlay has its OWN boundary, so a crash stays
local. Gate: build 0, lint 0 errors, unit 439/439, e2e boundaries 3/3, regression (menu-xp + mode-dialog
+ dialog-quality + solo-dict) 21/21.

## What shipped
- **`ScreenBoundary.jsx` / `.css`** — a per-screen boundary (Sentry.ErrorBoundary + an on-brand inline
  panel: 🧨 "THIS SCREEN BROKE" / "A quick step back usually fixes it. Your progress is safe." / a
  working **← GO BACK** button). It reports to Sentry (tagged with the screen name) and the panel
  covers only its own screen box (`position:absolute; inset:0`), so the shell + other screens stay
  mounted and interactive. Sentry.ErrorBoundary catches + renders the fallback even with no DSN.
- **`App.jsx`** — the active `screen` (menu / any game screen / shop / stats / credits / room / lobby /
  browse / sat / chain / fuse) is wrapped in a `ScreenBoundary` keyed by `view`, so each screen gets
  its own boundary instance. GO BACK returns to the menu (`goHome`); the menu's own boundary reloads
  (nowhere to go back to from home).
- **`Homepage.jsx`** — each menu OVERLAY (the mode dialog, the locked-preview, the rank ladder) gets
  its own boundary too, so a dialog crash shows the panel and GO BACK closes it without blanking the
  live menu behind.

## Test seam + tests
A `?boom=<name>` URL param (same family as `?soloms=` / `?coldstart=` / `window.__TAW_*`) makes the
named boundary throw during render — self-inflicted, recoverable, only the current viewer's own screen.
`e2e/error-boundaries.spec.js` (3, green):
1. a crashed GAME SCREEN (`/chain?boom=chain`) shows the panel; **GO BACK recovers to a live menu**
   (game cards present, panel gone).
2. a crashed MENU (`/?boom=home`) is caught inline — the app is not blanked; GO BACK is present.
3. a crashed OVERLAY (mode dialog) shows the panel while the **menu behind stays mounted** (proving
   isolation).

The global `Sentry.ErrorBoundary` in `main.jsx` is kept as the ultimate catch-all beneath these.
