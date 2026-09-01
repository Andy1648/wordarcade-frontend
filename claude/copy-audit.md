# JOB 15 — COPY & VOICE AUDIT

Every user-facing string in `src/` and `index.html` was extracted (JSX text, button
labels, toasts, aria-labels, placeholders, taunt/status arrays, dialog copy, error
messages, meta tags). This report groups the findings by defect type, cites `file:line`
for each, and closes with the 20 worst strings to rewrite.

**The voice (target):** Newgrounds/FNF — ALL-CAPS, terse, cocky, a little mean, never
corporate. Reference lines already in-voice (keep as the tone anchor): `"DROP A NAME
FIRST."` (LobbyScreen.jsx:82), `"BE THE ONE WHO STARTS THE PARTY."`
(PublicRoomsScreen.jsx:222), `"YES, WIPE EVERYTHING"` (StatsScreen.jsx:145), `"type fast.
die slow."` (share/shareText.js:18), `"Beat the bomb. Combo or choke."`
(modeDialogConfig.js:8), the SplashScreen taglines (SplashScreen.jsx:15-40), and
friendlyError.js:9-16.

**Headline:** the app is ~90% ALL-CAPS shouty, and that is the intended register. Almost
every defect below is a string that *drifts out of it* — into sentence case, lowercase,
or corporate flatness — usually sitting right next to an ALL-CAPS sibling. The single
biggest structural problem is **casing chaos in the same UI element** (mode-card
descriptions, dialog liners, input placeholders). The second is **one concept called
three different names** (the letter-fragment; the soft currency).

---

## 1. INCONSISTENT CASING

The UI has three competing casing systems for the same *kinds* of element.

### 1a. Mode-card descriptions — ALL-CAPS vs Sentence case in the SAME grid
The five game cards sit side by side on the menu, but two of the descriptions are
sentence case while three are ALL-CAPS:

| file:line | string | case |
|---|---|---|
| gameData.js:17 | `USE THE COMBO BEFORE TIME RUNS OUT.` | ALL-CAPS |
| gameData.js:34 | `AI JUDGES YOUR ANSWERS — GET CREATIVE.` | ALL-CAPS |
| gameData.js:58 | `SAT VOCAB, ARCADE SPEED. SOLO.` | ALL-CAPS |
| gameData.js:81 | `Each word starts where the last one ended` | **Sentence case** |
| gameData.js:96 | `Type a word that contains the piece` | **Sentence case** |

CHAIN and FUSE (81, 96) also drop the trailing period the other three keep.

### 1b. Mode dialog liners/subs — ALL sentence case, inside ALL-CAPS chrome
Every `liner`/`sub` in `modeDialogConfig.js` is sentence case (8, 9, 18, 19, 28, 29, 35,
36) while the dialog frame around them is ALL-CAPS. The copy is strong; the case is the
problem.

### 1c. Input placeholders — three different systems across modes
Same element (the text input placeholder), three casings:

| file:line | string | case |
|---|---|---|
| CgArmScreen.jsx:121 | `TAP TO START…` / `TYPE ANY LETTER TO START` | ALL-CAPS |
| GameScreen.jsx:2972 | `Type a word with "TRA"...` | Sentence |
| GameScreen.jsx:4058 | `Type an answer...` | Sentence |
| LobbyScreen.jsx:152 | `e.g. WordWizard99` | Sentence |
| ChainGame.jsx:280 | `start with "T" — min 3 letters` | **lowercase** |
| FuseGame.jsx:195 | `type a word with "AIN" in it` | **lowercase** |

### 1d. Detail/hint copy that drops out of ALL-CAPS
- LobbyScreen.jsx:207-208 — `Anyone can find this room in the public browser.` / `Only people with the code can join.`
- LobbyScreen.jsx:54 — `ENTER YOUR NAME TO GET STARTED` (caps but corporate-flavored; see §5)
- ShopScreen.jsx:315,318,321 — `LOSE: all XP — back to LEVEL 1.` / `KEEP: wins, all purchases…` / `GAIN: a permanent ×N XP multiplier.` (ALL-CAPS label + sentence-case tail)
- StatsScreen.jsx:139 — full sentence-case destructive warning (see §5)
- CgArmScreen.jsx:145 — `first letter starts the round` (lowercase)
- ConnectingContent.jsx:26 — `free hosting naps — ~30s, game starts by itself` (lowercase)
- RoomScreen.jsx:207 — `join my room — type fast. die slow. code {code}` (lowercase share text — good voice, wrong case for the shell)

