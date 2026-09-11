# OVERNIGHT RUN — landing pad

All five phases ran. Nothing merged to main, nothing deployed, backend never pushed.
Every finding below was attacked by a second agent before it was written down; where the
refutation changed the answer, the change is stated rather than quietly folded in.

---

## THE FIVE THINGS THAT NEED YOU

**1. THE RUN's economy pays ~20-40x under its own target.** The repo's own
`claude/run-econ-sim.mjs`, run unmodified, fails its own acceptance check today. Bisected to
**`c180f90` (deck rebalance)**. §4a.

**2. Two branches want your 2-device play-test before they go anywhere** —
`release/prod-1` and `integration/run-stack-3`. Both Tier 1 by CLAUDE.md's own rule.

**3. The WB layout decision, still open — it blocks nothing now but it is unresolved.** §1b has
the numbers both ways. Phase 3b shipped on the stack's side and cleared its gate regardless.

**4. A build-failing gate is blind, and the budget it guards is actually being violated.**
`src/perf/willChange.test.js` passes while 11 idle menu nodes carry `will-change`, and two
`infinite` animations run on non-compositor properties. §4b-i.

**5. Category Blitz solo never tells the player what they earned** — it pays wins through the
same path as multiplayer and then never shows the line. §4c.

---

## DEPLOYMENT URLS

| branch | HEAD | preview |
|---|---|---|
| `release/prod-1` | `ad1d7b1` | https://wordarcade-frontend-r0ksljuhc-beenchilling.vercel.app |
| `integration/run-stack-3` | `74fd49e` | https://wordarcade-frontend-grxfo59cg-beenchilling.vercel.app |
| `feat/solo-slabs` | `184d8aa` | https://wordarcade-frontend-3ey3lbbni-beenchilling.vercel.app |
| `fix/wb-rail-used-words` | `dcd2f0e` | https://wordarcade-frontend-nbnbay640-beenchilling.vercel.app |
| `docs/block-state-4` | `a902149` | (docs only) |
| backend `fix/blitz-data` | `c832299` | **LOCAL ONLY — never pushed** |

All five frontend branches verified in sync with origin by `git ls-remote`. `release/prod-1`,
`integration/run-stack-3`, `feat/solo-slabs` and `fix/wb-rail-used-words` were each additionally
verified LIVE by grepping the deployed bundle for a marker unique to the change — a green suite is
not proof of shipping.

---

## WHAT SHIPPED (branches, none merged)

| branch | what | gate |
|---|---|---|
| `release/prod-1` | the 8 merges + a WB phone-overflow fix | 1104/1107, 3 verified flakes |
| `integration/run-stack-3` | draft-badges + release/prod-1 + a TRY-THE-RUN route fix | 1126/1130, 4 = the WB gate |
| `feat/solo-slabs` | CHAIN/FUSE slabs (pre-existing) + 3 phone-collision fixes | 1125/1125 |
| `fix/wb-rail-used-words` | used words into the <=2-player rail | 1128/1132, 4 = the same WB gate |
| `docs/block-state-4` | block-state doc re-measured | — |

### Bugs found and fixed on those branches
- **WB overflowed the phone viewport** (`release/prod-1`). Your dry-run covered only the 24 new
  specs; the full 1107 caught it. Bisected: appears at `fix/wb-short-layout`, unchanged by
  `feat/wb-bot-turn`. Cause measured, not guessed — the phone player bar is 308px and two 149px
  slots + a **10px** gap fit that row EXACTLY; widening the gap to 20px globally pushed the pair to
  318px, so one card fit per row, the bar wrapped 2 rows -> 3 (168px -> 261px), and the stage grew
  by exactly that 93px. fillH 94.2% -> 104.0% -> 94.2%.
- **The TRY THE RUN button would have sent players to the menu** (`integration/run-stack-3`).
  Semantic merge conflict git could not see: `MODE_PATH` predated the run stack's 6th mode, so
  `pickTryMode()` fell through to `|| '/'`. Caught by the spec's own guard test.
- **Three phone collisions in CHAIN** (`feat/solo-slabs`), two of which had ONE cause: at 320x640
  the card's content is ~686px inside a 624px card and `.solo-body`/`.solo-primary` CENTRE their
  children, so overflow spilled out of BOTH ends — ring onto the HUD, supply hint onto the input.
  `justify-content: safe center` fixes both.
