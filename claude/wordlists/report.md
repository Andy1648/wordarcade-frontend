# STEP 55 — word lists (Andy, Oct 2): before → after

Probe: 3,910 common words (952 hand-picked months/days/continents/countries/states/cities/
nationalities/holidays/planets/mild insults/modern words + the 3,000 most common game words).
Re-run: `node claude/wordlists/measure.mjs` (solo) — the Word Bomb number is from the backend's
own `isValidWord` (chain-reaction-backend PR #9).

| | before | after |
|---|---|---|
| FUSE: fragments where a common real word containing it is rejected | **74.3%** (762/1026) | **1.3%** (13/1026 — all from "smartwatch") |
| FUSE / CHAIN: probe words rejected | 16.0% (627) | 0.03% (1) |
| CHAIN: start letters with a rejected common word | 26/26 | 1/26 |
| Independent check: top-25k web-corpus words rejected | 5,714 | 5,223 (491 fewer) |
| **Word Bomb** (backend PR #9): probe words rejected | **16.8%** (657) | **0.1%** (5: google, intel, christian, jesus, smartwatch — left out on purpose) |

Added: 626 words to the solo accept list (`src/solo/words.common.txt`, accepted from the first run);
a 951-word allowlist in the Word Bomb backend (the same categories, incl. the words the solo lists
already had). Single words only (the input takes no spaces).

**Safety:** every candidate checked against the slur list, the slur+profanity display list and the
leaderboard name filter. Deliberately NOT added: imbecile, cretin, retard (ableist), psycho,
nutjob, nutcase (mental-health stigma), fatso, hick, redneck, scumbag, jackass, dumbass and
similar; religious group nouns; brand names. "smartwatch" fails the name filter ("twat") and stays out.

SAT Rush: you type one known target word, so there is no open list to widen.
