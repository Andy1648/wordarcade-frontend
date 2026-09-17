# RUN-N — the landing pad

Last rewritten 2026-09-17. Screenshots referenced by name live in `claude/run-n/`.

---

## THE ONE THING TO READ FIRST

**Nothing has reached players since the 15th, and the cost of that is now measurable.** While
`fix/econ-perf-attack` sat unmerged, Batch 1 independently rediscovered and rebuilt the *same*
article/play routing split it already contained — same diagnosis, same solution, same
`PLAY_PATHS` export — a day apart. Two agents solved one problem twice because neither could
see the other's work. That is the concrete price of the backlog, not a hypothetical one.

`release/prod-2` exists and is gated. It needs your sign-off, not more work.

---

## 1. WHAT SHIPPED (branches, gated, NOT merged to main)

### 1.1 `fix/cold-visitor-path` — the cold visitor path
A cold visit to `/<mode>/play` now lands **in** that mode, for all five modes.

- **The cause.** `/chain/play` was never a route; the string existed only in a comment in
  `modeAccess.js`. The SPA rewrite caught the path, the app had no idea what it meant, and the
  splash → menu chain played in front of the mode.
- **Why no gate caught it.** `vite preview` and Vercel disagree about `/chain`. The landing page at
  `public/chain/index.html` wins over the SPA rewrite on Vercel; preview hands the path to the SPA.
  `e2e/router.spec.js` asserted `/chain -> chain view` and passed green for a route that could not
  work on the deploy. This is the `vercel.json` class of failure again.
- **The structural fix.** `vercelStaticParity` (vite.config.js) makes dev and preview resolve
  extensionless paths the way Vercel does, so this class of bug cannot hide locally again.
  `src/routeShadow.test.js` is build-failing and asserts a landing page can never shadow an app
  route.
- Word Bomb and Category Blitz provision a room + bot with no clicks, using the frames Quick Play
  already sends, and wait on their own boot screen (`04-word-bomb-deep-link-boot_1366x768.png`).
- Every share link in the app pointed at the landing page instead of the game. All five now point
  at `/<mode>/play`. Blitz's result-card link pointed at a *different mode* (the Daily).
- The service worker was serving the app for `/chain` to every repeat visitor, hiding the landing
  pages entirely. The five landing paths are now denied the navigation fallback.

### 1.2 The three first-frame defects you found
- **The washout was the first-run coach mark**, not a transition: a 100vmax box-shadow at
  `rgba(6,3,12,0.76)` taking the whole board to a quarter brightness. Compare
  `01-BEFORE-chain-first-frame-washed-out_1366x768.png` with
  `02-AFTER-chain-first-frame_1366x768.png`. Game surfaces pass `dim={false}`. Gated: the board's
  ancestor chain must be fully opaque AND nothing may paint a full-screen scrim, within 1s.
  (The board's own `opacity` was always 1 — a gate that only checked opacity would have passed the
  broken screen.)
- **SAT Rush landed on a cover**, four taps from a word appearing. It now starts a LINEUP run
  itself: `03-AFTER-sat-rush-deep-link-playable_1366x768.png`. ~23s on the first word, all three
  lives, labelled exit in the HUD. The cover and mode picker stay reachable from the menu card.
- **The SAT exit was present**, contrary to the report — `← MENU` under PLAY, shipped in the Batch 1
  commit you pulled. The real defect was the cover, not a missing control.

### 1.3 `release/prod-2` — the assembly
`main` + `fix/econ-perf-attack` (68 commits) + `feat/pause-to-learn` (65) + `fix/cold-visitor-path`.
First two merged **clean**; the third had 13 conflicts, resolved. lint 0 errors, 587 unit tests.

---

## 2. WHAT NEEDS YOUR PLAY-TEST (Tier 1 — blocks merge)

1. **`/word-bomb/play` and `/category-blitz/play` on two devices.** New WebSocket provisioning and
   a new view in the `room_update` lifecycle. The mocked e2e asserts the exact frame conversation,
   but a mock is not the Render backend. Specifically: does the room actually come up on a cold
   dyno, and does the bot seat?
2. **Cancel during a cold start.** Open `/word-bomb/play`, tap `← MENU` within the first seconds,
   then wait a full minute on the menu. You must not be pulled into a game. (This was a real bug
   the adversarial pass found: the provisioning effect stayed armed after cancel.)
3. **The full REGRESSION CHECKLIST**, because `release/prod-2` carries 133 commits of other
   people's work into the room lifecycle as well as mine.

## 3. WHAT NEEDS YOUR TASTE (no right answer — I made a call, tell me if it is wrong)

4. **`DeepLandScreen` is a new surface.** `04-word-bomb-deep-link-boot_1366x768.png` and its failed
   state `05-boot-failed-state_1366x768.png`. It is deliberately plain — it is usually on screen for
   under a second.
5. **Cancelling the boot screen does a full page navigation to `/`**, not a soft `goHome()`. I chose
   that because it touches no WebSocket handler, which is the right trade next to a documented
   Tier-1 trap — but it costs a page load.
6. **The run-over second row is now one control, never two.** A player from the menu gets
   `TRY <MODE>`; a deep-link visitor who has seen no modes at all gets `SEE ALL MODES`.
   `06-sat-results-offer_1366x768.png`, `10-word-bomb-gameover-offer_390x844.png`.
7. **SAT Rush's deep link opens LINEUP, not BRIEFING.** LINEUP needs no teaching screen; BRIEFING is
   mandatory-by-design and I would not auto-skip it. If you would rather a stranger's first SAT
   experience be the study screen, that is a one-line change.
