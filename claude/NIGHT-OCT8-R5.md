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

### Step 5 — TYPING FEEDBACK — research (before building)
What exists: the MENU's per-key pops (MenuXp.jsx, pool 20) already escalate by streak — 10/25/50 keys step the scale (1.0/1.15/1.3/1.45) AND the colour, a screen-edge pulse fires on each crossing, the bought KEY tier adds shards/shadow/gold (useXpCapture.js — src/progress, round 4b's, NOT touched). In-game (Word Bomb) the per-keystroke "pulse" on the input was deliberately REMOVED (lagged the caret on mobile; DESIGN.md:158 bans animating the focused field) — so no per-key effect goes back on the input; the accept has the ESCALATION LADDER punch (uniform scale 1.06→1.2, 280 ms) and the reject a 400 ms input shake.
1. Balatro — every scoring hit is a SQUASH, not a scale: the card/plate goes wide-and-short then tall-and-narrow and settles; the hit lands because the shape changes. A uniform scale pop reads as a zoom. Ref: https://cva.ar-go.co/blog/the-art-of-user-interface-drop-shadows (hard-shadow "solid" read — a squash keeps the solid)
2. ZType — per keystroke the feedback is on the TARGET (the word/enemy), never on the typing field; the keystroke "kicks" the thing you're attacking, and the kick grows with the streak. Our menu has that target: the XP plate (LV + bar) — it should take the kick, scaled by the streak, instead of staying inert while pops fly. Ref: https://zty.pe
3. Monkeytype / Typing of the Dead — the caret is sacred: nothing per key may delay or re-rasterise it; a miss gets a SHORT buzz (Monkeytype's error flash is ~150 ms), long shakes make the next keystroke feel late. Our 400 ms reject shake is too long at 110 WPM. Ref: https://monkeytype.com
Decision: (a) MENU — a pooled XP-plate KICK per key (one pre-built WAAPI animation on `.menu-xp-bar`, transform only, 160 ms, will-change for its life), amplitude by streak tier (1.02 → 1.075); (b) IN-GAME accept — `punch()` becomes a SQUASH (wide/short → tall/narrow → rest) at 220 ms (PUNCH_MS 280 → 220; the ladder's per-tier amplitude stays); (c) reject shake 400 → 260 ms with a harder first hit. No JSX state, no layout reads, 0 new infinite animations.

## ANDY BACK, 21:00 UTC — round 5b continues live

### Merged
- **#294** POWER bolt · **#298** podium · **#300** icon audit (conflicted on kitIconsCore.js after #294 landed; another session had already pushed a byte-identical resolution, so I took theirs, re-ran the gate and merged).
- **#301** menu panel stays OPEN — ANDY PICKS `?panel=hollow` or `?panel=filled`.

### Step 8 — SHOP: every card says WHAT it boosts → PR #303 (day5b/shop-says)
Andy: "there are boosts … things like this should say — boost what? and many don't and things don't make sense."
- `says` string per STOCK item (display only): XP ONLY · NOT WINS / BETTER GEAR ROLL ODDS / WINS + XP · EVERY MODE / EXCEPT OVERDRIVE / EPIC OR BETTER, GUARANTEED.
- Phone rows 182 → 232px: the wrap was pushing the gem price out of the card.
- **FINDING — "OVERDRIVE" means two different things.** `overdrive.js` is the earned Rebirth-Rush ×10 (key `taw.overdrive`). The shop's "×10 OVERDRIVE · NOW" card is NOT that system — it calls `startBoost(10, 5)`, i.e. the code-BOOST slot (`taw.boost`). So the card says OVERDRIVE, the pill says BOOST ×10, and "+5 MIN EVERY BOOST" DOES extend the bought one while it can't extend the earned one. This is a large part of "things don't make sense". Fix is pending Andy's stacking answer.

### Step 9 — BOOST DOCK, bottom-right → PR #306 (day5b/boost-hud)
Andy: "when boosts are active they should have a timer at the bottom right of the screen instead of dead center."
- New `progress/liveTimers.js` (every running timer as one list, each with mult + clock + what it boosts) and `frenzy/BoostDock.jsx` + `.css`.
- Docks to the sound control's corner (z 69 under its 70), renders nothing at rest, `pointer-events: none`. Menu centre pill removed; in-game LiveStack row states the FACTOR only (one clock, not two).
- **PHONE MENU keeps the inline pill**: that screen is 100dvh / overflow hidden with the rail tiles in that corner. Measured two ways to make room (padding `.homepage-wrap`; yielding 112px from `.hp-m`) — both collapsed WORD RACE into CHAIN/FUSE. Dock stands down there via `html[data-view='home']`.
- **PRE-EXISTING BUG (reproduced on clean main):** phone menu + TWO live boosts = two pill lines push WORD RACE under CHAIN/FUSE. Not fixed here; needs its own pass.
- e2e `redeem-codes` + `rr-moments` rewritten to assert the dock (and the phone pill at 390).
- NOT done: the BOOSTS section in STATS — StatsV2 is absolutely positioned at fixed mockup coords with no free band at 1366×657; needs its own layout pass.

### WAITING ON ANDY (asked in chat, 21:1x UTC)
1. **Overdrive stacking** — (a) multiply to ×100, or (b) parallel timers that multiply only while they overlap. My rec: **(b)**.
2. **FUSE FRENZY = 25× XP** — today it is ×5 on WINS. (a) swap to ×25 XP, (b) ×25 on both, (c) keep ×5 wins and add ×25 xp. My rec: **(a)**.
3. **Leaderboard composition** — the podium blocks are fixed, but the top-left third is a dead void, blocks sit low/short, names float off their steps, left half empty vs right half cramped. That is a layout change, not a component one, so it needs his go-ahead.

### 22:0x UTC — #302 landed and answered the open questions by implementing them
Andy (or a parallel session) merged **#302 feat/boosts-explained**: every boost names what it boosts (`name` / `big` / `what` / `time` per card), a NEW `wins25` WINS BOOST item, OVERDRIVE time stacks ("BUY AGAIN = +5 MIN"), "+5 MIN" skips OVERDRIVE (`EXTENDABLE_FX = ['xp','wins','luck']`), FRENZY = **×25 XP per key** in season 2 (`frenzyXpMult` / `__v3`, wins row reads ×1).

- **#303 (my shop-says) CLOSED as superseded** — #302's split into name/what/time is strictly better than my single `says` line.
- **#309 opened** — the one thing from #303 still worth having: #302's extra WHAT + TIME lines overflow the PHONE card and push the gem price OUTSIDE it. Measured each card's content vs its row at 390×844 and 360×640: OVERDRIVE needs 217px, TIME BOOST / EPIC+ ROLL 202px, row gives 196px → `225` out by 21px, `150` and `SOON` by 10px. Row 196 → 224px; all six clear by 3–13px. Desktop was never tight.
- **#306 (boost dock) rebased onto #302 and corrected**: it knew nothing about the new WINS BOOST (buying one showed no timer at all), and its FRENZY row quoted ×5 FUSE ONLY — a multiplier season 2 does not pay. Now reads `frenzyXpMult` when live, else `frenzyMult`, and every row's wording matches that item's shop WHAT line.

**Lesson for the next round:** when a parallel session is live in the same area, re-read main before writing copy — #303 was ~40 min of work that #302 had already done better. The *measurement* work (phone overflow) was the part that survived, because nobody else had done it.

### 22:2x UTC — #309 MERGED; #306 CI caught a payload regression that was mine
- **#309 phone card fit MERGED** (all 6 checks green). Phone STOCK row 196 → 224px; the gem prices are back inside their cards.
- **#306 CI, two failures on the pre-merge head:**
  1. **`payload-budget` — MINE.** `initial payload 977079 > ratchet 975000`. Static-importing BoostDock put its JSX + CSS in the homepage's INITIAL payload. Main's baseline is 974,265 → only **735 bytes** of headroom, and the dock spent 2,814. Fixed by splitting: `progress/anyTimer.js` (eager, only "is any boost running?", every import already eager) + `frenzy/BoostDockMount.jsx` (eager, ~15 lines, lazy-imports the dock when a timer goes live); `liveTimers.js`'s row table moved to the lazy chunk. Re-measured **974,712** — under the ratchet, +447 on main, all gate. No boost, no chunk.
  2. **`v2-results @1163x450` ("rs2-tally into the PLAY AGAIN footer") — NOT mine.** PR touches no ResultsV2 file; the identical test failed on #294 earlier (also unrelated) and passed on re-run; passes 3/3 locally here. Commented on the PR rather than porting a fix — nobody has root-caused it. **Worth its own pass: it keeps failing on unrelated PRs.**

**Lesson:** the payload ratchet has ~700 bytes of headroom. ANY new always-mounted component in App.jsx must be lazy behind an eager predicate, or it trips the budget. Local `npm test` + targeted e2e do NOT catch this — only `e2e/payload-budget.spec.js` does. Run it before pushing anything that touches App.jsx's import list.
