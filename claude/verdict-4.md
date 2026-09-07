# JOB 10 — the fourth verdict (chore/verdict-4, REPORT ONLY, LAST)

Written with the whole run stack **integrated** for the first time: `integration/run-stack`
merges the nine held branches, and the full gate is green (lint 0 err, 487 unit, **1092 e2e
pass**). This verdict is not on faith or on a branch-in-isolation — it's on one integrated,
gated build, plus five fresh investigations run against it (the 200-run draft sim, the
18-modifier audit, the perf pass, the stranger walk, the mobile matrix).

The arc so far: v1 — beautifully dressed, core loop not compelling, build the run. v2 — run
built but buried at LV30. v3 — run reachable (LV8), tuned, polished; "good the moment it
merges." **v4 — it has effectively merged (one gated branch, one play-test away), so the
"it's only on a branch" excuse is gone. Now the real questions land.**

## Is this game good?

**As a solo game: yes — and now it's assembled, not scattered.** The craft was never in
doubt (the stranger test's own words: "it looks like a real, polished game with a strong
Newgrounds/FNF identity and unusually good per-mode explainer screens"). The run mode adds the
one thing v1 said was missing — a self-inflicted, legible "one more run." Perf is ship-safe
(every calm screen and both RUN screens hold 16.7 ms at 1× and 4× median; zero new infinite
loops; the backdrop is inert). Mobile holds across three phone sizes and both orientations
after one real landscape fix. So the machine works.

**But three findings this round puncture v3's optimism, and a soft verdict would bury them.**

## The harsh part

### 1. The draft — the roguelike's whole promise — is SOLVED, not balanced.
v3 said "the draft is a real decision (the run literally ended on a pick)." That was one
anecdote. The 200-run sim (JOB 2) says otherwise: **GREEDY wins 22%, BALANCED 4%, RISK-AVERSE
and RANDOM ~0%**, at every skill level. **MOMENTUM appears in 100% of winning runs and
GLASS CANNON in 98.7%; the pair is in 98.7% of wins.** Only compounding multipliers keep up
with the wall's ~1.8×/round explosion, so the "choice" collapses to: grab the multiplicative
card, avoid the flat/defensive ones. That's not a decision — it's a lookup. A stranger won't
notice in two runs, but the roguelike fantasy (a build you author) is not delivered yet.

### 2. A third of the modifier deck is dead or broken.
The 18-modifier audit (JOB 3) found the drafting surface is much thinner than 18: **SNOWBALL
is a permanent ×0.7 penalty** (its ramp counter is hardcoded to 0), **HOT STREAK, UNCAPPED
and RARE BREED are strictly dominated** (raised caps unreachable in a 16-word round), and
several cards' text doesn't match their code (RARE BREED says ×6, does ×1.5). Three more are
boring flat +N cards. The sim confirms the live-play knob bugs from the code side: `owned`
never increments, `wprMul` is never read, `luckyOdds` is ignored — so several two-sided cards
are secretly one-sided. **The draft is shallow AND buggy, which is why greedy wins.** These
two findings are the same problem seen from two angles.

### 3. The stranger never reaches the cure.
This is the sharpest one. The run mode is the fix — and it is **locked at LV8, so the hero of
the menu is a grey padlock** for every newcomer. Worse, the flagship PLAY funnels a solo
player straight into "SHARE THIS CODE WITH FRIENDS TO JOIN / NEED 2+ PLAYERS TO START" — you
have to *hunt* for the ADD BOT button. The stranger's blunt summary: the first 60 seconds read
as **"this needs friends I don't have, and most of it is locked"** before they ever reach the
(excellent) gameplay. We spent four verdicts building the compelling loop and then gated it
behind, and hid it beneath, the exact first-impression that makes people leave.

## Is the run mode carrying it, or is it one good mode bolted to five average ones?

**It is *built* to carry it, but it is not carrying it yet — for reasons that are all
fixable.** The run is the best thing in the box and the only mode with a "go again" hook. But
(a) newcomers can't reach it (LV8 gate + locked-marquee), (b) its core loop is solved not
balanced (findings 1–2), and (c) a third of a run is filler — v3 already flagged that SAT
rounds add no mechanic, just typing with a label. The five base modes are honest, polished
skill tests; the multiplayer two are still an empty-lobby flagship. So today the honest
picture is: **one very promising mode that the product neither shows newcomers nor has
finished balancing, attached to five solid solo skill tests and an empty party.** The run can
be the carry; right now it's the crown jewel in a locked case.

## Is this ready to show people? (not perfect — ready)

**No — but it is one decision away, and the blocker is not a feature, it's the on-ramp.**

Everything technical is ready: it's integrated, gated (1092 e2e), performant, mobile-sound.
What is NOT ready is the **first 60 seconds for a person with no account and no friends** —
the single thing a "show people" moment is entirely made of. As it stands they hit an empty
multiplayer lobby and a locked hero card and leave before the good part.

**The one thing blocking it:** the new-player on-ramp. Concretely, the smallest change that
unblocks a public showing —
- make the flagship a **one-tap SOLO / vs-bot start** (don't lead a lone visitor with "share
  this code / need 2+ players"), and
- **stop leading with a locked marquee** — either surface a playable mode as the hero, or let
  a newcomer taste the run immediately (a one-run demo, or drop the gate for the first run).

Do that and the answer flips to "ready," because behind those 60 seconds the game is genuinely
good.

**What to submit first (if forced to ship one thing):** the **solo** experience — a solo mode
that starts instantly against a bot, with the run as the featured hook — never the multiplayer
party, which is the one part that is empty by construction on day one.

## Bottom line

v3's "good the moment it merges" has come due: it's integrated and gated, so the loop is real
and in the box. But merging revealed the next layer of truth, and it's harsher than v3
admitted — the roguelike draft is a solved lookup over a half-broken deck, and, most
importantly, **the newcomer never reaches any of it** because the flagship asks for friends
and the hero card is a padlock. The game is good; the first minute of it is not. Fix the
on-ramp (one-tap solo, unhide the run), then rebalance the draft (cap/two-side MOMENTUM, drop
GLASS CANNON's dominance, fix the dead/bugged cards — JOBs 2 & 3 give the numbers), and give
SAT-in-run a real mechanic. The ceiling is a genuinely good solo word-roguelike. The floor,
today, is a stranger closing the tab in the first minute — and that floor, not the ceiling, is
what "ready to show people" is measured against.
