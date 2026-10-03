# REBIRTH / ASCENSION — research + 3 specs (oct3, research only — ANDY DECIDES)

Inputs: claude/econ-oct2/v10-spec.md (chosen curve, 3-skill table), claude/econ-oct2/loop-sim-v10-chosen-3skill.json
(200 h run on the chosen curve — the `rebirthTimes` used below), src/progress/xp.js (REBIRTH_TABLE, rebirthMult,
doRebirth; v10 needAt on feat/pv10), src/progress/stars.js, src/components/ShopScreen.jsx (rebirth view).
Nothing was simmed for this file. Every B/C time is an ESTIMATE built from the sim's measured climb times. It needs a
loop-sim run before anything merges.

## 1. How real games do it

| game | you give up | you gain | formula shape | first prestige | layers on top |
|---|---|---|---|---|---|
| Cookie Clicker: ascension | buildings, upgrades, bank | prestige levels (+1% CpS each, additive) and an equal number of heavenly chips to spend | level = floor(cbrt(cookies baked all time / 1e12)), a CUBE ROOT of LIFETIME output. You are paid the difference since your last ascension. | guides say wait for ~365–440 levels: Legacy (1 chip) plus cookie boxes plus the first permanent upgrade slot. After it, "your first grandma" gives a big CpS jump. | heavenly upgrade tree (permanent slots, offline production), challenge modes |
| AdVenture Capitalist: angels | businesses, cash | angels, +2% profit each | angels = 150·sqrt(lifetime earnings / 1e15). Thresholds are 44.4 B, 177.8 B, 400 B = n²·44.4 B, a SQUARE ROOT of LIFETIME earnings. | community rule: first reset at ~150 angels, which is ×3 income | angel upgrades that SPEND angels, so the currency is both your bonus and your wallet |
| Clicker Heroes: ascend, then transcend | ascend: heroes and zones for hero souls. Transcend (zone 300+): heroes, ancients, gilds, hero souls | ancient souls, which level OUTSIDERS. Transcendent Power raises the hero-soul income of the layer below. | AS = floor(5·log10(hero souls sacrificed)), a LOG, so each ×10 souls = +5 AS. Gains diminish by design. | guide: do "three to four strong ascensions" before the first transcension | 2 layers. Kept: rubies, achievements, relics, outsiders |
| Antimatter Dimensions: Infinity, then Eternity | Crunch: antimatter and dimensions. Eternity: everything except achievements, challenge times and total antimatter | IP: upgrades, AUTOBUYERS, challenges, Break Infinity. EP: time dimensions, time studies, milestones | first crunch = 1 IP. After that IP = 10^(log10(AM)/308 − 0.75)·bonuses. EP = 5^(floor(log10 IP)/308 − 0.7). These are ROOT-of-log shapes. | the 1st crunch is a fixed wall (1.8e308). Its reward is a whole new TAB, not a bigger number. | 3+ layers, and each one unlocks MECHANICS (automation first) |

Patterns that apply to us:
1. Gain is a ROOT or LOG of LIFETIME (or since-last) output, never a fixed table. Waiting longer always pays a bit
   more, and the panel can show a live "if you reset now: N". That live number is the decision.
2. The first prestige feels good because you are back ABOVE your old power within minutes of the reset. That is a
   visible snap-back, and it pairs with something new to buy.
3. A second layer is worth having only if it brings a MECHANIC. AD's autobuyers and CH's outsiders work. A bigger
   multiplier alone does not. The second layer's currency is log-or-root slow and boosts the INCOME of the layer below.
4. Layer N+1 opens only after several "good" runs of layer N (CH: 3–4 ascensions; CC: hundreds of levels).

