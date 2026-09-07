# RUN MODE — deck finish (fix/run-deck-2)

**Branch:** `fix/run-deck-2`, based on `origin/fix/run-balance` (the validated rebalance that
already fixed the deck bugs and met all three balance targets). This branch adds ONE new
requirement — two-side the last boring pure-upside cards — then re-confirms balance.

**Shipped change:** `src/runMode/engine.js` (+ `engine.test.js`, `modifiers.test.js`).
**Harness (report-only):** `claude/run-balance.mjs` (META fidelity re-rate for the two changed cards).
Reproduce: `node claude/run-balance.mjs 2000` (2000/strategy; ends with a TARGETS block).

---

## 1. Confirmation checklist — what fix/run-balance already had in place (all TRUE)

Verified against the code before changing anything:

| claim | verdict | evidence |
|---|---|---|
| SNOWBALL ramp uses `clean`, not hardcoded-0 `owned` | ✅ TRUE | `roundIdx: (p,c)=>p*min(1.25,0.65+0.16*c.clean)`; `owned` appears nowhere in engine/hook |
| HOT STREAK not strictly dominated (cap reachable) | ✅ TRUE | comboStart 0.6/step 0.25/cap 4.0; 0.6+0.25·15=4.35 ≥ 4.0 |
| UNCAPPED not dominated (cap removal load-bearing) | ✅ TRUE | `cap=Infinity`, luckyMult 18; test asserts a lucky OBSCURE word exceeds the old ×40 cap |
| RARE BREED not dominated + text==effect | ✅ TRUE* | text "RARE ×3 & OBSCURE ×8, COMMON ×0.85" matches code exactly; beats empty stack on OBSCURE |
| `wprMul` wired (round length) | ✅ TRUE | SHORT FUSE `k.wprMul*=0.8`; read live in `useRunMode.js:120` (`timeLeft = 30·wprMul`) |
| `luckyOdds` wired (lucky oracle) | ✅ TRUE | LUCKY CHARM/JACKPOT/UNCAPPED set it; `makeLuckyOracle(seed, knobs.luckyOdds)` at `useRunMode.js:127` |
| every card's text matches its effect | ✅ TRUE | 18/18 per-modifier tests in `modifiers.test.js` pass |
| N=2000 targets met (27.4% / 58.2% / within 10pts) | ✅ TRUE | re-ran baseline: RANDOM 27.4%, snowball 58.2%, BALANCED 26.6 & GREEDY 25.8 = 0.8pts — matches the report exactly |

\* NOTE on RARE BREED "(×6)": the task summary said "RARE BREED text==effect (×6)". The audit
*proposed* ×6; the shipped fix/run-balance card actually landed at **OBSCURE ×8 / RARE ×3**, and
its text says exactly that. So text==effect holds — just at ×8, not the audit's ×6. Not touched.

**All 8 pre-existing claims confirmed true.** Nothing on fix/run-balance needed correcting.

---

## 2. The three "boring" cards (audit-flagged: flat +N / no downside)

| card | state on fix/run-balance | action |
|---|---|---|
| **MOMENTUM** | ALREADY two-sided (`×0.9` every word + capped `×min(1.35,1+0.18·clean)`) | **left as-is** — the rebalance already made it interesting; churning it would be pointless |
| **DEEP POCKETS** | STILL boring — flat `+60`/round, `down:false` | **two-sided** (see below) |
| **SCRABBLE BAG** | STILL boring — free `×2.6` on J/Q/X/Z, `down:false` | **two-sided** (see below) |

### DEEP POCKETS — floor-raiser with a ceiling cost (adapts the audit's "give it a real cost")
- **Before:** `+60 flat wins per round` — no downside, self-nerfs vs the wall.
- **After:** `text: '+120 flat wins per round, but every word ×0.85'`, `down:true`
  `word:(w,m)=>m*0.85, round:(p)=>p+120`
- **Why it's a real trade-off:** the `+120` flat lifts LOW rounds the most (a survival aid on the
  rounds you actually die on); the `×0.85` per word trims HIGH rounds. Break-even ≈ 800 raw — below
  it you gain, above it you lose. A genuine floor-vs-ceiling decision, not free wins.

### SCRABBLE BAG — rare-letter build-around (adapts the audit's "give it a real cost")
- **Before:** `×2.6` on J/Q/X/Z (~8% of words) — pure free +EV.
- **After:** `text: 'J/Q/X/Z words ×4, but every other word ×0.9'`, `down:true`
  `word:(w,m)=>(w.rare ? m*4 : m*0.9)`
