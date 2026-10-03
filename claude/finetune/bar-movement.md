# Bar movement per word at LV150–250 — and a PROPOSAL (not applied)

Andy oct3 13:01 #5 (LV175: "bar just isn't moving"). Target: **≥ 0.5% of the level per average word at
LV150–250.** No sim was run (rule); everything below is arithmetic on `src/progress/xp.js` (`needAt`,
`keyTierXp`, `rebirthMult`, `powerOf`) and the numbers already in `claude/econ-oct2/v10-spec.md` /
`v10-existing-players.md`. Scripts: one-off `node` against the real xp.js module.

## The one formula that decides it

A word's XP is `keyTierXp(T) × letters × mode × rebirthMult(R) × S·B` (S·B = streak × mark × mastery ×
STAR POWER × forge × frenzy × boost × rarity/combo weight — everything that is **not** KEY tier or
rebirth). v10's need is `needAt(L, 1) × P^0.95` with `P = keyTierXp(T)/10 × rebirthMult(R)`. Divide:

    bar % per word = 10 × letters × mode × S·B × P^0.05 / needAt(L, 1)

KEY tiers and rebirths cancel down to `P^0.05` (×1.4–×2.6 for any real save). **The bar's speed at a
level is set almost entirely by the non-KEY stack S·B.** For an average word (6 letters, the sim's mode
mix FUSE 35% ×2 / CHAIN 35% ×4 / WB 30% ×2 = ×2.7):

| level | needAt(L, 1) | % per word at S·B·P^0.05 = 1 | S·B·P^0.05 needed for 0.5% |
|---|---|---|---|
| 150 | 12,208,280 | 0.0013% | 377 |
| 175 | 24,349,070 | 0.00067% | 752 |
| 200 | 48,563,530 | 0.00033% | 1,499 |
| 225 | 96,858,590 | 0.00017% | 2,989 |
| 250 | 151,297,790 | 0.00011% | 4,670 |

## The MEDIAN player (v10-spec 3-skill run: LV150 at 21 h, LV225 at 49 h, LV300 at 96 h; 10 words/min)

Two readings of the same sim numbers, because the published "minutes per level" are first-reach
DELTAS, and the sim bots REBIRTH at every gate (150 → R8, 175 → R9, 200 → R10, 225 → R11, 260 → R12) —
so a delta includes re-climbing LV1→gate several times, not just the levels in between.

| level | A: published pace (min/level → %/word) | B: re-climb-corrected frontier pace | median per-word XP (B, P=1 units) | implied S·B·P^0.05 |
|---|---|---|---|---|
| 150 | 22 min → **0.45%** | 7.6 min → **1.32%** | 160,759 | ~990 |
| 175 | 22 min → **0.45%** | 8.9 min → **1.13%** | 273,916 | ~1,690 |
| 200 | 22 min → **0.45%** | 11.5 min → **0.87%** | 420,493 | ~2,600 |
| 225 | 38 min → **0.26%** | 16.7 min → **0.60%** | 581,565 | ~3,590 |
| 250 | 38 min → **0.26%** | 18.8 min → **0.53%** | 804,335 | ~4,970 |

- A = `v10-existing-players.md` stretch averages (LV150→225 ~22 min, LV225→300 ~38 min) × 10 words/min.
- B = the sim's XP income per window solved from the first-reach times with each window's re-climbs
  counted (`Σ needAt(1..gate−1, 1)` per climb), geometric-interpolated between window mid-points. It is the
  better estimate of the bar for a median player sitting AT a level, but it inherits the sim's huge S·B
  (forge auto-buys, STAR POWER, marks, mastery, FUSE FRENZY after 20–50 h of bot play).
- "P=1 units" = the word's XP ÷ P^0.95 (the KEY/rebirth part cancels against need).

**Verdict for the sim median:** passes Andy's 0.5% under reading B (barely at LV250: 0.53%), fails under
reading A (0.45% / 0.26%).

## The REAL top-8 — this is the problem Andy is feeling

