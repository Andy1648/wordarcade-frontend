# THE RUN — a full playthrough, told as a story

*Branch: `chore/run-playthrough` off `feat/run-mode`. A Playwright bot drove the **real**
UI (`RunMode.jsx` / `useRunMode.js`) end to end — a 390×844 mobile viewport, the real 30s
round clock, real words typed into the real input, real draft clicks. No engine shortcuts:
every number below came off the screen. Screenshots of every transition are in
`claude/run-playthrough/` (32 PNGs). This is the closest thing we have to Andy sitting down
and playing one.*

---

## Headline verdict: **yes — a run is compelling, and it's compelling for the right reason.**

The bot didn't just survive or die on a dice roll. It died on **round 8 of 10**, and it died
because of **a modifier it drafted** — LEXICOGRAPHER, "RARE+ ×3 but COMMON/UNCOMMON score 0" —
which was flatly incompatible with how it had been playing (mostly common words). That is the
exact fantasy a drafting roguelike is supposed to sell: *your build is a bet, and a bad bet
kills you.* When the failure state is legible and self-inflicted rather than arbitrary, the
mode is working. It is.

But it's a first draft of a good idea, not a finished one. Three things hold it back from
great, in order of how much they matter:

1. **The round UI hides the modifiers that are actually keeping you alive** — so the wall's
   stakes read as either a false alarm or a sudden execution, rarely as an honest nail-biter.
2. **SAT RUSH rounds add no mechanic** — CHAIN and FUSE change how you type; "SAT RUSH" is a
   normal round wearing a label.
3. **Some trade-off cards are build-enders with no telegraph** — great for depth, punishing
   for a first-timer who can't yet know their own tendencies.

---

## The run, round by round

The wall ladder is shown in full on the very first screen — `225 · 293 · 380 · 494 · 643 ·
1k · 2k · 4k · 7k · 12k` — so you can see the whole gauntlet before you type a word. That's a
strong opening move: the mountain is visible from base camp.

| R | Mode | Wall | On-screen score (raw) | **Actual round total** | Margin | Draft taken |
|---|------|-----:|----------------------:|-----------------------:|-------:|-------------|
| 1 | FUSE | 225 | 424 | **458** | 2.0× | LUCKY CHARM *(trade-off — no pure-upside offered)* |
| 2 | CHAIN | 293 | 361 | **389** | 1.3× | SCRABBLE BAG *(pure upside)* |
| 3 | SAT RUSH | 380 | 461 | **494** | 1.3× | MOMENTUM *(pure upside)* |
| 4 | SAT RUSH | 494 | 452 | **1,199** | 2.4× | DEEP POCKETS *(pure upside)* |
| 5 | CHAIN | 643 | 466 | **1,639** | 2.5× | BOOKWORM *(trade-off)* |
| 6 | FUSE | 1,157 | 504 | **2,051** | 1.8× | DOUBLE VOWELS *(trade-off)* |
| 7 | SAT RUSH | 2,082 | 1,040 | **4,576** | 2.2× | **LEXICOGRAPHER** *(trade-off)* |
| 8 | SAT RUSH | 3,748 | **0** | **150** | **DIED** | — |

**Died round 8/10.** Final line: `ROUND 8: 150 < 3,748`. **Banked 10,956 → +876 WINS.**
Final stack (7 chips): **LUCKY CHARM · SCRABBLE BAG · MOMENTUM · DEEP POCKETS · BOOKWORM ·
DOUBLE VOWELS · LEXICOGRAPHER.**

### What that table is actually telling you (the most important finding)

Look at the two score columns. **Your raw typing output barely moved all run** — 360 to 500
points, round after round, from a competent ~19-word round. The wall, meanwhile, went from 225
to 3,748. The only thing that kept pace was the **drafted stack**: MOMENTUM and DEEP POCKETS
turned a flat ~450 of typing into 1,199, then 1,639, then 2,051. **The draft isn't garnish on
top of skill — it's the load-bearing wall.** That's a genuinely good roguelike shape: skill
gets you in the door, the build carries you up the mountain.

