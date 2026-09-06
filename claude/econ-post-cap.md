# econ-post-cap.md — the honest post-WORD-SENSE-cap baseline

Every economy figure quoted this week predates the WORD SENSE cap (`fix/wordsense-cap`, merged
`be742f1`, which pinned `wordSenseFactor` to a 1.5 ceiling and ended the uncapped runaway). This is
the real number. Source: `claude/econ200h-audit.mjs` — a 200-hour full-economy sim that imports the
**live** shipped modules (`wordSense.js`, `wins.js`, `momentum.js`, `xp.js`, `mastery.js`,
`collection.js`, `combo.js`, `rarity.js`, `streak.js`, `shop.js`) — no reimplemented numbers. Run:
`node claude/econ200h-audit.mjs`. Merged main at time of run: local `27af716` (economy identical to
origin `be742f1`; the only delta is the unrelated feat/router merge, which touches no economy code).

## Longest dead stretch per archetype (span with zero reward event)

| Archetype                     | Longest dead stretch | When it starts | The gap |
|-------------------------------|----------------------|----------------|---------|
| Word Bomb main                | **8.66h** (520m)     | 173.3h         | level 121 → 122 |
| Fuse grinder                  | 8.47h (508m)         | 162.1h         | momentum #161 → level 150 |
| Chain main                    | 7.62h (457m)         | 187.3h         | level 137 → 138 |
| Blitz main                    | 5.30h (318m)         | 118.1h         | level 122 → 123 |
| SAT Rush main (vocab-strong)  | **4.44h** (267m)     | 174.6h         | momentum #160 → level 150 |

**Worst across all archetypes: 8.66h (Word Bomb).** Every worst-gap lands in the deep endgame
(118h–187h in), i.e. after ~120 levels and 6+ rebirths — not something a normal player reaches. Up
to that point the reward cadence is dense (658–953 discrete reward events per 200h = one every
13–18 min on average). The old `archetype200h-sim` figure of ~165h dead stretch is obsolete
(pre-parity, single-channel); this merged-channel number supersedes it.

## Mode spread (average wins/min, all channels)

| Mode      | avg wins/min |
|-----------|--------------|
| Blitz     | 1.72e4       |
| Word Bomb | 1.76e4       |
| SAT Rush  | 2.54e4       |
| Chain     | 2.58e4       |
| Fuse      | 2.67e4       |

**Spread = 2.67e4 / 1.72e4 = 1.55×.** This confirms the `be742f1` commit claim and is the real
post-cap number. The cap did its job: pre-cap the WORD SENSE rarity factor was reopening the spread
toward 4.4×→40.8× in SAT Rush's favour (see `claude/audit-economy.md`); post-cap SAT Rush sits mid-
pack and Fuse (fastest throughput, 20 w/min) leads by a modest 1.55×. No mode is degenerate.

## When momentum maxes

**Never — within 200 hours, on any archetype.** Final momentum after 200h ranges M155 (Blitz) →
M165 (Fuse), short of the MOMENTUM_MAX 200 cap. Consequence: the repeatable momentum sink stays
alive for the entire realistic lifetime of the game — "longest gap AFTER mom-max" is 0.00h for every
archetype because mom-max is never reached. Momentum is a living treadmill, not a wall you hit.

## Time-to-each-Key-Power tier

| Tier | Word Bomb | Blitz | SAT Rush | Chain | Fuse |
|------|-----------|-------|----------|-------|------|
| T1   | 0.0h      | 0.0h  | 0.0h     | 0.0h  | 0.0h |
| T2   | 0.0h      | 0.0h  | 0.0h     | 0.0h  | 0.0h |
| T3   | 0.1h      | 0.1h  | 0.1h     | 0.0h  | 0.1h |
| T4   | 1.2h      | 1.2h  | 1.0h     | 0.8h  | 0.7h |
| T5   | 6.1h      | 4.4h  | 4.8h     | 4.6h  | 3.1h |
| T6   | 19.4h     | 11.0h | 19.4h    | 13.2h | 7.7h |
| T7   | 50.5h     | 52.8h | 81.8h    | 34.3h | 22.4h |

No archetype reaches T8 within 200h (all finish at KT7). T1–T4 are effectively free (first session,
under ~1.2h). The Key Power curve then spaces out cleanly: T5 in the first few hours, T6 within a
day of play, T7 as a multi-day goal (22h Fuse → 82h SAT Rush). SAT Rush is the slowest to T7 despite
strong per-word value because its throughput (12 w/min) and forced deck cap raw volume — the T7
target at ~82h is the longest single-tier goal in the game and reads as a healthy deep-endgame
aspiration rather than a wall.

## Bottom line

Post-cap, the economy is healthy on every axis the job asked about:
- Worst dead stretch is 8.66h and only in the 170h+ deep endgame; normal play is one reward every
  13–18 min.
- Mode spread is a tight 1.55× — the WORD SENSE runaway is genuinely closed.
- Momentum never maxes in 200h, so the core repeatable sink never dies.
- Key Power tiers pace out from "free in session one" (T1–T4) to "multi-day goal" (T7 @ 22–82h),
  with T8+ left as headroom beyond 200h.
