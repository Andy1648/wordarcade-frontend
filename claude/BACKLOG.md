# BACKLOG — unstarted work (for a fresh session with no memory)

Context: two autonomous runs (2026-08-26, 2026-08-27) shipped safety fixes, audits, and some
feel/economy branches. This is what's STILL UNSTARTED. Repos: frontend
`~/Downloads/wordarcade-frontend_1/wordarcade-frontend`, backend `~/Downloads/chain-reaction-backend`.
Rules that still apply: never deploy prod; never change the backend WS protocol; TIER-1 files need a
2-device play-test (see CLAUDE.md); never invent SAT words / category answers; branch-and-push only.

## DO THESE FIRST — small fixes found by the audits (each a new branch off main)
- [ ] **Moderate display names.** Run `sanitizeName` output through `blockedTerms.isBlockedForDisplay`
  (from `fix/dict-safety`); reject or fall back to "Player". Files: BE `security.js` / `server.js`
  create/join/quickplay handlers. (JOB 23 A1)
- [ ] **Cap the dictionary cache.** BE `dictionary.js:11/56` — bound the Map (LRU/FIFO ~100k) or only
  cache positive results. Measured leak: +20.8 MB / 50k invalids. (JOB 22 F1 / 23 A3)
- [ ] **Per-socket AI-judge budget.** BE — before adding `ANTHROPIC_API_KEY`, add per-socket + per-round
  judge limits + verdict caching, on top of the global throttle. (JOB 23 A2)
- [ ] **`generateRoomCode` max-attempts guard** (BE `roomManager.js:117`) — defensive, low priority.

## CONTENT (needs a verified source; DO NOT invent)
- [ ] **JOB 3** SAT words → 1,200, with student-readable defs + example sentences. Currently 613 on main,
  344 unmerged on `data/sat-words`. Batches of ~100, dedupe case-insensitively. Needs web verification
  or a licensed SAT list.
- [ ] **JOB 24** SAT definition accuracy audit — sample 100 across main + `data/sat-words`, verify each,
  report error rate per set (decides if `data/sat-words` is safe to merge). REPORT ONLY.
- [ ] **JOB 4 / 13** Category Blitz accept-lists — expand ~33 broad categories in batches of ~20 (BE
  `data/accept-lists-3`, then `-4`), then a VARIANT pass (misspellings, accent-stripped, alt names).
  Real answers only, ≤3 words, dedupe, skip finite categories.

## TIER-1 (branch-only; each needs your 2-device play-test)
- [ ] **JOB 8** decompose `App.jsx` into `useGameSocket`/`useRoom`/`useOverlays`/`useProgressionEvents`.
  Zero behaviour change; run the mock-WS harness after EACH extraction; every existing test must pass
  unmodified. (`refactor/app-split`)
- [ ] **JOB 11** combo + lucky parity for Word Bomb + Category Blitz (reuse `src/progress/combo.js` &
  `luck.js`; touches App.jsx WS handlers). e2e per mode via the harness. (`feat/parity-wb-blitz`)
- [ ] **JOB 15** optimistic local validation in Word Bomb (measure Enter→feedback at 30/150/450ms RTT,
  show accept same-frame, reconcile on `word_result`). (`feat/optimistic-input`)
- [ ] **JOB 17** mid-game reconnect (backoff, RECONNECTING state, rejoin-by-code). No protocol change —
  if impossible without one, report the needed message and stop. (`feat/reconnect`)

## NEEDS A LIVE BROWSER (report-only unless noted)
- [ ] **JOB 5** first-run audit (`chore/firstrun-audit`, commit `claude/firstrun-audit.md`).
- [ ] **JOB 6** perf audit — median frame time on idle menu, music, 30 keys/s burst, each game screen
  calm+critical; vs the block-state perf playbook (`perf/audit-2`, commit `claude/perf-audit-2.md`).
- [ ] **JOB 20** iOS-Safari (Playwright WebKit) — walk every screen; visualViewport shim, dvh,
  AudioContext resume, position:fixed under keyboard, momentum scroll. Fix unambiguous. (`fix/ios-safari`)
- [ ] **JOB 41** returning-player audit (1/3/14 days, realistic saves) → `claude/return-audit.md`, commit.
- [ ] **JOB 10** Playwright screenshot baselines (menu, dialogs, shop, rebirth, stats, game screens,
  game-overs) at 1920/1366/390; mask non-deterministic bits; prove 5× stable. (`test/visual-regression`)

## FEATURES (each a real project; prioritise before building)
- [ ] **JOB 31** word-rarity scoring (COMMON/UNCOMMON/RARE/OBSCURE × length bonus). *Economy fix* — high
  value; tune bands by simulation. (`feat/word-value`)
- [ ] **JOB 12** design-token consolidation + raw-hex build test. The off-palette hex list IS the finding.
  (`chore/design-tokens`) — quick-win audit portion first.
- [ ] **JOB 28** complete `prefers-reduced-motion` path; report covered vs uncovered. (`fix/reduced-motion`)
- [ ] **JOB 32** WPM everywhere (HUD, menu free-typing, stats, share card). (`feat/wpm`)
- [ ] **JOB 33** word collection screen (cap 5k, LRU, milestones). *After 31.* (`feat/collection`)
- [ ] **JOB 37** achievements (~30; start with 10). (`feat/achievements`)
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
- [ ] **JOB 21** international / non-QWERTY input (IME, dead keys, AZERTY, autocorrect). Needs browser.
  (`fix/intl-input`)
- [ ] **JOB 27** embeddability (/embed route, iframe focus/audio/fullscreen). (`feat/embed`)
- [ ] **JOB 25** Category Blitz judge eval harness (200-item fixture, precision/recall, model|stub via
  env). Buildable now, no content risk. (`test/judge-eval`)
- [ ] **JOB 9** per-mode SEO pages — **BLOCKED on a router** (app is query-param only; see DECISIONS D0).
  Decide routing first. (`feat/seo-modes`)

## GATED ON A ROUTER DECISION
The app has no path router (modes are `?fuse=1` etc.). JOB 9 (SEO pages) and the "pretty `/fuse`" share
links depend on adding one (React Router or Vercel rewrites — touches routing/deploy). Decide this once;
it unblocks several jobs.

## NOT A JOB
There is no JOB 30 (the 2026-08-27 message stream truncated at JOB 29 "This").
JOB 29 (empty-lobby, REPORT ONLY) was never fully specified — clarify before starting.
