# Economy v6 — the exponential rebuild

Branch: `feat/econ6` (off main, **NOT merged**). Suite green: 256 unit + 11 economy e2e.

## What changed

### 1. KEY POWER → discrete tiers (`xp.js`)
Deleted the `+2`-per-purchase linear model and the `×2`-every-10 doubler. Replaced with a
hardcoded `KEY_TIERS` table stored at `taw.keytier` (int, default 0):

| Tier | XP/letter | Cost to reach |
|------|-----------|---------------|
| T0 | 10 | free |
| T1 | 25 | 500 |
| T2 | 60 | 3,000 |
| T3 | 150 | 18,000 |
| T4 | 375 | 108,000 |
| T5 | 940 | 648,000 |
| T6 | 2,350 | 3,888,000 |
| T7 | 5,875 | 23,328,000 |
| T8 | 14,690 | 139,968,000 |

Past T8: effect ×2.5, cost ×6, each `round10`. Shop card shows current XP/letter, next tier's
XP/letter, next tier's cost, and your current per-word win rate. **No BUY MAX** — one tier at a
time. Key tier survives rebirth (own key).

### 2. Level curve → properly exponential (`xp.js need()`)
- `n ≤ 60`: `round10(100 · 1.25^n)` → first levels **120 / 160 / 200 / 240 / 310 / 380 / 480**.
- `n > 60`: `need(60) · 1.08^(n-60)` → gentle tail keeps LV600 reachable.

Rounding note: a single shared `round10()` uses **half-to-even**, deliberately, because that is
what reproduces the published first-level table exactly (`round10(125)=120`; plain
`Math.round(12.5)=13` would give 130). Documented in `xp.js`.

### 3. Wins → exponential (`wins.js`)
- Base **20** wins/word (was 10).
- Mode mults: Word Bomb 1, Blitz 1, SAT Rush ×5, CHAIN ×10, FUSE ×15.
- **Rebirth now multiplies wins** on the same ladder as XP (×1.5, ×2, ×2.5 …), read live from
  `taw.rebirths` (or a passed `rebirthCount` for pure tests).
- Difficulty mult unchanged, stacks on top. Everything `round10`.

### 4. Copy
Game cards read the R0 base rate: **20 / 100 / 200 / 300 WINS / WORD** (WB·Blitz / SAT / CHAIN /
FUSE) via `wordWinsEstimate` (base, not rebirth-scaled, so the card copy stays stable). The shop
shows the player's live per-word rate.

### 5. Divisibility test
`wins.test.js` asserts every catalog price, every Key Power tier cost, and every wins payout
(across modes × difficulties × rebirths × word counts) is divisible by 10; `xp.test.js` asserts
every level requirement is divisible by 10 through the exact-integer range.

## Simulation (`claude/econ6-sim.mjs`, imports the real model)

**Letters to first rebirth (LV15):** cumulative XP to reach LV15 = **10,880**; at the starting
menu rate (T0 = 10 XP/letter, R0) that is **1,088 letters**. Buying Key Power tiers along the way
lowers it — 1,088 is the floor at base rate.

**FUSE runs to afford each Key Power tier** (1 run = 10 accepted words; FUSE = 20 × 15 × rebirth):

| Tier | R0 (3,000/run) | R5 (10,500/run) | R10 (30,000/run) |
|------|----------------|-----------------|------------------|
| T1 | 1 | 1 | 1 |
| T2 | 1 | 1 | 1 |
| T3 | 6 | 2 | 1 |
| T4 | 36 | 11 | 4 |
| T5 | 216 | 62 | 22 |
| T6 | 1,296 | 371 | 130 |
| T7 | 7,776 | 2,222 | 778 |
| T8 | 46,656 | 13,331 | 4,666 |

Each tier is ~6× the prior (matching the ×6 cost step); rebirth cuts the grind ~3× at R5 and
~10× at R10. The ladder is genuinely exponential top to bottom.

## Files touched
`src/progress/xp.js`, `src/progress/wins.js`, `src/progress/shop.js`,
`src/components/ShopScreen.jsx`, `src/components/ShopScreen.css`, `src/components/StatsScreen.jsx`,
`src/progress/{xp,wins,shop}.test.js`, `e2e/wins.spec.js`.
