# H2d + H7 sweep: SHOP / NUMBERS / REBIRTH, plus wording, location and font size

Branch `feat/h2d-h7-sweep` (from origin/main 93a0a5a3). This is a code read only, judged against Andy's 11:25 rules:
**one big thing per screen, bigger type, no useless words, a growing satisfying feel, animations that don't stack.**
Things already fixed in `confusion-audit.md` (H6) and `old-notes-audit.md` were not redone. One exception: one H6 fix
had itself regressed (S1 below).
No Playwright, preview or sim was run. Economy numbers are unchanged: this pass fixes what the screens SAY, not what they PAY.

Severity: HIGH = a wrong or contradicting number · MED = confusing or duplicated · LOW = polish.
Status: **FIXED** (on this branch) · **OPEN** (with the reason it was left).

---

## MENU XP AREA
**One big thing:** the LEVEL numeral welded to the XP bar. Good.

| # | Sev | What's wrong | Fix | Status |
|---|-----|--------------|-----|--------|
| S1 | HIGH | The worn MARK chip shows a bare "**3.18**", and the streak chip shows a bare "**1.1**" next to "7 DAYS". H6/M3+M12 (826f5ab1) swapped the formatter and dropped the "×", so both multipliers read as counts. `e2e/marks.spec.js:44` expects `×2`, so it should be failing on main (not run here). | Put the `×` back on both. | **FIXED** |
| S2 | MED | Freeze tokens print "❄×2". That is a count written as a multiplier. | "❄2". | **FIXED** |
| S3 | MED | The hint "N LETTERS IN WORD BOMB TO LEVEL N+1" is the one actionable sentence on the menu, and it is at `--fs-label` (13px). | Raise it to `--fs-body`. | **OPEN**: the menu has the tightest vertical budget, and menu-hook/mobile-cards/viewport-integrity gate it. That needs a Playwright run, which this job could not do. |

## SHOP
**One big thing:** it should be KEY POWER. Before this pass the biggest number on its card was "**574K XP PER LETTER**":
an XP number on a card you pay for in WINS, which is not what you're buying.

| # | Sev | What's wrong | Fix | Status |
|---|-----|--------------|-----|--------|
| S4 | HIGH | KEY POWER uses two units on one card. The hero number is XP PER LETTER, the next line is XP, and the WINS / WORD rate (what the WINS price buys) is a third line in smaller cyan type. | The hero becomes `39.6M → 99M WINS / WORD` (bold, `--fs-panel`). One small line under it: `AT TIER 13 · WORD BOMB · XP ×2.5 TOO`. XP rises by the same factor because it's one stack. | **FIXED** |
| S5 | MED | The KEY POWER price is printed **3 times**: the NEXT TIER line, "NEED N MORE WINS", and the button. | The price shows on the button only, and the gap shows in the goal line. | **FIXED** |
| S6 | MED | The LETTER FORGE price is also printed 3 times (the NEXT line, the goal, the button). | The NEXT line says `NEXT: E → LV 3` and nothing else. | **FIXED** |
| S7 | MED | The shop's WINS / WORD rate is Word Bomb's rate, but nothing said so. The menu cards show a different rate for each mode, so it can't be compared. | The line names WORD BOMB. | **FIXED** |
| S8 | MED | The KEY POWER purchase sticker says "Every letter now pays N XP". The tier is bought in WINS. | "Now N WINS / WORD in WORD BOMB." | **FIXED** |
| S9 | MED | A batch forge sticker says "**FORGED ×30**". That is a count shown as a multiplier, and KEY POWER's sticker already uses "(+n)". | "FORGED +30". | **FIXED** |
| S10 | MED | The goal line ("NEED N MORE WINS", "READY TO FORGE") at 13px is the "what next" sentence on every upgrade. | Raise to `--fs-body`. | **FIXED** |
| S11 | LOW | The WINS balance (the spendable number) is at `--fs-body`, smaller than the `--fs-panel` prices it pays. | `--fs-panel` from 600px up. At 360px the REBIRTH title, balance and ✕ have no room for it. | **FIXED** (≥600px) |
| S12 | MED | A per-level redeem code says "+1,000 WINS × YOUR LEVEL — ADDED". The amount was already added, so the player is left to work out the product. | "+20,000 WINS — ADDED". It uses the same `claimAmount` the credit uses. | **FIXED** |
| S13 | LOW | Each cosmetic tile shows "+N% MENU XP" on items whose job is flair. It's honest after H6/H9, but it's an extra line on 20+ tiles. | Move it to the tile's tooltip, or drop the stat (that is a design call). | **OPEN** (Andy) |

