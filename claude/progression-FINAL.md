# TYPE A WORD — PROGRESSION FINAL v2 (Oct 6 2026, 22:30 ET) — FROZEN

Andy 22:20: "the first progression was better — we're just adding new perks." So: Rebirth Rush (Oct 3) curve + rebirth gate, rebirth worth ×3 (not ×5), mashing COUNTS (brainless typing is the game), no ×1000 scale, no ascension for now; gems / rolls / marks / OVERDRIVE are the new perks. Only constants change later (±20% after the CI sim).

## Numbers
| piece | rule |
|---|---|
| XP needed | need(n) = 100 × 1.15^(n−1) — one curve for everyone |
| XP / letter | 10 × KEY × 3^R × MARK × OVERDRIVE. Game letters ×1, menu letters ×0.2 — ANY keys count (mashing is the point). Only guard: >20 keys/s (autoclicker) earns 0 |
| WINS / word | 10 × length/5 × MODE × 3^R × MARK × OVERDRIVE (games only). MODE: WB/Blitz ×1 · RACE ×1.5 · CHAIN ×2 · SAT ×5 · FUSE ×1 + FRENZY ×5 |
| POWER (KEY ladder) | ×1, ×2, ×5, ×10, ×25, ×50, ×100, ×250, ×500, ×1000, then ×2.15 per tier. Tier T→T+1 costs 150 × 5^T wins. KEPT through rebirth (Andy hated the reset; sim shows no snowball) |
| REBIRTH | at LV 15 + 18·R (R1 LV15, R2 LV33, R5 LV105, R10 LV195) → LV 1. ×3 XP & wins per rebirth forever. Server-checked lb_rebirth, ≤12/hour |
| AUTO REBIRTH | toggle at R2 (still one server call each) |
| OVERDRIVE | ×10 XP & wins for 5 min, random every 30–60 min of GAME play, edge timer |
| GEMS | games only: drop 1 in 15 game words for 3–12 · bot win +18 · MP +15 per player beaten · streak +4 · achievements 40–200 |
| ROLLS / MARKS | 75 gems. COMMON 1/2 ×1.1 · RARE 1/10 ×1.25 · EPIC 1/100 ×1.5 · LEGENDARY 1/1,000 ×2 · MYTHIC 1/10,000 ×3 · SECRET 1/100,000 ×5. Pity EPIC+ 50, LEGENDARY+ 500. AUTO ROLL at R1, 2nd MARK slot R5, LUCK ×1.25 R7 |
| ASCENSION | none for now (hidden) |
| Numbers | formatNum, no caps, no artificial ×1000 |

## Sim (no marks/overdrive; 10 h)
| | R1 | R3 | R5 | 10 h end |
|---|---|---|---|---|
| casual | 6 min | 39 min | 2.4 h | R7 |
| median | 3 min | 21 min | 77 min | R8 |
| fast | 2 min | 12 min | 45 min | R9 |
| menu-only masher (500 keys/min) | 4 min | 1.7 h | — | R4 |
Explosive first hour (the Rebirth Rush feel), then each rebirth takes longer (gate +18 levels at +15%/level = ×12 XP vs ×3 reward) → ~8 rebirths in 10 h, not 36. Fast ≈ 1.2× median. Mashing works but playing games is ~2× faster (games give wins → POWER). KEY kept vs reset: identical pace (checked).

## Reset + welcome
Everything resets except usernames. GEMS = round5(300 + 40 × old rebirths). Shown once on a designed EDITOR'S NOTE screen: "SORRY FOR RESCALING THE PROGRESSION — HERE'S SOME GEMS", old run → gems, COLLECT → gems float/fly into the gem pill on the left. No plain box popup, no "levels got harder".
Leaderboard after reset: everyone keeps their old position; every stat shows "—" until they earn something in the new season. Order = new stats desc, ties broken by old (season-1) rank.
