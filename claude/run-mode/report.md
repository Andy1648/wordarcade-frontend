# JOB 5 — RUN MODE prototype (proto/run-mode, PROTOTYPE ONLY)

A Balatro-style run mode for TYPE A WORD: pick a mode, play a round, **draft one of three
stacking modifiers**, repeat for 10 rounds, and watch the score engine climb. It reuses the
game's already-shipped-but-invisible scoring — **rarity × combo × lucky** — and puts it in the
player's hands.

- **Page:** `public/run-mode.html` (standalone, self-contained; NOT wired into the app).
  Live at `/run-mode.html` on the branch preview.
- **Sim:** `claude/run-mode/sim.mjs` (`node claude/run-mode/sim.mjs`).

## The real numbers it's built on (from `src/progress/*`)
- **Rarity** (`rarity.js`): COMMON ×1.0, UNCOMMON ×1.5, RARE ×2.5, OBSCURE ×4.0; +0.1×/letter over 5 (cap +0.5); total rarity cap ×4.5.
- **Combo** (`combo.js`): +0.1× per accepted word, hard cap ×3.0 (reached at 20 accepts).
- **Lucky** (`luck.js`): 1 in 40 accepted words pays ×5.
- **Per-word product cap** (`xp.js`): ×40 (`cappedWordMult`).

## The 18 modifiers (real numbers, in-system)
DOUBLE VOWELS (3+ vowels ×2) · SHORT FUSE (timer −20%, wins ×1.5) · LEXICOGRAPHER (only RARE+ scores, ×3) ·
HOT STREAK (combo cap ×3→×5) · LUCKY CHARM (1/40→1/20) · JACKPOT (lucky ×5→×8) · BOOKWORM (+0.4× combo-scaled) ·
LONG HAUL (length bonus doubled) · COMMON FOLK (COMMON ×1.8) · GLASS CANNON (all ×2.5, one miss = run over) ·
SNOWBALL (+0.3×/round, permanent) · UNCAPPED (removes the ×40 cap) · VOWEL MOVEMENT (+0.3×/vowel) ·
RARE BREED (OBSCURE ×6) · COMBO KING (+0.2×/accept) · DEEP POCKETS (+150 flat) · SCRABBLE BAG (J/Q/X/Z ×3) ·
MOMENTUM (+0.5× per clean round).

## Payout curve — does it break? YES (by design)
`node claude/run-mode/sim.mjs`, greedy optimizing draft, seed 12345:

```
Rd | round payout | ×vs Rd1 | drafted
 1 |          551 |    1.0x |
 2 |          628 |    1.1x | SHORT FUSE
 3 |         1211 |    2.2x | + MOMENTUM
 4 |         2682 |    4.9x | + DOUBLE VOWELS
 5 |         6666 |   12.1x | + SCRABBLE BAG
 7 |         8388 |   15.2x | + LUCKY CHARM, COMMON FOLK
10 |        18805 |   34.1x | + LONG HAUL, COMBO KING, RARE BREED
```

- **Geometric-mean growth ≈ ×1.48 / round**, **34× blow-up Rd1→Rd10.**
- **Verdict: it BREAKS** — exponential runaway, exactly the Balatro feel. The compounding
  ROUND multipliers (MOMENTUM, SNOWBALL) are the engine; the per-word cap (×40) holds the
  word tier in check until UNCAPPED is drafted.

## Recommendation for a shipping version
Breaking is the fun, but a raw number-go-up isn't a game. Add Balatro's other half — an
**escalating ante wall** (each round demands a higher score to survive). Then "break the engine"
becomes "out-scale the wall," drafts become real decisions (which synergy beats round 8's
requirement?), and GLASS CANNON / sudden-death modifiers get teeth. The scoring engine is done;
what's missing is the wall and the loss condition.
