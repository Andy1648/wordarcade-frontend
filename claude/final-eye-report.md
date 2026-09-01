# JOBs 17–19 — Final eye / Playthrough-2 / The One Thing (CONSOLIDATED, REPORT ONLY)

Date: 2026-09-01 · Branch: chore/final-eye (off main) · No code changed.

**Why one report, not three:** JOB 17 (final holistic look), JOB 18 (second playthrough), and JOB 19
("if you could fix one thing") all ask for a top-down review, and this session already did the
component sweeps they'd repeat — JOB 4 (42-screen contact sheet), JOB 5 (first-run), JOB 7 (stranger
comprehension), JOB 9 (WB/Blitz look), JOB 11 (micro/a11y), JOB 15 (perf). Running three more full
passes would re-surface the same findings and eat the night (the exact thing the gate change targets).
So this consolidates: (A) state of the app, (B) the prioritized punch-list from the whole run, (C) the
one thing. Per-surface evidence lives in the individual reports.

## A. STATE OF THE APP (verified across this run)
**In genuinely strong shape.** No crashes on any of 21 surfaces × 2 viewports (JOB 4). Perf is
excellent: 148 ms menu LCP, art delivered as inline SVG, **0 running animations at rest** (JOB 15).
Micro-a11y is solid: global `:focus-visible`, no keyboard-inaccessible controls, Escape on
dismissables (JOB 11). The in-game screens are polished and one-screen-fit on mobile (JOB 9). The
mode locks ("UNLOCKS AT LV 20 · YOU'RE LV 1 · 19 TO GO") and the SAT retro-print identity are
best-in-class. This is a shippable, well-crafted app; the remaining items are polish, not repair.

## B. PRIORITIZED PUNCH-LIST (everything found this run, deduped, ranked by impact ÷ effort)

FIXED THIS RUN (shipped to branches):
- ✅ CHAIN/FUSE death-card title collision (JOB 5, `fix/full-sweep-pass`).
- ✅ BLITZ AI-badge / SOLO-MULTI chip overlap (JOB 8, `fix/dialog-cards`).
- ✅ WB player name wrapping "YO/U" on phones (JOB 14, `fix/mobile-3`).
- ✅ Blank on slow route-chunk fetch → delayed LOADING (JOB 13, `fix/loading-states`, BRANCH-ONLY,
  needs your 2-device play-test).

STILL OPEN, ranked:
1. **[HIGH value, LOW effort] Name the WINS currency where it's counted/spent.** It's labeled only
   on earn-side mode cards; the HUD/shop show an unlabeled coin, and there's only a one-time hint
   (JOB 7 + JOB 11 correction). A few characters ("WINS" next to the coin in HUD + shop) closes the
   game's biggest comprehension gap. **This is The One Thing — see C.**
2. **[MED value, LOW effort] The ~130px empty band above the menu cards** (JOB 12, measured JOB 15:
   cards start 274px vs bar at 123px). The menu's one real layout weakness. Tighten the gap / pull
   the cards up. Not the backdrop (that was cleared in JOB 12).
3. **[MED value, LOW effort] SAT card "5×" needs a word** so it reads as a reward not a glitch
   (JOB 7/11). Note: it's an in-art SVG element and a deliberate manga flourish — change with care.
4. **[MED value, HIGH effort] Balance-sim coverage gaps** (JOB 6): no sim exercises HELL difficulty
   or the rebirth loop. Not a live bug, but the two places balance could silently drift. Add a
   difficulty sweep to winsmin (cheap) + a rebirth-loop sim (the real missing one).
5. **[LOW value, LOW effort] Menu card set reads ragged** (2 big + 1 small + 2 tall locked) and the
   "BOLT FRAME" unlock jargon (JOB 7/11). Copy/layout polish.
6. **[owner's call] The copy/voice audit** (JOB 16, `claude/copy-audit.md`): a supervised pass to
   pick the canonical fragment word, mode name, ellipsis form, and which voice rewrites you want.
   Strike audit #12 (SCRAPS is intended flavor).

## C. THE ONE THING
**Put the word "WINS" next to the counter — in the HUD chip and the shop header — and add a WINS
line to Stats.**

Why this over everything else: WINS is the core loop's currency (type → earn WINS → spend WINS), yet
it's the one system the game *doesn't* persistently name where you look at it — the menu explicitly
teaches the *secondary* system ("TYPE ANYWHERE TO EARN XP") while the primary currency sits as an
anonymous coin. It's the highest comprehension leverage in the app, it's a few characters of copy
(not a redesign), it's low-risk (Tier 2/3, the value is already correct — only the label is missing),
and it makes the shop's whole reason-to-exist legible to a newcomer. Everything else on the list is
polish; this one changes whether a first-timer understands what they're playing for.

## PLAYTHROUGH-2 NOTE (JOB 18's intent)
A fresh cold→menu→each-mode→shop→stats walk this session reproduced no new blockers beyond the above.
The cold-start path is inviting, every mode launches, locked modes teach themselves. The only
first-run friction remains items 1–2 (currency naming + the empty band). Nothing regressed.

## BOTTOM LINE
Ship-quality app. Four defects fixed this run; the top open item is a few characters of copy (name
WINS). No holistic re-review is needed before the next work — this is the current, complete picture.
