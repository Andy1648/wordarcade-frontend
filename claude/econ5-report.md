# Economy v5 (feat/econ5) — storage refactor + round-number pass

Branch `feat/econ5` off `feat/econ4`. Build exit 0. Tests 253/253 pass (245 → 253, +8 new).

## JOB 2.6 — storage refactor: {level, xpIntoLevel}, not cumulative XP
`taw.xp` now stores the compact shape `{"lv": n, "into": m}` — the level (an exact integer)
plus XP into that level (always `< need(lv)`). The stored number therefore never exceeds one
level's cost, so the float64 `MAX_SAFE_INTEGER` cliff that cumulative XP hit above ~LV600 is
gone: the **level is always exact regardless of magnitude**.

- `creditXp(state, gain, rawKeys)` now takes/returns `{level, intoLevel, lifetimeLetters}` and
  carries whole levels forward via `need()` incrementally (no cumulative sum).
- `loadProgress()` → `{level, intoLevel, lifetimeLetters}`; `saveProgress()` writes the compact
  shape. New `progressOf(state)` returns the bar's `{level, intoLevel, cost, toNext, frac}` —
  the direct-from-shape analogue of `levelFromXp(cumulative)` (kept for migration + tests).
- **Migration:** a legacy cumulative `taw.xp` (a bare number from v4 and earlier) is derived to
  `{lv, into}` once on first read (carried progress floored to a round 10) and rewritten.
- Consumers updated: menu/splash bar (`useXpCapture`), `StatsScreen`, `ShopScreen`,
  `SplashScreen`. `doRebirth` resets to `{level:1, intoLevel:0}`.
- Stats "TOTAL XP" (the number that hit the cliff) is replaced by **XP INTO LEVEL** +
  **XP TO NEXT LEVEL**.

## JOB 2.7 — top curve (kills the runaway) + re-simulation
The piecewise curve is exactly as specified (already present from v4.1, confirmed unchanged):
- `n ≤ 200`: `need(n) = round(100·1.05^n / 10)·10`
- `n > 200`: `need(n) = round(need(200)·1.11^(n-200) / 10)·10`

Simulation — keypower 50, maxed loadout (prism pop ×1.25 + silent sound ×1.15), menu-mode base
grind. `keyPowerBaseXp(50) = 3,520`; per-key XP = `round(3520 · rebirthMult · 1.25 · 1.15 / 10)·10`.
**Letters required from LV1 to the next rebirth gate:**

| tier | rebirthMult | next gate | XP / keystroke | letters LV1 → gate |
|---|---|---|---|---|
| **R10** | ×10 | LV 225 | 50,600 | **4,594** |
| **R15** | ×1e6 | LV 420 | 5.06e9 | **29,065,141** |
| **R19** | ×1e10 | LV 600 | 5.06e13 | **418,319,980,397** |

**Acceptance — "never under 200 letters at any tier": PASS.** The smallest tier (R10) is 4,594
letters, ~23× the floor; higher tiers explode into the millions/billions because the level gates
(→600) outrun the per-key rebirth multiplier. Precision is no longer a criterion — the storage
refactor makes `level` exact, so the old cumulative-XP float cliff can't be reached.

## JOB 2.8 — everything ends in a zero
Snapped to the nearest 10 (no displayed number ends in a single non-zero digit):
- `keyPowerCost` — `round(50·1.15^lv / 10)·10` (lv0=50, lv5=100, lv20=820).
- `keyPowerBaseXp` — `round((10+2lv)·2^⌊lv/10⌋ / 10)·10` (only lv9 shifts, 28→30).
- `xpPerInput` — final result `round(… / 10)·10`, so every credited "+N" and the accumulated
  `intoLevel` stay clean multiples of 10.
- Shop cosmetic prices were already all ÷10 (0/150/400/900/2000, 0/250/600/1200) — unchanged.
- **Wins are now paid PER WORD:** rate = `round(10 · modeMult · difficulty / 10)·10` →
  word-bomb/blitz **10**, SAT **20**, CHAIN **30**, FUSE **50** at ×1; a round pays
  `wordsAccepted × per-word`. Both factors keep every payout ÷10.
- **Test:** `wins.test.js` asserts every catalog price (cosmetics + `keyPowerCost` 0–80) and
  every payout (`awardWins` over all modes × difficulties × 0–40 words, plus `perWordWins`) is
  divisible by 10.

### Note on the card copy (cross-branch)
Job 2 changes the wins ECONOMY to per-word; the menu card's per-WORD *copy* ("N WINS / WORD")
is Job 1's item on `fix/ui-pass`. On `feat/econ5` the card still renders `roundWinsEstimate`
("~N WINS / ROUND"), which now reads 100/300/500 (10 words × per-word) — consistent and ÷10.
When both branches merge, `GameCard` should use `wordWinsEstimate` (added here too) so the copy
matches the per-word economy; flagged for the merge.
