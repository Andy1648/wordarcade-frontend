# REFUTATION PASS — the nine commits `456446e..4026a21` on `feat/rarity-moment`

Branch: `chore/refute-run-n`. Everything below is a measurement against a production build of
that branch, served on `PW_PORT=4187` (a second isolated build on 4189 for the red-checks).
No product code was changed. One unit test was strengthened (see VACUOUS GATES).

**Headline: the branch does not currently pass its own suite.** `e2e/wb-clock.spec.js` is RED,
3 of 13, at 1366x768 — broken by a LATER commit in the same run than the one that added it.

---

## REFUTED

### R1 — `e2e/wb-clock.spec.js` is RED on the branch as committed (claims 2 and 8)

```
$ PW_PORT=4187 npx playwright test e2e/wb-clock.spec.js
  3 failed
    clock: present + decreasing across 5 samples — 1366x768, 2 players
    clock: present + decreasing across 5 samples — 1366x768, 4 players
    clock: present + decreasing across 5 samples — 1366x768, 8 players
  10 passed

e2e/wb-clock.spec.js:135
  Error: text drawn over the fragment slab at t=3
  + "spotlight-caption-text\"TYPE A WORD WITH T\" 95x31"
```

Confirmed against a pristine rebuild with `git status -- src/` clean.

**Causal proof it is this run's own doing.** Check out `src/components/Spotlight.jsx` +
`Spotlight.css` at `456446e` (i.e. before `4db0020`, "a coach mark that fits"), rebuild, rerun:

```
$ git checkout 456446e -- src/components/Spotlight.jsx src/components/Spotlight.css
$ npx vite build && PW_PORT=4187 npx playwright test e2e/wb-clock.spec.js -g "1366x768"
  3 passed (19.1s)
```

So `456446e` added the gate, `4db0020` broke it, and nothing re-ran the earlier gate after the
later change. The run's "every gate was checked RED before being trusted" is defensible
*per gate at the moment it was written*; it is not true of the branch's end state.

Consequences for two claims:

* **Claim 2** ("GET OUT! can no longer be drawn over the fragment slab") is true of GET OUT!
  and false of the board. Something is still drawn over the fragment slab at the commonest
  laptop width, and it is a component this same run rewrote. Measured overlap of
  `.spotlight-caption-text` on `.game-combo-box` at 1366x768: **728 px² calm, 621 px² at warn
  and crit**, stable across five samples under reduced motion; **2,890–2,902 px²** after the
  placement pass settles (2.5 s). 0 px² at 1280x720, 390x844, 320x640, 360x640, 280x653.
