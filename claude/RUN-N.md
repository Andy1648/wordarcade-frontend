# RUN-N — queued run, 2026-09-17

Rails: no merges to main, no deploys, max 2 agents, deep-and-few, every finding refuted by a
second agent, one branch per batch, screenshot every variant/viewport and review the images
before pushing.

---

## BATCH 1 — THE COLD VISITOR PATH — **done, pushed, NOT merged**

Branch: `fix/cold-visitor-path`

### The cause (diagnosed before any fix)

`/chain/play` was never a route. The string existed in exactly one place in the repo — a comment
in `src/progress/modeAccess.js` — and nowhere in the router. Vercel's SPA rewrite caught the path,
the app booted with no idea what it meant, no launch intent was bridged, so the full splash → menu
chain played and the mode was never reached.

The reason no gate caught it is worse than the bug, and is the reusable finding:

> **`vite preview` and Vercel disagree about `/chain`.**
> Each mode has an SEO landing page at `public/<mode>/index.html`. On Vercel the FILESYSTEM is
> matched BEFORE `rewrites`, so `/chain` serves that HTML file and the SPA never receives the path.
> Vite's preview server does the opposite — extensionless paths go straight to the SPA fallback.
> So `e2e/router.spec.js` asserted `/chain -> chain view` and passed, for a route that could not
> work on the deploy. This is the `vercel.json` class of failure from CLAUDE.md again: the suite
> was not running against the deploy's routing rules, so green meant nothing.

Verified against live production, not from reading config:

| path | typeaword.com (before) | vite preview (before) |
|---|---|---|
| `/chain` | landing page | **the app** |
| `/chain/play` | app, no route → splash → menu | same |

### What shipped

**The split.** `/<mode>` is the crawlable landing page; `/<mode>/play` is the deep link that lands
in the game. They can no longer shadow each other, and `src/routeShadow.test.js` (new, build-failing)
asserts that from the two sources of truth — the router's tables and the files on disk — so it
cannot drift.

**Preview/prod parity.** `vercelStaticParity` in `vite.config.js` makes dev and preview resolve
extensionless paths the way Vercel does. This is the fix that matters most: it closes the gap that
let the bug hide. Verified by probe — `/chain`, `/chain/`, `/chain?x=1`, `/word-bomb` → landing;
`/chain/play`, `/chain/play/`, `/word-bomb/play`, `/room/ABCD` → app. Matches production exactly.

**The splash on a deep link: skipped entirely.** Its job is to introduce someone who arrived at the
front door with no idea what this is. A player who tapped a link to a specific mode has already been
introduced — by the landing page, the share card, or whoever sent it — and the mode's own first-run
teach does the rest. Mechanically this is just `SKIP_INTRO`, which already covered every launch
intent; the bridged query is the whole mechanism. The one exception is `/word-bomb/play` and
`/category-blitz/play` — see below.

**All five modes, not three.**
- CHAIN / FUSE / SAT RUSH are solo: the deep link opens the mode on mount, no socket.
- WORD BOMB / CATEGORY BLITZ need a room and an opponent, so the deep link provisions both with no
  clicks — the same `create_room` / `set_game_type` / `set_difficulty`|`set_packs` / `add_bot`
  frames the menu's Quick Play and Daily paths already send, in the same order, on the same socket.
  Nothing new is asked of the server. It differs from the CrazyGames entry in one way: no arm
  gesture (CG holds `start_game` for an embed contract; a deep-link visitor chose this URL).
  While that round-trip happens they see `DeepLandScreen`, not the menu.

**Things that were broken beside the route, found while fixing it:**
- **Every share link in the app pointed at the landing page.** `chainLink()` returned
  `/chain?ref=share` — a player sharing after a run handed a friend the marketing page for the mode
  the friend was being shown. All five now point at `/<mode>/play`.
- **The Category Blitz result-card link pointed at the Daily** (`/?daily=1`) — a different mode from
  the one on the card, and a launch the offer logic does not count as a deep land.
- **SAT Rush's in-run exit was a bare `✕` at 40px**, the identical defect `fix/solo-exit` had just
  removed from CHAIN and FUSE. Now `← MENU` at ≥44×44, in SAT RUSH's own paper-and-ink language.
