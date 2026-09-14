# OVERNIGHT RUN — 2026-09-12 → 09-14

Rails held throughout: **no merge to main, no push to main, no deploy, no backend.** Branches and
reports only. Taste calls are built both ways, screenshotted, and stopped for you.

This file is the LANDING PAD. Everything below is numbered so you can reply "do 3 and 7" and
nothing is ambiguous. The batch-by-batch narrative is at the bottom (§E) if you want the reasoning;
the top four sections are what you actually have to act on.

---

## A. WHAT SHIPPED (pushed, gated, not merged)

| # | Branch | What it is | Gate | Merged? |
|---|---|---|---|---|
| A1 | `feat/rarity-moment` | The main line. Carries `integration/board-v2` + everything I did directly. Sixteen commits this run. | see below | **no** |
| A2 | `feat/fuse-craft` @ `8bb62d6` | FUSE gets CHAIN-level craft in its own colour script — fragment slab, burning cord, matched fragment picked out inside the accepted word. | `fuse-craft` 4/4, 3 runs | **no** |
| A3 | `feat/blitz-craft` @ `aa55c5c` | CATEGORY BLITZ craft — category as a 64–80px hero, judge as one PNG with a single verdict swap, chunky stepping timer block, answers building upward newest-brightest. | 24 tests x 2 repeats | **no** |
| A5 | `chore/refute-run-n` @ `733fa60` | The refutation pass's own report + one strengthened test. Read `claude/refutation-run-n.md` on that branch if you want the full attack log. | — | **no** |
| A4 | `feat/sat-craft` @ `3c71f39` | SAT RUSH — full duotone, hard black gutters, one-frame letter stamp, and **the scroll-fix answer you asked for** (§B0). | `sat-craft` 28/28 | **no** |

### What's on `feat/rarity-moment`, in order

1. **The bomb got a clock you can actually read.** (§E0)
2. **`PW_PORT`** — two checkouts can gate at once without serving each other's build.
3. **The welcome-back card off the wordmark**, and the XP track un-collapsed at 390.
4. **The level curve now knows about rebirth**, the formatter reaches the three most-seen numbers
   in the game, and two dead economy sims were repaired.
5. **Two frames the board mishandled** — a duplicated accept, and a `game_over` for a game you
   already left.
6. **The motion contract** — the suite is not running the reduced motion it claims to.
7. **The sound control off three solo screens**, and a coach mark that fits.
8. **Three dead components removed** (296 lines nothing mounts).
9. **SHOP and STATS were near-black on near-black** — 1.19:1 — plus a 44px touch target on
   the solo close glyph, and an accessibility gate that says what it does *not* assert.
10. **The solo load state had no sound control at all**, and the coach mark's resize handler
    was unthrottled at 1.5 DOM walks an event.
11. **The coach mark was resolving `position:fixed` against the transformed game stage** —
    its ring landed 627px below the bottom of a phone screen in the panic band (§B0b).
12. **What the refutation pass broke** — a legacy save being eaten, and three guards too
    narrow (§F).

Every gate in this run was **checked RED on the defect it describes before being trusted.** Where
I could not make one go red, I say so.

---

## B0. THE SAT RUSH SCROLL QUESTION — answered

> *"verify the scroll fix ON THE GAME, not the /sat-rush marketing page; my probe hit the
> landing page so the fix is still unverified."*

**The fix was never on this branch.** `724a006 fix(sat): the prompt fits, it never scrolls`
lives only on the unmerged `fix/sat-rush-ui`. And your probe would have come back clean on
*any* route, landing page or game: `.sr-app` is `position: fixed; overflow: hidden`, so the
**document** never scrolls. The scrollbar was on the poster's own field region, `.sr-fields`,
which is `overflow-y: auto`. A document-level scroll check cannot see it — which is why the
question stayed open.

Measured on the live run (route in every gate title so it cannot be ambiguous again:
`/?satRush=1&portal=1&satworst=1&stage=12000&spell=9000` → menu card → Play → run):

| route | viewport | scrollHeight | clientHeight | hidden |
|---|---|---|---|---|
| LINEUP play | 1280x720 | 202 | 90 | 112px |
| LINEUP play | 320x640 | 296 | **20** | **276px — the sentence was not on the page** |
| BRIEFING play | 320x640 | 265 | 144 | 121px |
| deep cut | 390x844 | 396 | 324 | 72px |

