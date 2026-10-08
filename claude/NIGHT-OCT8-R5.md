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

### Step 1 — DONE building → PR #294 (day5b/power) — 17:05 UTC
- Shipped: `power` + `shop` kit icons = the BOLT (kitIconData.js / kitIconsCore.js), StatsV2 POWER chip = the bolt, ShopV2 hold-to-buy SURGE (plate squash + bolt flicker/swell, finite 1 s, `.sp2-power:has(.kb--hold.is-held)`), NOW number lands on confirm.
- Shots: claude/night-oct8-r5/s1-power-icon-24-40-64.png, s1-power-surge-strip.png, s1-shop-1366x657.png, s1-shop-390x844.png, s1-menu-1366x657.png.
- Local: build ✓, lint 0 err, unit 1284/1284, e2e shop-hold/shop/kit/purchase-feel-shop/claims-via-stats/menu-fit 34 passed.
- Note: OVERDRIVE's stock card is also a bolt (pink, speed ticks). POWER is yellow in the gold plate — they rhyme as "power family"; flagged for Andy, not changed (one component per PR).
- Env fix: playwright 1.62 wants chromium_headless_shell-1234; symlinked it to the installed chromium-1194 so e2e run here.

### Step 2 — PODIUM — research (before building)
What's wrong today: LeaderboardV2's three blocks (Block1/2/3 in LeaderboardV2.jsx) are white rectangles with a lilac stripe and two pencil lines — flat, no top face, no colour, no craft. Andy: "legit just a few lines and filled in".
1. Balatro — nothing in that UI is a flat rectangle: every card/button is a stacked plate (face + a darker lower lip + a HARD offset shadow), and the "depth" is a second face, never a gradient. Podium blocks need a visible TOP face and a SIDE face — three planes, flat colours — or they're just tiles. Ref: https://cva.ar-go.co/blog/the-art-of-user-interface-drop-shadows (why hard shadows read as "solid" vs soft shadows reading as "floating")
2. Vampire Survivors / arcade podium convention — the podium itself is COLOURED by place (gold / silver / bronze); rank numerals ride ON the front face and are the biggest glyph in the group. Stepped 2-1-3 order, #1 tallest. Our blocks are all white, so rank only reads from the numeral colour. Ref: https://www.shadcn.io/blocks/awards-podium (the stock "awards podium" layout: three planes per step, place colours)
3. Isometric icon rule — one light direction, top face lightest, side face darkest, outlines a darker shade of each fill (not black) so the planes read as one solid object; asymmetry (different depths / a slight tilt) keeps it hand-drawn. Ref: https://flat-icons.com/what-are-isometric-icons/
Decision: a `PodiumBlocks.jsx` SVG component (three blocks, same viewBox sizes as today so the CSS slot at 1366×657 / 390×844 is untouched): front face + lighter TOP face + darker SIDE face per block, GOLD / SILVER / BRONZE by place with darker-shade outlines, ONE hard black offset shadow per block, a plinth band, overspray dots + one drip, uneven depths (22/18/14) and #3's tilted top kept. Rank numerals stay HTML (`.lb2-place`), switched to WHITE with the black stroke + hard shadow so they pop on the coloured faces (≥ 18px at 0.5 phone scale: 76×0.5 = 38px min). PodiumIcon (the white menu glyph, #266) untouched.

### Step 2 — DONE building → PR #298 (day5b/podium) — 17:40 UTC
- Shipped: `src/components/PodiumBlocks.jsx` (three SVG solids: front + top + side face, gold / silver / bronze, darker-shade outlines, one hard black shadow, plinth band, overspray + drip, uneven depths); LeaderboardV2.jsx imports BLOCKS from it; `.lb2-place` numerals → white, repositioned to the new front faces.
- Shots: claude/night-oct8-r5/s2-podium-before-1366x657.png → s2-podium-1366x657.png, s2-podium-390x844.png (audit clean both).
- Local: build ✓, lint 0 err, unit 1284/1284, e2e v2-leaderboard 11 passed.
- Gotcha for next steps: `vite build` must carry the e2e env (VITE_SUPABASE_URL=https://lb.e2e.invalid/rest/v1/ VITE_SUPABASE_ANON_KEY=e2e-anon-key VITE_KIT_GALLERY=1) or the leaderboard nav never mounts in shot scripts.
- #294 CI: build ✓, e2e shards 1/3/4 ✓, shard 2 running at 17:40.

### Step 3 — DONE → PR #300 (day5b/buttons) — 18:05 UTC
- Audit: all 22 kit icons rendered at 24/40/64/104 (tools/_shots/_tmp/sheet.mjs). Verdicts: REBIRTH read as a pie/spinner at 24–40 (tiny detached wedge) → redrawn with a 280° arc + fat tangent arrowhead; GEARS' small cog was a blob at 24 → made an extra (drops under 32px). Everything else reads at its size (STATS bars, LEADERBOARD white steps, ACHIEVEMENTS trophy, audio, BACK) — left alone.
- Buttons: every kit family already lifts −2/−2 and presses ≤ 11px (#269). Non-kit `.lb2-back` / `.st2-back` only recoloured on hover → lift added (hover media query, transform only).
- Shots: s3-rebirth-gears-24-40-64.png, s3-menu-1366x657.png, s3-menu-390x844.png. Local: lint 0, unit 1284, e2e menu-fit/kit/claims-via-stats/v2-leaderboard 32 passed.

### Step 4 — DONE → PR #301 (day5b/panel, DRAFT, LEFT OPEN) — 18:15 UTC
- `?panel=hollow` (border only, no fill/shadow) vs `?panel=filled` (current). main.jsx sets html[data-panel] from the query (3 lines); Homepage.css one rule. Shots: s4-panel-{hollow,filled}-{1366x657,1920x1080}.png.
- My read in the PR: hollow's 4px black frame nearly vanishes on the dark wall at 1366 — if hollow wins, give the frame plum ink or an inner line.

### CI note (18:05)
- #294 e2e shard 2 failed ONCE on e2e/v2-results.spec.js @1163x450 ("rs2-tally runs into PLAY AGAIN footer") — ResultsV2, a screen #294 doesn't touch; passes locally 4/4 on the branch. Re-ran the failed job once (the one allowed re-run). Main moved meanwhile (#292, #293 merged by round 4b).
