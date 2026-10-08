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

### 16:30 UTC — round 5b resumes (round 5 died 13 min in; this run picks the plan up, branches are `day5b/<step>`)
- main is at 6cc833c (#288 day4/roll-feel merged). Round 4b is live in parallel on rollScreen/*, markCard/*, GameScreen.jsx — not touched here.
- Step order unchanged (smallest first): power → podium → buttons → panel (OPEN) → typing → critique → report.

### Step 1 — POWER icon — research (before building)
What's wrong today: kit `power` (kitIconData.js) is literally a KEY — round bow, shaft, two teeth (the plate in UPGRADES, the BOUGHT toast, the StatsV2 chip). The menu rail's UPGRADES tile (`shop`, kitIconsCore.js) is an up-arrow pierced by a white rung — reads as "ladder / arrow-through-rung", not POWER. Andy: "why is it a key animation?"
1. Brawl Stars — POWER POINTS are a pink tile with a bold bolt-ish glyph; the whole upgrade economy is read through ONE repeated silhouette (the bolt), never the thing it unlocks. Lesson: a single, unmistakable silhouette — the bolt — repeated everywhere POWER is mentioned (tile, plate, chip, toast). Ref: https://4gnews.pt/brawl-stars-como-fazer-upgrade-aos-brawlers/
2. Clash Royale — the UPGRADE action is a fat green up-arrow on a button, but the CARD LEVEL is a stacked chevron / numeral. The arrow is the verb (upgrade), not the noun (power). Our UPGRADES tile had the verb; the plate needs the NOUN — the power itself. Ref: https://supercell.com/en/games/clashroyale/blog/release-notes/game-update-december-13
3. Pet Simulator 99 — enchant / upgrade icons are chunky flat silhouettes with a thick DARK outline, a single shade plane and ONE white glint — exactly the kit's house construction (ink 6/100, shade ↘, glint ↖, extras). The bolt must be built the same way or it won't sit next to WINS / GEMS. Ref: https://progameguides.com/roblox/how-to-use-enchantments-in-pet-simulator-99-roblox/
Decision: a BOLT. `power` = a fat zig-zag bolt (yellow #FFE94A fill, #F2A900 shade plane, ink outline, one white glint, one off-centre spark). `shop` (UPGRADES tile) = the same bolt standing on its existing orange plate (so the tile and the plate rhyme). StatsV2 chip `shop` = a 40-board bolt. Hold-to-buy = the plate squashes and the bolt flashes while the hold fills (finite 1 s, transform/opacity only, via `.sp2-power:has([data-holding])`), and the NOW number lands when the buy confirms.
