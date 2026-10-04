# EXTENSIONS SPEC — six dormant hooks (oct3)

Read-only research + spec. All file:line refs are **origin/main @ 15ece21c** (the local branch
`docs/oct3-notes` is behind main; `src/progress/rollsFlag.js` only exists on main).
Lens: Andy oct3 #1 addictive feel · #2 don't overdo it · #3 numbers make sense · #4 big + obvious ·
#5 leaderboard = golden button · #6 fairness.

## RANKING (impact on #1 + #5 vs effort)

| # | Extension | #1 feel | #5 board | Effort | Economy | Tier |
|---|-----------|---------|----------|--------|---------|------|
| 1 | **b. NEAR-MISS line** | HIGH (every run, every player) | MED (board target is one of its candidates) | S | none | 2 |
| 2 | **a. RIVAL PINGS** | HIGH | HIGHEST | S–M | none | 2 |
| 3 | **c. MILESTONE escalation** | MED | LOW–MED | S (mostly exists) | none | 3 |
| 4 | **d. REBIRTH LADDER (Stats)** | LOW–MED | none | S | none | 3 |
| 5 | **f. CHALLENGE LINK (ghost race)** | MED | HIGH (friends) | L | none if ghost ≠ human rival | 1/2 |
| 6 | **e. DAILY QUESTS** | MED | LOW | L | YES: rule P + CI sim | 2 + econ |

**Build order: b → a → c → d → f → e.** b and a are small, client-only, reuse existing data and
surfaces, and both point the player at the board. c is mostly a tuning pass on moments that already
exist. d is cheap but it's on a back-room screen. f is the strongest *social* idea but it needs a share
surface that was deleted as unused, a new route and a ghost lane. e is the most work, adds a third
"daily" system next to two streaks, and is the only one that needs an economy sim.

## SHARED: the dormant flag

Copy `src/progress/rollsFlag.js` on main exactly: a hard-coded `X_ON = false`, then `?x=1`, then
`localStorage taw.xOn === '1'`. Six copies of the same 15 lines is what the rolls precedent did, so
it's acceptable, but **suggest one helper** `src/lib/dormantFlag.js` → `dormant('rival')` reading
`RIVAL_ON` / `?rival=1` / `taw.rivalOn`. Names:

| ext | const | URL | storage |
|-----|-------|-----|---------|
| a | `RIVAL_ON` | `?rival=1` | `taw.rivalOn` |
| b | `NEARMISS_ON` | `?nearmiss=1` | `taw.nearMissOn` |
| c | `MILESTONES_ON` | `?milestones=1` | `taw.milestonesOn` |
| d | `RBLADDER_ON` | `?rbladder=1` | `taw.rbLadderOn` |
| e | `QUESTS_ON` | `?quests=1` | `taw.questsOn` |
| f | `CHALLENGE_ON` | `?challenge=1` | `taw.challengeOn` |

---

## b. NEAR-MISS HOOKS (end screen) — BUILD FIRST

