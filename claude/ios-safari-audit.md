# JOB 16 — iOS Safari (WebKit) audit (fix/ios-safari)

Walked every screen in **Playwright WebKit 26.5** (UA: iPhone OS 15, iPhone 13 viewport 390×844,
DPR 3, touch) against the production build. Tooling: `claude/ios/audit.mjs` (+ `audit-result.json`,
screenshots in `claude/ios/shots/`). Build 0.

## Headline: the app is already in good iOS shape
- **No horizontal overflow on any screen** (menu / chain / fuse / sat) — layout matches Chromium; the
  WebKit menu screenshot is pixel-faithful to desktop.
- **Viewport height is correct** — `#root` height == `window.innerHeight` (664) on every screen; no
  over/under-tall root.
- **Capability probe (real WebKit support):** `dvh ✓  svh ✓  visualViewport ✓  serviceWorker ✓`.
- Only console output is a benign **local-only 404** (`/_vercel/insights`, the Vercel analytics beacon
  absent on the preview server) — not present on production, not an iOS issue.

## Already correct (verified, left as-is)
- **AudioContext** (`src/audio/audioCore.js`) is exemplary for iOS: `window.AudioContext ||
  window.webkitAudioContext` with a `!AC → return false` no-op guard (so an unsupported/headless engine
  never throws), `resume()` on a suspended context, AND a `visibilitychange` re-resume for iOS's
  background-suspend. No change needed.
- **dvh** is already used across 8 stylesheets (Homepage, Shop, Stats, Solo, Collection, Achievements,
  RankLadder, GameScreen).
- **Service worker** (VitePWA) registers and WebKit reports `serviceWorker: true` — iOS Safari supports
  SWs, so the offline shell works (with Safari's known storage-eviction caveats).

## Fixed (unambiguous)
The remaining raw **`100vh`** usages are the one real iOS gotcha headless can't reproduce (there's no
dynamic URL bar in Playwright): on a real iPhone, `100vh` counts the collapsed-URL-bar strip, making
full-height wrappers over-tall. Added a `100dvh` fallback line after each (dvh wins on WebKit 15.4+,
falls back to `100vh` on older iOS):
- `src/index.css` — the html root + `#root` `min-height`.
- `CreditsScreen.css`, `LobbyScreen.css`, `PublicRoomsScreen.css`, `RoomScreen.css` — the
  `calc(100vh / var(--app-scale))` full-screen wrappers.
(The other `vh` values in `GameScreen.css` are animation transforms — `translateY(100vh)` confetti,
`130vh` max-height ceilings — not viewport-fit heights, correctly left alone.)

## Needs a REAL device (cannot be verified in headless WebKit)
Headless WebKit has no soft keyboard, no dynamic URL bar, and (in this build) no working AudioContext,
so these want a physical iPhone/iPad pass:
1. **Soft-keyboard behavior on the in-game input** — does the input stay visible when the iOS keyboard
   opens, and do any `position:fixed` HUD controls get pushed/occluded? The app leans on native
   scroll-into-view + dvh; only `CgArmScreen` uses a `visualViewport` shim. Confirm the Word Bomb /
   Blitz / solo input isn't hidden under the keyboard on a real device.
2. **AudioContext actually producing sound after the first tap** — the resume logic is correct, but
   headless can't play audio; confirm the splash gesture unlocks audio on real iOS.
3. **Momentum scrolling** in the shop/stats/collection scroll regions (modern WebKit has it by default;
   confirm it feels right).
4. **Service-worker offline** behavior across an iOS Safari cold start + Add-to-Home-Screen.