- **SAT Rush had no "rest of the game" offer** on its results, though it has a landing page and a
  share link exactly like CHAIN and FUSE. It does now (`CASE FILE` framing, its own voice). Word
  Bomb and Blitz game-over cards got it too, inside the sticky actions footer so it survives a card
  that scrolls.
- **The service worker served the app for `/chain` to every repeat visitor.** Workbox only tries the
  `<path>/index.html` spelling for URLs ending in `/`, so `/chain` missed the precache, hit the
  NavigationRoute and got the app — meaning the landing pages were invisible to anyone with the SW
  installed, and the routing model above was only true on a first visit. The five landing paths are
  now in `navigateFallbackDenylist` (anchored, so `/chain/play` still gets the app).
- **`/chain/play` was recording the visitor as having seen the menu.** The solo paths booted at
  `view='home'` and relied on an effect to move them; effects run after the first commit, so
  `Homepage` mounted for one frame and its mount effect wrote `taw.seenMenu`. On the visitor's
  SECOND visit the run-over offer was therefore suppressed although they had still never looked at
  the menu. Every deep link now boots straight to its own view.

### What the screenshots caught that the gates did not

64 shots per pass (5 modes × every step × 1366×768 / 1280×720 / 390×844 / 320×640), reviewed as
images, three passes.