Sources: [cookieclicker.wiki.gg/Prestige](https://cookieclicker.wiki.gg/wiki/Prestige) ·
[ponderworthy (CC first ascension math)](https://ponderworthy.com/when-should-you-ascend-in-cookie-clicker-the-math-behind-your-first-prestige-zln) ·
[Steam AdCap angels](https://steamcommunity.com/app/346900/discussions/0/364039531219683031) ·
[Steam AdCap thresholds](https://steamcommunity.com/app/346900/discussions/0/365172547955569702) ·
[Clicker Heroes blog, AS per transcension](https://blog.clickerheroes.com/ancient-souls-per-transcension-how-to-maximize-your-gain/) ·
[AD how-to (IP/EP formulas)](https://raw.githack.com/jacorb90/IvarK.github.io/master/howto.html) ·
[Steam AD](https://steamcommunity.com/app/1399720/discussions/0/3762229949246993572). Keyboard Escape (our gate table)
is in claude/econ-oct2/v10-research.md §1. Fandom wikis returned 402, so AdCap's 150·sqrt form is derived from the
Steam-quoted thresholds.

## 2. Today under v10 (measured)

What a rebirth does today: the level goes to 1, or to HEAD START. rebirthMult(R) = 1 + R, applied to WINS and XP.
The rebirth also pays ★ = 1 + floor((LV − gate) / max(3, 10% of gate)). Everything else is kept.
Gates: LV15, 25, 40, 60, 75, 100, 125, 150, 175, 200, 225, 260, 300, 340, 380, 420, 465, 510, 560, 600, then +50
per rebirth.

Cumulative hours to each rebirth (chosen curve, 200 h run; the bots rebirth at the gate):

| skill | R1 | R2 | R3 | R5 | R8 | R10 | R12 | R15 | gap R14→R15 |
|---|---|---|---|---|---|---|---|---|---|
| casual | 0.3 | 0.5 | 3.8 | 14.3 | 51.9 | 118 | 192 | — | (R11→R12 47 h) |
| median | 0.13 | 0.2 | 1.5 | 5.2 | 17.2 | 35.2 | 57.1 | 162 | 49 h |
| strong | 0.07 | 0.1 | 0.6 | 2.1 | 5.9 | 10.1 | 15.4 | 39 | 11 h |

Median gaps between rebirths: 0.1, 0.1, 1.3, 1.9, 1.8, 2.8, 3.9, 5.2, 6.6, 11.4, 8.6, 13.3, 22, 33, 49 h.

Where it feels flat:
1. **Levels: a rebirth's multiplier is invisible.** need ∝ P^0.95, so a rebirth speeds levels by
   ((R+2)/(R+1))^0.05. R1 gives +3.5% level speed and R10 gives +0.5%. Its only level-side effect is the re-climb.
2. **Wins: the gain shrinks while the gap grows.** The +1 step is +100% at R1, +20% at R5, +10% at R10 and +6.7% at
   R15. Per hour of re-climb, the median gets +25% per 1.9 h at R4 but only +6.7% per 49 h at R15.
3. **The board punishes it.** The board is level-only, so every rebirth drops you from LV200 to 1. The median R10
   re-climb to the old level takes ~11 h. Andy wants this ("pushes people to climb again"), but nothing on the
   rebirth screen pays it back.
4. **Stars are no decision.** One extra star needs 10% of the gate (20 levels at gate 200, ≈7 h median), so every
   sim bot takes exactly 1★ per rebirth. The BAD TIME warning almost never applies.
5. **R1 and R2 happen in the first 8–13 minutes.** That is fine as onboarding (×2 is a real jump), but R3 is a
   1.3 h wall right after it.

## 3. Three versions

### A — keep rebirth, retune for v10 (smallest change)
- **Multiplier:** gentle early, then explodes late (KE-style, Andy's PV10.2b). mult(R) = 1 + R for R ≤ 5.
  Above that, mult(R) = 6·1.35^(R−5). Results: R6 ×8.1 · R8 ×14.8 · R10 ×26.9 · R12 ×49 · R15 ×121 · R20 ×541.
  Each rebirth past R5 is a flat +35%, never shrinking.
  Safe for levels: P^0.05, so ×27 vs ×11 = ×1.05 level speed. Safe for wins: ×2.45 more wins buys ~0.5 KEY tier.
- **Gates:** R1–R10 stay unchanged, because they are published and existing players sit inside them. From R11 on,
  every gate is +25 levels: 225, 250, 275, 300, 325 … instead of 225, 260, 300, 340, 380.
  The gap model fitted to the sim is gap ≈ 8.6 h·e^(0.0101·(gate−225)), median. Under it, R11 8.6 h, R12 11 h,
  R13 14 h, R14 18 h, R15 24 h.
- **Stars:** the star step becomes 5% of the gate (10 levels at gate 200), so "wait one more ★" is a ~3 h decision,
  not a 7 h one.
- **Times:** first and fifth are unchanged. 1st: casual 0.3 h, median 0.13 h, strong 0.07 h. 5th: casual 14.3 h,
  median 5.2 h, strong 2.1 h. R15: median ~111 h (today 162 h), strong ~30 h (39 h), casual >200 h.
- **Kept / lost:** as today. The level is lost; wins, KEY, forge, marks, cosmetics, words and stars are kept.
- **UI moment:** the existing RebirthCeremony. The ladder highlights the jump "R6+: +35% EACH".
- **Existing players:** nobody loses anything. R6+ saves go UP (Tangie R10 ×11 → ×26.9). The grandfathered gate
  (taw.rbgate) still applies. Watch: rebirthScaledWins payouts (achievements, collections) scale ×2.45 for R10.
- **Board:** no change.
- **Doesn't fix:** flat points 1 and 3. A rebirth is still a fixed-gate chore with a +35% number.

### B — ASCENSION: a second layer on top of rebirth
- **Currency: GLYPHS from LIFETIME WORDS.** Paid like Cookie Clicker: you get the total owed minus what is already
  claimed. glyphsOwed = floor(lifetimeWords / 2,000).
  - Words, not wins: lifetime wins reach 7e16 in the sim and inflate with KEY, while words are a pure play-time proxy.
  - Linear, not root: a sqrt version (floor(sqrt(W/250))) gave +1–2 glyphs per lap after the first, which is the
    flatness we are trying to remove.
  - Sim words per hour: casual 360, median 600, strong 960.
- **Gate:** first ascension at R10 AND ≥ 5 glyphs owed. Later ascensions at R8.
- **Reset:** level and rebirth count, so the rebirth multiplier goes back to ×1.
- **Kept:** wins, KEY, forge, marks, cosmetics, words, ★ and star perks. AUTO-KEY is never taken away.
- **Gain:**
  1. ASCENSION MULT ×(1 + 0.25·G) on wins and XP. It sits inside P, so it is level-neutral like rebirth.
  2. A NEW MECHANIC per ascension (Andy PV10.2b), from the v10-research candidate list:
     A1 GOLDEN LETTER (a daily letter; words containing it pay ×3) · A2 CHALLENGE RUNS (no-E / 4-letter runs pay
     glyphs) · A3 FREE KEY (one KEY tier is free after each rebirth) · A4+ glyph shop.
  3. Snap-back: the median's first ascension pays ~10 G = ×3.5, so R2 is ×10.5 and R3 is ×14. You pass your old ×11
     at R3, ~1.5 h after ascending (median).
- **Times** (lap = R1→R8 re-run ≈ 0.8× the first R8 time; estimate):

| skill | 1st ascension | glyphs | lap | 5th ascension | glyphs then |
|---|---|---|---|---|---|
| casual | 118 h | 21 | ~42 h | ~286 h | ~51 |
| median | 35 h | 10 | ~14 h | ~91 h | ~27 |
| strong | 10 h | 5 | ~5 h | ~30 h | ~14 |

- **UI moment:** an ASCEND tab inside the REBIRTH overlay. It must not be a new fixed icon (the NO ORPHAN FIXED UI
  rule). It shows "ASCEND → +N GLYPHS → ×A.A · UNLOCKS: GOLDEN LETTER". The ceremony reuses RebirthCeremony's
  reset-vs-kept layout and adds a mechanic reveal (claims kind 'layer', like stars).
- **Existing players:** opt-in, so nobody loses anything. Tangie (R10) and Daan (R9) reach the R-gate, but
  ~1,000 lifetime words = 0 glyphs. The ≥5-glyph gate stops a worthless first ascension (≈15 h more at median pace).
- **Board:** an ascension drops you to LV1 like a rebirth, but harder. You pass your old ×11 at R3 (~1.5 h, see
  Gain), but your old LEVEL takes ~14 h of re-climb. Show the ascension count as a frame or badge; do not rank it
  ("idc abt rebirth" applies).
- **Risk:** a lot to build: a currency, a tab, mechanics, migrations to PROGRESS_KEYS and saveBackup. Nobody reaches
  it for 35 h median and 118 h casual, so it can ship later.

### C — one prestige, gain scales with the climb (root formula, no fixed gates)
- **Points:** a rebirth pays PRESTIGE POINTS for the climb since the last reset (HEAD START counted out):
  `gain = floor( sqrt( (C(L) − C(start)) / C(15) ) )`, where C(L) = Σ need(n) at P = 1 for n < L, i.e. the v10
  curve's cumulative XP. So the gain is measured in PLAY TIME and cannot be inflated by KEY or wins. Minimum
  rebirth: gain ≥ 1 (LV15).
  Computed from the chosen curve:

| LV | 15 | 25 | 30 | 40 | 60 | 75 | 100 | 125 | 150 | 200 | 225 | 260 | 300 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gain | 1 | 2 | 3 | 8 | 25 | 37 | 58 | 87 | 126 | 255 | 362 | 556 | 841 |

- **Multiplier:** mult = 1 + cbrt(totalPP). PP 1 = ×2 (same as R1 today). PP 8 = ×3, 64 = ×5, 1,000 = ×11,
  8,000 = ×21.
  - No spam: using the sim's climb times, points per hour rise with depth (LV15 ≈ 10/h, LV100 ≈ 21/h,
    LV225 ≈ 42/h median), so going deeper always pays more per hour. That is the CC / AD "wait pays" property, and
    it fits a level-only board.
- **Stars:** +1★ each time the multiplier crosses a whole number. Existing totals match (R10 = ×11 = 10★), and a deep
  rebirth pays several ★ at once. This replaces star-step and BAD TIME.
- **Times** (policy: "rebirth when it raises your multiplier ≥ 25%", the panel's suggested mark; estimated from the
  sim's climb times):

| skill | 1st | 5th (≈LV82, ×5.2) | ×10 (8th, ≈LV234) |
|---|---|---|---|
| casual | 0.3 h | 14.1 h | ~88 h |
| median | 0.1 h | 5.3 h | ~27 h (today ×11 at 35 h) |
| strong | 0.1 h | 2.1 h | ~8 h |

  Early pacing reproduces today's almost exactly, by construction. Times past LV380 are extrapolations beyond the sim
  data, so do not trust them.
- **Kept / lost:** as today. The rebirth COUNT becomes a display number: R = floor(cbrt(PP)).
- **UI moment:** the rebirth panel's hero becomes a LIVE number: "REBIRTH NOW → ×6.5 → ×8.1 (+25%) · +2★". A meter
  fills toward the +25% mark ("GOOD TIME"), so there is no wall and no "REACH LV X". The ceremony is unchanged.
- **Existing players:** the conversion is exact. PP = R³, so mult = 1 + R is unchanged, and display R and ★ are
  unchanged. The gate is gone, so the rebirth WALL and the grandfathered taw.rbgate become moot (strictly easier).
  Nobody loses anything.
- **Risk:**
  - Server: 015 clamps rebirths to +1 per submit, but a deep first rebirth can move display R by more than 1
    (LV225 from 0 = R7). This NEEDS a migration (017) that relaxes the clamp to ≤ +R(level) per submit, plus a
    cloudSave shouldRestore check on PP.
  - The published KE gate table and copy go away (tutorial REBIRTH READY becomes "rebirth available from LV15").
- **Board:** better fit than today. Players choose fewer, deeper resets, so they stay on the level board longer.

## 4. Recommendation: C now, B later on top of it

**C**, because:
1. It is the only version that fixes flat points 2–4. The payoff is a live number that grows with the climb, waiting
   always pays, and stars become a real reward. Under v10 a multiplier cannot speed levels (P^0.05), so the GAIN
   NUMBER has to be the payoff, and C is the version that makes that number grow with the climb.
2. It matches the 4 researched games: a root of progress, paid the difference, a live "reset now: N".
3. The existing-player conversion is exact (PP = R³, nothing moves), and it removes the rebirth-wall problem instead
   of grandfathering around it.
4. It suits Andy's level-only board: fewer, deeper resets.

Then **B** (ASCENSION, glyphs from lifetime words, one mechanic per ascension) layered on C, gated at ×11
(PP ≥ 1,000). Nobody reaches that for ~27 h median, so it can be specced and simmed after C ships.
**A** is the fallback if Andy wants no structural change. It is one constant and ten gate values.

### Open questions for Andy
1. "Gentle early, exploding late": C's cube root is gentle-late. Do you want the explosion? If so, swap the
   multiplier to A's shape on PP: mult = 1 + cbrt(PP) up to ×6, then ×1.35 per +1 display-R. It is level-safe either
   way.
2. Drop the published KE gate table (LV15 → 600)? C replaces it with "any time from LV15" plus a suggested +25% mark.
3. OK to write 017 (rebirth clamp → per-level allowance)? You run it after the client deploy, like 016.
4. Ascension (B) currency: words (time-fair, but a casual earns more glyphs per ascension than a strong player
   because they type more words per lap) or levels climbed? And keep the R10 / ×11 gate?
5. The sim is next. Run loop-sim with a C policy bot (the +25% rule) at 3 skills × 200 h before anything is built.
   Every B/C hour figure above is an estimate from the chosen-curve run's climb times, not a sim.
