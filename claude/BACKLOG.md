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

---

## 2026-08-28 REFRESH (Job 20) — standing platform backlog + this-run follow-ups

Format: **item** — what it is / why it matters / `target-branch`.

### Platform / infra (from the standing prompt list)
- [ ] **Client router** — real URL routing (history API) so deep links, back-button, and per-mode
  pages work instead of the single-view `view` state. Enables SEO + shareable states. `feat/router`
- [ ] **Versioned save data + export/import** — wrap all `taw.*`/`wa_*` keys in a `{v, ...}` envelope
  with migrations; add export-to-string / import so a player can move devices. Save loss is the
  worst churn. `feat/save-versioning`
- [ ] **Error-boundary granularity** — per-screen React error boundaries (menu/game/shop) so one
  screen's crash doesn't white-screen the app; report to console/analytics. `fix/error-boundaries`
- [ ] **Offline service worker** — cache the shell + fonts + word data so the menu and solo modes
  load offline (school Chromebooks, flaky wifi). `feat/service-worker`
- [ ] **Analytics funnel instrumentation** — event taxonomy for splash→menu→mode→first-word→
  rebirth so drop-off is measurable. Currently blind. `feat/analytics-funnel`
- [ ] **A11y pass** — focus order, roles, live-regions, contrast, keyboard-only nav across every
  screen; audit with axe. Broadens audience + is the right thing. `chore/a11y-pass`
- [ ] **App.jsx decomposition** — split the ~2100-line App into `useGameSocket` / `useRoom` /
  `useOverlays` / `useProgressionEvents`. TIER-1; needs 2-device play-test. `refactor/app-decompose`
- [ ] **Per-mode SEO pages** — static prerendered landing pages per mode (needs the router) for
  search traffic. `feat/seo-pages`
- [ ] **Visual-regression baselines** — Playwright screenshot baselines for menu + each mode so UI
  drift is caught in CI. `test/visual-regression`
- [ ] **Reduced-motion sweep** — verify EVERY animation honors `prefers-reduced-motion` (new Job-11
  sounds, Job-12 wipe, cards); one audit. `chore/reduced-motion-audit`
- [ ] **Embeddability** — iframe/embed mode (CrazyGames-style) hardening: postMessage, no top-nav
  assumptions, storage-partition fallback. `feat/embeddable`
- [ ] **Perf playbook rewrite** — the perf docs predate the composited-animation model; rewrite
  around the real budget (see CLAUDE.md ANIMATION BUDGET). `docs/perf-playbook`

### Gameplay / backend (from the standing prompt list)
- [ ] **Optimistic local validation in Word Bomb** — client-side accept for the 3 client-knowable
  rejects (already done for length/fragment/used per CLAUDE.md; verify + extend feel). TIER-1.
  `feat/wb-optimistic`
- [ ] **Bot pacing** — the solo Word Bomb bot's timing/difficulty curve feels robotic; humanize.
  `feat/bot-pacing`
- [ ] **Reconnect recovery** — restore a player into their live room/game after a socket drop
  instead of dumping to menu. TIER-1 + backend. `feat/reconnect-recovery`
- [ ] **Daily shared seed** — a single date-seeded board all players share (leaderboard-ready).
  `feat/daily-seed`
- [ ] **iOS Safari audit** — audio re-suspend, 100vh/dvh, input zoom, safe-area; the audience has
  iPhones. `chore/ios-safari-audit`
- [ ] **Intl input** — IME / non-Latin keyboards currently break the letter capture; at least fail
  gracefully. `fix/intl-input`
- [ ] **Backend lifecycle audit** — room GC, socket cleanup, memory over long uptime (pairs with the
  known dictionary-cache leak). Backend. `chore/be-lifecycle-audit`
- [ ] **Abuse / rate limiting** — per-IP/socket limits on create/join/submit + display-name
  moderation (see DO-FIRST list above). Backend. `feat/abuse-limits`
- [ ] **SAT definition accuracy** — sample+verify SAT defs, report error rate (REPORT ONLY; content
  cannot be invented). `chore/sat-def-audit`
- [ ] **Judge eval harness** — a fixture set + harness to measure the AI Category-Blitz judge's
  precision/recall before trusting it. `test/judge-eval`
- [ ] **CHAIN/FUSE tuning verification** — replay the balance sims against the shipped constants to
  confirm the difficulty curve still holds. `chore/solo-tuning-verify`
- [ ] **The empty-lobby problem** — a solo player creating a public room sees an empty list; seed
  with bots / matchmaking / a "play solo" nudge. `feat/empty-lobby`

### Follow-ups created by THIS run (Jobs 1–19, all on unmerged branches)
- [ ] **Merge the economy chain** — `feat/unified-xp → mastery → collection → wins-sinks →
  return-bonus → achievements` into main after a 2-device play-test (TIER-1: touches App.jsx WS
  handlers). This is the gating step for most of the below. `chore/merge-economy-chain`
- [ ] **Achievement toast** — Job 7 cut it (element wouldn't stay mounted even in a prod build);
  wins still credit + grid shows all. Rebuild the toast (likely needs a different mount strategy).
  `fix/achievement-toast`
- [ ] **Wire deferred sounds on merge** — Job 11's `sndAchievement` / in-game `sndLevelUp` /
  `sndStreakExtended` are defined but unwired (their systems live on the feature branches, not main);
  add one call each once merged. `chore/wire-deferred-sounds`
- [ ] **Mechanical mastery perks** — Job 2 shipped a safe XP-bonus perk; the spec's +timer/+life/
  +reroll perks need per-mode balance re-sim (and backend for the server-authoritative WB/Blitz).
  `feat/mastery-mechanical-perks`
- [ ] **In-game level-up celebration** — Job 1 persists in-game levels silently (conservative). Add
  the celebration + `sndLevelUp` in-game. `feat/ingame-levelup-fx`
- [ ] **Give THEMES an OUT edge** — Job 8's #1 dead-end: themes are a wins sink with no output. Add a
  small per-theme perk (or reframe as pure cosmetic). `feat/theme-perk`
- [ ] **Cut or wire vanity counters** — `lifetimeLetters` + `taps` feed nothing (Job 8). Wire to an
  achievement/perk or drop from the Stats UI. `chore/vanity-counters`
- [ ] **Pick + wire run modifiers** — Job 5 prototype (`public/proto-modifiers.html`) lists 12; Andy
  picks survivors, then wire into the solo runs with the ARM/preview UX. `feat/run-modifiers-live`
- [ ] **Pick + build preview-card redesign** — Job 10 prototype (three directions); Andy picks one,
  then replace the live ModeDialog with it. `feat/preview-redesign-live`
- [ ] **Act on the audit reports** — implement fixes from Job 9 (design consistency), Job 13 (input
  latency), Job 15 (copy/voice), Job 18 (low-end), Job 19 (late-game dead air, esp. the T6→T7 wins
  cliff + invisible collection). Each its own branch, e.g. `fix/copy-pass`, `perf/lowend-fixes`.
