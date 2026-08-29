# Branch Inventory — origin

Generated 2026-08-29. Base of comparison: `origin/main`. A branch is **merged** when it is an ancestor of `origin/main` (`git merge-base --is-ancestor` exit 0).

**Counts:** MERGED 104 (safe to delete) · STALE 29 (>7d old, unmerged, superseded) · LIVE 18 (recent/unmerged/active) · 151 total (excludes `origin/main`).

STALE cutoff: last commit before 2026-08-22 (7 days before today).

## MERGED — ancestor of origin/main, safe to delete (104)

| branch | last commit | merged? | last commit subject |
|---|---|---|---|
| `chore/css-art-audit` | 2026-08-26 | yes | docs(css-art-audit): report-only audit of CSS-drawn art vs assets (no code changes) |
| `chore/dead-code` | 2026-08-25 | yes | chore(dead-code): remove orphaned WordCountChip, dead shop-tab CSS, handleQuickPlayBot |
| `docs/anim-budget` | 2026-08-27 | yes | docs(perf): retire the stale '20 concurrent animations' budget |
| `docs/art-rule` | 2026-08-26 | yes | docs(art-rule): add ART VS MOTION design rule; correct SAT Rush stageIntervalMs note (2000->2800, retune never landed) |
| `docs/block-state-2` | 2026-08-26 | yes | docs(block-state): refresh handoff — mobile scroll, word-attribution fix, card-feel, ART VS MOTION, css-art audit, test counts (262 unit + 133 e2e) |
| `docs/block-state-refresh` | 2026-08-25 | yes | docs: clarify mode-preview examples (word-nav) in handoff |
| `docs/night-reports` | 2026-08-25 | yes | docs(night): preserve autonomous night-run reports |
| `docs/triage` | 2026-08-27 | yes | docs(triage): TRIAGE.md + BACKLOG.md for the 2026-08-27 run |
| `feat/achievements` | 2026-08-28 | yes | feat(achievements): 32 named achievements with a grid screen + wins rewards |
| `feat/blitz-bot-ui` | 2026-07-13 | yes | [T4] polish: share-text edge cases from self-review |
| `feat/blitz-reveal-ui` | 2026-07-11 | yes | feat: show sample acceptable answers on Category Blitz round results |
| `feat/cg-direct-entry` | 2026-08-24 | yes | feat(cg): zero-click CrazyGames direct entry (?cg=1) |
| `feat/collection` | 2026-08-28 | yes | feat(collection): distinct-word Collection with tiers, rarest finds, milestone payouts |
| `feat/combo` | 2026-08-26 | yes | feat(combo): in-game WINS combo multiplier (solo modes) |
| `feat/econ3` | 2026-08-25 | yes | feat(econ): Economy v3 — growing rebirth gates, wins from rounds only, cosmetic XP mults, in-game wins HUD, floatier pops |
| `feat/econ4` | 2026-08-25 | yes | feat(econ): Economy v4.1 — piecewise level curve to cap late-game runaway |
| `feat/econ5` | 2026-08-25 | yes | test(econ5): update 6 e2e specs to the v5 economy contract |
| `feat/econ6` | 2026-08-25 | yes | feat(econ6): exponential rebuild — Key Power tiers, 1.25/1.08 level curve, exponential wins |
| `feat/intro-cooldown-replay` | 2026-08-18 | yes | feat(intro): replay intro once per session (30-min absence boundary) |
| `feat/lucky` | 2026-08-26 | yes | feat(lucky): 1-in-40 lucky words pay 5x XP + 5x wins (solo modes) |
| `feat/mastery` | 2026-08-28 | yes | feat(mastery): per-mode mastery M1–M20 granting a per-mode XP bonus |
| `feat/menu-shop` | 2026-08-23 | yes | feat(rebirth): threshold step 10 -> 3 per rebirth (15, 18, 21, 24...) |
| `feat/menu-wins` | 2026-08-23 | yes | feat(menu): Wins currency + stats screen |
| `feat/menu-xp` | 2026-08-23 | yes | feat(menu-xp): tap-to-earn on touch devices |
| `feat/purchase-feel` | 2026-08-27 | yes | feat(purchase-feel §3+§2): next-goal in shop + buy->confirm->reveal ritual |
| `feat/ranks` | 2026-08-26 | yes | feat(ranks): 10-band rank titles next to LV on menu + stats |
| `feat/record-surface-2` | 2026-08-28 | yes | feat(record-surface-2): PERSONAL RECORDS in the Stats tab (re-cut off current main) |
| `feat/return-bonus` | 2026-08-28 | yes | feat(return-bonus): one-time daily WELCOME BACK grant for returning players |
| `feat/satrush-actual-manga` | 2026-08-13 | yes | feat(satRush): actual manga + music starts on first gesture |
| `feat/satrush-briefing` | 2026-08-12 | yes | feat(satrush): family lesson on every briefing card via cousins, not a rare gate |
| `feat/satrush-manga-pass` | 2026-08-12 | yes | style(satRush): the manga pass — form, not just palette |
| `feat/satrush-suspect-ladder` | 2026-08-12 | yes | fix(satRush): LINEUP fallback ladder relaxes POS before length |
| `feat/satrush-two-modes` | 2026-08-12 | yes | feat(satRush): LINEUP synonym guard — exclude gloss-collision distractors |
| `feat/share-card` | 2026-08-26 | yes | feat(share): one-tap shareable result card on every game-over screen |
| `feat/solo-onboarding` | 2026-08-28 | yes | feat(solo-onboarding): FUSE first-run tutorial card + worked example (match CHAIN) |
| `feat/sound` | 2026-08-28 | yes | feat(sound): fully-synthesized event sound set + clack fatigue fix + 3 toggles |
| `feat/themes` | 2026-08-27 | yes | feat(themes): 5 buyable menu themes via CSS custom properties on data-theme |
| `feat/transitions` | 2026-08-28 | yes | feat(transitions): one directional transform+opacity wipe for every screen change |
| `feat/unified-xp` | 2026-08-28 | yes | feat(unified-xp): every accepted word grants XP on the shared per-word weight |
| `feat/unlock-ladder` | 2026-08-26 | yes | feat(unlock-ladder): free level-gated cosmetic ladder + NEXT unlock teaser |
| `feat/wins-sinks` | 2026-08-28 | yes | feat(wins-sinks): WORD SENSE — a second permanent wins upgrade track |
| `feat/word-counter` | 2026-08-19 | yes | fix(menu): center WordCountChip horizontally |
| `feat/word-value` | 2026-08-27 | yes | feat(word-value §2): WPM everywhere — live HUD, menu self-test, persistence, share card |
| `feat/xp-econ2` | 2026-08-24 | yes | feat(econ): level-up wins payout, Key Power doublers, card payouts, locked-card polish |
| `feat/xp-economy` | 2026-08-24 | yes | feat(economy): Key Power upgrade, flex cosmetics, exp curve, level gates |
| `feat/xp-feel` | 2026-08-24 | yes | feat(shop): loud top-right SHOP button, bigger overlay, rebirth tab |
| `feat/xp-polish` | 2026-08-24 | yes | feat(menu-xp): rAF-lerp bar, number/number readout, rebirth colours, bigger level-up, random pops |
| `feel/gameplay-smoothness` | 2026-07-30 | yes | feel: instant local reject for Word Bomb (too-short / missing-fragment / used) |
| `fix/blitz-scale` | 2026-08-24 | yes | fix(blitz): scale up Category Blitz answer input (and chips) to readable px |
| `fix/card-feel` | 2026-08-26 | yes | test(card-feel): guard card beat pulse (no new loops, featured harder, within budget) + log decisions |
| `fix/design-consistency` | 2026-08-28 | yes | fix(design-consistency): unify the close ✕ control to one variant (Job 9 fixes) |
| `fix/dialog-quality` | 2026-08-25 | yes | fix(dialog-quality): kill dialog canvas, single 200ms open, themed scrollbars, edges, static wall |
| `fix/dict-safety` | 2026-08-27 | yes | fix(safety): strip slurs from all word assets + profanity from display assets |
| `fix/edge-states` | 2026-08-28 | yes | fix(edge-states): solo word-load failure no longer strands the player; audit the rest |
| `fix/feed-attribution` | 2026-08-26 | yes | test(feed-attribution): prove feed credits the submitter in production order; document the non-reachable race + backend fix (JOB 5) |
| `fix/firstrun` | 2026-08-26 | yes | fix(streak): CHAIN/FUSE bump the daily streak on each accepted word |
| `fix/game-feel` | 2026-08-25 | yes | feat(game-feel): SAT Rush LIMITED card badge, briefing top-overflow fix (7 viewports), post-card cover enriched (worked example + wins + run length); exit audit (all screens covered) (items 6-7) |
| `fix/intro-knife-handoff` | 2026-08-22 | yes | fix(intro): make the intro→knife-split title handoff a visual no-op |
| `fix/knife-split-flash` | 2026-08-18 | yes | fix(intro): eager-import KnifeSplit to kill the menu-flash before the reveal |
| `fix/lint-and-hooks` | 2026-08-27 | yes | fix(hooks): move RoomScreen invite hooks above the early return + add CI |
| `fix/menu-bottom` | 2026-08-25 | yes | fix(menu): symmetric top/bottom frame gaps in 16-32 band; mobile stage padding 18/0->18/18; reduce --menu-scale reserve 56->44; menu-vgap checks the two gaps independently |
| `fix/mobile-scroll` | 2026-08-26 | yes | fix(mobile): menu is one screen with the card list scrolling in a fixed frame (title/XP/buttons pinned) so all 5 cards are reachable and the XP bar never scrolls out; add mobile-cards reachability spec |
| `fix/qa-sweep` | 2026-08-27 | yes | fix(qa): §8 menu bottom spacing + §5 cold-submit waking state (gate 168/168) |
| `fix/real-art` | 2026-08-26 | yes | fix(real-art): replace 3 CSS-drawn art pieces with real SVG assets (star/drip/starburst); delete dead chromatic-split block |
| `fix/solo-dict` | 2026-08-25 | yes | fix(solo-dict): larger acceptance-only word list, lazy-loaded after first run |
| `fix/stale-e2e` | 2026-08-24 | yes | test(e2e): fix stale menu/dialog/intro specs for 5-card grid + new splash copy |
| `fix/text-scale` | 2026-08-24 | yes | fix(text-scale): scale up site-wide type on laptops (measured, 6 viewports) |
| `fix/three-again` | 2026-08-28 | yes | fix(cards+wpm): unclip SOLO/MULTI badge, per-mode title fit, WPM only where it means something |
| `fix/three-things` | 2026-08-27 | yes | fix(wins): bank wins per accepted word in every mode (no forfeit on leave) |
| `fix/ui-pass` | 2026-08-25 | yes | feat(ui): menu cleanup, XP-bar reclaim, post-menu sizing pass, blank-overlay fix |
| `fix/ui-pass-2` | 2026-08-25 | yes | fix(ui-pass-2): tighten solo mode dialog + style-consistency audit (item 4) |
| `fix/ui-pass-3` | 2026-08-25 | yes | fix(ui-pass-3): Stats crash + overlay zoom-cancel, menu frame/cards, rebirth icon |
| `fix/ui-pass-4` | 2026-08-25 | yes | fix(ui-pass-4): cards uncut, real mode previews, word nav, raised gates |
| `fix/ui-pass-5` | 2026-08-25 | yes | fix(ui-pass-5): wire CHAIN/FUSE wins, live wins HUD everywhere, vgap, exits, game frames |
| `fix/willchange` | 2026-08-27 | yes | perf(will-change): transform/opacity only, toggled per animation — kill idle promotions |
| `menu/big-counter-daily-link` | 2026-08-19 | yes | feat(menu): enlarge WORDS TYPED odometer, move daily to a text link |
| `perf/assets` | 2026-08-28 | yes | perf(assets): subset the wordmark font (-64%) + non-blocking Google Fonts CSS |
| `perf/bundle` | 2026-08-25 | yes | perf(bundle): split react/sentry vendor chunks, defer posthog to idle |
| `perf/frontend-lag-pass` | 2026-07-30 | yes | perf: drain timer bars via transform:scaleX instead of width |
| `perf/idle-frame-budget` | 2026-08-20 | yes | perf(menu): pause idle card-art loops; mount menu behind fight-card intro |
| `perf/idle-menu-loops` | 2026-08-20 | yes | perf(menu): remove the last idle animation loops (wall stickers, particles, music btn) |
| `perf/tension-css` | 2026-08-20 | yes | perf(word-bomb): tension skin in CSS + instant word acknowledgement |
| `perf/wb-tension` | 2026-08-24 | yes | perf(wb): cut Word Bomb critical-tier VFX load (paint 23.9->16.6ms) |
| `perf/wordbomb-input-feel` | 2026-08-20 | yes | perf(word-bomb): cut per-keystroke rendering cost while typing |
| `remove-imposter-word` | 2026-08-05 | yes | feat: remove Imposter Word game mode entirely |
| `restyle/pack-picker-flat` | 2026-08-18 | yes | restyle(packPicker): flat blocky tiles on Blitz blue |
| `satrush-3stage-ante` | 2026-08-10 | yes | test(satRush): e2e — ?satrush=1 launch link opens the mode directly |
| `satrush-word-expansion` | 2026-08-09 | yes | feat(satRush): WANTED bounty-poster reskin (structural, no rule changes) |
| `satrush/review-selection` | 2026-08-20 | yes | fix(satrush): stop dealing repeats — fix briefing review selection |
| `satrush/run-exit` | 2026-08-19 | yes | feat(satrush): add a run exit — HUD ✕ that cleanly abandons a run |
| `satrush/target-only-and-briefing` | 2026-08-19 | yes | feat(satrush): target-only typing, briefing def-first, briefing refresh |
| `seo/sitemap-refresh` | 2026-08-22 | yes | feat(seo): generate sitemap at build time, add sat-rush page |
| `test/coverage-gaps` | 2026-08-25 | yes | test(coverage-gaps): open every menu-reachable screen and assert zero console errors |
| `test/gameover-coverage` | 2026-08-26 | yes | test(gameover-coverage): cover WB/Blitz/CHAIN/FUSE game-over; fix flaky word-bomb-scoring RACE (poll the async payout, not a fixed wait); dev ?soloms= clock override |
| `tier2-music-wiring` | 2026-08-08 | yes | fix: start music for no-splash sessions + duck it in SAT Rush |
| `tier2-spell-along` | 2026-08-08 | yes | feat(satRush): spell-along endgame — every word becomes typeable |
| `tier3-satrush-feel` | 2026-08-08 | yes | feat(satRush): retro-print game-feel — stamps, invert, spell-along (part 2 of 3) |
| `tier3-satrush-results` | 2026-08-08 | yes | feat(satRush): retro-print results page + docs (part 3 of 3) |
| `tier3-satrush-visual` | 2026-08-08 | yes | feat(satRush): vintage manga/pulp visual rebuild (part 1 of 3) |
| `tune/juice-audit` | 2026-07-30 | yes | tune(juice): soften the bomb-fail K.O. blast when it's an opponent, not you |
| `tune/lineup-suspect-hold` | 2026-08-18 | yes | feat(satRush): LINEUP-only stage-cadence multiplier (lineupStageScale 3.0) |
| `ux/mode-card-connecting` | 2026-08-20 | yes | fix(menu): show connect feedback inside the mode dialog + hold it until the view changes |
| `ux/server-waking-copy` | 2026-08-19 | yes | feat(menu): cold-start WAKING copy on connect-gated CTAs |
| `visual/card-art-enrich-blitz-imposter` | 2026-07-11 | yes | visual(card-art): enrich Category Blitz & Imposter Word scenes to match Word Bomb density |