### 1e. SAT Rush — its own three-way casing split
- Lowercase micro-labels: `score`/`streak`/`word`/`lives`/`heat` (Hud.jsx:10-32); results strip `cleared`/`missed`/`best streak`/`wins earned`/`avg ante…`/`hardest clear` (SatRushResults.jsx:132-176).
- Title/Sentence-case field labels: `Reward` (AnteMeter.jsx:27), `Last seen`/`Description`/`Known aliases`/`Suspects` (WordCard.jsx:100-121, 62).
- Sentence-case CTAs: `Play` (SatRushGame.jsx:229), `Start the run` (BriefingScreen.jsx:113), `Run it back`/`Menu` (SatRushResults.jsx:198,201) — soft, framework-default feel against CAPTURED!!/ESCAPED?!/WANTED.

### 1f. Punctuation inconsistency
- **Ellipsis:** `...` (three dots) at LobbyScreen.jsx:122,229; RoomScreen.jsx:296,411,416 vs the real `…` at ConnectingContent.jsx:23; PublicRoomsScreen.jsx:215,257; CgArmScreen.jsx:131.
- **Em-dash vs hyphen:** `CONNECTION ERROR - TRY REFRESHING` (LobbyScreen.jsx:123) uses `-`; nearly everything else uses `—`.
- **Points label:** `PTS` (share/shareText.js:137) vs `pts` (share/resultCard.js:90) for the same stat.
- **Brand separator:** `TYPE A WORD · MODE` middot (shareText.js:110) vs `TYPE A WORD - MODE` hyphen (resultCard.js:87).
- **Copied state:** `✓ COPIED` no bang (ShareBar.jsx:72) vs `COPIED!` bang (CopyResultButton.jsx:49).
- **Apostrophes:** curly `IT'S PRINTING` (AnteMeter.jsx:37) vs straight `it'll be back` (useSatRushGame.js:309); and apostrophes are dropped in hype/taglines (`CANT`, `HES` — GameScreen.jsx:136,141; SplashScreen.jsx:29) but kept in errors (`ROOM'S`, `WON'T` — friendlyError.js:10,16). The dropped-apostrophe hype reads as a deliberate style; the *mix* is the issue.

---

## 2. INCONSISTENT TERMINOLOGY (same concept, competing terms)

### 2a. The letter-fragment you must include — FOUR names
This is the core Word-Bomb/FUSE/SAT mechanic and it is named four different ways:

| term | where |
|---|---|
| **"the combo"** | gameData.js:17; modeDialogConfig.js:8; GameScreen prompt `TYPE A WORD CONTAINING` (GameScreen.jsx:2333) |
| **"the letters"** | modeDialogConfig.js:9 (`Type a word with the letters…`) |
| **"the piece"** | gameData.js:96; modeDialogConfig.js:35; FuseGame.jsx:197 (`THE PIECE`) |
| **"fragment"** | modeDialogConfig.js:36; FuseGame.jsx:167,179; SAT Rush copy |

modeDialogConfig.js calls it **"the piece" (line 35) and "fragment" (line 36) in adjacent
lines of the same FUSE dialog.** Pick ONE word and use it everywhere.

### 2b. "COMBO" is overloaded — fragment vs streak
`COMBO`/`COMBO LOST`/`WIN COMBO`/`BEST COMBO` (ComboMeter.jsx:53,30; ComboPill.jsx:17;
GameScreen.jsx:1256) all mean the **consecutive-hit streak**. But "the combo" in §2a means
the **letter fragment**. Same word, two unrelated meanings — a new player reading `USE THE
COMBO` and then seeing `COMBO ×3` has no way to reconcile them. Resolving §2a (rename the
fragment to "THE LETTERS") also fixes this.