**Research**
- Near-miss effect: an almost-win reads as *progress*, not failure, and people retry straight away.
  It's the strongest "one more go" lever there is, and it turns manipulative when the "almost" is
  manufactured. [Medium: near-miss & almost-winning](https://medium.com/design-bootcamp/the-near-miss-effect-and-almost-winning-mechanics-378de92f88a8)
- Duolingo leagues: "you're 40 XP from the promotion zone" is the same trick, aimed at a rank.
  [Deconstructor of Fun: Duolingo leagues](https://duolingo.deconstructoroffun.com/mechanics/leagues)
- What makes it work: a TRUE number, small enough to finish in one more run, with the retry button
  right there. What makes it annoying: a fake "so close!" every time, or a stack of four progress bars.

**Spec**
- **Copy, ONE line, the closest real goal only:**
  `38 LETTERS TO LV 41` · `1 LV TO #7 ON THE BOARD` · `KEY POWER T5 IN 12 WORDS` · `REBIRTH IN 2 LV`.
  Use LETTERS for XP goals: Andy A9 says XP is paid per letter and the menu hint already says
  "N LETTERS … TO LEVEL" (`MenuXp.jsx:469-483`). Use WORDS for wins goals, because wins are quoted
  per word (`perWordRateNow`, `wins.js:405`). Every number goes through `formatNum`.
- **Rule (pure, `src/progress/nearMiss.js`):** work out each goal's distance as a share of THIS run's
  yield (letters or wins gained this run). Show the smallest one, and only if it's ≤ 1.0 run, i.e.
  "one more run gets it". Otherwise show nothing (#4: no useless info). Order to break ties:
  board > level > key power > rebirth.
- **Where:** a shared `<NearMiss>` mounted in the slot `ClaimPrompt` already takes on every end
  screen (`GameScreen.jsx:4173 / 4471 / 4943`, SoloShell for CHAIN/FUSE, `SatRushResults.jsx:157`,
  the race results in `WordRaceScreen.jsx`). If ClaimPrompt is visible, NearMiss hides, so the
  screen only ever has one big nudge. The line **is a button** (≥44px) that calls the screen's
  existing PLAY AGAIN / RESTART handler. That's the "one tap"; no new button.
- **Data:**
  - level / intoLevel: `loadProgress()`
  - letters to the next level: the same formula as `Homepage.jsx:1263`
  - next key tier cost: `keyTierCost(getKeyTier())` (`xp.js:426`, `xp.js:384`) − `getWins()`
  - board target: `nextTarget(rows, me)` (`boardTarget.js:11`), from the session's one cached board
    read that ClaimPrompt already does (`client.js` `rankIfClaimed` / `serverRankFor`); no new fetch
  - rebirth gate: `rebirthThreshold(getRebirths())`
  - this run's yield: snapshot `{level, intoLevel, wins}` into sessionStorage `taw.nm.start` when the
    run starts, and diff at the end screen
- **Economy:** none. Read-only.
- **Simplest version:** level + key power only (no board read). Add the board candidate in the same
  PR if ClaimPrompt's cached read is easy to reach.

## a. RIVAL PINGS (menu) — BUILD SECOND

**Research**
- Duolingo leagues push "Miller Johnson took your spot" and "you dropped out of the top 5": loss
  aversion tied to a NAMED person. Leagues raised lesson completion by about 25%.
  [Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/leagues) ·
  [Duolingo growth teardown](https://softwareandsynapses.substack.com/p/duolingo-an-actionable-case-study)
- Strava "Dethroned!" / lost-KOM mail: people change their next ride specifically to win it back.
  [Loving the Bike: Strava Attack](https://lovingthebike.com/strava-attack/) ·
  [Singletrack: losing a KOM](https://singletrackworld.com/forum/bike-forum/losing-a-kom-you-didnt-know-you-had/)
- Works because: it names the person, the gap is catchable, and there's an obvious way to win it back.
  Annoying when: it's a stranger 3,000 ranks away, or it pings on every small shift.

**Spec**
- **Copy, big:** `XAVI PASSED YOU` / sub: `#5 → #6 · 2 LV BEHIND` (or `LEVEL-TIED · MORE WORDS TAKE IT`,
  reusing the wording in `boardTarget.js:33`). Names are already filtered (`nameFilter.js`).
- **Where:** the EXISTING `RankUpMoment` card (`RankUpMoment.jsx:21`), given a `kind="passed"` variant.
  Same podium glyph and same 2.2 s finite card. Queue it at `PRIORITY.INFO` through the ONE moments
  queue (`menuMoments.js` `MENU_MOMENTS`: add `'rival'`), so it never stacks over a rank-up, wall or
  tier-up. The trophy's news dot (`Homepage.jsx:1154`) is the persistent reminder, and tapping the
  trophy opens the board. No new fixed UI.
- **Trigger:** the menu-mount check `submitStats → checkRankUp` (`Homepage.jsx:974-1000`) already
  calls `applyRankCheck` (`client.js:581`), which silently drops the `now > before` case today. On a
  drop, fetch the row directly above me:
  `leaderboard?select=rank,username,level&rank=eq.${now-1}` (the same REST view as `fetchBoard`,
  `client.js:351`; one GET, only on a drop).
- **Guards (fairness + don't overdo):**
  - Claimed players only.
  - **Skip if my own rebirth count rose since lastRank was stored.** Rebirth resets level to 1
    (`xp.js:329` `doRebirth`) and the board is LEVEL-only, so without this guard every rebirth would
    fire a fake "passed you". Store `taw.lb.lastRb` next to `taw.lb.lastRank`.
  - Only if the gap is catchable: ≤ 5 levels, and my rank is ≤ 50.
  - At most one ping per menu visit and 3 per day (`taw.lb.rivalDay`).
  - Never show the same passer twice in a row (`taw.lb.lastPasser`).
- **Economy:** none.
- **Simplest version:** no new realtime. The menu-mount REST check is enough. Later option: a live
  `tick` of kind `'pass'` on the existing broadcast channel (`live.js:156` `announceTick`). Not v1.

## c. MILESTONE MOMENTS — mostly SHIPPED; build only the escalation

**Already live:**
- tier-up card at LV 10 / 25 / 50 / 100 / 150 … (`menuTier.js:18` `LEVEL_TIER_STARTS`;
  `Homepage.jsx:662-678`)
- WALL re-form every 100 (`wallTier.js`; `Homepage.jsx:637-660`)
- ticker "ZED just hit LV 50" at 10 / 25 / 50k (`live.js:168` `isLevelMilestone`)

Building a new moment system would duplicate all of this (#2: cut before you add).

**Research**
- Apple Watch "All Rings Closed": 100 / 365 / 500 / 1,000, then every 250 days. Spaced out and
  escalating, so each one feels bigger than the last.
  [AppleMagazine](https://applemagazine.com/apple-introduces-interesting-all-rings-closed-awards/amp/) ·
  [9to5Mac Activity awards](https://9to5mac.com/2021/12/13/apple-watch-activity-awards/)
- Cookie Clicker ascension: the reset is the big moment, and everything between is small.
  [Cookie Clicker ascension calculator](https://west-games.com/cookie-clicker-ascension-calculator/)
- Annoying when every level gets a fanfare: escalation needs a quiet baseline.

**Spec**
- **Pure** `milestoneSize(lv)`: `lv % 100 === 0 → 'XL'`, `% 50 → 'L'`, `% 25 → 'M'`, `% 10 → 'S'`,
  else `null`.
- **Where:** the EXISTING level-up card, `MenuXp` `celebrate(level)` (`MenuXp.jsx:914`). Set
  `data-milestone="S|M|L|XL"` on the card. CSS scales its peak with transform only
  (1.0 / 1.12 / 1.25 / 1.4) and holds it +0 / 150 / 300 / 450 ms. Kicker copy `MILESTONE`, and the
  title stays `LEVEL 50`. Nothing loops; reduced motion gets the same text, static.
- XL and L already get the wall and/or tier-up. **Do not add a third card on those levels.** The size
  class only enlarges the level-up card that already plays first.
- Sound: the existing level-up sfx, one pitch step per size. Web Audio, no files.
- **Economy:** none. No wins for milestones (Andy oct2: anything outside play is CLAIMED; this pays
  nothing, so there's no claim either).
- Update `CARD_MS` users in `menuMoments.js` if the hold grows (the queue's maxMs).
- **Simplest version:** S/M only (the 20, 30, 40, 75, 125 … levels that currently get a plain level-up).

## d. REBIRTH LADDER (Stats)

**Research**
- +1 Speed Keyboard Escape: the rebirth button "shows you exactly what you get", which is always one
  multiplier, and speed is visibly a stack (base × rebirth × trail × aura).
  [allthings.how guide](https://allthings.how/1-speed-keyboard-escape-how-to-build-speed-farm-wins-and-rebirth/) ·
  [bloxodes rebirths](https://bloxodes.com/wiki/1-speed-keyboard-escape/rebirths)
- Cookie Clicker heavenly chips: prestige is one number you watch climb.
  [ascension calc](https://west-games.com/cookie-clicker-ascension-calculator/)

**Spec**
- **Copy, one row of chips:** `BASE ×1 → R1 ×2 → R2 ×3 → [ R3 ×4 · AT LV 40 ]`.
  - The NEXT chip is yellow (#FFE94A) with a hard shadow, and it's the only highlighted thing.
  - Past chips are flat cyan. One greyed chip after NEXT.
  - Collapse anything older than 2 back into `…`, max 5 chips, wraps at 360px.
- **Where:** Stats → MENU TYPING XP block. It **replaces** the bare `['REBIRTH', x(rbMult)]` row
  (`StatsScreen.jsx:203`) rather than adding a section (#2).
- **Data:**
  - `rebirthMult(rc) = 1 + rc` (`xp.js:305`, v9)
  - gate: `rebirthThreshold(rc)` (`xp.js:~296`, honours the grandfathered gate) /
    `tableRebirthThreshold` (`xp.js:265`)
  - count: `getRebirths()`
- **Honesty note (#3):** v9 is linear, so each step's % gain shrinks (R1→R2 +50%, R10→R11 +9%).
  Show `×N` on every chip and the `+N%` ONLY on the NEXT chip. ShopScreen already prints the same
  `×a → ×b (+N%)` (`ShopScreen.jsx:405`), so the two stay in agreement. If Andy dislikes how flat the
  late ladder looks, that's an economy question, not a UI one.
- **Economy:** none. **Simplest version:** BASE, current, NEXT. Three chips.

## f. CHALLENGE LINK (ghost race)

**Research**
- Wordle's share grid: brags without spoiling, so sharing is socially safe, and every grid is a peer
  invite. [Smithsonian](https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/) ·
  [buildd teardown](https://buildd.co/product/wordle-the-viral-sensation)
- Mario Kart friend/rival ghosts: race a friend's actual run asynchronously. It's semi-transparent,
  can't touch you, and there's always a time to beat.
  [MarioWiki: Ghost](https://www.mariowiki.com/Ghost_(Mario_Kart_series))
- Strava segments: the async "beat my time" loop. ([see a](https://lovingthebike.com/strava-attack/))
- Annoying when the link lands on a marketing page (we've hit this ourselves: `links.js:22-30`), or
  when the challenge costs the friend anything.

**State today:**
- There is **no result-share button anywhere**. fix/econ-perf-attack deleted the share-card pipeline
  as unused (`links.js:6-9`). `buildResultCard` (`resultCard.js:104`) survives with no caller.
- Race has no deep link (`router.js:50-59`).
- Whole-word bots **ignore reported pace**: they type at a fixed 300 ms/char
  (backend `wordRace.js:388-394`). So a "pace = friend's pace" bot is NOT available without a
  backend change.

**Spec (frontend-only v1, no WS / backend change):**
- **Sender** (race results card, `WordRaceScreen.jsx`): one button, `CHALLENGE A FRIEND`. It uses
  `navigator.share`, with copy-to-clipboard as fallback (`RoomScreen.jsx:161-176`). Text, Wordle-style
  and spoiler-free:
  `TYPE A WORD — RACE · 25 WORDS IN 41.2s · BEAT ME:` + link.
  Link: `/race/play?vs=XAVI&g=<25 split times, base36, comma-joined>`. No words in the URL.
- **Receiver:**
  - `router.js` maps `/race/play` → the existing quick match (`App.jsx:2253`, `race_quick_match`).
  - The race renders ONE extra local lane `XAVI'S RUN` in `.wr-lanes` (`WordRaceScreen.jsx:190`),
    driven by `g` against the race's `goAt` (raceState already converts server time). Ghost styling
    is opacity, no art.
  - End line: `YOU BEAT XAVI BY 3.2s` / `XAVI WINS BY 1.1s` + `SEND IT BACK` (the loop).
- **Data:**
  - my splits: record local timestamps per accepted word of mine in the race reducer (pure,
    `raceState.js:32`). `recordPace` (`racePace.js:26`) only keeps the total.
  - name: `getMyProfile().username` if claimed, else `A FRIEND`.
- **Economy / fairness:**
  - The ghost is display-only. It's never in `standings`, never a `winnerId`, and **never counts as a
    HUMAN RIVAL** for the H4 winner bonus (`payout.js:239` `winnerPayout`; `seats.js`). Race pay is
    unchanged, so no sim is needed.
  - Tamper risk is nil: a fake fast ghost only makes the friend's goal harder.
- **Tier:** router boot + App launch path = treat as Tier 1 (2-device test). Lane render = Tier 2.
- **Simplest version:** skip the ghost lane. Show the target `BEAT XAVI: 41.2s` on the HUD and the
  verdict at the end.

## e. DAILY QUESTS — BUILD LAST

**Existing:**
- the daily streak `taw.streak` (`progress/streak.js`: XP multiplier up to ×1.25 and freeze tokens,
  explicitly "an achievement, never a contract … no guilt copy")
- the Daily Challenge streak (`daily/streak.js`) and its seed (`daily/dailySeed.js`, CHAIN / FUSE /
  BLITZ)

A third streak would be #2's "doing too much".

**Research**
- Clash Royale daily tasks (copying Brawl Stars quests): 3 a day, all visible together, a daily bonus
  for clearing all 3, and a weekly bonus for 7/7.
  [Mobile Matters](https://mobilematters.gg/clash-royale/supercell-introduces-daily-tasks-to-clash-royale)
- Brawl Stars complaint: "WIN 20" quests feel rigged because you take 60–80 losses for 20 wins, and
  mode/brawler-forcing quests make people throw matches.
  [devtrackers](https://devtrackers.gg/brawl-stars/p/c878a5c4-bad-randoms-is-a-distraction-you-lose-a-lot-because-the-game-is-rigged)
- Duolingo Friends Quests: a shared, cooperative weekly goal, which cuts guilt and adds a friend.
  Their lesson: ship the "dumbest" version first and cap the scope.
  [Friends Quests](https://blog.duolingo.com/friends-quests/) ·
  [Friend Streak lessons](https://blog.duolingo.com/product-lessons-friend-streak/)

**Spec**
- **Copy:** 3 rows, e.g. `PLAY 3 ROUNDS 1/3` · `TYPE 300 LETTERS 120/300` · `WIN 1 WORD BOMB ROUND 0/1`.
  The streak shown is the EXISTING `taw.streak` count (`getStreak()`, `streak.js:96`). No new streak.
- **Rules (fairness):**
  - Draw quests only from UNLOCKED modes (`modeAccess.js:41` `isModeLocked`).
  - At most one WIN-type quest a day, and it's always winnable solo vs bot (WB PLAY SOLO).
  - Never "win N".
  - Reroll is free once a day.
  - Seeded from `localDateKey` (`dailySeed.js:21`), so everyone gets the same three (Wordle effect).
- **Tracking:**
  - rounds: `recordRound` (`wins.js:655`)
  - letters: `getLetters`
  - WB win: App's game_over winner path (`winnerPayout` caller, `payout.js:239`). That's an App.jsx
    read, so Tier 1.
- **Where:** Stats screen, top section `TODAY`. Completed quests queue a claim
  (`claims.js:128` `queueClaim`, kind `'quest'`), so the STATS corner-nav badge lights. That's the
  only menu signal. No new menu widget.
- **Rewards / economy:**
  - Each quest pays `N WORDS` at the player's current rate (the per-level code idea), so the reward
    scales and an R0 player isn't out-earned by a whale.
  - 3/3 pays an existing `'boost'` claim (×2, 10 min), which only pays if they keep playing.
  - **This moves the economy: it needs a CI sim run + rule P (no window worse)** before the flag is
    flipped, same as MARK ROLLS was held (rollsFlag.js header).
- **Simplest version:** quests with NO reward beyond the claim-badge tick and the existing streak.
  That's zero economy risk; add rewards after a sim.

---

## ONE LINE EACH

1. **b NEAR-MISS:** one tappable line on every end screen ("38 LETTERS TO LV 41"), shown only when one
   more run gets it. Reuses ClaimPrompt's slot. S, no economy.
2. **a RIVAL PINGS:** "XAVI PASSED YOU · 2 LV BEHIND" as a RankUpMoment variant on rank drops. One
   extra GET, must skip own-rebirth drops. S–M, no economy.
3. **c MILESTONES:** already ~80% live (tier-ups, wall, ticker). Just scale the existing level-up card
   S/M/L/XL at 10/25/50/100. S.
4. **d REBIRTH LADDER:** chips BASE ×1 → … → NEXT ×N AT LV X replacing Stats' REBIRTH row. Exposes
   v9's shrinking % per step. S.
5. **f CHALLENGE LINK:** share button + `/race/play?vs=&g=` + a local ghost lane. Frontend-only, but
   needs a share surface that was cut and a Tier-1 launch path. L.
6. **e DAILY QUESTS:** 3 seeded, unlocked-mode-only quests in Stats, claimed via the STATS badge,
   reusing the existing streak. Rewards need a CI sim + rule P. L.