The problem is that **the round screen shows you the raw column, not the actual column.** The
"/ WALL TO CLEAR" readout and the progress-fill bar only reflect per-word scoring; the
round-level multipliers (DEEP POCKETS's flat +150, MOMENTUM's ×N) are added *after the clock
hits zero*. So from round 4 on, the bar told the bot it was at **452 / 494 (~90%, "not met")**
— and then it cleared at **1,199**. Round 6 read a demoralizing **504 / 1,157 (~44%)** and
cleared at **2,051**. You spend most of every round looking like you're losing, then clear
comfortably. See `r06-b-midround.png` (bar near-empty) versus the draft card that follows it.

This muddies the wall's whole job. Because the live number lies, you can't read your margin,
so the wall stops feeling like a live threat you're racing — until round 8, when the number
`0` was finally *telling the truth* and there was no way to know that from the number alone
(`r08-b-midround.png`: 17 seconds left, score frozen at `0 / 3,748`, bar dead flat). The bar
cries wolf for four rounds, then the one time it means it, it looks identical.

**Fix worth considering:** fold the round-level multipliers into the live projection so the bar
shows what you'll *actually* bank, or at minimum surface an "expected with modifiers" ghost on
the track. Right now the mode's central tension device is semi-broken.

---

## Did DRAFTING feel like a real decision, or just a menu?

**A real decision — this is the mode's strongest pillar.** The evidence isn't a vibe, it's the
corpse: the run ended because of a draft pick, full stop. A few specifics that make it land:

- **Offers are genuinely constrained.** Twice (round 1 and round 7) *all three* cards were
  TRADE-OFF — no safe pick, you must eat a cost. The round-7 board (`r07-c-draft.png`) was
  LEXICOGRAPHER / GLASS CANNON / SNOWBALL: zero your common words, or take an 8%-per-round
  instant-death, or tax the round you draft it. That's a real fork, not a rubber-stamp.
- **The stack is legible.** The growing chip strip ("YOUR STACK") is on the draft screen, the
  wall screen, and the game-over screen, so you always see the machine you're building. By
  round 7 it's a satisfying seven-chip shelf (`r07-c-draft.png`).
- **The PURE UPSIDE / TRADE-OFF tag is a good honesty signal** — it lets a new player reach for
  upside early (the bot grabbed SCRABBLE BAG, MOMENTUM, DEEP POCKETS on rounds 2-4) and take on
  risk later, which is a natural difficulty ramp.

Where drafting falls short of great:

- **You're asked to bet on your own tendencies you have no read on.** LEXICOGRAPHER, RARE
  BREED, COMMON FOLK, SCRABBLE BAG, DOUBLE VOWELS all key off *what kind of words you type* —
  but the game never reflects your rarity/length mix back at you. A vocabulary monster should
  *love* LEXICOGRAPHER; a common-word speed-typist should run screaming. Nothing on the card or
  the HUD helps you know which you are. For that player the "decision" is a blind gamble, not an
  informed one. (This is precisely how the bot died: its draft heuristic avoided the obviously
  scary GLASS CANNON and walked straight into the quietly-lethal LEXICOGRAPHER.)
- **No pass / re-roll / skip.** When all three are traps, you must take poison. A "bank a small
  bonus instead" option would turn the all-trade-off boards from a gotcha into a decision.

---

## Did the WALL create stakes?

**Partly, and it's one UI fix away from fully.** On the plus side it is a true fail condition,
it *did* end the run, and the up-front ladder does a lot of psychological work — you can see
round 6 nearly doubles round 5, and it never lets up after the knee. The escalation curve is
well-shaped: gentle for three rounds, then a cliff.

What blunts it:

- **The margin-blindness above.** You can't feel a wall closing in if the live number doesn't
  reflect your real score. The wall's threat is real but *invisible until it's over.*
- **Rounds 1-7 were never close** for a competent player — 1.3× to 2.5× margins. The wall was
  either a formality or a wall you'd already smashed through; it rarely sat at the 1.0-1.1×
  knife-edge where stakes actually bite. The one time it bit, it wasn't a near-miss, it was a
  0. So the emotional shape was *"comfortable, comfortable, comfortable, dead,"* rather than a
  tightening screw. A tightening screw is the goal.