### 2c. The soft currency — "WINS" vs "SCRAPS", and "WINS" collides with winning
- The shop currency is **WINS** (StatsScreen.jsx:78 `WINS BALANCE`; ShopScreen.jsx:251 `WINS / WORD`; WinsHud.jsx:20,46).
- But SAT Rush's WordCard reward footer calls it **`1× SCRAPS`** (WordCard.jsx:217) — a second name for the same currency.
- And **WINS** the currency collides with **wins** the match outcome: `{name} WINS` (GameScreen.jsx:3065,3769), `LAST ONE TYPING WINS` (SplashScreen.jsx:23), `THE DICTIONARY WINS AGAIN` (GameScreen.jsx:160). A newcomer can't tell whether "WINS" is a scoreboard or a wallet.

### 2d. The thing you submit — "word" vs "answer" vs "entry"
Mostly a clean per-mode split (Word Bomb = **words**, Category Blitz = **answers**), which
is fine — except:
- The shop counts Category Blitz **answers** as **words**: `WINS / WORD` (ShopScreen.jsx:251; ModeExample.jsx:98) applies to Blitz too.
- Reject fallbacks disagree: `INVALID WORD` vs `INVALID ANSWER` (GameScreen.jsx:125) vs bare `REJECTED` in solo (solo/shared.js:42).

### 2e. Category Blitz mode name — "AI CATEGORY BLITZ" vs "CATEGORY BLITZ"
- **AI CATEGORY BLITZ:** RoomScreen.jsx:51; GameScreen.jsx:2330,3930,4161 (the in-game title).
- **CATEGORY BLITZ:** the menu card (gameData.js:33), StatsScreen.jsx:91, share badges (share/shareConfig.js:25), index.html schema. Pick one canonical name.

### 2f. FUSE "out of X" screen — "FUSES" vs "fragment/piece"
FuseGame.jsx:166 `OUT OF FUSES` but the same screen (167) says `the last fragment was
"…"` and (171) `N words defused`. Three metaphors (fuses / fragment / defused) in one card.

---

## 3. PLACEHOLDER-SOUNDING / DEV-Y TEXT

No literal `lorem` / `TODO` / stale "coming soon" strings exist in shipping copy (good).
What's present is dev-flavored *styling* and leaked internals:

- **CreditsScreen.jsx:18,24** — `// CREATED BY //` and `// MUSIC //` render literal
  code-comment syntax as decoration. Reads as unfinished.
- **ConnectingContent.jsx:26** — `free hosting naps — ~30s, game starts by itself` exposes
  hosting/infra detail to the player.
- **StatsScreen.jsx:115** — `XP STACK` (and `XP INTO LEVEL` at :73) read like debug labels.
- **LobbyScreen.jsx:122** — `CONNECTING TO SERVER...` — "TO SERVER" is implementation noise.
- **useSatRushGame.js:847** — the visible case-id meta prints `… · tier {tier}`, leaking an
  internal difficulty-tier number.
- **CgArmScreen.jsx:103** — `•••` placeholder dots (deliberate pre-round placeholder, but
  reads unfinished).
- **Bare fallbacks:** `REJECTED` (solo/shared.js:42), `NICE RUN` (share/cardModel.js:69),
  `—` empty-ante glyph (cardModel.js:64), `…` loading states (ChainGame.jsx:82,
  FuseGame.jsx:82).
- **DevTuner.jsx** — the entire tuner panel copy (`tune`, `stage interval`, `lineup x`,
  `deep cut every`, `revenant gap`, `lock 2`, …) is dev-only BUT is reachable in a prod
  build via `?tune=1` (config.js:67-70). Low priority, but it is player-reachable.
- **juice.js:71,109,114** — stale stamp phrases (`GOT IT!`, `CLOSE!`, `MISS!!`) survive as
  comments that contradict the live stamps (`CAPTURED!!`, `ESCAPED?!`). Not rendered;
  cleanup only.

---

## 4. COPY THAT ASSUMES KNOWLEDGE A NEW PLAYER LACKS

Unexplained mechanics/jargon, roughly worst-first:

- **REBIRTH** — Homepage.jsx:609; ShopScreen.jsx:289,330,337; StatsScreen.jsx:75,85. A
  prestige-*reset* mechanic named with a word that doesn't signal "reset". The code itself
  flags this as the audit's #1 newcomer leak (Homepage.jsx:595-598).
