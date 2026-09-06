# RUN MODE — 18-Modifier Audit

Source of truth: `src/runMode/engine.js` (MODIFIERS array), scoring constants from
`src/progress/{rarity,combo,luck}.js`, live wiring in `src/runMode/useRunMode.js`.

Key engine facts used throughout:
- `COMBO_STEP = 0.1`, `COMBO_MAX = 3.0` — combo climbs +0.1/word. A round is **16 words**
  (`WORDS_PER_ROUND`), so combo tops out at `1 + 0.1×15 = 2.5` and **never reaches 3.0**.
  Any modifier that only raises `comboMax` above ~2.5 changes nothing.
- `LUCKY_ODDS = 40`, `LUCKY_WINS_MULT = 5`.
- Rarity mults: COMMON 1.0, UNCOMMON 1.5, RARE 2.5, OBSCURE 4.0; length bonus +0.1/letter
  over 5, capped +0.5; word mult capped at `RARITY_MAX_MULT 4.5`; per-word cap `PER_WORD_CAP 40`.
- Rarity mix (sim + EV): COMMON 0.68, UNCOMMON 0.22, RARE 0.08, OBSCURE 0.02.
- **Live round applies mods directly** (`useRunMode.js:120-121`): per-word `scoreWord` +
  round-level `applyRoundMods(p.score, stack, { owned: 0, clean: state.clean })`.
  `owned` is **hardcoded 0 and never incremented anywhere** (grep-confirmed). `clean` =
  rounds already survived, and it IS tracked live.

## Per-modifier verdict table

| # | Modifier | Numbers | Effect | Legible? | Real trade-off? | Interaction | Flag |
|---|----------|---------|--------|----------|-----------------|-------------|------|
| 1 | DOUBLE VOWELS | 3+ vowels ×2 / ≤2 vowels ×0.7 | word mult ×2 if ≥3 vowels else ×0.7 | Yes | Yes | vowel axis w/ VOWEL MOVEMENT | OK |
| 2 | SHORT FUSE | round ×1.5, words ×0.8 | +50% payout, 20% fewer words | Yes | Weak — net ≈ ×1.2 | anti-syn combo cards (fewer words) | mild free upside |
| 3 | LEXICOGRAPHER | RARE/OBSCURE ×3, else ×0 | only rare+ words score, tripled | Yes | **Yes** (zeroes ~90% of words) | build-around w/ SCRABBLE / rare boosters | good |
| 4 | HOT STREAK | comboMax 3→5.0, comboStart 1.0→0.6 | raise cap, lower start | No | **FALSE** | none | **DOMINATED / DEAD UPSIDE** |
| 5 | LUCKY CHARM | odds 1/40→1/20, non-lucky ×0.9 | 2× lucky rate, −10% on rest | Yes | Yes | luck axis; +JACKPOT; BOOKWORM kills it | OK |
| 6 | JACKPOT | luckyMult 5→8, odds 1/40→1/60 | lucky pays 8×, rarer | Yes | Yes | anti-syn other luckyMult setters; BOOKWORM kills | OK |
| 7 | BOOKWORM | +0.4×combo/word, noLucky=true | additive combo-scaled boost, no lucky | Partial ("combo-scaled" opaque) | Yes | anti-syn ALL luck cards | OK |
| 8 | LONG HAUL | len>5: +min(1,(len−5)×0.1); len≤5 ×0.7 | additive long bonus + short penalty | Partial | Yes | — | **TEXT-MISMATCH** |
| 9 | COMMON FOLK | COMMON ×1.8, RARE/OBSCURE ×0.6 | boosts the 68%, dings the 10% | Yes | Weak — net ≈ +33% | anti-syn LEXICOGRAPHER/RARE BREED | near-free upside |
| 10 | GLASS CANNON | round ×2.5, 8%/round sudden death | 2.5× all payouts, run may just end | Yes | **Yes (strong)** | survival axis; +MOMENTUM | **best-designed** |
| 11 | SNOWBALL | ×(0.7 + 0.3×owned); owned ≡ 0 | **always ×0.7** (owned never advances) | No | **FALSE** | none | **BROKEN / DOMINATED + TEXT-MISMATCH** |
| 12 | UNCAPPED | cap→∞, comboMax 3→1.5 | remove 40 cap, cut combo | No | **FALSE** | none | **DOMINATED / DEAD UPSIDE** |
| 13 | VOWEL MOVEMENT | +0.3×/vowel, J/Q/X/Z ×0.5 | additive vowel boost, rare-letter penalty | Yes | Yes | anti-syn SCRABBLE BAG | OK |
| 14 | RARE BREED | OBSCURE ×1.5 (**text says ×6**), COMMON ×0.7 | tiny 2% boost, penalty on 68% | Text lies | **FALSE** (net-negative) | — | **TEXT-MISMATCH + DOMINATED** |
| 15 | COMBO KING | comboStep 0.1→0.2, comboMax 3→2.4 | combo builds 2× faster, caps 0.1 lower | Yes | Weak — net positive | anti-syn SHORT FUSE | mild upside |
| 16 | DEEP POCKETS | round +150 flat | flat add each round | Yes | **No** | self-nerfs vs exploding walls | **BORING (flat +N)** |
| 17 | SCRABBLE BAG | J/Q/X/Z ×3 | triples ~8% of words | Yes | **No** | anti-syn VOWEL MOVEMENT | **BORING (free upside)** |
| 18 | MOMENTUM | ×(1 + 0.5×clean) | +0.5× per round already survived | Yes | **No** | front-loaded if drafted late; +GLASS CANNON | **BORING / swingy** |