- **Why it's a real trade-off:** a big `×4` on the ~8% rare-letter words, paid for with a `×0.9`
  cost on the other ~92%. It's a conditional bet (great with rare-letter luck / rare boosters,
  a floor-lowerer in a bad round) with a real anti-synergy against VOWEL MOVEMENT (which also
  touches the rare-letter axis). Now a build decision, not an auto-include.

**All 18 cards are now `down:true`** (was 16). The `engine.test.js` "16 carry a downside" pin was
updated to assert 18 down / 0 pure-upside (deliberately invalidated — noted in the test).

### One consequential retune: SNOWBALL
Two-siding DEEP POCKETS and SCRABBLE BAG removed the winner-dilution those two free-upside "safe"
cards had provided. That pushed **SNOWBALL** — a survivor-biased survival scaler that is always
over-represented in winners — from 58.2% to **61.6% of winners (T2 FAIL)**. Per the task ("re-tune
until BOTH targets hold again"), SNOWBALL was shaved from `×0.65 / +0.16 / cap 1.25` to
`×0.62 / +0.14 / cap 1.15`. It remains a healthy pick (53.3% of winners, 23.1% draft rate, 2.31×
lift) — not dead, just no longer the marginal over-60 card. Its `modifiers.test.js` pins were
updated (620 / 900 / 1150). The harness `META` safety ratings for the two changed cards were also
re-rated for fidelity (deep-pockets 10→8, scrabble-bag economy/6→offense/4) so the drafters
perceive the shipped two-sided cards, not the retired free-upside ones — sim fidelity, not a
target change.

---

## 3. Balance — N=2000, before vs after (default seed 20260906, LIVE model)

**BEFORE (fix/run-balance baseline):**

| strategy | win rate |     | top modifiers in winners |
|---|---|---|---|
| RANDOM | 27.5% |     | snowball **58.2%** |
| BALANCED | 26.6% |     | scrabble-bag 55.4, rare-breed 55.0 |
| GREEDY | 25.8% |     | short-fuse 55.0, deep-pockets 54.7 |
| RISK-AVERSE | 19.6% |     | double-vowels 54.5 … long-haul 19.4 |

- T1 best 27.4% ≤35 ✅ · T2 snowball 58.2% ≤60 ✅ · T3 BALANCED/GREEDY 0.8pts ✅

**AFTER (fix/run-deck-2):**

| strategy | win rate |     | top modifiers in winners |
|---|---|---|---|
| RANDOM | 25.9% |     | short-fuse **58.1%** |
| BALANCED | 25.1% |     | momentum 57.6, rare-breed 55.8 |
| GREEDY | 24.3% |     | combo-king 55.5, double-vowels 55.3 |
| RISK-AVERSE | 18.8% |     | bookworm 54.5 … snowball 53.3 … scrabble-bag 34.6 … long-haul 22.0 |

- **T1** best strategy RANDOM **25.9% ≤ 35** ✅
- **T2** top modifier **short-fuse 58.1% ≤ 60** ✅ (smooth 58→22 curve, no spike; no card >60%)
- **T3** closest pair **BALANCED 25.1 & GREEDY 24.3 = 0.8pts ≤ 10** ✅
- Sanity — best 25.9% ∈ [15,45] ✅

### Robustness — N=2000 across 4 seeds, both models
Every seed passes all three. The top card floats between short-fuse / momentum / snowball at
57–59% (no single auto-include):

| seed | best strategy | top modifier | closest pair |
|---|---|---|---|
| 20260906 | RANDOM 25.9 | short-fuse 58.1 | 0.7 |
| 12345 | RANDOM 25.6 | momentum 59.2 | 0.6 |
| 77 | RANDOM 26.4 | momentum 58.9 | 1.3 |
| 999 | RANDOM 24.9 | short-fuse 57.1 | 0.4 |
| DESIGNED (all knobs) | RANDOM 25.9 | short-fuse 58.1 | 0.7 |

---

## 4. Gate
- `npm run lint` → **0 errors** (32 pre-existing warnings, none in touched files).
- `node --test "src/**/*.test.js"` → **505 pass / 0 fail**. Deliberately-updated pinned numbers:
  `engine.test.js` (DEEP POCKETS +60→+120 = 1120; down-count 16→18), `modifiers.test.js`
  (DEEP POCKETS +120/×0.85; SCRABBLE BAG ×4/×0.9; SNOWBALL 620/900/1150). Each is annotated in-file.
- `npx vite build` → **exit 0**.
