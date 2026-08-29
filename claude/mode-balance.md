# Mode-Balance Simulation — Job 13 (REPORT ONLY)

Cross-mode economy balance for the five modes (Word Bomb, Category Blitz, SAT Rush,
Chain, Fuse). Question: at 1,000 runs/mode/difficulty, what is each mode's **wins/min,
XP/min, mastery/min**, does one mode dominate any axis, and is any mode *strictly* the
rational choice (a balance bug)?

Sim: `claude/mode-balance-sim.mjs` (`node claude/mode-balance-sim.mjs`). Every payout
constant is cited from source — none invented.

---

## How the economy actually pays (read from source, not assumed)

The three tracked axes are driven by **only two things per mode**: the rate of
accepted words, and each word's payout *weight*. A mode's own internal score
(SAT ante, Chain multiplier, Word Bomb survival) is **economically irrelevant** —
`bankWordWins` / `awardWordXp` key only off the accept count and the rarity weight.

**Wins** — `wins.js` `perWordWins` (line 118) then `bankWordWins` (line 212):
```
perWordWins = round10(20 · modeMult · difficultyMult · rebirthMult)      [WORD_WINS_BASE=20, wins.js:117]
grant/word  = round10(weight · perWordWins)
```
- `WINS_MULT` (wins.js:99): **Word Bomb 1, Blitz 1, SAT Rush 2, Chain 10, Fuse 15**
- `DIFFICULTY_MULT` (wins.js:106, WB/Blitz only): chill 1.0 / easy 1.25 / medium 1.5 / hard 2.0
- `weight` = `cappedWordMult(rarity, combo, lucky)` (xp.js:297, cap ×40) × Word Sense factor

**XP** — `xp.js` `xpPerWord` (line 307) → `awardWordXp`:
```
xp/word = round10(keyTierXp(tier) · wordLength · xpModeMult · rebirthMult · weight · streak) · masteryXpMult
```
- `XP_MULTIPLIERS` (xp.js:18): **Word Bomb 2, Blitz 2, SAT Rush 3, Chain 4, Fuse 5**
- `keyTierXp(T0)` = 10 (xp.js KEY_TIERS). Note XP scales with **word length**.

**Mastery** — `mastery.js:92`: exactly **+1 word per accepted word**, uniform across modes.
So **mastery/min ≡ accepted words/min** — the fastest-accepting mode wins it, full stop.

**The asymmetry that matters most:** COMBO (combo.js, ×1→×3.0) and LUCKY (luck.js,
1/40 → ×5) are wired **only into the solo hook** (`useSoloGame.js`) — i.e. **Chain and
Fuse only**. Word Bomb, Blitz and SAT all pass `cappedWordMult(rarity, 1, 1)` (App.jsx
1024/1170, SatRushGame.jsx:84) — they *structurally cannot* earn the combo or lucky
bonus. This compounds the raw mode-mult gap.

---

## Baseline & method

- **R0, Key Power T0, streak ×1, Word Sense T0, Mastery M1.** These are all identical
  multipliers across every mode, so they cancel from the cross-mode comparison; the sim
  fixes them at 1 so the ratios are the pure structural balance. (Rebirth/keytier/streak
  scale every mode equally — they change absolute numbers, never the ordering.)
- **1,000 Monte-Carlo runs**, each a **180 s active-play window**; rates = totals ÷ 3 min.
- **Rarity/length come from the REAL corpus** (`words.recall.txt` rank map + `rarity.js`
  bands, `data/satRush/words.json`). Measured pool stats fed into the draw:
  - SAT deck: avg rarity **×3.49**, avg length **8.25** (0% COMMON, 14% UNCOMMON, 31%
    RARE, **55% OBSCURE** — matches the CLAUDE.md "~56% OBSCURE" note).
  - Natural Chain/Fuse (top-3000 recall): avg rarity **×1.13**, avg len 5.97.
  - Word Bomb / Blitz natural: short common words (rarity ≈ ×1).

### Pace assumptions (the load-bearing judgement calls — stated plainly)

