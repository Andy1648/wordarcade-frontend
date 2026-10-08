# TYPE A WORD — PROGRESSION FINAL v3 "START AT 1" (Oct 7 2026, 21:27 ET) — constants only, structure = v2

Andy 21:27: start everyone at 1 XP a letter, POWER doubles, the whole climb ~6× slower (median first rebirth ≈ 20 min,
not 3). Rebirth ×3, AUTO REBIRTH at R2, OVERDRIVE ×10, gems / rolls / marks / pity — all unchanged. Rank R0 is now
**INKLING** (was KEYMASH). Tuned on the real-module CI sim (`claude/econ-oct2/final-sim.mjs`); every v3 constant is
within ±20% of v2's, except the two Andy set (BASE 1, ×2 POWER).

## Numbers — v3 beside v2
| piece | v3 (now) | v2 (Oct 6) |
|---|---|---|
| XP needed | need(n) = 100 × **1.131**^(n−1) | 100 × 1.15^(n−1) |
| XP / letter | **1** × KEY × 3^R × MARK × OVERDRIVE · game letter ×1, menu key ×0.2 rounded to whole XP, **floor 1** (a menu key pays 1 at the start) | 10 × … (menu key 2) |
| POWER (KEY) | **×2^T** (×1, ×2, ×4, ×8 …); T→T+1 costs 150 × 5^T wins (unchanged); KEPT through rebirth | ×1, 2, 5, 10 … 1000, then ×2.15 |
| REBIRTH | at LV **18 + 20·R** (R1 LV18, R2 LV38, R5 LV118, R10 LV218) → LV 1, ×3 forever; server lb_rebirth (029), ≤12/hour | LV 15 + 18·R |
| WINS / word | unchanged: 10 × length/5 × MODE × 3^R × MARK × OVERDRIVE (games only) | same |
| a +N BASE XP mark | ×(10 + N)/10 — still sized against BASE 10 (MYTHIC +20 = ×3), not 1 + N | 10 + N |
| ASCENSION, GEMS, ROLLS, MARKS, OVERDRIVE | unchanged (hidden / as v2) | |

## Sim — v3 beside v2 (real modules, no marks / overdrive, 10 h; first time to R1 / R3 / R5, R at 10 h)
| bot | v3 R1 | v3 R3 | v3 R5 | v3 @10 h | v2 R1 | v2 R3 | v2 R5 | v2 @10 h |
|---|---|---|---|---|---|---|---|---|
| casual | 38.5 min | 3.3 h | — | R4 | 6.3 min | 40 min | 2.0 h | R7 |
| **median** | **20.7 min** | **1.66 h** | **6.75 h** | **R5** | 3.3 min | 21 min | 69 min | R8 |
| fast | 12.3 min | 82 min | 3.8 h | R6 | 2 min | 12 min | 45 min | R9 |
| menu-only masher (500 keys/min) | 11 min | — | — | R2 | 4.2 min | 1.7 h | — | R4 |
Median targets (Andy): R1 ≈ 20 min (+3%), R3 ≈ 2 h (−17%), R5 ≈ 6 h (+12%), R6–R7 at 10 h (R5: −17% of R6). The CI sim
fails outside ±20% (casual / fast / menu cells are this table, as regression guards). ~6× slower to R1, ~6× to R5.
- **The trade-off (no new mechanic invented):** R3 ≈ 2 h and R6–R7 by 10 h cannot both hold in this structure — every
  tuning with R3 ≥ 96 min reaches R6 after 10 h (R5 → R6 ≈ 5–6 h); every tuning with R6 before 10 h has R3 ≤ 93 min.
  v3 keeps R1 / R3 / R5 in band. Alternative if Andy prefers the 10 h end: need 1.125^n, gate 18 + 20R, KEY cost
  250 × 5^T → R1 22.5 min · R3 93 min · R5 5.5 h · R6 9.7 h.
- **Mashing:** a menu key pays 1 XP at the start (the floor), the same as a game letter, so a 500 keys/min masher
  reaches R1 in 11 min (the median, who also plays games, in 21). After R1 games pull ahead (wins → KEY; the masher
  ends at R2 vs the median's R5).

---

# (history) PROGRESSION FINAL v2 (Oct 6 2026, 22:30 ET)

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