Fixed on `feat/sat-craft` by fitting the WHOLE CARD rather than the prompt — prompt-only hit
its 0.52 floor at 1280x720 LINEUP and the card was still 41px too tall. 0px hidden at all
four viewports in both run styles.

**Still scrolls, could not fix: the RESULTS page below 1000px** (390x844: 1169 in 844;
320x640: 1142 in 640). Desktop is two columns and fits exactly. On a phone there is no
second column and the only way to fit is to delete content — that is a content decision, so
it is an explicit, commented exemption in the gate. The PLAY screen has no exemption.

---

## B0b. THE COACH MARK WAS IN THE WRONG COORDINATE SYSTEM

Worth its own note because nothing would ever have found it by reading the code. `position:
fixed` resolves against the nearest ancestor with a transform — not the viewport. The Word
Bomb coach mark renders inside `.game-stage--wb`, which is transformed the moment the panic
band starts, so every fixed coordinate in that component was being read in the STAGE's space.
Measured at three seconds:

| viewport | the ring, relative to the field it rings |
|---|---|
| 1280x720 | 70px right, 16px down |
| 390x844 | **y = 1471 in an 844-tall viewport — 627px below the screen** |

On a phone, in the panic band, the coach mark teaching a first-time player to type was not on
the page — and the player it exists for is exactly the one who sits still long enough to get
there. Portalled to `<body>`. I built a frame-accurate tracker first, on the assumption the
ring had gone stale; the numbers moved and the ring stayed put, because the coordinates were
never wrong — the coordinate SYSTEM was. The gate now asserts the overlay has NO transformed
ancestor, which is the assertion that would have caught it on day one.

---

## B. WHAT NEEDS YOUR PLAY-TEST (blocking — nothing merges until these pass)

| # | What | Why it needs a device, not a diff |
|---|---|---|
| **B1** | **Word Bomb, 2 devices, full REGRESSION CHECKLIST.** | Two TIER-1 changes to `App.jsx`'s WebSocket handlers are in this branch (#5 above). Both are guarded, both have gates that were seen red — and CLAUDE.md's own note says the key-collision freeze passed every code check and still froze. |
| **B2** | **Specifically: leave a game mid-turn, then let it end.** | The late-`game_over` guard is a functional `setView`. If I got the guard's narrowness wrong you would see a game-over screen appear on the menu, or fail to appear when it should. |
| **B3** | **Specifically: play a full Word Bomb turn and watch the clock.** | The seconds numeral is now present for the whole turn, not just the last five. It is quiet above 10s and red under 6. Does the quiet state read on a real phone in real light, or is it noise? |
| **B5** | **Load the game with an OLD save, if you have one.** | The legacy-cumulative migration was re-pricing pre-rebirth totals and writing the result back — a one-way write (§F1). Fixed and unit-pinned at R0/R5/R10, but the only real legacy saves are on your devices. |
| **B4** | **CHAIN and FUSE on a phone.** | The sound control moved into the exit cluster and stacks under 430px. 44px hit area is asserted; how it *feels* is not. |

---

## C. WHAT NEEDS YOUR TASTE (built, screenshotted, stopped — I did not pick)

