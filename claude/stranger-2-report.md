# JOB 7 — Cold-stranger comprehension pass (REPORT ONLY)

Date: 2026-09-01 · Branch: chore/stranger-2 (off main) · No code changed.

Different lens from JOB 5 (first-run path) and JOB F (playthrough), which found layout bugs
(wordmark clip, modes below fold). This pass asks the **comprehension** question: a person who has
never seen a typing idle game opens the menu cold — **what do they NOT understand?** Walked
menu → mode dialogs → shop → stats at 390px. Shots: `claude/stranger-2/shots/`.

## FINDINGS (ranked)

**1 — HIGH · The primary currency (WINS) is never named where its value is shown.**
The whole loop is "type words → earn WINS → spend WINS." But the word **WINS** appears ONLY on the
earn side — the mode cards ("40 WINS / WORD", "20 WINS / WORD"). Everywhere the value is actually
displayed or spent it is an **unlabeled coin**: the top-left `◎ 0` on the menu, the top-right `◎ 0`
in the shop, the `600` / `2,500` prices, "YOU HAVE 0", and there is no WINS total in Stats at all.
So a stranger sees a coin tick up while typing and cannot connect it to the "WINS" the cards
promised, nor to what the shop costs. **The label chain is broken at both ends.**
Compounding it: the SECONDARY system (XP) IS explicitly taught — "TYPE ANYWHERE TO EARN XP" sits
right under the LEVEL bar. The game explains its accelerator and leaves its main currency anonymous.
Fix (tiny, high-leverage): put "WINS" next to the counter in the HUD and the shop header, and add a
WINS/lifetime line to Stats.

**2 — MED · Two parallel number systems crowd the top HUD with no separation.**
Top-left `◎ 0` (WINS) and, immediately right, `LV 1` + a `0 / 120` bar (XP-to-next-level) read as one
cluster. A stranger cannot tell they are two different economies (spendable currency vs leveling
progress). They differ in kind, but nothing visual or textual says so. Grouping/label them.

**3 — MED · SAT RUSH's big "5×" is unexplained, and the card reads as a foreign object.**
The SAT card carries a large "5×" with no context (multiplier of what? always? for me?) and is
styled in cream retro-print while every other card is neon poster. The style split is deliberate
(DESIGN.md SAT sub-style) and fine *inside* SAT — but on the shared menu, to a cold stranger, the
SAT card looks like a different app pasted in, and "5×" looks like an unfinished label. At minimum
give the 5× a word ("5× WINS") so it reads as a reward, not a glitch.

**4 — LOW-MED · The five modes don't read as one clean set of options.**
Two big posters (WB, Blitz), one small card (SAT), two tall locked cards (CHAIN, FUSE), at mixed
heights and a ragged 2-1-1-1 flow. "Here are your 5 games" doesn't land as a set. Plus the ~150px
empty band above the cards (already logged, JOB 12 / wallscene-report). A stranger's first glance
doesn't resolve into "pick one of five."

**5 — LOW · Unlock-ladder jargon.** "NEXT · BOLT FRAME · LV 3" means nothing to a newcomer — no hint
what a "frame" is or why to want it. It's a teaser for a system they haven't met. Low harm; noted.

## WHAT'S ALREADY EXCELLENT (do not touch)
- **Locked-card copy is the clearest thing on the screen:** "UNLOCKS AT LV 20 · YOU'RE LV 1 · 19 TO
  GO" — states the gate, the current state, and the distance, in one glance. This is the model the
  rest of the menu's copy should aspire to.
- **"TYPE ANYWHERE TO EARN XP"** is good zero-state onboarding for the leveling loop.
- **Stats' empty records are framed as mini-goals** ("CHAIN 2 WORDS", "PLAY 2 DAYS", "HIT A LUCKY
  WORD") — a new player learns what's trackable instead of seeing blanks.

## BOTTOM LINE
The app is legible and inviting; the mode locks in particular are best-in-class clear. The one
comprehension defect worth fixing is **Finding 1** — naming WINS where it lives — because it's the
core currency, the fix is a few labels, and right now the game teaches its secondary system better
than its primary one. Everything else is polish. This is a report; nothing changed.
