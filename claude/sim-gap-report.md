# JOB 6 — Simulation coverage gap audit (REPORT ONLY)

Date: 2026-09-01 · Branch: chore/sim-gap (off main) · No code changed.

Question: the repo ships 10 economy sims (`claude/*-sim.mjs`). Given the economy that
actually ships in `src/progress/*`, **what does no sim exercise — and which gaps could hide a
live balance bug?** Coverage inventory below; gaps ranked by risk.

## WHAT THE SIMS COVER (one line each)
All import the real `src/progress/*` modules (only `stack-sim` mirrors constants).
- **winsmin-sim** — core balance: WINS/MIN per mode @ R0, equal difficulty, combo+lucky as a flat
  E[×]=1.1. ASSERTS mode-spread ≤2× and degenerate-spam ≤1.5×. (pass/fail)
- **momentum-sim** — 5 single-mode mains × 200h with BOTH sinks (KEY POWER + MOMENTUM) live.
  ASSERTS every archetype's longest dead-stretch <15h. (pass/fail)
- **archetype200h-sim / deadstretch-sim** — the same 5 mains vs the tier ladder; sweep
  TIER_COST_STEP and 4 candidate dead-stretch fixes. Descriptive (dead-stretch length).
- **econ6-sim** — letters-to-first-rebirth + FUSE-runs-per-tier at R0/R5/R10. Descriptive.
- **stack-sim** — full rarity×combo×lucky per-word stack, **FUSE only**, R0/R10, 40k words. Sanity band.
- **rarity-sim** — rarity-band distribution of accepted words per mode; wins/run shift. Descriptive.
- **mastery-sim / unified-xp-sim / wordsense-sim** — MASTERY curve, unified-XP words-to-level
  (no upgrades), and WORD SENSE "never runs dry" (abstract doubling-income curve). Descriptive.

## THE GAPS — ranked by balance risk

**1 · HIGH — Difficulty multiplier is never swept.** `DIFFICULTY_MULT` ships (WB/Blitz HELL = ×2
wins), but every sim assumes ×1 (winsmin says so explicitly). So the one shipped knob that can most
plausibly break the **≤2× mode-spread** target is the one thing the spread assert never sees: a
HELL-difficulty WB main earns ×2, and WB already carries the top `WINS_MULT` (2). Nobody has proven
that combination stays inside the balance band. **Highest-value missing test.**

**2 · HIGH — Rebirth is never simulated end-to-end.** Sims only snapshot fixed rebirth counts
(econ6 R0/R5/R10, stack R0/R10). No sim runs the actual loop — reset to LV1, re-climb, rebirth,
repeat — so the exploding `rebirthMult` (up to ×1e11) is never fed through a real play trajectory.
The dead-stretch and MOMENTUM "<15h" conclusions both run at R0-flavored rates; whether the sink
pacing holds for a heavy rebirther is untested. The balance guarantees are effectively R0-only.

**3 · MED — Combo/lucky earn DYNAMICS exist only for FUSE.** `stack-sim` models the real
rarity×combo×lucky distribution for FUSE alone. `winsmin` collapses combo+lucky to a flat 1.1
constant with no combo-reset or lucky-variance behavior, applied uniformly to every mode. So the
combo-streak/miss and lucky-spike dynamics on **WB/Blitz/SAT/CHAIN** earn rates are unmodeled — and
those are exactly the per-mode differences the ≤2× assert is supposed to police.

**4 · MED — KEY POWER is simulated as a price ladder, never as what it is: an XP accelerator.**
Its real effect (`keyTierXp` = XP-per-letter) on level/rebirth pacing is modeled nowhere but econ6's
single base-rate line. Every archetype/dead-stretch/momentum sim treats it purely as a wins sink, so
its actual job — speeding leveling, hence rebirth cadence, hence the whole earn curve — is untested.

**5 · MED — WORD SENSE's "never runs dry" rests on a stylized curve, not the shipped earn engine.**
`wordsense-sim` uses an abstract "income doubles every N hours" model instead of the real
rarity-excess-per-word math (which stack-sim already implements for FUSE). The conclusion may be
right, but it isn't grounded in the actual per-word earn.

**6 · LOW-MED — Leveling upgrades are never folded into the leveling loop.** `unified-xp-sim` runs
"no upgrades"; the equipped pop/sound `xpMult` (up to ~×1.25) and the Mastery XP perk (up to +57% at
M20) never feed back into level/rebirth pacing, so words-to-level is a floor, not the lived rate.

**7 · LOW — Three wins sources are simulated by nobody:** Collection milestone payouts
(`collection.js grantWins`), the Return bonus (`returnBonus.js`), and the daily-streak XP multiplier
(`streak.js`; unified-xp hardcodes streakMult=1). Small individually; unaudited in aggregate.

**8 · LOW — Archetype coverage is narrow.** Every sim's player is a single-mode "main" at a fixed
wpm. No mixed/multi-mode player, no casual short-session player, no never-rebirth vs heavy-rebirther
split, no whole-economy degenerate optimizer (winsmin's degenerate check is earn-parity only, not
sink pacing).

## RECOMMENDATION (what to build, in order)
1. Extend **winsmin-sim** with a `DIFFICULTY_MULT` sweep → re-assert the ≤2× spread under HELL
   (closes Gap 1, ~1 file, reuses the existing assert). Do this first — it's cheap and it guards a
   shipped knob.
2. A new **rebirth-loop sim**: play→level→rebirth→repeat over 200h, tracking wins-earn and both
   sinks across R0→R10+ (closes Gap 2, partially 4). This is the real missing sim.
3. Generalize combo/lucky from FUSE-only to all modes in winsmin (Gap 3).

Gaps 5–8 are report-worthy but low-risk; leave them logged unless a balance complaint points at one.

## BOTTOM LINE
The sims robustly cover **R0, ×1-difficulty, single-mode earn parity and sink dead-stretch** — and
that's genuinely the core. The two things the balance guarantees do NOT yet cover are **HELL
difficulty** and **the rebirth loop**, both shipped, both plausible spread-breakers. Neither is a
known bug — this is a coverage report, not a defect report — but they are where I'd look first if
mode balance ever feels off in the wild.
