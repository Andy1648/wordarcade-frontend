# Portal readiness checklist — Poki & GameDistribution

Covers the two portals that need an SDK integration, plus the two cross-portal verification items
from Job 4 (cover images, ?cg=1 zero-click entry).

---

## Cover images — VERIFICATION (Job 4 item)
**Status: DATED — regenerate before any portal submission.**
- The ONLY social/cover asset in the repo is `public/og-image.png` — 1200×630, last modified
  **Jun 24**. The five-poster **card redesign** (forged-chain / braided-rope card art, double-rule
  frames, the SAT bounty-poster look) landed late Aug → Sep. So og-image.png **predates the current
  art** and no longer represents the game.
- There is no separate set of "three cover images" as files in the repo — only og-image.png plus
  `apple-touch-icon.png` and `favicon.png` (icons, not covers). Treat og-image.png as the one cover
  that exists, and produce the portal sizes below from the current art.
- **Regeneration source:** render the current menu (the five poster cards) and the SAT RUSH
  wanted-poster screen — those are the strongest current surfaces — and composite the wordmark
  (Bungee Shade, #FF4FA3, black stroke) over the dark bg (#0d0618). Regen requires a live render of
  the app; not done in this pass (deferred to avoid contending with the running audits). Once
  regenerated, replace og-image.png and export the per-portal sizes.
- **Sizes needed:**
  - Open Graph / Twitter: **1200×630** (replace og-image.png).
  - CrazyGames: 16:9 cover (**1920×1080**) + square icon (**512×512**).
  - itch: **630×500** cover.
  - Poki: portal supplies its own frame; provide a **16:9 key art** + **square icon**.
  - GameDistribution: **512×512** + a **16:9** thumbnail.

## ?cg=1 zero-click entry — VERIFICATION (Job 4 item)
**Status: code path INTACT (static verification). Live re-check recommended.**
- `src/cg/cgEntry.js` parses `?cg=1` → `CG_ENTRY` (unit-tested in cgEntry.test.js).
- `src/App.jsx`: initial view is `'cg-arm'` when `CG_ENTRY` (App.jsx:257); `SKIP_INTRO` includes
  `CG_ENTRY` (no splash/intro); on socket open the cg effect programmatically runs create_room →
  set_game_type → set_difficulty → add_bot (App.jsx ~1547+), so the player is provisioned into a
  solo-vs-bot game and arms straight into gameplay — **zero menu clicks**. The room_update/cg-arm
  guard uses the functional `setView` (App.jsx:921) so the arm state isn't kicked to 'room'.
- LIVE CHECK (do before submitting): load `https://typeaword.com/?cg=1`, confirm you reach the
  arm/gameplay state with no clicks and 0 console errors, on desktop and mobile. (Deferred here to
  avoid CPU contention with the running audits.)

---

## POKI — integration checklist
Poki requires the **Poki SDK**; it is **NOT integrated yet** (no `poki-sdk` / `PokiSDK` reference
in src). Before a Poki submission:
- [ ] Add the Poki SDK (`poki-sdk` npm or their script) and call `PokiSDK.init()` at boot; gate the
      app start on the returned promise.
- [ ] Report loading progress and call the "loading finished" signal when the app is interactive.
- [ ] Wrap gameplay: `PokiSDK.gameplayStart()` when a round begins, `gameplayStop()` when it ends /
      the player returns to menu. Map these to the WB/Blitz/solo round lifecycle.
- [ ] Commercial break between rounds: `await PokiSDK.commercialBreak()` before starting the next
      game (mute your own audio around it — see below).
- [ ] Optional rewarded break for a bonus (`rewardedBreak()`), if you add a reward hook.
- [ ] Remove/disable your own external links and any non-Poki ads inside the Poki build.
- [ ] HTTPS only, responsive (already OK: 360px+), and audio muted while a break/ad is showing and
      while the tab is blurred.
- [ ] Build: use the isolated **portal build** (`npm run build:portal` → `dist-portal/`, no service
      worker) so the SW never registers inside Poki's iframe.

## GAMEDISTRIBUTION — integration checklist
GameDistribution requires the **GD SDK**; **NOT integrated yet**. Before a GD submission:
- [ ] Add the GD SDK with your game key (`window.GD_OPTIONS = { gameId, onEvent }`) and load
      `html5.api.gamedistribution.com/main.min.js`.
- [ ] Handle `SDK_READY`, then start the game; call `gdsdk.showAd()` (interstitial) between rounds
      and `gdsdk.preloadAd`/`showAd('rewarded')` for any rewarded flow.
- [ ] Fire `SDK_GAME_START` / `SDK_GAME_PAUSE` around gameplay; pause audio during ads.
- [ ] Serve from the **portal build** (iframe-safe, no SW).
- [ ] Provide 512×512 + 16:9 art (see Cover images above).

## Cross-portal general readiness (already satisfied unless noted)
- [x] Runs in an iframe with no top-level navigation escape (portal build isolates it).
- [x] No download / install; free; browser-only.
- [x] Responsive to 360px; touch + keyboard + mouse.
- [x] Service worker is DEFAULT-build only (portal build omits it) — critical: a SW inside a portal
      iframe is a rejection cause, and the offline branch already scopes the SW to the default build.
- [ ] Mute audio on tab blur / during ad breaks — verify per portal once SDKs are wired.
- [ ] AI disclosure: Category Blitz uses an LLM to judge answers — disclose if the portal asks.

## Summary of open Job 4 items (not code-complete)
1. Regenerate cover art from the current design (needs a live render) and replace og-image.png +
   export per-portal sizes.
2. Live-verify ?cg=1 on production (static path confirmed intact).
3. Poki SDK + GameDistribution SDK are NOT integrated — each is a real code task, listed above.
   (CrazyGames needs no SDK for the ?cg=1 direct-entry approach.)