The board's wins/word is `keyTierXp × rebirthMult × S·B'` (5-letter Word Bomb word, no forge/weight).
Reading each row as the highest KEY tier its rate allows (S·B' ≥ 1 — KEY is what everyone buys first,
×2.5 per tier) gives the stack each player actually has: **×1.0–×2.0, not the sim's ×1,000–×5,000.**

| player | LV | R | KEY tier (est.) | S·B' | XP / avg word | need(LV) | **% per word (before)** | words / level | hours / level @10 w/min |
|---|---|---|---|---|---|---|---|---|---|
| snapplemelon | 195 | 4 | T7 | 1.90 | 9.04e5 | 8.34e10 | **0.0011%** | 92,252 | 154 h |
| Xavi | 168 | 8 | T17 | 1.98 | 1.62e10 | 4.17e14 | **0.0039%** | 25,736 | 43 h |
| elol | 156 | 7 | T13 | 1.00 | 1.86e8 | 8.23e12 | **0.0023%** | 44,174 | 74 h |
| NoBuffCookies | 147 | 6 | T11 | 1.31 | 3.40e7 | 9.91e11 | **0.0034%** | 29,143 | 49 h |
| Daan | 144 | 9 | T5 | 1.79 | 2.73e5 | 6.91e9 | **0.0039%** | 25,325 | 42 h |
| Tangie | 126 | 10 | T7 | 1.32 | 1.38e6 | 2.62e10 | **0.0053%** | 18,974 | 32 h |
| maSON_im_cRYAN | 119 | 8 | T6 | 1.20 | 4.13e5 | 7.48e9 | **0.0055%** | 18,132 | 30 h |
| creator | 118 | 6 | T4 | 1.43 | 6.08e4 | 1.00e9 | **0.0061%** | 16,483 | 27 h |

(The split is the one unknown: the board gives KEY × rebirth × stack as ONE number. The opposite
extreme — the whole rate from the non-KEY stack at T0 — would raise % per word by P^0.95 (×200 for
creator up to ×2e7 for Xavi), but it contradicts how the shop is played: KEY is ×2.5 per tier and is
bought first, so the KEY reading is the realistic one. Forge and rarity weight, which the board rate
excludes, add ×1.3–×3 for a typical save. The 8 real cloud saves (ANDY TODO SQL in
v10-existing-players.md) would replace the estimate with exact tiers.)

**`v10-existing-players.md` says these players' next level takes 13–22 min. Under the shipped curve it
takes 27–154 HOURS for a thin-stack save** — that table assumed "a save's pace ≈ a fresh median
player's pace at that level", which is only true for a save with the sim median's S·B. The 0.5% target
is missed by 100–450×. A one-decimal % readout cannot show this bar moving (0.0011% per word = a tenth
of a percent every ~90 words); the "+0.1%" floor in the new pop is the only thing that moves.

## PROPOSAL — not applied

### Option F (recommended): a GAME-WORD BAR FLOOR, level-scaled
Every accepted **game** word credits the level at least `floorFrac(L) × need(L)` XP:

    floorFrac(L) = 0.5%                         for L ≤ 250
                 = 0.5% × 1.028^−(L − 250)      above (tracks the curve's own growth, so the floor
                                                 never becomes the fast lane past the target band)

- Bar only. Wins are untouched (still XP_real ÷ 10), so nothing in the shop/KEY/forge economy moves.
- Menu typing is excluded (30 keys/s × 0.5% would be a farm). Only `awardWordXp` with `mode !== 'menu'`,
  i.e. words a game accepted — already rate-limited by play, the 3-word gate, and SAT spam rules.
- Applied to the CURRENT level only (no floor on a multi-level carry), in `wins.js awardWordXp` →
  `creditXp(state, max(gain, floorXp))`; the receipt gets a "LEVEL FLOOR" row when it fires, so the bar
  never moves more than the receipt says (payout honesty).
- Caps the slowest possible level at **200 words ≈ 20 min** at 10 words/min — the pace the v10 spec
  itself promised existing players (13–22 min). Players with a real stack are above the floor and keep
  their speed advantage; S·B still matters (a ×5,000 stack is ~10× faster than the floor at LV150).
- Sim impact (to re-run, not run here): the sim median is at/above the floor through ~LV250 under reading
  B, so the LV100/LV225 calibration should hold; under reading A it speeds the median ≤ 10% at 150–225.
  Re-run `loop-sim.mjs --skills=casual,median,strong` with the floor before merging.

| player | LV | % per word before | after (floor) | words / level after | time / level after |
|---|---|---|---|---|---|
| snapplemelon | 195 | 0.0011% | 0.50% | 200 | ~20 min |
| Xavi | 168 | 0.0039% | 0.50% | 200 | ~20 min |
| elol | 156 | 0.0023% | 0.50% | 200 | ~20 min |
| NoBuffCookies | 147 | 0.0034% | 0.50% | 200 | ~20 min |
| Daan | 144 | 0.0039% | 0.50% | 200 | ~20 min |
| Tangie | 126 | 0.0053% | 0.50% | 200 | ~20 min |
| maSON_im_cRYAN | 119 | 0.0055% | 0.50% | 200 | ~20 min |
| creator | 118 | 0.0061% | 0.50% | 200 | ~20 min |

Nobody loses anything; board order is unchanged (levels are kept, everyone gains the same floor); the
grandfathered rebirth gates (`min(table, LV+25)`) become ~8 h of play instead of ~30–150 days.

### Option P (structural, needs a re-calibration sim): fold the non-KEY stack into P
`P' = P × S·B` so need scales with the WHOLE stack and per-word % depends only on the level. Fixes the
root (pace stops depending on which multipliers a save happens to own) but forge/marks/stars would stop
speeding levels, and the curve must be re-divided by the median's S·B(L) (≈1,000–5,000 at LV150–250)
and re-simmed. Bigger change; not recommended for a hotfix.