- **KEY POWER** — ShopScreen.jsx:90,234; StatsScreen.jsx:83. Never says it's your XP-per-
  keystroke rate.
- **SAT Rush jargon, mostly unexplained in-run:** `ante` / `avg ante` (AnteMeter.jsx:41;
  SatRushResults.jsx:121; useSatRushGame.js:267), `heat` (Hud.jsx:32 — bare label),
  `silver tongue` (SatRushResults.jsx:25), `deep cut` (SatRushResults.jsx:26), `revenant`
  (SatRushResults.jsx:27), `SCRAPS` (WordCard.jsx:217). The mechanic that reveals letters
  ("spell-along") is never named for the player; it surfaces only as `MUGSHOT PRINTING…`.
- **XP STACK / XP INTO LEVEL** — StatsScreen.jsx:115,73.
- **"the piece" / "fragment"** — FUSE never plainly says "a chunk of letters your word must
  contain" (modeDialogConfig.js:35-36; FuseGame.jsx).
- **LINKS** — ChainGame.jsx:247 (`LINKS · BEST 12`) — unlabeled score unit.
- **fuse ×0.8 / avg ante ×** — FuseGame.jsx:185; share/shareText.js:168 — bare multipliers.
- **CC BY-SA 4.0** — CreditsScreen.jsx:33 — license jargon.

---

## 5. DOESN'T SOUND LIKE THE VOICE (corporate / meek / off-tone)

