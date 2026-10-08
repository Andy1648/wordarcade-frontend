# RUN — PROGRESSION FINAL v3 "START AT 1" (Andy, Oct 7 21:27) — branch `feat/s2-progression-v3`

Re-read this section + `claude/SEASON2-CHECKLIST.md` before every step. SEASON2 flag stays OFF. Never touch
Homepage.*, MenuNav, kit/*, CardPager, GameCard (another session owns them). e2e only on CI. ONE PR, NOT merged
(Andy play-tests ?season2=1 first — Tier 1).

## Plan
1. CONSTANTS (src/progress/v3/econ.js): XP_BASE 10 → 1; KEY/POWER ladder → 2^T (×1, ×2, ×4 …); cost stays 150 × 5^T
   unless the sim says otherwise. Menu stays ×0.2 with whole-XP rounding, floor 1 (xp.xpPerInput) → 1 XP a key at start.
   A worn +N BASE XP mark keeps its ×(10 + N)/10 size (it was sized against BASE 10 — not 1 + N).
2. TUNE with the real-module sim (claude/econ-oct2/final-sim.mjs, local, light): the level curve k in 100 × k^(n−1)
   and the rebirth gate 15 + 18R, each within ±20%, to hit: median R1 ≈ 20 min, R3 ≈ 2 h, R5 ≈ 6 h, ≈ R6–R7 at 10 h.
   If R1 ≈ 20 min is out of reach without a structural change → STOP and write the blocker in the checklist.
3. SIM GATE: final-sim.mjs targets → the v3 table (every cell ±20%); update claude/progression-FINAL.md to v3 with the
   new constants + the sim table beside v2's.
4. RANK R0 KEYMASH → INKLING (v3/ranks.js, rankPlates, LeaderboardV2 comment, KitRankBanner doc example, tests, doc).
   kit/* is otherwise off-limits: only the R0 name string changes there.
5. NUMBERS: numbersAudit.s2 / statChain.s2 + v3.test pins → T0 R0 menu key +1, game letter +1; UPGRADES T1 price.
6. SERVER: only if the gate constant changes → 029 (lb_rebirth gate + board-write room), FLIP-STEPS (029 after 027,
   before 023), finalRules/rebirthRules mirrors + tests.
7. Unit + lint + build local; push; ONE PR "feat(season2): PROGRESSION FINAL v3 — start at 1 XP, doubling POWER (~6x
   slower)" with the before/after sim table; CI green (read logs, re-run only failed shards). Do NOT merge.

## Log
- STEP 1 ✅ constants: XP_BASE 1, KEY ×2^T (cost kept 150 × 5^T), a +N BASE XP mark keeps ×(10 + N)/10 (econ + statBoard).
- STEP 2 ✅ tuned on the real-module sim (~60 grid points, median bot, 10 h). PICK: need(n) = 100 × **1.131**^(n−1)
  (was 1.15: −12.7% on the growth), gate **18 + 20R** (was 15 + 18R: base +20%, step +11%), KEY cost unchanged.
  Median: R1 20.7 min · R3 99.8 min · R5 6.75 h · R5 at 10 h (R6 ≈ 12 h).
  BLOCKER (no new mechanic invented): R3 ≈ 2 h and R6–R7 by 10 h cannot both hold in this structure — every point with
  R3 ≥ 96 min (−20%) reaches R6 after 10 h (R5 → R6 ≈ 5–6 h); every point with R6 < 10 h has R3 ≤ 93 min. Picked the
  side that keeps R1/R3/R5 in band; 10 h ends at R5 (−17% vs R6). Andy decides: accept, or relax R3 to ~85–90 min
  (k 1.125 + 18 + 20R + cost 250 gives R1 22.5 · R3 93 · R5 5.5 h · R6 9.7 h).
  Gate changes → 029 needed.
- STEP 3 ✅ 029_progression_final_v3.sql + rebirthRules/finalRules mirrors + tests (the SPAMMER caught the stale 15 + 18R
  server gate: it reached R7 vs the median's R5 until 029's gate landed — now level).
- STEP 4 ✅ final-sim.mjs = the v3 table at ±20% (median = Andy's targets, R6–R7 range cell); CI yaml text; doc v3 + v2.
- STEP 5 ✅ KEYMASH → INKLING (Homepage.jsx comment left — not my file).
- STEP 6 ✅ numbers: base 1 × (10 + N)/10; fractional season-2 letter XP; format.formatStatRate (< 10 → 2 decimals) in
  StatsV2; T0 R0 menu +1 / game +1 / UPGRADES 150 test. e2e pins: season2 (LV17 → 18), numbers-audit (LV80 R3 KEY2),
  v2-rebirth (LV 10 / 18), v2-stats (×64, [1, 8, 27]).
- STEP 7 ✅ FLIP-STEPS 022 → 024 → 027 → 029 → 023 → 028. Local: unit 1273/1273, lint, build, sim PASS.
  PR #255 opened (NOT merged). CI on 1cf0932: ALL GREEN — build, 4 e2e shards + e2e, season2 sim (v3 table ±20%),
  long-run, rule-p. DONE — waiting on Andy's ?season2=1 play-test.

---

# RUN-N — the landing pad

Last rewritten 2026-09-17. Screenshots referenced by name live in `claude/run-n/`.

---

## THE ONE THING TO READ FIRST

**Nothing has reached players since the 15th, and the cost of that is now measurable.** While
`fix/econ-perf-attack` sat unmerged, Batch 1 independently rediscovered and rebuilt the *same*
article/play routing split it already contained — same diagnosis, same solution, same
`PLAY_PATHS` export — a day apart. Two agents solved one problem twice because neither could
see the other's work. That is the concrete price of the backlog, not a hypothetical one.

`release/prod-2` exists and is gated. It needs your sign-off, not more work.

---

## 1. WHAT SHIPPED (branches, gated, NOT merged to main)

### 1.1 `fix/cold-visitor-path` — the cold visitor path
A cold visit to `/<mode>/play` now lands **in** that mode, for all five modes.

- **The cause.** `/chain/play` was never a route; the string existed only in a comment in
  `modeAccess.js`. The SPA rewrite caught the path, the app had no idea what it meant, and the
  splash → menu chain played in front of the mode.
- **Why no gate caught it.** `vite preview` and Vercel disagree about `/chain`. The landing page at
  `public/chain/index.html` wins over the SPA rewrite on Vercel; preview hands the path to the SPA.
  `e2e/router.spec.js` asserted `/chain -> chain view` and passed green for a route that could not
  work on the deploy. This is the `vercel.json` class of failure again.
- **The structural fix.** `vercelStaticParity` (vite.config.js) makes dev and preview resolve
  extensionless paths the way Vercel does, so this class of bug cannot hide locally again.
  `src/routeShadow.test.js` is build-failing and asserts a landing page can never shadow an app
  route.
- Word Bomb and Category Blitz provision a room + bot with no clicks, using the frames Quick Play
  already sends, and wait on their own boot screen (`04-word-bomb-deep-link-boot_1366x768.png`).
- Every share link in the app pointed at the landing page instead of the game. All five now point
  at `/<mode>/play`. Blitz's result-card link pointed at a *different mode* (the Daily).
- The service worker was serving the app for `/chain` to every repeat visitor, hiding the landing
  pages entirely. The five landing paths are now denied the navigation fallback.

### 1.2 The three first-frame defects you found
- **The washout was the first-run coach mark**, not a transition: a 100vmax box-shadow at
  `rgba(6,3,12,0.76)` taking the whole board to a quarter brightness. Compare
  `01-BEFORE-chain-first-frame-washed-out_1366x768.png` with
  `02-AFTER-chain-first-frame_1366x768.png`. Game surfaces pass `dim={false}`. Gated: the board's
  ancestor chain must be fully opaque AND nothing may paint a full-screen scrim, within 1s.
  (The board's own `opacity` was always 1 — a gate that only checked opacity would have passed the
  broken screen.)
- **SAT Rush landed on a cover**, four taps from a word appearing. It now starts a LINEUP run
  itself: `03-AFTER-sat-rush-deep-link-playable_1366x768.png`. ~23s on the first word, all three
  lives, labelled exit in the HUD. The cover and mode picker stay reachable from the menu card.
- **The SAT exit was present**, contrary to the report — `← MENU` under PLAY, shipped in the Batch 1
  commit you pulled. The real defect was the cover, not a missing control.

### 1.3 `release/prod-2` — the assembly
`main` + `fix/econ-perf-attack` (68 commits) + `feat/pause-to-learn` (65) + `fix/cold-visitor-path`.
First two merged **clean**; the third had 13 conflicts, resolved. lint 0 errors, 587 unit tests.

---

## 2. WHAT NEEDS YOUR PLAY-TEST (Tier 1 — blocks merge)

1. **`/word-bomb/play` and `/category-blitz/play` on two devices.** New WebSocket provisioning and
   a new view in the `room_update` lifecycle. The mocked e2e asserts the exact frame conversation,
   but a mock is not the Render backend. Specifically: does the room actually come up on a cold
   dyno, and does the bot seat?
2. **Cancel during a cold start.** Open `/word-bomb/play`, tap `← MENU` within the first seconds,
   then wait a full minute on the menu. You must not be pulled into a game. (This was a real bug
   the adversarial pass found: the provisioning effect stayed armed after cancel.)
3. **The full REGRESSION CHECKLIST**, because `release/prod-2` carries 133 commits of other
   people's work into the room lifecycle as well as mine.

## 3. WHAT NEEDS YOUR TASTE (no right answer — I made a call, tell me if it is wrong)

4. **`DeepLandScreen` is a new surface.** `04-word-bomb-deep-link-boot_1366x768.png` and its failed
   state `05-boot-failed-state_1366x768.png`. It is deliberately plain — it is usually on screen for
   under a second.
5. **Cancelling the boot screen does a full page navigation to `/`**, not a soft `goHome()`. I chose
   that because it touches no WebSocket handler, which is the right trade next to a documented
   Tier-1 trap — but it costs a page load.
6. **The run-over second row is now one control, never two.** A player from the menu gets
   `TRY <MODE>`; a deep-link visitor who has seen no modes at all gets `SEE ALL MODES`.
   `06-sat-results-offer_1366x768.png`, `10-word-bomb-gameover-offer_390x844.png`.
7. **SAT Rush's deep link opens LINEUP, not BRIEFING.** LINEUP needs no teaching screen; BRIEFING is
   mandatory-by-design and I would not auto-skip it. If you would rather a stranger's first SAT
   experience be the study screen, that is a one-line change.
8. **`/category-blitz/play` hands a stranger straight to the Blitz bot**, which has a confirmed,
   unfixed backend blank bug. This link makes that bug a first impression. Consider shipping the
   other four `/play` paths and holding this one.

## 4. WHAT I FOUND AND COULD NOT FIX

9. **The menu at 320×640 is broken** — the wordmark is overlapped by the XP row, card text clips
   (`CATE BLITZ`, `JNLOCKS AT LV 3`), the grid reads as an accident. This is the payoff screen of
   the whole acquisition path: `09-menu-after-offer-chain-unlocked_390x844.png` is the 390 case,
   which is fine; 320 is not. Belongs to Batch 3.
10. **The fixed audio button overlaps content on at least four screens** — the solo coach mark, the
    game-over `SEE ALL MODES` button (`07-word-bomb-gameover-offer_320x640.png`), the menu
    spotlight line. CLAUDE.md's NO ORPHAN FIXED UI rule, recurring.
11. **The solo input placeholder is too long for 320px** and was cut mid-word
    (`08-chain-cold-land_320x640.png`). I added an ellipsis so it degrades honestly; the real fix
    is the copy, which is a Batch 3 call.
12. **Local `/assets/<missing>.js` returns the SPA where Vercel 404s.** That is vite's own
    `htmlFallbackMiddleware`, downstream of the parity plugin; overriding it means replacing vite's
    fallback. Local-dev only.
13. **Screenshots taken through the e2e mock cannot be used to judge typography.** The mock blocks
    all external HTTP including Google Fonts, and only *Bungee Shade* is self-hosted. Every such
    screenshot renders in fallback type. Re-shoot with the font hosts allowed. **This matters for
    Batches 3 and 5, which are both type judgements.**

---

## 5. THE BACKLOG, MEASURED

208 branches are unmerged into `main`. That number is misleading and the real one is smaller:

- **98** have activity since 2026-09-05.
- Those **98 collapse to 40 tips** — the rest are ancestors of their own descendants, so merging the
  tip lands them. They are superseded, not lost, and need no action.
- Of the 40, **13 are substantial** (40+ changed source files) and **mutually independent** — none
  contains another. This is genuine parallel work, not a chain.
- The rest are docs/chore report branches.

### 5.1 The conflict map (dry-run against current `main`, before any resolution)

**One systemic collision explains almost all of it.** `main` gained 8 commits on 2026-09-15 — the
AVIF/media perf work (PRs #34/#35) and the SEO landing pages. Every branch older than that collides
on exactly the same 12–13 files:

```
public/firecracker.mp3, public/mascot-{celebrate,idle,panic,run,taunt}.webp,
src/components/{GameScreen.jsx, LoadingScreen.css, LoadingScreen.jsx, Mascot.css, Mascot.jsx},
src/hooks/useMusicPlayer.js
```

That is a mechanical, uniform conflict with a single consistent resolution rule — *take main's media
pipeline, take the branch's feature code* — not 16 separate judgement calls.

| Tip | Conflicts with main | Nature |
|---|---|---|
| `fix/econ-perf-attack` | **0** | up to date with main |
| `feat/pause-to-learn` | **0** | up to date with main |
| `fix/cold-visitor-path` | **0** | up to date with main |
| `feat/{blitz,fuse,sat}-craft`, `feat/experiments`, `docs/run-n-2`, `fix/run-payout-rate`, `fix/wb-rail-used-words` | 13 each | the media migration, identically |
| `feat/solo-slabs` | 12 | the media migration |
| `fix/visual-batch-1`, `chore/sim-align`, `fix/onramp`, `chore/stranger-{3,4}`, `chore/verdict-4`, `fix/mobile-4`, `perf/integration` | 1 | `GameScreen.jsx` only |
| `refactor/app-split-6` | 1 | `App.jsx` only |
| `feat/daily-2`, `feat/sat-srs-2`, `fix/willchange-gate`, `fix/parity-wait`, + the report branches | 0 | clean |

### 5.2 `feat/solo-slabs` — DEFERRED TO THE ASSEMBLY (do not rediscover this)
**It needs the release assembly, not a merge into the cold-path branch.** `feat/solo-slabs` is 27
ahead / 8 behind main, is not merged, and overlaps this branch on `App.jsx`, `GameScreen.*`,
`Solo.css`, `SoloShell.jsx`, `SatRushResults.jsx` and `vite.config.js`. Merging 27 commits of visual
work into a Tier-1 routing branch would make both unreviewable. It is wave 2 of `release/prod-2`.

**Decision, so the next session does not re-derive it:** the slab + forged-ribbon look is NOT in
`release/prod-2` and is NOT missing by accident. Any branch off the cold-visitor path will show the
PRE-SLAB CHAIN board (flat teal letter, dotted placeholder boxes) and that is expected. The six
overlapping files are `src/App.jsx`, `src/components/GameScreen.{jsx,css}`, `src/solo/Solo.css`,
`src/solo/SoloShell.jsx`, `src/satRush/SatRushResults.jsx` and `vite.config.js` — the same files the
cold-visitor merge already resolved by hand, so doing it twice on two branches would be the same
work twice. It goes in with wave 2, under the one media-migration resolution rule.

### 5.3 What the assembly caught on contact — three defects, none visible on any branch alone

1. **35 layout-matrix failures**, every `locked-fuse` cell across 5 themes x 7 viewports.
   `fix/econ-perf-attack`'s shared screen map seeds level **16** for the locked FUSE preview —
   correct when written, because FUSE unlocked at LV25. `fix/unlock-gates` lowered that to **LV3**.
   At level 16 FUSE is now unlocked, so the card opens the mode dialog instead of the locked
   preview and every cell timed out. One branch owned the map, the other owned the gate, and they
   only met here. The level is now derived from `GAMES[].unlockLevel`.
2. **11 hardcoded font-sizes and 4 Bungee rules below the display floor**, from *both* sides —
   including a 9px tag from `feat/pause-to-learn`, four px under the 13px accessibility floor.
   `feat/type-scale`'s build-failing gate fired the moment the branches met.
3. **The same routing feature, built twice** (see the top of this document).

This is the argument for merging more often, in three bullets: the gates only protect what they can
see, and a branch that never lands is a gate that never runs against anyone else's work.

---

## 6. TIER SPLIT FOR `release/prod-2`

**Tier 2 — mergeable on your preview sign-off** (no WS/game-state changes):
the routing split, the parity middleware, `routeShadow.test.js`, the share-link corrections, the
SW navigation denylist, the spotlight washout fix, the SAT Rush auto-start, the type-scale
corrections, the run-over offer copy.

**Tier 1 — needs the 2-device test** (items 1–3 above):
`/word-bomb/play` + `/category-blitz/play` provisioning, the `vs-bot` view in the `room_update`
guard, and the cancel path.

---

## 7. NEXT

Wave 2 of `release/prod-2` is the 16 branches that collide only on the media migration. They share
one resolution rule, so they should go in one sitting rather than one per night. `feat/solo-slabs`
is in that wave.

---

## PROGRESSION v3.1: "each level a bit harder" (Andy Oct 7 22:31), on `feat/s2-progression-v3` (PR #255)

- **Change:** `CURVE_GROWTH` 1.131 → **1.15** (`src/progress/v3/econ.js`). need(n) = 100 × 1.15^(n−1).
- **Gate:** kept at **18 + 20R**. The median's first rebirth is 24.0 min, inside the 18–25 min hold, so the gate stays.
  Migration 029 is unchanged. Probed for reference: 17 + 20R → 21.2 min.
- **Sim (final-sim.mjs, 10 h):** median R1 24.0 min · R3 2.64 h · R5 not reached · R4 at 10 h. Casual
  44.7 min / 5.04 h / R3. Fast 14.3 min / 87.5 min / 8.46 h / R5. Menu masher 13.2 min / R2. HARD CHECK PASS.
  Side-by-side with v3 in `claude/progression-FINAL.md`.
- **Trade-off:** the old 21:27 targets after R1 (R3 ≈ 2 h, R5 ≈ 6 h, R6–R7 by 10 h) no longer hold. The median is now
  ~1.6× slower to R3 and ends one rebirth lower at 10 h.
- **Tests:** v3.test.js, numbers-audit.spec, season2.spec (comment + need(17) ≈ 936 XP), sim expectations all moved
  to v3.1. The sim also now fails if the median's R1 leaves 18–25 min. Local: 642/642 progress + leaderboard units, sim
  PASS. CI is the full gate. **Not merged.**

---

## PROGRESSION v4 "SIMPLE" (Andy Oct 7 23:20), on `feat/s2-progression-v4` (off main 0b359a6, which has #255)

- **Model (season 2 only, SEASON2 still OFF):** XP comes from menu keys only, at the full 1 × 2^T × 3^R (× gear,
  × OVERDRIVE). That is a new `xpPerInput` swap in `v3/hooks.js`: no ×0.2 share, no rounding, no floor. Game letters
  credit 0 XP: `letterXp.creditLetterXp` returns null in season 2 (the "keeps the fraction" branch is gone), the flush
  credits nothing, and the accepted-word top-up stays off. OVERDRIVE's play clock still ticks from game typing. Games
  pay wins exactly as before.
- **Rate line:** in season 2 it is `+{n} XP / KEY`, one number, desktop and phone (Homepage `perLetter` /
  `perLetterCompact`). Season 1 keeps MENU / GAMES.
- **Gate 18 + 20R → 15 + 18R** (client econ.js, rebirthRules GATE2, finalRules F_GATE, **migration 029 edited**).
  Menu-only XP put the median's R1 at 31.8 min; at 15 + 18R it is 21.5 min. POWER cost is unchanged.
- **Sim:** median 21.5 min · 2.29 h · 8.91 h · R5 at 10 h. Casual 60 min / 5.81 h / R3. Fast 9.3 / 62.8 min / 3.75 h / R6.
  Masher 8.2 min / 3.45 h / R3. Table next to v3.1 in `claude/progression-FINAL.md`. New HARD CHECK: the game share never
  moves the bar. Pace limit ×2 → ×2.5 (fast types 2.5× the median's keys under the new bot spec).
- **Tests:** new `src/progress/v3/gameNoXp.test.js` (every mode's typed letters, flush and accepted word leave the bar
  where it was, and the same words still bank wins). numbersAudit.s2 (the menu key credits TOTAL, a game letter null,
  T1 = 2 / T2 = 4 / T3 = 8). Gate numbers in finalRules / rebirthRules / season2Board / v3.test. e2e: menu.spec gets a new
  season-2 `+1 XP / KEY` test at 1280 and 390, season2.spec (seed LV14 → mash to 15, `+1` then `+6 XP / KEY`),
  numbers-audit (`+108 XP / KEY`, GATE LV 69), v2-rebirth (`LV 10 / 15`, next gate LV 33). statChain unchanged (still
  green). Local: 644/644 progress + leaderboard units, sim PASS, vite build 0. e2e runs on CI. **Not merged.**
- **Left as is:** the UPGRADES (ShopV2) and STATS screens still label the rate "XP / LETTER". Not in scope; it is a
  one-word copy change if wanted.
