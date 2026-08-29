# JOB 11 — Adversarial review (attack, don't defend)

Branch `chore/adversarial` off `origin/main` (b2b70fb). Method: static code analysis + Node
harnesses. No Playwright run (node_modules absent, no preview server) — browser-only claims are
attacked statically and flagged as such.

**Scoreboard: 10 clean PASS · 5 BUSTED/overclaim/partial.**
- Hard BUSTED: **15** (perf gate is vacuous).
- Overclaim (false as worded): **7**, **13**.
- Partial bust / "flake" undersells a real bug: **14**.
- Cross-branch regression (claim passes on its own branch, but the *other* fix branch silently
  reverts it): **4**.

---

## LEAD FINDING — the two fix branches CONFLICT on HoldBuy; merging `fix/app-churn` re-breaks what `fix/hold-flake` fixed (claim 4 area)

Both branches are off the same `main` HEAD and both rewrite `src/components/ShopScreen.jsx`'s
`HoldBuy`, in **incompatible** ways:

| | commit mechanism | unmount cleanup | frame-throttle safe? |
|---|---|---|---|
| `main` (baseline) | `a.onfinish` (WAAPI) | none | NO |
| `fix/hold-flake` | `window.setTimeout(holdMs)` wall-clock | yes (`useEffect(() => () => clearTimeout)`) | **YES** |
| `fix/app-churn` | `a.onfinish` (WAAPI, line 459) | **none** | **NO** |

`fix/hold-flake` correctly moves commit to `setTimeout` (real elapsed time, frame-rate
independent) and adds unmount cleanup. `fix/app-churn` touches the SAME function for a different
reason (removing the `HoldBuyButton` nested-component alias) but **keeps `a.onfinish`** — the exact
frame-timeline dependency hold-flake's own comment calls out as the bug ("onfinish … tied to the
document/animation timeline, which only advances as frames … a ~400ms hold could fail to buy").
`app-churn`'s HoldBuy also has **no unmount cleanup**, so a WAAPI animation whose element unmounts
mid-press can still resolve `onfinish` → commit on a gone component.

**Consequence:** if `fix/app-churn` merges after (or independently of) `fix/hold-flake`, it silently
regresses the hold-to-buy-under-load fix. These two branches must be reconciled into ONE HoldBuy
(setTimeout commit + no nested alias + unmount cleanup), not merged in sequence.

Claim 4 **as worded** ("HoldBuy commits on wall-clock") is **PASS on `fix/hold-flake`** — verified:
`setTimeout(holdMs)` commit, `pointerup/leave/cancel` clears it (release-early cancels, by design),
unmount effect clears a pending hold. Background-tab throttling is a non-issue (you can't hold a
button in a backgrounded tab). The bust is that `app-churn`'s HoldBuy is **frame-throttle-prone**,
exactly as the task's sub-question suspected.

---

## BUSTED / overclaim / partial

### Claim 15 — "purchase-feel-perf medians under 50ms (load artifact when higher)" — **BUSTED (vacuous gate)**
`e2e/purchase-feel-perf.spec.js` asserts only `median frame time < 50ms` (line 83). Headless
Chrome rAF is bimodal at ~16.7/33.3ms (vsync), so the median lands under 50ms for **any** build
whose frames hit vsync — the threshold sits *above* the 33.3ms bimodal ceiling. The test's own
comment concedes the median "does NOT correlate with tier … here we only guard against a runaway."
A median >50ms means **>half of all frames** exceed 3 vsync intervals — a catastrophic sustained
stall, not ordinary jank. Real jank signatures (dropped frames, per-keystroke hitches, p95 spikes)
never move the median past 50ms — and **p95 is computed but NOT asserted** (line 55, only printed).
So "medians under 50ms" is true but proves nothing about jank; it's a total-collapse detector, and
its "load artifact when higher" framing is self-fulfilling (the only way to exceed a threshold set
above normal operation is machine overload). Not a meaningful perf gate.

