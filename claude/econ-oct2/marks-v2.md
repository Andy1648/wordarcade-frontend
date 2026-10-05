# MARKS v2 — Genshin stats, ★ pips, LEGENDARY pity 500, auto roll, index rewards (Andy oct5)

Engine only (`src/progress/markRollsCore.js`, `markRolls.js`, `markRollShop.js`, wired into `wins.js`, `xp.js`,
`letterXp.js`, `overdrive.js`). The UI agents read the API at the bottom.

## 1. One MAIN stat per mark

Every rollable mark has ONE stat `{ kind, value }`. Only the WORN MAIN's stat applies (one MAIN, as before).

| kind | label | where it pays |
|---|---|---|
| `winsPct` | +N% WINS | wins/word `bonus` factor (`markWinsMult`) |
| `xpPct` | +N% XP | XP/letter mark factor (`markXpMult`) |
| `baseWins` | +N BASE WINS/WORD | BASE 10 → 10 + N, before every multiplier (`xpPerWord({ baseWinsAdd })`, `wordWinsBase`) |
| `baseXp` | +N BASE XP/LETTER | BASE 10 → 10 + N, before every multiplier (`levelXpPerLetter(…, baseAdd)`) |
| `luckPct` | +N% ROLL LUCK | an addend in `luck()` (+10% → +0.1) |
| `overdriveSec` | +Ns OVERDRIVE | the next OVERDRIVE runs 5 min + N s (`overdriveLengthMs`) |

**Sizing — today's power level kept.** Each tier's stat equals the old MAIN on what it touches:
COMMON +10% · RARE +25% · EPIC +50% · LEGENDARY +200% · MYTHIC +900% · SECRET +2,400%.
A BASE +1 = +10% of BASE 10, so BASE stats are the percent ÷ 10 (COMMON +1, RARE +2.5, EPIC +5, LEGENDARY +20,
MYTHIC +90). OVERDRIVE: percent of 300 s (COMMON +30s, RARE +75s). Luck / OVERDRIVE only on COMMON / RARE.

| tier | marks → stat |
|---|---|
| COMMON | BOMBER, LINKER %WINS · SPRINTER, CRAMMER %XP · SPARKY, WICK BASE WINS · DASHER, PACER BASE XP · INKWELL, MATCHSTICK LUCK · SHACKLE, NITRO OVERDRIVE |
| RARE | DETONATOR, SMITH %WINS · SAVANT, PHOENIX %XP · CYCLONE, METRONOME BASE WINS · OUROBOROS BASE XP · SLIPSTREAM LUCK · TINDER OVERDRIVE |
| EPIC | NOVA %WINS · PYRO BASE WINS · GOLEM BASE XP |
| LEGENDARY (+perk) | ECLIPSE +200% WINS · LEVIATHAN +200% XP |
| MYTHIC (+perk) | SINGULARITY +90 BASE WINS · KRAKEN +90 BASE XP |
| SECRET (+perks) | ORIGIN +2,400% WINS |

LEGENDARY+ keep their perks. No flat one-time lumps anywhere in the stat pool.
PERMANENT (achievement) and retired marks have no stat: they keep paying their tier MAIN on wins AND XP, as before.

**The power shift, stated:** before v2 a worn mark multiplied wins AND XP; now a stat touches one of them. So
a worn mark's effect is on one axis (the CI sims measure the delta). The EPIC/LEGENDARY+ chase is unchanged.

**The INDEX % bonus is KEPT** (+0.5% per % collected, ≤ +50%, on wins AND XP): folding it away would lower every
collector's payout.

## 2. ★ pips (replace GOLD / RAINBOW)

Dupes per pip: COMMON 10 · RARE 5 · EPIC 3 · LEGENDARY 2 · MYTHIC / SECRET 1. ★5 max. Each pip +20% of the
stat (★5 = ×2). SHINY ×2 on top. Luck: +0.01 a pip, all marks.

**Migration (never hurt):** a v1 save's GOLD (×2 bonus) / RAINBOW (×5) is stored as a floor `k` per mark; a mark's
multiplier on its stat is `max(1 + 0.2 × pips, k)`. Old GOLD / RAINBOW luck (+0.02 / +0.05) is a floor too. Copies,
shiny, milestones, the worn MAIN: untouched.

## 3. Pity ladder

