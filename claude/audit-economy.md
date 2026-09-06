# Economy Audit — 200-hour player simulation (current `main`)

Sim: `claude/econ200h-audit.mjs` (imports the LIVE shipped modules — no hardcoded economy
numbers). Word-by-word over 200 h of play for 5 archetypes; every progression reward channel
(Key Power / Word Sense / Momentum / cosmetics purchases, XP levels, per-mode mastery,
collection milestones, achievements, unlock-ladder frames, rebirths) is put on one merged
timeline. "Dead stretch" = longest span with **no** reward event. Grounding earn rates from
`claude/winsmin-sim.mjs` (rarity+combo+lucky weighted). Run: `node claude/econ200h-audit.mjs [rebirthCap] [nows]`.

Model calibration (not flat constants): throughput words/min WB 8 · Blitz 14 · SAT 12 · Chain
11.6 (engine-derived) · Fuse 20; words drawn frequency-weighted from `words.recall.txt` (SAT from
its forced deck) so rarity/distinct/obscure are consistent with earning; combo climbs +0.1/word
with a break ~1/15 words; lucky E[×]=1.1; streak advances one day/100 play-min (caps ×1.25 @30d);
rebirth taken greedily at threshold.

---

## A. Longest dead stretch per archetype

Primary run = player stops prestige at **R10** (`rebirthCap 10`); the endgame cadence is
sensitive to how long the player keeps rebirthing, so R10 and R20 bracket it.

| Archetype | Longest dead stretch | Where (start) | Final state | avg earn (wins/min) |
|---|---|---|---|---|
| Word Bomb main | **6.9 h** (415 m) | LV237→238 @190 h | LV238 R10 KT16 WS16 M200 | 1.6e10 |
| Blitz main | **6.3 h** (376 m) | LV244→245 @191 h | LV245 R10 KT16 WS16 M200 | 1.2e10 |
| SAT Rush main | **6.6 h** (394 m) | LV275→276 @128 h | LV289 R10 KT18 WS18 M200 | 3.4e11 |
| Chain main | **8.4 h** (504 m) | LV254→255 @178 h | LV258 R10 KT17 WS16 M200 | 3.4e10 |
| Fuse grinder | **9.2 h** (550 m) | LV265→266 @184 h | LV266 R10 KT16 WS16 M200 | 3.0e10 |

Worst = **9.2 h (Fuse)**. Every worst-gap is a **level → level** span in the final ~10–70 h,
i.e. once the wins sinks are saturated the reward cadence collapses to a single level-up every
6–9 h. Keeping prestige alive to R20 shortens most gaps (WB 3.8 h, Blitz 3.5 h) but SAT/Fuse/Chain
still hit 5.8–11.2 h final-stretch level gaps — the dead zone is structural, not just a
stop-prestiging artifact.