- **Used words moved into the <=2-player rail** (`fix/wb-rail-used-words`): bomb **40.8% -> 60.0%**
  of its cell at 1366x768 against your >=55% gate; 3-player template provably untouched.

---

## WHAT NEEDS YOUR TASTE (built, stopped, written down)

**The WB layout, §1b.** The stack's board fails 2 of the `wb-short-layout` gates at all four
viewports and NEITHER failure is a visual defect:

| viewport | bomb %cell wholesale | ported | gate | card overlap | gate |
|---|---|---|---|---|---|
| 1366x768 | 40.8 | **50.7 PASS** | >=50 | 393.8px | <=0 FAIL |
| 1440x900 | 45.1 | 46.8 FAIL | >=50 | 416.1px | <=0 FAIL |
| 1536x864 | 43.9 | 46.5 FAIL | >=50 | 444.5px | <=0 FAIL |
| 1280x720 | 40.0 | **50.0 PASS** | >=50 | 368.3px | <=0 FAIL |

The **card-overlap gate measures the wrong geometry** — it sorts by `left` and asserts
`prev.right - next.left <= 0`, a HORIZONTAL test, against a VERTICAL rail where all three cards
share a `left`. There is no visual overlap. Fixing it means changing the SPEC. The **bomb port
half-works** (2 of 4) and clearing the other two needs a ~302px bomb against the stack's deliberate
240px cap. I left the branch at your instructed wholesale resolution and saved the experiment as
`claude/wb-bomb-port.patch` (`git apply`).

---

## WHAT I FOUND AND COULD NOT FIX

### §4a — THE RUN's economy (HIGHEST VALUE FINDING OF THE RUN)
The refutation **upgraded** this and **proved the audit's stated cause wrong**. It rebuilt the
engine at `70d13f5` — the commit that wrote BOTH the `/10` divisor and the sim — and the same sim
**passed at 594/727/938 wins/min**, exactly the 590-940 band `engine.js:233-240` claims. So the
target is LIVE, not a stale comment. Bisecting forward, the break lands at **`c180f90` (deck
rebalance)**, not the wall retune the audit blamed (which moved it 157->155).
Re-priced on the real 30s clock: **24-36 wins/min against a 625-963 band.** `+0 WINS` observed live.

Also on THE RUN, all confirmed by a second agent:
- **A stray Enter costs 20% of a round.** Controlled A/B, same words and seed: 196 vs 245.
  `useRunMode.js:244`'s own comment says an empty submit is not an attempt; `:245` punishes it as
  one. `useSoloGame.js:181` has the guard RUN lacks.
- **✕ silently forfeits round 1** (live score 66). Never caught because
  `e2e/run-leave-confirm.spec.js` tests wall-before-round-1 and mid-round-**2** — round 1 is the gap.
- **A rejected word RAISES your combo under HOT STREAK** — `fail()` sets `p.combo = 1` instead of
  `knobs.comboStart` (0.6). Found by the refuter, absent from the original audit.
- DEEP POCKETS is order-sensitive: **47.5%** of random-drafted runs affected, mean |swing| 6.2%.
- The accept-list grows mid-round: `NOT A WORD` at T+2.0s -> `OBSCURE! +43` at T+19.4s, same seed.
  Slow-link-only, but **179,239 ext-only words**, not the 59,631 claimed.
- Dealer/oracle share a seed (`2654435761 === 0x9e3779b1`) — **downgraded to LOW**: invisible and
  unexploitable, because the draft is dealt after the round.
- **Clean and stayed clean:** double-pay, RUN AGAIN reset, forfeit payout, the round clock under a
  CDP-frozen lifecycle, dealer invariants over 450k offers, RNG determinism. 6 of 8 spot-checked.

