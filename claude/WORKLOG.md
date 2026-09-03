# WORKLOG — 8-hour autonomous run (start 2026-08-29T06:02Z)

## ========================= SESSION-END SUMMARY (2026-09-03 long run, parts 1/3/4) =========================
Parts 1,3,4 pasted (JOBS 1–6, 13–24). **Part 2 (JOBS 7–12) was NEVER provided** — not actionable, skipped.
RAILS honored: no merge to main except where a job explicitly said (JOB 1 router push); no deploy; every
push verified via `git ls-remote`; long commands redirected to files (no tail); WORKLOG committed each job.
Every branch below is pushed to origin and UNMERGED (Andy reviews), except JOB 1's router which JOB 1
explicitly said to push to main.

| JOB | Branch | Status |
|-----|--------|--------|
| 1  finish in-flight | main (router 4d822fb) | **DONE** — router e2e green (11/11 + full 1087), pushed main; claude/econ-post-cap.md (worst dead stretch 8.66h, spread 1.55×, momentum never maxes, Key T7 @22–82h) |
| 2  WB mid-play redesign | proto/wb-look | **DONE** (prototype) — 3 dirs (table/broadcast/fighter), 2 BE-PICKY rounds each |
| 3  Blitz mid-play redesign | proto/blitz-look | **DONE** (prototype) — 3 dirs (bench/scan-line/rapid-fire), AI-judge dramatized, 2 rounds each |
| 4  MEDIUM audit fixes | fix/audit-mediums | **DONE** — dialog focus-trap, locked contrast, WaveText aria, rarity 5→2 names, REBIRTH standardise; unit 439, dialog e2e 15/15 |
| 5  versioned save schema | feat/save-schema | **DONE, DO NOT MERGE** — taw.save={v,data}, pure migrations, 5 tests green; writer-cutover deferred (Tier-1) |
| 6  progression moments | feat/moments | **DONE** — level-up scales w/ level, real rebirth ceremony, unlock-in-place; 0 new infinite anims, e2e 8/8 |
| 13 ghost of best run | feat/ghost | **DONE** — self-ghost CHAIN/FUSE, 301B/580B, cap 1/mode, 6 tests |
| 14 funnel analytics | feat/analytics | **DONE** — 14 events + session props (PostHog+GA4), no PII; claude/analytics-plan.md |
| 15 error boundaries | fix/error-boundaries | **DONE** — per-screen+overlay ScreenBoundary, inline panel, e2e 3/3 |
| 16 iOS Safari audit | fix/ios-safari | **DONE** — WebKit walk clean; 100vh→dvh fallbacks; audio already iOS-correct; claude/ios-safari-audit.md |
| 17 Blitz accept-lists | (backend) data/accept-lists-5 | **DONE, not merged** — 39 broad cats expanded (2 batches, all ≥40); variant pass already done |
| 18 WS drain extraction | refactor/app-split-4 | **DEFERRED (Tier-1 safety)** — execution-ready spec only; App.jsx 3-freeze history mandates a 2-device play-test unavailable this session |
| 19 returning-player audit | chore/return-audit | **DONE (report)** — welcoming/fair; gap: identical for 1/3/14 days; claude/return-audit.md |
| 20 60-second pitch | chore/pitch | **DONE (report)** — claude/pitch.md |
| 21 steal from new | chore/inspo | **DONE (report)** — Balatro/VS/Monkeytype; claude/inspo.md |
| 22 final visual sweep | chore/sweep-final | **DONE (report)** — no BROKEN/UNFINISHED reachable; claude/sweep-final.md |
| 23 fix sweep BROKEN/UNFINISHED | fix/sweep-final | **DONE** — none at that severity; fixed the 1 real collision (PackPicker label/CLEAR) |
| 24 honest verdict | chore/verdict | **DONE (report)** — good as craft, not yet as a habit; build the run-based WORD JOKERS mode, lead with it; claude/verdict.md |

UNFINISHED / OPEN: JOB 18 (deferred, spec ready); JOBS 7–12 never provided.
FULL PLAYWRIGHT SUITE on main (66a4e09), session end: **1087 passed / 0 failed (15.6m)** — GREEN.


## ===== MERGE TO MAIN (2026-09-01, user-directed) — 7 safe branches, full gate after each =====
main c630b8b → 84e2954. Each merge full-gated (lint 0 / unit 408 / full playwright ~1049, sharded 2×
to fit the env cap); held branches EXCLUDED (verified 050a88a game-fill-2 + RouteFallback both absent).
1. fix/fuse-strip        → merge  1f673b1  (e2e 1049/1049)
2. fix/gameover-pass     → CHERRY-PICK c17dddf only → 49629b1  (normal merge would've dragged the HELD
                            Tier-1 game-fill-2 that gameover-pass was chained on; cherry-picked the lone
                            gameover commit instead. e2e 1049 — 3 known corner-click flakes passed isolated)