Reference — the honest lower bound (no rebirth, **Word Sense not bought**,
`rebirthCap 0 nows`): avg earn 1.8e3–4.9e3 wins/min, momentum **never** maxes (reaches 109–130
buys), longest dead stretch **11–12 h** (levels stall because `need()`'s 1.08^n tail outruns a
KT6-capped XP/word, and momentum's ×1.05 rising cost outruns the honest earn rate past ~buy 120).

---

## B. Mode spread — the 1.54× parity holds ONLY at the base; Word Sense re-breaks it

`node claude/winsmin-sim.mjs` (nominal, R0, WS0, ×1 difficulty), reading the live `WINS_MULT`:

| mode | throughput | wins/word | **wins/min** | ×lowest |
|---|---|---|---|---|
| blitz | 14.0 | 44.7 | **625** | 1.00 |
| wordBomb | 8.0 | 89.0 | **712** | 1.14 |
| satRush | 12.0 | 63.7 | **765** | 1.22 |
| fuse | 20.0 | 44.8 | **895** | 1.43 |
| chain | 11.6 | 83.0 | **963** | 1.54 |

**Base spread = 1.54× (Blitz→Chain), within the 2× target — the parity work holds at R0/WS0.**
Note doc drift: `src/progress/wins.js:97-98` still claims "SPREAD 1.43×"; the shipped mults
measure **1.54×** (CLAUDE.md's "~1.54x" is the correct figure).

But the parity is only skin-deep. `WORD SENSE` multiplies a word's **rarity excess** by
2.5^tier (uncapped), so any rarity gap between modes is amplified. SAT Rush's deck is ~all-OBSCURE
(×4.5), the freq-typist modes are ~all-COMMON (×1, WS does nothing). Effective avg earn at R10
(table A): **SAT 3.4e11 vs Blitz 1.2e10 → ~29× spread.** So once the intended late systems stack,
the real between-mode spread is ~29×, not 1.54×.

---

## C. Channel-by-channel reward cadence & dead zones

- **Momentum** (`momentum.js`, the designed "never runs dry" endgame sink): 200 buys, price
  ×1.05 from 5,000 (total ≈ **1.73e9** wins). Designed against ~400 wins/min (`momentum-sim.mjs`
  never maxes it in 200 h). Real compounding maxes it in **1.8 h (SAT) – 8.5 h (Blitz)** with WS+rebirth;
  16–25 h with WS-only. After the cap it is a **dead channel for the remaining 175 h+** — the exact
  window it was built to cover. See HIGH-2.
- **Mastery** (`mastery.js`): M1→M2 = 70 words (<10 min); the top is brutal — masteryNeed(19)
  = **29,882 words** (≈25 h @20/min, ≈62 h @8/min), total to M20 = **104,411 words**. WB main
  (96k words/200 h) never reaches M20. So M18–M20 are 10–60 h apart — a **top-end mastery dead
  zone**. A mono-mode main also never earns the 5 cross-mode `m-*-5` / `JACK OF ALL` / `TRUE
  MASTER` achievements (minMastery stays 1) — intended nudge to mode variety.
- **Collection** (`collection.js`): milestones 100/500/1000/2500/5000 distinct. Freq-typist modes
  blow through all 5 early (20k–28k distinct in-model). **SAT-main caps at its ~600-word deck →
  only reaches the 100 & 500 milestones, never 1000/2500/5000, never `CURATOR`** — a collection
  dead end for the vocab archetype. Inverse: in this model the common-word modes surface ~0
  OBSCURE, so WB/Blitz/Chain/Fuse mains never earn `DEEP CUT`/`LEXICON`/`WALKING DICTIONARY`
  (partly a model limitation — real Word Bomb permits obscure dictionary words the top-rank
  sampler under-produces).
- **Achievements** (`achievements.js`): ~30 total, but volume/level/streak/economy ones fire in
  the first ~50 h; 18–20 are earned by mono-mode players and the set is **silent for the whole
  back half of the run**. Contributes nothing to endgame cadence.
- **Unlock-ladder frames** (`unlockLadder.js`): only LV 3/11/19/27/35, then one per rebirth. All
  five level frames are gone by ~LV35 (early); past that only rebirths grant frames.
- **XP levels**: the workhorse channel, but `need(n)` = 100·1.25^n (n≤60) then ·1.08^(n−60)
  forever. Once Key Power tops out (KT ≈ 25) and rebirth mult stops jumping, the 1.08 tail
  overtakes XP/word → the 6–12 h level gaps in table A.

---

## Findings by severity

### HIGH-1 — WORD SENSE is an uncapped runaway that inflates the whole wins economy *(refutation-tested)*
`wordSense.js` `wordSenseFactor(t)=2.5^t` with **no cap**, applied to rarity excess and folded
into the live wins banking weight (`App.jsx:1125`, outside the ×40 combo cap by design). Tiers:
T5 ×97, T8 ×1.5e3, T16 ×2.3e6, T18 ×1.5e7. One UNCOMMON word (×1.5) at WS16 pays
1 + 0.5·(2.3e6−1) ≈ **×1.19 million**; one OBSCURE word at WS18 ≈ **×5.1e7**.
- **Refutation:** isolated it by disabling WS purchases (`nows`) with rebirth also off — avg earn
  drops from **1.5e8 → 4.1e3 wins/min (~40,000×)**, and momentum goes from "maxed @22 h" to
  "never maxed." So the inflation is WORD SENSE, not rebirth/combo. Also checked it isn't only the
  SAT deck artifact: WB (mostly common, a *few* uncommon draws) still inflates to 1.6e10 wins/min.
  Survives — the ×2.5^tier factor with no ceiling is the mechanism.
- **Impact:** trivializes every wins sink in the back ~180 h (momentum, cosmetics, even the ×6
  Key/WS ladders become minutes apart), and re-breaks mode parity (B, ~29× effective spread).
  Suggest a ceiling on `wordSenseFactor` (or on the combined WS×rarity wins factor), or a cost
  ladder steeper than ×6 so effect can't outrun price.

### HIGH-2 — Momentum, the endgame retention sink, is spent in single-digit hours *(refutation-tested)*
Momentum was added specifically to kill the ~162 h "nothing to buy" dead stretch
(`dead-stretch-report.md`), and its own sim (`momentum-sim.mjs`, flat ~400 wins/min) shows it
lasting all 200 h. Under the real compounded earn rate it **maxes at 1.8–8.5 h** (table A) and is
then inert for 175 h+.
- **Refutation:** turned WS off — momentum then never maxes (reaches ~110–130 buys over 200 h),
  matching the design sim. So the premature exhaustion is caused by HIGH-1's inflation, not by
  momentum's own tuning. The finding is real but **downstream of HIGH-1**: fixing WORD SENSE
  restores momentum's intended lifetime. If HIGH-1 is fixed, re-tune the momentum cap/ratio for the
  true earn band (~2–5e3 wins/min, higher than the 400 it was fit to).

### MEDIUM-1 — Late-game cadence collapses to one level every 6–12 h
Persists in every scenario (R10 6–9 h; R20 up to 11 h; honest baseline 11–12 h). Structural: once
the affordable prestige/tier events run out, `need()`'s permanent 1.08^n growth leaves multi-hour
gaps between level-ups. Consider a gentler top tail, a level-up micro-reward, or content unlocks on
a playtime cadence (option D in `deadstretch-sim.mjs`) to floor the endgame gap.

### MEDIUM-2 — SAT-main collection dead-ends at the deck size (~600 distinct)
Misses 3 of 5 collection milestones and `CURATOR`; the mode whose whole identity is vocabulary is
the one that can't complete the vocabulary collection. Either widen/rotate the SAT deck or scale
the milestones to reachable-per-mode targets.

### MEDIUM-3 — Mastery top levels (M18–M20) are 10–60 h apart; mono-mode misses cross-mode feats
masteryNeed's ×1.4 growth makes the last level a multi-day grind (WB main never reaches M20 in
200 h). Fine as a long chase, but note it is effectively dead cadence at the top.

### LOW-1 — Achievement channel is silent after ~50 h (front-loaded thresholds).
### LOW-2 — Doc drift: `wins.js:97-98` says spread 1.43×; measured 1.54×.
### LOW-3 (PASS) — Base mode spread 1.54× is within the 2× target; the parity work holds at R0/WS0.

---

*No game source modified. Sim added at `claude/econ200h-audit.mjs` (untracked). This report is
untracked by design — not committed.*
