# Clutter pass (Andy oct3)

> "REMOVE the % on the progression bar. Delete any label, sublabel or helper sentence that repeats
> what a number or icon already shows. Don't add a single new word anywhere."

Branch `feat/visual-pass` (off `feat/pv11` 0d986f1 / PR #169, with `feat/clutter-pass` merged in; it was first cut from pv11 1d246c1). Deletions and merges only. No new copy, no number or
economy changes. Every aria-label and alt is kept. Line numbers are post-change. Each site carries a
`CLUTTER PASS` comment.

## 1. The % on the progression bar (3)

| file:line | removed | why |
|---|---|---|
| src/components/MenuXp.jsx:410 | the `43.7%` readout centred on the track (`formatPct`) | The fill is the percent. The into / cost numerals stay. |
| src/components/MenuXp.jsx:270 | the `+X.X%` gain pop per credit (`formatGainPct`) | It also printed the bar as a percent. The pooled pop node stays, now used only for `+N LV` on a level-up. |
| src/components/MobileMenu.jsx:238 | the phone LV strip's `43.7%` | Same reason. The strip is now LV · bar · WINS. |

Follow-on: MenuXp.css no longer hides `.menu-xp-readout-now` at ≤560px. That rule existed only to make room for the %, so the into-level XP is back on phones. `formatPct` / `formatGainPct` stay in format.js; they are tested and harmless. No in-game LV chip printed a %: `LevelUpChip` shows `LV n ↑` only.

## 2. Labels that restated a number or icon (40)

| file:line | removed | what already said it |
|---|---|---|
| src/components/MenuXp.jsx:296 (both chip branches) | `WINS` after the coin + balance | The coin icon + number. The aria-label still says "N wins". |
| src/components/MenuXp.jsx:321 | `DAYS` after 🔥 + count | The flame + count. The aria-label still says "N day streak". |
| src/components/ShopScreen.jsx:~197 | `WINS` after the shop's coin + balance | Coin + number. The aria-label is kept. |
| src/components/ShopScreen.jsx:206 | `— TIER n` in the KEY POWER heading | The line directly under it: `KEY Tn ×… → Tn+1`. |
| src/components/ShopScreen.jsx:320 | `— LV x / y` in the rebirth goal line | The ProgressBar under it shows the ratio, and the button says `REBIRTH AT LV y`. `N LEVELS TO GO` stays. |
| src/components/ShopScreen.jsx:331 | `KEPT` in `KEEP: WINS KEPT · …` | The `KEEP:` label. |
| src/components/StatsScreen.jsx:~357 | `title` tooltip `NAME — blurb` / `Undiscovered` | The tile's visible name + blurb + ★/? mark. |
| src/components/StatsScreen.jsx:~374 | `title` tooltip `NAME — hint` / `Undiscovered` | The visible name + hint (`UNDISCOVERED`) + ★/?. |
| src/leaderboard/ClaimPrompt.jsx:133 | `#n` inside `YOU’D BE #n ON THE BOARD` | The big `#n` beside it. The kicker is now `YOU’D BE ON THE BOARD`. |
| src/leaderboard/ClaimPrompt.jsx:~173 | `YOU’RE #n.` on the done card | The big `#n` beside it. The no-rank fallback `YOU’RE ON THE BOARD.` stays. |
| src/components/LeaderboardScreen.jsx:422 | `YOUR RANK` kicker over the hero `#n` | The `#n` with your name under it. |
| src/components/LeaderboardScreen.jsx:~429 | ` THIS WEEK` after the weekly `#n` | The active THIS WEEK tab. |
| src/components/LeaderboardScreen.jsx:~525 | `THIS WEEK` in the `WORDS THIS WEEK` column header | Same: that header only renders under the THIS WEEK tab. |
| src/leaderboard/RankUpMoment.jsx:74 | `· ON THE LEADERBOARD` | The podium glyph + `RANK UP` + `#a → #b`. |
| src/components/RebirthCeremony.jsx:59 | `LEVEL AND KEY RESET. EVERYTHING IN KEPT STAYS.` (and `LEVEL RESETS.` / the tail in the heirloom variant) | The LEVEL / KEY `from → to` rows and the KEPT column. Only `HEIRLOOM KEPT KEY Tn.` stays, as the only reason KEY isn't T0. |
| src/components/GameScreen.jsx:~3991 | SKIP button `title="Skip your turn — costs you a life"` | The button reads `SKIP -1 LIFE`. |
| src/components/GameScreen.jsx:4417 | `YOU BEAT YOUR PERSONAL BEST!` / `YOUR FIRST RECORD!` | The `NEW RECORD!` stamp right above. `PERSONAL BEST: n` still shows when you didn't set one. |
| src/components/GameScreen.jsx:5099 | reroll `title="Swap the current category for a different one"` | The button text `NEW CATEGORY (n)`. The two disabled-state titles stay. |
| src/components/GameScreen.jsx (Word Bomb + Blitz Spotlight) | `sub="START TYPING"` (×2) | The caption `TYPE A WORD WITH THESE LETTERS` / `NAME SOMETHING IN THE CATEGORY`. |
| src/components/GameScreen.jsx:1490 | the `PLAYERS` section label over the results table | The table's own `PLAYER` column header. The 16px gap moved to `.go-ptable`. |
| src/race/WordRaceScreen.jsx:339 | `WORD n OF N` (words mode) | Your highlighted lane's `n/N`. |
| src/race/WordRaceScreen.jsx:345 | `WORD n OF N ·` (fragment mode) | Same. `NEXT <frag>` stays. |
| src/components/CgArmScreen.jsx:136 | desktop hint `FIRST LETTER FIRES IT OFF` | The input placeholder `TYPE ANY LETTER TO START`. |
| src/components/CgArmScreen.jsx:121 | touch placeholder `TAP TO START…` | The `TAP TO START` button under it. |
| src/solo/FuseGame.jsx:405 | armHint `SNEAK THOSE LETTERS INTO A WORD` | The placeholder `SNEAK "ARM" INTO A WORD`. |
| src/solo/fuseCards.jsx:22 | `N words defused` on the death card | `SCORE n` (FUSE's score is its word count). |
| src/satRush/BriefingScreen.jsx:36 | `— you let this one get away` | `SEEN BEFORE`. The aria-label is kept. Not poster copy. |
| src/satRush/BriefingScreen.jsx:42 | `· N letters` | The full word printed beside it. |
| src/satRush/BriefingScreen.jsx:102 | `— grouped below` | The grouped cards below. |
| src/claims/ClaimPopup.jsx:85 | `REWARDS WAITING` kicker (multi-claim case) | `N TO CLAIM` + the `OPEN +X` button. The single-claim kind label stays. |
| src/components/PublicRoomsScreen.jsx:256 | `BE THE ONE WHO STARTS THE PARTY.` | The `+ CREATE PUBLIC ROOM` button. Its 22px gap moved to `.browser-empty-actions`. |
| src/components/PublicRoomsScreen.jsx:290 | `WAITING` on every open room row | Every listed room is waiting. Only `FULL` / `JOINING…` render now. |
| src/components/LobbyScreen.jsx:113 | `TYPE YOUR NAME TO OPEN THE ROOM` | The `YOUR NAME` label on the auto-focused field. |
| src/components/LobbyScreen.jsx:132 | `ROOM VISIBILITY` label | 🔒 PRIVATE / 🌐 PUBLIC. The group's aria-label is kept. |
| src/components/GameCard.jsx:424 | `YOU'RE LV n ·` on a locked card | The menu's level bar on the same screen. `N TO GO` stays. |
| src/components/RoomScreen.jsx:227 | `SHARE THIS CODE` | The `COPY INVITE LINK` / `SHARE` buttons right under the code. |
| src/components/RoomScreen.jsx:303 | `WAITING FOR PLAYERS...` for the HOST | The host's START button reading `NEED 2+ PLAYERS`. Guests still see it. |
| src/components/RoomScreen.jsx:327 | `PICK BOT DIFFICULTY` | The EASY / MEDIUM / TOUGH buttons. |
| src/components/AudioControls.jsx:~66 | toggle `title="MUSIC sound: on"` etc. | The row label beside each toggle, plus its on/off styling. The aria-label is kept. |

Total for this section: 43 removals (3 % + 40 labels and tooltips). See section 2b for the re-audit on #169.

## 2b. Re-audit on #169 (feat/visual-pass) — 4 more

The merge was clean (pv11 1d246c1 → 0d986f1 only touched WordRaceScreen for the challenge link, TeachStrip's pay line
and e2e seeds). A fresh % sweep found no % on any level bar: `formatPct` / `formatGainPct` have no JSX caller, the phone
LV strip, `LevelUpChip` (`LV n ↑`), the wall `LV n`, and Stats (`XP INTO LEVEL a / b`, no %) are clean.

| file:line | removed | what already said it |
|---|---|---|
| src/components/MenuXp.jsx:972 | level-up card detail `LV n-1 → LV n` | The `LEVEL n` title directly above it. The detail row is `:empty` → hidden (the rebirth / KEY-reset variants still fill it). |
| src/components/ShopScreen.jsx:221 | KEY POWER goal `READY TO UNLOCK` | The full bar under it + the live HOLD price button. `NEED N MORE WINS` stays. |
| src/components/ShopScreen.jsx:320 | REBIRTH goal `READY TO REBIRTH` | The full bar + the live `REBIRTH n — ×…` button. `N LEVELS TO GO` stays. |
| src/components/LeaderboardScreen.jsx:429 | ` THIS WEEK` in `NOT RANKED THIS WEEK` | The active THIS WEEK tab (same reason the ` THIS WEEK` after `#n` went). Now `NOT RANKED`. |

CSS: `.shop-goal:empty { display: none }` (ShopScreen.css:530) so an empty goal takes no row; the bar keeps its 6px gap.

Grand total: 47 removals (3 % + 44 labels / tooltips).

Re-audit candidates considered and KEPT:
- MarksIndex `N% COLLECTED` over the collection bar: the marks milestones are priced in % (`NEXT 25% → …`), so this is the only current reading of that scale. Not the level bar.
- MarksIndex hero `MAXED`: the full bar alone doesn't say there is no next rank.
- TimerOverMoment `FRENZY OVER` / `BOOST OVER` title: the flying tiles spell it, but they're gone in ~1s; the title is the steady read.
- Word Bomb `LAST LIFE` badge: a warning, not a label (the hearts show it too, but this is the alarm).
- Word Bomb MATCH rail `TURN name`: the rail stays as it is (see section 3).
- Blitz `GO! TYPE ANYTHING THAT FITS` empty state: it partly repeats the label and placeholder, but removing it collapses the answers list and moves the rail when the first answer lands. That's a layout change on a gated screen.
- Word Race results `N WORDS` per racer: the results card is the only place that pairs the place with the count.
- Word Race `FINISHED — WAITING ON THE FIELD`: the waiting half is new info.

Dead CSS removed with them: `.menu-wins-label`, `.menu-streak-day`, `.menu-xp-readout-pct`, `.hp-m-stats-pct`, `.shop-wins-label`, `.lb-hero-label`, `.cg-arm-hint`, `.room-instruction`, `.room-addbot-label`, `.lobby-instruction`, `.browser-empty-sub`.

## 3. Considered and KEPT

- MenuXp `LEVEL` kicker over the bare level numeral: the only label (no `LV` prefix there).
- MenuXp hint `N LETTERS IN A GAME TO LEVEL n`: the only place the bar is said in letters. "IN A GAME" carries the H6 pricing note.
- MobileMenu `WINS` after the number: the phone strip has no coin icon.
- Homepage spotlight `IT FILLS YOUR LEVEL BAR`: the only place that says menu typing feeds the bar.
- Splash `TYPE / TAP TO START`, SatKeyInput `tap the poster to type`: the only typing cue on those screens.
- Chain armHint `EVERY WORD STARTS WITH THE LAST LETTER…`: the rule; the placeholder doesn't say it.
- Word Bomb MATCH rail `HITS` row: it equals the ComboMeter, but the meter only shows at 2+ and the rail is a size-matched, heavily gated layout (wbRailFit, wb-frame shots). Not worth a layout regression.
- WinsHud `WORDS +N` line (equals the total when there's no bonus): the `data-wins-line` rows are the no-hidden-wins gate's handle.
- MissedWordHold `A REAL WORD. NEXT TIME IT COUNTS.`: a deliberate, true statement (see its header), and asserted in pause-to-learn.
- `N MORE MODES WHERE THIS CAME FROM.` above `SEE ALL MODES` (solo, game-over, SAT): the count is new info.
- Blitz accept toast `NICE! "WORD"`: feedback, not a label. It's a game-feel change, so out of scope.
- TimerOverMoment `×N ENDED`: the only place the multiplier value is named.
- LockedPreviewDialog `YOU'RE LV n · N TO GO`: the dialog covers the menu bar, so there it's the only level readout.
- ModeDialog SOLO/MULTI chip and the SAT card's `… SOLO.`: card and game copy (gameData also feeds SEO pages). Left alone.
- ClaimReveal starburst `NEW`: part of the badge art.
- RebirthCeremony `HEAD START: YOU BEGIN AT LV n`: names the reason the level isn't 1 (and rarely shows).
- Shop `HOLD` hints, `BASE 10 XP / LETTER × KEY × REBIRTH` (Andy's BASE wording), `title={item.blurb}` on compact shop cards (the blurb is shown nowhere else).
- Leaderboard `NO SIGN-IN. JUST A NAME.`, the recovery-code and reset copy: reassurance / safety.
- Every SAT Rush wanted-poster string, `CASE CLOSED`, AnteMeter (protected by CLAUDE.md).
- Every aria-label, sr-only line and alt.

## 4. Tests

- Unit: none asserted removed text. `format.sweep.test.js` still covers `formatPct` / `formatGainPct`, which are unused but kept.
- e2e edited (not run): ext-milestones.spec.js (level-up detail now ''), shop.spec.js, purchase-feel-shop.spec.js, shop-keyboard.spec.js, leaderboard-pull.spec.js, leaderboard-top10.spec.js, leaderboard-weekly.spec.js, public-rooms-full.spec.js, mode-preview.spec.js.
