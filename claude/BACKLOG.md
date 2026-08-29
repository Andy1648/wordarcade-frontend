# BACKLOG — unstarted work (for a fresh session with no memory)

Context: autonomous runs (2026-08-26 → 2026-08-29) shipped safety fixes, audits, the economy rarity
rewrite, and several feel/economy features. This is what's STILL UNSTARTED, verified against `main` on
2026-08-29. Repos: frontend `~/Downloads/wordarcade-frontend_1/wordarcade-frontend`, backend
`~/Downloads/chain-reaction-backend`.
Rules that still apply: never deploy prod; never change the backend WS protocol; TIER-1 files need a
2-device play-test (see CLAUDE.md); never invent SAT words / category answers; branch-and-push only.

**SHIPPED to main since the last backlog (verified 2026-08-29, moved OUT of this list):** word-rarity
scoring (JOB 31, `rarity.js`/`rarityIndex.js`), WPM everywhere (32, `wpm*.js`/`LiveWpm.jsx`), word
collection (33, `collection.js`/`CollectionScreen.jsx`), achievements (37,
`achievements.js`/`AchievementsScreen.jsx`), reduced-motion path (28, `motionAllowed` + guarded CSS +
`reduced-motion-audit.md`), and the report-only audits — first-run (5), perf (6), returning-player
(41). Also shipped: the mode-wins rebalance (`sim/rebalance-2`, spread 37.7×→1.43×, CHAIN ×1.9, costs
×0.18) and MOMENTUM, the repeatable sink that fixed the ~162 h dead stretch (`feat/repeatable-sink`).
JOB 12's *audit* shipped (`design-tokens-audit.md`); only its consolidation remains (below).

## DO THESE FIRST — small fixes found by the audits (each a new branch off main)
- [ ] **Moderate display names.** Run `sanitizeName` output through `blockedTerms.isBlockedForDisplay`;
  reject or fall back to "Player". BE create/join/quickplay handlers. (JOB 23 A1) — *addressed on
  `fix/backend-safety`, branch-only until play-tested + merged to backend main.*
- [ ] **Cap the dictionary cache.** BE `dictionary.js` — bound the Map (LRU/FIFO) or only cache positive
  results. Measured leak: +20.8 MB / 50k invalids. (JOB 22 F1 / 23 A3) — *addressed on `fix/backend-safety`.*
- [ ] **`generateRoomCode` max-attempts guard** (BE `roomManager.js`). (JOB 23 A4) — *addressed on
  `fix/backend-safety`.*
- [ ] **Per-socket AI-judge budget.** BE — before adding `ANTHROPIC_API_KEY`, add per-socket + per-round
  judge limits + verdict caching on top of the global throttle. (JOB 23 A2) — *deferred: no key is live,
  so it cannot fire; do before enabling the judge.*

## STABILITY / TEST DEBT
- [ ] **The flake pair.** `e2e/sat-rush.spec.js:37` (full BRIEFING→play→death flow) and
  `e2e/purchase-feel-perf.spec.js:61` (frame time + anim counts per KEY POWER tier) FAIL under
  full-suite parallel load and pass 5/5 in isolation (frame times 33 ms isolated vs 66–250 ms under
  load; infinite-anim count unchanged at 46). They have cost attention on three merges. Diagnose
  each: is the test's timing too tight, or is the component genuinely load-sensitive (a real bug on a
  slow device)? Report which BEFORE changing anything. (`fix/flake-pair`)

## MOMENTUM follow-ups (the repeatable sink shipped; these are the open edges)
- [ ] **Surface MOMENTUM in Stats.** The rail (menu) and the shop track show it, but the Stats/records
  screen has no "MOMENTUM: N marks · ×M wins" line — add one so the trophy is legible off the menu.
- [ ] **Menu-fit coverage with momentum > 0.** The viewport-integrity / menu-fit e2e never seed
  `taw.momentum`, so the rail's ~26 px is untested against the one-screen fit at 360×640. Add a seeded
  case (or fold the rail into the fit-scale group) to prove it never pushes cards off-screen.
- [ ] **Milestone celebration.** Only the newest stud pops. Consider a finite one-shot at 50/100/200
  marks (a stage-complete flash) — event-driven, menu-motion-law safe.

## CONTENT (needs a verified source; DO NOT invent)
- [ ] **JOB 3** SAT words → 1,200, student-readable defs + example sentences. 613 on main, 344 unmerged
  on `data/sat-words`. Batches ~100, dedupe case-insensitively. Needs web verification / licensed list.
- [ ] **JOB 24** SAT definition accuracy audit — sample 100 across main + `data/sat-words`, verify each,
  report error rate per set (decides if `data/sat-words` is safe to merge). REPORT ONLY.
