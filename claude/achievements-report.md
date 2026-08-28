# JOB 7 — ACHIEVEMENTS (feat/achievements)

**32 achievements** (27 visible + 5 secret) across volume, speed, vocabulary, progression, streaks,
per-mode feats, and economy. A grid screen (ACHIEVEMENTS menu footer link) shows locked entries as
dim silhouettes with their hint; secrets show only "???" until earned. Each grants wins **× the live
rebirth multiplier** (so a late achievement stays meaningful). Evaluated whenever you return to the
home menu (`checkAchievements()`), so anything earned mid-game is caught on return; idempotent.

## Full table

| ID | Category | Name | Requirement | Base wins | Secret |
|----|----------|------|-------------|-----------|--------|
| vol-1 | VOLUME | FIRST BLOOD | 1 word accepted | 100 | |
| vol-100 | VOLUME | WARMING UP | 100 words | 500 | |
| vol-1k | VOLUME | WORDSMITH | 1,000 words | 2,000 | |
| vol-10k | VOLUME | KEYBOARD WARRIOR | 10,000 words | 20,000 | |
| vol-50k | VOLUME | UNSTOPPABLE | 50,000 words | 100,000 | |
| wpm-40 | SPEED | TOUCH TYPIST | 40 WPM | 1,000 | |
| wpm-70 | SPEED | FAST FINGERS | 70 WPM | 3,000 | |
| wpm-100 | SPEED | BLAZING | 100 WPM | 10,000 | |
| obs-1 | VOCABULARY | DEEP CUT | 1 OBSCURE word | 500 | |
| obs-50 | VOCABULARY | LEXICON | 50 OBSCURE words | 10,000 | |
| dist-500 | VOCABULARY | COLLECTOR | 500 distinct words | 5,000 | |
| dist-2500 | VOCABULARY | CURATOR | 2,500 distinct words | 50,000 | |
| lv-15 | PROGRESSION | ASCENDANT | Reach LV15 | 1,000 | |
| reb-1 | PROGRESSION | REBORN | Rebirth once | 5,000 | |
| lv-50 | PROGRESSION | VETERAN | Reach LV50 | 20,000 | |
| reb-5 | PROGRESSION | PHOENIX | Rebirth 5× | 50,000 | |
| streak-3 | STREAKS | HABIT | 3-day streak | 1,000 | |
| streak-7 | STREAKS | DEDICATED | 7-day streak | 5,000 | |
| streak-30 | STREAKS | RITUAL | 30-day streak | 50,000 | |
| m-wb-5 | MODES | BOMB SQUAD | Word Bomb Mastery 5 | 2,000 | |
| m-blitz-5 | MODES | QUICK THINKER | Blitz Mastery 5 | 2,000 | |
| m-sat-5 | MODES | SCHOLAR | SAT Rush Mastery 5 | 2,000 | |
| m-chain-5 | MODES | UNBROKEN | CHAIN Mastery 5 | 2,000 | |
| m-fuse-5 | MODES | DEFUSER | FUSE Mastery 5 | 2,000 | |
| m-all-3 | MODES | JACK OF ALL | Every mode Mastery 3 | 10,000 | |
| kp-5 | ECONOMY | POWER USER | KEY POWER T5 | 10,000 | |
| ws-3 | ECONOMY | SIXTH SENSE | WORD SENSE T3 | 10,000 | |
| sec-millionaire | SECRET | PAPER CHASE | 1,000,000 wins all-time | 20,000 | ✓ |
| sec-dict | SECRET | WALKING DICTIONARY | 100 OBSCURE words | 25,000 | ✓ |
| sec-eternal | SECRET | ETERNAL | Rebirth 10× | 100,000 | ✓ |
| sec-truemaster | SECRET | TRUE MASTER | Every mode Mastery 10 | 200,000 | ✓ |
| sec-completionist | SECRET | COMPLETIONIST | Earn every other achievement | 50,000 | ✓ |

## Implementation
- `achievements.js` — catalog + guarded store (`taw.achievements`) + `checkAchievements()` (snapshots
  live progress once, grants newly-satisfied × rebirth, two-pass so COMPLETIONIST settles).
- `AchievementsScreen` (new ACHIEVEMENTS menu footer link) — categorized grid, locked = dim
  silhouette + hint, secrets masked "???".
- `achievements.test.js` (6). Full suite 384 green. Screen verified via seeded screenshot (9/32).

## Cut / flagged
- A newly-earned **toast** was built but pulled: it reliably granted the wins (verified) but the toast
  element would not stay mounted (state reset to null before paint) despite mount-only timers and a
  prod build — a stubborn interaction I chose not to keep burning time on across a 20-job run. Wins
  still credit (the menu chip updates) and everything shows on the grid. The toast is the natural home
  for the Job-11 "achievement earned" sound; revisit both together.
