# JOB E — Adversarial review, ROUND 2 (attack 15 DIFFERENT claims)

Branch `chore/adversarial-2` off `origin/main`. Method: static code reading + Node harnesses on the
pure modules. **No Playwright** (no preview server) — every runtime/e2e claim is attacked by reading
the code + test, and flagged `[static-only]`. Round-1 report (`chore/adversarial:claude/adversarial.md`)
read first; these 15 are DIFFERENT claims, pulled from the merged-to-main feature reports
(`claude/*-report.md`), the fresh fix commits (ffbabc0, a749aa8, 50fa8b2), and a re-check of round 1's
own conclusions (SAT superset, formatNum, the claim-14 rarity race).

**Scoreboard: 14 PASS · 1 BUSTED-and-survived (overclaim).**
The one surviving finding: the **menu-fit "≥12px at EVERY viewport" fix (ffbabc0) is still only
measured at ≥1024px landscape** — no portrait/phone measurement exists. Plus one **refutation of a
round-1 finding** (claim 14's rarity-race severity is overstated — the index warms at app boot).

Execution-backed (Node): mastery curve, SAT superset diff, formatNum harness, rarity-corpus ranks,
font/SVG byte sizes. Everything else is static read.

---

## THE ONE SURVIVING FINDING

### C7 — ffbabc0 "keep title↔XP gap ≥12px at EVERY viewport" — **OVERCLAIM (survives)** `[static-only]`
The commit title promises "every viewport." The commit body's OWN evidence: *"Measured gaps now
14.0–19.2px across 1024×600…1920×1080."* Every measured point is **landscape ≥1024px wide.** The only
spec asserting the ≥12 gap is `e2e/menu-fit.spec.js` (round 1 already established it runs at 7
landscape viewports, all ≥1024). **No portrait / phone viewport measures this metric** — exactly the
dominant real traffic, and exactly what round 1 flagged. The "fix" did not add portrait coverage; it
raised the stage `row-gap` clamp (`min(16→20)`, `2.2vh→2.8vh`). So "every viewport" remains an
overclaim of *verification*.
- **Refutation attempted (partly softens severity, doesn't kill the finding):** the raised **20px
  floor** on `row-gap`, with the fit-scale shrinking the title (and therefore its AABB overhang) on a
  short viewport, makes an *actual* sub-12 gap at 360×640 **unlikely** — the gap trends toward the
  row-gap as the title shrinks. So this is an overclaim of coverage, not a demonstrated regression.
  It survives as "‘every viewport’ is unproven for portrait," which is the honest state.

---

## REFUTATION OF A ROUND-1 FINDING

### Round-1 Claim 14 ("a real player typing fast at game start has first words underpaid") — **SEVERITY OVERSTATED** `[static-only]`
Round 1 correctly identified that `rarityOf()` returns COMMON (×1) until the async
`import('words.recall.txt?raw')` resolves (`rarityIndex.js`), and that this feeds BOTH wins and XP
(`App.jsx:1024–1028` — `wbWeight` drives `bankWordWins` *and* `awardWordXp`). True. **But the race
window is far smaller than "at game start" implies:** `loadRarityIndex()` is kicked off at **App
mount — i.e. when the MENU loads** (`App.jsx:433`, an empty-dep effect), *and* again by
`useXpCapture.js:50` ("warm the rank index so the menu self-test can score words"). It is NOT deferred
to game mount. A real player loads the menu, picks a mode, and waits out matchmaking/countdown — many
seconds — before typing, by which time the ~200KB raw chunk (kicked off at boot) is long resolved. So
the "first words underpaid for real players" framing is **unlikely in practice**; the residual risk is
a CI-under-load e2e flake, not a live economy leak.
- I verified the *test* fix too: `word-bomb-scoring.spec.js` on main now uses `expect.poll(...).toBe(130)`
  (b4429f9). Note the poll fixes the **bank→localStorage drain** race, **not** the rarity-index race —
  a word banked at COMMON is banked permanently, so if the index ever lost the race the poll would
  **time out at 110**, not flake-pass. It rarely fires only because of the boot-time warming above.

---

## THE 15 CLAIMS

### C1 — Mastery curve `round(50·1.4^n)`; cumulative M2=70/M5=497/M10=3,440/M15=19,271/M20=104,411; +3%/lvl, M20=+57% — **PASS** (Node)
`mastery.js`: `masteryNeed(l)=round(50·1.4^l)`, `masteryWordsToReach` sums it. Node reproduction:
`M2 70, M5 497, M10 3440, M15 19271, M20 104411`; `masteryXpMult(M20)=1+0.03·19=1.57`. All exact.

### C2 — WORD SENSE: COMMON never boosted, effect ×2.5/tier, cost ×6 (T1=500), applied OUTSIDE the ×40 cap, XP unboosted — **PASS**
`wordSense.js`: `wordSenseWinsFactor = 1 + max(0,r−1)·(2.5^t − 1)` → COMMON (r=1) = 1 exactly.
`wordSenseCost = keyTierCostAt(t+1)`; `KEY_TIERS` costs are `500,3000,18000,…` (×6). At all 5 accept
sites (`App.jsx:1027,1171`, Chain:151, Fuse:148, SAT:85) the WINS weight is
`cappedWeight × wordSenseWinsFactor(rarity.mult)` — the cap is applied first (`cappedWordMult`), then
WORD SENSE multiplies *outside* it. XP (`awardWordXp{ weight: wbWeight }`) uses the **unboosted** capped
weight — no WORD SENSE contamination. OBSCURE(×4)@T1 = 1+3·1.5 = ×5.5 ✓.

### C3 — Collection milestones 100→5k / 500→50k / 1k→250k / 2.5k→2M / 5k→20M, ×live rebirth, cap 5000 LRU — **PASS** `[static]`
`collection.js` `COLLECTION_MILESTONES` matches exactly; grant = `round(m.wins·rebirthMult(getRebirths()))`
on the write path; one milestone per new word (count rises by 1). Cap 5000, LRU evict-before-insert.

### C4 — Achievements: 32 total (27 visible + 5 secret), COMPLETIONIST two-pass, each ×live rebirth, idempotent — **PASS** (count executed)
`achievements.js` `ACHIEVEMENTS` counted: 5 VOLUME + 3 SPEED + 4 VOCAB + 4 PROGRESSION + 3 STREAK +
6 MODES + 2 ECONOMY + 5 SECRET = **32**; 5 `secret:true` → 27 visible. `checkAchievements()` runs two
passes so `sec-completionist` (test = every other id earned) settles; `wins=round(base·rebirthMult)`;
skips already-earned (idempotent). `rebirthMult(0)=1`, so R0 grants base×1.

### C5 — Edge-states: CHAIN/FUSE word-load failure shows RETRY + always-present EXIT; retry re-fetches — **PASS** `[static]`
`ChainGame.jsx`/`FuseGame.jsx`: `loadSoloWords().then(setData).catch(()=>setLoadError(true))`;
`if(loadError||!data) return <SoloLoadState error onRetry={()=>setLoadKey(k=>k+1)} onExit/>`.
`SoloLoadState.jsx` renders "COULDN'T LOAD WORDS", a RETRY, and an always-mounted ✕ EXIT. Retry is real:
`words.js` sets `cache` **only on success** (line 38), so a bumped `loadKey` re-runs the effect and
re-attempts the dynamic import.

### C6 — Assets: Bungee Shade subset = 10,984 B (was 30,368); 4 SVGs = 2,880 B total — **PASS** (measured)
`public/fonts/bungee-shade-latin.woff2` = **10,984 bytes** (matches the report exactly).
`find public -iname '*.svg'`: exactly 4 files (paint-drip 632 + star 585 + starburst 489 + favicon
1174) = **2,880 bytes** (exact).

### C7 — menu-fit "≥12px at every viewport" — **BUSTED (overclaim)** — see the surviving-finding section above.

### C8 — SAT word set is a clean superset (0 removed, 344 added, deduped) — **PASS** (Node re-diff of round-1 c9)
Fresh diff `origin/main` vs `origin/data/sat-words` `words.json`: main 612 uniq / sat 956 uniq, **0
removed, 344 added, 0 dups either side, 0 schema failures** (word/gloss/tier/context all present).
Round 1's claim 9 re-confirmed independently.

### C9 — formatNum never returns NaN/Infinity/undefined — **PASS** (Node re-harness of round-1 c10)
Ran the real `format.js` over 29 hostile inputs (NaN, ±Infinity, null, undefined, '5','abc', -0, 1e-30,
1e21, 1e100, MAX_VALUE, {}, [], [5], '', boundaries). **0 bad outputs.** Cosmetic quirks only:
`-0`→"-0", `1e100`→"1.0…e+82Qi" (game never reaches). Round 1's claim 10 re-confirmed.

### C10 — Known bug: `room_update` handler uses functional `setView` guard — **PASS** `[static]`
`App.jsx:814`: `setView((prev) => (prev === 'game' || prev === 'cg-arm' ? prev : 'room'))`. The broken
`if (view !== 'game')` form is absent. Functional form present (and now also guards `cg-arm`).

### C11 — Known bug: useWebSocket FIFO queue + App drains EVERY frame — **PASS** `[static]`
`useWebSocket.js`: `messages` is an array; `onmessage` appends `setMessages(p=>[...p,parsed])`;
`consumeMessages` uses a functional slice. `App.jsx:785` **iterates the whole queue**
(`for (const lastMessage of messages)`), then `consumeMessages(messages.length)` (deps
`[messages,consumeMessages]`). No single-slot overwrite; no skipped frame on batched delivery.

### C12 — Known bug: screen renders off LIVE `view`, not a lagging copy — **PASS** `[static]`
`App.jsx:1852+` is a straight `if (view==='game') … else if (view==='room' && room) …` chain. No
`renderedView`, no setTimeout-swapped copy anywhere in App.jsx. Live-state render confirmed.

### C13 — will-change lists only transform/opacity, never on idle nodes — **PASS** (grep-verified)
Grepped every `will-change` in `src/`: every CSS declaration is `transform` and/or `opacity`; JS sets
`willChange='transform'`/`'transform, opacity'` on play and clears it on finish (GameCard, MenuXp,
magneticPull). The build-failing guard `src/perf/willChange.test.js` is present. No box-shadow/filter/
border-color/custom-prop will-change survives (comments note the removed no-ops).

### C14 — MENU MOTION LAW: no idle/ambient loops on the menu — **PASS** `[static]`
`Homepage.css`: the only `infinite` animation is `connecting-spin` (line 901) — the **transient
connection spinner**, not an idle-at-rest ambient loop. Beat motion is `title-beat-pop` (120ms finite)
+ `menu-beat-glow` (beat-driven). Matches CLAUDE.md's "menu went 59 → 1 looping animation" (the 1 = the
spinner). No idle loop at rest.

### C15 — WB instant local-reject mirrors the server; not_a_word round-trips — **PASS** `[static; server parity assumed]`
`GameScreen.jsx:2485–2497`: for non-category, `w=word.trim().toLowerCase()`; `too_short` (len<3),
`missing_combo` (`!w.includes(comboLc)`), `already_used` (`usedItems` lowercased) → `onLocalWordResult`
+ clear box + **return (never sent to server)**. Anything else falls through to the server (dictionary
`not_a_word` round-trips). Same trim/lowercase/fragment/used-set as documented. Server-side parity is
**assumed** — the backend (`server.js`) is a separate repo not present here.

### (bonus) Economy test numbers (50fa8b2) are genuine, not massaged — **PASS** (Node, corpus ranks)
Against the real `words.recall.txt` (31,482 words, COMMON<3000): cat=1451, hat=2505 → COMMON ×1;
bat=5427, rat=4409, mat=4606 → UNCOMMON ×1.5. So `CAT+BAT+HAT = 3.5 wt ×20 = 70` and
`+RAT+MAT = 6.5 ×20 = 130` and the 5 real commons = `5.0 ×20 = 100`. The updated expectations match the
code's real output — the specs were fixed to the truth, not to a convenient number.

---

## SURVIVED REFUTATION — what I dropped, and why

- **DROPPED: "Sound rule / report violated — `public/firecracker.mp3` is an external audio file."**
  Found `public/firecracker.mp3`. Refuted: it is referenced only by `useMusicPlayer.js`
  (`new Audio('/firecracker.mp3')`) — it is the **background MUSIC track**, not a sound EFFECT. The
  CLAUDE.md rule ("**Sound effects** use Web Audio API synthesis, no external audio files") and the
  sound report's "zero asset files" both scope to the SFX set, which is genuinely synthesized
  (`audioCore.js`/`gameSounds.js`). Music-as-a-file is a separate, pre-existing feature. **Not a bust.**

- **DROPPED (to a refutation, not a bust): round-1 claim 14 rarity-race severity.** See the refutation
  section — the race warms at app boot, so the "real-player underpayment" framing is overstated. I did
  NOT flip this into a new bust because the residual (a CI-under-load e2e flake) is real if small; I
  report it as a severity correction on round 1, not a new defect.

- **DROPPED: "menu-fit fix causes a real sub-12 gap at 360px portrait."** Could not be measured
  (no browser), and the raised 20px row-gap floor makes it unlikely. Kept only the *provable* half —
  that "every viewport" is an unverified overclaim — and dropped the unprovable "it actually regresses."

- **DROPPED: "awardWins display tally diverges from banked wins (rarity/WORD SENSE ignored)."** The HUD
  `winsTally=awardWins({wordsAccepted,mode,difficulty})` is count-based and ignores rarity/WORD SENSE,
  while `winsEarnedTotal` (the real bank) is weight-based — they can differ. Refuted as a *bust*: this
  is a known display-vs-grant split (round 1's claim 12 already labeled `awardWins` a pure display
  tally), there is **no double-GRANT**, and the direction is a cosmetic under-display, not lost wins.
  Not worth escalating.

## Static-only vs execution-backed
- **Execution-backed (Node):** C1 (mastery), C4 (count), C6 (byte sizes), C8 (SAT diff), C9 (formatNum),
  and the economy-corpus check.
- **`[static-only]`:** C3, C5, C7, C10, C11, C12, C14, C15, and the round-1-claim-14 refutation — all
  runtime/e2e/browser behavior read from source, never executed. C2 is static + the tier math is Node.