- [ ] **JOB 4 / 13** Category Blitz accept-lists — expand ~33 broad categories in batches of ~20 (BE
  `data/accept-lists-3`, then `-4`), then a VARIANT pass (misspellings, accent-stripped, alt names).
  Real answers only, ≤3 words, dedupe, skip finite categories.

## TIER-1 (branch-only; each needs your 2-device play-test)
- [ ] **JOB 8** decompose `App.jsx` into `useGameSocket`/`useRoom`/`useOverlays`/`useProgressionEvents`.
  Zero behaviour change; run the mock-WS harness after EACH extraction; every existing test unmodified.
  (`refactor/app-split`) — *in progress this batch.*
- [ ] **JOB 11** combo + lucky parity for Word Bomb + Category Blitz (reuse `combo.js` & `luck.js`, no
  forked logic; touches App.jsx WS handlers). e2e per mode; re-run the mode-balance sim afterwards.
  (`feat/parity-wb-blitz`) — *in progress this batch.*
- [ ] **JOB 15** optimistic local validation in Word Bomb (measure Enter→feedback at 30/150/450 ms RTT,
  show accept same-frame, reconcile on `word_result`). (`feat/optimistic-input`)
- [ ] **JOB 17** mid-game reconnect (backoff, RECONNECTING state, rejoin-by-code). No protocol change —
  if impossible without one, report the needed message and stop. (`feat/reconnect`)

## NEEDS A LIVE BROWSER
- [ ] **JOB 20** iOS-Safari (Playwright WebKit) — walk every screen; visualViewport shim, dvh,
  AudioContext resume, position:fixed under keyboard, momentum scroll. Fix unambiguous. (`fix/ios-safari`)
- [ ] **JOB 10** Playwright screenshot baselines (menu, dialogs, shop, rebirth, stats, game screens,
  game-overs) at 1920/1366/390; mask non-deterministic bits; prove 5× stable. (`test/visual-regression`)

## FEATURES (each a real project; prioritise before building)
- [ ] **JOB 12** design-token consolidation — the audit shipped (`design-tokens-audit.md`); the remaining
  work is adding the semantic tokens (esp. the undocumented DANGER-RED family) + a raw-hex build test.
  Subjective canonical-color picks = supervised. (`chore/design-tokens`)
- [ ] **JOB 19** ghost opponents (self-ghosts, localStorage). (`feat/ghosts`)
- [ ] **JOB 34** SAT Rush spaced repetition (SM-2/Leitner; selection only). (`feat/sat-srs`)
- [ ] **JOB 40** unified Settings overlay (move scattered controls). (`feat/settings`)
- [ ] **JOB 39** session recap ("wrapped"). (`feat/session-recap`)
- [ ] **JOB 36** mascot pose reactions across modes (pose swaps only). (`feat/mascot-reactions`)
- [ ] **JOB 38** on-beat submit bonus (uses existing `--beat-intensity`; target 15-30% hit rate).
  (`feat/rhythm-bonus`)
- [ ] **JOB 35** on-screen keyboard visualiser + key heatmap (real SVG; off by default). (`feat/keyboard-viz`)
- [ ] **JOB 18** daily challenge with shared date-seed (same board worldwide). (`feat/daily-seed`)
- [ ] **JOB 16** bot pacing/feel (lognormal delay, thinking pauses, near-misses; win-rate bands).
  Simulation-driven. (`feat/bot-feel`)
- [ ] **JOB 26** CHAIN/FUSE tuning verification (2,000 headless runs/tier vs target bands). (`test/solo-tuning`)
- [ ] **JOB 21** international / non-QWERTY input (IME, dead keys, AZERTY, autocorrect). (`fix/intl-input`)
- [ ] **JOB 27** embeddability (/embed route, iframe focus/audio/fullscreen). (`feat/embed`)
- [ ] **JOB 25** Category Blitz judge eval harness (200-item fixture, precision/recall, model|stub via
  env). *NOTE: a version was pushed to `test/judge-eval` (backend) on 2026-08-29 — verify against
  backend main before rebuilding.*
- [ ] **JOB 9** per-mode SEO pages — **BLOCKED on a router** (app is query-param only; see DECISIONS D0).
  Decide routing first. (`feat/seo-modes`)

## GATED ON A ROUTER DECISION
The app has no path router (modes are `?fuse=1` etc.). JOB 9 (SEO pages) and the "pretty `/fuse`" share
links depend on adding one (React Router or Vercel rewrites — touches routing/deploy). Decide this once;
it unblocks several jobs.

## NOT A JOB
There is no JOB 30 (the 2026-08-27 message stream truncated at JOB 29 "This").
JOB 29 (empty-lobby, REPORT ONLY) was never fully specified — clarify before starting.