## REBIRTH (shop view)
**One big thing:** the hero `×10 WINS · +7 ★`. Good.

| # | Sev | What's wrong | Fix | Status |
|---|-----|--------------|-----|--------|
| S14 | MED | The current multiplier is said twice: the hero's "NOW ×9 · 8 REBIRTHS" line, and GAIN's "×9 → ×10 (+11%)" right under it. | Drop the NOW line. GAIN has the from/to, and the label's "REBIRTH 9" already says 8 came before. | **FIXED** |
| S15 | MED | Below the gate, the goal line says "12 LEVELS TO GO — LV 3 / 15" and the disabled button repeats it: "REACH LEVEL 15 TO REBIRTH — YOU'RE LV 3". | The button now says "REBIRTH AT LV 15". | **FIXED** |
| S16 | MED | The STAR PERKS blurbs (what ★ buys) are at 13px. | `--fs-body`. | **FIXED** |
| S17 | LOW | The hero (and the ceremony hero) label the multiplier "×10 **WINS**". Rebirth multiplies wins **and** XP; only GAIN says so. | Make the unit "WINS & XP". | **OPEN**: the hero is `--fs-hero` and already carries `· +7 ★`. A longer unit risks overflow at 360px without a fit run. |
| S18 | LOW | STAR POWER "+10% WINS PER LEVEL" could be read as per player level. It means per perk level. | "+10% WINS PER PERK LV". | **OPEN** (minor; the perk shows "LV n" beside its name) |

## REBIRTH CEREMONY
**One big thing:** the new multiplier. The RESET/KEPT columns do their job. Nothing important is under the body size
except `.rbc-only` / `.rbc-note` (13px, supporting lines). **No change.**

## STATS
**One big thing:** the PLAYER CARD's LV hero. Good.

| # | Sev | What's wrong | Fix | Status |
|---|-----|--------------|-----|--------|
| S19 | MED | PROGRESSION repeated four things the player card already shows: LEVEL, RANK, REBIRTHS, WINS EARNED (ALL-TIME). | PROGRESSION is now XP INTO LEVEL and WINS BALANCE. | **FIXED** |
| S20 | MED | WORDS YOU KEEP MISSING says "missed 3× / 5 seen". That's a count written as a multiplier, in lower case. | "MISSED 3 OF 5". | **FIXED** |
| S21 | LOW | RAREST WORD (card plus records), BEST WPM (card plus TYPING SPEED) and the daily streak (card foot plus records) still appear twice. | Fold TYPING SPEED into the card, and drop the card's RAREST WORD sub. | **OPEN**: the records grid is record-surface's feature, and a merge belongs with Andy. |
| S22 | LOW | The records' values are at `--fs-body` while their labels are 13px. The earned value is not much bigger than its label. | Values to `--fs-panel`. | **OPEN**: the grid's cell height is gated (viewport-integrity). |

---

## Top 10 (by severity × how often it's seen)
1. **S1**: the mark and streak multipliers lost their "×" (an H6 regression; `marks.spec` expects `×2`). FIXED
2. **S4**: KEY POWER's hero number was XP on a card priced in WINS. FIXED
3. **S5/S6**: KEY POWER and FORGE printed their price three times. FIXED
4. **S19**: STATS printed LEVEL / RANK / REBIRTHS / LIFETIME WINS twice. FIXED
5. **S14**: REBIRTH stated the current multiplier twice. FIXED
6. **S12**: the per-level code reported a formula, not the amount. FIXED
7. **S9/S2/S20**: counts written as "×N" (FORGED ×30, ❄×2, missed 3×). FIXED
8. **S10/S16**: the goal lines and perk blurbs were at 13px. FIXED
9. **S15**: the disabled REBIRTH button repeated the goal line. FIXED
10. **S3**: the menu's "letters to level" hint is still 13px. OPEN (needs a menu-fit run)