### Claim 7 — "title↔XP gap ≥12px at every viewport" — **OVERCLAIM**
The ≥12 assertion lives ONLY in `e2e/menu-fit.spec.js:60`, run at **7 landscape viewports, all
≥1024px wide** (1920→1024, plus 1163×501). The measurement itself is sound — `getBoundingClientRect`
returns the rotated title's true AABB, so the `rotate(-2deg) skewX(-4deg)` overhang IS accounted
for. But **no portrait/phone viewport tests this metric.** `menu-vgap.spec.js` DOES cover 390×844
and 360×640 — but it measures stage **top/bottom frame gaps**, not the title↔XP gap. So "every
viewport" is unsubstantiated for mobile portrait (the dominant real traffic). Title font-size is
`--menu-scale`-driven (no fixed margin protecting the gap), so mobile is a legitimate risk zone the
suite leaves unguarded. (Static only — no concrete sub-12 measurement without a browser.)

### Claim 13 — "viewport-integrity passes = every screen fits at every viewport/theme" — **OVERCLAIM**
`e2e/viewport-integrity.spec.js` is strong (24 screens × 7 viewports × 5 themes = 840 cells) but
"every screen / every viewport" is false. Real, nameable gaps:
- **Screens absent from the `SCREENS` list:** `AchievementsScreen`, `CollectionScreen`, the SAT
  RUSH **play** screen (the wanted-poster `SatRushGame`) and `SatRushResults`, and every transient
  overlay — `connectionLost` (seat-lost blocking overlay), `serverError`, `roomClosedNotice`,
  `confirmLeaveDaily`, the return-bonus `returnCard`, daily-result card. Only `sat-modeselect` and
  `sat-briefing` represent SAT.
- **Keyboard-open not simulated.** All in-game input screens are measured at full viewport height;
  the mobile on-screen keyboard shrinking `visualViewport` (the classic overflow trigger) is never
  exercised.
- **Content is fixed & short.** Player names 'YOU'/'RIVAL', category 'FRUITS', score 30. No long
  usernames, long words/combos, long category names, full public-room lists, 5000-word collection,
  or many stats records — i.e. no content-length stress.
- **Mid-animation excluded** by design (`freezeAnimations` + waits) — only settled layout is
  checked.
- **Vertical fit enforced only for overlays** (line 133); scrolling screens may run arbitrarily
  past the fold. "Fits" ≠ vertical fit for full-page screens.
- 7 fixed viewports; smallest width 360px — no 320px, no landscape phone, no tablet portrait.

### Claim 14 — "the 18 full-suite failures were all load flakes" — **PARTIAL BUST (real race, "flake" undersells it)**
I could only inspect the flagged word-bomb-scoring 130-vs-110 case; the other 17 can't be verified
from here. That one is **caused by a real design race, not test infra.** `rarityOf(word)`
(`src/progress/rarityIndex.js`) returns the **COMMON/×1 default until an async dynamic `import(
'../solo/words.recall.txt?raw')` resolves**. The test (`word-bomb-scoring.spec.js:86`) expects 130
= weight 6.5 (CAT 1.0 + BAT 1.5 + HAT 1.0 + RAT 1.5 + MAT 1.5) but pushes the 5 `word_result`
frames with only 40ms gaps and **never waits for the rarity index to load**. 110 = weight 5.5 =
exactly two of {BAT,RAT,MAT} scored COMMON because the import hadn't resolved when those words were
processed. So yes it's "load"-related — but it exposes genuine product behavior: **a player typing
fast right at game start, before the rarity chunk loads, has their first words under-paid** (scored
COMMON instead of UNCOMMON). Calling it "just a load flake" masks a real economy race in the
scoring path; an isolated re-run passing only means the import won the race on an idle machine.

---

## CLEAN PASS

