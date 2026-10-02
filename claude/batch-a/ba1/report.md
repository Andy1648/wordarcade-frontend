# BA1: bot playtest of every mode (50 games each), top 3 unfun moments per mode

Date: 2026-10-02. Code: frontend `origin/main` (a259259) and backend `origin/main`. Measurement only; nothing has been fixed. Each mode's sim drives the real game logic (imported, not re-implemented) against a median-human model whose assumptions are stated in its section. Every fix below was re-measured with the same sim.

**To re-run** (the sims read from a detached origin/main worktree, which has since been removed):
```
git -C <frontend> worktree add --detach ../ba1-wt origin/main
mkdir ../ba1-wt/_be && git -C <backend> archive origin/main | tar -x -C ../ba1-wt/_be
# PowerShell: New-Item -ItemType Junction -Path ..\ba1-wt\_be\node_modules -Target <backend>\node_modules
```
Each section gives the exact command for its numbers.

## Summary

Tier 1 marks backend live logic and App.jsx WebSocket wiring.

| Mode | # | Unfun moment | Key number | Fix (minimal) | Tier |
|---|---|---|---|---|---|
| WORD BOMB | 1 | Returning players' PLAY SOLO runs on CRAZY (medium preset) | 10% human wins (16% at n=400); 82% of games under 60 s | App.jsx:1910/1970/2172 `'medium'` → `'easy'` (43.8% wins) | 1 |
| WORD BOMB | 2 | A choking bot burns the whole fuse | 8–9% of bot turns, mean 13 s; 48–59% of games have a ≥15 s stretch | Concede via the skip path about 6 s after the fumble (roomManager.js:658-714) | 1 |
| WORD BOMB | 3 | CHILL opening: nobody loses a life for about 2 minutes | median 108–125 s; 59–72% of games have no loss in the first 90 s | chill startSeconds 20→15 plus MEDIUM bot miss 0.05→0.06 (win rate held at 48%) | 1 |
| CATEGORY BLITZ | 1 | US states and Human body systems in about 69% of games | 71.7% of back-to-back games share a category | Add 12 categories to the broad list (categoryBlitzLogic.js:625) | 1 |
| CATEGORY BLITZ | 2 | Dead rounds (median player finds fewer than 3 answers) | 12.7% of rounds; 12 categories dead more than half the time | Re-tier 4 categories to niche, pull 7 dead ones out of rotation | 1 |
| CATEGORY BLITZ | 3 | The bot ignores category difficulty and types aliases and misspellings | first to score in 99.5% of rounds; 20.7% of its answers are obscure; misspellings in the reveal | One canonical, popularity-ordered answer list per category; MEDIUM uses its top 60% | 1 |
| SAT RUSH | 1 | Per-card stage timing never applies, so x5 is unreachable | 0.0% of known words cleared at x5; 99.7% of clears at x1 | useSatRushGame.js:360 pass `c.row` (briefing only) | 2 |
| SAT RUSH | 2 | Lineup buzzer kills a player who is typing the right answer | 8–8.7% of lineup words; 29% at 11+ letters | engine.js:127 `200`→`350` ms per letter (plus a lose condition, a design call) | 2 |
| SAT RUSH | 3 | Briefing never ends and fills with unknowable tier-5 words | 50/50 runs hit the cap; 63.6% of words unknowable | autoRevealMax length−2, tierEvery 12→20 | 2 |
| CHAIN | 1 | The heat penalty kills normal play on E and S | 29–34% of deaths on a heated letter | chain.js:58-60 grace period `max(0,endCount−2)` | 2 |
| CHAIN | 2 | The multiplier resets to x1 mid-run | 39–46% of words after link 10 score at x1.0 | chain.js:174-176 drop one step instead of resetting | 2 |
| CHAIN | 3 | No tension for 10 links, then a fixed-length run | 0 timeouts in 10k early turns; every run 13–19 words | chain.js:50-52 timer curve | 2 |
| FUSE | 1 | FRENZY stalls on z, j, x, q | 30% reach it (20.8% over 1000 runs); 62% die with 23–25 letters lit | Steer to fragments that contain the letter; add `jo ju` to the pool → 58–74% | 2 |
| FUSE | 2 | The same fragment is served twice in a run (bug) | 34–36% of runs | fuse.js:171 checks the used-words set; use a servedFrags set → 3.6% | 2 |
| FUSE | 3 | About a minute with no tension, then a cliff | ~0% of turns expire in words 1–10; 42–51% expire in words 20–24 | fuse.js:13-15 fuseBase curve | 2 |
| RACE | 1 | A median typist always finishes last | 40 wpm: 0% first place, 100% last | wordRace.js:386-393 make bot speed follow the player's pace (or 210→300 ms/char) | 1 |

**Coverage:** every mode was covered. Race covers only the whole-word variant the menu launches, and its top 3 is one major issue plus a minor one; the fragments variant is not menu-reachable and was skipped.

**Model caveats:**
- Blitz uses a web word-frequency list (Norvig count_1w) for how well-known answers are, because `words.recall.txt` has almost no proper nouns.
- SAT Rush's knowledge curve and Blitz's per-topic familiarity are stated assumptions, not measurements.
- Use the 50-game win rates as rankings only (about ±7 pp). Word Bomb's balance comparisons use 400 games.

