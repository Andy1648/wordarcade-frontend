# TYPE A WORD — Handoff / Block State

**Refreshed:** 2026-08-29 (branch `docs/block-state-3` off `main`). Every number re-verified against
source at this checkout. The economy is internally **Economy v6**. `path:line` references are to
`main`; §14 lists fixes that live on UNMERGED branches (never merged per this run's rails).

---

## 1. What this is
`typeaword.com` — a Newgrounds/FNF-styled word arcade. React + Vite frontend (this repo), Node +
Express + `ws` backend (`chain-reaction-backend`, separate repo). Vercel (frontend) / Render
(backend). Two currencies only: **XP** (meta progression) and **WINS** (spendable). There is no
"KE / Knowledge Energy".

## 2. Modes & unlocks (`src/gameData.js`)
| Mode | id | Type | Gate |
|---|---|---|---|
| WORD BOMB | `word-bomb` | Solo/Multi (WS rooms) | none (flagship) |
| CATEGORY BLITZ | `category-blitz` | Solo/Multi (WS, AI-judged) | none |
| SAT RUSH | `sat-rush` | Solo | build flag `SAT_RUSH_ENABLED` |
| CHAIN | `chain` | Solo (no WS) | unlockLevel **20** (`gameData.js:82`, raised from 15) |
| FUSE | `fuse` | Solo (no WS) | unlockLevel **25** (`gameData.js:97`, raised from 22) |

Locked cards open a read-only `LockedPreviewDialog` ("UNLOCKS AT LV N"). Both the unlocked
`ModeDialog` and the locked preview embed a static worked example (`ModeExample.jsx`).

## 3. XP / levels (`src/progress/xp.js`, key `taw.xp` = `{lv, into}`)
- `need(n)`: `n≤60` = `round10(100·1.25^n)`; `n>60` = `need(60)·1.08^(n-60)` (half-to-even round10).
- Per-mode XP multipliers `XP_MULTIPLIERS`: menu 1, word-bomb 2, category-blitz 2, sat-rush 3,
  chain 4, fuse 5.
- **Unified XP:** all modes + menu typing feed the SAME level via `useXpCapture` → `creditXp`.
  `rank.js` maps level → a named RANK title shown in the XP bar.

## 4. Wins sinks — TWO parallel upgrade tracks (`src/progress/xp.js`, `wordSense.js`, `shop.js`)
- **KEY POWER** (`taw.keytier`): raises XP earned per typed letter. T0=10 xp/letter (free) →
  T1 25 (500w) → T2 60 (3k) → … T8 14,690 (139,968,000w); past T8 effect ×2.5 / cost ×6 per tier.
- **WORD SENSE** (`taw.wordsense`, `wordSense.js`): buys the WINS multiplier applied to word
  **rarity** — knowing rare words pays more the more you invest. Effect ×2.5 per tier
  (`WORDSENSE_EFFECT_STEP`), same cost shape as Key Power.
- Cosmetics (`shop.js`): 5 POP STYLES + 6 SOUND PACKS, one-time wins prices.

## 5. WINS economy (`src/progress/wins.js` + modifiers)
Paid **per accepted word**; a round pays 0 unless ≥ `MIN_WORDS=3` accepted.
- `perWordWins = round10(WORD_WINS_BASE(20) × modeMult × difficultyMult × rebirthMult)`.
- `WINS_MULT` = { satRush 5, chain 10, fuse 15 }; word-bomb / blitz = 1.
- `DIFFICULTY_MULT` = { chill 1, easy 1.25, medium 1.5, hard 2 } — word-bomb/blitz only.
- R0 per-word: wb/blitz **20**, SAT **100**, CHAIN **200/link**, FUSE **300/word**.
- **RARITY** (`rarity.js`): a word's wins scale by its rank-band × length. Bands up to
  `OBSCURE ×4.0`; `+0.1×/letter` over 5 letters, capped `LENGTH_BONUS_MAX 0.5`, total
  `RARITY_MAX_MULT 4.5`. Rank comes from `words.recall.txt` position (`rarityIndex.js`).
- **COMBO** (`combo.js`): +0.1× per consecutive accept, cap ×3.0 at 20 — **wired into the SOLO
  hook only** (Chain/Fuse); WB/Blitz/SAT cannot earn it.
- **LUCKY** (`luck.js`): 1-in-40 word → ×5 wins & ×5 XP — **solo hook only**.
- Recording sites: WB `App.jsx` (per game), Blitz `App.jsx` (per round), SAT `SatRushGame.jsx`,
  CHAIN `ChainGame.jsx`, FUSE `FuseGame.jsx` (solo fire once/run, live tally each render).
- ⚠ **BALANCE BUG (sim/mode-balance, 2026-08-29):** Fuse dominates wins/min 1.55×–13× (×15 mult +
  solo-only combo/lucky). Obscure-3-letter Fuse spam = 5.82× — the 122 three-letter accept words
  score OBSCURE ×4.0 while being fastest to type. Report on branch `sim/mode-balance`.

## 6. REBIRTH (`src/progress/xp.js`, key `taw.rebirths`)
Zeroes XP/level for a **permanent multiplier on BOTH XP and WINS**. `REBIRTH_TABLE` R1 (LV15, ×1.5)
… R20 (LV600, ×1e11); past R20 = +50 levels & ×10 mult per rebirth. Keeps everything except XP
(wins, winsLifetime, cosmetics, Key Power, Word Sense, mastery, collection, records all survive).

## 7. Mastery, Collection, Achievements, Return, Streak, Records
- **MASTERY** (`mastery.js`, `taw.mastery`): per-mode level 1→**20**, feeds a per-mode XP perk
  (`+3%/level`, `MASTERY_XP_STEP 0.03`). Shown in each mode dialog (`M{n}` chip).
- **COLLECTION** (`collection.js`, `taw.collection`): distinct words ever accepted, banded
  COMMON/UNCOMMON/RARE/OBSCURE, **hard-capped `COLLECTION_CAP 5000`** (LRU-evicts oldest past cap —
  so a 100k player silently caps at 5,000). `COLLECTION_MILESTONES` grant wins (100→+5k … 5000→+20M).
  Surfaced on the Stats "COLLECTION" tab.
- **ACHIEVEMENTS** (`achievements.js`, `taw.achievements`): the `ACHIEVEMENTS` array (~32 shown as
  "N/32 EARNED"); each grants wins on unlock. `checkAchievements` runs on mount (tests opt out via
  `window.__TAW_NO_ACHIEVEMENT_GRANT`). Stats "ACHIEVEMENTS" tab.
- **RETURN BONUS** (`returnBonus.js`, `taw.returnClaim`): away ≥ `MIN_AWAY_HOURS 6` grants
  `PER_HOUR_WINS 100`/hr, capped `CAP_HOURS 12` (max +1,200), once per local calendar day.
- **STREAK** (`streak.js`, `taw.streak`): daily-play streak; menu chip at ≥2 days; small wins/XP
  bump with freeze-tokens that absorb a missed day.
- **RECORDS** (`records.js`, `taw.records`): personal-best surface (OBSCURE FINDS / LUCKY WORDS,
  longest streak, highest level, etc.), shown as the Stats "PERSONAL RECORDS" grid.

## 8. THEMES (`src/theme/themes.js`, key `taw.theme` + `taw.ownedThemes`)
5 menu palettes (default / midnight / inferno / toxic / prism) that recolor the menu via CSS custom
properties on `data-theme`. Buyable with wins OR free at a level gate (LV10 / LV30). `main.jsx`
`initTheme` reads `taw.theme` before first paint. Owned themes survive rebirth.

## 9. SOUND (`useMusicPlayer.js`, `audio/audioCore.js`, `gameSounds.js`, `progress/clack.js`)
- **Music** (`/firecracker.mp3`): a single looping `<audio>` + Web-Audio analyser for beat sync.
  Starts ONLY on the first user gesture (`App.jsx startMusicOnGesture` → `music.play()`); the mute
  PREFERENCE persists (`taw.musicMuted`) but never auto-plays without a gesture.
- **Event sounds** + **keystroke clack** + **master volume** — all OFF-by-default, persisted,
  AudioContext created/resumed only inside a gesture. One corner `AudioControls` popover holds all
  three toggles + the volume slider.

## 10. TRANSITIONS
Screen changes play a cosmetic wipe/whoosh overlay (`App.jsx transition` state, `<250ms`,
position:fixed, pointer-events:none). **RULE:** the transition is purely visual — the real screen
always renders off the live `view` state and is never gated/delayed by the overlay (see §12 trap).

## 11. Dictionaries
- **Solo (CHAIN/FUSE):** lazy `words.recall.txt` (31,500, rank-ordered; TOP_COMMON 3000) ∪
  `words.accept.txt` (56,349 increment) ≈ 88k live ACCEPT; `words.accept-ext.txt` (181,897) merges
  in after the first run (~270k tokens before Set dedup). Never on menu first paint.
- **SAT RUSH:** `src/data/satRush/words.json` — **612 on `main`**; branch `data/sat-words` expands
  to **956** (schema-validated superset, 0 removed). audit/sat-quality sampled 100: 0% def-error.

## 12. Live-logic traps (authoritative list in CLAUDE.md)
Tier-1 (`App.jsx` WS handlers, `useWebSocket.js`, backend): the **functional `setView` room_update
guard**, the **screen must render off live `view`** (never a lagging copy), the **FIFO message
queue** in `useWebSocket`. Any change here runs the 2-device regression checklist.

## 13. Tests & build
- **Unit:** `npm test` → **401 pass / 0 fail** (was 262).
- **E2E:** `npm run test:e2e` → **34 spec files**; the theme×viewport matrix (`viewport-integrity`,
  5 themes × 7 viewports × 29 screens = 840 cells) dominates, so a full run is **~980 test cases**
  (last clean full run: 964 passed; the rest are load-sensitive flakes — see §14). Gate is
  `npm ci && npm run gate` (lint + unit + full playwright); read `test-results/.last-run.json`, not
  a piped tail.
- Build: `npx vite build` (exit 0). Portal: `npm run build:portal`.
- **Lint:** `react/no-unstable-nested-components` is now a build-failing ERROR (§14).

## 14. Fixes landed on UNMERGED branches (2026-08-29 run — not on `main`)
None merged (rails). Each pushed + verified on origin:
- **`fix/app-churn`** — App re-rendered ~3.2×/sec on every view because `useBeatSync` bumped a
  `beatCount` state per music beat, whose only consumer is the in-game shake. Replaced with an
  `onBeat` callback (hook holds no state); shop/menu idle churn 3.2→~0/sec, `data-beat` DOM writes
  preserved. Also hoisted all in-render component defs (ShopScreen Card/ThemeCard/HoldBuy,
  AudioControls Toggle) + added the lint rule above.
- **`fix/hold-flake`** — hold-to-buy missed under load. Root cause: `HoldBuy` was re-created inside
  ShopScreen's render (remount mid-press) AND commit was gated on `animation.onfinish` (frame-
  throttled). Fix: hoist to module scope + commit on a wall-clock `setTimeout(holdMs)`.