## FLAGS

### Dominated — no reason to ever draft (all three are net-negative EV)
- **HOT STREAK (#4).** Sets `comboMax = 5.0`, but combo caps at ~2.5 in a 16-word round, so the
  raised cap is **unreachable and inert**. The only live change is `comboStart 1.0 → 0.6`, i.e.
  every word scores less. **Strictly worse than an empty stack.**
- **UNCAPPED (#12).** Sets `cap = Infinity` **and** `comboMax → 1.5`. The cap removal never fires,
  because the same mod lowers combo enough that the biggest word (4.5 rarity × 1.5 combo × 5 lucky
  = 33.75) stays under 40. Meanwhile combo 1.5 (vs 2.5) cuts every word after the 5th accept.
  Dead upside + real downside = **strictly worse than empty.**
- **RARE BREED (#14).** ×1.5 on OBSCURE (2% of words) but ×0.7 on COMMON (68%). Net EV is clearly
  below 1.0 — a penalty card with a negligible upside. Also a text-mismatch (below).

### Text does not match effect (verify number against code)
- **SNOWBALL (#11) — BROKEN.** Text: "+0.3× per round forever." Code: `p * (0.7 + 0.3 × owned)`,
  and `owned` is **hardcoded to 0** in the live path (`useRunMode.js:120`) and incremented
  nowhere. So it is a **permanent flat ×0.7 penalty** — the promised growth never happens. This is
  the single worst card and an outright bug.
- **RARE BREED (#14).** Text: "OBSCURE ×6." Code: `m * 1.5`. Off by 4×.
- **LONG HAUL (#8).** Text: "Length bonus doubled." Code does **not** touch the length bonus
  (`LENGTH_BONUS_PER_LETTER` stays 0.1 inside `scoreWord`); it *adds a separate* term
  `+min(1.0,(len−5)×0.1)` and multiplies short words by 0.7. For the sim's len 6–9 that additive
  term is only +0.1…+0.4. "Doubled" mis-describes the mechanic.

### Boring — flat upside, no downside (`down:false`)
- **DEEP POCKETS (#16)** — flat +150/round. No cost, and it self-nerfs (flat add vs walls that
  reach tens of thousands by round 10), so it's a round-1 curiosity dressed as a modifier.
- **SCRABBLE BAG (#17)** — ×3 on ~8% of words, no cost. Pure +~16% EV.
- **MOMENTUM (#18)** — +0.5× per survived round, no cost. Worse, it reads `clean` = rounds already
  survived, so drafting it late is an **instant** ×(1+0.5×clean) with no ramp (draft before round 8
  → ×4.5 that round). The "each clean round" copy implies a build-up that doesn't exist.

## THREE REPLACEMENTS (weakest three: HOT STREAK, UNCAPPED, SNOWBALL)

Each keeps the same authoring hooks (`knob` / `word` / `round` / `roundIdx` / `suddenDeath`) so it
drops into the MODIFIERS array with no new plumbing, and each drives its scaling off `clean` (which
is tracked) — never `owned` (which is not).

**1. Replace HOT STREAK → `REDLINE`** — *"Combo builds +0.3×/word to a ×4 cap, but each round starts cold at ×0.5."*
```js
{ id: 'redline', name: 'REDLINE', text: 'Combo builds +0.3×/word to a ×4 cap, but starts cold at ×0.5', down: true,
  knob: (k) => { k.comboStart = 0.5; k.comboStep = 0.3; k.comboMax = 4.0; } },
```
Why: this is what HOT STREAK pretended to be, with the numbers made *reachable*. At step 0.3 the ×4
cap is hit by ~word 12, so the payoff is real. Cost is a genuine cold start (first ~3 words score
below baseline) and it **hates SHORT FUSE / anything shortening the round** (never reaches the cap)
— a real anti-synergy decision instead of a dead card.

**2. Replace UNCAPPED → `HIGH ROLLER`** — *"No word cap and lucky pays ×10, but lucky is half as common (1/80)."*
```js
{ id: 'high-roller', name: 'HIGH ROLLER', text: 'No ×40 word cap & lucky pays ×10, but lucky odds 1/40→1/80', down: true,
  knob: (k) => { k.cap = Infinity; k.luckyMult = 10; k.luckyOdds *= 2; } },
```
Why: this makes cap-removal *load-bearing* — a lucky OBSCURE long word now reaches 4.5 × 2.5 × 10 =
112.5 (vs the 40 cap), so uncapping is the whole point. Cost is a real halving of lucky frequency.
Rich interactions: **LUCKY CHARM** buys the odds back, **BOOKWORM** (noLucky) turns it into a trap,
and it collides with **JACKPOT** (both set luckyMult) — a build axis, not a dead knob.

**3. Replace SNOWBALL → `AVALANCHE`** — *"×0.6 payout, but +0.35× for every round you've survived."*
```js
{ id: 'avalanche', name: 'AVALANCHE', text: '×0.6 payout, but +0.35× for every clean round survived', down: true,
  roundIdx: (p, c) => p * (0.6 + 0.35 * c.clean) },
```
Why: keeps SNOWBALL's "grows over the run" fantasy but drives it off `clean` (live-tracked) instead
of the broken `owned`, so it actually scales: draft before round 2 (clean 1) → ×0.95 (a real early
loss), round 5 (clean 4) → ×2.0, round 9 (clean 8) → ×3.4. Break-even at ~1.1 survived rounds makes
the *timing* a decision, and it double-dips the survival axis with **GLASS CANNON** and **MOMENTUM**.

### Also worth fixing in place (not replacements, just corrections)
- **RARE BREED**: bump `m * 1.5` → `m * 6` to match its own text (and re-tune, since ×6 on 2% still
  barely offsets the ×0.7 on 68% — consider OBSCURE ×6 **and** RARE ×2 to make the build viable).
- **LONG HAUL**: reword to "Long words pay more, short words ×0.7" — it doesn't double anything.
- **DEEP POCKETS / SCRABBLE BAG / MOMENTUM**: give each a real `down:true` cost or accept that 3 of
  18 cards are intentionally safe picks (the test at `engine.test.js:33` pins exactly 15 `down`).
