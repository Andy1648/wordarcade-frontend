# MARKS + ACHIEVEMENTS OVERHAUL — spec with numbers (M1–M3, M5, M6, U, rule P)

Engine: `src/progress/markRolls.js` (pure + guarded store, 18 unit tests in `markRolls.test.js`).
Sim: `claude/econ-oct2/loop-sim.mjs` (rolls when the tree ships `markRolls.js`) →
`claude/econ-oct2/marks.md`. Research: `claude/finetune/marks-research.md` (Sol's RNG, Pet Sim 99,
Genshin pity, Clash Royale / Brawl Stars). Where Andy's notes and the research disagree, Andy's numbers
are used (10 dupes → GOLD, 10 golds → RAINBOW, flat for every tier).

No UI is in this branch. The roll button, cutscenes, index grid and tags come later with the
3-version quality protocol. This file is the contract that UI builds against.

---

## 1. The roll pool (29 rollable marks)

The tier is **read off X**: COMMON < 25 ≤ RARE < 100 ≤ EPIC < 400 ≤ LEGENDARY. The tier and the
odds can never disagree. The odds below are at luck 1 and sum to exactly 1 (unit-tested).

| Name | id | Tier | Mode | 1 IN X | Tag worn | Tag otherwise | Origin |
|---|---|---|---|---|---|---|---|
| BOMBER | mk-bomber | COMMON | WB | 16 | MAIN ×2 | PERK +2% | legacy |
| SPARKY | mk-sparky | COMMON | WB | 16 | MAIN ×2 | PERK +2% | new |
| SPRINTER | mk-sprinter | COMMON | BLITZ | 16 | MAIN ×2 | PERK +2% | legacy |
| DASHER | mk-dasher | COMMON | BLITZ | 16 | MAIN ×2 | PERK +2% | new |
| CRAMMER | mk-crammer | COMMON | SAT | 16 | MAIN ×2 | PERK +2% | new |
| INKWELL | mk-inkwell | COMMON | SAT | 16 | MAIN ×2 | PERK +2% | new |
| LINKER | mk-linker | COMMON | CHAIN | 16 | MAIN ×2 | PERK +2% | legacy |
| SHACKLE | mk-shackle | COMMON | CHAIN | 16 | MAIN ×2 | PERK +2% | new |
| WICK | mk-wick | COMMON | FUSE | 16 | MAIN ×2 | PERK +2% | new |
| MATCHSTICK | mk-matchstick | COMMON | FUSE | 16 | MAIN ×2 | PERK +2% | new |
| PACER | mk-pacer | COMMON | RACE | 16 | MAIN ×2 | PERK +2% | new |
| NITRO | mk-nitro | COMMON | RACE | 16 | MAIN ×2 | PERK +2% | new |
| DETONATOR | mk-detonator | RARE | WB | 40 | MAIN ×2.5 | PERK +4% | new |
| CYCLONE | mk-cyclone | RARE | BLITZ | 40 | MAIN ×2.5 | PERK +4% | new |
| SAVANT | mk-scholar | RARE | SAT | 40 | MAIN ×2.5 | PERK +4% | legacy |
| OUROBOROS | mk-ouroboros | RARE | CHAIN | 40 | MAIN ×2.5 | PERK +4% | new |
| TINDER | mk-tinder | RARE | FUSE | 40 | MAIN ×2.5 | PERK +4% | new |
| SLIPSTREAM | mk-slipstream | RARE | RACE | 40 | MAIN ×2.5 | PERK +4% | new |
| SMITH | mk-smith | RARE | SAT + CHAIN | 60 | MAIN ×2.5 | PERK +3% | legacy |
| PHOENIX | mk-phoenix | RARE | ALL | 75 | MAIN ×2.5 | PERK +2% | legacy |
| METRONOME | mk-metronome | RARE | ALL | 75 | MAIN ×2.5 | PERK +2% | legacy |
| PYRO | mk-pyro | EPIC | FUSE | 100 | MAIN ×3 | PERK +8% | legacy (the one mode epic) |
| NOVA | mk-nova | EPIC | ALL | 120 | MAIN ×3 | PERK +4% | legacy |
| KRAKEN | mk-kraken | EPIC | ALL | 150 | MAIN ×3 | PERK +4% | new |
| GOLEM | mk-golem | EPIC | ALL | 150 | MAIN ×3 | PERK +4% | new |
| ECLIPSE | mk-eclipse | EPIC | ALL | 200 | MAIN ×3 | PERK +4% | new |
| LEVIATHAN | mk-leviathan | LEGENDARY | ALL | 400 | MAIN ×4 | PERK +6% | new |
| SINGULARITY | mk-singularity | LEGENDARY | ALL | 1,000 | MAIN ×4 | PERK +6% | new |
| ORIGIN | mk-origin | LEGENDARY | ALL | 10,000 | MAIN ×4 | PERK +6% | new, **luck-immune** |