---

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

---

# CATEGORY BLITZ: top 3 unfun moments

**Sim:** `node claude/batch-a/ba1/blitz-sim.mjs [--seed N] [--games 50]` (≈20 s). Raw output is in `blitz-sim.txt`, and per-round, per-game and per-category data is in `blitz-sim.json`.

The sim imports the real backend logic from origin/main (exported to `../ba1-wt/_be`):
- `categoryBlitzLogic` for createGame, submitAnswer, endRound, startNextRound, rerollCategory and pickRandomCategory;
- `blitzLists` for answerKey and onList;
- `categoryBlitzBot` for buildAnswerSchedule and pickAnswer.

`Math.random` is seeded before load. Each run plays 50 games per scenario: 1 human against the default `add_bot` (MEDIUM), at difficulty medium (4 rerolls), for 3 × 30 s rounds. There are four scenarios:
- **noreroll**: the baseline.
- **reroll**: the solo player rerolls any prompt where they expect fewer than 3 answers.
- **fix** and **fix2**: the proposed data fixes below, applied by mutating the live `CATEGORY_TIER` and `CATEGORIES` objects.

Seeds 1, 2 and 3 were all checked; the numbers below are seed 1, with ranges across the three seeds.

## How the median human is modelled
`src/solo/words.recall.txt` cannot be used here. It has almost no proper nouns: kenya, ohio, zeus, mario, pikachu and macbeth are all missing, and Blitz answers are nearly all proper nouns.

Instead, popularity is the answer's rarest-token rank in Norvig's `count_1w.txt` (333k web unigrams, proper nouns included; copied next to the sim).
- **Knowledge:** P(know | fan) = 1/(1+(rank/15000)^1.5).
- **Fandom:** P(fan) is set by tier and pack: T1 1.0, general T2 0.8, sports/gaming T2 0.55, T3 gaming 0.3, T3 sports 0.4, other T3 0.55. A non-fan knows an answer at 0.12× that probability.
- **Recall:** 1.2 s to read the prompt, then lognormal(1.4 s × (1+0.15·i)) per answer.
- **Typing:** 40 wpm (0.30 s/char), with a 4% typo rate. A typo is rejected and then retyped.
- **Overall pace:** about 5 answers per 30 s on US states.

**Known weakness:** the corpus is 2006 web text, so it underrates post-2006 game names. For example, Pokémon starters scores ≈0, which is an artifact, and "wigglytuff" gets flagged as a misspelling.

---

## 1. The same two prompts in almost every game: "US states" and "Human body systems"

**Evidence**

A 20k-game draw check using the real `pickRandomCategory`:

| | Seed 1 | Seeds 2–3 |
|---|---|---|
| Games containing US states | 69.1% | 68.6–69.0% |
| Games containing Human body systems | 68.8% | 68.2–68.4% |
| Back-to-back games sharing at least one category | **71.7%** | 71.3–71.6% |
| The next most common category | 3.1% of games | — |

In the 50-game play runs:
- Both prompts appeared in 64% of games.
- Back-to-back sharing was 57–71%.
- Only 46–58 of the 88 categories were seen in 50 games.

**Root cause (backend, Tier-1: `categoryBlitzLogic.js`)**
- `TIER_WEIGHTS = { 1: 0.5, … }` at `categoryBlitzLogic.js:719` gives tier 1 half of every draw.
- `TIER_BROAD` (`:625`) was written for the old ~500-category library. STEP 9 cut play down to the 88 curated lists (`CATEGORIES = BLITZ_LISTS.NAMES`, `:609`), and only 2 of the `TIER_BROAD` names survive: `TIER_POOLS[1] = [Human body systems, US states]`.
- `pickWeightedByTier` (`:742`) picks the tier first and then a category within it. So each of those two categories gets ≈25% of round-1 draws. Every other category gets 0.3–0.9%.
- A rematch calls `createGame` again with a fresh `usedCategories`, so nothing stops the next game repeating them.

**Fix (data only)**
Add enumerable, broad curated categories to `TIER_BROAD` (`:625`):
- Asian countries
- European national capitals
- African countries
- US state capitals
- US presidents
- Summer Olympic sports
- Major human organs
- Pixar feature films
- Latin American countries
- NBA teams
- NFL teams
- English & British monarchs

Optionally, add a test that asserts `TIER_POOLS[1].length >= 10`.

**Measured result (`fix` scenario)**
- The most common category falls to about 11% of games.
- Back-to-back sharing falls from 71.7% to **20.1%**.
- The expected rate of rounds with fewer than 3 answers barely moves: 11.7% → 12.8%.

**Re-measure:** run the sim and read the "large-N draw check" lines, along with "back-to-back" in the fix scenario.

---

## 2. Dead rounds: prompts where the median player finds fewer than 3 answers in 30 s

**Evidence**

Rounds where the human found fewer than 3 answers:

| Scenario | Seed 1 | Seeds 2–3 |
|---|---|---|
| noreroll | **12.7%** of rounds; 4.7% had zero answers | 9.3–14.0% |
| reroll, with perfect self-knowledge | 6.0% | — |

The library-wide expectation, weighted by real draw odds, is **11.7%** of rounds.

By the category's own tier:

