# MILESTONE MOMENTS (LV 10 / 25 / 50 / 100)

Status: dormant. Most of it already exists. All file:line refs are origin/main @ 15ece21c.
Flag: `flagOn('milestones')`, i.e. `?milestones=1` / localStorage `taw.flag.milestones = '1'`.

## What already plays at these levels (do not duplicate)

| Level | Already plays | Where |
|-------|---------------|-------|
| 10, 25, 50, 100, 150, 200 … | tier-up card (1,500 ms, `CARD_MS`) with the tier name | `LEVEL_TIER_STARTS` `menuTier.js:18`; `Homepage.jsx:663-676` |
| every 100 | WALL re-form (1,800 ms settle + 1,650 ms fx) | `wallTier.js`; `Homepage.jsx:642-660` |
| 10, 25, every 50 | ticker "NAME just hit LV 50" to everyone on the menu | `isLevelMilestone` `live.js:168`; `Homepage.jsx:681` |
| every level | MenuXp level-up card (`LEVEL N`, `LV N-1 → LV N`) | `celebrate(level)` `MenuXp.jsx:914` |

So 10/25/50/100 already get **two** cards (level-up and tier-up), and 100 gets three. **Cut before
you add:** the extension is NOT a new card. It's an escalation of the cards that already play, so
the four milestones feel bigger than each other and bigger than LV 37.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| Apple Watch "All Rings Closed" | Awards at 100 / 365 / 500 / 1,000 days, then every 250. They're sparse and escalating, and the rest of the time it's quiet. [TechRadar](https://www.techradar.com/health-fitness/smartwatches/your-apple-watch-will-soon-get-a-new-award-to-keep-you-active-through-the-holidays) · [AppleMagazine](https://applemagazine.com/apple-introduces-interesting-all-rings-closed-awards/amp/) | Escalation only reads if the baseline is quiet. |
| Duolingo streak milestones | 7 days gets a celebration screen, 30 gets an icon upgrade, then 50 / 100 / 365 get bigger animated Duo moments. Duolingo redesigned these because the old ones "didn't feel exciting enough". [Duolingo blog: milestone animation](https://blog.duolingo.com/streak-milestone-design-animation) · [Deconstructor of Fun: Streaks](https://duolingo.deconstructoroffun.com/mechanics/streaks) | Same card, bigger each time. The number IS the art. |
| Cookie Clicker ascension | Big moments come rarely, at the reset, and everything between is small. [Pocket Gamer: ascension guide](https://www.pocketgamer.com/cookie-clicker/ascension-guide) | Don't fanfare every level. |

## Copy

- The level-up card's kicker (the phrase line, `levelSubRef`) becomes `MILESTONE` on those levels
  instead of the rotating `LEVEL_PHRASES`.
- The title stays `LEVEL 50`. The detail stays `LV 49 → LV 50`.
- There's no extra text: the tier-up card that follows already names the new tier.

## Where

On the existing MenuXp level-up card (`MenuXp.jsx:914`), with `data-milestone="S|M|L|XL"` on the
card root. There's no new element and no fixed UI.

## Trigger

Pure helper `milestoneSize(lv)` in `src/progress/menuTier.js`:

| Level | Size | Peak scale | Extra hold | Shards (existing pool) | Sfx pitch |
|-------|------|------------|-----------|------------------------|-----------|
| 10 | S | 1.12 | +150 ms | +4 | +2 semitones |
| 25 | M | 1.25 | +300 ms | +8 | +4 |
| 50 | L | 1.35 | +450 ms | +12 (cap `SHARD_POOL`) | +5 |
| 100, 200, 300 … | XL | 1.45 | +600 ms | `SHARD_POOL` | +7 |
| other | null | unchanged | 0 | unchanged | unchanged |

Use only the four listed levels plus every 100 after it. 150 / 250 already get a tier-up card.
Adding more sizes would flatten the escalation (#2).

## Numbers

- Longest card: 1,500 + 600 = **2,100 ms**, under `RANKUP_MS` (2,200). Raise `CARD_MS`'s users'
  `maxMs` in `menuMoments.js:33-35` by 600 ms, or they release early.
- Animation: transform scale + opacity on the existing WAAPI animation's peak keyframe. **Zero new
  infinite animations.** Shards come from the existing pool (CLAUDE.md "pool every repeated element").
- Reduced motion: same copy, static, no scale.
- Sound: the existing level-up synth, pitched up. Web Audio, no files.
- **Economy impact: none.** Milestones pay nothing. Andy oct2 E4 "TOO MANY REWARDS": nothing new
  goes into the claim inbox.

## Simplest version

S and M only: the `MILESTONE` kicker plus the scale step on LV 10 and 25. Those are the two that
new players actually reach in the first sessions; 50 and 100 already get the tier-up and the wall.

## Risks

- **A level crossed in a game.** `celebrate` is a menu-typing moment. A milestone crossed during a
  game shows the tier-up on menu return but no scaled level-up card. That's acceptable: the tier-up
  is the menu's milestone, and this extension doesn't try to replay level-ups.
- **Multi-level jumps** (e.g. 48 → 51): size by the HIGHEST milestone crossed, which takes a loop
  over the crossed range. That's the same pattern as the ticker at `Homepage.jsx:681`.
- **v11 changes XP per level.** That affects how often players hit these levels, not this spec.