Tier totals at luck 1: COMMON 76.6% · RARE 19.3% · EPIC 3.67% · LEGENDARY 0.36% (1 in 278).
EPIC+ is 4.03% (1 in 25).

- **MODE marks are the common pool** (two per mode × six modes). **ALL-MODE marks are RARE or
  rarer.** The legendaries are all ALL-MODE.
- **ORIGIN is luck-immune** (Sol's "true odds" aura). It is always 1 in 10,000, a permanent bragging
  target that luck cannot inflate.
- The common X is derived. The commons share whatever the fixed marks leave, so adding a rare
  re-prices the commons automatically and the sum stays 1.

### Tags (rule U)
A card shows **name, rarity, "1 IN X", and ONE tag**. Nothing else.
- On the worn mark: `MAIN ×N` (`mainTag()`), from the tier: COMMON ×2, RARE ×2.5, EPIC ×3,
  LEGENDARY ×4, PERMANENT ×4. These are marks.js `MARK_TIERS`, unchanged.
- Everywhere else: `PERK +X%` (`perkTag()`), the mark's current PERK including copies and variant.
- When luck ≠ 1, the roll screen can add `YOUR ODDS 1 IN N` (`yourOneInX()`). It is the only
  second number allowed.

### MAIN vs PERK — what a mark does
- **MAIN** works as today: the one worn mark multiplies every word. It is set by the tier only.
  Copies grow the PERK, never the MAIN. That keeps any single roll's income step small (§7).
- **PERK** is new. **Every owned rolled mark** adds its PERK to wins in its mode (or every mode).
  Perks are **summed, not multiplied**: `perkMult(mode) = 1 + Σ perks`. Growth is linear in rolls,
  never compounding, and has no cap.
- Legacy ids (BOMBER, SAVANT, …) keep their marks.js behaviour when worn: the same MAIN, the same
  rank I–V, and the same worn perk. On top of that they now also pay the collection PERK.

---

## 2. PERMANENT marks (M2): only from the hard achievements

The tier is **PERMANENT**, the rarest. They get a special frame, are **not rollable**, and show
`EARNED` in place of "1 IN X". They are outside the index %, so 100% of the index stays reachable
by rolling. Each one owned gives **+0.10 LUCK**. MAIN when worn is **×4** (the LEGENDARY bonus).
They keep the **words-worn rank I–V** (marks.js), so they can reach ×5.8 at rank V.

| Mark | id | Awarded by | |
|---|---|---|---|
| IRONHAND | mk-ironhand | vol-10k KEYBOARD WARRIOR | new |
| MARATHON | mk-marathon | vol-50k UNSTOPPABLE | new |
| BLAZE | mk-blaze | wpm-100 BLAZING | new |
| CURATOR | mk-curator | dist-2500 CURATOR | existing (was EPIC ×3 → ×4) |
| LEGEND | mk-legend | lv-300 MYTHIC | existing (LEGENDARY) |
| RITUALIST | mk-ritual | streak-30 RITUAL | new |
| LINGUIST | mk-linguist | sec-dict WALKING DICTIONARY | existing (was RARE ×2.5 → ×4) |
| ETERNAL | mk-eternal | sec-eternal ETERNAL | existing (LEGENDARY) |
| GRANDMASTER | mk-grandmaster | sec-truemaster TRUE MASTER | new |
| OMEGA | mk-omega | sec-completionist COMPLETIONIST | new |

Each kept achievement card shows the mark it awards (M1). This branch adds only the data
(`PERMANENT_MARKS[].from`).

**Not wired yet:** CURATOR and LINGUIST rising to ×4 is a live payout increase for their owners.
marks.js `MARK_TIERS` / `MARKS[].tier` are untouched here. The UI branch makes that change and
re-runs rule P.

---

## 3. Price (M3): words at your rate, scaling with level

```
price(level) = ROLL_BASE_WORDS × (1 + level / ROLL_LEVEL_SPAN) reference words
             = 100 × (1 + level/1000) words      LV1 ≈ 100 · LV500 = 150 · LV1000 = 200
wins price   = words × refWordWins()
refWordWins  = keyTierXp(tier) × 5 / 10 × rebirthMult × priceRateBoost()
```
This is the **same reference word LETTER FORGE is priced in** (`forge.js forgeCost`).
`priceRateBoost()` carries the forge average, STAR POWER and the worn MAIN. It now also carries
the roll PERKs (`wins.js setRateBoost`, ×1 until you roll). BOOST and FRENZY are not in it, so a
roll does not cost 3× during a BOOST, and a BOOST is the best time to roll (+1 luck, §4).

Why 100: in the sim, income is ~40 (casual) / ~180 (median) / ~1,000 (strong) reference words per
minute of play, and it is flat over 20 h (`refWordsPerMinByHour`). A player who puts **20% of their
wins** into rolls gets **~4 / ~16 / ~85 paid rolls per hour** (5-seed means). That puts the median inside the
research's 10–20 per active day. One roll costs about 3 minutes of the median's roll budget (36 s
of full income), so it is never a wall and never trivial. It also stays that way at every level,
because the price moves with the rate. 12 words (the forge's number) gave the median 137
rolls/hour and inflated luck until commons disappeared; 400 words gave the casual zero rolls in
20 h.

**Free starter roll:** the MARKS unlock (LV10 or any rebirth) gives **one free roll**. The first
×2 MAIN is the system's unlock moment, the same as today's first achievement mark at LV15. It is
not a purchase.

---

## 4. Luck (M6)

```
luck = (1 + Σ additive) × (×2 on every 10th roll — "×2 LUCK READY")
```
| Source | Additive | Cap |
|---|---|---|
| each PERMANENT mark owned (= each hard achievement) | +0.10 | none (10 today) |
| each mark that has gone GOLD | +0.02 | none |
| each mark that has gone RAINBOW | +0.05, then +0.01 per further rainbow of it | none |
| each paid INDEX milestone | +0.05 … +0.50 (§6) | none |
| a live BOOST | +1.0 | while it runs |

- **What luck does** (Sol's shape): every non-common chance × luck, ORIGIN excepted. Commons take
  the remainder. When the non-commons pass 100%, commons drop out and the rest is renormalised, so
  luck removes trash and never breaks the table (tested to luck 10⁵).
- Tier odds by luck. Commons go first, then rares dominate:

  | luck | COMMON | RARE | EPIC | LEGENDARY |
  |---|---|---|---|---|
  | 1 | 76.6% | 19.3% | 3.67% | 0.36% |
  | 1.5 | 65.0% | 29.0% | 5.50% | 0.53% |
  | 2 | 53.3% | 38.7% | 7.33% | 0.71% |
  | 2.5 | 41.6% | 48.3% | 9.17% | 0.89% |
  | 4 | 6.6% | 77.3% | 14.7% | 1.41% |

- The luck budget is small on purpose (research §5, "luck inflation"). Gold and rainbow luck is
  **per mark**, not per gold made. A per-gold +0.01 gave the strong bot luck +7 in 20 h, and it
  rolled no commons at all.

---

## 5. Pity (M3: shown on screen)

| Counter | Hard | Soft | Resets on |
|---|---|---|---|
| EPIC+ | **40** (guaranteed on the 40th roll of a drought) | from roll 30: +5% EPIC+ per roll | any EPIC or LEGENDARY |
| LEGENDARY | **300** | from roll 220: +1.5% per roll | a LEGENDARY only (an epic does not reset it) |
| First EPIC+ ever | **by roll 10** | — | — |

- The button shows `EPIC+ IN n · LEGENDARY IN m` (`pityLeft()`). For a new player the EPIC+ number
  counts the first-10 guarantee. The counters are never hidden; Genshin's hidden counter is the
  pitfall to avoid.
- At luck 1 with no soft pity, a 40-roll drought happens 20% of the time (0.96³⁹). A 300-roll
  legendary drought happens 34% of the time, and about 20% at luck 1.5.
- A forced roll is flagged `pityHit: 'epic' | 'legendary'`. The UI can stamp it "PITY", or play the
  same cutscene. That choice is open.

---

## 6. Duplicates → GOLD → RAINBOW, and the INDEX (M3, M6)

**A duplicate is never dead.** Every copy raises that mark's PERK by **+10% of its base**, linearly
and forever.

```
dupes   = copies − 1
gold    = floor(dupes / 10)        → the 10th dupe makes the GOLD version (guaranteed)
rainbow = floor(gold / 10)         → 10 golds (the 100th dupe) make the RAINBOW
perk    = base × (1 + 0.10 × dupes) × variant
variant = 1 · GOLD ×1.25 · RAINBOW ×1.6 × (1 + 0.10 × (rainbows − 1))
```
Examples: a common (+2%) at its 10th dupe goes GOLD at +2% × 2.0 × 1.25 = **+5%**. At the 100th
dupe it goes RAINBOW at +2% × 11 × 1.6 = **+35%** in its mode. A legendary (+6%) at RAINBOW is +106%
in every mode. Nothing stops there: copies, golds, rainbows and the perk keep counting. They are
plain Numbers, tested finite at 10¹² copies.

At ~16 rolls/hour, a common's first GOLD takes 11 copies (≈ 172 rolls, ~10 h for the median
player). The sim median has 17 GOLD step-ups across all marks by 20 h, because rares and legacy
copies count too. A common's first RAINBOW takes 101 copies (≈ 1,580 rolls, ~100 h). The strong
bot has ~6 rainbows by 20 h.

Research note: the research suggested tiered thresholds (legendary gold at 2 dupes). Andy said a
flat 10/10, so a GOLD legendary is a deep-end flex: 11 copies of a 1-in-280 tier. This is open
question 4.

**The INDEX** (`collection()`): % of the 29 rollable marks owned, plus GOLD % and RAINBOW %
tracks. Permanents are outside it. Each milestone pays once, adds luck forever, and pays a wins
lump of N words at your rate. Every lump is ≤ 20 words, inside the "≤ 3 minutes / ≤ 3 levels"
runaway rule.

| Milestone | Luck | Words |
|---|---|---|
| base 25 / 50 / 75 / 90 / 100% | +0.05 / +0.10 / +0.10 / +0.15 / +0.25 | 10 / 15 / 20 / 20 / 20 |
| gold 25 / 50 / 75 / 100% | +0.10 / +0.15 / +0.15 / +0.25 | 15 / 20 / 20 / 20 |
| rainbow 25 / 50 / 75 / 100% | +0.15 / +0.20 / +0.20 / +0.50 | 20 each |

---

## 7. Roll value (M5): no single roll worth more than ~3 levels

A roll can change income in one of two ways:
1. **A lump**: index milestone wins. These are priced in words (≤ 20). The loop-sim runaway rule
   applies (fail = > 3 minutes of play **and** > 3 levels). No roll pays any other lump: there is
   no maxed-mark refund, because nothing maxes.
2. **A permanent income step**: a new PERK, a GOLD/RAINBOW step-up, or a new MAIN through
   auto-equip. It is measured as loop-sim measures a buy: `levels = ln(step) / ln(need(L+1)/need(L))`,
   the number of levels of the curve that step is worth at the level where it happens.

This is why the MAIN is set by tier only and GOLD/RAINBOW grow the PERK, not the MAIN. A ×1.25 MAIN
step from going GOLD would be 7.5 levels on the 1.03 tail. Results are in `marks.md`. Every paid
roll is ≤ 1.7 levels in all 15 runs. **The exception:** with the §9 cuts, a casual player wearing a
×2 common who rolls a legendary auto-equips a ×4 MAIN, up to 19 levels (`marks.md` §2, open
question 5).

---

## 8. Roll behaviour (M6) — for the UI branch

- **Auto-equip:** a new roll **rarer than the worn MAIN** auto-equips (`shouldAutoEquip`). A
  PERMANENT is never displaced. Rarity only: a rare at rank I replacing a common at rank V can
  lower the MAIN (2.6 → 2.5). That is open question 5.
- **Hold-to-roll:** repeat about every 350 ms while held. **Stop on EPIC+, on any NEW mark, on
  GOLD/RAINBOW up, and when the balance runs short.**
- **Cutscene by rarity:** a COMMON pops instantly (~200 ms card). A RARE gets a ~400 ms flash and
  stamp. An EPIC climbs ~1.4 s (Starr-Drop style: it starts common-coloured and steps up). A
  LEGENDARY gets a ~3.5 s full-screen moment (the full sequence the first time, ~1.5 s after that).
  PERMANENT is not rolled; its claim gets the legendary moment with the special frame. GOLD/RAINBOW
  step-ups get their own stamp. Everything is finite, transform/opacity only, reduced-motion safe
  (CLAUDE.md animation budget).
- **Index:** % collected, GOLD %, RAINBOW %, and the next milestone. A locked tile shows
  "1 IN X" (rolled) or the achievement name (permanent).

## 9. Achievements keep / cut (M1) — every achievement in achievements.js

KEEP means genuinely hard: **≥ 10 h of median play, a skill bar the median bot never reaches, or 30
real days.** A kept achievement awards its PERMANENT mark (§2). A cut achievement leaves the catalog
the way `ws-3` did: its id stays harmlessly in old earned sets. A mark it used to award moves to the
roll pool or is retired, and its owners keep it (§10). Earn times are the median of the 5-seed
BEFORE sim (`marks.md`). VOLUME counts only Word Bomb words in the sim, so real times are shorter.

Earn time = median minute of play, BEFORE tree, 5 seeds (casual / median / strong). "—" means not
reached in 20 h. Rebirth times come from the rebirth log (R1 ≈ 2–4 min, R5 ≈ 6–9, R10 ≈ 11–17).

| id | name | earn time c / m / s | verdict | reason | mark it awarded → now |
|---|---|---|---|---|---|
| vol-1 | FIRST BLOOD | 1 / 1 / 0.8 | CUT | first word | — |
| vol-100 | WARMING UP | 23 / 10 / 6.5 | CUT | minutes | — |
| vol-1k | WORDSMITH | 740 / 406 / 291 | CUT | ~7 h median, and every player gets it just by playing | — |
| vol-10k | KEYBOARD WARRIOR | — / — / — | **KEEP** | ≈17 h of median play (10 w/min); a commitment | IRONHAND (new permanent) |
| vol-50k | UNSTOPPABLE | — / — / — | **KEEP** | ≈83 h median | MARATHON (new permanent) |
| wpm-40 | TOUCH TYPIST | — / 19 / 18 | CUT | average typing speed | — |
| wpm-70 | FAST FINGERS | — / — / 18 | CUT | a good typist gets it in their first measured game | METRONOME → roll pool (rare) |
| wpm-100 | BLAZING | — / — / — | **KEEP** | a skill bar none of the bots reach (strong = 75 WPM) | BLAZE (new permanent) |
| obs-1 | OBSCURITY | 22 / 3.3 / 2.5 | CUT | minutes | — |
| obs-50 | LEXICON | — / 347 / 77 | CUT | superseded by sec-dict (100) | — |
| dist-500 | COLLECTOR | 137 / 70 / 40 | CUT | ~1 h | MAGPIE → retired |
| dist-2500 | CURATOR | — / 563 / 271 | **KEEP** | ~9.4 h median, never for casual in 20 h | CURATOR → permanent |
| lv-15 | ASCENDANT | 3.5 / 3 / 1.6 | CUT | minutes | STUDENT → retired |
| reb-1 | REBIRTH | ~3 / 2.4 / 3 | CUT | minutes | PHOENIX → roll pool (rare) |
| lv-50 | VETERAN | 5.3 / 4.9 / 2.7 | CUT | minutes | VETERAN → retired |
| reb-5 | REBIRTH ×5 | ~8 / 6 / 9 | CUT | minutes | NOVA → roll pool (epic) |
| lv-300 | MYTHIC | 20 / 13 / 8 | **KEEP\*** | **easy today** (13 min). Hard only under PV10 (LV300 ≈ 100 h target). See open question 1 | LEGEND → permanent |
| streak-3 | HABIT | 3 days | CUT | 3 days | — |
| streak-7 | DEDICATED | 7 days | CUT | a week | — |
| streak-30 | RITUAL | 30 days (sim is 20) | **KEEP** | 30 real days in a row | RITUALIST (new permanent) |
| m-wb-5 | BOMB SQUAD | 57 / 16 / 10 | CUT | under 1 h | BOMBER → roll pool (common WB) |
| m-blitz-5 | QUICK THINKER | not simulated | CUT | same bar as m-wb-5 | SPRINTER → roll pool (common BLITZ) |
| m-sat-5 | SCHOLAR | not simulated | CUT | same bar | SAVANT → roll pool (rare SAT) |
| m-chain-5 | UNBROKEN | 84 / 64 / 58 | CUT | ~1 h | LINKER → roll pool (common CHAIN) |
| m-fuse-5 | DEFUSER | 88 / 56 / 38 | CUT | ~1 h | — |
| m-all-3 | JACK OF ALL | needs Blitz/SAT (not simulated) | CUT | Mastery 3 everywhere is a few hours | — |
| kp-5 | POWER USER | 4.5 / 3.8 / 2.7 | CUT | minutes | — |
| kp-8 | SIXTH SENSE | 6.2 / 5.9 / 4.3 | CUT | minutes | — |
| forge-26 | FULL ALPHABET | 9 / 9.7 / 6.5 | CUT | minutes | SMITH → roll pool (rare) |
| frenzy-1 | FRENZY! | — / 39 / 22 | CUT | 19% of median FUSE runs | PYRO → roll pool (epic FUSE) |
| sec-millionaire | PAPER CHASE | 5.3 / 4.9 / 3.2 | CUT | 1M wins is minutes in this economy | — |
| sec-dict | WALKING DICTIONARY | — / 700 / 164 | **KEEP** | ~12 h median, never for casual | LINGUIST → permanent |
| sec-eternal | ETERNAL | ~16 / 12 / 15 | **KEEP\*** | **easy today** (10 rebirths in ~12 min). Hard only under PV10. Open question 1 | ETERNAL → permanent |
| sec-truemaster | TRUE MASTER | not reached (needs all 5 modes) | **KEEP** | Mastery 10 in every mode | GRANDMASTER (new permanent) |
| sec-completionist | COMPLETIONIST | not reached | **KEEP** | every other KEPT achievement (it now means the hard nine) | OMEGA (new permanent) |

35 achievements: **10 KEEP, 25 CUT** (`ACHIEVEMENT_PLAN`, unit-tested to cover the whole catalog).
\* = kept on the assumption that PV10 makes levels and rebirths slow. If PV10 does not ship, the
alternative is two new ids (e.g. "Reach LV1000", "Rebirth 25 times"), so a published id never
changes what it means. Cutting achievements also removes their wins lumps (6–25 words each) and,
for NEW players, their marks. Rule P result in `marks.md`.

## 10. Carry-over: nobody loses a mark, rank or equipped MAIN

- **Every existing mark has a home** (unit-tested):
  - **rollable**, owners keep it as 1 copy: BOMBER, SPRINTER, SAVANT, METRONOME, LINKER, PHOENIX,
    SMITH, PYRO, NOVA
  - **permanent**: LINGUIST, CURATOR, ETERNAL, LEGEND
  - **retired**: STUDENT, MAGPIE, VETERAN. These were all-mode commons, which the new pool does not
    have. Owners keep them (wearable, same MAIN ×2, same rank, same perk), but no new player can
    get them and they are outside the index.
- **No tier goes down** (unit-tested): CURATOR epic → permanent, LINGUIST rare → permanent, every
  other legacy tier is unchanged.
- **Migration** (`migrate()`, `ensureRollState()`): on a save's first touch of rolls, every
  legacy-owned rollable mark becomes `copies = max(copies, 1)`. Index milestones that this already
  reaches are credited as luck with no lump. It is idempotent (tested), and it never writes
  `taw.mark` (the worn MAIN), `taw.markWords` (ranks) or removes anything from `taw.marksOwned`.
  A legacy mark rolled for the first time also joins `taw.marksOwned`, so marks.js treats it as
  owned (wearable, ranked).
- **Storage:** `taw.markRolls` = `{ v, rolls, sinceEpic, sinceLegendary, everEpic, starter,
  marks: { id: { n } }, milestones: [] }`. All reads are guarded and junk-tolerant (`normalize()`).
- **Payout hook:** `wins.js perWordFactors.bonus × rollBonusMult({mode})` and the same factor in
  `setRateBoost`. It is **exactly ×1 for every save that has never rolled**. No live save can roll
  until the UI ships, so this branch changes no live payout (confirmed by the SIM_ROLLS=0 compare
  in `marks.md`).

## 11. Rule P

See `marks.md`: three 5-seed compares (`compare.sh`) against origin/main: (a) engine present but
unused, (b) rolls at a 20% wins share, (c) rolls plus the §9 achievement cuts. Windows that got
worse are listed there, not hidden.

## 12. New glyphs needed (MarkBadge.jsx, UI branch)

There are 26 new ids with no art yet. MarkBadge renders no glyph for an unknown id, so nothing
crashes. Each glyph needs real vector art with personality: drips, overspray, asymmetry.
- **Rolled (20):** SPARKY (a lit fuse spark), DASHER (a skidding shoe), CRAMMER (a stuffed book),
  INKWELL (a spilled pot), SHACKLE (an open cuff), WICK (a candle wick), MATCHSTICK, PACER
  (a stopwatch), NITRO (a canister), DETONATOR (a plunger), CYCLONE, OUROBOROS (a snake eating its
  tail), TINDER (a flint), SLIPSTREAM (wind streaks), KRAKEN, GOLEM, ECLIPSE, LEVIATHAN,
  SINGULARITY, ORIGIN.
- **Permanent (6):** IRONHAND, MARATHON, BLAZE, RITUALIST, GRANDMASTER, OMEGA. They also need the
  PERMANENT frame (not the rank rim).
