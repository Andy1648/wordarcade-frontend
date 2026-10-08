# NIGHT OCT 8 — ROUND 5 (cloud run, 12:19 UTC → Andy back 20:00 UTC) — POWER icon, podium, buttons, menu centre, typing feel

## Rules I re-read before each step
- Mine: kit/* (icons + buttons), ShopV2.*, LeaderboardV2.* + /public podium assets, Homepage.css (centre panel only), in-game typing feedback CSS (GameScreen.css / juice — CSS only, no JSX state), achievements, rooms/lobby, splash/credits.
- NEVER (round 4 owns them): rollScreen/*, markCard/*, markGlyphs*, MarksIndex.*, src/progress/*, GameScreen.jsx's Word Bomb HUD. Never season.js, migrations, economy, SQL.
- One component per PR, branch day5/<step> off a FRESH origin/main. Merge myself when CI + E2E are green, then grep a unique marker in the live typeaword.com bundle. Step 4 (panel) stays OPEN for Andy.
- ART VS MOTION: art = SVG paths / assets, never CSS shapes. transform/opacity only, finite, pooled, ZERO new infinite loops, will-change only transform/opacity and only while playing.
- Andy's law: labels ≥ 14px, numbers ≥ 18px, numbers never leave their box, numbers first, animations everywhere but finite + snappy, smooth > annoying, refine COMPONENTS, first-time-user sense.
- Research: 3 findings with sources per step, written here BEFORE building. Two screenshots per PR body (claude/night-oct8-r5/). SHOT_FONTS=1 / fonts route so Bungee renders real.
- Lessons from R3: every font-size needs a var(--fs-*) (typeScale test); npm test before push; branch late steps from a main that has the earlier ones.

## Plan
- [ ] Step 1 — POWER icon + surge (kit power/shop, ShopV2, StatsV2 chip) → day5/power
- [ ] Step 2 — PODIUM as a real asset (LeaderboardV2 + /public/podium) → day5/podium
- [ ] Step 3 — kit icon audit + button families → day5/buttons
- [ ] Step 4 — menu centre panel ?panel=hollow | filled prototype → day5/panel (OPEN, Andy picks)
- [ ] Step 5 — typing feedback escalation (CSS only) → day5/typing
- [ ] Step 6 — leftovers: rooms settings flake @1920, achievements numbers, splash/credits sizes
- [ ] Step 7 — critique pass on prod (1366x657 + 390x844) + REPORT

## Log
(appended per step)
