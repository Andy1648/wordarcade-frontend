# User-Facing Copy Audit — TYPE A WORD

Branch `main` @ `379af8a`. Static review (no server run). Scope: `src/components/**`,
`src/solo/**`, `src/satRush/**`, `src/progress/**` (display copy), `index.html`.
Classification: HIGH = actively confusing/misleading or placeholder shipping to users.
Every HIGH item was refutation-tested against surrounding context + DESIGN.md/CLAUDE.md.

Note on SAT Rush "bounty/manga" voice (CAPTURED / ESCAPED / CASE CLOSED / WANTED / MOST
WANTED / Last seen / Description / Known aliases / Reward / the fugitive was…): DESIGN.md and
CLAUDE.md explicitly sanction this flavor. Those strings are NOT flagged as defects. Only the
underlying *mechanics* that a newcomer can't decode are flagged below.

---

## A. INCONSISTENT TERMINOLOGY

### A1 — "COMBO" means three different things  ·  HIGH
The single most overloaded term in the game. Same word, three unrelated mechanics:
- **The Word Bomb letter fragment** (the letters your word must contain):
  - `src/gameData.js:17` — Word Bomb card: `USE THE COMBO BEFORE TIME RUNS OUT.`
  - `src/components/modeExamples.js:5-6` — `kind: 'combo', combo: 'TRA'`
  - `src/components/modeDialogConfig.js:8` — liner `Beat the bomb. Combo or choke.`
- **The wins multiplier** (a climbing ×N.N streak reward):
  - `src/components/ComboPill.jsx:16` — `WIN COMBO`
- **A run of consecutive accepted words** (longest uninterrupted answer streak):
  - `src/components/GameScreen.jsx:1266` — `BEST COMBO`
  - `src/components/StatsScreen.jsx:65` — `LONGEST COMBO` (req `CHAIN 2 WORDS`)

Worse, the *same fragment* is called plain "letters" everywhere in-game:
`GameScreen.jsx:3075` placeholder `Type a word with "TRA"...`, `:3118` spotlight
`TYPE A WORD WITH THESE LETTERS`, `:3070` aria `Type a word containing …`. So the Word Bomb
card is the *only* place the fragment is ever called a "combo," and it collides with the two
other "combo" meanings. Refutation: user-facing (featured menu card + HUD + stats), genuinely
confusing (conventionally "combo" = a streak; here it's the primary card's core mechanic), not
sanctioned flavor. **Survives.**

### A2 — Word rarity axis has ~5 names  ·  MEDIUM
One underlying concept (how rare/valuable a word is) surfaces under five labels:
- `RARITY` / `RARE` — `src/progress/rarity.js:17-23`; in-game pop `RARE ×2.5`
  (`GameScreen.jsx` RarityPopup, label from `rarity.js:85`)
- `TIER` (`COMMON/UNCOMMON/RARE/OBSCURE`) — `src/progress/collection.js:19` (re-declared,
  duplicate source of truth vs rarity.js)
- `OBSCURE` as its own thing — `StatsScreen.jsx:71` `OBSCURE FINDS`, req `FIND AN OBSCURE WORD`
- `WORD SENSE` — the shop upgrade on that same axis, `ShopScreen.jsx:229` `WORD SENSE — TIER n`
- `DEEP CUT` — achievement for finding an OBSCURE word, `src/progress/achievements.js:58`
  (also SAT Rush's "deep cut" bonus word — a *different* deep cut)

A newcomer cannot connect RARITY → TIER → OBSCURE FINDS → WORD SENSE → DEEP CUT as one system.

### A3 — Streak / Combo / Momentum are three look-alike mechanics  ·  MEDIUM
- `COMBO` = in-round consecutive-accept multiplier (`combo.js`; its internal counter is even
  named `streak`, `combo.js:20`).
- `STREAK` = daily-play streak — `StatsScreen.jsx:66-67` `LONGEST STREAK` / `CURRENT STREAK`
  (req `PLAY 2 DAYS` / `PLAY TODAY`).
- `MOMENTUM` = a *purchased* repeatable +wins upgrade — `ShopScreen.jsx:263`,
  `MomentumRail.jsx:99`. Name evokes combo/streak but is unrelated.
Three similarly-named systems the player must keep straight with no in-app disambiguation.

### A4 — One "reset" mechanic, many names  ·  MEDIUM
The prestige/reset action is `REBIRTH` everywhere it's operated (`Homepage.jsx:578` nav,
`ShopScreen.jsx:159`, `StatsScreen.jsx:174`), but its cosmetic reward is labeled
`PRESTIGE n` (`src/progress/unlockLadder.js:37`) with no tie back to "rebirth," and the
achievements pile on `REBORN` (`achievements.js:64`), `PHOENIX` (:66), `ETERNAL` (:84) as
further synonyms for the same act.

