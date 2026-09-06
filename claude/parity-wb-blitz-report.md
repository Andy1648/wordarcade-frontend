# JOB — combo + lucky parity for Word Bomb + Category Blitz (feat/parity-wb-blitz, TIER-1, branch-only)

## What shipped
Word Bomb and Category Blitz now score with the SAME combo + lucky mechanic CHAIN/FUSE use — folded
into the per-word reward WEIGHT, reusing `src/progress/combo.js` and `src/progress/luck.js` VERBATIM
(no forked logic). All changes are in `src/App.jsx` (the WS handler), plus e2e.

- **Combo** (`combo.js`): +0.1× per consecutive accept, ×3.0 cap. A payout combo state (`wbComboRef`,
  `blitzComboRef` = `freshCombo()`) advances via `comboAccept` on each of my accepts and `comboBreak`
  on each miss, exactly as CHAIN/FUSE do.
- **Lucky** (`luck.js`): a 1/40 ×5 draw per accepted word (`makeLuckyOracle(randomSeed())`), re-seeded
  per game/round; `luckyReward(...)` gives the ×5 winsWeight folded into the weight.
- **The fold**: `cappedWordMult(rarity, comboMult, luckyMult)` (was `(rarity, 1, 1)`) at both accept
  sites — the ×40-capped product feeds BOTH the wins banking and the XP grant.

### Not a fork — the pre-existing cosmetic meter already worked
GameScreen's `useCombo` hook drives the VISIBLE streak meter (`ComboMeter`) for WB/Blitz, but it is
cosmetic-only ("does NOT touch scoring"). The gap was purely that the PAYOUT ignored combo/lucky. The
new payout combo advances on the IDENTICAL authoritative events (`word_result` accept/reject,
`turn_update` life-loss, `game_started`/`round_start` reset) the WS handler already processes, so it
stays in lockstep with the visible meter — no second event source, no forked combo logic.

### Event wiring (App.jsx)
| event | WB | Blitz |
|-------|----|-------|
| accept | `comboAccept` + lucky draw, capture into the (defer-safe) score closure | same |
| reject | `comboBreak` (reject is always mine) | `comboBreak` (new `else` on `answer_result`) |
| turn-loss | `comboBreak` when `turn_update` shows my life dropped | n/a (no turns) |
| reset | `freshCombo` + new oracle on `game_started` | on `round_start` (Blitz pays per round) |

Combo/lucky are captured at ACCEPT time (synchronously) into the deferred `scoreWbWord`/`scoreBlitzWord`
closures, so the rarity-race defer can't reorder them — each word keeps the multipliers it had when it
landed.

## Tests
- **New `e2e/parity-wb-blitz.spec.js`** (4, all via the mock-WS harness): WB combo BUILDS across accepts
  + RESETS on a reject; WB RESETS on a life-loss (turn timeout); WB payout INCLUDES lucky ×5; Blitz
  BUILDS + RESETS on a rejected answer. Deterministic via the `window.__TAW_LUCKY` seam (`'off'` /
  `'always'`), mirroring the existing `window.__TAW_NO_ACHIEVEMENT_GRANT` test hook.
- **Retuned precision specs** to the combo-boosted values (lucky off): `word-bomb-scoring` (140→170,
  260→340), `rarity-race` (CORRECT 140→170, RACED 120→140), `wins` (Blitz 60→70, 100→130).

## Mode-balance sim — the 2× spread does NOT hold, and SAT is why
Re-ran `claude/winsmin-sim.mjs` with combo+lucky modeled for the modes that actually have it
(WB/Blitz/CHAIN/FUSE) and rarity-only for SAT Rush (`SatRushGame.jsx` still passes
`cappedWordMult(r,1,1)`):

| mode | wins/min | ×lowest |
|------|----------|---------|
| **satRush** | **422** | 1.00× (rarity-only — the holdout) |
| blitz | 625 | 1.48× |
| wordBomb | 712 | 1.69× |
| fuse | 895 | 2.12× |
| chain | 963 | 2.29× |

**SPREAD 2.29× — OVER the 2× target.** The cause is NOT the WB/Blitz change; it's that **SAT Rush is
now the only mode WITHOUT combo/lucky.** Before this change the sim (rarity-only for all) masked that
CHAIN/FUSE already had the mechanic — the true pre-parity spread was already wide. Adding it to WB/Blitz
narrowed their gap to CHAIN/FUSE but left SAT stranded at the bottom.

**Fix / recommendation:** extend the SAME `cappedWordMult(r, combo, lucky)` fold to SAT Rush
(`SatRushGame.jsx:84`) — a one-line mirror of this change. Modeling all 5 modes with combo/lucky gives
**spread 1.54× ≤ 2× ✓**. This is out of JOB 4's stated WB+Blitz scope, so it's flagged here rather than
done unilaterally on a Tier-1 branch. (Degenerate short-common spam is unaffected — still handled by
the rarity/length bands.)

## Files
- `src/App.jsx` — imports (combo/luck/records), payout-combo refs, `drawLucky` seam, accept/reject/
  life-loss/reset wiring at both modes.
- `e2e/parity-wb-blitz.spec.js` (new) + retuned `word-bomb-scoring` / `wins` / `rarity-race`.
- `claude/winsmin-sim.mjs` (untracked tool) — now models combo/lucky per mode.
