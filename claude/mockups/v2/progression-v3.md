# PROGRESSION v3 — "LEVELS ARE CURRENCY" (draft for Andy, Oct 5)

Why: Rebirth Rush + KEY-kept snowballed (imbetterthanandy R100 on 422 words). Andy wants a final system before a full reset. He wants levels to be cheap: millions of levels, rebirths bought in bulk (not 1 by 1), every number in K/M/B, and ascension (stars) above rebirth.

Reference games: Clicker Simulator (clicks are the currency; you rebirth the moment you can afford it, which resets clicks and raises the multiplier; first rebirth costs 750; buy up to 10 at once, more with a pass), Rebirth Champions / Button Simulator (rebirth buttons for bulk amounts, then an ultra rebirth layer), and devforum rebirth-cost math (polynomial costs, not recursive ×).

## The loop (one sentence)
Type → LEVELS pile up → spend LEVELS on REBIRTHS (in bulk) → rebirths multiply levels + wins → spend WINS on KEY TIERS → at R100+ ASCEND for STARS.

## Numbers (frozen once Andy signs off; only ±20% tuning after)
| thing | formula |
|---|---|
| LEVELS per letter | 1 × 1.8^KEY × (1 + R) × (1 + STARS) × MARK |
| WINS per word | 10 × len/5 × MODE × (1 + R) × (1 + STARS) × MARK |
| REBIRTH n costs | 100 × n^2.2 LEVELS (rebirth 1 = 100, rebirth 10 = 15.8K, rebirth 100 = 2.5M) |
| bulk rebirth | REMOVED — one at a time (see Naming + ranks) |
| KEY TIER T costs | 100 × 4^T WINS; kept through rebirth, reset on ascension |
| ASCEND | at R ≥ 100: rebirths, levels and KEY reset; STARS += floor(R / 100) |
| GEMS | rolls (unchanged): drops 1 in 15 words, bot win +5, MP +5 per player beaten, level-up replaced by +2 per rebirth bought, ascension +50 |

The level bar no longer shows "to next level". It shows progress to the NEXT REBIRTH ("REBIRTH ×3 READY" when full). That is the bar that matters, and it moves smoothly.

## Sim (greedy fast player, 150 letters/min, 25 words/min; worst case)
| time | rebirths | KEY | lifetime levels | levels per letter |
|---|---|---|---|---|
| 6 min | R6 | T3 | 18.1K | 48 |
| 1 h | R59 | T6 | 15.0M | 3.8K |
| 3 h | R165 | T8 | 394.3M | 42.2K |
| 10 h | R464 | T10 | 10.7B | 475.1K |
| 50 h | R2.0K | T12 | 1.1T | 8.2M |
(before ascension; ascension speeds the second climb ×(1+stars))
A normal player is slower; the sim is the fast-player ceiling Claude Code must keep in CI.

## Display rules
- Every number through formatNum: 1.2K, 3.4M, 5.6B, 7.8T, then Qa, Qi, Sx… Never a full long number.
- Menu headline: "1.2M LEVELS" (plural, cheap-feeling).
- Board: rebirths first, then levels, both formatted (R2.0K · 1.1T LEVELS).

## The reset (after fine-tune, Andy's call)
Everything resets (levels, rebirths, KEY, wins, marks). Each player gets GEMS = 20 × their old rebirths (R100 → 2,000 gems = 200 rolls). Needs one migration + a client "season 2" splash.

## Roll pricing (Andy, Oct 5): odd amounts, Genshin-style
Real gacha games never price a pull at a round 10/100 (Genshin: 160 per wish). Earn amounts are set so they never divide evenly into the price, which always leaves a "so close" remainder that pulls you into one more round.
- 1 ROLL = 75 GEMS
- earn: drop 1 in 15 words for 3–12 gems; bot win +18; multiplayer +15 per player beaten; win streak +4 each; +7 per rebirth bought; ascension +250; achievements 40–200
- same ~1 roll per 2–3 min of play as before (×7.5 scale)
- reset compensation: 150 gems per old rebirth (R100 = 15,000 = 200 rolls)

## Naming + ranks (Andy approved Oct 5)
- Shop XP-per-letter upgrade = POWER (was KEY TIER). REBIRTH keeps its name. Wins buy only POWER; every other shop item costs gems.
- NO BULK REBIRTH (Andy Oct 5): one rebirth at a time, hold-to-rebirth. The requirement must scale so rebirths never snowball; ascension later at single/low-double-digit rebirths. Rebirth pace math to be redone (logic phase) with a fast-player CI sim + server guard so spamming the rebirth button can never mint rebirths.
- Rank titles by level (bands widen): 1 KEYMASH · 10 TYPO · 50 CLACKER · 150 HOTKEY · 500 INKSTORM · 1.5K WORDSMITH · 5K KEYFIEND · 15K CAPSLOCK · 50K OVERCLOCK · 150K GLYPHLORD · 500K LEXIBEAST · 1.5M VOIDTYPER · 5M ASCENDANT · 15M OMNIKEY · 50M FINAL BOSS · 150M+ ENDGAME