### A5 — Solo run number: SCORE vs WORDS vs LINKS  ·  MEDIUM
Same value, different labels across and within the solo modes:
- FUSE HUD calls the count `WORDS` (`FuseGame.jsx:204`) but the death card labels the identical
  number `SCORE` (`SoloShell.jsx:200`, fed from `wordsSolved`).
- CHAIN uses three surface terms for the accepted-word count: `YOUR CHAIN` (`ChainGame.jsx:271`),
  `${k} LINKED` (:294), `LINKS · BEST n` (:309) — plus a real separate `SCORE` (:308).
- Share buttons pass the run number as `points` (`ChainGame.jsx` share / `FuseGame.jsx` share),
  a fourth word, while the currency the player actually banks is `WINS`.

### A6 — "Lives" has four surface forms in FUSE  ·  LOW
aria `lives` (`FuseGame.jsx:205`), heart glyphs `♥/♡` (:207), death title `OUT OF FUSES`
(`fuseCards.jsx:20,30`), plus the fuse-cord art. Hearts = fuses = cords = lives is left to
inference. (CHAIN/Word Bomb use hearts + the word "life"/"lives" consistently, e.g.
`GameScreen.jsx:3105` `-1 LIFE`.)

### A7 — Mode-name casing drift  ·  LOW
`CATEGORY BLITZ` (card) vs `BLITZ` (mastery short-name, `mastery.js:116`) vs the `AI JUDGED`
pill; ids `category-blitz` / `blitz` / `wordBomb`. Mostly internal, but "BLITZ" alone appears
in the mastery readout shown in the mode dialog.

### A8 — Rule stated in two registers (solo)  ·  LOW
Lowercase sentence-style placeholders vs ALL-CAPS imperative rejects for the same rule:
`start with "X" · 3+ letters` (`ChainGame.jsx:342`) vs `MUST START WITH X` / `MIN 3 LETTERS`
(`shared.js:38,32`); `3+ letters` vs `MIN 3 LETTERS`.

---

## B. PLACEHOLDER / DEV / LEFTOVER TEXT

No `lorem` / `TODO` / `FIXME` / "test" copy reaches users. Findings are dev-gated or comments:

- **SAT Rush DevTuner** — `src/satRush/DevTuner.jsx` renders raw internal knob names
  (`stage interval`, `lineup x`, `spell interval`, `deep cut every`, `revenant gap`,
  `tier climb every`) and scene buttons (`deep cut`, `revenant`, `silver`, `lock 2`). Gated
  behind `import.meta.env.DEV` / `?tune=1` (`SatRushGame.jsx:178`). Not shipped, but unpolished
  if the flag ever leaks. **LOW.**