| # | Call | Shots | My read |
|---|---|---|---|
| **C1** | **The top rung's colour.** A spends the reserved beat-flash `#FF2EC4` on OBSCURE; B spends nothing the beat needs (cream plate, RARE orange). | `claude/rarity-shots/wb-obscure-a.png`, `wb-obscure-b.png` | A is louder. B is legible, distinct and costs the beat nothing. If the beat flash matters more than the top rung's volume, take B. |
| **C2** | **The pre-submit rarity hint** (`?rarityhint=1`, off by default). Names the band of the word in the field while you type. | `claude/rarity-shots/wb-hint-off.png`, `wb-hint-on.png` | It belongs in a practice mode, not a timed one — it turns vocabulary into a slot machine you can pull. But that is a call about what the game is for. |
| **C3** | **How loud the quiet clock should be.** The numeral sits at 30 viewBox units / 0.85 opacity above 10s. | `claude/wb-clock-shots/*-quiet.png` (12 frames) | I tuned it to "readable but not competing with the fragment". It may still be too quiet at 1366. |
| **C4** | **`NEED_REBIRTH_BASE = 2`.** How much of the rebirth multiplier a player keeps as real speed. | table in §E4 | 2 gives every rebirth +50% climb rate, compounding, and turns LV50→LV200 at R10 from **24 minutes** into 33 hours. 1 is today's defect; 3 cancels rebirth entirely. |
| **C5** | **Mark slots.** 2 and 3 both stay inside the 2.00× invariant and actually NARROW the spread. | §E4 | The invariant is not what constrains this. Rule 1 in `marks.js` is — and at ONE slot that rule is not doing what it claims (see D4). |
| **C6** | **FUSE: hearts → three cord glyphs**, and the three big deck cords deleted (they duplicated the hearts). | `claude/fuse-craft-shots/` | The FUSE agent made this call rather than deferring it. Say the word and it restores. |

---

## D. WHAT I FOUND AND COULD NOT FIX

| # | Finding | Evidence |
|---|---|---|
| **D1** | **SAT RUSH's results page still scrolls below 1000px** — 1169px of content in 844, 1142 in 640. Desktop fits exactly (two columns). A phone has no second column and the only way to fit is to delete content, which is your call. Explicit commented exemption in the gate; the play screen has none. | §B0 |
| **D1b** | **A data defect in `words.json`**: one sentence renders as *"...weighing whether to tell her at all. (also alts: add thoughtful)"* — an authoring note leaking into the player-facing prompt. | `claude/sat-craft-shots/390x844-lineup-real.png` |
| **D1c** | **DESIGN.md's decoration budget conflicts with its own screentone system.** Getting SAT to ONE halftone meant removing the ink board's dot grid and the card's second tone bloom — and that also removed the reason the page's hard offset shadow was visible against the void. Putting the toned board back is one halftone over budget. | SAT agent |
| **D2** | **THE RUN's craft pass was still running when this was written**, on `feat/run-craft` cut from `integration/run-stack` — the only branch `src/runMode/` exists on. If that branch is not on origin when you read this, it did not finish, and the cheap way to finish it is exactly what CHAIN and FUSE got, since THE RUN uses the same solo shell. | `git ls-remote origin feat/run-craft` |
| **D3** | **No judge art exists.** `/public` has `mascot-{idle,panic,celebrate,run,taunt}`. Blitz's "judge" is the bomb mascot swapping expression. A real judge — wig, gavel, bench — has to be drawn. The agent did not fake one in CSS, which is right. | Blitz agent report |
| **D4** | **At one mark slot, ETERNAL dominates seven of the eight marks.** Every mode wears it; BOMBER, SPRINTER, SAVANT, LINGUIST, METRONOME, STUDENT and MAGPIE are never chosen by anyone who has it. `marks.js` rule 1 says "eight marks and one slot is eight different builds" — measured, it is one build in every mode. Reported, not shipped: this is a design decision. | `claude/marks-slots-sim.mjs` |
| **D5** | **The sim's own pass condition no longer holds.** "LV300 inside 200h" fails at any rebirth scaling above ~1.15 — and it barely held before (2 of 5 archetypes, at 156h). Either the condition or the top of the curve needs your decision. | `claude/econ-curve-sim.mjs` |
| **D6** | **Blitz's 64–80px hero holds at ≥1280 only.** 80px at 1366 and 1280; 30.8px at 390 and 22.6px at 320 with a deliberately long 44-char category. At 320 the slot is 191px and "SANDWICHES" at 64px is ~490px wide — 64px cannot coexist with "fits at 320 and does not scroll". It is still the biggest type on that screen by 2.5×. | Blitz agent, measured |
| **D7** | **Cross-mode copy diverges** in five places where two modes say the same thing differently. Report only, as asked — see §E7 for the table. | grep + read |
| **D8** | **The e2e suite's reduced-motion emulation is inert.** `use.reducedMotion: 'reduce'` does not flip `matchMedia` in this project (Playwright 1.62). The suite runs at FULL motion, which is the stricter side — but any assertion relying on the config for a reduced-motion state is vacuous while reading as though it tests the accessible path. Pinned rather than papered over. | `e2e/motion-contract.spec.js` |
| **D9** | **SAT Rush still has the orphan sound control.** CHAIN and FUSE moved into the solo shell's corner cluster; SAT was left deliberately because its screen is being reworked on another branch. Named in `App.jsx` beside the suppression list so it is not rediscovered as a surprise. | measured: `.audio-ctrl` is the fixed variant on `/sat-rush` at both phone sizes |
| **D10** | **Several 320x640 clipping defects on the solo screens, pre-existing and not mine.** "3 WORDS TO EA[RN]" clipped in its pill; `START WITH "W" · 3+ LETTI` clipped in the field; CHAIN's arm hint clipped at both ends. | `claude/solo-audio-shots/chain-320x640.png` |
| **D12** | **`claude/rarity-shots/sat-obscure.png` is stale** — it shows the pre-craft SAT look. Left alone on purpose: it belongs to commit `36f421f` and re-shooting it would misrepresent what that commit did. | — |
| **D14** | **The XP track is 4px at 768 and 18px at 390 for any account with a STREAK.** Improved from "4px everywhere" but not solved; a min-width makes the bar overflow instead of wrap. Needs a decision about which chips belong on a phone. | §F6 |
| **D15** | **`README.md:25,52,60` points contributors at `GameIcons.jsx`**, which this run deleted as dead. One-line fix, left alone because the README is outside anything else I touched. | refutation pass |
| **D13** | **Blitz's judge is the bomb mascot.** There is no judge art (see D3), so the "single verdict expression swap" is idle -> celebrate/panic on the existing PNG. It reads, but it is a bomb sitting in judgement. | `/public` |
| **D11** | **A parallel-work hazard, for next time.** The agents' PostToolUse build hook runs `vite build` against the MAIN working tree, not the agent's worktree — so my in-progress edit blocked their tool calls with an error naming *their* file. Worth fixing in the hook before the next multi-agent run. | three notifications naming `agent-*/src/solo/FuseGame.jsx` while the error was in my `src/App.jsx` |