| Tier | Rounds with fewer than 3 answers |
|---|---|
| T1 | 0% |
| T2 | 8–24% (across scenarios/seeds) |
| T3 | 18–37% (across scenarios/seeds) |

By pack (noreroll): sports 42%, gaming 36% and history 40% of rounds had fewer than 3 answers.

In the full-library pass, 12 of 88 categories leave a median player with fewer than 3 answers more than half the time:

| Category | P(fewer than 3) | Note |
|---|---|---|
| Japanese shoguns | 1.00 | |
| Inca emperors | 0.99 | |
| Skyrim races | 0.75 | |
| Minecraft Ore Blocks | 0.69 | |
| Dark Souls 1 bosses | 0.66 | |
| Donkey Kong's Kong family | 0.62 | |
| Apex Legends legends | 0.59 | |
| Valorant agents | 0.56 | |
| Greek Titans | 0.54 | |
| Among Us tasks (The Skeld) | 0.53 | |
| Among Us colors | 0.52 | |
| Pokémon starters | 1.00 | Partly a corpus artifact |

**Root cause (backend, Tier-1: `categoryBlitzLogic.js`)**
- `tierForCategory` (`:702–707`) falls through to `return 2` for anything that is not in an explicit set or pattern. So Japanese shoguns, Inca emperors, Boxing weight classes and Major and minor keys are treated as MEDIUM.
- Each of them is drawn at ≈0.9% per round, which is **2.7× as often** as a genuinely niche T3 category (≈0.33%).
- The 7 deadest lists stay in rotation because `CATEGORIES` is simply every curated list (`:609`).
- Rerolls halve the problem, but only the host can reroll, and players do not know a prompt is dead until the clock is running.

**Fix (data only)**
1. Add Japanese shoguns, Inca emperors, Boxing weight classes and Major and minor keys to `TIER_NICHE` (`:671`).
2. Remove these 7 from rotation:
   - Japanese shoguns
   - Inca emperors
   - Skyrim races
   - Minecraft Ore Blocks
   - Dark Souls 1 bosses
   - Donkey Kong's Kong family
   - Pokémon starters

   Do this either by dropping them from `blitzLists.json`, or by filtering them out of `CATEGORIES` at `:609` with a small `BENCHED` set.

**Measured result (`fix2` = fix 1 + fix 2, 20k-game draw check)**
- Expected rounds with fewer than 3 answers: 11.5–11.7% (baseline 11.7–11.9%), so roughly flat. The extra breadth from fix 1 brings in harder T2 prompts, and this fix pays for them.
- Zero-answer rounds in play: 4.7% → 0.7–4.0% depending on seed.
- Back-to-back category sharing: 19%.

**Next lever (not measured):** lower `TIER_WEIGHTS[3]` from 0.15 to about 0.08. The remaining dead rounds are a long tail of T2/T3 lists at P(fewer than 3) = 0.2–0.5 (sports stadiums, F1, gaming franchises).

**Re-measure:** read `fix2:` in the "large-N draw check" lines, plus the "human < 3" lines.

---

## 3. The bot ignores how hard the category is, always scores first, and types aliases and misspellings

**Evidence (2,686 accepted bot answers across all scenarios)**

The bot lands 4.4–4.5 answers per round on every tier, while the median human drops from 4.84 (T1) to 3.65 (T3). Rounds where the bot beats the human by 4 or more go 0% (T1) → 5.7% (T2) → **10.8% (T3)**; across seeds the T3 figure is 5.8–10.8%.

| Measure | Value |
|---|---|
| Rounds where the bot's first answer lands before the human's first | **99.5%** |
| Bot answers that a fan of the topic would know less than 15% of the time | **20.7%** |

The bot is first nearly every round because its first answer comes 1.5–3.5 s into the round. The human needs ≥1.2 s just to read the prompt, plus typing.

Examples of obscure bot answers:
- "quasihemidemisemiquaver"
- "bridgerweight"
- "executioner smough"
- "capitate"
- "integumentary system"

On **Human body systems** (which is in about 68% of games):
- **47%** of the bot's answers are an alias rather than the canonical form.
- **5.9%** of the bot's answers double-score a system it already named, for example "nervous" and then "nervous system". The two have different answer keys, so both count.

The bot also submits the list's deliberate misspelling-catchers, and the round-end reveal shows them as the bot's answers:
- US states: "conneticut", "pennsylvannia", "tenessee", "mississipi"
- "squirtel"
- "ratatoullie"
- "wimbeldon"
- "posiedon"
- "jibouti"
- "vietnem"

**Root cause (backend live bot pacing — treat as Tier-1, because `roomManager.scheduleBlitzBotAnswers` drives it)**
- `categoryBlitzBot.js:118` sets `const set = new Set(curated.answers)`. That list mixes canonical forms with aliases and misspellings, and `pickAnswer` (`:115–130`) draws uniformly from it. It removes duplicates only by exact key, never by the underlying thing.
- `BOT_DIFFICULTY.medium` (`:67`) is `answers [4,5], firstDelayMs [1500,3500]` and is identical for every category.

**Fix (data plus about 5 lines)**
1. Add a `canon` array to each `blitzLists.json` entry: one correctly spelled form per member, ordered by popularity. The sim's grouping (`groupMembers` plus popularity rank) can seed it, followed by a hand pass.
2. Change `pickAnswer` to draw from `canon` only. It should skip any member whose canon key is already among its given answers. For MEDIUM, it should draw from the top 60% of `canon`.
3. Change MEDIUM `firstDelayMs` to `[3000, 5500]`.
4. Optional: scale `answers` by tier, so a MEDIUM bot on a T3 prompt gives `[3,4]`.

