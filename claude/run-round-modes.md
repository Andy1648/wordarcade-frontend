# RUN MODE — round flavours (fix/run-round-modes)

**Branch:** `fix/run-round-modes`, based on `fix/run-deep-pockets` (14c6c28).
**Shipped:** `src/runMode/fragments.js` (new), `useRunMode.js`, `config.js`, `RunMode.jsx`.
**Harness:** `claude/run-skill.mjs` (`roundModeSpread()` + `modes` CLI; FUSE/LONG model).
**Pins:** `fragments.test.js`, `roundModes.test.js`, and the existing `wallSkill.test.js` / `draft1.test.js`.
Reproduce: `node claude/run-skill.mjs modes` · `node claude/run-skill.mjs audit` · `node claude/run-skill.mjs 1000`.

---

## 1. FUSE fragment stream — seeded from the run

`useRunMode.js` re-rolled the fragment after each accepted word with `mulberry32(p.words × <constant>)`,
so from word 2 on every run dealt the **same** fragment sequence. Now a round owns ONE stream on
`playRef` — `mulberry32(roundSeed ^ 0x5f3759df)` (salted so it never shares a stream with the lucky
oracle, which is seeded from the bare round seed) — and both the opening fragment and every re-roll
draw from it. Pinned: different seeds → different sequences; same seed reproduces; the lucky oracle is
undisturbed; every pool fragment has ≥200 containing words in the shipped recall list.

## 2. SAT → LONG

The SAT flavour was a label only (a run round typed plain words; it could not play SAT RUSH's
define-the-word mechanic). Replaced in `config.js ROUND_MODES` by
`{ key:'long', label:'LONG', rule:'Only words of 6+ letters count.', accent:'#9A1AFF' }`, enforced in
`submitWord` (`< 6` letters → `6 LETTERS OR MORE`), with a `6+ LETTERS` chip on the round screen. The
wall preview reads label/rule from config; no other `sat` special-case existed.

## 3. Flavour spread — `node claude/run-skill.mjs modes` (empty stack, round 2 @ wall 120, 8.6 attempts, N=6000, seed 20260906)

| step | chain | fuse | long | max−min |
|---|---|---|---|---|
| before (fuse 0.80/0.82, 13-fragment pool) | 58.5% | **40.1%** | 59.6% | **19.6 pts (FAIL)** |
| pool → 40, fuse 0.90/0.86 (= CHAIN) | 58.5% | 58.5% | 59.6% | 1.2 pts |
| **shipped: pool → 40, fuse 0.85/0.86** | 58.5% | **53.0%** | 59.6% | **6.6 pts (PASS ≤12)** |

FUSE was the outlier, so per the task the fragment pool was widened: **13 → 40** fragments, the 40 most
common 2–3-letter substrings of `src/solo/words.recall.txt` (floor **560 → 1,115** containing words;
`ck` 715 and `ent` 560 are gone).

**Why the sim's FUSE constants moved, and by how much.** The sim's per-flavour `{attemptsMul, accuracy}`
is a hand model of the human — it never read the pool, so widening alone leaves the spread at 19.6.
The re-rate is grounded in the shipped top-3,000 recall vocabulary (the solo modes' "words a player
can recall" set):

| constraint | candidate coverage of the top-3,000 (mean) | floor |
|---|---|---|
| CHAIN — start with the previous word's last letter (re-rolled per word) | 5.4% | — |
| FUSE — old 13-fragment pool (re-rolled per word) | 6.7% | 1.3% (`ck`) |
| FUSE — new 40-fragment pool (re-rolled per word) | 5.4% | 2.7% |
| LONG — 6+ letters | 57.8% | — |

Same coverage, same per-word re-roll → FUSE's **accuracy matches CHAIN (0.86)**. Its **attemptsMul keeps a
small penalty (0.85 vs CHAIN's 0.90)** because scanning for a substring is slower than recalling a
first letter — the 0.85/0.86 point (spread 6.6) rather than full parity (0.90/0.86, spread 1.2).
Alternatives measured: 0.85/0.84 → fuse 49.4%, spread 10.2.

## 4. Knock-on pins (the flavour model feeds every sim) — all PASS at fuse 0.85/0.86

**Wall-2 sweep** — `node claude/run-skill.mjs 1000` (N=1000/strategy/skill, seed 20260906, acc 0.93):

| attempts | round-1 death | mean round | GREEDY | BALANCED | RISK-AV | RANDOM | GREEDY−RANDOM | top card in winners |
|---|---|---|---|---|---|---|---|---|
| 5.4 | 36.1% | 2.04 | 0.0% | 0.0% | 0.0% | 0.0% | +0.0 | (none) |
| 8.6 | **14.3%** | **2.92** | 0.1% | 0.0% | 0.0% | 0.0% | +0.1 | double-vowels |
| 14 | 0.2% | 5.41 | 3.5% | 0.9% | 0.0% | 0.0% | +3.5 | glass-cannon 93.2% |
| 20 | 0.0% | 7.55 | 24.6% | 12.8% | 2.3% | **14.3%** | **+10.3** | glass-cannon 75.9% |

Pins: @8.6 round-1 death 14.3 ≤ 25 ✅ · mean round 2.92 ≥ 2.5 ✅ · @20 RANDOM 14.3 in 10–30 ✅ ·
GREEDY−RANDOM +10.3 ≥ 5 ✅.

**Draft-1 audit** — `node claude/run-skill.mjs audit` (8.6 attempts, N=4000, seed 777; empty stack
clears R2 58.4%, reaches R4 13.8%):

| card (alone) | P(clear R2) | Δ | P(reach R4) | Δ |
|---|---|---|---|---|
| vowel-movement | 91.0% | +32.6 | 55.0% | **+41.3** (max, ≤45 ✅) |
| glass-cannon | 81.0% | +22.5 | 46.0% | +32.2 |
| short-fuse | 86.0% | +27.5 | 40.2% | +26.4 |
| bookworm | 79.8% | +21.4 | 35.4% | +21.6 |
| double-vowels | 76.2% | +17.8 | 34.3% | +20.5 |
| long-haul | 75.2% | +16.8 | 29.9% | +16.1 |
| rare-breed | 67.0% | +8.6 | 29.9% | +16.1 |
| **deep-pockets** | 73.4% | +15.0 | 29.7% | **+15.9** (in [+8,+25] ✅) |
| lucky-charm | 67.2% | +8.8 | 29.1% | +15.4 |
| lexicographer | 59.8% | +1.4 | 29.1% | +15.3 |
| combo-king | 69.9% | +11.5 | 27.6% | +13.8 |
| common-folk | 71.2% | +12.8 | 26.4% | +12.6 |
| momentum | 63.5% | +5.1 | 25.3% | +11.5 |
| scrabble-bag | 64.0% | +5.6 | 22.3% | +8.5 |
| hot-streak | 60.2% | +1.8 | 18.1% | +4.3 |
| jackpot | 58.3% | −0.1 | 15.6% | +1.8 |
| uncapped | 57.9% | −0.5 | 14.9% | +1.1 |
| snowball | 34.2% | −24.3 | 5.5% | **−8.3** (min, ≥−10 ✅) |

Note: `claude/run-balance.mjs` (the T1–T3 harness) still carries the pre-change SAT/FUSE flavour model;
it was not part of this task and is untouched.

## 5. Gates

lint 0 errors · `npm test` 516/516 · `vite build` exit 0 · `e2e/run-mode.spec.js` 2/2. Not merged.
