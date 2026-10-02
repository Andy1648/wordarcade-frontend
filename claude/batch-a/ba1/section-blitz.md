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
