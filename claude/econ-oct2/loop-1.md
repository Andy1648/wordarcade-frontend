# Fine-tune loop 1 — progression sim (Oct 2 evening)

Sim: `claude/econ-oct2/loop-sim.mjs`. Real modules (xp, wins, frenzy, marks, shop, stars/rebirth, boost, achievements, claims, codes incl. per_level + BOOST). Bots: casual / median / strong, from a FRESH LV1 save through 10 min, 1 h, 5 h and 20 h. Consoles: `loop-sim-console.txt` (before), `loop-sim-fix1-console.txt` (after).

## Criteria — before → after the fix

| criterion | casual | median | strong |
|---|---|---|---|
| gap ≤45 s / 3 / 8 / 12 min (10 m / 1 h / 5 h / 20 h) | PASS (0.67 / 0.83 / 3.83 / 5.33 m) → PASS | PASS → PASS | PASS → PASS |
| **runaway** (no single reward > ~3 levels' worth) | **FAIL 3 lumps → PASS 0** | **FAIL 3 → PASS 0** | **FAIL 2 → PASS 0** |
| worst lump | PAPER CHASE = 7.9 min of play → biggest is now a 2.8 min mastery milestone | WALKING DICTIONARY = 4.8e19 wins (**633,000 min of play**) → 0.9 min rank-up | WALKING DICTIONARY 1.1e20 (106,000 min) → under 3 min |
| no wall: next KEY tier ≤15 min | FAIL (eta 14.9–35 m) → FAIL (14.7–35 m) | FAIL (eta **1,833 m** at 20 h) → FAIL (23–40 m) | FAIL (eta 1,071 m at 5 h) → FAIL (17–107 m) |
| next shop item ≤15 min | 1 h+ PASS | PASS | PASS |
| formatNum to 1e300, no NaN/∞/raw | PASS | PASS | PASS |
| new mechanics reached by 1 h / 5 h | FRENZY, BOOST (code), marks, rebirth, weekly board: all fire inside the first hour for every skill | | |

## Fix shipped (loop 1) — the worst violation: runaway rewards
- **Cause:** `achievementPayout` scaled a fixed base by rebirth × 1.015^level. That geometric curve drifts away from what a word actually pays: at LV850 a secret paid 4.8e19 wins. The lump also auto-bought KEY tiers T19–T22 at once, which created the 20 h KEY wall for the median bot (eta 1,833 min).
- **Fix:** an achievement pays **N words at the live per-word rate**, with N = 6–25 by catalogue rarity (`achievementWords`). The Achievements screen now quotes the same figure (`achievementPayout`); it used to show `rebirthScaledWins(base)`, which isn't what a secret paid. The mastery milestone is a flat 30 words; it used to grow ×level/5 and reach 7 minutes of play by M15.

## Still failing → loop 2
- **KEY wall:** the next tier is 15–40 min away from 1 h on (and 100+ min for the strong bot at 5 h). That's the v8 ladder (×6 price vs ×2.5 XP per tier) Andy restored in KP2. The price outgrows income ×2.4 per tier, and KP2's own report flagged walls at T10/T20.
