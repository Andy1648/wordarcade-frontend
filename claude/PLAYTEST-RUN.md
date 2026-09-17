# PLAYTEST — `release/prod-2`

**Deployment:** https://wordarcade-frontend-nhbzbhmb1-beenchilling.vercel.app
**Commit:** `57c3a67` (`release/prod-2`) — the GATED build
**Gate:** lint 0 errors · 587 unit · **1214 e2e passed, 0 failed**, 1 known pre-existing flake
(`menu-xp` pop), 0 worker crashes, 0 connection failures.
**Contains:** `main` (`a23548b`) + `fix/econ-perf-attack` (68 commits) + `feat/pause-to-learn` (65)
+ `fix/cold-visitor-path` (which itself carries `fix/solo-exit` and `fix/unlock-gates`).

Verified live in this deployment, not just locally: `/chain` serves the article, `/chain/play`,
`/sat-rush/play` and `/word-bomb/play` serve the app; `chain/play` and `is-bare` are in the entry
bundle, `SEATING YOUR OPPONENT` is in the DeepLandScreen chunk, and the game-over compaction rule
(`max-height: 780px`) is in `GameScreen-ZxGRuyFw.css` — whose hash matches the local gated build.

(Any commit after `57c3a67` on this branch is documentation only and does not change the bundle,
so this deployment remains the build under test.)

---

## TIER 2 — mergeable on your preview sign-off

No WebSocket, room-lifecycle or game-state change. Look at it on the preview; if it looks right,
it is mergeable.

| # | What | Where to look |
|---|---|---|
| T2-1 | The article/play routing split, all five modes | `/chain` is the article; `/chain/play` is the game |
| T2-2 | `vercelStaticParity` — dev/preview now resolve paths like Vercel | infrastructure; the reason the original bug could hide |
| T2-3 | `routeShadow.test.js` — build-failing guard against a page shadowing a route | CI only |
| T2-4 | Share links point at `/<mode>/play` for all five modes | share from any run; the link should open the game |
| T2-5 | Service worker stops hiding the landing pages from repeat visitors | reload `/chain` twice |
| T2-6 | First-run coach mark no longer dims the board | `/chain/play` cold — full brightness |
| T2-7 | SAT Rush deep link opens a playable run | `/sat-rush/play` — clue + six suspects + `← MENU`, ~1s |
| T2-8 | Labelled ≥44×44 exits in CHAIN / FUSE / SAT | every solo screen |
| T2-9 | Unlock gates: CHAIN LV2, FUSE LV3, a played mode is never locked | menu at LV1 |
| T2-10 | Type-scale corrections (11 raw sizes, 4 sub-floor Bungee rules) | text should look unchanged |
| T2-11 | Run-over second row is one control, never two | die in CHAIN from a link vs from the menu |
| T2-12 | `feat/pause-to-learn`'s TeachStrip replaces the solo Spotlight | first CHAIN run on cleared storage |
| T2-13 | `fix/econ-perf-attack`'s economy + perf batch (the bulk of the 68 commits) | its own preview notes |

## TIER 1 — needs the 2-device test before merge

The only genuinely NEW room-lifecycle surface in this release is the room-mode deep link. The
three documented traps were checked and hold on this branch: the functional
`setView(prev => prev === 'game' ? ...)` guard is present, `useWebSocket` still exposes the FIFO
`messages` / `consumeMessages` pair, and there is no `renderedView`.

| # | What | Test |
|---|---|---|
| T1-1 | `/word-bomb/play` provisions a room + bot with no clicks | phone, cleared storage, one navigation — a game starts by itself |
| T1-2 | `/category-blitz/play`, same | as above |
| T1-3 | Cold Render dyno | do T1-1 as the first thing after the backend has been idle; CONNECTING… → WAKING THE SERVER… → the game. Never stuck on SEATING YOUR OPPONENT… — after 40s it offers TRY AGAIN |
| T1-4 | **Cancel during the wait** | open `/word-bomb/play`, tap `← MENU` within a few seconds, then stay on the menu a full minute. You must NOT be pulled into a game. (This was a real bug — the provisioning effect stayed armed after cancel.) |
| T1-5 | The `vs-bot` view in the `room_update` guard | T1-1 and T1-2 exercise it; watch that you are never dropped on the waiting-room screen |
| T1-6 | `beginPayoutLedger` now fires on `game_started` (from the econ branch) | play one full Word Bomb game and confirm wins still credit correctly |
| T1-7 | Full REGRESSION CHECKLIST | CLAUDE.md — 133 commits of other people's work land here too |

---

## KNOWN, NOT FIXED (see `claude/RUN-N.md` §4)

- The menu at 320×640 is crowded — wordmark overlapped by the XP row, card text clipping.
- The fixed audio button overlaps content on several screens (NO ORPHAN FIXED UI, recurring).
- `/category-blitz/play` hands a stranger straight to the Blitz bot, which has an unfixed backend
  blank bug. **Consider holding T1-2 and shipping the other four `/play` paths.**
- `feat/solo-slabs` is deliberately NOT here — it is wave 2 (RUN-N §5.2).

## THE FIVE TASTE CALLS

`claude/RUN-N.md` §3, each with its screenshot in `claude/run-n/`.