**Re-measure:** read the sim's "bot answer quality" block. The alias, misspelling and double-score rates should go to 0%. "Bot first" should fall below about 60%. T3 "hopeless" should match T2.

---

### Also found (not in the top 3)
- **Players can double-score one thing by typing singular and plural:**
  - `answerKey` (`blitzLists.js:45–63`) keeps the trailing "s". So **190** singular/plural pairs score twice, for example rib/ribs, carpal/carpals and bluebird/bluebirds.
  - The same applies to "X" plus "X system" on Human body systems.
  - Stripping a trailing s/es inside `answerKey` produced **0** collisions between different members across all 88 lists in the heuristic check. That makes it a safe one-line fix, but it is backend.
- **Round 1 usually decides the game:** the R1 leader went on to win 76–85% of non-tied games. That is normal for a 3-round sum and not a priority.
- **Win rate:** the median human beat the MEDIUM bot in 54–64% of games (66% with rerolls). Balance overall is fine; the problem is when the bot is first and which answers it gives (item 3).
- **Rerolls go mostly unused:** a smart solo player only uses 0.16–0.24 of their 4 rerolls per game. Rerolls fix about half of the dead rounds, but only when the player recognises the prompt as dead.

---

## SAT RUSH: top 3 unfun moments

**Sim:** `claude/batch-a/ba1/satrush-sim.mjs`. It drives the real `engine.js`, `config.js` `stageMs`, `input.js`, `briefing.js` `pickBriefing`, `lexicon.js` and `suspects.js` from origin/main (a259259). A 50 ms clock copies the hook's timers in `useSatRushGame.js` (L343-445 stage/spell-along/lineup window, L465-517 keys, L31-46 pauses). The recent-words ring (cap 250) and the lexicon persist between runs.

**Runs:** 50 seeded runs per mode (briefing and lineup), in two variants:
- 50 fresh players, one run each.
- One player playing 50 consecutive runs, so repeats across runs are real.

**Raw output:** `satrush-sim.txt` (shipped) and `satrush-sim-v1..v5-*.txt` (fix variants), each with a `.json`.

**Median player model:**
- **Vocabulary:** P(know) = 1/(1+(rank/18000)^2.5) on `words.recall.txt`. That gives 0.96 at rank 5k, 0.61 at 15k and 0.22 at 30k.
  - Words missing from the list get a per-tier floor: .40/.30/.18/.10/.04.
  - Mean P(know) by tier is .57/.43/.31/.18/.05.
  - 96% of tier-5 words come out as "unknowable" (P < 0.1).
- **Knowledge levels:** of the known words, 60% are "cold" (recalled from the sentence) and the rest need the definition. Of the unknown words, 35% are "partial" (recognized after 1-3 more letters) and the rest "none" (waits for the spell-along).
- **Speed and errors:** reads at 200 wpm, recalls in about 1.1 s, types at 35 wpm with 4% typos.
- **Guessing:** while letters drip in, the player makes occasional guesses. When a word is studied or comes back as a revenant, its recall gets a boost.
- **Lineup final stage:** the player picks one of the two remaining suspects. If the first letter bounces, they type the other one.
- **Run cap:** runs stop at 150 words or 30 minutes. Hitting the cap means the run never ended on its own.

### 1. The per-card stage beat never runs, so you can't earn x5 even on words you know

**Evidence (shipped):**
- **Briefing:** words the player knew cold from the sentence were cleared at x5 **0.0%** of the time, in both fresh and 50-run play.
  - 99.7% of all clears are x1; 98.6% were carried by the spell-along (2 or more letters revealed).
  - SILVER TONGUE was reached in **0/50** fresh runs and 10/50 in the 50-run sequence (median at word 120).
  - "Dead stretches" (5 or more words in a row with no x5/x3): 66 across 50 runs. The longest was 132 words, i.e. the whole run.
- **Cause:** every card plays at a flat 2800 ms beat. Stage 2 opens at 5.6 s, but a median reader needs about 7-8 s just to read a ~120-character sentence.
- **With the fix (v1/v2):**
  - Briefing cold words reach x5 25.8% of the time (fresh). The x3 share rises from 0.3% to 19% (fresh) and from 1.1% to 56% (50-run).
  - Silver is reached in 50/50 runs instead of 0/50.
  - My x5 rate stays below the 74.6% in `anteFairness.test.js` because my model adds recall latency and reading noise; the test does not.

**Root cause:**
- `useSatRushGame.js:360` calls `stageMsForCard(c)`, where `c = eng.getState().current` (L348) is the engine's *presentation* object.
- `engine.js:282-306` `buildPresentation` copies word, pos, tier, gloss, context, root and alts, but **not `costMs`**.
- So `config.js:79-82` `stageMs()` always takes the no-costMs fallback and returns `DEFAULT_STAGE_MS` (2800).
- The fix/sat-ante-fairness work is dead in production. Its tests pass because `anteFairness.test.js` calls `stageMs(row)` on the raw `words.json` rows.

