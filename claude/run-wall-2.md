# RUN MODE — wall retune for real skill (fix/run-wall-2)

**Branch:** `fix/run-wall-2`, based on `origin/fix/run-deck-2` (377c152 — the finished two-sided deck).
**Shipped change:** `src/runMode/engine.js` `WALL` only. The deck is UNTOUCHED.
**Harness (report-only):** `claude/run-skill.mjs` (new — skill sweep; a restructured copy of
`claude/run-balance.mjs` exposing `simulate()` with no side effects on import).
**Pins:** `src/runMode/engine.test.js` (schedule) + `src/runMode/wallSkill.test.js` (skill acceptance).
Reproduce: `node claude/run-skill.mjs 1000` · `node claude/run-balance.mjs 2000`.

---

## 1. The change

```
WALL = { W0: 80, g1: 1.5, g2: 1.3, KNEE: 5 }        (was { W0: 225, g1: 1.2, g2: 1.08, KNEE: 5 })
schedule:  80, 120, 180, 270, 405, 527, 684, 890, 1157, 1504
   (was:  225, 270, 324, 389, 467, 504, 544, 588, 635, 686)
```

Why: fix/run-balance calibrated W0=225 to the engine's 16-perfect-words round. A real 30-second
human lands ~8-9 words, so casual players died on the EMPTY-stack round 1 and never saw a draft.
The new curve starts low enough that a casual round clears it, ramps steeply through the draft
rounds (the cards must carry you by mid-run), and keeps climbing in the endgame so a strong
player still needs a real stack.

## 2. Skill sweep — `node claude/run-skill.mjs 1000` (N=1000/strategy/skill, seed 20260906, accuracy 0.93)

| attempts | round-1 death | mean round | GREEDY | BALANCED | RISK-AV | RANDOM | GREEDY−RANDOM | top modifier in winners |
|---|---|---|---|---|---|---|---|---|
| 5.4 | 40.0% | 2.00 | 0.0% | 0.0% | 0.0% | 0.0% | +0.0 | (none) |
| 8.6 | **17.8%** | **2.86** | 0.0% | 0.0% | 0.0% | 0.0% | +0.0 | (none) |
| 14 | 0.9% | 5.32 | 2.7% | 1.3% | 0.0% | 1.2% | +1.5 | glass-cannon 84.6% |
| 20 | 0.0% | 7.40 | 21.6% | 12.6% | 2.2% | **12.8%** | **+8.8** | glass-cannon 74.0% |

Death-round histogram (pooled over the 4 drafters; C = cleared):

```
attempts      1    2    3    4    5    6    7    8    9   10      C
     5.4   1600 1360  618  306   91   21    2    2    0    0      0
     8.6    712 1161  925  637  389  122   35   15    4    0      0
      14     36  149  437  748  948  719  466  244  146   55     52
      20      0   38   97  205  429  567  655  636  540  341    492
```

**Acceptance (pinned in `wallSkill.test.js`, all PASS):**
- @8.6 round-1 death 17.8% ≤ 25 ✅ · mean round 2.86 ≥ 2.5 ✅ (casual players reach a draft)
- @20 RANDOM win 12.8% in 10–30 ✅ · GREEDY − RANDOM 8.8 pts ≥ 5 ✅ (drafting is a decision)

Reading: the casual player (8.6) now dies on rounds 2-4 — AFTER one to three drafts — instead of on
round 1. Nobody wins at ≤8.6 attempts (correct: the run is a 10-round gauntlet, not a participation
prize). The 14-attempt player reaches round 5 on average and wins ~1-3%: the endgame belongs to the
strong player, who clears it 13-22% of the time depending on how well they draft.

## 3. TARGETS block — `node claude/run-balance.mjs 2000` (N=2000/strategy, seed 20260906, 20 attempts)

```
--- 1. WIN RATE (out of 2000) ---
  GREEDY       429/2000  (21.4%)   mean round reached 7.49   mean cumulative 13252
  BALANCED     250/2000  (12.5%)   mean round reached 7.34   mean cumulative 7082
  RISK-AVERSE   44/2000  (2.2%)    mean round reached 7.13   mean cumulative 4675
  RANDOM       256/2000  (12.8%)   mean round reached 7.56   mean cumulative 6820

--- 4. DOMINANCE IN WINNING RUNS (winRate / allRate / lift) ---
  winning runs: 979
    glass-cannon     76.0% /  38.7%  lift 1.96x
    rare-breed       68.6% /  44.8%  lift 1.53x
    double-vowels    65.4% /  35.3%  lift 1.85x
    short-fuse       63.6% /  32.8%  lift 1.94x
    snowball         59.9% /  30.9%  lift 1.94x
    momentum         59.0% /  35.3%  lift 1.67x

--- 5. TARGETS (fix/run-balance) ---
  T1 best strategy <=35%: GREEDY 21.4%  -> PASS
  T2 top modifier <=60% of winners: glass-cannon 76.0%  -> FAIL   over60: double-vowels 65.4%, short-fuse 63.6%, glass-cannon 76.0%, rare-breed 68.6%
  T3 two strategies within 10pts: RANDOM(12.8) & BALANCED(12.5) = 0.3pts  -> PASS
  SANITY best in 15-45%: 21.4%  -> PASS
  ==> ALL THREE FAIL
```

(sudden-death fumbles pooled: 1087 of 8000 runs — GLASS CANNON's 8%/round is a real cost, and it
still wins.)

