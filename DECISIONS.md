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

## perf/bundle (autonomous, 2026-08-25)
Finding: the named split targets (game screens, shop/stats overlays, SAT Rush 193KB) were ALREADY lazy chunks. The 600KB entry was dominated by eagerly-bundled vendor libs: posthog-js (~211KB), @sentry/react (~86KB), react-dom (~143KB).
Actions (most conservative that meets acceptance):
- vite manualChunks: split react-vendor (react/react-dom/scheduler) + sentry out of the entry (build-config only, zero behaviour change).
- DEFER posthog: dynamic-import inside initAnalytics(), and schedule initAnalytics on requestIdleCallback after mount (main.jsx). posthog's 211KB chunk now loads AFTER first paint. track() already no-ops until posthog is ready, so no lost-event risk beyond a sub-second init delay.
- Sentry kept EAGER on purpose: its ErrorBoundary must be mounted to catch a render crash (it is the safety net the Stats crash would have hit). Deferring it was rejected as too risky.
Measured: entry chunk 600KB -> 162KB (<450 target). Total FIRST-PAINT bytes 600KB -> 391KB (index 162 + react-vendor 143 + sentry 86; posthog 211 deferred). No route slower to interactive (parallel HTTP/2; lazy game/overlay chunks unchanged). 262 unit + 99 e2e green.
