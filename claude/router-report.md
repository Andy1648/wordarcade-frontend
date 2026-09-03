# JOB B — real routing (feat/router, branch-only)

Query-param entries replaced with clean paths, WITHOUT breaking a single legacy entry or `?cg=1`.

## Routes (all verified, `e2e/router.spec.js` + `claude/_tools/verify-routes.mjs`)
| path | view | notes |
|---|---|---|
| `/` | menu | home |
| `/word-bomb` | menu | distinct crawlable URL (multiplayer mode lives on the menu) |
| `/category-blitz` | menu | distinct crawlable URL |
| `/sat-rush` | SAT Rush | |
| `/chain` | CHAIN | |
| `/fuse` | FUSE | |
| `/room/:code` | join that room | deep-join (sends `join_room{code}`) |

## Design — a boot bridge (zero churn to the 4 entry-param readers)
The app's four readers (`LAUNCH_INTENT`, `solo/config`, `cg/cgEntry`, `satRush/config`) read
`location.search` at import time. Rather than touch all four, `src/routerBoot.js` runs
`bridgePathToSearch()` **first** (before `App` imports, via `main.jsx`): for a known clean path it
MERGES the equivalent query into the URL, so every existing reader works unchanged. After boot the app
canonicalises the URL back to the clean path (`view -> path` effect), so the bar stays clean.

## Guarantees (all tested)
- **Every legacy query still works AND upgrades:** `/?satrush=1 -> /sat-rush`, `/?chain=1 -> /chain`,
  `/?fuse=1 -> /fuse` (old shared links resolve, then the URL canonicalises). `?join=`, `?daily=` also
  still read.
- **`?cg=1` (CrazyGames submission entry) is untouched:** lands in `cg-arm`, URL stays `/?cg=1` — never
  canonicalised (guarded by `hasStickyQuery`, which also protects `?portal=1` + the SAT dev flags).
- **Back/forward:** a `popstate` handler maps the path back to the view for the safe client-side views
  (menu / sat-rush / chain / fuse); room/game/lobby paths are deliberately NOT re-driven from Back
  (that would fight the WS/room lifecycle).
- **Refresh lands on the route:** the boot bridge + SPA fallback re-derive the view on reload.
- **Deep paths don't 404:** `vercel.json` rewrites every extensionless path to `/index.html`
  (`/((?!.*\\.).*)` — hashed assets/`favicon`/`manifest`/`sitemap` keep serving as files).

## Also updated
- **Share links (`src/share/links.js`)** now emit clean paths: invite `-> /room/CODE`, SAT `-> /sat-rush`,
  CHAIN `-> /chain`, FUSE `-> /fuse`, word-bomb `-> /word-bomb` (Daily stays `?daily=1` — no route). Its
  unit tests were updated to the new forms (this feature intentionally changes the link format).
- **`public/sitemap.xml`** (6 route URLs) added; `robots.txt` already points at it.

## Gate
build ✓ · lint 0 errors · unit **424** (9 new pure router tests + the updated link tests) · e2e router
spec **11/11** · full Playwright **1060/1060, 0 failed**.

Branch-only, not merged. No app-view-lifecycle risk beyond the two small URL-sync effects (they touch
only `history`, never the WS/game state).