**Fix:** one line. Either:
- `stageMsForCard(c.row)` at `useSatRushGame.js:360`, or
- add `costMs: row.costMs,` in `buildPresentation` (`engine.js:~290`).

**Required companion change:** keep lineup on the flat base. If you don't, lineup's ×3 scale (`engine.js:42`) multiplies the per-card beat: lineup stages become 18.8-27 s (p50 24.4 s), "none" words sit idle for 45 s (p50), and 75% of run time is idle (v1). Gate it like this:

```js
const base = tuned !== SAT_RUSH_STAGE_MS ? tuned : (modeRef.current === 'lineup' ? SAT_RUSH_STAGE_MS : stageMsForCard(c.row));
```

**Trade-off:** in briefing, unknown words now wait about 2 × 8 s before letters start (idle on "none" words goes from 8.6 s to 19.8 s p50). The spell-along cadence is unchanged.

**Re-measure:** `FIX_COST=1 LINEUP_BASE=flat node claude/batch-a/ba1/satrush-sim.mjs`. Check "'cold' ... cleared at x5", "ante at clear" and "SILVER".

### 2. In lineup, the last-call buzzer kills you while you're typing the right answer

**Evidence (shipped):**
- 8.0-8.7% of lineup words are misses, and they are 100% "walked-away".
- In **148/150 and 150/150** of those misses, the player had already picked the suspect and was typing when the window closed.
- Miss rate by word length: **3.1% at 3-7 letters, 11.8% at 8-10, 28.9% at 11+**.
- Lineup runs end only through these misses: all 50/50 runs die this way, with the first miss at word 15 (p50).
- So the lives in lineup measure typing speed against the buzzer, not vocabulary. Only 4.7-6% of misses were on words the player actually knew.

**Root cause:**
- `engine.js:127` `lineupWindowMs = round(2800*1.4) + len*200`, giving 5.1/5.7/6.3 s for 6/9/12-letter words.
- 200 ms per letter is 60 wpm. The cost model's median is 35 wpm, about 343 ms per letter.
- After a 1.6 s notice-and-pick, a 12-letter word needs about 5.7 s plus any typo recovery.

**Fix:** data/constant change, `len * 200` → `len * 350`.

**Result (v2):**
- 11+ letter miss rate drops from 28.9% to 2.7%; 8-10 letters from 11.8% to 1.4%; overall misses from 8.7% to 1.4%.

**Caveat:** this removes the only real way to lose lives in lineup. Runs then hit the 30-minute cap in 45/50 cases. Pair it with a knowledge-based stake.
- I measured one: "typing the wrong suspect at the 2-suspect stage is a miss" (`COINFLIP_MISS=1`, v5). It is too harsh: runs last 15 words (p50) and the first miss comes at word 4.
- A softer stake (for example, a wrong first letter at stage 2 costs the heat plus a fixed score penalty, not a life) needs a design decision.

**Re-measure:** `LW_PER_LETTER=350 node claude/batch-a/ba1/satrush-sim.mjs`. Check "lineup miss rate by length" and "ALREADY TYPING".

### 3. Briefing has no fail state, so runs drift into an endless treadmill of words nobody knows

**Evidence (shipped):**
- Briefing misses are 0.1-0.3% of words. **50/50 runs hit the 150-word / 30-minute cap** and never end.
- Players lose 0.04-0.18 of their 3 lives in the first 60 words.
- From word 48 on, every slot asks for tier 5. As a result:
  - **63.6% of all words shown in a fresh briefing session are median-unknowable** (67.6% in the 50-run sequence).
  - Tier 5 makes up 66% of words served and is 96% unknowable.
- Deep cuts (every 15th word) are 95-97% unknowable and cleared at x5 0.0% of the time.
- Each unknown word is about 12 s of watching letters drip in (8.6 s idle at p50). Overall, 41% of briefing run time is idle.
- Score just grows with time: p50 8.5k after 30 minutes, with a p10-p90 spread of only 8.3k-8.6k.

**Root cause:**
- `engine.js:417-418` sets `autoRevealMax = length-1` and `finalHoldMs = 2*tick`. To "miss" a word you have to fail to type **one** letter in 2.2 s, after the game has shown you all the others. Even three wrong guesses only trigger a spam reveal that completes the word.
- `engine.js:56` `tierEvery: 12` with `tierMax 5` (curve at `engine.js:94-97`) pins every non-deep-cut slot at tier 5 from word 48. The tier-5 pool is only 113 words, and the median can't know almost any of them.

**Fix (constants plus one expression):**
- (a) `engine.js:417`: `cw.length - 1` → `cw.length - 2`. The last letter is still never auto-revealed, but the player must supply the last two.
  - Note: CLAUDE.md describes the spell-along as "up to length−1", so that description needs updating too.
- (b) `engine.js:56`: `tierEvery: 12` → `20`.

