# PROGRESSION v11 — spec (Andy oct3 17:45) — overrides v10's power scaling

Branch `feat/pv11`. Estimate: `claude/econ-oct2/v11-estimate.mjs` (arithmetic, NOT the economy sim —
outputs `v11-estimate.txt`, `v11-estimate-stretch3.txt`). The real measurement is `loop-sim.mjs` on CI
(it imports `src/progress`, so it measures this code with no patch).

## Andy's three rules
1. **XP needed per level never scales with the player.** v10's `need(n) = curve(n) × P^0.95` (P = KEY tier
   XP × rebirth) made R8 LV16 cost 233M and LV1 start huge after a rebirth. v11: `need(n)` depends on `n`
   only — one exponential curve, every level a bit harder than the last.
2. **The four knobs make sense together.** WINS per word keep their big exponential (KEY ×2.5 a tier,
   rebirth ×(1+R), every bonus — `xpPerWord ÷ 10`, unchanged). LEVEL XP is a SEPARATE, modest number:
   KEY = a clear % per tier, rebirth = a clear % per rebirth + the level reset.
3. **Existing players** keep `{lv, f}`; nobody loses a level; the board stays level-only. Option F only if
   the numbers still need a per-word floor.

## "A week ago" (the LV100 target)
No single clean number — three measurements of the pre-v10 game:
| source | game state | new median-ish player, first LV100 |
|---|---|---|
| `claude/progression/before-report.md` (econ-sim, regular 30 min/day) | v8, ~Sep 26 | **11.5 min** (9–15 min across archetypes) |
| `claude/econ-oct2/before-v9-console.txt` / `progression/after-report.md` | v9, Oct 1 | **35.7 min** (27–37 min) |
| `v10-spec.md` "main" row (loop-sim median, the same bots CI runs) | v9 + KEY v8, Oct 2 | **18 min** |
**ASSUMPTION:** "similar to a week ago" = median first LV100 in **~20–60 min** of play (the v8–v9 range),
casual within a couple of hours. v10 had it at 10.1 h — that is what Andy is reversing.

## The level-XP formula (same in all three versions; only the KEY / rebirth shape and the curve differ)
    level XP / word = 10 × letters × mode × difficulty × weight × streak × KEY(T) × REBIRTH(R)
- mode: WB ×2, Blitz ×2, CHAIN ×4, FUSE ×2, RACE ×3, SAT ×10 (XP_MULTIPLIERS, unchanged)
- weight: the word's rarity × combo × lucky, capped ×40 (cappedWordMult — the same weight wins use)
- streak: the daily streak ×1–×1.25 (its copy already says "wins and XP")
- **NOT in level XP** (they pay WINS only): marks (legacy MAIN + perk), mastery, STAR POWER, mark rolls,
  LETTER FORGE, FUSE FRENZY, BOOST. These are the unbounded wins engines — v10's bar depended on which
  of them a save owned (sim bots ×1,000–×5,000, real top-8 ×1–×2: `claude/finetune/bar-movement.md`).
  With them out, a real player and a sim bot of the same skill move the bar at the same speed.
- Menu typing: 10 × KEY(T) × REBIRTH(R) × pop × sound × streak per key (whole XP), same ratio as before.

Estimate model (v11-estimate.mjs): loop-sim's skills (casual 6 w/min len 5, median 10/6, strong 16/7), mean
word weight casual 1.8 / median 2.3 / strong 3.2 (assumed), loop-sim's mode unlocks (CHAIN LV50, FUSE LV100
by current level), rebirth at every table gate (greedy, as the sim bot; HEAD START ignored → real climbs a bit
faster), streak by play-day, and the KEY tier timeline loop-sim measured (`loop-sim-final.json`), extended +1
tier per doubling of time past 20 h. Sensitivity: `--stretch=3` and `--stretch=10` replay KEY 3× / 10× slower.

## Three versions (200 h per bot; "min %/word" = the smallest share of a level one word moved the bar, LV1–400)

| | **V1 — ADDITIVE (PICK)** | V2 — COMPOUNDING | V3 — ONE SEGMENT |
|---|---|---|---|
| curve | 600·1.06^(n−1) to LV100, then ×1.015 a level | 600·1.07^(n−1) to LV100, then ×1.02 | 600·1.03^(n−1) |
| need(100) / need(225) / need(400) | 192k / 1.24M / 16.7M | 487k / 5.8M / 185M | 11.2k / 450k / 79.5M |
| KEY (shop card) | **+25% XP a tier**, additive: ×(1 + 0.25T) | ×1.25 a tier, compounding | as V1 |
| rebirth | **+100% XP a rebirth**: ×(1 + R) (= the wins multiplier) | ×1.2 a rebirth, compounding | as V1 |
| casual LV100 / LV225 | 2.0 h / 35 h | 2.2 h / 32 h | 29 m / 6.8 h |
| **median LV100 / LV225** | **48 m / 14.1 h** | 50 m / 10.9 h | 13 m / 2.7 h |
| strong LV100 / LV225 | 21 m / 5.2 h | 22 m / 3.1 h | 7 m / 1.0 h |
| median LV300 / LV400 | 31.7 h / 115 h | 22.9 h / 69 h | 13 h / 171 h |
| median min %/word LV≤400 | **0.31%** (casual 0.27%) | 0.44% (casual 0.24%) | **0.067%** (dead from ~LV350) |
| median LV1→15: first climb → after R1 → R3 → R10 | 3 m → 54 s → 18 s → 6 s | 3 m → 1 m → 12 s → 6 s | 2 m → 48 s → 18 s → 6 s |
| Option F needed? | no (never fires) | no | yes, and it tapers out above LV250 anyway |
| verdict | **PICK** | late game hangs on the KEY tier count: each extra tier = +11 levels at ×1.02, and a big balance buys dozens (T60 = ×650k) — runaway risk, and the shop's "+25%" compounds with KEY's own ×2.5 wins step | LV100 3–4× too fast (13 min) AND a dead bar late — one growth rate cannot do both |

