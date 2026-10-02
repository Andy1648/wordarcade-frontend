# STEP 48 — Economy rules (Andy, Oct 2): before / after

Simulator: `claude/progression/econ-sim.mjs` (extended for this step — LETTER FORGE, FUSE FRENZY on
the sim clock, claims claimed at round end, rebirth that waits out a BAD TIME, stars spent on
perks/automation). Same three players (10 / 30 / 60 min a day, 30 days + 200 h tail), live modules.
Raw: `before-v9-console.txt` (PR #75 as merged, before the cosmetic re-price) and
`after-oct2-console.txt`. FUSE FRENZY frequency: `frenzy-sim.mjs` / `frenzy-sim.txt`.

## What changed
| Andy's rule | before (v9) | after |
|---|---|---|
| NO dead-end caps | MOMENTUM: 200 buys max, +1% each, no gameplay | **LETTER FORGE**: uncapped; each buy forges the next letter; a word pays +5% per forged level of every letter in it; drawn in the shop, a FORGE row on the receipt. Old saves migrate 1 momentum buy → 1 forge. Mastery keeps levelling past M50. |
| SAT earns much more / word | SAT ×3 (= 1.5× WB) | **SAT ×10 = POWER ×5 vs Word Bomb** |
| CHAIN higher / word | ×4 | ×4 = POWER ×2 |
| FUSE = WB / word, FRENZY is its edge | FUSE ×5, no frenzy | **FUSE ×2 (= WB)** + **FRENZY**: light all 26 letters → ×5 wins for 5 real minutes, across runs; card, dialog, in-game goal line + countdown + burst |
| new late-game systems | none | **STARS** (R1): rebirth pays ★ by how far past the gate → STAR POWER (uncapped +10%/lv), FRENZY+, HEAD START. **AUTOMATION** (R3): AUTO-KEY, AUTO-FORGE. Each is a claimable NEW SYSTEM reveal. |
| rebirth panel | stats grid | one big **REBIRTH N TO GET ×M WINS · +S ★**, **BAD TIME — 1 MORE LEVEL = +1 ★** warning |
| wins only from playing | achievements / milestones / welcome-back credited on their own | **claimed**: REWARDS popup + button with a count badge; rank-ups now claimable too |
| no XP / WORD on mode screens | cards: XP / WORD + WINS / WORD (×N) | cards: WINS / WORD (the base word) + POWER ×N / FRENZY ×5 + LONGER WORDS = MORE; the (×N) tag is only what the player built |

## FUSE FRENZY (last-letters steering on), per FUSE bot (1,500 runs each)
| bot | runs reaching FRENZY before → after | minutes of FUSE per FRENZY before → after |
|---|---|---|
| weak | 0% → 0.1% | — → (rare) |
| median | 2.3% → **19.2%** | 84.3 → **10.3** |
| strong | 71.5% → **98.9%** | 3.6 → **1.9** |
A clear during a running FRENZY does not extend it (pays its bonus + life), so a strong player's
FUSE is ×5 about 72% of the time and a median player's about 33%: FUSE ≈ 2.3× (median) to 3.9×
(strong) Word Bomb — under SAT's flat ×5, and earned by skill.

## The economy (30 days + 200 h tail)
| | target | before (v9) | after (oct2) |
|---|---|---|---|
| median gap between meaningful rewards | 1–4 m early, 2–8 m late | 1.1 m / 4.4–4.7 m | **1.0–1.2 m / 1.8–2.6 m** |
| p90 gap (tail) | ≤ 20 m | 4.9–7.0 m | **3.9–5.6 m** |
| max gap (tail, strict: no forge buys, no <10 s buys) | ≤ 60 m | 10.4–13.1 m | **17–24 m** |
| KEY POWER at first L100/125/150 (price ÷ income) | never TRIVIAL (<10 s) nor a WALL | 11–31 s | **11–25 s** |
| a cosmetic at L100–150 | a goal, not pocket change | 17–56 s (first pop 60 wins) | **16–53 s (first pop 6,000)**, ladder lasts 60 h+ |
| L100 / L300 reached | — | 27–37 m / 3.7–5.4 h | **25–38 m / 2.9–3.6 h** |
| level at 200 h | — | L600–638 | **L703–706** |
| biggest number shown | < 1e12 | ~2e9 | KEY price ~1e7 at L700, forge ~1e7 |

## Two runaways the sim caught and the fix
1. FORGE priced in base-rate words got relatively cheaper with every buy (700k forges and L1000 by
   200 h). Fix: the forge is priced in words **at the forged rate** (`forgeAvgMult`).
2. KEY POWER, priced in base words, fell to ~5 s of income once the forge and STAR POWER multiplied
   income. Fix: one `priceRateBoost()` (forge average × STAR POWER) prices both KEY and FORGE.

## Not met / judgement calls
- The strict max gap rose from ~13 m to ~24 m in the 200 h tail because LETTER FORGE buys (the
  frequent ones) are excluded from the strict view, like MOMENTUM's were; with them counted the max
  is 10.7 m. Still well under the 60 m target.
- WORD RACE keeps a flat card-quote payout (no forge), so its card stays exactly honest.