## STALE — older than 7 days, unmerged, superseded (29)

These are overwhelmingly abandoned June-July menu/title experiments (many self-tagged `no-merge`) and old prototypes/night reports. Unmerged, so review before deleting, but no active work.

| branch | last commit | merged? | one-line guess |
|---|---|---|---|
| `feat/card-press` | 2026-06-26 | no | feat(menu): squash-and-pop press feedback on mode cards |
| `feat/cta-juice` | 2026-06-26 | no | feat(menu): restore beat-synced CTA pop (keep hover/press, idle stays off) |
| `feat/ingame-typing-juice` | 2026-06-26 | no | feat(ingame): make live multiplayer typing big + obvious [feat/ingame-typing-juice, no-merge] |
| `feat/menu-cards-reactive` | 2026-06-26 | no | feat(menu): rich cursor-reactive cards — tilt + lift + colour glow [feat/menu-cards-reactive, no-merge] |
| `feat/menu-clean-base` | 2026-06-26 | no | feat(menu): strip to clean flat-void baseline (no decoration) [feat/menu-clean-base, no-merge] |
| `feat/menu-click-ripple` | 2026-06-26 | no | feat(menu): soft click ripple from the pointer on the background [feat/menu-click-ripple, no-merge] |
| `feat/menu-dots-bg` | 2026-06-26 | no | feat(menu): swap alley-wall background for a quiet halftone dot field [feat/menu-dots-bg, no-merge] |
| `feat/menu-final` | 2026-06-26 | no | feat(menu): composed final menu — parallax + reactive cards + flat title + ripple [feat/menu-final, no-merge] |
| `feat/menu-reactive` | 2026-06-26 | no | feat(menu): cursor-reactive parallax bg + card 3D tilt [feat/menu-reactive, no-merge] |
| `feat/menu-title-simple` | 2026-06-26 | no | feat(menu): flat, minimal title — drop the 3D extrude [feat/menu-title-simple, no-merge] |
| `feat/menu-v2` | 2026-06-26 | no | feat(menu): card press squash-and-pop click feedback [feat/menu-v2, no-merge] |
| `fix/kill-title-spotlight` | 2026-07-03 | no | fix(menu): remove persistent streetlight glow behind title |
| `fix/menu-flash-and-dialog-fit` | 2026-07-05 | no | fix(menu): tone down beat flashes + mode dialog fits content (no clip) |
| `fix/menu-flash-down` | 2026-07-01 | no | style(menu): drop beat-flash peak opacity 0.021 -> 0.004 |
| `fix/menu-polish` | 2026-06-26 | no | feat(menu): big tilting card hover, panel sizing, remove tagline |
| `fix/menu-restore` | 2026-06-26 | no | revert(menu): restore yesterday's look, keep reactive interactions |
| `fix/qa-2026-07-29` | 2026-07-30 | no | feat: direct PLAY SOLO path for Category Blitz + collapse pack picker (#P2) |
| `fix/scale-height` | 2026-06-26 | no | fix(scale): lower height-fit cap DESIGN_H 1040->920 to scale UP, no in-game scroll [fix/scale-height, no-merge] |
| `fix/stage-centering` | 2026-06-26 | no | fix(layout): center the app-scale-zoomed stage in the viewport |
| `fix/title-revert` | 2026-06-26 | no | revert(menu): restore smooth title fill, drop handstyle 3D-extrude [fix/title-revert, no-merge] |
| `integration/menu-final` | 2026-06-26 | no | merge: feat/cta-juice into integration/menu-final |
| `night/audit` | 2026-06-26 | no | docs(audit): read-only frontend health audit [night/audit, no-merge, report only] |
| `night/interactions` | 2026-06-26 | no | docs(night): hover report [night/interactions, branch scratch, no-merge] |
| `night/references` | 2026-06-26 | no | docs(references): visual+interaction reference library [night/references, no-merge] |
| `night/scale` | 2026-06-26 | no | docs(night): scale-up report [night/scale, branch scratch, no-merge] |
| `night/spring-sandbox` | 2026-06-26 | no | docs(night): add spring-sandbox preview URL [night/spring-sandbox, no-merge] |
| `night/wordbomb-feel` | 2026-06-26 | no | docs(night): wordbomb timer + live typing report [night/wordbomb-feel, no-merge] |
| `preview/pack-picker` | 2026-07-07 | no | style(preview): cyberpunk skin over FNF pack-picker (RGB-split title, scanlines, neon glow, terminal accents, corner nodes) |
| `visual/card-art-v2-mass` | 2026-07-11 | no | visual: card art v2 (mass + contrast) for Category Blitz & Imposter Word |

## LIVE — recent, unmerged, possibly active (18)

Committed within the last 7 days and not yet merged. Mostly Job-numbered audit/report branches and in-flight feature prototypes from the current autonomous run. Do NOT delete without owner confirmation.

| branch | last commit | merged? | one-line guess |
|---|---|---|---|
| `audit/2026-08` | 2026-08-24 | no | docs(audit): read-only codebase audit 2026-08 (XP/Wins/Shop layer) |
| `chore/chain-audit` | 2026-08-28 | no | docs(chain-audit): Job 8 — full-economy IN/OUT audit after Jobs 1-7 |
| `chore/copy-audit` | 2026-08-28 | no | docs(copy-audit): Job 15 — user-facing string casing/terminology/voice audit |
| `chore/design-consistency` | 2026-08-28 | no | docs(design-consistency): Job 9 — repeated-element inventory + ranked mismatches |
| `chore/firstrun-audit` | 2026-08-26 | no | docs(firstrun-audit): report-only first-run UX audit (desktop + phone), no code changes |
| `chore/lategame-audit` | 2026-08-28 | no | docs(lategame-audit): Job 19 — what a LV50/R3/150k-wins player sees |
| `chore/willchange-audit` | 2026-08-27 | no | docs(audit): will-change budget audit (report only) |
| `data/sat-words` | 2026-08-26 | no | data(sat-words): +344 real SAT words (612->956) with gloss + blanked context; schema-validated, deduped |
| `docs/backlog-refresh` | 2026-08-28 | no | docs(backlog): Job 20 — refresh standing backlog + this-run follow-ups |
| `feat/modifiers` | 2026-08-28 | no | feat(modifiers): standalone prototype of 12 run modifiers (Job 5) |
| `feat/preview-redesign` | 2026-08-28 | no | feat(preview-redesign): 3 preview-card directions prototype (Job 10) |
| `feat/record-surface` | 2026-08-28 | no | feat(record-surface): split OBSCURE FINDS (vocab) from LUCKY WORDS (chance) |
| `fix/hold-flake` | 2026-08-28 | no | fix(shop): stop hold-to-buy from missing under load / on slow devices |
| `measure/solo-scale` | 2026-08-24 | no | docs(measure): CHAIN/FUSE vertical scale-headroom across 6 viewports |
| `perf/audit-2` | 2026-08-26 | no | docs(perf-audit-2): report-only perf check (menu/game screens); no regressions, WB critical improved |
| `perf/input-latency` | 2026-08-28 | no | docs(input-latency): Job 13 — keydown/enter latency per mode, calm+max, 4x throttled |
| `perf/lowend` | 2026-08-28 | no | docs(lowend): Job 18 — 4x-CPU + slow-3G profile of every screen |
| `proto/cards` | 2026-08-26 | no | proto(cards): two card-redesign directions + real SVG art (prototype only) |