### Claim 1 — "App no longer re-renders per beat; useBeatSync holds no state" — **PASS**
`src/hooks/useBeatSync.js` on `fix/app-churn` removes `useState` entirely (import trimmed to
`useEffect, useRef`); the hook returns nothing and holds no state — verified. Per-beat reaction is
now an `onBeat` callback read through `onBeatRef`, so the analysis loop never re-subscribes and
never bumps host state. On menu/shop `onBeat` is a no-op → those views are render-quiet. The one
remaining per-beat App re-render is the **in-game** `triggerShake('light')` (`setShake`), which is
gated to `viewRef.current === 'game'` and is intentional/unchanged. No other per-frame setState in
App: no `requestAnimationFrame`/`setInterval` in App.jsx; `timerSeconds` is server-driven.

### Claim 2 — "data-beat still written, nothing else depended on beatCount" — **PASS**
`useBeatSync` still writes `--beat-intensity`, `--flash-color`, and `setAttribute('data-beat')` in
the loop (lines 99–108) and clears them in `applyNeutral`. The ONLY reference to `beatCount`/
`isAnalysing` anywhere on `fix/app-churn`'s `src/` is a comment — no live consumer lost anything.

### Claim 3 — "after rebirth the shop overlay closes (reveal onDone stabilised)" — **PASS on both branches**
`ShopReveal`'s auto-dismiss effect deps are `[reveal, dur]` and reads `onDone` via `onDoneRef`
(mutated each render, never a dep) on BOTH branches. `reveal` is ShopScreen state set once per
reveal, so the completion `setTimeout(dur + 1100)` arms exactly once and is immune to parent
re-renders — the failure mode (App churn recreating `onDone` and resetting the timer forever) can't
occur. Rebirth path: `setReveal({kind:'rebirth', onClose: onBack})` → timer fires
`onDoneRef.current()` (`setReveal(null)`) + `reveal.onClose()` (`onBack`) → overlay closes. (churn
extra-stabilises with `dismissReveal = useCallback`; hold-flake passes an inline `onDone` but the
ref makes that irrelevant.)

### Claim 5 — "no React component defined inside another component's render, anywhere" — **PASS (static)**
`react/no-unstable-nested-components` set to `error` on `fix/app-churn`. Grep of all `src/` for
indented capitalized `const … = (…) =>` / `function X(` / `=> <X` returns only **stable
module-level lookups**: `const ArtComponent = GAME_ART_COMPONENTS[game.artKey]`,
`const IconComponent = GAME_ICON_COMPONENTS[game.id]` (both from module-scope maps in
GameArt/GameIcons), and `const Splat = sp.comp` from the module-level `WALL_SPLATTERS` array. None
define a component in render — all reference imported, stable identities, which the rule correctly
does NOT flag and which don't remount. `main`'s `const HoldBuyButton = (props) => <HoldBuy/>` (the
real violation) is removed on both fix branches. (Couldn't run eslint — no node_modules — but the
grep found no missable useMemo/HOC-wrapped inline components.)

### Claim 6 — "OFF is truly silent — nothing plays before a user gesture" — **PASS (static)**
Music `play()` is called only from `startMusicOnGesture` bound to `pointerdown/keydown/touchstart`
(App.jsx 609–623) — a real gesture. `toggleMute` also calls `play()` only from a button.
Even a stray `play()` can't sound: `audio.play()` rejects outside a gesture (caught → stays
silent), and `ensureCtx`/`ensureAnalyser` build the AudioContext **suspended** (browser autoplay
policy); `ctx.resume()` outside a gesture no-ops. SFX (`gameSounds.js` `ready()` → `ensureCtx()`)
inherit the same suspended-context backstop and only fire on gameplay events (post-gesture).
Persisted mute (`taw.musicMuted='1'`) keeps gain at 0 even after a gesture. No autoplay, no
mount-time or timer-driven `play`.