1. **The first-run coach mark was clipped at both viewport edges at 320px.**
   `.spotlight-caption-text` has `white-space: nowrap`, which overrides the wrapper's `max-width:
   92vw` — so "START WITH THE GIVEN LETTER" simply overflowed and, being centre-anchored, lost its
   first and last words. The first-run teach was unreadable on the exact screen this batch delivers.
   No gate looks at text overflow. Now allowed to wrap below 400px.
2. **The same teach was printed twice, on top of itself.** CHAIN's `armHint` ("EVERY WORD STARTS
   WITH THE LAST LETTER OF THE ONE BEFORE") and the spotlight caption say the same thing in the same
   window — the spotlight is dismissed by the same keystroke that arms the clock and hides the hint.
   The fixed caption printed straight over the in-flow line. The hint now yields to the spotlight.
3. **The solo input's placeholder was cut mid-word at 320px** (`START WITH "F" · 3+ LE`), which
   reads as a broken input. Ellipsis added as a stopgap — the real fix is the copy, which is a
   Batch 3 call (see below).
4. **The Word Bomb game-over card is over-stuffed at 320×640** once the offer is present: the
   sticky footer takes most of the card and the HIGHLIGHTS/PLAYERS content sits behind it. The offer
   line is now dropped under 680px tall (button only), which recovers a line but does not fix the
   underlying crowding.
5. **I had introduced a duplicate control and only the image showed it.** On the SAT Rush results
   and both game-over cards, the offer's `SEE ALL MODES` sat directly under a `MENU`/`LEAVE` button
   calling the same handler — two adjacent buttons doing one thing. The offer's label is the better
   one for this visitor (it says what is through the door), so it now REPLACES the generic button
   rather than stacking under it. That also un-crowds the 320x640 Word Bomb card in (4): two buttons
   instead of three, and the HIGHLIGHTS panel is visible again.
6. **A screenshot artifact worth knowing:** the e2e backend mock blocks all external HTTP, including
   Google Fonts. Only *Bungee Shade* is self-hosted — Bungee and Space Mono come from Google — so
   every screenshot taken through the mock renders in fallback type and **cannot be used to judge
   typography**. Re-shoot with `fonts.googleapis.com`/`fonts.gstatic.com` allowed. This matters for
   Batches 3 and 5, which are both type judgements.

### What the second agent refuted (and what I did about it)

The adversarial pass falsified four of five claims. Fixed in this branch:

- **Tier 1, the serious one.** Tapping `← MENU` on the boot screen only cleared local state. The
  provisioning effect is gated on `wsStatus` + a once-ref, not on whether the player is still there
  — so a visitor who cancelled at t=3s of a 30-second cold Render start would, at t=30s, have a room
  and a bot created under them, be pulled off whatever screen they were on into the waiting room,
  and then dropped into a live Word Bomb match they had explicitly cancelled. The window is the
  whole cold start, not a race. Cancel now ends the SESSION (`leave_room`, then a navigation to
  `/`): the socket closes, no in-flight frame can arrive, the server reaps the room, and — the
  reason I chose it over a ref guard — it touches **no WebSocket handler at all**, which is the
  right trade next to a documented Tier-1 trap.
- **The boot screen could strand a stranger forever.** A server `error` frame was never surfaced,
  and a socket drop mid-provision reconnects into no room while the once-ref blocks re-provisioning.
  It now has a 40s deadline (comfortably past a cold start) and an error state with TRY AGAIN.
- **`e2e/router.spec.js` contradicted `App.jsx`** — it still asserted the two room paths landed on
  the menu. The suite as I had it could not go green. Caught by the second agent, not by me, because
  I never re-ran that spec after adding the vs-bot boot.
- **`vite.config.js` pointed the parity plugin at the wrong directory in preview** (`command` is
  `'serve'` for preview too, so the `outDir` branch was unreachable), and its dot-guard matched only
  a trailing extension where `vercel.json`'s regex rejects a dot anywhere — re-introducing, inside
  the middleware written to remove it, the same class of divergence. Both fixed; it now takes both
  roots and mirrors the rewrite's own test.
- Also fixed from that pass: the Blitz share link, the `SoloResultsScreen` offer gap, a path
  traversal in the dev middleware, and three stale comments.

**Accepted trade-off (service worker):** denying the five landing paths the navigation fallback
means an OFFLINE visit to the bare `/chain` no longer boots the app shell (workbox only resolves the
precached `chain/index.html` for a URL ending in `/`, so `/chain` now falls through to the network).
Online — every real visitor — it correctly serves the landing page instead of the menu, which it did
not before. `/chain/` still works offline, and `/chain/play` and every other route keep the fallback,
so the game itself is unaffected. Correct-online beat offline-for-a-marketing-page.

**Accepted, not fixed:** a nonexistent `/assets/nope.js` or `/foo.bar/baz` still returns the SPA
locally where Vercel 404s. That is vite's own `htmlFallbackMiddleware`, downstream of the parity
plugin (which correctly passes those through); overriding it would mean replacing vite's fallback.
Consequence is local-dev only.

### Gates

- `npm run lint` — 0 errors, 34 warnings (all pre-existing)
- `npm test` — 491 pass, 0 fail (includes the new `routeShadow.test.js`)
- `vite build` — exit 0
- Full playwright suite — **1136 passed, 1 failed, 1 flaky (20.0m)**. The one failure was
  `error-boundaries.spec.js`, which deep-linked to the bare `/chain` — another spec that only ever
  passed because preview's routing differed from the deploy's. Fixed and re-run green after the
  suite had already started, so it is not in that tally; the affected specs were re-run
  (`error-boundaries`, `boot-payload`, `deep-link`: 25 passed) and the game-over group again after
  the duplicate-button fix (49 passed).
- One test, `/chain/play — the way out is labelled`, went flaky twice under load. I could not
  reproduce it (4 parallel repeats, 3 serial runs, all green) and both flakes coincided with a
  second preview server I was running for screenshots on the same box. Recorded, not fixed.

### Needs Andy

- **A 2-device play-test before this merges.** `/word-bomb/play` and `/category-blitz/play` are
  Tier 1: new WebSocket provisioning and a new view in the `room_update` lifecycle. The mocked e2e
  asserts the exact frame conversation, but a mock is not the Render backend.
- **`/category-blitz/play` hands a stranger straight to the Blitz bot**, which has a confirmed,
  unfixed backend blank bug (`overnight-run-2026-09-10`). This deep link makes that bug a first
  impression. Worth deciding whether Blitz's deep link should ship before the backend fix.
- **Taste call:** the boot screen (`DeepLandScreen`) is new UI. Screenshots at all four viewports.

### Carried to later batches

- **Batch 3:** the menu at 320×640 — the wordmark is overlapped by the XP row, the card grid breaks,
  and card text clips (`CATE BLITZ`, `JNLOCKS AT LV 3`). This is the payoff screen of the whole
  acquisition path.
- **Batch 3:** the fixed audio button overlaps content on at least four screens (the solo coach
  mark, the game-over `SEE ALL MODES` button, the menu spotlight line). CLAUDE.md's NO ORPHAN FIXED
  UI rule, and a documented past regression, recurring.
- **Batch 3:** the solo input placeholder copy is too long for 320px.
- **Batch 5:** re-shoot with fonts allowed before judging any type.