The bones are right — a visible escalating ladder plus a hard fail is a proven formula. It
needs the live score to tell the truth so the player can *feel* the gap narrowing.

---

## What felt flat

- **SAT RUSH rounds are a label, not a mode.** CHAIN enforces start-with-last-letter; FUSE
  enforces contains-the-fragment — both visibly change your typing (`r02`, `r06`). "SAT RUSH —
  Define the word before it fills in" enforces *nothing*: it's a constraint-free typing round
  with purple text. Four of eight rounds this run were SAT RUSH, so half the run had no
  mechanical identity. Either wire in the real define-before-fill mechanic or cut it to two
  modes.
- **Combo pinned at ×2.8 the entire run** (default cap 3.0), untouched by the draft unless you
  specifically take HOT STREAK/COMBO KING. Combo ends up feeling like a fixed ramp rather than
  a lever, which wastes a satisfying number.
- **The between-rounds beat is all screens, no motion payoff.** Clearing a wall by 2× and
  clearing it by 1.05× produce the identical draft screen. A clear that was *close* should feel
  different from a stomp — the mode has no "phew" moment.

## What felt good

- **The core loop reads instantly.** Wall → type → draft → bigger wall. No tutorial needed; the
  first wall screen explains itself.
- **The house style holds up on mobile.** Thick coloured outlines, hard black shadows, the pip
  rail, the chip stack — it looks like the rest of the game and the 390px layout never broke
  (see any shot).
- **The draft is the hook.** Every "cleared" screen made me want to see the three cards. That
  pull is the whole reason to build this mode, and it's there.
- **The build genuinely compounds.** Watching flat ~450 typing turn into 4,576 by round 7 is
  the good drug. When the number-lie gets fixed, that compounding will *feel* as good as it
  reads here.

---

## Honest caveats about this specific run (so the numbers aren't over-trusted)

This was a **bot**, and it played an idealized, slightly inhuman game — read the verdicts as a
*competent-optimistic baseline*, not a median human run:

- **Constraint-perfect: 0 rejected words across 152 submissions,** and combo never reset. A
  real human fumbles CHAIN/FUSE constraints constantly, and every fumble drops combo to ×1 —
  so a human's raw scores would be **lower and choppier**, and would likely die *earlier* than
  round 8 on the CHAIN/FUSE rounds specifically.
- **Common-word vocabulary by design** (weighted ~62/28/10 common/uncommon/rare to mimic what a
  person recalls under a clock). A player with a *rare* vocabulary would score far more per word
  *and* would draft the opposite way — LEXICOGRAPHER would be their best card, not their
  killer. The mode's balance clearly swings hard on vocabulary, which the single-archetype bot
  can't fully map.
- **~19 words/round at a steady 1.6s cadence** (deliberately matched to the engine's
  `WORDS_PER_ROUND` of 16). A fast human could type more; most will type fewer under constraint.
- **A dumb draft heuristic** (prefer PURE UPSIDE, else avoid GLASS CANNON) — which is *why* it
  ate LEXICOGRAPHER. A thinking player probably dodges that specific death, which means a real
  run likely reaches round 9-10. The death round here is a floor for a careless player, not a
  ceiling.

Net: the *structure* findings (draft matters, wall escalates, UI hides the multiplier, SAT is
flat) are solid and would reproduce. The *exact* death round would move with playstyle.

---

## Screenshots

`claude/run-playthrough/` — 32 PNGs, every transition:
- `00-menu.png` — THE RUN card on the menu.
- `rNN-a-wall.png` — each pre-round wall screen (mode, wall, stack, the full ladder).
- `rNN-b-midround.png` — mid-round typing (note `r06`'s "losing" bar that clears, and `r08`'s
  frozen `0`).
- `rNN-c-draft.png` — each draft: three cards + the growing stack.
- `rNN-d-stack-after.png` — the stack immediately after the pick.
- `zz-over.png` — the RUN OVER screen (round 8, 150 < 3,748, 7-chip stack, +876 WINS).
- `_transcript.txt` / `_data.json` — full machine log of every round and pick.
