# JOB 11 — the third verdict (chore/verdict-3, REPORT ONLY, LAST JOB)

The arc: **verdict-1** — beautifully dressed, but the core loop isn't compelling; build the run mode.
**verdict-2** — the run mode was built and is the right fix, but it was buried at LV30 (~108 sessions),
so it changed the *game* without changing the *product*. Since then, tonight's work: the gate moved to
**LV8** (~189 letters, first sitting), the payout was **corrected** (an economy sim caught it under-earned
~10× and it was tuned into the 1.54–1.62× mode-spread band), the card got **real authored art** (a fanned
hand of drafted modifiers over a rising wall), the **draft screen** was rebuilt (authored-SVG modifier
cards, a visible growing stack, a commit moment), and the **wall** became a live truthful meter with clear
and miss moments. A headless bot also **played a full run end-to-end** for the first time.

## Is this game good?

**For the first time in this series: yes — as a solo game — and not on faith.** The evidence is the
playthrough (claude/run-playthrough.md), not a hunch. A bot played a real 10-round run and **died on round
8 because of a modifier it had drafted** (LEXICOGRAPHER — "RARE+ only" — against its own common-word
play). That is the exact thing verdict-1 said the game was missing: a self-inflicted, legible death you
can see coming and blame only yourself for. The draft is a real decision (rounds where all three offers
are trade-offs; the run literally ended on a pick), the wall now creates true stakes (the meter shows your
real round-adjusted standing, after the JOB-4 fix), and "one more run" is finally in the box.

So the core-loop problem verdict-1 named is **solved in code**. That is a genuine change, not surface —
surface would be a prettier version of a loop that still didn't compel; this is a loop that made a
scripted bot lose to its own greed.

## What would a stranger say after five minutes?

Two very different answers depending on ONE fact — whether this has shipped:

- **On the branch (what we built):** "Oh — a word game where I draft power-ups between rounds and try to
  out-scale a rising wall. I lost on round 8 because I got greedy with that ×3 card. Let me go again." That
  is the answer the game never had. Reachable at LV8, so a real newcomer meets it in their first session.
- **On production today (typeaword.com):** unchanged. Everything above — run mode, the LV8 gate, the art,
  the draft, the wall, and the in-game WB/Blitz redesigns — is sitting on **eight unmerged branches**. A
  stranger loading the live site right now still gets the old experience verdict-1 described, and still
  bounces off the empty multiplayer lobby. **The cure is built, reachable, and tuned — and still not
  administered.** verdict-2's warning has shifted from "buried at LV30" to "finished but unmerged."

## Did the run mode change the answer, or add surface?

**It changed it.** Concretely, across the three verdicts the same question moved:
- v1: no compelling loop → **build one**.
- v2: the loop exists but is unreachable → **move the gate**.
- v3: the loop exists, is reachable (LV8), is tuned (in-band payout), is polished (art/draft/wall), and a
  playthrough proves it compels → **ship it**.

The lever each time was smaller and closer to done. That is real progress, not decoration.

## The harsh part (a soft answer is worthless)

1. **It is not shipped, so the product is still what it was.** Being good on a branch is worth nothing to
   a player. The single highest-value action now is not another feature — it is **merging the run-mode
   stack to main after the 2-device / real play-test** so production becomes the game we built. Until then
   every verdict above is theoretical.
2. **Two design weaknesses survive, both real.** (a) **SAT RUSH rounds add no mechanic** in a run — the
   playthrough flagged 4 of 8 rounds as mechanically identical typing with a label; CHAIN and FUSE change
   *how* you type, SAT doesn't, so a third of a run is filler. (b) **Multiplayer is still the empty-lobby
   flagship** — the run mode fixes the solo loop but Word Bomb / Category Blitz remain the marketed
   headline and still open to dead lobbies (lobby-life + mp-grace help, but don't manufacture opponents).
   The featured slot should be the mode that works from player one — the run.
3. **A latent scoring bug was live until tonight** (the run scored every word as COMMON because it read
   `.name` instead of `.band`) — a reminder that "the branch works" still rests on a play-test, not just
   green gates.

## Bottom line

The verdict no longer stands. verdict-1's "a beautifully-dressed skill test with a core loop that is fine
but not compelling" is, as of tonight, **out of date**: the compelling loop exists, is reachable, is tuned,
and a run proved it. This is now a good solo game **the moment it merges** — and a merely well-dressed one
until it does. Ship the run-mode stack, make it the featured mode over the empty party, give SAT rounds a
real in-run mechanic, and the answer to "is this game good?" is finally, unhedged, **yes**.