## 4. Why T2 fails, and why the deck is left alone

T2 ("no modifier in >60% of winning runs" — **no card necessary**) and the new acceptance
("GREEDY − RANDOM ≥ 5 pts" — **choice matters**) pull the wall's late slope in opposite directions:

- **Flat endgame** (fix/run-balance, g2=1.08, 504→686): almost any stack clears the last rounds, so no
  card is necessary (T2 passed at snowball 58%) — but for the same reason no card is *decisive*:
  GREEDY and BALANCED landed within ~1 pt and RANDOM cleared 27%. And the price of a plateau that
  low was W0=225, which killed casual players on round 1.
- **Climbing endgame** (this branch, g2=1.3, → 1504): the last three walls are only reachable with
  a strongly multiplicative stack, so *which* cards you draft decides the run (GREEDY +8.8 over
  RANDOM; RISK-AVERSE, drafting the "safe" floor cards, wins 2.2%). The flip side is that the
  winners' hands converge on the biggest multipliers — GLASS CANNON's flat ×1.55 on every round is
  the cheapest way to close a 1157/1504 gap without compounding — so it sits in 76% of winners
  (and RARE BREED / DOUBLE VOWELS / SHORT FUSE all clear 60% too).

One wall cannot satisfy both with this deck: a slope steep enough to make choice matter is a slope
steep enough to make the best multipliers near-mandatory. fix/run-wall-2 deliberately buys
*reach-a-draft* (§2 casual numbers) and *choice-matters* at the cost of T2. T1 / T3 / SANITY still
pass, so the mode is not solved by one strategy and the win band is right.

If T2 is wanted back, the lever is the **deck**, not the wall — e.g. trim GLASS CANNON's ×1.55 or
raise its fumble above 8%, and lift the ceilings of the defensive cards so RISK-AVERSE can reach
1504 — and that is out of scope here by instruction. The deck is byte-identical to fix/run-deck-2.

(Note: the task referenced `run-wall-findings.md` for this tension; that file is not on any branch
or worktree in the repo, so the reasoning above is reconstructed from the numbers.)

## 5. Gates

lint 0 errors · `npm test` green (incl. the new `wallSkill.test.js`, ~9s) · `vite build` exit 0.
Not merged.

## post-LONG — TARGETS block on the shared player model (chore/sim-align, 2026-09-08)

`node claude/run-balance.mjs 2000` (N=2000/strategy, seed 20260906, 20 attempts, LIVE model) on
`integration/run-stack-2`. **Both harnesses now share ONE player model:** `run-balance.mjs` imports
`ROUND_MODES` from `src/runMode/config.js` (chain / fuse / long) and the per-flavour human
constants from `run-skill.mjs` `MODE_SKILL` (chain 0.90/0.86 · fuse 0.85/0.86 · long 0.85/0.90).
Until this run, run-balance still carried its own stale copy — SAT 0.88/0.88 (a flavour that no
longer exists; LONG replaced it on fix/run-round-modes) and FUSE at the pre-fragments 0.80/0.82 —
so §3 above and the skill sweep in §2 were modelling two different players. Numbers are
commit-independent: the harness is a pure function of the shipped engine + this model.

```
--- 1. WIN RATE (out of 2000) ---
  GREEDY       519/2000  (25.9%)   mean round reached 7.75   mean cumulative 15836
  BALANCED     279/2000  (14.0%)   mean round reached 7.58   mean cumulative 7969
  RISK-AVERSE   46/2000  (2.3%)    mean round reached 7.18   mean cumulative 4745
  RANDOM       285/2000  (14.2%)   mean round reached 7.74   mean cumulative 7408

--- 4. DOMINANCE IN WINNING RUNS (winRate / allRate / lift) ---
  winning runs: 1129
    glass-cannon     77.2% /  40.9%  lift 1.89x
    rare-breed       70.5% /  45.8%  lift 1.54x
    double-vowels    65.0% /  34.2%  lift 1.90x
    short-fuse       64.8% /  33.4%  lift 1.94x
    snowball         59.4% /  31.4%  lift 1.89x
    lexicographer    58.5% /  40.5%  lift 1.44x

--- 5. TARGETS (fix/run-balance) ---
  T1 best strategy <=35%: GREEDY 25.9%  -> PASS
  T2 top modifier <=60% of winners: glass-cannon 77.2%  -> FAIL   over60: double-vowels 65.0%, short-fuse 64.8%, glass-cannon 77.2%, rare-breed 70.5%
  T3 two strategies within 10pts: RANDOM(14.3) & BALANCED(13.9) = 0.3pts  -> PASS
  SANITY best in 15-45%: 25.9%  -> PASS
  ==> ALL THREE FAIL
```

Same shape as §3 (T1/T3/SANITY pass, T2 fails on GLASS CANNON), a little easier: the stale
SAT/FUSE hand rated the flavours harsher than the shipped LONG/FUSE, so the strong player now
wins 25.9% (GREEDY) vs 21.1% under the old constants on the same commit, and every drafter gains
~2–3 pts. The last old-model run on this commit, for the record: GREEDY 21.1 · BALANCED 10.3 ·
RISK-AVERSE 1.2 · RANDOM 11.1; top modifier glass-cannon 78.4%. The skill sweep (§2 acceptance,
`wallSkill.test.js`) and the round-mode spread (chain 58.8 / fuse 53.6 / long 60.5, spread 6.9
≤ 12) are byte-identical to before — `run-skill.mjs` only exports what it already used.