---

## E. THE WORK, WITH THE REASONING

### E0. FIRST — the board-v2 timer question you asked

> *"I can find no timer/seconds element on the board and no seconds render in a real bot game at
> 1280x720. Confirm whether the numeric seconds and the sub-6s red escalation still exist after
> the merge."*

**The merge did not drop them. Both existed; neither was reachable.** Two separate causes:

1. **The numeral was gated to the last 5 seconds.** `feat/wb-ring` added
   `showSeconds = timerSeconds <= 5` deliberately, arguing the fuse already carries the
   proportion. It does — but a proportion is not a clock. On a 30s turn there was no number on
   the board for 25 of its 30 seconds, and a bot answers in 2.3–4.3s, so in your probe the turn
   clock never got near five. Before the ring rebuild the numeral was present for the whole turn.

2. **The red escalation was keyed to the RATIO, in a band the 5s gate meant it was never rendered
   in.** `numFill` painted red only at `tension === 'warning'`, i.e. between 60% and 30% of the
   turn. To see a red numeral you needed `timerSeconds <= 5` AND `5/maxTimer >= 0.3`, so the red
   branch was **unreachable at any turn length above ~16s**. At the default 30s the number was
   white for its entire visible life.

Measured before the fix, pushing scripted ticks down a 30s turn at 1280x720:

```
t=28 present=false   t=15 present=false   t=9 present=false
t=6  present=false   t=5  present=true fill=#fff   t=3 present=true fill=#fff
```

**Restored, and re-keyed to seconds rather than ratio**, so 5s is red whether the turn was 60s or
12s: present the whole turn, quiet above 10s (30 units, 0.85 opacity), 40 units at 6–10s, and
52 units in `#FF4B4B` with a per-second one-shot pulse under 6.

**Sizes are VIEWBOX units, not CSS pixels** — and that is why the first attempt did not read. The
SVG is a 160-wide viewBox drawn at ~104px, so the original `fontSize 34` lands at about 22 CSS px
on a dark mascot belly. The source looked like a headline; the screen showed a smudge. Multiply by
~1.55 to get the size the source implies.

