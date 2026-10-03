# DAILY QUESTS

Status: dormant. **Build last.** It's the only extension that moves the economy. All file:line refs
are origin/main @ 15ece21c.
Flag: `flagOn('quests')`, i.e. `?quests=1` / localStorage `taw.flag.quests = '1'`.

## Already live (do not add a third streak)

- Daily streak `taw.streak`: up to ×1.25 XP, plus freeze tokens (`progress/streak.js:22`, `getStreak()`
  at `:96`). The header says it's "an achievement, never a contract", with no guilt copy.
- Daily Challenge streak + seed: `daily/streak.js`, `daily/dailySeed.js:21` `localDateKey`,
  `:54` `seedFor`.

Quests reuse both. They show the existing streak count and need no new streak.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| Hearthstone | A maximum of 3 daily quests at once, and one free reroll per day. A new quest is lost if the log is full, so there's no backlog guilt. [Hearthstone wiki: Daily quest](https://hearthstone.wiki.gg/wiki/Daily_quest) · [wiki: 2013-2020 quest system](https://hearthstone.wiki.gg/wiki/Quest/2013-2020_system) | 3 is the cap. A free reroll fixes "I hate this mode". No backlog. |
| Clash Royale daily tasks | 3 a day, all visible together, with a bonus for clearing all of them. [Mobile Matters](https://mobilematters.gg/clash-royale/supercell-introduces-daily-tasks-to-clash-royale) | Show all three at once. |
| Brawl Stars (anti-pattern) | "WIN N" and mode-forcing quests made players throw matches and call the game rigged. [devtrackers: Brawl Stars](https://devtrackers.gg/brawl-stars/p/c878a5c4-bad-randoms-is-a-distraction-you-lose-a-lot-because-the-game-is-rigged) | **No WIN quests.** Only effort quests: play, type. |
| Duolingo Friends Quests | Duolingo shipped the "dumbest" version first and capped the scope. [Duolingo blog: Friends Quests](https://blog.duolingo.com/friends-quests/) | v1 = no reward. |

## Copy (3 rows, `formatNum` on every number)

```
TODAY
PLAY 3 ROUNDS          1/3
TYPE 300 LETTERS     120/300
PLAY 1 CHAIN RUN       0/1
```

- A finished row shows `DONE`, flat cyan, in place of the `n/N` count.
- With all 3 done, the heading reads `TODAY · DONE`. There's no extra banner.
- `NEW QUEST` (reroll) is a 44 px text button on the third row only. It's free, once a day.
- The existing streak shows as `TODAY · STREAK N` in the heading, only if `getStreak().count ≥ 2`.

## Quest pool (seeded, everyone gets the same three: Wordle effect)

| Slot | Quest | Target | Counter (diffed against a day-start snapshot) |
|------|-------|--------|------------------------------------------------|
| 1 | PLAY N ROUNDS (any mode) | 3 | sum of `getRounds()` `wins.js:126` + `getChainRuns()` / `getFuseRuns()` `solo/shared.js:99,127` |
| 2 | TYPE N LETTERS | 300 (about 5 min of median play) | `getLetters()` `letters.js:28` (game letters only) |
| 3 | PLAY 1 <MODE> ROUND | 1 | that mode's counter; the mode is drawn by `seedFor(localDateKey(), 'quest')` from modes where `!isModeLocked(game, level)` (`modeAccess.js:41`) |

- Snapshot: `taw.quests = { day, start: { rounds, chain, fuse, letters }, mode, rerolled }`. It's
  written on the first read of a new `localDateKey`.
- **No App.jsx read.** Every counter already persists in localStorage, so progress is a pure diff
  (`src/progress/quests.js`, node-testable). This is why there are no WIN quests: WB / Blitz wins only
  exist in App's `game_over` path (Tier 1).
- Day = local date (`localDateKey`), the same boundary as the Daily Challenge.

## Where

Stats screen, a `TODAY` subsection as the FIRST `stats-subtitle` block, above PERSONAL RECORDS
(`StatsScreen.jsx:287`). There's no new menu widget and no fixed UI. There's no menu badge in v1 or v2:
quest pay is instant (see below), and the STATS count badge (`Homepage.jsx:1174`) stays for inbox claims.

## Rewards and economy

| Version | Reward | Economic impact | Gate |
|---------|--------|-----------------|------|
| **v1 (ship this)** | none: the ticks and `DONE` only | **zero** | none |
| v2 | each quest pays **3 WORDS** at the player's live rate (`perWordRateNow({mode}).rate`, `wins.js:405`), so it scales with KEY / rebirth and an R0 player isn't out-earned by a whale. 3/3 pays nothing extra. | max **+9 words/day**. The sim's day is one 60-min session (`SESSION_MIN`, `loop-sim.mjs:144`): median 10 wpm = 600 words/session gives **+1.5%**; casual 6 wpm = 360 gives **+2.5%**; a 15-min median player gets about **+6%**. | **CI sim + rule P** |

- **No BOOST for 3/3.** A `'boost'` claim defaults to ×3 for 10 min (`boost.js:11-12`). For a
  median player that's about +200% for 10 min, worth roughly 20× the quest pay. It's far too big,
  so it's cut (#2).
- **v2 gate:**
  1. Add a quest model to `claude/econ-oct2/loop-sim.mjs`: once per `SESSION_MIN`, credit 3 × 3 ×
     rate after the bot has played 3 rounds and 300 letters (the bots always meet these).
  2. Run CI `econ-sims.yml` job **`rule-p`** (`compare.sh` main → branch, 5 seeds, metrics
     `maxGapMin` / `worstKeyEtaMin` / `worstShopEtaMin` / `runawayFails`). It must show **no window
     WORSE**.
  3. Run job `long-run` (200 h) to check the LV50/100/225 reach times move by < 2%.
  4. Credit through the one door, `credit(granted, 'QUEST', { kind: 'quest' })`, so the receipt can
     itemise it. That needs a QUEST row in `PayoutBreakdown.jsx`, which is in v11's scope, so do v2
     after v11 merges.
- Claim policy: quest pay is earned BY PLAYING, like collection milestones, so it's `instant` in
  `claimPolicy` (`claims.js:40`) and stays out of the inbox (Andy oct2 E4 "TOO MANY REWARDS").

## Numbers summary

- 3 quests, 1 free reroll a day, 0 WIN quests, 0 rewards in v1.
- Targets: 3 rounds / 300 letters / 1 mode round. That's about 10-15 min of play to clear for a median
  player.
- v2: 3 words each, at most +9 words/day.
- UI: 3 rows × 44 px. Static, with no animation at rest; a row's `DONE` swaps in with the existing
  stats fade.

## Simplest version

v1 above: the Stats `TODAY` block with three counters and a reroll. No reward, no badge, no sim.

## Risks

- **Discoverability.** Stats only, so many players will never see it. That's the honest cost of no
  new menu UI. If Andy wants a nudge, the next step is the near-miss slot (`PLAY 1 MORE ROUND · QUEST
  DONE`), not a menu widget.
- **Chain/Fuse runs count on START** (`solo/shared.js`). Starting and quitting farms "PLAY 3 ROUNDS".
  With no reward in v1 it doesn't matter; in v2, count only runs that banked ≥ `MIN_WORDS`.
- **Third daily system** next to two streaks. If playtests say it's noise, cut it rather than tune it.
- **Clock changes.** Moving the device date forward gives new quests. With no reward in v1 that's
  harmless; in v2, cap at one completion set per day and never pay backwards.
