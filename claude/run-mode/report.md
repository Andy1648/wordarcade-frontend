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

---

# JOB A — RUN MODE v2: the wall (proto/run-mode-2, PROTOTYPE ONLY)

v1's recommendation, built and calibrated. v2 adds the three missing halves.

## 1. The ante wall (DERIVED from the sim, not guessed)
A single geometric wall clustered deaths at round 4 (thin early stacks, low variance —
the wall bit hardest where players were weakest). So the wall is **two-phase convex**:
gentle through round 5, steep from round 6, `wall(r) = W0 · g1^min(r-1,4) · g2^max(0,r-5)`.

The coefficients are swept against 1,000 greedy runs and chosen for the target band
(30–40% win) with deaths peaking at 6–8. Winning fit: **W0=225, g1=1.3, g2=1.8**.

```
Round:  1    2    3    4    5     6     7     8     9      10
Wall:  225  293  380  494  643  1157  2082  3748  6746  12143
```

Early rounds are near-free; the wall accelerates ×1.8/round from round 6, so a stack that
isn't compounding (MOMENTUM/SNOWBALL online, downsides survivable) falls behind mid-late.

## 2. Loss condition
Miss the wall in any round → **run over** at that round. GLASS CANNON adds a second death:
8%/round the run just ends even if you cleared the wall (the ×2.5 comes due).

## 3. Trade-off drafts — 15 of 18 now cost something
Every "all-upside" pick got a real downside so drafting is a decision, not a rubber-stamp:
DOUBLE VOWELS (≤2 vowels ×0.7) · SHORT FUSE (20% fewer words) · LEXICOGRAPHER (COMMON/UNCOMMON
score 0) · HOT STREAK (starts each round at combo ×0.6) · LUCKY CHARM (non-lucky ×0.9) ·
JACKPOT (odds 1/40→1/60) · BOOKWORM (lucky never procs) · LONG HAUL (words ≤5 ×0.7) ·
COMMON FOLK (RARE/OBSCURE ×0.6) · GLASS CANNON (8%/round sudden death) · SNOWBALL (×0.7 the
round drafted) · UNCAPPED (combo cap ×3→×1.5) · VOWEL MOVEMENT (J/Q/X/Z ×0.5) · RARE BREED
(COMMON ×0.7) · COMBO KING (combo cap ×3→×2.4). DEEP POCKETS, SCRABBLE BAG, MOMENTUM stay
clean (narrow or self-limiting).

## 4. Results — 1,000 greedy runs vs the derived wall
```
WIN RATE (reached round 10 alive): 34.5%    ← target band 30–40%

death round histogram (655 deaths):
  R2  16   R3  25   R4  39   R5  51
  R6 100   R7  89   R8 137 ◄ modal   R9  89   R10 109
  → deaths climb into the late game; most runs die on ROUND 8.

lucky vs unlucky spread (final bank):
  ALL runs   p10=4,207   p50=32,714   p90=71,489   (min 722, max 117,239)
  WINNERS    p10=48,804  p50=63,039   p90=78,298   → p90/p10 = ×1.6
```

The wall converts v1's strictly-positive drafts into genuine decisions: not "is this
positive?" (most are) but "does it out-scale round 6+'s ×1.8 climb, and is the downside
survivable?" 34.5% win rate — achievable enough to chase, rare enough to matter.

Reproduce: `node claude/run-mode/sim.mjs` (re-derives the wall + prints the 1,000-run stats).
Play it: `/run-mode.html` on the proto/run-mode-2 preview.