**Gate:** `e2e/wb-clock.spec.js` — 4 viewports × 2/4/8 players × {present, strictly decreasing
across 5 scripted samples, inside the bomb, on screen, white above 6s and red below, nothing drawn
over the fragment slab, the panic-band loop set}. Plus the same two seconds on a 60s and a 12s
turn, which is the ratio bug stated as a test. 36 shots in `claude/wb-clock-shots/`.

**Three more things fell out of looking at those shots:**

- **"GET OUT!" was drawn straight through the fragment slab.** `.wb-tension-prompt` was
  `position:absolute; top: min(16vh,120px)` in stage coordinates; on the ring board that is the
  slab's box (y=123..222 at 1280x720). Exactly the Batch 1 hype-banner defect class, in a
  different element, and there is no free band above the slab to move it to — so it is anchored
  to what it is about: the slab's own caption escalates in place, TYPE A WORD CONTAINING →
  HURRY! → GET OUT!.
- **Four "still the board" selectors matched nothing.** `.game-stage--wb .wb-tension-line` and
  three neighbours were scoped to the wrong ancestor — the tension layer is a child of
  `.game-wrap--wb`, a SIBLING branch — so every loop that list was written to kill kept running.
  Measured across a scripted 30s turn: 0 loops above 50% of the clock, 4 at 50%, 5 at 40%, 7 in
  the panic band. Re-scoping kills five. Speed lines are REMOVED rather than stilled, because a
  stilled speed line is a 5px static bar stubbing out of the corner (boxes at y=-216).
- **The two remaining loops are fine**, and I said otherwise before checking: `stage-heartbeat`
  and `sweat-fly` ARE properly reduced-motion gated. Under an explicit emulation the panic band
  runs zero loops. They appear in the measurement because the suite runs at full motion — which
  is D8.

### E4. The economy, with the numbers you asked for

**`need()` ignored rebirth.** Income scales `3^rc` (R10 = ×59,049); the curve scaled by nothing.
`log(59049)/log(1.115) ≈ 101` levels — R10 paid for the first hundred outright. Measured on
200-hour **fixed-rebirth** climbs (no cascade, so "time to LV200 at R10" means what it says),
before and after, `claude/econ-rebirth-sim.mjs`:

| base | R0 LV50/100/200 | R3 | R10 | LV50→200 @R10 |
|---|---|---|---|---|
| **1 (today)** | 0.9h / 27.5h / never | 0.0h / 1.1h / never | 0.0h / 0.0h / 0.4h | **0.4h** |
| **2 (shipped on the branch)** | 0.9h / 27.5h / never | 0.2h / 3.8h / never | 0.0h / 0.0h / 33.0h | 33.0h |
| 2.4 | 0.9h / 27.5h / never | 0.2h / 5.5h / never | 0.0h / 0.1h / 94.9h | 94.9h |
| 3 (cancels rebirth) | 0.9h / 27.5h / never | 0.4h / 7.6h / never | 0.0h / 0.3h / never | never |

A hundred and fifty levels in twenty-four minutes. See **C4** and **D5** for the two calls.

**The formatter was skipped by the three most-seen numbers in the game.** No raw
`toLocaleString` anywhere — the failures were plain JSX interpolations: the live "+N WINS" pill
(on screen for every word of every run, in every mode), the game-over WINS EARNED total, and the
menu-return stamp. At R10 a run pays ~1e10, so that card read `+16384927364710 WINS`. Also the
per-word payouts on GameCard / ModeExample / SAT Rush, and the receipt's rebirth row (`×59049`).
The gate scans the **rendered DOM** rather than the source, because `formatNum` can never emit
five consecutive digits — so a run of five in visible text is by construction a number that
skipped it.

**Marks, 2 and 3 slots** (`claude/marks-slots-sim.mjs`): 1.90× bare, 1.90× at one slot, **1.56× at
two, 1.49× at three** — slots NARROW the spread, because the mode-specific marks exist only for
the weaker modes. Caveat stated in the file: the sim measures WINS, so it can never value STUDENT
(XP-only). LINGUIST being dead is a real finding; STUDENT's is not. See **D4**.

### E7. Cross-mode copy — reported only, as asked

