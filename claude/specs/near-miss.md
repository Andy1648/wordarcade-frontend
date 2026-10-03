# NEAR-MISS LINE (end screen)

Status: **being built** on `feat/ext-nearmiss` (PR #170). This spec records what that PR does
and the numbers it uses. The file:line refs are origin/main @ 15ece21c unless they say PR #170.
Flag: `flagOn('nearmiss')` (`src/lib/featureFlags.js` on PR #170). Turn it on with `?nearmiss=1`
or localStorage `taw.flag.nearmiss = '1'`.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| Candy Crush Saga | The fail screen says how close you were (e.g. "1 move short") and offers to continue. A Waterloo study of 60 players found near-misses produced the biggest urge to keep playing of any outcome, more than wins or losses. [UWSpace thesis](https://uwspace.uwaterloo.ca/handle/10012/12522) · [Springer paper](https://link.springer.com/article/10.1007/s10899-016-9633-7) | "Almost" drives the next run, but only when the number is true. |
| Duolingo Leagues | Messages like "40 XP to the promotion zone" and "You're out of the top 5". [Deconstructor of Fun: Leagues](https://duolingo.deconstructoroffun.com/mechanics/leagues) | Phrase the gap in units the player controls, and point it at a rank. |
| Slot near-miss (the anti-pattern) | A fake "so close" is manufactured to keep people pulling. [YourStory: near-miss psychology](https://yourstory.com/2026/07/slot-machines-near-miss-psychology-gambling-games) | Never manufacture closeness. Show the line only when one more run really gets there. |

## Copy (one line, closest real goal only, every number through `formatNum`)

- `38 LETTERS TO LV 41`: level goal. Letters, because XP is paid per letter (Andy A9; the menu hint
  already uses this wording at `MenuXp.jsx:476`).
- `1 LV TO #7`: board goal, only when a cached row above is known.
- `KEY POWER T5 IN 12 WORDS`: wins goal. Words, because wins are quoted per word
  (`perWordRateNow`, `wins.js:405`).
- No rebirth line. The rebirth gate always sits at or beyond the next level, so it can never be the
  closest goal. PR #170 leaves it out.

## Where

- The ClaimPrompt slot on every end screen:
  - `GameScreen.jsx` WB / Blitz results
  - `ChainGame.jsx`, `FuseGame.jsx`
  - `SatRushResults.jsx:157`
  - `WordRaceScreen.jsx` results
- CSS `.lb-cp ~ .nm-line` hides it while ClaimPrompt shows, so a screen only ever has one nudge.
- The line **is** the PLAY AGAIN button (≥ 44 px tall). It calls the screen's existing
  restart handler. No new button and no fixed UI.

## Trigger

Mount of the end screen, computed once (`useState` initialiser). It shows only if
`distance / avgRunYield ≤ NEAR_MISS_MAX_RUNS (1.0)`, otherwise it renders nothing.
Ties go board > level > key.

## Data

| Input | Source |
|-------|--------|
| level, frac | `loadProgress()` `xp.js:751` |
| XP to finish a level | `need(lv)` `xp.js:165`, floored by `barFloor.js` |
| XP / wins per reference word | `perWordRateNow({mode})` `wins.js:405` |
| next key tier cost / balance | `keyTierCost(getKeyTier())` `xp.js:426` / `xp.js:384`; `getWins()` `wins.js:81` |
| run yield | lifetime letters `getLetters()` `letters.js:28`, diffed via sessionStorage `taw.nm.start`, smoothed in localStorage `taw.nm.avg` (PR #170 `nearMissData.js`) |
| fallback yield | `TYPICAL_ROUND_WORDS = 10` `wins.js:167` |
| board row above (later) | `nextTarget(rows, me)` `boardTarget.js:11` |

## Numbers

| Knob | Value |
|------|-------|
| `NEAR_MISS_MAX_RUNS` | 1.0 run |
| `LETTERS_PER_WORD` | 5 (= wins.js reference word) |
| Smoothing of the run average (`nextAvg`) | EMA as on PR #170 |
| Max lines per screen | 1 |
| Line height | ≥ 44 px |
| Font | Bungee, the size of the existing PLAY AGAIN label |
| Animation | none at rest; the existing button press only |

**Economy impact: none.** The line is read-only. It nudges play-again rate, but every extra run is
paid by the unchanged per-word economy, so rule P is not affected.

## Simplest version (what PR #170 ships)

Level and key-power candidates only. There's no board read, because claimed players have no cached
row above them on the end screen yet.

## Risks

- **Stale average after a long break.** The first run back uses an old EMA. Mitigation: if the
  average is missing or older than 1 day, fall back to `TYPICAL_ROUND_WORDS`.
- **v11 rework (feat/pv11) changes XP/letter and wins/word.** `nearMissData.js` reads them through
  `perWordRateNow` / `need`, so it follows automatically. Re-run `nearMiss.test.js` after v11 merges.
- **Over-nudging.** It shows on most runs for low-level players, where levels are cheap. That is
  acceptable because the line is itself a play-again tap, not a new action. If playtests say it
  feels naggy, raise the bar from 1.0 to 0.5 runs ("half a run gets it").