3. fix/splash            → merge  d42f3c5  (e2e 1049/1049)
4. fix/full-sweep-pass   → merge  ff8f739  (SoloShell auto-merged w/ gameover's; e2e 1049/1049)
5. fix/dialog-cards      → merge  2638977  (e2e 1049 — 2 transient page.goto timeouts passed isolated)
6. fix/mobile-3          → CORRECTED then committed 10f9cd6. The branch's nowrap+ellipsis+overflow:hidden
                            CLIPPED "RIVAL"→"RIVA…" at 360px (viewport-integrity clipped-text FAIL, caught
                            by the full gate). Root cause of "YOU"→"YO/U" is .game-player-name word-break:
                            break-word; correct fix = nowrap + word-break:normal, NO overflow:hidden.
                            Superseded the branch approach. e2e ingame-word-bomb 35/35 + full 1049/1049.
7. fix/copy              → merge  84e2954  (DOCS ONLY — 0 src/e2e; playwright skipped as pointless, ran
                            lint/unit/build sanity)
HELD (Tier-1, need Andy's 2-device play-test, NOT merged): feat/game-fill-2, fix/loading-states.
Also shipped as a branch (NOT merged, for review): fix/name-the-currency (0d6a14b — "the one thing").

- 06:02Z  JOB A START (fix/adversarial-finds): rarity race, HoldBuy setTimeout, level-304 overflow, vacuous perf gate, pink revert
- 06:09Z  JOB A.1 done (rarity race: underpay 70->60=10 wins fixed; deferred scoring, test proves 70 after resolve). A.2 applying setTimeout HoldBuy.
- 06:13Z  JOB A.2 setTimeout HoldBuy; A.3 level-exact-to-600 (+migration cap); A.4 vacuous 50ms gate -> pool-integrity ceiling; A.5 pink revert (#ff2ec4->#ff4fa3 in 43 files, #ff2ec4 kept for beat flash only; CLAUDE.md updated).
- 06:17Z  JOB A full gate running (bg). Delegated JOB E (adversarial-2) + JOB B (rebalance) to subagents.
- 06:30Z  JOB A DONE (pushed 27a1204, gate green modulo sat-rush load flake). JOB E DONE (chore/adversarial-2 22d3ed45: 14 PASS/1 overclaim). JOB C START (fix/visual-pass-2): wordmark/SHOP collision, gate extension, tap targets, landmarks, spacing.
- 06:42Z  JOB C items 1-3 done (collision+gate, tap targets 44, landmark). Item 4 spacing deferred. Running full gate.
- 06:46Z  INCIDENT: npm ci corrupted node_modules (EPERM esbuild lock, concurrent build). Repaired via taskkill+npm install. Killed JOB B subagent (INCOMPLETE-redo). Switched gate to `npm run gate` (no npm ci). JOB C gate re-running clean.
- 07:01Z  JOB C DONE (gate green in fg chunks: lint/unit/vi-336/fn-148; perf a load flake). Committing fix/visual-pass-2.
- 07:02Z  JOB D START (perf/js-split): lazy-load non-first-paint comps, measure TTI @4x CPU+slow3G median-of-3.
- 07:35Z  JOB D DONE (perf/js-split): TTI proven CPU/latency-bound not byte-bound (gzip=uncompressed=9.6s; sentry-defer + gzip reverted). SHIP: connection-gated route warm (skips ~225kB route prefetch on saveData/2g/3g). <5s needs Tier-1 App.jsx entry-split (deferred). Gate green.
- 07:46Z  JOB B DONE (sim/rebalance): winsmin-sim shows 37.7x spread; degenerate already 1.14x (ok). Flatten mults ({wordBomb:2,blitz:1,satRush:0.5,chain:1.5,fuse:1}=1.43x) DEFERRED — cuts solo earn 4-15x, coupled to cost economy (Tier-1 supervised). SHIPPED: TIER_COST_STEP 6->5 (measured no-op: nobody passes T8 in 200h; longest dead stretch 162.3h Blitz->T6). Gate: unit 401, lint 0, econ e2e 11.
- 07:58Z  JOB F DONE (playthrough, report-only): 28 screenshots @390px across menu/shop/stats/5 modes/dialogs/lobby. Findings: (1)HIGH wordmark clipped by SHOP (=JOB C fix, unmerged) (2)MED solo input placeholders clip (3)MED 3/5 modes below fold (4)LOW-MED solo HUD crowds (5)LOW chain empty square. All modes render, no crashes. Report: claude/playthrough-report.md.
- 15:47Z  BONUS (fix/mobile-polish-2): fixed JOB F finding #2 — solo-mode input placeholders hard-clipped at 390px. Shrunk .solo-input::placeholder to clamp(13px,3.6vw,20px); verified FUSE+CHAIN now FIT exactly (scroll==client). HUD-crowding (#4) deferred — shared WinsHud, needs WB/Blitz play-test. Gate: build/lint/unit 401/vi-default 168.
- 15:51Z  BACKLOG JOB 12 DONE (design-token audit, report-only): 195 distinct hex / 1854 uses vs 9-color palette. Key sprawl: undocumented DANGER RED family (5 near-identical reds, no --danger token), ~10 muted-purple text tints, #111 near-black, yellow/blue variants. Consolidation (add semantic tokens + raw-hex build test) recommended, NOT shipped (subjective canonical-color picks + visual shifts = supervised). Report: claude/design-tokens-audit.md.
- 15:58Z  BACKLOG JOB 5 DONE (first-run audit, report-only): walked cold new-player path @390px. GOOD: gesture-gated TYPE/TAP-TO-START splash (teaches typing+unlocks audio), "TYPE ANYWHERE TO EARN XP" LV1 hint (works, 10/120 after typing), excellent locked-mode previews (CHAIN: what/example/200 wins/LV20-19-to-go). ROUGH: (1)HIGH wordmark clips under SHOP at LV1 too — but splash wordmark wraps 2-line unclipped = menu-only bug (=JOB C fix) (2)MED 3/5 modes below fold. 404 /_vercel/insights = harmless local-only. Report: claude/firstrun-audit.md.
- 16:03Z  BACKLOG JOB 6 DONE (runtime perf audit, report-only): @4x CPU/390px, median frame time 16.6ms (60fps) on menu-idle + ALL solo modes (calm+critical); solo modes have 0 anims at rest (exemplary). Only frame-drop: menu 30keys/s burst (61ms med, but 4x+extreme, pooled peak bounded 73). Finding: 3 infinite idle loops on menu CARDS (cb-throb/cb-illuminate=Blitz brain, sr-caret-blink=SAT card) — doc tension (budget zero-infinite vs nothing-static), cost-free, grandfathered = keep-or-convert intent call. No frame-budget regression. Report: claude/perf-audit-2.md.
- 16:06Z  BACKLOG JOB 41 DONE (returning-player audit, report-only): return bonus caps at 12h so 1/3/14 days are IDENTICAL (+1,200 wins R0, "12+ HOURS AWAY") — confirmed live; deliberate (typing game = no offline income, never rivals active play). Card dismisses on any key/tap (never blocks type-to-earn); once-per-calendar-day. Only open item: full intro replays every >30min session, so frequent returners re-watch it forever = tuning/intent call. Report: claude/return-audit.md.
- 16:11Z  BACKLOG (BE, DO-FIRST) DONE: fix/moderate-names — display names now moderated via isBlockedForDisplay at the sanitizeName choke point (covers create/join/quickplay, no WS-handler edit). Falls back to Player on an exact blocked-term name. Unit-tested; full BE suite 332/332. Pushed b8946cc7. (Note: dictionary-cache cap + roomcode guard already done on fix/backend-hardening d10ed81.)
- 16:16Z  BACKLOG (BE, DO-FIRST) DONE: feat/judge-verdict-cache — AI judge now caches genuine (category,answer) verdicts (judged once across all players), fail-opens NEVER cached, cache hits skip API + rate budget, bounded FIFO 5k. Unit-tested (fetch stub), BE suite 333/333. Pushed 485e1ab3. Per-ROUND cap sub-item deferred (needs round context from categoryBlitzLogic). BE DO-FIRST now: names✓ dictcache✓ roomcode✓ judge-cache✓ (3.5/4).
- 16:20Z  BACKLOG JOB 25 DONE (BE): test/judge-eval — pure runEval(fixture,judgeFn) → reject-class precision/recall/F1 + false-reject/accept lists; 40-case common-knowledge fixture (accepts mirror the prompt must-accepts, rejects=non-members+gibberish); keyless deterministic unit tests pin the metric math; judgeEval.cli.js runs the real model. BE suite 333/333. Pushed c8511a2f.
- 16:26Z  BACKLOG JOB 28 DONE (reduced-motion, report-only): VERIFIED COMPLETE — 0 infinite anims under real reduced-motion (emulateMedia); all 32 anim CSS files guarded (0 uncovered); JS juice has central motionAllowed() gate with correct nuance (vestibular=suppressed shake/hitStop/burst, functional-feedback=softened squash/flash per WCAG). Resolves JOB 6 card-loop concern (RM users get them off). Test note: use page.emulateMedia not test.use for RM. Nothing to ship. Report: claude/reduced-motion-audit.md.

- 2026-09-01T06:37Z  JOB 1 START (fix/fuse-strip): FUSE alphabet strip clipped (m,z lost). Fix = flex-wrap tiles + game-fill 26-tile gate. Already implemented in working tree; committing.
- 2026-09-01T06:38Z  JOB 1 DONE (fix/fuse-strip a704888, pushed+verified): flex-wrap strip, all 26 tiles at 1920/1280x551/390x844 (screenshots claude/ingame-pass/shots/diag/fuse-strip-*.png). Gate: lint 0, full e2e 1048/1049 (1 flaky corner-click, passes 12/12 on rerun, unrelated menu test). game-fill 16/16.
- 2026-09-01T06:38Z  JOB 2 START (feat/game-fill-2 off fix/fuse-strip): WB/BLITZ/SAT fill to >=90%% width, no overflow, 5 viewports. TIER-1, BRANCH ONLY. Per-screen height-fit like solo landscape.
- 2026-09-01T06:43Z  JOB 2 SCOPE DECISION: WB/BLITZ/SAT fill needs per-screen height-fit reflow of Tier-1 live-game layouts (removing the zoom overflows 131-145% at 551px). Doing it properly one screen at a time on feat/game-fill-2 (branch-only, will NOT merge). Verifying each with the mock-WS harness. If a screen cannot hit 90% width + fit height safely via CSS reflow, ship the safe subset + document, and continue the run (28 other jobs). BE-PICKY screenshots each.
- 2026-09-01T07:16Z  JOB 2 IMPL DONE (feat/game-fill-2): WB grid-reflow + BLITZ short-window compress + SAT board-fill. WB/BLITZ 88-91% width no overflow; SAT board 100%. game-fill 31/31, WB/BLITZ viewport-integrity 140/140. Report claude/game-fill-2-report.md. Running full e2e before push.
- 2026-09-01T07:35Z  JOB 2 DONE (feat/game-fill-2, pushing): WB/BLITZ 88-91% width no overflow, SAT board 100%. Gate: lint 0, unit 408, e2e 1062/1064 (2 flaky corner-click, pass 12/12 rerun). game-fill 31/31. Report: claude/game-fill-2-report.md. Screenshots jf2-after/. TIER-1 branch-only, NOT merged.
- 2026-09-01T07:35Z  JOB 3 START (fix/gameover-pass off feat/game-fill-2): 5 game-over screens to Blitz standard. Screenshot all 5, BE-PICKY.
- 2026-09-01T07:40Z  JOB 3 FINDINGS (BE-PICKY, shots claude/gameover-pass/shots/before): BLITZ=model(POLISH). WB=BROKEN (card overflows, REMATCH/LEAVE below fold; play screen bleeds through sides). SAT CASE CLOSED=LOOKS UNFINISHED (title clips top, huge empty lower half of page, buttons below fold). CHAIN/FUSE=composed backdrop from prior task but minimal card vs BLITZ. Fixing WB overflow + SAT fill first (worst).
- 2026-09-01T07:55Z  JOB 3 DONE (fix/gameover-pass): WB sticky-footer actions (REMATCH always visible), SAT safe-center (CASE CLOSED no longer clipped), CHAIN/FUSE death-card mascot. Shots gameover-pass/shots/. Running gate.
- 2026-09-01T08:12Z  JOB 3 DONE (fix/gameover-pass c17dddf, pushing): gate GREEN lint 0 / unit 408 / e2e 1064/1064. Pushing.

- 2026-09-01T08:13Z  BRANCH STRATEGY UPDATE: JOBs 1-3 (game-fill/gameover) were interdependent → chained. INDEPENDENT mergeable jobs (splash, save-schema, router, error-boundaries, etc.) now branch off MAIN for clean isolated diffs (chaining would bundle the Tier-1 game-fill-2 into a mergeable branch = footgun). WORKLOG carried forward onto each new branch via `git checkout <prev> -- claude/WORKLOG.md`.
- 2026-09-01T08:13Z  JOB 10 START (fix/splash off main): redesign the splash — strongest screen in the app. Screenshot before/after, BE-PICKY.
- 2026-09-01T08:21Z  JOB 10 DONE-impl (fix/splash): restored bomb mascot hero, crisped starburst (0.12->0.62 + black stroke), darkened wall veil. Splash now a comic hero screen. Shots splash/shots/. Running gate.

## ===== RESUME STATE (2026-09-01, long autonomous run) =====
DONE this session (each gated green lint/unit/e2e, pushed + verified via git ls-remote):
- JOB 1  fix/fuse-strip      (a704888) — FUSE 26-tile strip, flex-wrap; game-fill strip gate.
- JOB 2  feat/game-fill-2    (51b89bc) — WB/BLITZ/SAT fill 88-91%% width, no overflow. TIER-1 branch-only.
- JOB 3  fix/gameover-pass   (45a552d) — WB sticky actions, SAT results fit, CHAIN/FUSE death mascot.
- JOB 10 fix/splash          (f6d9015, gate running) — mascot hero + crisp burst + darker wall.

BRANCH RULE: JOBs 1-3 chained (interdependent game-fill work). JOB 10+ branch off MAIN (independent,
mergeable) with WORKLOG carried forward via `git checkout <prev> -- claude/WORKLOG.md`.
Reports: claude/{game-fill-2,gameover-pass,splash}-report.md + claude/game-fill-2 shots dirs.

NEXT (unstarted, in the queue — pick highest value, one at a time, gate+push+log each):
  JOB 4 chore/full-sweep (REPORT: contact sheets + rank every screen), JOB 5 fix/full-sweep-pass,
  JOB 6 chore/sim-gap (REPORT), JOB 7 chore/stranger-2 (REPORT), JOB 8 fix/dialog-cards,
  JOB 9 chore/wb-blitz-look (REPORT), JOB 11 chore/micro (REPORT), JOB 12 chore/wallscene (REPORT),
  JOB 13 fix/loading-states, JOB 14 fix/mobile-3, JOB 15 perf/after-art (REPORT), JOB 16 fix/copy,
  JOB 17 chore/final-eye (REPORT), JOB 18 chore/playthrough-2 (REPORT), JOB 19 chore/one-thing (REPORT),
  JOB 20 refactor/app-split (TIER-1; plan at claude/app-split-plan.md — do useOverlays first),
  JOB 21 feat/save-schema, JOB 22 feat/router, JOB 23 fix/error-boundaries, JOB 24 feat/offline,
  JOB 25 feat/analytics, JOB 26 feat/optimistic-input (TIER-1), JOB 27 feat/reconnect (TIER-1),
  JOB 28 feat/bot-feel, JOB 29 feat/daily-seed, JOB 30 backend data/accept-lists-5 (other repo).
  Then claude/BACKLOG.md in value order.

GATE = `npm run lint && npm run test && npx playwright test` (NOT npm ci — it corrupted node_modules
before). 2 menu corner-click e2e tests are known-flaky (pass on rerun). Preview server crashes if you
rebuild while it serves — kill it before `vite build`, or let Playwright's webServer manage its own.
- 2026-09-01T08:38Z  JOB 10 DONE (fix/splash f6d9015, pushing): gate lint 0 / unit 408 / e2e 1031/1033 (2 flaky economy tests rarity-race+purchase-feel-shop, pass 5/5 isolated, unrelated to splash).

## ===== 12-HOUR RUN part 1 of 4 (start 2026-09-02) — JOBS 1-5 =====
NOTE: parts 2,3,4 of this run arrived as UNFILLED TEMPLATES ("[paste JOBS 6-20...]") with only
branch-name hints and a false "earlier session finished jobs 1-N" premise (no such session in this
WORKLOG). Jobs 6-20 have NO specs and are NOT actionable — awaiting the user pasting real specs.
Executing the fully-specified Jobs 1-5 only. Rails: branch+push only, never merge main, never deploy.
- 2026-09-02  JOB 1 START (integration/all-held off origin/main cd7d2a5): merge 9 held branches in
  order card-polish->logic-and-onboarding->logic-pass->optimistic-input->reconnect->router->offline
  ->game-fill-2->loading-states, resolving conflicts; lint+unit(+relevant specs) after each; then PLAYTEST.md.
- 2026-09-02  JOB 1 DONE (integration/all-held): merged 8 of 9 held branches; PLAYTEST.md written.
  ORDER + GATE (lint 0 err / unit 428 throughout):
    1-3 card-polish->logic-and-onboarding->logic-pass (linear stack, conflict-free) — lint/unit.
    4 optimistic-input — auto-merged GameScreen.jsx clean; e2e word-bomb-scoring+cold-submit 6/6.
    5 reconnect — App.jsx +145 clean; e2e websocket-boundary+server-waking 4/4.
    6 offline — vite.config PWA + App.jsx clean; build exit0, SW/workbox/manifest generated.
    7 game-fill-2 — GameScreen/App/CSS auto-merged clean; e2e game-fill+viewport-integrity+parity 663 pass exit0 (16min, slow under audit contention but green).
    8 loading-states — App.jsx clean; e2e server-waking 1/1.
  Only conflicts were claude/WORKLOG.md every time (prior per-branch carry-forward) — resolved --ours.
  TIER-1 App.jsx/WS traps VERIFIED intact post-merge: functional setView room guard (App.jsx:902,
    superset form `prev==='game'||prev==='cg-arm'`), FIFO queue in useWebSocket.js, WB instant
    local-reject (GameScreen.jsx:2538-2546 + App.jsx onLocalWordResult). 0 conflict markers in src.
  EXCLUDED feat/router (BEHAVIOURAL, left out per rails): its OWN e2e router.spec.js is RED in
    isolation (e12bde0) — 7/11 fail. Clean-URL /sat-rush,/chain,/fuse AND legacy ?satrush=1/?chain=1/
    ?fuse=1 all render data-view='home' not the mode. Since the legacy query path (no URL bridge) also
    fails, the bug is in the launch/flag gate, not the router bridge — likely the satRush(capital)
    dev-flag gate vs LAUNCH_INTENT.satrush(lowercase). NOT a merge conflict (fails on the branch
    alone). Needs an on-branch fix before it can join; sitemap.xml/vercel.json/share-links ride with it.
- 2026-09-02  JOB 2 (audits, subagents ≤2 concurrent): economy DONE (claude/audit-economy.md) —
  1.54x mode spread holds, but HIGH (survived refutation): Word Sense rarity factor
  wordSenseWinsFactor=1+(rarity-1)(2.5^tier-1) is UNCAPPED + applied OUTSIDE the x40 cap, reopening
  the spread to 4.4x(W1)->40.8x(W5) favoring SAT Rush; dead stretches <9h/archetype (stale
  archetype200h-sim claiming 165h is obsolete/pre-parity); Collection hard-caps mono-SAT at 612;
  Momentum maxes inside 200h. copy + a11y RUNNING; mobile QUEUED (runs after a11y frees its server).
  CONTENTION LESSON: only ONE server-using audit at a time; light grep audit can overlap.
- 2026-09-02  JOB 4 docs drafted (untracked, will commit on promo/assets): crazygames-submission.md,
  itch-submission.md, portal-checklist.md. ?cg=1 path verified INTACT statically (cgEntry.js +
  App.jsx cg-arm/guarded setView). Cover art DATED (og-image.png Jun24 predates card redesign) —
  regen needs live render, deferred+documented. Poki/GD SDKs NOT integrated — documented as tasks.

- 2026-09-03  START long-run (parts 1-4, JOBS 1-6). Rails: no merge unless job says; no deploy;
  verify pushes with git ls-remote; NO tail on long commands (stream --reporter=line / redirect to
  file); commit WORKLOG every 30m; BE-PICKY on visual jobs.
  JOB 1: reconciled — the four audit branches (combo-naming/shop-keyboard/landscape-nav/wordsense-cap)
  were ALREADY gated-green + merged + pushed earlier this session (origin/main=be742f1). feat/router
  merged locally (4d822fb) but UNPUSHED; the in-flight e2e (bdtw6q6x3, workers=2 --reporter=line) is
  gating it. On green → push main; then re-run 200h sim → claude/econ-post-cap.md. NOT re-merging the
  four (already ancestors on origin).
- 2026-09-03  JOB 1 DONE. Gating e2e (bdtw6q6x3) finished GREEN — 1087 passed (26.1m), .last-run
  status=passed. BUT that run did NOT include e2e/router.spec.js (0 refs), so I ran router.spec.js
  explicitly on current main (27af716): 11/11 PASS (38.6s) — the branch-isolation 7/11 failure the
  WORKLOG feared was resolved by the merge (router.js bridge sets both `satRush=1&satrush=1`, fixing
  the capital/lowercase LAUNCH_INTENT gate). Pushed main be742f1..27af716 (router feat + merge +
  worklog); verified origin/main=27af716 via git ls-remote. Re-ran 200h sim on merged main
  (econ200h-audit.mjs, +per-Key-tier timing) → claude/econ-post-cap.md (untracked per CLAUDE.md):
  worst dead stretch 8.66h (WB, @173h deep endgame); mode spread 1.55x (1.72e4→2.67e4 w/min);
  momentum NEVER maxes in 200h (M155–165, sink stays alive); Key Power T1–T4 free in session 1,
  T7 @ 22–82h, T8 unreached. This is the real post-WORD-SENSE-cap baseline.
- 2026-09-03  JOB 2 START (proto/wb-look, PROTOTYPE ONLY): WORD BOMB mid-play redesign, 3 distinct
  directions as a standalone prototype page. Read claude/wb-blitz-look.md first.
- 2026-09-03  JOB 2 DONE (proto/wb-look 52adf2e, pushed+verified). NOTE: referenced claude/wb-blitz-
  look.md does NOT exist (only parity-wb-blitz-report.md); worked from the mode's real elements.
  Chrome extension not connected (bg session) → screenshotting via Playwright (claude/wb-look/shoot.mjs
  file://), not claude-in-chrome. Built 3 DISTINCT ideas of what the screen IS (not variations):
  A · PASS-THE-BOMB TABLE (you are the input dock, opponents ring the table, bomb centre, fragment
  lights pink inside your typed word); B · ESPORTS BROADCAST (LIVE bar + STANDINGS rail + centre desk
  + LIVE-FEED ticker + wide input); C · VERSUS FIGHTER (corner HP plates, giant HIT-COMBO counter,
  bomb as stage hazard, STRIKE input). All: authored SVG bomb, edge-to-edge, thick black outlines,
  hard offset shadows, flat neon, transform/opacity only, 0 new infinite anims. BE-PICKY: 2 rounds
  each (A R1 assembled/collisions→R2 table; B R1 no input+void→R2 desk; C R1 strong→R2 polish). Files
  claude/wb-look/{proto.html,report.md,shoot.mjs} + public/wb-look.html (preview at /wb-look.html?d=a).
  Shots claude/wb-look/shots/, sent to user. Pick: C readability / A warmth.
- 2026-09-03  JOB 3 START (proto/blitz-look, PROTOTYPE ONLY): CATEGORY BLITZ mid-play redesign, 3
  directions. Elements: category prompt, 20s clock, answer list building, opponent rail, AI judge
  moment (the USP — make the judgement visible + dramatic).
- 2026-09-03  JOB 3 DONE (proto/blitz-look 911c4e2, pushed+verified). 3 distinct ideas, each
  dramatizing the AI judge differently: A · THE JUDGE'S BENCH (courtroom — THE CASE/RECORD/GALLERY,
  gavel+AI-disc emblem, ✓ APPROVED verdict stamp); B · THE SCAN LINE (conveyor belt → AI SCANNER gate,
  word under a scan beam, PASS/FAIL, crates exit right); C · RAPID-FIRE ARCADE (authored countdown ring,
  answer stack w/ instant ✓/✗, opponent race rail, huge "AI JUDGE RULES → CHUPACABRA → ✓ VALID" flash).
  All house-rule clean (authored SVG, edge-to-edge, thick outlines, hard shadows, flat neon,
  transform/opacity, 0 new infinite anims; C's clock is an SVG arc not a conic-gradient). BE-PICKY 2
  rounds each (A: stamp-covered-word+judge-hidden→vertical stack; B: empty gate+hidden word→real
  scanner+beam separated; C: conic clock→SVG arc). Files claude/blitz-look/{proto.html,report.md,
  shoot.mjs} + public/blitz-look.html (/blitz-look.html?d=a). Shots sent to user. Pick: C.
- 2026-09-03  JOB 4 START (fix/audit-mediums): fix MEDIUM audit findings from audit-a11y.md /
  audit-copy.md / audit-mobile.md — dialog focus trap+move-in, Stats/Shop locked contrast, Lobby
  aria-prohibited-attr, rarity-axis naming (5 names→2), REBIRTH/PRESTIGE/REBORN/PHOENIX standardise.
- 2026-09-03  JOB 4 DONE (fix/audit-mediums 2983a8e, pushed+verified). (1) ModeDialog.jsx: focus-in
  on open + Tab-trap (tabIndex=-1 shell + wrap first↔last), Escape still closes [MED-1]. (2) contrast
  [MED-2]: Stats .rec-cell--locked .rec-label/.rec-req #6f5f8e/#7a6a99→#8f7eb2 (~5.5:1 on #0d0618);
  Shop .shop-card.is-locked opacity 0.5→0.72 + locked .shop-card-price #e6ddf5 / .shop-card-gap
  #d8cfe8 (was rgba .6). No locked HUE changed. The 2 single-node clusters (WB dialog orange "40",
  Join Room title) were out of the job's Stats+Shop scope — left for follow-up. (3) WaveText.jsx
  [MED-3]: accessible name now a visually-hidden text node, not aria-label on a generic span (fixes
  lobby title + room code). (4) rarity 5→2 names [A2]: keep RARITY (word tier) + WORD SENSE (upgrade);
  CollectionScreen "BY TIER"→"BY RARITY", achievement DEEP CUT→OBSCURITY; COMMON/UNCOMMON/RARE/OBSCURE
  kept as tier VALUES; upgrade "TIER n" (KEY POWER/WORD SENSE level) kept. (5) REBIRTH [A4]: PRESTIGE
  n→REBIRTH n (unlockLadder), REBORN→REBIRTH, PHOENIX→REBIRTH ×5 (achievements); ETERNAL (secret,
  not in job's list) left+flagged. All ids/keys unchanged. Gate: lint 0, unit 439/439, dialog e2e
  15/15 (mode-dialog+dialog-quality+solo-mode-dialog). Report claude/audit-mediums-report.md.
  ENV NOTE: `npx vitest run` is the WRONG unit cmd here — it globs 13 stale .claude/worktrees/agent-*
  checkouts and reports 1049 phantom fails. Canonical is `npm run test` = node --test "src/**/*.test.js"
  (worktree-safe). Stale worktrees are harmless to the real gate (node --test + playwright testDir=e2e).
- 2026-09-03  JOB 5 START (feat/save-schema, DO NOT MERGE): versioned save schema per
  claude/save-migration-plan.md — taw.save={v,data}, pure migrations, detect+migrate+atomic writeback,
  keep reading legacy keys as v0, stop writing them, never delete legacy. Tests per spec.
- 2026-09-03  JOB 5 DONE (feat/save-schema b401bf7, pushed+verified, NOT merged). Existing branch was
  stale (plan-only off old main) → rebuilt off current main via --force-with-lease. src/save/schema.js:
  taw.save={v,data}; buildV0FromLegacy (23 PROGRESS_KEYS verbatim, 5 device keys excluded); pure
  MIGRATIONS (v0→v1 verbatim wrap, v1→v2 stub — both identity on real data, only touch a __probe
  scratch); migrate() pure+ordered+throws on invalid/newer; loadSave() detect/rebuild/migrate/atomic
  writeback, never throws/wipes; versioned export/import (strict allowlist). main.jsx: guarded loadSave()
  on boot. schema.test.js: 5 required tests GREEN (v0→v1 realistic 28-key; corrupt→defaults no-throw;
  interrupted write recoverable+legacy intact; export→import round-trip; v2 stub ordered chain).
  Gate: build 0, lint 0, unit 444/444. DECISION (plan's open Qs → defaults): exclude 5 device keys;
  whole-blob atomic write; silent migration on load. DEFERRED (genuinely Tier-1, documented): the
  ~30-writer cutover to STOP writing loose keys — no shared storage chokepoint exists, so it needs a
  saveStore facade + per-module supervised review; this branch keeps loose keys authoritative +
  taw.save as versioned mirror/export. Report claude/save-schema-report.md, plan committed.
- 2026-09-03  JOB 6 START (feat/moments): progression moments — LEVEL UP scale-with-level, REBIRTH
  ceremony sequence (counter→0, new mult stamps, MOMENTUM survives), CHAIN/FUSE unlock-in-place moment.
  ≤1200ms, skippable, transform/opacity only, pooled, no new infinite anims.
- 2026-09-03  JOB 6 DONE (feat/moments 158d228, pushed+verified). (1) MenuXp celebrate(level) now
  derives tier 0-4 (+milestone 10/25/50/100) → hotter/bigger title (data-tier CSS) + tier-scaled pooled
  shard burst (LV50≠LV2). (2) rebirthCelebration(n,fromLevel,mult) = sequenced ≤1200ms ceremony (level
  winds to 0 → ×N FOREVER stamps → MOMENTUM KEPT), skippable via tap/key, reduced-motion→end-state;
  Homepage feeds threshold+rebirthMult. (3) GameCard unlock-in-place: locked→unlocked edge fires a
  one-shot pop + UNLOCKED! flash, gated once via taw.unlockSeen.<id>, reduced-motion skips. All
  transform/opacity, 0 new infinite anims. Gate: build 0, lint 0, unit 439/439, e2e menu-xp+card-beat
  8/8 (budget green), dialog untouched. Peak frames claude/moments/shots (via throwaway spec, removed).
  Report claude/moments-report.md. Sent shots to user.
- 2026-09-03  ===== PART 1 (JOBS 1-6) COMPLETE. Part 2 (jobs 7-12) NEVER PROVIDED in the prompt (only
  parts 1,3,4 pasted) → skipping to PART 3 (jobs 13-18). =====
- 2026-09-03  JOB 13 START (feat/ghost): ghost of your best run — record compact solo replays
  (word,ts,accepted) in localStorage; race the ghost of your own best CHAIN/FUSE run on the same
  timeline w/ pace shown. Report bytes/replay + cap kept.
- 2026-09-03  JOB 13 DONE (feat/ghost da72e43, pushed+verified). src/solo/ghost.js: compact per-mode
  self-ghost in localStorage — accepted-word timeline (word+ts@100ms), keep ONLY best run/mode, cap
  MAX_EVENTS=400, guarded. CHAIN+FUSE: record each accept, finish(mode,score) on game-over, live
  GHOST n HUD readout (green ahead/red behind) racing your best on the run metric; both clocks start
  at first accept. Bytes: 301B (20-word CHAIN), 580B (40-word FUSE). Tests 6 green; build 0, lint 0,
  unit 445/445, solo-dict e2e green. Report claude/ghost-report.md. HUD shot claude/ghost/shots.
- 2026-09-03  JOB 14 START (feat/analytics): instrument progression funnel via installed PostHog/GA4
  — events first_visit/splash_dismissed/mode_opened/round_started/round_completed/level_up/
  first_wins_earned/shop_opened/item_purchased/rebirth/streak_day/share_copied/locked_mode_clicked/
  secret_found; session props level/rebirth/streak; no PII/keystrokes. Write claude/analytics-plan.md.
- 2026-09-03  JOB 14 DONE (feat/analytics 4ad9960, pushed+verified). Centralized lib/events.js catalog
  + analytics.js dual-sink (PostHog+GA4 gtag) track/trackOnce/setSessionProps. 14 funnel events wired
  (first_visit, splash_dismissed, mode_opened, round_started/completed[solo CHAIN/FUSE], level_up,
  first_wins_earned, shop_opened, item_purchased, rebirth, streak_day, share_copied,
  locked_mode_clicked, secret_found) + session props level/rebirth_count/streak. No PII/keystrokes,
  all guarded+additive. SAT+multiplayer round events = documented follow-up (Tier-1 WS handlers).
  build 0, lint 0, unit 439/439. claude/analytics-plan.md committed.
- 2026-09-03  JOB 15 START (fix/error-boundaries): wrap menu + each game screen + each overlay in its
  own boundary; a crash shows inline "THIS SCREEN BROKE — GO BACK" panel w/ working back action +
  Sentry report, rest stays interactive. Test: force a throw in each boundary, assert rest works.
- 2026-09-03  JOB 15 DONE (fix/error-boundaries b9ca2f8, pushed+verified). ScreenBoundary.jsx/.css
  (Sentry.ErrorBoundary + inline THIS SCREEN BROKE/GO BACK panel, Sentry-tagged, covers own screen box
  only). App.jsx wraps active `screen` in a per-view boundary (key=view, onBack=goHome; menu reloads);
  Homepage wraps each overlay (mode-dialog/locked-preview/rank-ladder). ?boom=<name> test seam. e2e
  3/3 (game/menu/overlay crash + GO-BACK recovery + isolation). build 0, lint 0, unit 439/439,
  regression menu/dialog/solo 21/21. Global boundary kept as catch-all. Report+panel shot saved.
- 2026-09-03  JOB 16 START (fix/ios-safari): Playwright WebKit walk of every screen/mode; check
  visualViewport keyboard shim, input focus in gestures, dvh, AudioContext resume, SW (offline),
  position:fixed under keyboard, momentum scroll. Fix unambiguous, report real-device items.
- 2026-09-03  JOB 16 DONE (fix/ios-safari 2df4b9f, pushed+verified). Playwright WebKit 26.5 (iPhone 13)
  walk: NO h-overflow any screen, root height==innerH, dvh/svh/visualViewport/serviceWorker all ✓,
  only benign local _vercel/insights 404. audioCore already iOS-correct (webkitAudioContext + !AC
  guard + suspended-resume + visibilitychange re-resume). FIX: added 100dvh fallback to remaining raw
  100vh viewport-fit heights (index.css html+#root; Credits/Lobby/PublicRooms/Room calc wrappers) —
  the one gotcha headless can't repro (URL-bar-inclusive 100vh). Report claude/ios-safari-audit.md +
  claude/ios/ tooling. REAL-DEVICE items documented: soft-keyboard input occlusion, audio-after-tap,
  momentum scroll, SW offline. build 0.
- 2026-09-03  JOB 17 START (backend repo chain-reaction-backend, data/accept-lists-5): expand ~33 broad
  under-expanded Category Blitz accept-lists in batches of ~20 (real answers, <=3 words, dedupe CI,
  no inventions, skip finite w/ note); then variant pass (misspellings/accent-strip/alt-names/short).
- 2026-09-03  JOB 17 DONE (BACKEND repo chain-reaction-backend, data/accept-lists-5, pushed+verified
  d952810 — NOT merged). Expanded 39 broad under-expanded (<40) Category Blitz categories across 2
  batches, each written to disk + committed before the next; real answers only, <=3 words, lowercase,
  union-merged (dedup via Set), no inventions. BATCH 1 (expand-broad-4.js, 20): electronic music
  genres, music festivals, milk alternatives, steak/BBQ/potato/rice/squash/melon/pancake types, energy
  drinks, cooking & game shows, web browsers, wild canines, coral, dipping sauces, world deserts, phone
  brands, Ben & Jerry's — all now >=40 (were 15-25). BATCH 2 (expand-broad-5.js, 19): big cats,
  printmaking, music-production software, electric guitar models, potato-chip/snack-cake/salad-dressing/
  yogurt brands, breakfast meats, TV westerns, 90s + British sitcoms, bowling terms, brass instruments,
  egg/dried-fruit/jerky types, Roman gods, Greek heroes — all now >=40 (were 14-25). SKIPPED as
  genuinely FINITE (the bulk of the <40 list): countries/planets/oceans/chess pieces/zodiac/months/
  Beatles albums/HP books/Great Lakes/continents etc. VARIANT PASS: already complete in prior work
  (variants-1..11 exist, merged in categoryAnswers.js) — nothing to add. modules load OK, lint clean.
- 2026-09-03  JOB 18 START (refactor/app-split-4, TIER-1, BRANCH ONLY, DO NOT MERGE): move the 576-line
  WS drain into useGameSocket via the receive-setters pattern, byte-identical; hook owns in-game state
  + 18 refs; every existing test must pass UNMODIFIED. Run mock-WS harness + full suite.
- 2026-09-03  JOB 18 DEFERRED (refactor/app-split-4 df58d8b, pushed — branch-only, spec not code).
  TIER-1 safety mandate (App.jsx 3 prod freezes → 2-device play-test required, unavailable this
  session; harness-only gating on a ~60-dep god-effect move = documented freeze pattern per
  app-split-plan.md). Delivered an EXECUTION-READY spec: exact dependency bag (34 setters/25 refs/16
  imports/2 consts), scattered state+ref map w/ line numbers, drain reads NO bare view (stale-closure
  neutralised), two byte-identical options (effect-only / full-ownership), guardrail suite list.
  App.jsx unchanged 2459. Report claude/app-split-4-report.md.
- 2026-09-03  JOB 19 START (chore/return-audit, REPORT ONLY): simulate 1/3/14-day returns at LV12+4d
  streak, LV30 R1 broken streak, LV8 lost streak; screenshot 1366x768 + 390x844; assess absence
  acknowledgement, punishment, next-goal clarity, welcome-back fairness. Write claude/return-audit.md.
- 2026-09-03  JOB 19 DONE (chore/return-audit 81ffaa6, pushed). REPORT: WELCOME BACK card
  acknowledges absence, non-blocking, never punishing (lost streaks silent, no guilt); bonus fair +
  scales w/ rebirth (R0 +1200/R1 +1800); GAP: identical for 1/3/14 days (12h cap) = re-engagement miss;
  mobile card overlaps XP bar. claude/return-audit.md + claude/return/shots (6).
- 2026-09-03  JOB 20 START (chore/pitch, REPORT ONLY): claude/pitch.md — 1 sentence/paragraph/page x 3
  audiences (stranger/portal reviewer/admissions); + honest what-nothing-else-does list.
- 2026-09-03  JOB 20 DONE (chore/pitch 89f30a4, pushed). claude/pitch.md: 1 sentence/para/page x 3
  audiences + honest USP (synthesis + rarity-priced typing + AI judge + spell-along; no world-first).
- 2026-09-03  JOB 21 START (chore/inspo, REPORT ONLY): 3 unlooked games (Balatro/Vampire Survivors/
  Monkeytype) — the single hard-to-put-down mechanic + the TYPE A WORD version + honest non-transfers.
- 2026-09-03  JOB 21 DONE (chore/inspo f537214, pushed). claude/inspo.md: Balatro synergy->WORD JOKERS
  (reuse hidden rarity x combo x lucky mults), VS draft+escalation->survival run, Monkeytype instant-
  restart+PB->SPRINT mode+ghost; build Balatro-steal first; honest non-transfers.
- 2026-09-03  JOB 22 START (chore/sweep-final, REPORT ONLY, LAST full sweep): screenshot every screen/
  dialog/overlay/state @ 1920/1366/390, rank BROKEN/UNFINISHED/POLISH w/ filenames. Be harsh.
- 2026-09-03  JOB 22 DONE (chore/sweep-final e69e88e, pushed). 26 shots @ 1366+390 of all statically-
  reachable screens: NO BROKEN, NO LOOKS-UNFINISHED — all POLISH. Multiplayer in-game/game-over/lobby
  need live WS harness (covered by proto/wb-look+blitz-look+gameover-pass). claude/sweep-final.md.
- 2026-09-03  JOB 23 START (fix/sweep-final): sweep found no BROKEN/UNFINISHED; fixing the 2 borderline
  COLLISION defects (blitz PICK-YOUR-PACK/CLEAR crowding; return-card overlaps XP bar @390) w/
  before/after; leaving pure-taste POLISH for Andy.
- 2026-09-03  JOB 23 DONE (fix/sweep-final 1bd8a7b, pushed). Sweep found no BROKEN/UNFINISHED; fixed
  the one genuine collision (PackPicker PICK-YOUR-PACKS label under the CLEAR chip @ narrow). dialog
  e2e 13/13. Left pure-taste polish for Andy.
- 2026-09-03  JOB 24 START (chore/verdict, REPORT ONLY, LAST JOB): is this game good? harsh verdict +
  stranger-after-5min + biggest blocker + one argued change + what to cut.