| Thing | Word Bomb / Blitz | CHAIN / FUSE | SAT Rush |
|---|---|---|---|
| too short | `TOO SHORT — NEED 3+ LETTERS` | `MIN 3 LETTERS` | — |
| already used | `ALREADY USED — TRY AGAIN` | `ALREADY USED THIS RUN` | — |
| not a word | `NOT IN OUR WORD LIST` | `NOT IN OUR WORD LIST` ✓ | — |
| must contain | `MUST CONTAIN [combo]` | `MUST CONTAIN <fragment>` ✓ | — |
| reject fallback | `INVALID WORD` / `INVALID ANSWER` | `REJECTED` | — |
| leave the mode | `LEAVE` | icon, `aria-label="Exit"` | `EXIT` |
| go again | `PLAY AGAIN` / `REMATCH` | `PLAY AGAIN` then `RESTART` | `Run it back` |
| case | CAPS | CAPS | **sentence case** |

Two of the four reject reasons agree and two do not. `RUN IT BACK` exists in caps in Word Bomb and
in sentence case in SAT Rush. Per-mode END headings (`CHAIN BROKE`, `OUT OF FUSES`, `CASE CLOSED`)
are deliberate flavour and are NOT on this list.

### E8. What the screenshots caught that the gates did not

Every serious defect this run was green on numbers first. Collected, because the pattern is the
point:

1. **The seconds numeral was a smudge** at the size the source implied — viewBox units, not px.
2. **GET OUT! through the fragment slab** — a transient in stage coordinates over the one box the
   player must read.
3. **The WELCOME BACK card covering the wordmark** — 309x88, so TYPE A WORD read "TYP…RD" on a
   returning player's first screen. Every layout gate was green; nothing measured a fixed
   element against the logo.
4. **The XP track at 4px on a 390px phone** — found only because the welcome-back chip made it
   worse and I went to measure the baseline. Non-monotonic (worse than 320) is the signature of a
   breakpoint in the wrong place: the rank chip dropped at 380px, tuned against a test that runs
   at 360.
5. **The coach mark hanging off both edges of a phone**, and drawn through text in three places.
6. **The corner cluster covering the score multiplier at 320** — my own regression, one commit old,
   with a green gate that only checked the control against EXIT.
7. **Blitz's judge rendering at 39px on a phone** — `Mascot.css` shrinks every mascot 0.7× below
   600px *on top of* the size var (Blitz agent).
8. **`NAME AS MANY AS YOU CAN` ellipsised to a single letter `N` at 320px** (Blitz agent).
9. **FUSE's "mid-cord" frames were of a cord at 10%** — the survey walked the tree twice and cost
   ~2s, and the shot was taken after it. Every gate passed; the picture was of a different moment
   (FUSE agent).

### E9. My own mistakes this run, recorded

- I claimed the two panic-band loops were an accessibility hole and flagged them for you. They are
  not — both are properly gated. Corrected in the gate file rather than left to mislead.
- The first cut of the wb-adversarial gate read an ACHIEVEMENT grant (+100 wins on returning to
  the menu) as a double-pay. It waits for the menu to settle now, and the till is provably
  untouched by the late frame.
- Two more of my own test bugs, both now commented: a run banks nothing until 3 words, so
  duplicating word one measures the gate rather than the attack; and a second page in the same
  context shares localStorage, so "the same run twice" read the second till on top of the first
  (5,320 against 2,610) and called it non-determinism.
- A flat `waitForTimeout(4800)` for the 3-2-1-GO! overlay passed 13/13 alone and went red under
  load. My first replacement was worse — a lone `waitFor({state:'detached'})` resolves INSTANTLY
  when the element has not mounted yet, so it failed on every run instead of occasionally.
- The marks sim's first cut fed SAT Rush the recall list instead of its own deck and reported a
  fake 3.67× spread. Any mode-spread claim is only as good as its word source.

---

## F. THE REFUTATION PASS — four of ten claims broke

A second agent was handed this run's commits and told to knock them down with a file, a line
and a failing case. It is the most useful thing that happened all night, so it gets its own
section. **All four are fixed on `feat/rarity-moment`; each fix was checked red first.**