- **Rebirth-reveal freeze** (on both branches above): `ShopReveal`'s auto-dismiss timer reset every
  parent re-render; stabilised via ref/`useCallback` so the overlay closes after a rebirth.
- **`fix/visual-pass`** — consolidated pink to #ff2ec4, panel to #1a0b2e, overlay danger red to
  #ff4b4b, shop-card-btn to the house 4/8/4, lp-close to the canonical close chip.
- Report-only branches from this run: `chore/visual-audit` (87 screenshots + audit),
  `sim/mode-balance` (§5 bug), `sim/economy`, `chore/scale-limits`, `docs/perf-playbook`,
  `audit/sat-quality`, `chore/branch-prune`, plus backend `fix/backend-hardening`.

## 15. Corrections vs the previous handoff (docs/block-state-2)
- Test counts moved: unit 262→**401**, e2e 133-in-30-files→**~980-in-34-files**.
- The economy gained **Word Sense** (2nd wins sink), **Mastery**, **Collection**+milestones,
  **Achievements**, **Return bonus**, **Rarity/Combo/Lucky** wins modifiers, **Themes**, the full
  **sound** stack, **transitions**, and the **records** surface — none were in the prior doc.
- SAT engine `DEFAULT_CONFIG stageIntervalMs` is **2800** in shipped source (CLAUDE.md's "2000"
  retune never landed) — engine source is ground truth.