**Result:**
- **(a) alone (v3, with the #1 fix):** briefing runs now end, 42/50 dying at p50 51 words / about 17 minutes. Misses are 5.2% of words, and **0%** of them were on words the player knew, so a lost life now means "I didn't know it", not "I typed slowly".
- **(a)+(b) (v4):** 47/50 runs end. The tier-5 share drops from 66% to 8.4%, and the unknowable share of words shown drops from 63.6% to 7.8%. Silver is reached in 94% of runs.

**Re-measure:** `FIX_COST=1 LINEUP_BASE=flat AUTO_LEFT=2 OVR='{"tierEvery":20}' node claude/batch-a/ba1/satrush-sim.mjs`.
- Read only the BRIEFING blocks. The v4 file also applied `lineupStageScale: 2`, which was a rejected lineup probe: it dropped lineup cold-word x5 from 26.5% to 0.2%, so keep the scale at 3.0.
- Check "run end cause", "tier 5: served" and "unknowable".

### Runners-up (measured, lower frequency × badness)
- **Lineup idle time:** 49-50% of lineup run time is spent waiting. Unknown words wait 13.8 s (p50) through two 8.4 s stages (2800 × 3). Lowering `lineupStageScale` to 2 cuts the idle but kills x5 (26.5% → 0.2% for cold words), so 3.0 stays. The cost is the waiting.
- **Lineup silver is basically free:** 98-100% of runs hit SILVER by word 5. 40-46% of clears made at silver were 2-suspect coin flips, because `heatMaxRevealed` (`engine.js:446`) counts revealed letters and lineup never reveals any. Requiring stage < 2 for the heat bump wouldn't change reachability (still 50/50 runs, post-hoc check), so this is cosmetic.
- **Honest guessing gets punished as spam (briefing, shipped):** 11.5% of fresh-player words had letter-guessing during the spell-along hit the third wrong key. That zeroes heat and pays less. This depends on my guessing assumptions; real data could confirm it via `word_resolved.revealed` and the spam-reveal analytics.
- **Repeats:** no word repeats from the previous run in lineup (0%), so the recent-words ring works there. In 50 consecutive lineup runs, the first 10 words of a run average 7.8 already seen in some earlier run but 0.0 from the last 3 runs. That's pool size (129 tier-1 words), not a bug.
  - Briefing's 62.8% "seen last run" figure is an artifact of 150-word sessions overflowing the 250-word ring. Within a run, a third appearance of the same word happened 0-4 times per 50 runs.
- **Early deaths:** no run in either mode died in under 30 s or within 5 words. "Decided in the first seconds" is not a SAT RUSH problem.

---

# BA1 — CHAIN + FUSE (solo) unfun moments

**Method.** `chain-sim.mjs` and `fuse-sim.mjs` import the real engines from origin/main
(`src/solo/chain.js`, `src/solo/fuse.js`, via `solo-common.mjs`; set `BA1_SRC` to point elsewhere). Word
data is built the same way `words.js` builds it (recall, accept, famous, common). The clock mirrors
`useSoloGame.js`:
- The budget is read when the turn starts (lines 130-138).
- Word 1 is armed on its first typed character (lines 166-178), so its think time is free.
- An accept restarts the clock (line 212). A FUSE expire serves the next fragment and restarts the clock (lines 153-156).
- A CHAIN timeout is always death (`ChainGame.jsx:82-85`).

**The median-human model** reuses the calibrated produce-time model from `claude/fuseThroughput.mjs:11`,
`winsmin-sim.mjs:85` and `econ-oct2/frenzy-sim.mjs:62`:

`produce = 1600 + U(0,4600) + 300·len + scarcity`

- Candidates are the first 30 unused known words for the prompt.
- Vocabulary is the top 15k of `words.recall.txt`. The 9k calibrated value was run as a sensitivity check; the results are within noise.
- Depletion: after the easiest remaining candidate passes rank 3000, recall slows by 500 ms per doubling of its rank.
- Typos: 4% of submissions, each costing 900 ms. A reject keeps the input.
- Aim: 0.5 (the frenzy-sim median value). FUSE aims at a still-dark letter; CHAIN aims at a fresh end letter.

**Runs.** Each sim ran 50 seeded games, which are the headline numbers. Each also ran 1000 games for stable percentages (`*-1000.*`). Fixes were re-measured by loading patched engine copies through `FUSE_JS=` / `CHAIN_JS=` (`*.probe-*.js` in this directory); `src` was not touched.

---

## FUSE

### F1. FRENZY stalls on z / j / x / q: steering serves fragments that don't lead there (most frequent × worst)
**Evidence**
- Only 30% of runs reach FRENZY (50 games). At 1000 games it is 20.8%, which matches econ-oct2's 19.2%.
- 60% of runs (62.3% at 1000 games) die with 23–25 letters lit and no FRENZY. The mean peak is 24.0 lit.
- Dark letters at death in runs with ≥20 lit (1000 games): **z 566, j 377, q 341, x 341**. The next letter is k at 76. In the 50-game set, z was still dark in 32 of 35 such runs.
- `fuse-diag.txt`: when steering serves a "lead" fragment for z, a random median-known answer lights z only 8.8% of the time. For j it is 3.6%, x 13.4%, q 18.5%. For k/v/w/y/b it is 52–73%.
  - Typical z leads are `io` (0 of 386 known words contain z), `ral` 0/67, `tal` 0/87.
  - j's best leads are `ct` (22/336) and `ad` (11/376).

**Root cause**
- `src/solo/fuse.js:149-156`: the "leads to" rule is a 3× lift over base rate, measured on the full 88k ACCEPT set. For z and j that lift comes from obscure `-ization` / `-ject` words that a median player never types.
- `fuse.js:169-173`: steering picks a random lead and does not prefer fragments that contain the letter.
- `fragmentPools.json`: j has no fragment in any pool, as `fuse.js:46` itself notes.

**Fix (minimal)**
1. `fuse.js:169-173`: before the lift-based leads, try the direct leads (`lead[t].filter(f => f.includes(ch))`) across the tier order. This is a 4-line patch; see `fuse.probe-direct.js`.
2. Data: add `jo ju` to the `m` pool in `fragmentPools.json`. Median players know plenty of words for these (job, join, major, enjoy, just, judge, injury).

**Measured (1000 games)**

| Change | FRENZY reached | Died at 23–25 lit | Frenzy at word | Words per run | Expire % |
|---|---|---|---|---|---|
| Main (no fix) | 20.8% | 62% | 18 | 18 | 11.0% |
| Fix 1 (direct leads) | **58.3%** | 35% | 16 | 18→19 | 11.0→12.1% |
| Fix 1 + Fix 2 | **73.9%** | 21% | 15 (91 s) | 19 | 12.5% |
| Fix 2 alone | 23.5% | | | | |

- Fix 2 does almost nothing on its own, because steering never prefers the new fragment. Fix 1 is the lever.
- If 74% is too generous for a ×5-wins event, ship Fix 1 alone, or keep both and raise `STEER_FROM` from 19 to 21.

**Re-measure**
```
GAMES=1000 FUSE_JS=<abs>/fuse.probe-direct.js POOL_ADD="m:jo,ju" node claude/batch-a/ba1/fuse-sim.mjs
```
After shipping, plain `GAMES=1000 node …/fuse-sim.mjs`. Check `frenzyRunPct` and `darkLetterAtDeath_whenLit20plus`.

### F2. The same fragment is served twice in one run (steering's no-repeat filter is a no-op)
**Evidence**
- 36% of runs serve a repeated fragment (50 games; 34.2% at 1000 games). That is 0.44 repeats per ~20-turn run.
- Examples: `mu`, `iti` (served three times), `lly`, `ia`.
- With steering off (`STEERP=0`), repeats drop to **0.1%**, so steering causes all of them.

**Root cause:** `src/solo/fuse.js:171`. The filter `!state.used.has(f)` tests a fragment against the set of used words, so it never excludes anything. Steering also bypasses the no-repeat bag (`fuse.js:63-81`, `fuse.js:182`). The 405 fragments that appear in more than one tier add a small remainder.

**Fix:** add `servedFrags: new Set()` to the state, add each fragment in `serve()`, and test `!state.servedFrags.has(f)` at line 171. See `fuse.probe-norepeat.js`.

**Measured:** repeats drop from 34.2% to **3.6%** of runs. FRENZY is 20.8% → 23.1% and nothing else changes. This is a bug fix, not a retune.

**Re-measure:** `GAMES=1000 FUSE_JS=<abs>/fuse.probe-norepeat.js node …/fuse-sim.mjs` and check `runsWithRepeatFragment`.

### F3. Difficulty cliff: about a minute with no tension, then death within ~8 words
**Evidence (1000 games, expire rate per turn by words solved × tier)**

| Words solved | Expire rate |
|---|---|
| 0–9 | **0–1.2%** (0 of 5,002 turns at words 0–4) |
| 10–14 | 8–12% |
| 15–19 | 24% (h) / 33% (m) |
| 20–24 | 42% (h) / 51% (m) |

- Runs end at 14–23 words (p10–p90), at 96–147 s.
- The brutal tier (`b`, ×1.3) is almost never served: 1 of 1,021 turns in the 50-game set. Runs die before `selectTier` (`fuse.js:33-37`) reaches it.

**Root cause:** `src/solo/fuse.js:13-15`, `fuseBase(w) = 3500 + 9000·e^(−w/15)`.
- At words 0–9 the fuse is 12.5 s down to 9.2 s, against a median need of about 6 s.
- It reaches the 3.5 s floor, which is below the median need, so the end is a cliff.

**Fix (constant):** `fuseBase = 4200 + 6000·e^(−w/18)`. See `fuse.probe-direct-curve.js`, which stacks it on F1's fix.

**Measured**
- Early expire rate: 0.4–5%.
- At words 20–29: 34–39% instead of 42–63%.
- Median run is still 18 words, and the spread widens (p10–p90 12–25).

**Caution:** `fuse.js:4-7` says these constants were adversarially fitted. Re-run the shortest-word-bot attack (`lenFactor`) before shipping. This is the lowest-priority of the three.

**Re-measure:** `GAMES=1000 FUSE_JS=<abs>/fuse.probe-direct-curve.js node …/fuse-sim.mjs` and check `hazardByWordsTier`.

**Non-issues measured**
- Dead turns (no known answer): **0%**.
- Thin turns (fewer than 3 known answers): 0%.
- Runs under 30 s: 0%.
- Static audit: no pool fragment has fewer than 3 median-known words.

---

## CHAIN

### C1. Heat kills normal play on E and S, the most common English endings (most frequent × worst)
**Evidence**
- 34% of deaths (50 games; 28.6% at 1000 games) happen on a heated letter, meaning `heatMul < 0.85` (≥3 prior endings on that letter).
- E is **20.2% of deaths but only 13.2% of landings** (1.53×).
- For a player who ignores end letters (`AIM=0`), **61% of deaths** are on a heated letter.
- Deaths happen at a 6.5 s budget (p50) against a median need of about 6.5 s. Heat's 12–18% cut is what tips the turn.

**Root cause**
- `src/solo/chain.js:58-60`: `heatMul = 1 − min(0.95, 0.06·endCount)`, with "no grace period". It is applied at `chain.js:130-132`.
- A non-exploiting player naturally ends on e or s 3–4 times in a 16-word run.

**Fix (constant):** add a grace of 2: `0.06·Math.max(0, endCount − 2)`. See `chain.probe-grace2.js`.

**Measured (1000 games)**
- Hot-letter deaths drop from 28.6% to **2.5%**.
- Median run goes from 16 to 18 words.
- For `AIM=0` players, hot-letter deaths go from 61% to 22%.
- The plural-pump exploit stays closed. A bot that always ends on s (`AIM=pump`) dies at **9 words** (8 on main), half of natural play.

**Re-measure**
```
GAMES=1000 CHAIN_JS=<abs>/chain.probe-grace2.js node …/chain-sim.mjs
GAMES=1000 AIM=pump CHAIN_JS=… node …/chain-sim.mjs   (exploit check)
```

### C2. The multiplier collapses mid-run: one repeated end letter resets it to ×1.0
**Evidence (1000 games)**

| Words linked (k) | Words at base ×1.0 | Words at cap ×2.5 |
|---|---|---|
| 5–9 | 26% | 30% |
| 10–14 | **39%** | 9% |
| 15+ | **46%** | 4% |

The advertised multiplier (`ChainGame.jsx:307`) mostly resets in the second half of a run. Only ~8 end letters are common, so a fresh one runs out quickly. Typo rejects also reset it (`chain.js:166`).

**Root cause:** `src/solo/chain.js:174-176`. A non-fresh end letter does `state.multiplier = CHAIN_MULT_BASE`, a full reset.

**Fix:** decay one step instead: `Math.max(CHAIN_MULT_BASE, state.multiplier − CHAIN_MULT_STEP)`. See `chain.probe-multdecay.js`.

**Measured:** at k 10–14, words at base drop from 39% to **0.6%** and words at the cap rise from 9% to 46%. Median score rises from 1263 to 1677 (+33%). The multiplier only feeds score and personal best (`ChainGame.jsx:86`), not wins, so this has no economy impact.

**Re-measure:** `GAMES=1000 CHAIN_JS=<abs>/chain.probe-multdecay.js node …/chain-sim.mjs` and check `multiplierByK`.

### C3. No tension for the first 10 links, then a fixed-length treadmill
**Evidence (1000 games)**
- At k < 10, **0 of 10,000 turns timed out**.
- Hazard then climbs: 6.8% at k 10–14, 29% at k 15–19, 46% at k 20+.
- Every run ends at 13–19 words (p10–p90, 71–105 s), so personal-best runs feel like reruns.

**Root cause**
- `src/solo/chain.js:50-52`: `chainT(k) = 4500 + 13500·e^(−k/10)`. That is 18 s for word 1, even though the clock is already armed-on-type, and 12.7 s at k=5.
- The 4.5 s floor (`chain.js:46`) is below the median need of about 5.9 s, so a cliff is guaranteed.

**Fix (constant, pair it with C1):** `chainT = 4500 + 6500·e^(−k/16)`. That gives 11 s at k=0, 9.3 s at k=5 and 6.4 s at k=20. See `chain.probe-grace2-curve.js`.

**Measured with grace2**
- Median run is 15 words (main: 16), and p10–p90 widens to 11–20.
- Late hazard softens to 23% / 39% instead of 29% / 46%.
- The pump bot dies at 7 words.
- Early hazard is only 0.6%. Real early tension would need a lower curve, which is a design call. This is the lowest-priority of the three.

**Re-measure:** `GAMES=1000 CHAIN_JS=<abs>/chain.probe-grace2-curve.js node …/chain-sim.mjs` and check `hazardByK` and `wordsPerRun`.

**Dead-end letters (x, q, z, j, k, y) are NOT an unfun moment (measured)**
- **0 of 1000 runs died on x, q, z or j.** k accounts for 3.7% of deaths and y for 5.1%, both roughly proportional to how often the chain lands there.
- The dead-end reroute (`chain.js:189-195`, `DEAD_END_BELOW=3` against the top 3000) fires 0.03 times per run.
- No landing left the median with fewer than 30 known unused starters (thin landings: 0%), and scarce turns were 0%.
- Every death was a plain clock death, never a no-words death. Of the ~1000 deaths, 0% were flagged dead end.
- No run died in its first 15 s of clock, and none ended under 5 words.

## Files
- `chain-sim.mjs` and `fuse-sim.mjs` are the sims. `solo-common.mjs` holds the shared loader and human model. `fuse-diag.mjs` / `fuse-diag.txt` contain the steering lead audit.
- `chain-sim.txt` / `.json` and `fuse-sim.txt` / `.json` are the 50-game runs. `*-1000*` are the 1000-game runs, and `*-v9k` is the vocabulary sensitivity run.
- `*-probe-*` are the fix re-measurements. `chain.probe-*.js` and `fuse.probe-*.js` are patched engine copies (src is untouched).