**F1 — THE LEGACY MIGRATION WAS EATING SAVES.** The worst thing found in the whole run, and
it was mine. `readLevelState` walks a legacy cumulative XP total through `levelFromXp` and
**writes the result back** — once, permanently. That total was earned under a curve with no
rebirth term; the number predates it. Walking it against `baseNeed(n) x 2^rc` re-prices a
history the player already paid for. Measured: a legacy LV50 total with `taw.rebirths = 5`
migrated to **level 19** and committed; at R10, **level 2**. Fixed (rc = 0 is the only
correct reading of a pre-rebirth number) and pinned at R0/R5/R10 — including the value
actually written to storage, because that write is one-way.

**F2 — "EVERY CALLER PASSES THE REBIRTH COUNT" WAS FALSE. None of seven did.** My commit
message said it. The level-carry loops take it; the callers were all on the
`= getRebirths()` default, which is a localStorage read — measured **two `taw.rebirths`
reads per keystroke** on the menu and three per accepted word. Fixed.

**F3 — `canRebirth` took the count and ignored it**, deriving the level from the unscaled
curve and comparing it to a threshold for the scaled one. It said yes too early. Fixed.

**F4 — THE LATE-`game_over` GUARD WAS TOO NARROW, twice over.** It refused only `home`, but
`stats`, `credits`, `shop`, `browse` and the three solo views are all real places a player
can be, and from any of them the late frame still yanked them to the game — onto the
"STARTING GAME..." placeholder, because the room state had already been torn down. And it
guarded the VIEW only, so the frame still fired a full RESULTS wipe over the menu and played
the game-over sting at someone who had left. Both fixed.

**F5 — A TEST OF MINE WAS VACUOUS**, and it was the one a reader would trust: it asserted
`need(n, rc) === round10(baseNeed(n) * NEED_REBIRTH_BASE**rc)` — the implementation restated
using the constant under test, so it **still passed with the constant set back to 1**.
Replaced with the refutation branch's literal-pinned version.

**F6 — THE XP TRACK IS STILL 4px FOR ANY ACCOUNT WITH A STREAK**, and that is the case my
width ladder missed entirely, because I measured it on an account with none. The streak chip
is **191px** — wider than anything else in the strip. It now sheds its freeze tokens and the
word DAYS at 1024 and its multiplier at 700, which takes it to 61px and the track from
"4px everywhere" to:

    1366:52  1280:52  1100:52  900:124  768:4  600:52  480:61  430:58  390:18  360:32  320:4

Better, and not good. A `min-width` on the track holds it at 110 but makes the bar OVERFLOW
instead of wrap — the track then leaves the viewport from 280 to 600, which is worse than
thin. **This one needs you:** it is a decision about which chips belong on a phone at all,
not a layout bug. Both the measurement and the failed attempt are written into MenuXp.css.

### What SURVIVED the attack, and what it tried

- **The numeral** — 5s and 300s turns, 16 players, mid-explosion, and `timerSeconds` of
  0 / null / -1 / 7.5 / 0.4. Two holes are real but unreachable: `roomManager.js:367-395`
  only ever emits integers >= 1.
- **The re-scoped stillers** — 0 loops at calm/half/warn, exactly `[stage-heartbeat,
  sweat-fly]` at crit, at 2 and 8 players; 0 under reduced motion both from first paint and
  toggled mid-game; Blitz shares `.game-wrap--wb` and has no separate layer.
- **The duplicate-accept guard** — Blitz uses a different message (`answer_result`),
  `usedWords` is game-scoped, PLAY AGAIN re-fires `game_started`, joining a live game is
  refused. Two latent holes, both unreachable from the server: an EMPTY `word` bypasses the
  guard, and a resync with no `game_started` suppresses a legitimate accept.
- **The contrast fix** — 16.71:1 under all five themes (the tokens live on `:root`; no
  `data-theme` selector exists in `src/`). Zero unnamed controls across 17 screens.
- **The dead code** — three for three, both builds and lint clean. (`README.md:25,52,60`
  still points contributors at the deleted `GameIcons.jsx` — worth a one-line fix.)

### The red-checks it re-ran on my behalf

All three genuinely red, to the digit: the idempotency guard reverted gives
`Expected 0, Received 500` — the figure I had claimed; the `setView` guard reverted fails
`wb-adversarial:196`; the `--v-ink` fix reverted gives `STATS 1.19:1`.

---