- **Bare loading glyph** — `src/solo/SoloLoadState.jsx:22` uses a lone `…` as the entire
  loading state (the file's own header notes this class of thing once stranded players). **LOW.**
- **Stale dev comments (not user-facing)** — `App.jsx:2032` "Flag-gated placeholder route.
  Nothing on the menu points here yet" and `:2036`/`:2039` "no menu card yet" for
  SAT Rush / CHAIN / FUSE. These modes DO have menu cards now (`gameData.js`); comments are
  outdated. No user impact — noted for hygiene only.

---

## C. NEW-PLAYER KNOWLEDGE GAPS (unexplained jargon on the surfaces a newcomer hits)

### C1 — "USE THE COMBO" on the featured card  ·  HIGH
Covered in A1. The very first, featured card (`gameData.js:17`) leads with jargon that reads as
the wrong mechanic. Refutation-tested: survives.

### C2 — "WINS" as the name of a single-player currency  ·  MEDIUM (mitigated)
`WINS` is earned by *typing*, not by winning — an odd name for a newcomer. Mitigated by a
one-time explainer on first payout (`Homepage.jsx:398` winsHint → "WINS BUY UPGRADES IN THE
SHOP") and `ShopScreen.jsx:171` `WINS BUY UPGRADES`. Still surfaces bare as `+N WINS` /
`WORDS TO EARN` (`WinsHud.jsx:23,33`) before that explainer is seen in some entry paths.

### C3 — "KEY POWER Tn" in Stats  ·  MEDIUM
`StatsScreen.jsx:181` shows `KEY POWER  T3` with no gloss. The Shop *does* explain it
(`ShopScreen.jsx:190` `KEY POWER — TIER n` + `:195` `XP PER LETTER`), so the gap is Stats-only.

### C4 — SAT Rush mechanics named but not taught  ·  MEDIUM
Genuine (non-flavor) mechanics a first-timer can't decode from the copy:
- `HEAT` — `src/satRush/Hud.jsx:32`. Never defined; it fills toward Silver Tongue but nothing
  says so at the meter.
- `SILVER TONGUE!` stamp — `useSatRushGame.js:248`. The rule (heat cap → all multipliers ×2)
  only appears in the *follow-up* message `:264`, not at the stamp.
- `${n}× SCRAPS` — `WordCard.jsx:219`. "SCRAPS" (reduced payout for a spelled-out word) undefined.
- `MUGSHOT PRINTING…` / spell-along endgame — `WordCard.jsx:216`. The auto-completing-word
  endgame is never named or explained in copy.
- `tier N` in the case-id — `useSatRushGame.js:849` (`… · tier 3`). Internal difficulty number
  leaked to the player.
- `revenant` — `SatRushResults.jsx:26` film-strip title/aria. Raw internal term (a re-queued
  missed word) shown to users; the *in-run* copy handles it better (`ESCAPED ×N — REWARD
  DOUBLED`, `WordCard.jsx:181`, explained inline).
- `ANTE` — `AnteMeter.jsx:41`, `SatRushResults.jsx:121-124`. Partly rescued by adjacent
  `CAPTURE NOW FOR MORE` / `avg ante — how fast you knew them`, but the bare word is jargon.

### C5 — Solo (CHAIN/FUSE) mechanics not taught  ·  MEDIUM
First-run tutorial cards mitigate the core rule, but these remain unexplained in-run:
- `DEAD END` / `FEW LEFT` — `ChainGame.jsx:255` (letter-supply warnings; concept never named).
- Unlabeled `x2.00` multiplier chip — `ChainGame.jsx:305` (no hint what raises it or what it
  multiplies).
- `SHORT WORD — fuse ×{n}` — `FuseGame.jsx:252` (short-word timer penalty never taught).
- `{n}/26 LETTERS USED` — `FuseGame.jsx:230` (purpose/goal of the strip unexplained).

### C6 — Mastery "Mn" shorthand  ·  LOW
`M1`/`M2`/`M5` (`ModeDialog.jsx` MasteryLine via `mastery.js:112`; `achievements.js:72-77`
"Mastery 5") is unexplained shorthand, though the dialog line "PLAY TO LEVEL UP" gives context.

### C7 — Rank titles  ·  LOW (not a defect)
`ROOKIE … UNREAL` (`rank.js`) are flavor names, but the RankLadder overlay
(`RankLadder.jsx:50` "YOUR RANK CLIMBS WITH YOUR LEVEL" + per-row LV ranges) fully explains
them. No action needed.

---

## REFUTED / NOT DEFECTS (checked and cleared)

- **Difficulty labels `CHILL / HARD / CRAZY / HELL` vs engine keys `chill/easy/medium/hard`** —
  looks like a mismatch (engine `easy` → display `HARD`), but it's an *intentional* edgy
  renaming, centralized in `src/difficulty.js:14-17` and applied identically on both the lobby
  and the in-game chip via `difficultyLabel` (`difficulty.js:24`, with a regression test at
  `difficulty.test.js:9-12`). The player only ever sees the display names, consistently. Cleared.
- **SAT Rush bounty/manga voice** — sanctioned by DESIGN.md/CLAUDE.md; intentional flavor.
- **Splash taglines** (`SplashScreen.jsx:13-42`, "TYPE FAST. DIE SLOW." etc.) and Word Bomb
  hype/roast lines (`GameScreen.jsx:141-198`) — intentional flavor, on-brand, not defects.

---

## SUGGESTED PRIORITY
1. **A1/C1 (HIGH)** — reword the Word Bomb card off "COMBO" (e.g. "USE THE LETTERS BEFORE TIME
   RUNS OUT"), OR rename the wins multiplier so "COMBO" means exactly one thing.
2. **A2 (MEDIUM)** — pick one word for the rarity axis (OBSCURE/RARITY) and align stats,
   collection, shop, achievements.
3. **A4/A5/C4/C5 (MEDIUM)** — reconcile REBIRTH/PRESTIGE naming; unify solo SCORE/WORDS/LINKS;
   add one-line glosses for HEAT / SCRAPS / spell-along / CHAIN & FUSE supply mechanics.