### Option H (one-time level rescale) — rejected
A rescale cannot fix per-word movement for a thin-stack save without dropping it to a level where
`needAt(L,1)` is ~450× smaller (~LV45 for snapplemelon) — the −70–90% "hours-equivalent" cut the v10
spec already rejected as unfair.

## Shipped on feat/numbers-feel (the visible half, no economy change)
- Menu bar: % of level to ONE decimal (`formatPct`, floored — never "100.0%" early); a pooled "+X.X%"
  pop per credit, retargeted across a burst, never below "+0.1%" for a real gain (`formatGainPct`); a
  10% milestone flash + soft rising note (`sndBarMilestone`); the phone stats row shows the % too.
- Returning to the menu counts the whole game's gain up from where the bar was (session memory).

## IMPLEMENTATION (branch feat/bar-floor) — Option F, NOT merged (awaiting Andy)

- **`src/progress/barFloor.js`** (new) — the one constant block: `BAR_FLOOR_ON = true`,
  `BAR_FLOOR_FRAC = 0.005`, `BAR_FLOOR_TAPER_FROM = 250`, `BAR_FLOOR_TAPER = 1.028`.
  `floorFrac(L)` = 0.005 for L ≤ 250, `0.005 × 1.028^−(L−250)` above (LV300 ≈ 0.126%, LV1000 ≈ 5e-12).
  `barFloorXp(L, P) = floorFrac(L) × needAt(L, P)`; `applyBarFloor({gain, level, power})` →
  `{credited = max(gain, floorXp), floored, pct, rawPct}`. Set `BAR_FLOOR_ON = false` to turn it off.
- **`src/progress/wins.js awardWordXp`** — the single place every game word credits XP (WB + Blitz via
  App.jsx, SAT, CHAIN, FUSE, WORD RACE). For any mode whose `gameKey` is not `'menu'` it credits
  `creditXp(state, max(gain, floorXp), P)` at the same P the level's need uses, so a crossing carries
  through the normal `{lv, f, rc, v:10}` fraction storage. Returns `gain` (the word's real XP, unchanged:
  wins are still `gain ÷ 10`), plus `credited` (what the bar got) and `floor` (null unless it fired).
  Menu typing never reaches the floor (`mode: 'menu'` / no mode is excluded; useXpCapture uses creditXp
  directly). App.jsx is untouched.
- **Receipt** — awardWordXp leaves a one-shot stamp (`setBarFloorStamp`); `payout.js buildPayout`
  consumes it as `payout.levelFloor = { label: 'LEVEL FLOOR', pct, rawPct, xp }` (always consumed, so it
  cannot leak onto a later word). It is NOT a factor: `product`, `paid`, `xp` and the round ledger are
  unchanged. `PayoutBreakdown.jsx <WordPayout>` prints it as its own line under the product
  ("LEVEL FLOOR  +0.5% LEVEL"), the same number the bar moved. Only Word Bomb has a per-word receipt
  today; the solo modes have none, so there is nothing else to label (their bar pop already reads the
  real frac delta).
- **Tests** — `src/progress/barFloor.test.js` (11): floorFrac at LV1/150/250/300/1000 (+251, off-switch);
  barFloorXp = floorFrac × needAt; LV175 R4 T7 ×1-stack save moves ≥ 0.5% per word (5 words); every game
  mode floored; a crossing at f=0.998 carries 0.003·need(175)/need(176) into LV176 in the v10 shape;
  a strong/early save above the floor is unchanged (credited = gain); menu typing not floored; wins
  balance/lifetime untouched and `perWordWins = gain ÷ 10`; receipt row = the bar's frac delta,
  headline unchanged, stamp one-shot. Full unit suite 920/920 green; `vite build` clean.
- **Sim** — `claude/econ-oct2/loop-sim.mjs` already credits every word through `WINS.awardWordXp`, so
  the CI econ-sims job measures F with no sim-side logic; it now also reports
  `barFloor: { words, share }` per skill (how many words the floor raised). Not run here (rule): run
  `loop-sim.mjs --skills=casual,median,strong` / the econ-sims workflow on this branch before merging.
