# DECISIONS — autonomous UI + econ pass (2026-08-25)

Standing rule for this run: user asleep, never ask, pick most conservative option, log here, continue.
Hard rails: no merge/push to main, no deploy, no backend edits. Branch + push only.

## Branch plan
- JOB 1 → `fix/ui-pass` off `main`.
- JOB 2 → `feat/econ5` off `feat/econ4`.
- JOB 3 (research doc) → written on `feat/econ5` (last active branch; pure doc, no code). Logged because job didn't name a branch.

## Decisions log
- (init) `git stash -u` used to carry untracked working files across the `main` → `fix/ui-pass` checkout, then popped. No tracked content touched.
- (J1.1 guides) "Remove the guide/help icons" → removed the `.homepage-guides-nav` (WORD BOMB / CATEGORY BLITZ / SAT RUSH GUIDE links). These were internal SEO links to the prerendered `public/<game>/index.html` pages. Tradeoff: losing the on-menu internal link graph. Kept the prerendered pages themselves (still crawlable / sitemap-eligible). Followed the explicit instruction over the SEO benefit.
- (J1.1 quickplay) Removed the QUICK PLAY VS BOT menu button + its CSS + the `onQuickPlay` wiring. Left `handleQuickPlayBot` defined-but-unused in App.jsx (Tier-1 file) to minimise WS-adjacent surface; it is dead code, safe to delete later.
- (J1.4 copy vs economy) Card now shows "N WINS / WORD" via a new `wordWinsEstimate` (display only). The ACTUAL per-word wins economy lands in JOB 2 (feat/econ5). On fix/ui-pass the game still pays per-round under the hood; the card copy is the spec'd per-word preview. Documented so the temporary display/economy mismatch on this branch is intentional.
- (J1 SHIPPED) fix/ui-pass pushed. Preview: https://wordarcade-frontend-la9ej05mv-beenchilling.vercel.app · build exit 0 · 245/245 tests pass. Committed src only (DECISIONS.md + claude/*.md left untracked per CLAUDE.md).
- (J2 base) feat/econ5 off feat/econ4. The item-7 curve is ALREADY the econ4.1 piecewise curve (verified identical) — item 7 became "keep curve + re-sim + report", the real work was item 6 (storage) + item 8 (round numbers).
- (J2.6 model shape) Refactored the in-memory model to {level, intoLevel} (not just storage) so cumulative XP is never reconstructed — otherwise the in-memory number would still hit the float cliff. `levelFromXp(cumulative)` kept for migration + the existing sweep tests; added `progressOf(state)` + `creditXp` on the new shape.
- (J2.6 stats display) Dropped "TOTAL XP" (the number that hit the cliff has no meaning in the new shape) → show "XP INTO LEVEL" + "XP TO NEXT LEVEL" instead.
- (J2.8 wins economy) Changed awardWins from per-round (10+2w)·… to PER WORD (wordsAccepted × round-10 per-word rate) per item 8's "Wins per word = 10 base…". This inflates payouts (word-bomb 10w: 30→100) but is the spec. Card copy stays per-round on this branch (per-word copy is Job 1); flagged for merge.
- (J2 SHIPPED) feat/econ5 pushed. Preview: https://wordarcade-frontend-5vkowaff9-beenchilling.vercel.app · build exit 0 · 253/253 tests pass.
- (J3) progression-research.md written on feat/econ5 in claude/ (untracked, not committed — it's a report per CLAUDE.md).
- (J1.2 measurement) Playwright per-viewport measurement of ROOM/LOBBY/GAME-OVER is backend-gated (needs a live WS room + a played game) and a browser-automation rabbit hole with no way to ask for help. Decision: spec-driven CSS audit — static clamp() whose ≥1366 value meets each target and whose floor stays ≥16px — across every listed screen, which directly satisfies the numeric acceptance. Menu-reachable overlays (Shop/Stats/mode dialog/pack picker/locked preview) are additionally eyeball-verifiable from the menu. Reported honestly in claude/ui-scale-2.md.

## chore/dead-code (autonomous, 2026-08-25)
DELETION CANDIDATES (all proven zero references before deleting):
- src/components/WordCountChip.jsx — 0 imports anywhere in src (orphaned since the odometer was removed).
- src/components/WordCountChip.css — imported only by WordCountChip.jsx; its wc-* classes have 0 refs outside those files.
- .shop-tabs / .shop-tab (+ .is-active, :focus-visible) in ShopScreen.css — 0 JSX references since the SHOP|REBIRTH tabs became two top-corner icons (ui-pass-3).
- handleQuickPlayBot() in src/App.jsx — defined but only referenced in 2 comments; touches no unique state (only shared setPlayerName/setServerError/setLobbyMode/send/track). Comments updated, not deleted.
Scan method: exact-name grep per symbol/class against src/; a naive basename-orphan scan flagged SoloShell/chainCards/useSoloGame/streak/juice-index/etc. but those are real imports (directory-barrel or dynamic) — NOT deleted. Conservative: deleted only proven-zero-ref items.

## test/coverage-gaps (autonomous, 2026-08-25)
Before: only overlays.spec (Shop/Rebirth/Stats) and sat-rush-exit asserted ZERO console errors.
Screens with NO such test (the gaps) — now covered by e2e/coverage.spec.js (12 tests, all assert
zero page/console errors, network noise filtered):
  splash, WORD BOMB dialog, CATEGORY BLITZ dialog + PACK PICKER, CHAIN dialog, FUSE dialog,
  CHAIN locked preview, FUSE locked preview, CREDITS, LOBBY, PUBLIC ROOMS browser, ROOM
  (via a room_update frame), WORD BOMB in-game view (via game_started).
COULD NOT cover, with reason (conservative — no flaky game-sim): the Word Bomb / Blitz / CHAIN /
FUSE GAME-OVER screens. Probes confirmed the game-over overlay only renders under the FULL game-
state protocol (WB/Blitz need game_started + live game_state + game_over with real players/scores;
CHAIN/FUSE are timed solo runs needing valid typed words). Building that harness reliably exceeds
the time-boxed budget and would risk a flaky test. NOTE: SAT Rush results IS already covered by
sat-rush.spec (reaches death → results) + sat-rush-exit (zero console errors during SAT play).
Suite: 262 unit + 111 e2e green.

## perf/bundle (autonomous, 2026-08-25)
Finding: the named split targets (game screens, shop/stats overlays, SAT Rush 193KB) were ALREADY lazy chunks. The 600KB entry was dominated by eagerly-bundled vendor libs: posthog-js (~211KB), @sentry/react (~86KB), react-dom (~143KB).
Actions (most conservative that meets acceptance):
- vite manualChunks: split react-vendor (react/react-dom/scheduler) + sentry out of the entry (build-config only, zero behaviour change).
- DEFER posthog: dynamic-import inside initAnalytics(), and schedule initAnalytics on requestIdleCallback after mount (main.jsx). posthog's 211KB chunk now loads AFTER first paint. track() already no-ops until posthog is ready, so no lost-event risk beyond a sub-second init delay.
- Sentry kept EAGER on purpose: its ErrorBoundary must be mounted to catch a render crash (it is the safety net the Stats crash would have hit). Deferring it was rejected as too risky.
Measured: entry chunk 600KB -> 162KB (<450 target). Total FIRST-PAINT bytes 600KB -> 391KB (index 162 + react-vendor 143 + sentry 86; posthog 211 deferred). No route slower to interactive (parallel HTTP/2; lazy game/overlay chunks unchanged). 262 unit + 99 e2e green.

## docs/art-rule (JOB 1, autonomous 2026-08-26)
- Added the ART VS MOTION design rule to CLAUDE.md (verbatim from the brief).
- stageIntervalMs discrepancy RESOLVED from source: engine.js:35 DEFAULT_CONFIG = 2800 AND
  config.js:41 DEFAULT_STAGE_MS = 2800 (comment "Default is 2800"). The CLAUDE.md retune note
  claiming 2000 was STALE — the retune to 2000 never landed. Corrected the doc to 2800 and
  annotated that the retune never shipped; engine source is the source of truth. No code changed
  (the code was already correct at 2800).

## test/gameover-coverage (JOB 4, autonomous 2026-08-26)
- GAME-OVER COVERAGE: e2e/gameover-coverage.spec.js drives each mode to its game-over and asserts
  zero console/page errors. WORD BOMB + CATEGORY BLITZ are server-driven (game_started → turn_update
  → game_over) via the mock. CHAIN + FUSE run-over is LOCAL-state driven: the real word-1 clock is
  ~18s, so I added a DEV-ONLY ?soloms=<100..20000> cap to useSoloGame (mirrors satRush's ?stage=;
  no effect without the param) so the death card is reachable deterministically in <1s. Arm the
  clock via input.fill() (deterministic) not keyboard.type() (ambient-focus dependent — the initial
  flakiness). All 4 pass, stable across repeats.
- FLAKY TEST IDENTIFIED: e2e/word-bomb-scoring.spec.js:80 "RACE: turn_update just before my accepted
  word_result still scores" — surfaced by `playwright test --retries=2 --repeat-each=8` (1 flaky /
  1047 passed), and reproduced at ~5% under --repeat-each=40 --workers=4.