EPIC+ in 50 (soft from 40; first by roll 10) — unchanged. NEW: LEGENDARY+ guaranteed in 500 (`sinceLegendary`).
A v1 save starts it at its rolls (capped 499) if it never owned a LEGENDARY+, else 0.

## 4. Auto roll, skip setting

`autoRoll({ until })` rolls one at a time through `buyMarkRoll` until a result (or its double-roll extra) is
`until` or better, or wins run out. The ×10 batch API (`buyMarkRolls`) is removed (RollPanel's ×10 button now does
ten singles until the ROLL screen replaces it). `skipBelow` (default EPIC) is stored in `taw.markRolls`;
`shouldSkipReveal` never skips a first-time mark.

## 5. INDEX rewards (words at your rate, through `grantWins(…, 'MARKS INDEX')`)

| tier | new mark | each ★ | tier complete (once) |
|---|---|---|---|
| COMMON | 10 | 5 | 100 |
| RARE | 30 | 15 | 300 |
| EPIC | 100 | 50 | 500 |
| LEGENDARY | 500 | 250 | 2,000 |
| MYTHIC | 2,500 | 1,250 | 10,000 |
| SECRET | 10,000 | 5,000 | 25,000 |

A roll costs 72 words, so these are small next to spend (the commons' 220 words ≈ 3 rolls). Milestones are LUCK only
now (their 10–20-word lumps folded into the above). A v1 save's already-complete tiers count as paid.
Per mark: owned count (`n`) and first roll # (`first`).

## 6. Sim

`loop-sim.mjs`: the bot pays the INDEX rewards, compares marks by strength (`mainMultOf`, as auto-equip does), and has
the AUTO ROLL habit — once its purse pays ~10 rolls it rolls until an EPIC+ (or the purse is dry).

## API (exported from `markRolls.js`; core ones also from `markRollsCore.js`)

- Stats: `statOf(id, state?)` → `{ kind, value }` | null · `statLine(id, state?)` · `statText(stat)` · `STAT_KINDS` ·
  `markWinsMult(opts)` · `markXpMult(opts)` · `markBaseWins(opts)` · `markBaseXp(opts)` · `markLuck(opts)` ·
  `markOverdriveSec(opts)` · `markMult(opts)` (wins-equivalent, kept) · `mainMultOf(id, state?)` (strength) ·
  `mainTag(id, state?)` (the stat line; "MAIN ×N" for a PERMANENT). opts = `{ markId?, state? }`.
- Pips: `pipProgress(id, state?)` → `{ pips, have, need }` · `markLevel(state, id)` → `{ copies, dupes, pips, have, need, k, variant }` · `DUPES_PER_PIP`, `MAX_PIPS`, `PIP_STEP`.
- Pity: `pityLeft(state)` → `{ epic, legendary }` · `pityLadder(state)` → `[{ tier:'epic', left }, { tier:'legendary', left }]` · `PITY.legendary.hard` = 500.
- Settings: `getSkipBelow(state?)` · `setSkipBelow(tier)` · `shouldSkipReveal(result, skipBelow?)` · `SKIP_TIERS`.
- Index: `indexEntry(id, state?)` → `{ id, name, tier, oneInX, owned, firstRoll, pips, have, need, stat, statLine, shiny, perk }` · `completedTiers(state)` · `indexRewardWins(result, rate)` · `INDEX_NEW_WORDS` / `INDEX_PIP_WORDS` / `INDEX_COMPLETE_WORDS`.
- Roll result adds: `pips, pipUp, have, need, firstRoll, completed, rewards[{kind,tier,words}], rewardWords`; `pityHit` may be `'legendary'`. Removed: `gold, rainbow, goldUp, rainbowUp`.
- Shop (`markRollShop.js`): `buyMarkRoll` (pays INDEX rewards into `lump`) · `autoRoll({ until, level, rng, onEach, budget, max })` · `AUTO_ROLL_TIERS`. Removed: `buyMarkRolls`.
- xp.js: `levelXpPerLetter(keyTier, rebirths, markMult, baseAdd?)` · `xpPerInput({ …, baseAdd })` · `xpPerWord({ …, baseWinsAdd })` · `setLetterBaseAdd(fn)`. overdrive.js: `overdriveLengthMs()`. wins.js: `perWordFactors` adds `baseWins`; `wordWinsBase({ …, markId })` carries it.
