# PROGRESSION v3 — FINAL (fresh start after the full reset)

Designed Oct 5 evening for Andy, from his own reactions this week. Frozen after he signs off: only ±20% constant tuning after a CI sim, never a restructure.

## Guardrails from Andy's own words (what went right / wrong)
- RIGHT: Rebirth Rush was "so much better". Rebirth is the main event, and after one you should blow past levels. Mark rolls feel like gambling plus multipliers. Big exponential numbers. Multipliers visible with the total first. Keyboard Escape-style 2–5× steps.
- WRONG: "too extreme" (XP needed scaling with your own rebirths: R8 LV16 needing 233M). Stagnation (a level-20 wall at R8, stuck around LV40). imbetterthanandy's R100 from spamming the rebirth popup ("sloppy code"). Bulk rebirths that snowball. Chunky/laggy bar. KEY resetting every rebirth. "BASE 10" confusion. Unexplained wins. Constant restructuring.
- RULES: one fixed level curve for everyone; levels cheap and plural (millions eventually); rebirths one at a time, each one HARDER than the last (no snowball); ascension in the low double digits; every number K/M/B; every win shown.

## The loop
Type → XP → LEVELS (cheap, millions) → reach the rebirth gate → HOLD TO REBIRTH (one) → ×2 on everything → wins buy POWER → at R10 ASCEND for ★ STARS → climb again, faster.

## Numbers
| thing | rule |
|---|---|
| XP per letter | 7 × 1.8^POWER × 2^R × (1 + ★) × MARK |
| XP for next level | 40 × √level (barely grows → levels pile up) |
| WINS per word | 15 × length/5 × MODE × 2^R × (1 + ★) × MARK |
| POWER | costs 100 × 4^P wins; kept through rebirth, reset on ascension |
| REBIRTH gate | LV 100 × 2.5^R (R1 at LV100, R2 250, R5 9.8K, R10 954K) — levels reset to 1 |
| REBIRTH reward | ×2 XP and wins, +7 gems × R |
| ASCEND | available at R10: rebirths, levels and POWER reset; ★ += R − 9 |
| GEMS / ROLLS | 75 gems a roll; drops 1 in 15 words for 3–12, bot win +18, MP +15 per player beaten, streak +4, achievements 40–200 |

Why it can't snowball: each rebirth needs ×2.5 more levels (≈ ×4 more XP) but only gives ×2. POWER adds about ×1.3 per rebirth. So every rebirth takes longer than the last.

## Sim (100 lpm / 14 wpm median; 160 / 26 fast; 60 / 8 casual)
| first time to | casual | median | fast |
|---|---|---|---|
| R1 | 18 min | 12 min | 6 min |
| R5 | 2.5 h | 1.5 h | 54 min |
| R10 (ascend) | 11.4 h | 6.8 h | 4.1 h |
Levels by 10 h: casual 221K, median 1.1M, fast 3.2M. Fast stays ~1.7× median: no runaway.

## Ranks (monotonic; never drop when levels reset)
By rebirths, then stars: R0 KEYMASH · R1 TYPO · R2 CLACKER · R3 HOTKEY · R4 INKSTORM · R5 WORDSMITH · R6 KEYFIEND · R7 CAPSLOCK · R8 OVERCLOCK · R9 GLYPHLORD · R10 LEXIBEAST · ★1 VOIDTYPER · ★3 ASCENDANT · ★5 OMNIKEY · ★10 FINAL BOSS · ★20 ENDGAME.
Board order: ★ desc, rebirths desc, levels desc.

## Rebirth unlocks (the reason to rebirth besides ×2)
R1 ROLL screen · R2 AUTO ROLL · R3 2nd boost slot · R5 2nd MARK slot · R7 LUCK ×1.25 · R10 ASCEND.

## Anti-exploit (non-negotiable, built FIRST)
- Rebirth is a server-checked action: the server recomputes the gate from the stored level and refuses if it isn't met. One rebirth per request; idempotent (a double click can't do two).
- The client's hold-to-rebirth only sends after the hold completes; the button disables until the server answers.
- CI sim includes a "spammer" (clicks rebirth 1,000×) and a "fast greedy" player; it fails if anyone exceeds 2× median pace.

## Naming
POWER (was KEY TIER). REBIRTH stays. LEVELS plural on the menu. Wins buy only POWER; everything else costs gems.

## The reset
Everything resets. Each player gets 150 gems × old rebirths (R100 → 15,000 gems = 200 rolls) and a "SEASON 2" banner.