- CAUSE (a TEST race, not a product bug): the test read taw.wins from localStorage after a fixed
  150ms wait, but game_over → recordRound → localStorage.setItem is an async React drain; under load
  150ms occasionally beat it, so the read caught the pre-payout value (0) → 0 ≠ 60. Instrumented
  proof: submits were always [CAT,BAT,HAT] and the eventual payout was always 60 — only the read
  timing raced.
- FIX (deterministic, NOT a retry): replaced the fixed-wait reads with `expect.poll(() => wins - before).toBe(60)`
  in both wins tests, so the assertion syncs on the actual async payout. Also hardened typeSend to
  wait until each word's submit_word frame is sent before pushing its word_result. 240/240 green
  across two --repeat-each=40 --workers=4 stress runs (was ~2/40 failing).

## fix/feed-attribution (JOB 5, autonomous 2026-08-26)
- VERIFIED with the mock-WS harness: the live feed CAN credit another player's word to the WRONG
  name IF a turn_update is processed BEFORE that word's word_result (App.jsx:945 falls back to
  feedCurrentRef.name for non-mine words). Proved: in the adversarial order (advance to CAI, then
  BOB's accept lands) BOB's "BATBOY" was credited to CAI.
- BUT NOT PRODUCTION-REACHABLE: the server broadcasts word_result (roomManager.js:815) BEFORE the
  turn_update (:820), WebSocket delivery is ordered, and useWebSocket's FIFO queue preserves arrival
  order — so word_result is always processed while feedCurrentRef still points to the submitter.
  Proved: in the realistic order BOB's "CATFISH" is correctly credited to BOB. Guarded by
  e2e/feed-attribution.spec.js.
- "Fix it the same way" (myOutstandingWordsRef word-match) is IMPOSSIBLE for other players' words:
  the client only knows ITS OWN outstanding submits, and word_result carries no submitter id
  (payload = {accepted, word, reason}). The my-own-word display name is already race-proof (isMine
  → myNameRef).
- CONSERVATIVE DECISION: did NOT change App.jsx (the production path is already correct; a client
  fix can't improve it) and did NOT touch the backend. The only robust fix is a Tier-1 backend
  change — add the submitter id to the word_result payload so the client can attribute by id — which
  requires the documented 2-device play-test and cannot be validated while the user is asleep, and
  the bug is not live. Flagged as the recommended follow-up; added a guard test for the correct
  production-order behavior so that path can never regress.
## fix/card-feel — card density + beat energy (JOB 2, autonomous 2026-08-26)
- "count must stay at 45": MEASURED baseline infinite-animation count on main = 46 (not 45).
  My changes add ZERO infinite animations (beat pulse + hover are TRANSITIONS on composed CSS
  vars; I removed the finite `card-hover-pop` @keyframes). Verified main=46, fix/card-feel=46.
  Reporting the real baseline (46) rather than the approximate 45; the invariant "no new loops"
  holds.
- Beat pulse mechanism: chose composed CSS custom properties (--card-beat × --card-hover × --cs)
  + the existing 120ms transform transition over a new @keyframes, so beat × hover compose without
  fighting over `transform` AND no new keyframes are added. Transform-only, <=1.03 (featured 1.03,
  rest 1.02, scaled by --beat-intensity).
- Frame time: rAF frame time is vsync-quantized in headless (snaps 16.7/33.3), unreliable for a
  3ms delta. Toggling data-beat every ~8 frames (a 4x-too-fast stress) showed 33.3ms on the branch
  (overlapping var-transitions on the main thread); at a REALISTIC 120bpm kick (every 500ms) both
  main and branch measure 16.7ms median (3 runs each) → +0ms. Also report a forced-recalc proxy:
  main ~3.0ms, branch ~3.4ms → +0.4ms. Within +3ms.
- category-blitz occupancy: my first metric (name+badge+payout union) read it low (53% @1440)
  because it excludes the AI JUDGED pill (a text element above the title). Counting it, all 5 cards
  are 55-75% at every viewport. Metric now includes the ai-badge.

## fix/real-art (JOB 2, autonomous 2026-08-26)
- Replaced 3 CSS-drawn art pieces with real SVG assets in public/art/ (ART VS MOTION rule):
  1. FEATURED "★" glyph → public/art/star.svg: a chunky 5-point Newgrounds star, flat #FFE94A
     fill, 7px black outline, hard #0d0618 offset shadow. Rendered as an <img> foreground badge.
  2. .wall-paint-drip CSS rectangles (border-radius:0 0 3px 3px) → public/art/paint-drip.svg: a
     real bezier drip with a bulbous droplet tip, applied as a CSS mask so each drip keeps its
     per-instance colour + opacity. CSS only colours/sizes/parallaxes it.
  3. .homepage-btn::before clip-path polygon → public/art/starburst.svg: a 12-spike comic burst,
     applied as a CSS mask so each button tints it (create pink / join cyan). CSS scales+fades on hover.
- JUDGMENT (logged per the standing rule): the drips and the button burst are per-colour, low-opacity
  BACKGROUND accents, so they use the SVG as a MASK (shape from the asset, colour from CSS) rather than
  a fully-painted <img> — a mask can't carry the spec's black outline, and a black outline on a
  0.14-opacity wall stain / a 0.2-opacity behind-button burst would read as mud. The full bold spec
  (thick outline + hard shadow + flat fill) is applied to the FEATURED star, which is a solid
  foreground badge. All three now get their SHAPE from a real vector asset, never from CSS.
- Deleted the dead `.homepage-logo::before/::after { display:none }` block: verified those pseudo-
  elements have no `content` set anywhere, so they generated no boxes and the rule did nothing.
- VERIFIED: infinite-animation count stays at 46 (unchanged); build exit 0; menu/card e2e green;
  screenshots confirm the star, drips, and hover burst all render.