Word Bomb and Blitz timing is **server-side and not in the frontend** (see caveats), so
their pace is estimated, not read. Per-accepted-word cycle time (think + type at ~40 WPM
+ reject recovery; turn-based modes add opponents' turns):

| Mode | Model | mean s / your word |
|---|---|---|
| Word Bomb | turn-based, 2 players (solo-vs-bot); your word every other turn | ~8 s |
| Category Blitz | simultaneous rapid submit, no turn wait | 4.5 s |
| SAT Rush | stage-gated: P(answer @ stage0/1/2/spell-along)=.35/.30/.25/.10, stage delays 0/2.8/5.6/9.0 s (`engine.js` 2800/1100) | ~7 s |
| Chain | solo, 1 life, find word from last letter | 5.0 s |
| Fuse | solo, 2 lives, find word containing fragment | 5.0 s |

**Robustness:** the wins ordering is driven by mode-mult ratios of **10–15×**, so it is
immune to these pace choices — you would have to make Fuse ~10× slower than Word Bomb to
flip it, which is implausible (both are type-a-word-per-turn loops).

---

## Results — per mode / difficulty (R0/T0 baseline)

| Mode | Difficulty | wins/min | XP/min | mastery/min |
|---|---|--:|--:|--:|
| Word Bomb | chill | 151 | 949 | 6.8 |
| Word Bomb | easy | 151 | 951 | 6.8 |
| Word Bomb | medium | 231 | 949 | 6.8 |
| Word Bomb | hard (HELL) | 305 | 951 | 6.8 |
| Category Blitz | chill | 261 | 1,638 | 11.7 |
| Category Blitz | easy | 261 | 1,634 | 11.7 |
| Category Blitz | medium | 399 | 1,634 | 11.8 |
| Category Blitz | hard (HELL) | 526 | 1,634 | 11.7 |
| SAT Rush | — | 1,164 | **7,521** | 8.3 |
| Chain | — | 4,432 | 5,488 | 10.6 |
| **Fuse** | — | **6,860** | 7,054 | 10.7 |

(Wins is flat across WB/Blitz difficulty within rounding of the mult step; only the
mult differs — chill→hard is a clean ×2 on wins, XP is difficulty-independent.)

### Dominance per axis (best difficulty per mode)

| Axis | #1 | #2 | #1 margin | Strictly rational? |
|---|---|---|--:|---|
| **wins/min** | **Fuse** 6,860 | Chain 4,432 | **1.55×** over Chain; **13×** over WB-HELL, **26×** over Blitz-chill | **YES — balance bug** |
| **XP/min** | SAT Rush 7,521 | Fuse 7,054 | 1.07× | No (near-tie) |
| **mastery/min** | Blitz 11.8 | Fuse 10.7 | 1.10× | No (3-way cluster) |

---

## Degenerate strategies (wins/min inflation vs natural play, same mode)

| # | Strategy | wins inflation | mastery inflation | Note |
|---|---|--:|--:|---|
| 1a | Fuse, COMMON 3-letter spam (cat/its) | 1.48× | 1.58× | pure faster cycle |
| 1b | **Fuse, OBSCURE 3-letter spam** (memorised 122-word bank) | **5.82×** | 1.58× | **the real exploit — see below** |
| 2 | Fuse, long-OBSCURE rarity-max (×4.5) | 2.90× | 0.77× | slower to type, fewer words |
| 3 | Blitz, category-farming (memorised list, 2.5 s/word) | 1.88× | 1.87× | round-time × submit-rate |
| 4 | SAT, banked/briefing (always stage-0) | 1.63× | 1.63× | **ante buys nothing** — see below |

**Exploit 1b — the sharpest finding.** The 122 three-letter words in the Chain/Fuse
accept list are **absent from the recall corpus**, so `rarity.js` scores them **OBSCURE
×4.0** — the *maximum band mult* — while being the *fastest possible to type* (length 3,
zero length-bonus cost, minimal keystrokes). Memorising that tiny fixed bank lets a Fuse
player earn **5.8× a natural player's wins** while typing gibberish. This directly defeats
the rarity system's stated intent ("the reward is strictly for vocabulary", rarity.js) —
3-letter obscure words are trivially memorised, not vocabulary. Rarity is meant to price
*knowing hard words*; here it prices *knowing 122 short tokens*.

**Exploit 4 confirms a dead skill dimension.** SAT Rush's entire "answer EARLY" mechanic
(the 5×/3×/1× ante, the headline AVG ANTE stat, Silver Tongue) contributes **nothing** to
wins/XP/mastery — the economy ignores SAT score. Banking answers to always clear at stage 0
inflates the economy **only** through a faster cycle (1.63×), identical to any other
speed-up. A player optimising the meta-economy is actively encouraged to ignore SAT's
signature skill.

---

## Verdict

**Yes — there is a balance bug on the WINS axis, and it is large.**

1. **Fuse is the strictly rational choice for wins/min**, at **6,860** — **1.55×** Chain,
   **~13× Word Bomb (even at HELL)**, and **~26× Category Blitz (chill)**. No difficulty
   setting on WB/Blitz closes the gap (Blitz-HELL 526 is still 13× below Fuse). The cause
   is structural and unmissable: **`WINS_MULT` gives Fuse ×15 and Chain ×10 vs ×1 for
   WB/Blitz and ×2 for SAT** (wins.js:99) — a 15× per-word head start *before* weight —
   and **combo (×3) + lucky (×5) are exclusive to Chain/Fuse**, compounding it further.
   Once a player has unlocked Fuse, there is never a wins-reason to touch another mode.

2. **No strict dominance on XP or mastery.** SAT leads XP by only **1.07×** over Fuse
   (its long, obscure words offset its slow pace); Blitz leads mastery by only **1.10×**
   over Fuse (mastery = word-rate, and the fast modes cluster). Neither margin is a bug.

3. **Fuse is the globally rational pick.** It is #1 wins by 1.55×, #2 XP within 7% of the
   lead, and #2 mastery within 10% of the lead — it is never beaten by more than a hair on
   *any* axis while crushing the field on wins. Chain is its shadow (same design, ×10 vs
   ×15). The three server/ante modes (WB, Blitz, SAT) are economically dominated.

### Suggested levers (not applied — report only)
- The ×15 / ×10 solo mults were set high because Chain/Fuse are level-gated (memory:
  unlock-ladder). But the *magnitude* means post-unlock the ladder collapses. Consider
  bringing Fuse/Chain mults toward SAT's ×2–×3, or gating the multiplier behind mastery.
- **Bar OBSCURE from short words** (e.g. require length ≥ 6 for RARE+ bands, or floor a
  sub-5-letter word at COMMON/UNCOMMON) to kill exploit 1b — rarity should track word
  difficulty, and a 3-letter token is never hard vocabulary regardless of corpus absence.
- If SAT's "answer early" skill is meant to matter economically, fold ante into the wins
  or XP weight; today it is cosmetic.

---

## What could NOT be modelled (limitations)

- **Word Bomb & Category Blitz timing/scoring is server-side** (`chain-reaction-backend`,
  not in this repo). Turn timers, round length, per-answer server validation latency, and
  the bot's answer cadence are all estimated. The frontend only *displays* `timer_tick` /
  `answer_result`. The pace numbers for these two modes are the least certain — but the
  wins gap is far too large (10–26×) for any plausible server pace to change the verdict.
- **Blitz round structure**: modelled as a continuous rapid-submit stream. Real Blitz has
  fixed rounds with dead time between them, which would *lower* its already-last-place
  wins/min — it does not help the case for Blitz.
- **Player skill / knowledge is parametric**, not empirical — reject rates, answer-stage
  distributions and cycle times are reasoned estimates (documented in the sim), not
  playtest data. Absolute numbers will shift with a real player; the *ordering and the
  order-of-magnitude ratios* are robust because they are set by the cited mode mults.
- **Word Sense / Key Power / rebirth scaling** are held at baseline; they multiply all
  modes equally so they cannot change the ranking, but a maxed Word Sense would widen the
  wins gap further in favour of the rarity-heavy modes (SAT and the OBSCURE-spam exploit).
