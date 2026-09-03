# JOB 19 — what does a returning player see? (chore/return-audit, REPORT ONLY)

Simulated 3 combined absence+progress scenarios by seeding `wa_last_seen`, `taw.xp`, `taw.rebirths`,
`taw.streak`, and leaving `taw.returnClaim` unset, then loading the home menu at 1366×768 and 390×844.
Screenshots: `claude/return/shots/` (6). Scenarios:
- **A — 1 day away, LV12, 4-day streak** (streak alive).
- **B — 3 days away, LV30 R1, broken streak** (at the rebirth threshold).
- **C — 14 days away, LV8, streak lost.**

## What each sees
| | Welcome-back card | Streak | Next goal shown | Punishing? |
|---|---|---|---|---|
| **A (1d, LV12)** | `WELCOME BACK · +1,200 WINS · 12+ HOURS AWAY` | 🔥 **4** preserved | CHAIN "UNLOCKS AT LV 20 · 8 TO GO" + level bar | no |
| **B (3d, LV30 R1)** | `WELCOME BACK · +1,800 WINS · 12+ HOURS AWAY` | none (broken) | LV30 pill highlighted → **REBIRTH ready**; all modes unlocked (×1.5) | no |
| **C (14d, LV8)** | `WELCOME BACK · +1,200 WINS · 12+ HOURS AWAY` | none (lost) | CHAIN/FUSE "X TO GO" + level bar | no |

## Answers to the audit questions
**Does the game acknowledge the absence?** Yes — a `WELCOME BACK` card with a wins grant, on the home
menu only (a deep-link into a game doesn't overlay it). It dismisses on ANY key/tap and never blocks
type-to-earn. BUT the acknowledgement is **identical for 1, 3, and 14 days** — the grant caps at 12h
(`min(hoursAway,12) × 100 × rebirthMult`), so every return past ~12h shows the same `+1,200`
(R0) / `+1,800` (R1) and the same `12+ HOURS AWAY` copy. A 2-week returner gets the exact same beat as
an overnight one.

**Is anything punishing?** No. A lost or broken streak is simply ABSENT (no 🔥 chip) — there is NO
"you lost your streak" guilt copy anywhere, which matches the design's stated no-pressure stance. The
card is a gift, non-blocking, once-per-calendar-day.

**Is the next goal obvious?** Mostly, once the card is dismissed: low levels see unlock teasers
("8 TO GO" to CHAIN), and a player at the rebirth threshold (B) sees the LV pill highlighted with
REBIRTH lit — a clear next act. The prompt "TYPE OR CLICK ANYWHERE · IT FILLS YOUR LEVEL BAR" reinforces
the core loop. Caveat: on the FIRST frame the welcome card partially covers the XP bar / next-unlock
teaser (see mobile below), so the goal only reads clearly after dismissal.

**Is the welcome-back bonus visible and fair?** Visible (big cyan card) and fair: the 12h cap means it
never rivals active play (a typing game has no offline income), and it **scales with rebirth**
(R0 +1,200 → R1 +1,800), so a more-invested player gets a proportionally bigger welcome. Good.

## Findings / recommendations (POLISH, not shipped — report only)
1. **No differentiation by absence length.** 1/3/14 days are byte-identical. Deliberate for the
   ECONOMY (correct — don't pay more for being gone longer), but a re-engagement miss: a 14-day
   returner would re-hook better with warmer, absence-aware COPY (e.g. "WE MISSED YOU · 14 DAYS AWAY")
   while keeping the capped, fair grant unchanged. Low-risk copy-only change.
2. **Mobile overlap (390px).** The `WELCOME BACK` card sits over the XP bar + wordmark + REBIRTH button
   until dismissed (scenario C @ 390×844), momentarily hiding the level/next-goal chrome. Nudge it below
   the top cluster or shrink it so the level bar stays visible behind it.
3. **Lost-streak silence is a double-edged default.** No guilt is good; but a returning player who HAD
   a long streak gets zero acknowledgement it ended — a neutral "start a new streak today" nudge (no
   guilt) could convert the return into a re-engagement without violating the no-pressure rule.

Net: the returning-player experience is welcoming, fair, and never punishing — its one real gap is that
it treats a 2-week absence exactly like an overnight one, a re-engagement (not economy) opportunity.