* **Claim 8** ("the coach mark ... never covers the element it points at, on the menu, CHAIN
  and FUSE at four viewports") is true as literally scoped — `overTarget` is 0 everywhere I
  measured, including the Word Bomb board and a mid-life resize. But `e2e/spotlight-fit.spec.js`
  does not cover the in-game Word Bomb spotlight, and on that screen the mark covers the one
  box the player is required to read. The contract holds; the coverage does not.

### R2 — Claim 6: "every caller passes the rebirth count" is false, 0 of 7

`src/progress/xp.js`. Product call sites of `need` / `levelFromXp` / `creditXp` / `progressOf`
outside the test file: **7. Number passing an explicit rebirth count: 0.** All fall through to
`= getRebirths()`, which does a `localStorage.getItem` on every call (`xp.js:192`, no cache).

| site | call | path |
|---|---|---|
| `useXpCapture.js:37` | `progressOf(xpRef.current)` | mount |
| `useXpCapture.js:87` | `creditXp(xpRef.current, menuGain)` | **per keystroke** |
| `useXpCapture.js:90` | `progressOf(res.state)` | **per keystroke** |
| `xp.js:232` | `levelFromXp(xp)` in `canRebirth` | ignores its own `rc` arg |
| `xp.js:418` | `creditXp(loadProgress(), gain)` in `awardWordXp` | **per accepted word** |
| `xp.js:491` | `need(level)` in `readLevelState` | every `loadProgress()` |
| `xp.js:500` | `levelFromXp(parsed)` legacy migration | first load after v4 |

Measured with an instrumented `localStorage` against the real module: **2 `taw.rebirths` reads
per keystroke** (200 for 100 keystrokes) and **3 per accepted word**, none of which existed
before this diff. The doc comment at `xp.js:109-111` — *"every caller INSIDE this module reads
it once and passes it down"* — is false for all four internal callers.

**And the legacy migration loses levels, destructively.** `readLevelState` (`xp.js:498-505`)
walks a legacy cumulative total — earned on the *unscaled* curve — against the new 2^rc curve,
then `writeLevelState` commits the demoted result, destroying the cumulative number:

```
taw.rebirths = "5", taw.xp = "3999230"   (cumulative for LV50 on the old curve)
loadProgress() -> { level: 19, intoLevel: 217150 }      // 31 levels gone, and written back
```

| legacy level | rc | migrates to |
|---|---|---|
| 50 | 3 | 31 |
| 50 | 5 | 19 |
| 50 | 10 | **2** |
| 200 | 10 | 145 |

This contradicts the diff's own comment at `xp.js:89-90` ("their LEVEL is untouched"), which is
true of the `{lv,into}` shape and false of the legacy shape. Reverting `NEED_REBIRTH_BASE` to 1
cannot undo it.

`canRebirth` (`xp.js:231-233`) threads `rebirthCount` into `rebirthThreshold` but not into
`levelFromXp`, so the same arguments give different answers depending on storage:
`canRebirth(cum(LV60), 3)` is `true` with `taw.rebirths="0"` and `false` with `"3"`. Latent —
no product call site reaches it.

`doRebirth` itself is fine: level→1, into→0, frac 0, no overflow. The ship-day effect is a
*collapsed* bar, not an overflowing one (R3 LV50 at 90% reads 11.25%). One new failure mode:
`getRebirths()` swallows its throw and returns 0, so if `taw.rebirths` becomes unreadable while
`taw.xp` survives, `cost` drops by 2^rc, `into >= cost` fires at `xp.js:491-492`, and the level's
progress is wiped permanently.

### R3 — Claim 7: the XP track is 4px wide for an ordinary account

`src/components/MenuXp.css:162` — `.menu-xp-track { flex: 1 }` is the only flexible item in a
nowrap row, so every chip is subtracted from it. Measured track widths (production build,
`?portal=1`):

| viewport | LEAN | LEAN+grant | MOD | MOD+grant | RICH | RICH+grant |
|---|---|---|---|---|---|---|
|320x640|58.7|58.7|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|360x640|98.7|98.7|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|390x844|84.7|84.7|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|430x932|124.7|124.7|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|480x900|135.8|135.8|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|600x900|113.2|119.6|**4.0**|**4.0**\*|**4.0**\*|**4.0**\*|
|768x1024|105.2|111.6|**4.0**|**4.0**|**4.0**|**4.0**\*|
|900x900|236.4|242.1|**45.0**|**50.7**|**4.0**|**4.0**|
|1100 / 1280 / 1366|352.6|255.3|156.4|59.2|95.9|**4.0**|
|1920x1080|352.6|255.3|156.4|59.2|95.9|**4.0**|
|280x653|**18.7**|**18.7**|**4.0**\*|**4.0**\*|**4.0**\*|**4.0**\*|
|844x390 (landscape)|155.8|161.2|**2.0**|**2.2**|**2.0**|**2.0**|
|740x360 (landscape)|144.3|146.8|68.2|70.8|**45.8**|**48.4**|

LEAN = no streak, no mark. **MOD = a 7-day streak plus one equipped mark — a week-old account.**
RICH = 365-day streak. `*` = the track's box is entirely outside the viewport (`x > innerWidth`),
i.e. not thin but invisible.

* "never below 55px from 320 to 1366" is false at 320/360/390/430/480/600/768 (4.0px) and 900
  (45.0px) for MOD. `.menu-streak` (`MenuXp.jsx:221`) has **no narrow-width drop rule at all**,
  unlike `.menu-mark` (`MenuXp.css:634`, <430px) and `.menu-xp-rank` (`MenuXp.css:570`, <480px).
* The grant crosses the line **by itself, inside the claimed range**: RICH at 1100/1280/1366 goes
  95.9 -> 4.0px the moment the chip mounts.
* The CSS's own arithmetic is wrong. `MenuXp.css:681-688` says "Net width with the short form of
  the chip is about -9px, i.e. the track gets slightly WIDER." At >=1100px the **long** form
  renders: `.menu-wins-bonus` is 176.4px against the 63.9px `.menu-xp-rank` it displaces —
  net **+112.5px**. Measured loss at 1100/1280/1366: LEAN -97.3, MOD -97.2, RICH -91.9. The
  `@media (max-width: 1099px)` hide of `.menu-wins-bonus-why` (`MenuXp.css:697`) is on the wrong
  side of the breakpoint relative to where the slack actually is.

The claim's other two thirds hold: **wordmark overlap is 0 at all 15 viewports**, and the grant
clears itself (present at 6.0 s, gone by 8.5 s; `keydown` and `pointerdown` each clear it; the
`[hasBonus]` effect with `bonusSeenRef` does not restart under App's ~1/s re-render). A 4.19e12
grant is harmless — `formatNum` abbreviates to `+4.18T`, 176.4px max.

### R4 — Claim 2: the slab's height DOES change on the tier swap, at 280px

Measured under `emulateMedia({reducedMotion:'reduce'})` so the `stage-heartbeat` scale cannot
contaminate the box (it does contaminate a full-motion read — that is where an apparent 1px
slab delta and a 3.5px ring delta at 1366x768 come from; both vanish under reduced motion).

At **280x653**, `.game-combo-label`:

| tier | text | labelH | slabH |
|---|---|---|---|
| calm | TYPE A WORD CONTAINING | **28.614** (two lines) | **105.877** |
| warn | HURRY! | 15.803 | **93.067** |
| crit | GET OUT! | 15.803 | **93.067** |
| calm again | TYPE A WORD CONTAINING | 28.614 | 105.877 |

**A 12.81px jump on the tier swap, and back.** `min-height: 1.2em` (`GameScreen.css:2101`) is a
floor, not a cap; it cannot stop the calm caption wrapping to two lines, and once it wraps the
swap to a one-word caption shortens the slab. The ring is floor-clamped at 175px at that width
so it does not move, but the whole centre column below the slab shifts 12.8px.

At the four gate viewports the claim holds exactly: 1366 108.206/108.084/108.084,
1280 107.304/107.183/107.183, 390 96.862 flat, 320 93.546 flat, 360 93.581 flat — ring unchanged
at 363 / 322 / 247 / 205 / 226 across all three tiers.

### R5 — Claim 5: partial. The wipe still plays, and the bug is alive one click away

`src/App.jsx:1605` refuses only `view === 'home'`, and that is all it refuses.

**(a) A late `game_over` on the menu still fires the RESULTS transition and the game-over
sound.** `setGameOver(payload)` at `App.jsx:1551` runs unconditionally; the effect at
`App.jsx:1683-1688` watches `gameOver` and calls `runTransition('RESULTS')`, and `sndRunOver()`
fires at `App.jsx:1537`. Sampled after LEAVE lands on the menu:

```
t+60ms   menu:true  wipe:true  word:"RESULTS"
t+100ms  menu:true  wipe:true  word:"RESULTS"
t+150ms  menu:true  wipe:true  word:"RESULTS"
t+250ms  menu:true  wipe:false
```

`e2e/wb-adversarial.spec.js:181-196` samples at +900 ms, by which time the wipe has finished, so
the gate cannot see it. The player is still dragged — visually and audibly — just not into a
different screen.

**(b) From STATS and from CREDITS the original defect is untouched.** Leave a game, land on the
menu, tap STATS (or CREDITS), then let the late `game_over` land:

```
STATS   before: "... STATS | COLLECTION | ACHIEVEMENTS | PERSONAL RECORDS ..."
        after:  menu:false  gameScreen:false  text:"... 🔊 | STARTING GAME..."
CREDITS before: "... ← BACK | CREDITS | MADE BY ..."
        after:  menu:false  gameScreen:false  text:"... 🔊 | STARTING GAME..."
```

`view` goes to `'game'` with no live `gameState`, so the player is stranded on the
"STARTING GAME..." placeholder for a game that already ended. Shop, stats and credits are
*views* (`App.jsx:2237/2239/2247`), not overlays over `home`, so the `prev === 'home'` guard
never sees them.

No case was found where the end screen *should* appear and no longer does. The second half of
the claim ("changes nothing else") is true.

---

## SURVIVED

### Claim 1 — the Word Bomb seconds numeral. Survives on every server-reachable input.

Tried: 5s and 300s turns; 16 players; the explosion; the 3-2-1 intro; `timerSeconds` of 0, -1,
`null`, 7.5 and 0.4.

* 5s turn: present and red at 5/4/3/2/1, size 52, `.bomb-num-tick` on each. 300s turn: "300",
  white, size 30, inside the ring. 16 players: present, `insideRing: true` at 28/9/3.
* The red band really is keyed to seconds — white at 7s and red at 5s on both a 60s and a 12s
  turn (`wb-clock.spec.js:185`, passing).
* The holes exist but are not reachable. `showSeconds` requires `timerSeconds > 0`
  (`GameScreen.jsx:876`), so at 0 / negative / `null` the numeral vanishes; a non-integer renders
  literally ("7.5", and "0.4" red at 82px wide, re-keyed per fractional tick). The server never
  produces any of them: `roomManager.js:367-395` decrements an integer and branches to
  `turn_timeout` at `remaining <= 0`, so `timer_tick` carries integers 1..N and never 0.
  Not defensive, but not a live defect.

### Claim 3 — the stiller re-scope. Survives everything I threw at it.

Measured loop sets (`document.getAnimations()` with `iterations === Infinity`):

```
full motion, 2p and 8p, at 29 / 15 / 12 / 10s:  []            (calm, half, warn)
full motion, 2p and 8p, at 8 / 3 / 1s:          [stage-heartbeat, sweat-fly]
reduced motion FROM FIRST PAINT, 8p, all tiers: []
reduced motion toggled MID-GAME at crit:        [stage-heartbeat, sweat-fly] -> []
Category Blitz, all tiers:                      []
```

Category Blitz shares `.game-wrap--wb` (`GameScreen.jsx:3016` is unconditional), so the re-scope
covers it; and Blitz renders no `.game-combo-box` at all, so it has no separate tension layer to
miss. `emulateMedia` before `goto` (first paint) is as clean as after load.

Nit, not a refutation: the list still names `.game-wrap--wb .wb-tension-getout`
(`GameScreen.css:5709`), whose element was deleted in this same commit — a selector matching
nothing, deliberately, and commented as such.

### Claim 4 — the `word_result` idempotency key. Survives; two latent holes documented.

Attacked every path the prompt named and a few more:

* **Category Blitz does not share this handler** — it is `answer_result`, a different branch.
* **The server forbids repeats for the whole game**: `game.usedWords` is created once in
  `createGame` (`gameLogic.js:306`) and never cleared mid-game.
* **PLAY AGAIN / rematch** re-fires `start_game`, which broadcasts `game_started`
  (`roomManager.js:684-750`), which resets the Set (`App.jsx:1068`). Measured: the same three
  words in a second game pay again in full (delta 1200, `taw.rounds.wordBomb` 1 -> 2).
* **Joining a live game is impossible** (`roomManager.js:191`, `game_already_started`), so there
  is no path into a *new* game without a `game_started`.
* **A different player cannot play the same text** — the server's used-word set is global to the
  game.
* Case and whitespace variants of an already-scored word are correctly suppressed (delta 0).
* Unbounded growth: bounded by one game's accepted words, reset every `game_started`.

Two latent holes, neither server-reachable:

1. **An accepted `word_result` with an empty `word` bypasses the guard entirely.**
   `App.jsx:1235-1237` — `resultWord &&` short-circuits both the check and the insert, so every
   such frame pays. Measured: first frame +280, identical duplicate +300, and it would keep
   paying. `gameLogic.js` requires length >= 3, so the server never sends it.
2. **A resync with no `game_started` suppresses the words a second time.** Measured: replaying
   the same three words after only a `turn_update` banks 0. Correct behaviour for a reconnect
   into the *same* game, and no path exists to a *different* game without `game_started`.

### Claim 9 — SHOP / STATS contrast. Survives, including under every theme.

* All five themes (`default / midnight / inferno / toxic / prism`) give SHOP, STATS and REBIRTH
  **#ffffff on #221640 = 16.71:1**, at 1280 and 390. Root cause: `src/theme/themes.js:18-38`
  writes only `--theme-*`; `--v-ink` and `--v-panel-hi` are fixed on `:root` in
  `src/theme/type.css:70,76`, and no CSS file in `src/` contains a `data-theme` selector — the
  themes structurally cannot reach these buttons.
* Hover 16.71, `:active` 16.71, `:focus-visible` gets a real 3px `#FFE94A` outline. `.disabled`
  (`Homepage.css:167`) composites to **4.98:1** via `opacity: 0.5` — above the 3:1 large-text
  floor, and invisible to the gate, which never accounts for element opacity.
* Accessible names: a broadened sweep (adding `textarea`, `summary`, `[tabindex]`, nine more
  roles, and a spec-correct accname that skips `aria-hidden` subtrees) across MENU / SHOP /
  STATS / REBIRTH / CREDITS / RANKS / MARKS / mode-dialog / JOIN-ROOM / ROOM-LOBBY / WORD-BOMB /
  WB-GAMEOVER / BLITZ / SAT-BRIEFING / SAT-PLAY / CHAIN / FUSE at 1280 and 390 found **zero**
  unnamed controls. Nearest miss: `textarea.stats-backup-input` (`StatsScreen.jsx:386`) is named
  by its placeholder only, and `a11y-contract.spec.js:110` neither scans `textarea` nor opens
  STATS. Weak name, not absent.

### Claim 10 — three dead components. Survives, three for three.

* `ComboPill` last consumer removed in `2546329`; classes `combo-pill*` have zero hits in
  surviving `src/`, `e2e/`, `public/`, `index.html`, and `WIN COMBO` appears 0 times in the built
  bundle. (`ComboMeter.jsx` is a different, live component.)
* `GameIcons` last consumer removed in `107c851`; each export (`BombIcon`, `CategoryIcon`,
  `SatRushIcon`, `ChainIcon`, `FuseIcon`, `GAME_ICON_COMPONENTS`) greps to zero, and no barrel
  file exists.
* `ReturnBonusCard` consumer removed in `5d901e8`; the only surviving references are the
  *negative* assertions at `e2e/overlay-modality.spec.js:158,168,249`.
* Every dynamic import in the repo is a literal string path — no template-literal or
  variable-built specifier anywhere. No `@import` in any stylesheet. Portal mode
  (`vite.config.js`) changes only `base`, `outDir` and two plugins — same entry, same graph.
* `vite build` 0, `vite build --mode portal` 0, `eslint src` 0 (37 pre-existing warnings, none
  related).

Collateral, docs only: `README.md:25,52,60` still documents `GameIcons.jsx` as live and tells the
next contributor to add icons to it.

---

## VACUOUS GATES

**One, and it is now fixed.** `src/progress/xp.test.js:502`,
`'need() scales with rebirth, and rc=0 is byte-identical to the base curve'`, asserted

```js
assert.equal(need(n, rc), round10(baseNeed(n) * Math.pow(NEED_REBIRTH_BASE, rc)));
```

— the implementation restated with the constant under test on both sides. Verified: set
`NEED_REBIRTH_BASE = 1` and **it still passes**. The one assertion that names the scaling was
the one that could not see the scaling disappear. (Three other tests in the file — `:515`,
`:535`, `:544` — do catch it, so the constant was guarded, just not where a reader would look.)

Strengthened on this branch: the factor is pinned as a literal `2` and with literal `need()`
values (`need(1,1) === 4460`, `need(1,10) === 2283520`, `need(50,3) === 3697120`). Verified green
at `BASE = 2` (39/39) and red at `BASE = 1`.

Not vacuous, checked: every selector in the seven new specs resolves to a real class in `src/`
(`.shop-overlay`, `.stats-overlay`, `.wb-ring`, `.solo-corner`, `.audio-ctrl`, `.solo-mult`,
`.menu-xp-track` all exist); `.return-bonus` / `.return-bonus-close` match nothing *on purpose*,
as negative assertions.

---

## THE THREE RED-CHECKS

All three were reverted in a working copy, built to an isolated `dist-refute` served on 4189, and
re-run. **All three went genuinely red**, and two reproduced the run's own stated magnitudes
exactly.

| # | fix reverted | gate | result |
|---|---|---|---|
| 1 | `myScoredWordsRef` idempotency guard, `App.jsx:1234-1238` | `wb-adversarial.spec.js:86` "a duplicated word_result pays once" | **RED** — `Expected: 0, Received: 500`. The run claimed "measured 500 extra wins from one repeated frame"; that is the number. |
| 2 | `setView((prev) => prev === 'home' ? prev : 'game')` -> `setView('game')`, `App.jsx:1605` | `wb-adversarial.spec.js:196` "a game_over arriving AFTER leaving" | **RED** — `a late game_over pulled the player back out of the menu: Expected true, Received false`. |
| 3 | `color: var(--v-ink)` off `.homepage-nav-btn.is-shop` and `.is-stats`, `Homepage.css:151,158` | `a11y-contract.spec.js:177` "a11y menu" 1280x720 and 390x844 | **RED** — `homepage-nav-btn is-st "STATS" 1.19:1 need 4.5 @16px`. The claimed 1.19:1, to the digit. |

Source restored and verified clean (`git status -- src/` empty) after each.

---

## WHAT I WOULD FIX FIRST

1. `e2e/wb-clock.spec.js` is red. Either move the in-game coach mark off the fragment slab at
   1366x768, or suppress it while the board is live.
2. `MenuXp.css` — give `.menu-streak` a narrow-width drop rule, and move the
   `.menu-wins-bonus-why` hide to where the slack actually runs out (it is the >=1100px case that
   costs +112.5px, not the <1100 one).
3. `xp.js:500` — gate the legacy-cumulative branch on `rc === 0`, or migrate it at rc=0 before
   applying the new curve. It is currently a one-way level loss for any rebirthed legacy save.
4. Thread `rc` into `levelFromXp` at `xp.js:232`, and hoist one `getRebirths()` per credit in
   `useXpCapture` so the per-keystroke path stops touching `localStorage` twice.
