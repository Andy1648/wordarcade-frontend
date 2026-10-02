## WORD BOMB (PLAY SOLO: 1 human vs a MEDIUM bot)

Sim: `claude/batch-a/ba1/wb-sim.mjs`. It drives the real backend origin/main code: `gameLogic.js` (createGame, submitWord, handleTimeout, pickRandomCombo, timer), the real `dictionary.js`, and `wordBombBot.js` rollMiss / computeDelayMs / pickWord, wired the way `roomManager.js:697-740` wires them. The human always moves first.

**Median-human model.**
- Vocabulary: the top 12k of `words.recall.txt`, plus 10+ letter words ranked under 12k in `botWords.txt`. The recall list only holds 3-9 letter words.
- Thinking time: lognormal with median 2.0 s + 14 s / sqrt(k), sigma 0.6. Here k is the number of known, unused, valid words containing the combo.
- Typing: 0.30 s per letter, plus 0.25 s to submit. A 4% typo rate makes the player retype.
- Sensitivity runs at 8k and 20k vocabulary give the same ranking.
- The 50-game runs are the headline numbers. I used 400-game runs (`*-n400`, `*-chillfix*`, `*-combo-*`) to compare win rates, because 50 games is ±7 pp.

PLAY SOLO room preset: `hasPlayedBefore() ? 'medium' : 'chill'` (frontend `src/App.jsx:2172`, also `:1910` and `:1970`). So **every returning player plays MEDIUM ("CRAZY")**. The 51% win-rate retune only covered CHILL.

### 1. Returning players are put on CRAZY: about 10% wins, and 82% of games end in under 60 s (frequency: every PLAY SOLO after the first; severity: high)

**Evidence** (MEDIUM preset vs MEDIUM bot, 50 games):

| Metric | MEDIUM preset |
|---|---|
| Human win rate | 10% (16.0% at n=400) |
| Median game length | 53 s |
| Games over in < 60 s | 82% |
| Human loses a life in the first 30 s | 32% |
| Human reaches last life while the bot still has both | 74% |
| Human loses every life before the bot loses one | 50% |
| Human fail rate at the 4 s floor | 25/27 |

The bot never loses on speed. Its delay is clamped to fuse − 0.9 s. Its only weakness is the 13% pressure miss, which tops out at 8 s. So at a 4 s fuse the bot misses 13% while the human misses 93%.

**Root cause:**
- frontend `src/App.jsx:2172` (also `:1910` and `:1970`): `hasPlayedBefore() ? 'medium' : 'chill'`.
- backend `gameLogic.js:36`: `medium: {startSeconds:10, decreaseEveryNTurns:2, floorSeconds:4, lives:2}`. The 4 s floor arrives at turn 12.
- backend `wordBombBot.js:146-155`: the pressure curve stops at `PRESSURE_FLOOR_S = 8`.
- backend `wordBombBot.js:193-197`: the bot's delay is clamped under the fuse.

**Fix** (frontend only, 3 one-word changes): `hasPlayedBefore() ? 'easy' : 'chill'` at App.jsx 1910, 1970 and 2172. This still gives returning players a step up (15 s start, 6 s floor, 2 lives).
- Measured, n=400: human win rate goes from 16.0% to 43.8%. Games under 60 s go from 82% to 4%.
- With fix #3's bot change it reaches 52.3%.
- App.jsx sends WS frames, so treat this as **Tier 1 (App.jsx)**. It is a constant change only.

**Re-measure:** `node claude/batch-a/ba1/wb-sim.mjs 400` and read the EASY block.

### 2. Bot "fumble" dead air: a choking bot burns the whole fuse while the human watches (8-9% of bot turns; 48% of CHILL games have a ≥15 s stretch)

**Evidence** (CHILL, 50 games):
- 101 of 1225 bot turns are chokes (8.2%).
- Each choke lasts the full fuse: mean 12.9 s, up to 20 s.
- 48% of games contain at least one fumble of 15 s or more (59.0% at n=400).
- The fumble animation runs at most 6 dead-end attempts (`FUMBLE_MAX_TRIES`), then the board sits until the timer fires.

**Root cause** (backend, **Tier 1**):
- `roomManager.js:711-714`: on `rollMiss` it schedules only `scheduleBotFumble` and lets the turn timer (`roomManager.js:374-410`) run to 0.
- `wordBombBot.js:214-218` sets the fumble constants.