8. **`/category-blitz/play` hands a stranger straight to the Blitz bot**, which has a confirmed,
   unfixed backend blank bug. This link makes that bug a first impression. Consider shipping the
   other four `/play` paths and holding this one.

## 4. WHAT I FOUND AND COULD NOT FIX

9. **The menu at 320×640 is broken** — the wordmark is overlapped by the XP row, card text clips
   (`CATE BLITZ`, `JNLOCKS AT LV 3`), the grid reads as an accident. This is the payoff screen of
   the whole acquisition path: `09-menu-after-offer-chain-unlocked_390x844.png` is the 390 case,
   which is fine; 320 is not. Belongs to Batch 3.
10. **The fixed audio button overlaps content on at least four screens** — the solo coach mark, the
    game-over `SEE ALL MODES` button (`07-word-bomb-gameover-offer_320x640.png`), the menu
    spotlight line. CLAUDE.md's NO ORPHAN FIXED UI rule, recurring.
11. **The solo input placeholder is too long for 320px** and was cut mid-word
    (`08-chain-cold-land_320x640.png`). I added an ellipsis so it degrades honestly; the real fix
    is the copy, which is a Batch 3 call.
12. **Local `/assets/<missing>.js` returns the SPA where Vercel 404s.** That is vite's own
    `htmlFallbackMiddleware`, downstream of the parity plugin; overriding it means replacing vite's
    fallback. Local-dev only.
13. **Screenshots taken through the e2e mock cannot be used to judge typography.** The mock blocks
    all external HTTP including Google Fonts, and only *Bungee Shade* is self-hosted. Every such
    screenshot renders in fallback type. Re-shoot with the font hosts allowed. **This matters for
    Batches 3 and 5, which are both type judgements.**

---

## 5. THE BACKLOG, MEASURED

208 branches are unmerged into `main`. That number is misleading and the real one is smaller:

- **98** have activity since 2026-09-05.
- Those **98 collapse to 40 tips** — the rest are ancestors of their own descendants, so merging the
  tip lands them. They are superseded, not lost, and need no action.
- Of the 40, **13 are substantial** (40+ changed source files) and **mutually independent** — none
  contains another. This is genuine parallel work, not a chain.
- The rest are docs/chore report branches.

### 5.1 The conflict map (dry-run against current `main`, before any resolution)

**One systemic collision explains almost all of it.** `main` gained 8 commits on 2026-09-15 — the
AVIF/media perf work (PRs #34/#35) and the SEO landing pages. Every branch older than that collides
on exactly the same 12–13 files:

```
public/firecracker.mp3, public/mascot-{celebrate,idle,panic,run,taunt}.webp,
src/components/{GameScreen.jsx, LoadingScreen.css, LoadingScreen.jsx, Mascot.css, Mascot.jsx},
src/hooks/useMusicPlayer.js
```

That is a mechanical, uniform conflict with a single consistent resolution rule — *take main's media
pipeline, take the branch's feature code* — not 16 separate judgement calls.

| Tip | Conflicts with main | Nature |
|---|---|---|
| `fix/econ-perf-attack` | **0** | up to date with main |
| `feat/pause-to-learn` | **0** | up to date with main |
| `fix/cold-visitor-path` | **0** | up to date with main |
| `feat/{blitz,fuse,sat}-craft`, `feat/experiments`, `docs/run-n-2`, `fix/run-payout-rate`, `fix/wb-rail-used-words` | 13 each | the media migration, identically |
| `feat/solo-slabs` | 12 | the media migration |
| `fix/visual-batch-1`, `chore/sim-align`, `fix/onramp`, `chore/stranger-{3,4}`, `chore/verdict-4`, `fix/mobile-4`, `perf/integration` | 1 | `GameScreen.jsx` only |
| `refactor/app-split-6` | 1 | `App.jsx` only |
| `feat/daily-2`, `feat/sat-srs-2`, `fix/willchange-gate`, `fix/parity-wait`, + the report branches | 0 | clean |

### 5.2 `feat/solo-slabs` — your question about the slab look
**It needs the release assembly, not a merge into the cold-path branch.** `feat/solo-slabs` is 27
ahead / 8 behind main, is not merged, and overlaps this branch on `App.jsx`, `GameScreen.*`,
`Solo.css`, `SoloShell.jsx`, `SatRushResults.jsx` and `vite.config.js`. Merging 27 commits of visual
work into a Tier-1 routing branch would make both unreviewable. It is wave 2 of `release/prod-2`.

### 5.3 What the assembly caught on contact
`feat/type-scale`'s build-failing gate fired the moment the branches met: **11 hardcoded font-sizes
and 4 Bungee rules below the display floor**, from *both* sides — including a 9px tag from
`feat/pause-to-learn`, four px under the 13px accessibility floor. All fixed. This is the argument
for merging more often, in one paragraph: the gates only protect what they can see.

---

## 6. TIER SPLIT FOR `release/prod-2`

**Tier 2 — mergeable on your preview sign-off** (no WS/game-state changes):
the routing split, the parity middleware, `routeShadow.test.js`, the share-link corrections, the
SW navigation denylist, the spotlight washout fix, the SAT Rush auto-start, the type-scale
corrections, the run-over offer copy.

**Tier 1 — needs the 2-device test** (items 1–3 above):
`/word-bomb/play` + `/category-blitz/play` provisioning, the `vs-bot` view in the `room_update`
guard, and the cancel path.

---

## 7. NEXT

Wave 2 of `release/prod-2` is the 16 branches that collide only on the media migration. They share
one resolution rule, so they should go in one sitting rather than one per night. `feat/solo-slabs`
is in that wave.
