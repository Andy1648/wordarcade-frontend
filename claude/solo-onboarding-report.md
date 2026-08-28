# JOB 14 — CHAIN & FUSE ONBOARDING (feat/solo-onboarding)

Both modes unlock late (CHAIN LV20, FUSE LV25), so a player meets them hours in with non-obvious
rules. The job said "verify what shipped against `claude/chain-fuse-spec.md` section 5."

**Build note:** `claude/chain-fuse-spec.md` is **absent from main** (like Job 3's records.js — it
lived on an unmerged branch / prior scratch). So I audited the two modes against each other and the
shipped teaching infrastructure, and filled the asymmetry.

## Gap audit (before)
The spec's three teaching beats — the **ARM state**, a **worked example**, and a **first-run death
card** — were audited on each mode:

| Teaching beat | CHAIN | FUSE (before) |
|---------------|-------|---------------|
| ARM hint (shown before the clock arms) | ✓ "EVERY WORD STARTS WITH THE LAST LETTER…" | ✓ "TYPE ANY WORD THAT CONTAINS THE PIECE" |
| Worked example | ✓ in `ChainFirstRunCard` (E → EAGLE → ELEPHANT → …) | **✗ none anywhere** |
| First-run tutorial death card (run 1 or sub-3-word runs) | ✓ `ChainFirstRunCard` + `bare` (no score line) + "PLAY AGAIN" | **✗ always the plain "OUT OF FUSES" score card** |

So CHAIN was fully taught; **FUSE was missing the worked example AND the first-run tutorial card** —
a player's first-ever FUSE run just showed a score with no explanation of the mechanic.

## Implemented (after)
- **`fuseCards.jsx`** — `FuseFirstRunCard` (mirrors `ChainFirstRunCard`): the rule + a **worked
  example `ARM → CHARM · ALARM · FARMER`** with the fragment highlighted in the mode accent + the goal
  "FIRST TRY. GET 3 WORDS."; plus `FuseNormalCard` (the old score card, unchanged).
- **FUSE run counter** (`getFuseRuns`/`bumpFuseRuns` in shared.js, parallel to CHAIN's) so the
  tutorial card shows on **run 1 OR any run under 3 words**, exactly like CHAIN.
- **FuseGame** wires it: `firstRun ? FuseFirstRunCard : FuseNormalCard`, with `bare: firstRun` (no
  SCORE/BEST line on the tutorial) and `restartLabel: 'PLAY AGAIN'`.

Verified in-browser (drove a fast FUSE death): the tutorial card shows the rule, the highlighted
worked example, the goal, and "PLAY AGAIN · ENTER" with no score line, zero errors.

## Result
CHAIN and FUSE now have **symmetric first-run teaching**: ARM hint + worked example + first-run
tutorial death card in both. Full suite 352 green; build clean.