**Fix:** in `scheduleBotFumble` (`roomManager.js:658-686`), after the last plan step plus about 600 ms (capped at about 6 s from turn start), concede the turn through the existing skip path. That is `handleTimeout(game, 'skip')` plus the same broadcasts as the `skip_turn` handler at `server.js:565-600`. The same life is lost, just sooner.
- Measured with `WB_FUMBLE_CAP_S=6`, n=400: mean fumble goes from 13.3 s to 6.0 s, games with a ≥15 s fumble go from 59% to 0%, and win rate is unchanged (47.5% vs 47.5%). Median game length drops from 270 s to 256 s.

**Re-measure:** `WB_FUMBLE_CAP_S=6 WB_PRESETS=chill node claude/batch-a/ba1/wb-sim.mjs 400`

### 3. CHILL's slow opening: nobody loses a life for about 2 minutes (59-72% of first-timer games; severity: medium, and it is the first game a stranger plays)

**Evidence** (CHILL, n=50; n=400 in brackets):
- Median time until anyone loses a life: 125 s (108 s).
- Games with no life lost in the first 90 s: 72% (59.3%).
- Human fail rate is 1-4% per turn while the fuse is ≥ 14 s.
- Median game length is 278 s (270 s), about 50 turns. Everything is decided at the 8 s floor, where the human fail rate is 41/149.

**Root cause:**
- backend `gameLogic.js:34`: `chill: {startSeconds:20, decreaseEveryNTurns:4, ...}`. It takes 48 turns to reach the floor.
- backend `wordBombBot.js:122`: the MEDIUM bot misses only 5% at a full fuse.

**Fix** (constants, backend **Tier 1**): chill `startSeconds` 20 → 15, and MEDIUM bot `miss` 0.05 → 0.06 (`wordBombBot.js:122`) so the win rate holds.
- Measured, n=400: median time to the first life lost goes from 108 s to 57 s, and no-loss-in-90 s games from 59% to 25%. Game length goes from 270 s to 178 s.
- Win rate goes from 47.5% to 48.0% (EASY preset: 52.3%).
- Without the miss bump, starting at 15 s alone drops the win rate to 37%.

**Re-measure:** `WB_BOT_BASE=0.06 WB_PRESETS=chill,easy WB_PRESET_CHILL='{"startSeconds":15}' node claude/batch-a/ba1/wb-sim.mjs 400`

**Checked and not a problem:**
- Dead combos: 0 of 1254 human turns had ≤3 known answers. Only `kle` (5 known) and `zz` (9) fall under 10 known, and they are drawn 0.1-0.7% of the time.
- Bot plays unknowable words: 3.9% of bot words fall outside a 12k vocabulary, 0.2% outside any list.
- Repeated combos: 3.6% of serves.

## RACE (whole-word variant, the one the menu launches: App.jsx:2151 `variant: 'words'`)

Sim: `claude/batch-a/ba1/race-sim.mjs`. It uses the real `wordRace.js` (createRace, useWordsVariant, checkWord, applyAccept, standings, botFactor, botTypeDelayMs, botsNeeded), scheduled like `wordRaceMode.js:175-200`. A solo player gets 2 bots (factors 0.88 and 1.12). The human takes 350 ms to read and react, then types (len+1) characters at W wpm, with a 4% typo rate.

### 1. A median typist can never win, and is always last (100% of solo races)

**Evidence** (50 races per typing speed):

| Typing speed | 1st place | Last place |
|---|---|---|
| 40 wpm | 0% | 100% |
| 50 wpm | 0% | 74% |
| 60 wpm | 0% | 4% |

- The race ends when the first bot finishes (median 38 s). A 40 wpm human is stopped at 15 of 25 words.

**Root cause** (backend, **Tier 1**):
- `wordRace.js:386-393`: the whole-word bots type at a fixed `BOT_REACT_MS 260 + 210 ms/char`, about 52-57 wpm before the 0.88 factor.
- `wordRaceMode.js:181-183`: the words branch ignores `g.botPaceMs`, the human's reported pace, which only the fragments variant uses.

**Fix options:**
- Minimal: `BOT_MS_PER_CHAR` 210 → 300. At 40 wpm this gives 0% 1st and 8% last; at 50 wpm, 62% 1st.
- Better: scale the per-char time by the human's pace, the same way the fragments variant uses `seedPace`, so there is "one bot to chase, one to beat" as the `BOT_SPREAD` comment intends. For example, `perChar = clamp(g.botPaceMs/6)` when a pace is known, and 300 otherwise.

**Re-measure:** `RACE_BOT_MS_PER_CHAR=300 node claude/batch-a/ba1/race-sim.mjs`

**Minor:** across 50 races, 61 words appeared in 3 or more races (pool: 1,984 words). Low priority.