### Claim 8 — "SAT new-word definition error rate ~0%" — **PASS**
Spot-checked 32 of the hardest/most-mis-glossed words (contronyms, false friends, fine sense
distinctions) against my own knowledge. All accurate, incl. the classic traps: **enervate**="drain
the strength" (not energize), **noisome**="offensively smelly" (not noisy), **sanction**="give
official approval", **peruse**="read carefully", **venal**="corruptible" (vs venial), **flout**
"disregard" (vs flaunt), **proscribe**="forbid" (vs prescribe), **tortuous**="full of bends" (vs
torturous), **restive**, **nonplussed**, **specious**, **ingenuous/disingenuous**, **mendacious**,
**mitigate**, **discreet**. Zero wrong glosses. Only nuance: **fortuitous** gloss adds "lucky"
(strict = "by chance"), but the alt "accidental" + context support it and modern dictionaries
accept it — not an error.

### Claim 9 — "344 new SAT words are a clean superset of main (0 removed)" — **PASS**
Node diff of `src/data/satRush/words.json` across `main` (612 words) and `data/sat-words` (956):
**0 removed, 344 added, 0 duplicates, 0 schema failures.** Clean superset confirmed. ⚠ NOTE: the
`data/sat-words` branch also deletes a lot of unrelated files (CLAUDE.md sections,
`.github/workflows/ci.yml`, many `claude/*.md`) — it's branched from a stale base. The *word-set*
claim holds, but the branch is a merge hazard (would revert those files); rebase before merge.

### Claim 10 — "formatNum never returns NaN/Infinity" — **PASS**
Harnessed `src/format.js` against NaN, ±Infinity, null, undefined, "5", "abc", -0, 0.0001, 1e-30,
negatives, 999999/999950 (carry), 1e21, 1e100, `MAX_VALUE`, `MAX_SAFE_INTEGER`, {}, [], [5]. **Zero
NaN/Infinity/undefined outputs** — `Number.isFinite(n) ? n : 0` catches all non-finite/non-numeric.
Cosmetic-only quirks (not busts): `formatNum(-0)` → "-0"; absurd magnitudes (1e100) →
"1.0000…e+82Qi" (exponential string), which the code comment acknowledges the game never reaches.

### Claim 11 — "Collection hard-capped so 100k words can't blow storage" — **PASS**
`src/progress/collection.js`: `COLLECTION_CAP = 5000`. Eviction runs on the **write** path
(`recordAcceptedWord`): on a new word, if `keys.length >= CAP` it finds the min-`seq` (LRU) entry
and `delete`s it **before** inserting → count can never exceed 5000 for a fresh store (evict-1-add-1
even from an oversized imported save, so it never grows). `save()` wraps `setItem` in try/catch
(quota-safe). 100k distinct words → bounded at 5000 (~140KB).

### Claim 12 — "wins bank per-word in every mode" — **PASS**
`bankWordWins` (the only per-word GRANT path — `saveWins(getWins()+granted)`) is called in all five
modes: Word Bomb (App.jsx:1036, `word_result`), Category Blitz (App.jsx:1179, `answer_result`), SAT
Rush (SatRushGame:90), Chain (ChainGame:158), Fuse (FuseGame:153). `awardWins` is **pure** (returns
a number, no grant) — the `awardWins(...)` calls in App/SAT/Chain/Fuse are display tallies
(`setWinsTally`/results totals), so **no double-pay**. `recordRound` (the round-level grant) is not
called in live gameplay (only comments/tests reference it). No mode is left out; Blitz banks
per-accepted-answer (= per word).

---

## What I could assess STATICALLY only (no browser/Playwright run)
Claims **3, 4, 5, 6, 7, 13, 14, 15** — all involve runtime/browser behavior or the e2e harness and
were attacked by reading the code + tests, not by execution. Claims **1, 2, 8, 9, 10, 11, 12** were
verified directly (source read and/or Node harness). The word-set diff (9), formatNum harness (10),
and gloss check (8) are execution-backed.