V1 sensitivity — KEY tiers 3× slower: median LV100 52 m, LV225 15 h, min 0.30%; 10× slower: LV100 1.3 h,
LV225 16.5 h, LV400 134 h, min 0.26%. The pick is robust to the one input the estimate cannot know.

### Why V1
- **Readable on the shop card:** "KEY T5 → T6: +25% XP" and "REBIRTH: +100% XP & WINS (×4 → ×5)". XP per
  letter is 10 + 2.5·T (T1 12.5, T8 30, T20 60) — numbers a player can hold in their head.
- **No runaway by construction:** XP grows linearly in tiers and rebirths, the curve exponentially in levels.
  A 1e15 balance at T100 is ×26 level XP — about +80 levels of shift at ×1.015, never a burst.
- **Fast early, room later:** LV1 = 600 (two Word Bomb words), LV50 ≈ 10 min, LV100 ≈ 48 min; ×1.015 above
  LV100 keeps a word ≥ 0.3% of a level through LV400 while LV300 takes ~1 month at an hour a day.
- **Rebirth = a reward:** the re-climb from LV1 runs on +100% XP against the SAME small LV1–15 costs:
  3 min → 54 s → 18 s (first climb → after R1 → after R3). The reset still costs: the gates keep rising.

## Option F — REMOVED from the live path
Dead bar (< ~0.2% per word, median, LV1–400): V1's minimum is 0.31% (casual 0.27%), so the floor never fires
— identical numbers with and without it (v11-estimate.txt). `BAR_FLOOR_ON = false`; the module, receipt row
and stamp stay as a one-constant fallback if the CI sim shows a dead bar.
Real top-8 rows (bar-movement.md tier estimates, a plain 5-letter Word Bomb EASY word, weight 1 — the worst
case; a real run has combo/rarity ×2–3 and CHAIN ×4): snapplemelon LV195 R4 T7 **0.22%** (46 min/level),
creator LV118 R6 T4 0.70%, Daan LV144 R9 T5 0.76%, Xavi LV168 R8 T17 1.12% (9 min/level). v10 had them at
0.001–0.006% per word without the floor.

## Implementation (the pick)
- `src/progress/xp.js`: `needAt(n)` = the V1 curve, no power term (any 2nd argument ignored; finite, capped at
  `Number.MAX_VALUE` ≈ LV47,000); `need(n) = needAt(n)`. `needV9` frozen for legacy conversion. Removed:
  `powerOf`, `currentPower`, `PV10_*`. Added: `CURVE_V11_*`, `LEVEL_XP_PER_LETTER` 10, `KEY_XP_STEP` 0.25,
  `REBIRTH_XP_STEP` 1, `keyXpMult`, `rebirthXpMult`, `levelXpPerLetter`, `levelXpPerWord`. `xpPerInput` (menu)
  now uses level XP (whole XP — T1 is +13 a key, not round10's 10). `xpPerWord` (the WINS product) unchanged.
  `creditXp` / `progressOf` ignore their v10 power argument.
- `src/progress/wins.js`: `awardWordXp` credits `levelXp` to the bar (returns `gain` = the wins product as
  before, plus `levelXp`, `credited`); stamps the credit for the receipt. `perWordRateNow` adds `levelXp`.
  Wins: `bankWordWins` / `perWordWins` / KEY ×2.5 / rebirth ×(1+R) — untouched.
- `src/progress/barFloor.js`: `BAR_FLOOR_ON = false`; `setLevelXpStamp` / `takeLevelXpStamp`.
- `src/progress/payout.js`: the receipt's "+N XP" headline is the level XP the bar was credited (stamp or
  `levelXp` arg); the math line still multiplies out to the WINS.