- **StatsScreen.jsx:139** — `This permanently destroys your XP, level, wins, all purchases,
  rebirths, and every lifetime stat. It cannot be undone.` — full sentence-case legalese.
  The loudest voice-break in the app (its own buttons `YES, WIPE EVERYTHING` / `DANGER
  ZONE` are perfect — the warning body isn't).
- **LobbyScreen.jsx:207-208** — `Anyone can find this room in the public browser.` / `Only
  people with the code can join.` — settings-panel corporate.
- **LobbyScreen.jsx:54** — `ENTER YOUR NAME TO GET STARTED` — onboarding-speak.
- **LobbyScreen.jsx:123-124** — `CONNECTION ERROR - TRY REFRESHING` / `DISCONNECTED` — flat
  status words (contrast the great friendlyError.js lines that DO have voice).
- **ConnectingContent.jsx:26** — see §3.
- **CgArmScreen.jsx:145** — `first letter starts the round` — meek.
- **SAT Rush CTAs** — `Play` / `Menu` / `Run it back` / `Start the run` (SatRushGame.jsx:229;
  SatRushResults.jsx:198,201; BriefingScreen.jsx:113) — soft defaults.
- **SatRushGame.jsx:208** — `SAT vocab at arcade speed. Read the clue and type the word
  before it spells itself.` — dry instruction.
- **share/cardModel.js:69** — `NICE RUN` — wholesome; off the cocky-taunt register.
- **share/cardModel.js:45** — `YOUR SCORE` — flat.
- **share/shareText.js:152** — `0 PTS. rough one` — *sympathetic*, when its siblings taunt
  (`blink and you die`, `brutal`). Tone drifts across the four zero-score lines
  (shareText.js:121,137,152,167).
- **friendlyError.js:14** — `ONLY THE HOST CAN DO THAT.` — the flattest of an otherwise
  great set.
- **solo/chainCards.jsx:15** — `time ran out` — limp.

---

## TOP 20 STRINGS TO REWRITE

Chosen for visibility + severity: side-by-side inconsistencies and clear voice breaks a
player actually sees. Rewrites are suggestions, in-voice.

| # | file:line | current | why | suggested rewrite |
|---|---|---|---|---|
| 1 | StatsScreen.jsx:139 | `This permanently destroys your XP, level, wins, all purchases, rebirths, and every lifetime stat. It cannot be undone.` | Corporate legalese, full sentence case — biggest voice break in the app | `THIS NUKES EVERYTHING — XP, LEVEL, WINS, EVERY PURCHASE. GONE. NO TAKEBACKS.` |
| 2 | gameData.js:96 | `Type a word that contains the piece` | FUSE card is sentence-case among ALL-CAPS cards; "the piece" is jargon | `SNEAK THE LETTERS INTO A WORD. BEAT THE FUSE.` |
| 3 | gameData.js:81 | `Each word starts where the last one ended` | CHAIN card sentence-case among ALL-CAPS cards | `EACH WORD STARTS ON THE LAST ONE'S LETTER.` |
| 4 | modeDialogConfig.js:35-36 | `…the piece.` / `…the given fragment.` | Same FUSE dialog names the fragment TWO ways (piece + fragment) | Pick one: `…THOSE LETTERS.` in both |
| 5 | FuseGame.jsx:195 | `type a word with "AIN" in it` | All-lowercase placeholder vs ALL-CAPS UI | `SNEAK "AIN" INTO A WORD` |
| 6 | ChainGame.jsx:280 | `start with "T" — min 3 letters` | All-lowercase placeholder | `START WITH "T" · 3+ LETTERS` |
| 7 | GameScreen.jsx:4058 | `Type an answer...` | Sentence-case placeholder; `...` not `…` | `NAME ONE…` |
| 8 | ConnectingContent.jsx:26 | `free hosting naps — ~30s, game starts by itself` | Leaks infra, lowercase, off-voice | `SERVER'S WAKING UP — ~30s. IT DROPS YOU IN.` |
| 9 | RoomScreen.jsx:51 | `AI CATEGORY BLITZ` | Mode name conflicts with `CATEGORY BLITZ` on card/stats/share | `CATEGORY BLITZ` (make it canonical everywhere; keep "AI" as a chip) |
| 10 | gameData.js:17 | `USE THE COMBO BEFORE TIME RUNS OUT.` | "the combo" (fragment) collides with COMBO (streak) | `TYPE A WORD WITH THE LETTERS — BEFORE IT BLOWS.` |
| 11 | LobbyScreen.jsx:207-208 | `Anyone can find this room in the public browser.` / `Only people with the code can join.` | Corporate sentence case | `ANYONE CAN JOIN.` / `CODE-ONLY. INVITE WHO YOU WANT.` |
| 12 | WordCard.jsx:217 | `1× SCRAPS` | "SCRAPS" is a second name for the WINS currency | `1× WINS` |
| 13 | FuseGame.jsx:197 | `TYPE ANY WORD THAT CONTAINS THE PIECE` | "THE PIECE" — third name for the fragment | `TYPE A WORD WITH THOSE LETTERS` |
| 14 | StatsScreen.jsx:115 | `XP STACK` | Dev-y label a player won't parse | `WHERE YOUR XP COMES FROM` |
| 15 | CreditsScreen.jsx:18,24 | `// CREATED BY //` / `// MUSIC //` | Literal code-comment syntax reads unfinished | `MADE BY` / `MUSIC` |
| 16 | share/cardModel.js:69 | `NICE RUN` | Wholesome fallback, off the cocky voice | `NOT BAD.` |
| 17 | share/shareText.js:152 | `0 PTS. rough one` | Sympathetic — clashes with its taunting siblings | `0 PTS. brutal.` |
| 18 | CgArmScreen.jsx:145 | `first letter starts the round` | Lowercase, meek | `HIT ANY KEY. GO.` |
| 19 | LobbyScreen.jsx:123 | `CONNECTION ERROR - TRY REFRESHING` | Flat/dev-y; hyphen not em-dash | `SERVER GHOSTED YOU — HIT REFRESH.` |
| 20 | resultCard.js:87,90 | `TYPE A WORD - FUSE` / `1,860 pts` | Share cards disagree with shareText.js: `-` vs `·`, `pts` vs `PTS` | `TYPE A WORD · FUSE` / `1,860 PTS` |

---

### Quick-win batch (mechanical, low-risk, high-consistency)
1. Global: fragment concept → one term (recommend **"THE LETTERS"**) across gameData,
   modeDialogConfig, FuseGame, GameScreen prompt.
2. Global: `CATEGORY BLITZ` canonical (drop the "AI " prefix from the title; keep AI as a chip).
3. Global: `...` → `…`, stray `-` → `—`, `pts`/`PTS` → `PTS`, `·`/`-` brand separators → `·`.
4. Currency: `SCRAPS` → `WINS` (WordCard.jsx:217); consider renaming the *match-outcome*
   word to avoid the WINS collision (e.g. `{name} TAKES IT`).
5. Placeholders: force ALL-CAPS to match the rest of the UI.