### §4b-i — perf: a blind gate and a false clean on the animation budget
The refutation **struck the audit's main attribution** by finding a methodological hole: the
audit's only route to the menu was tapping the splash, which is ALSO the gesture that starts the
music, so every "menu idle" number was menu **+ beat detector** while its CHAIN baseline had no
gesture.
- **The beat is the cost.** mp3 blocked -> menu collapses to 12 layouts / 12 recalcs / 16.7ms.
  **~93% of idle recalcs and 100% of the 30fps are the beat.** The audit's mute ablation was a
  no-op: `useMusicPlayer.js:138-140` wires the analyser as a **pre-gain tap**.
- **`GameCard.jsx:82`'s unconditional rAF is near-free** — ablated at page level, recalcs 12->12,
  layouts 12->12, frame time unchanged. ~8ms per 3s ≈ **0.3% of one core**, not the ~1/3 claimed.
  It still lacks a settle check (`magneticPull.js` does it right) but it is not a perf finding.
- **FALSE CLEAN on a build-failing budget:** "intersection 0" is actually **2** —
  `cb-input-checking` animates `border-color` `infinite` (`GameScreen.css:2162`) and `die-pulse`
  animates `filter` `infinite` (`TransitionIntro.css:307`, whose own comment says it "only touches
  filter"). Both non-compositor, both looping. CLAUDE.md says transform/opacity ONLY.
- **`will-change` on 11 idle nodes** (not 10) on a menu with **0 running animations** — and the
  gate is blinder than the audit said: `willChange.test.js` validates only the property NAME, so a
  CSS `will-change: transform` parked on an idle node passes too. Six JS-set **and five CSS-set**,
  so "every live one is JS-set" is struck.
- The residual the audit could not attribute IS attributable: `LiveWpm.jsx:23`, a 250ms interval
  writing `textContent` + `visibility` on a permanently-zero, permanently-hidden menu readout.
  4/s x 3s = exactly 12. The audit looked with a JS profiler; the work is in a timer.
- `firecracker.mp3` **1.63 MB, 56% of the 2.70 MB first-visit payload**, fires 23-32ms after the
  splash tap. Re-encode, zero code.
- SW precaches **5.58 MB**; `Mascot.jsx` serves `.webp` and `webp` is missing from `globPatterns`.
  Offline claim SETTLED by testing: `naturalWidth: 0` — but it is the **splash/loading** mascot,
  not the menu (the menu has none).
- **New, and the audit had it backwards:** at 412x915 the menu's idle cost is the HIGHEST measured
  anywhere (245 recalcs, 480-557ms task per 3s, ~1.6x desktop). The audit presented mobile as
  reassurance.
- **Genuinely excellent:** zero layout reads in every keystroke path (0/0/0 under 70-key bursts
  across four modes, all 30 sites enumerated); typing free (idle vs burst ratio **1.00**).

### §4b-ii — accessibility: 4 blockers, all confirmed
- **`LockedPreviewDialog` is not a focus trap** — **37 of 40** Tab presses escape, and the escaped
  elements are genuinely operable: tabbed to SHOP behind the modal, pressed Enter, Shop opened.
  The scrim blocks POINTER but not keyboard. `ModeDialog` traps perfectly (0/40, 0/25 backward) —
  the pattern exists and was not copied. `RankLadder` measured at **31/40**.
- **Four typed inputs have no visible focus indicator.** `.solo-input` focused vs unfocused
  screenshots are **byte-identical (SHA match)**, caret suppressed. Mechanism corrected: it is
  `outline-offset` surviving the `outline: none` shorthand, not width.
- **`.solo-restart` is a state bug, not a contrast bug** — 1.20:1 (not 1.37) for a 400-900ms arm
  window, then 15.62:1. It IS clickable while dim. A disabled-LOOKING, fully-operable button with
  no `disabled`/`aria-disabled`.
- **`.game-card-payout` at 6px** — and the audit undercounted: it missed **FUSE at 1.04:1**, the
  worst text ratio on the menu. Four of six, not three.
- **FALSE CLEAN, on a gameplay control:** `RunMode.jsx:267` gives `.run-input` — THE RUN's primary
  input — no `aria-label`. Its only accessible name is the placeholder, which vanishes on the first
  keystroke. The audit escalated exactly this defect for a stats textarea and missed it here.
- **Clean and re-verified across 28 screens / 125 controls:** zero unlabelled, zero positive
  `tabindex`, every mode auto-focuses its input.
- Cross-check: `.solo-exit` is 40x40 and the SOLE exit from CHAIN/FUSE (Back goes to `about:blank`
  — entering CHAIN pushes no history). Passes WCAG AA 2.5.8, fails **your own 44px rule**.

### §4b-iv — unhandled states
- **F1 CONFIRMED, version-skew only.** A payload-less frame kills the app: `{"type":"error"}`
  collapses `#root` to "SOMETHING BROKE." even on the menu; **14 of 20 handled types crash**.
  `ScreenBoundary` is a CHILD of App so it cannot catch it. But all 8 backend `send` calls and all
  42 broadcast literals carry a payload — **not reachable in normal play**, only during a backend push.
- **F2 CONFIRMED.** No ping/pong anywhere; `server.js:114`'s "liveness ping" is the `/healthz` HTTP
  cron. **16s of silence on an OPEN socket leaves a fully interactive room with no RECONNECTING
  overlay.**
- **F3 CONFIRMED.** `useRunMode.js:149` has no `.catch` — "DEALING THE RUN…" forever. CHAIN and
  FUSE got this fix in Job 16; RUN was missed. First-visit only (the SW precaches chunks).
- **F4 headline STRUCK** — `useRoom.js:53` clears `serverError` before every join, so the claimed
  `Object.is` bailout cannot happen. A different bug survives: a dead-socket lock that **persists
  across a successful reconnect**. The audit's prescribed fix would have fixed nothing.
- **F5 CONFIRMED, reachability raised.** `importSave` returns `{ok:true, imported:23}` having
  written 8 keys, then reloads — "level and money restored, whole collection gone", reading as
  valid data. The portal/iframe build's partitioned storage throws on every write.
- **Clean:** all 24 `JSON.parse` sites try-wrapped AND shape-validated; 84 storage lines guarded;
  zero `sessionStorage`; zero `fetch`/XHR/Workers anywhere; **all three CLAUDE.md traps present and
  unregressed**. The boot-crash-until-you-clear-site-data shape does not exist here.
- One false clean: `RoomScreen.jsx:161-163` COPY INVITE LINK is a silent no-op with a blocked
  clipboard and no `navigator.share`.

### §4c — cross-mode consistency (report only)
- **CB solo never shows what you earned.** It pays through the identical path as multiplayer
  (`isSolo` is only `roomPlayers.length === 1`, still runs `bankWordWins`), but `SoloResultsScreen`
  is never passed `winsEarnedTotal`. The player watches `+N WINS` climb in play and it vanishes.
- **THE RUN violates a rule the codebase writes about itself.** `src/solo/shared.js:19`:
  *"deliberately 'NOT IN OUR WORD LIST', never 'NOT A WORD': it's our list."* `useRunMode.js:247`
  ships `NOT A WORD` — and the defence that RUN uses a real dictionary dies at `:13`, which imports
  the same list.
- The restart button has **five labels**, and `firstRun = runs === 1 || words < 3` **oscillates with
  performance forever** — the same button flips on every bad run.
- **Two false "uniform" claims:** `TRY <MODE>` is NOT on all six — **THE RUN has no `TryModeRow`**,
  the only mode that dead-ends on itself (and HEAD commit `bb59a00`'s own title claims otherwise).
  `ShareBar` is not on all six either — CHAIN and FUSE mount none.
- One struck: CHAIN/FUSE's ✕ is deliberately `z-index: 60` to stay reachable over the overlay.

### §4b-iii — dead code: worth about an hour, CSS only
**135 raw "unused export" hits collapsed to 15 real ones — an 89% false-positive rate.** 91 were
live internal helpers carrying a redundant `export`. The refuter reproduced the 574 orphan CSS
lines **exactly, file for file**, but found **two "orphan" classes that are LIVE** —
**`.is-thin`** (`ChainGame.jsx:245` builds `` is-${outState} ``, `:256` proves `'thin'` — this is
the FEW LEFT state shipped in Phase 3a of this same run) and **`.shake-*`** (`App.jsx:2334`, the
whole-app screen shake). Both cost 0 of the 574, so **the batch delete is safe — but the audit's
advice to "edit the 25 grouped selectors" would delete two live features.**
The 4 orphan modules save **zero bundle bytes** (nothing imports them, so Rollup never bundled them).

### Backend (rails-protected, nothing pushed)
- **The Blitz bot goes silent on 2 of 446 categories on `main`** — `categoryBlitzBot.js:115` reads
  `CATEGORY_ANSWERS[category]` directly instead of via the case-insensitive `answersFor()`, and
  `roomManager.js:566` bare-returns on null. **`fix/blitz-data` already fixes it** (442 categories,
  0 dup slots, 0 blanks) as a side effect of de-duplicating CATEGORIES.
- **`ADMIN.md:78` is wrong and would misdirect a debugger:** it says Category Blitz "fails closed";
  the code fails OPEN on every path, and with no API key the miss is ACCEPTED.

---

## §1-3 DETAIL and §2 CORPUS — see below

### Phase 2 — the Blitz corpus, COMPLETE (31/31, 28,913 answers)
**114 proposed drops -> 45 AGREED removals (39% survived).** Seed file at backend
`fix/blitz-data` (`blitz-removal-seed.json`, `c832299`), never pushed. Nothing deleted.

| tier | categories | answers | proposed | AGREED | rate |
|---|---|---|---|---|---|
| 1 | 74 | 6,476 | 55 | **5** | 0.077% |
| 2 | 238 | 14,895 | 35 | **23** | 0.154% |
| 3 | 130 | 7,463 | 24 | **17** | 0.228% |
| **all** | **442** | **28,834** | **114** | **45** | **0.156%** |

**The "20 worst categories" is only 13** — that is the finding. 429 of 442 are entirely clean.
Minecraft mobs (15), SpongeBob characters (11) and Disney villains (7) are 33 of the 45.

**Tier 1 drew half the proposals and yielded 5** — a 9% survival rate against 66% and 71%. The
categories a stranger meets first are the cleanest in the corpus.

**Answer to "is the Blitz corpus full of junk": no. 0.156%, concentrated in three fandom lists.**

The refutation pass rejected 69 of 114 proposals, and not on close calls: the 38-entry "Shoe brands"
claim collapsed because the same list must keep `coach`/`champion`/`on`; `monster` died on
Karloff's actual screen credit in *Frankenstein* (1931); a "copy-paste bleed" case evaporated
against the authoring source.

**Corpus caveat:** I could not find `llmSweep.js` on the first pass and hand-rolled an emitter. It
is on backend `fix/blitz-data`; I had searched only the backend WORKING TREE while searching the
frontend's full history. My partition (761 lines / 446 categories) covers the same answers as
llmSweep's (650 / 442) but counts case-variants separately — and lacked the `tier` field, which is
why the per-tier table above is generated from the real emitter.

**A defect class the brief did not scope, mostly refuted:** "missing canonical answers" is NOT a
defect — mean list size is 65.2 and the module header says these are samples. What survives is
narrow: **5 confirmed typo-without-its-correct-form instances** across 442 categories
(`pensylvania`, `catchin fire`, `netflix and chilll`, `louis anderson`, plus `graphics processer`
which stage-1.5 compound-head leniency rescues). The harm is not rejection — a miss never rejects —
it is that `buildSampleAnswers()` shows the typo to the whole room (`pensylvania` in ~49.6% of that
category's round-ends) and the bot plays it. Tier-3 content fix.

### Phase 5 — block-state
`typeaword-block-state.md` refreshed on **`docs/block-state-4`** (`a902149`, pushed), reconciled
with the existing `docs/block-state-3` rather than duplicated. Three claims were stale: CHAIN
unlock 15->**20**, FUSE 22->**25**, unit 262->**464**, e2e 133 in 30 files -> **1090 in 48**. The
e2e count was off by 957. §§3-8 and §§11-12 were NOT re-verified and are now labelled as such.

---

## TEST-ENVIRONMENT NOTE
Several "failures" this run were CPU starvation, not regressions — 30s `locator.waitFor` timeouts
and one "animations at rest" assertion, all green when re-run alone. Cause: audit agents running
alongside Playwright workers on 2 vCPU. **On this box, gate runs and agent fan-out must not
overlap.** Every failure reported above was re-verified in isolation before being called real, and
every one called a flake was re-verified green.