- `src/progress/econMigrate.js`: `ECON_VERSION` 11, `migrateEconomyV11` (alias `migrateEconomyV10`). A v10
  save (`{lv, f, rc, v:10}`) is untouched byte for byte — the fraction keeps the bar position under the new
  need; only the stamp moves 10 → 11. A pre-v10 save converts exactly as v10 did (gate + notice). Storage
  shape, shadow key and stale-tab logic unchanged (a stale v10 tab writes the same shape on a SLOWER curve).
  Server wire version `ECON_RPC_VERSION` stays 10 (016's `p_econ = 10` checks keep working).
- Copy: shop KEY card "WORD BOMB · KEY T5 → T6: +25% XP" (×2.25 → ×2.5 in the tooltip); rebirth "GAIN: +100%
  XP & WINS — ×4 → ×5"; Stats "KEY POWER TIER 5 · +125% XP", BASE XP / LETTER = 10 × KEY; marks "+25% wins in
  …" (was "wins & XP"); mastery "+N% WINS THIS MODE"; the one-time notice "ONE LEVEL CURVE FOR EVERYONE — YOU
  KEPT EVERY LEVEL". Homepage letters-to-next uses the level-XP rate. WORD RACE "+N XP" = level XP.
- `src/main.jsx` calls `migrateEconomyV11`. `src/App.jsx` untouched.
- `claude/econ-oct2/loop-sim.mjs`: new `v11` block per skill — bar %/word by level band (min / p10 / p50,
  DEAD BAR = p10 < 0.2% anywhere ≤ LV400) and the re-climb clock (minutes to gain 10 levels per climb vs the
  first). Printed as `v11 …` lines; the workflow summary greps them.

## Tests (node --test; 926/926 pass)
- `src/progress/pv11.test.js` (rewritten from pv10.test.js — 22): the published curve; need independent of
  KEY tier and rebirths (T0…T1000, R0…R25; R8 LV16 = 1,440); monotone to LV20,000 and saturating, finite at
  LV1e6 / Infinity / NaN; creditXp terminates; boundary carry; KEY +25% a tier (T5 → T6 = +25 points of
  base, T100 = ×26) with wins still ×2.5 a tier; rebirth +100% (= rebirthMult); awardWordXp credits level XP
  and keeps the wins product; a re-climb after a rebirth takes fewer words than the first climb; a v10 save
  keeps level + fraction (4 saves incl. LV195 99%, LV16 R8); legacy conversion; KEY buy moves nothing (same
  cost); KEY/rebirth drop no burst; stale legacy writes; stale v10 tab; stale rebirth; shape detection;
  doRebirth shape; grandfathered gate (incl. surviving the 10 → 11 bump).
- `barFloor.test.js` (rewritten): OFF; fallback math pinned with on = true; the v10-starved LV175 R4 T7 save
  moves ≥ 0.2% a word with no floor; no mode floors; the receipt XP headline = level XP; one-shot stamps.
- `econMigrate.test.js` (+2): v10 save untouched + stamped 11 once; stale write after stamp 10.
- `xp.test.js`: v11 curve literals; menu XP stack (T2 SAT R1 = 300; T1 = +13); cosmetics/streak stack;
  legacy cumulative conversion keeps the fraction. `race.test.js`: race XP = card level XP.
- `e2e/payout-honesty.spec.js` (not run here): XP delta == receipt XP == the card base × difficulty × COMBO
  / LUCKY (no FORGE); receipt WINS × 10 == card quote × every per-word row; wins tenths from the wins number.

## What CI should show (econ-sims.yml on the PR)
- long-run (200 h): median first LV100 ≈ 0.5–1.5 h (estimate 48 min), LV225 ≈ 10–20 h, LV300 ≈ 25–45 h;
  casual LV100 ≈ 2–3 h; strong LV100 ≈ 20–45 min. `v11 bar … dead bar: PASS` for all three skills (p10
  ≥ 0.2% in every band to LV400). `v11 re-climb`: every climb after R1 faster than the first (×< 1), and
  faster with each rebirth. `bar floor 0 words` everywhere. Runaway FAIL lumps unchanged in kind (wins side
  untouched); `extremes.need` ≤ ~1e8 inside 200 h.
- rule P (main = v10 → v11): gap / KEY-eta windows will move — v11 levels are much faster than v10's (LV100
  10 h → < 1 h), so "levels gained" and gaps in the early windows should improve; KEY eta should be near
  main (wins untouched; rebirths come at a different pace, which moves the ×(1+R) wins multiplier).
  Any WORSE window is a decision for Andy, not a build failure.
- If dead bar FAILs: switch `BAR_FLOOR_ON` back on (one constant) or lower `CURVE_V11_G2` (1.015 → 1.012).
  If LV100 lands > 2 h median: lower `CURVE_V11_G1` (1.06 → 1.055, est. 36 min).

## Risks / not done
- MENU typing is not in any sim and keeps v10's ratio (one key = one letter at mode ×1, cosmetics up to
  ×6.9, rate-capped 30/s): a gibberish masher out-levels a player per minute, as before v11.
- The server's 015 level clamp (0.5 level/s, 600-level bank, rebirths +1 per submit) can lag a strong
  player's very fast re-climbs (LV1→15 in seconds after R6+); it clamps, never rejects, and catches up.
- The KEY tier timeline is the one input the estimate borrows (pre-v10 main); sensitivity runs above.
- e2e and the economy sims were not run on this machine (rule); unit tests + build only.
