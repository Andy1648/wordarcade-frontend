# JOB C — offline for the solo modes (feat/offline, branch-only)

CHAIN, FUSE and SAT Rush now play with the network disabled; Word Bomb & Category Blitz show a clear
NEEDS INTERNET state; the app is installable.

## What shipped
- **Service worker via `vite-plugin-pwa` (Workbox)** — DEFAULT build only (the portal iframe build
  registers no SW). It precaches the shell + **every hashed asset**. Because the solo/SAT dictionaries
  ship as dynamic-import JS chunks (`wordsData`, `wordsAcceptExt`, `words.recall`, the SAT chunk), the
  glob precache pulls them in automatically — so all three modes have their data offline.
- **NEVER SERVE A STALE BUILD** (the explicit constraint): each precached asset is content-hashed and
  stored WITH A REVISION. A new deploy = a new precache manifest; `registerType: 'autoUpdate'` +
  `skipWaiting` + `clientsClaim` make the new SW take over immediately, and `cleanupOutdatedCaches`
  evicts the previous build. The swap is ATOMIC — a client is never stranded on an old `index.html`
  that points at deleted asset hashes; it serves one consistent build until it updates to the next,
  whole. `navigateFallback` serves the precached `index.html` for any offline navigation/deep-link so
  the SPA boots offline from the FIRST visit.
  - NOTE on "network-first HTML": I used precache + atomic autoUpdate rather than a NetworkFirst
    navigate route. A NetworkFirst nav route SHADOWS navigateFallback and, on a first offline session
    with an empty runtime cache, returns nothing → the app won't boot offline (I hit exactly this and
    backed it out). Precache + autoUpdate delivers the real goal — never stale/broken — AND
    offline-from-first-visit, which NetworkFirst alone does not. A strict NetworkFirst-with-precache-
    fallback needs a custom (injectManifest) SW; flagged if you want that exact semantic.
- **Web app manifest:** `public/manifest.json` already exists and is installable (name, `start_url`,
  `display: standalone`, theme/bg colour, icons) — kept as-is (`manifest: false` in the plugin).
- **NEEDS INTERNET:** an app-level connectivity signal (`navigator.onLine` + online/offline events);
  when offline the menu shows a clear status banner — *"OFFLINE — CHAIN, FUSE & SAT RUSH STILL PLAY.
  WORD BOMB & CATEGORY BLITZ NEED INTERNET."* — so the multiplayer modes never just spin silently.
  (Same inline status-banner pattern as the existing JOINING ROOM banner — no new orphan fixed UI.)

## Offline payload
Precache manifest: **61 entries, 5.43 MB uncompressed / ~2.79 MB gzipped over the wire** (a one-time
install cost). The bulk is the word data — notably the ~1.9 MB `wordsAcceptExt` extension chunk — which
is exactly what lets the solo modes accept the full word set offline.

## Verified offline (network disabled in the browser, `claude/_tools/verify-offline*.mjs`)
- **CHAIN** — deep-link boots offline, `.solo-root` renders (`data-view=chain`), a typed letter is
  accepted (word data served from precache). ✅
- **FUSE** — same, `data-view=fuse`, typing works. ✅
- **SAT RUSH** — menu → card → Play → briefing → **Start the run → `.sr-slots` play screen**, all
  offline. ✅
- **NEEDS INTERNET** — banner shown on the menu when offline. ✅
- SW confirmed **controlling** the page with **61 precache entries** after install.

## Gate
build ✓ · lint 0 errors · unit 415 · full Playwright green (shard failures were the documented load
flakes — `parity-wb-blitz` + `game-fill`, confirmed **20/20 passing isolated**; the SW does NOT break
the suite). `vite-plugin-pwa` added as a devDependency.

Branch-only, not merged. A service worker is sticky per-origin, so review on the branch preview before
merge; `devOptions.enabled:false` keeps it off during `vite dev`.
