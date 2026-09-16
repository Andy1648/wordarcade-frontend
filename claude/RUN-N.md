# OVERNIGHT RUN — 2026-09-15 · batches 5–8

Rails held throughout: **no merge to main, no push to main, no deploy, no backend.** Branches and
reports only. Taste calls are built both ways, screenshotted, and stopped for you. Max two agents
at a time, deep-and-few, every finding refuted before it was reported, and every batch ended by
screenshotting each variant at five viewports and **reading the images** before pushing.

This file is the LANDING PAD. Everything is numbered so you can reply "do 3 and 7" and nothing is
ambiguous. §A is the branch table, §B needs your device, §C needs your taste, §D is what I could
not fix, §E is the reasoning.

---

## A. WHAT SHIPPED (pushed, gated, not merged)

| # | Branch | @ | What it is |
|---|---|---|---|
| A1 | `feat/sat-craft` | `d0b72bf` | **The SAT panel item you asked for first.** Both treatments, flag-gated, neither default. §C1 |
| A2 | `fix/overlay-inplace` | `6124446` | Batch 5A — informational overlays become in-place reactions. §E5a |
| A3 | `fix/modal-contract` | `9367844` | Batch 5B — the modal contract + the click-through gate. §E5b |
| A4 | `econ/followthrough` | `ab0295f` | Batch 6 economy + two perf-gate fixes + the words.json note. §E6 |
| A5 | `feat/mark-slots` | `281202e` | Batch 6's 2-/3-slot marks variant. **Built on A3** — merge that first. §C2 |
| A6 | `chore/adversarial-board-v2` | `952d785` | Batch 7 — the timing/economy attack. **Contains a real exploit fix.** §E7a |
| A7 | `chore/hygiene-sweep` | *pending* | Batch 7 — perf / a11y / dead code. §E7b |

Every remote SHA above was verified with `git ls-remote` against the local HEAD.

---

## B. WHAT NEEDS YOUR PLAY-TEST (blocking — nothing merges until these pass)

| # | What | Why a device and not a diff |
|---|---|---|
| **B1** | **Word Bomb, 2 devices, the full REGRESSION CHECKLIST**, before `chore/adversarial-board-v2` merges anywhere. | It changes `App.jsx` on a payout path. TIER 1. |
| **B2** | **Specifically: mistype a 2-letter word mid-combo.** | The headline fix (§E7a-A). Confirm the combo readout breaks exactly as it does on a server `NOT IN OUR WORD LIST`, that the buzz/shake/toast is unchanged, and that nothing double-fires. |
| **B3** | **Glance at what the reject SHATTERS.** | It was shattering the wrong word (§E7a-B). One look tells you it now spells the word you actually typed. |
| **B4** | **Word Bomb in phone LANDSCAPE with 3+ players.** | `slice(-0)` laid out all 24 used-words chips in a 0px row at every landscape size measured. Clipped, so the symptom was modest — but the render was wrong by 24 nodes. |
| **B5** | **The 3-2-1 countdown, on a phone.** | The scrim over the board is gone and the numeral is a card that lands on the bomb. It reads well in the shots; whether it still feels like a countdown is yours. |

---

## C. WHAT NEEDS YOUR TASTE (built both ways, screenshotted, stopped — I did not pick)

### C1. The SAT mode-select panel — **my read: A**

Measured first, and the report was right: `.sr-modeselect` is 528×387 in 1366×768 — **19.5% of the
screen**, and it gets *worse* as the display grows (15.7% at 1536), because a fixed 520px panel
sits in a field that keeps expanding. That signature — a fixed width in a growing void — is the
whole defect.

| variant | what it does | at 1366×768 |
|---|---|---|
| `?satfield=a` | **The panel grows.** Every dimension goes viewport-relative; type steps up the shared `--fs-*` scale. | 40.3% of screen; 65–72% of the shorter dimension across sizes |
| `?satfield=b` | **The field becomes a surface.** The void turns to a screentoned desk; the panel keeps its size and becomes the only clean paper. | panel unchanged at 19.5% |

Shots: `claude/sat-field/`. **A**, because B leaves the original complaint intact (the panel is
still 19.5% of the screen), its dot grid reads as flat wallpaper rather than a desk, and it spends
a second halftone — which is exactly the budget conflict D1c already flags. A holds at 390×844
(368×502, fits). The same survey found `cover` has the defect milder (27.5% → 22.1%), `play` is
healthy (61.2%), and `briefing` has the opposite problem — 1240px of content in 768.

### C2. Mark slots — 2 or 3, or stay at 1

`?markslots=2` / `?markslots=3`, neither default. Shots at five viewports in `claude/mark-slots/`.
The case for moving is D4: at one slot ETERNAL dominates seven of the eight marks, so rule 1's
"eight marks and one slot is eight different builds" is, measured, one build in every mode.

**What a slot is worth**, and the interesting part is that it is a *negative*:

```
mode        2 slots vs 1        3 slots vs 1
            R0       R10        R0       R10
wordBomb    25.0%    25.0%     43.8%    43.7%
satRush     40.0%    40.0%     61.1%    61.0%
chain       15.0%    15.0%     26.9%    26.9%
```

Max R0-vs-R10 gap **0.09pp** — Monte-Carlo noise. **Slots and rebirth do not interact at all.** A
second slot is +15…40% for everyone at every rebirth count; at R10 that is +15…40% of a ×59,049
number. Slots also *narrow* the mode spread (1.90× → 1.56× → 1.49×), because the mode-specific
marks exist only for the weaker modes — so the 2.00× invariant is not what constrains slot count.
Rule 1 is, and rule 1 is the thing not currently working.

### C3. **LV300, and the two invariants it cannot coexist with** — this is the real decision

The sim's pass condition is "LV300 reached inside 200h by at least one archetype, and not before
hour 20". It currently fails **0 of 5** — nobody gets there, deepest levels 224 / 229 / 242 / 236 /
243. I tried to refute that two ways and failed both:

- **The cap is not the cause.** The sim defaults to R10; the *game* has no cap (`REBIRTH_TABLE`
  runs to R20 @ LV600 and `rebirthThreshold` extends +50 forever). Re-run uncapped: still never,
  and Word Bomb does not even reach R11's LV225 gate.
- **Both available knobs break something else.** `TOP_CURVE_EXP` must exceed `EARLY` (1.115) — the
  whole v7 refit exists because v6's tail flattened. 1.115 is the most generous *legal* value and
  **still fails**. 1.10 reaches LV300 (2 of 5, at 136h) but re-creates the exact v6 defect.
  `NEED_REBIRTH_BASE` 1.25 reaches it while keeping the curve legal — and hands back ~6,340× at
  R10, i.e. most of the ladder-cancelling that C4 was fixing.

**So the pass condition is the thing that should move, not the curve.** LV200 is already met by all
five (59.1h–145.5h, earliest well past hour 20) and is where the ladder actually lives. Your call;
I did not change a constant.

### C4. Still open from the previous run
`NEED_REBIRTH_BASE = 2` is still an unshipped live-balance change: on the day it ships, an existing
R10 player's next level becomes 1024× more expensive. Setting it back to 1 restores today exactly.

---

## D. WHAT I FOUND AND COULD NOT FIX

| # | Finding | Evidence |
|---|---|---|
| **D20** | **`roomManager.js:327` renames a mid-game leaver to `Unknown` — everywhere, permanently.** `room.players.find(...)?.name \|\| 'Unknown'`. A leaver stays in `game.players` but leaves `room.players`, so every later `turn_update` relabels their seat and every game-over stat row. One LEAVE tap does it. **Backend — out of this run's rails.** | adversarial agent |
| **D21** | **The countdown chip lands on the player's lives, not the bomb, at 320×640.** `.game-stage--wb` already fills the wrap, so wrap-centre *is* stage-centre; the board's own layout puts the player card there at that width. Coverage went from 100% of the board to ~7%, so it is a large net win with a cosmetic flaw. | `claude/overlay-inplace/countdown-320x640.png` |
| **D22** | **`.audio-btn` paints over every overlay** and was the only focusable thing outside them. Measured `position: static`, rect (260,580) 44×44 at 320×640, overlapping `← BACK TO MENU` in the shop. Focus containment now keeps Tab away; the visual collision stands. Handed to the hygiene agent as a NO-ORPHAN-FIXED-UI violation. | 5B, measured |
| **D23** | **`MarksPicker` is unreachable below 430px and `RankLadder` below 480px** (`.menu-mark` / the rank chip are `display:none`, deliberately — MenuXp.css). The contract gates open them wide then narrow, so 320 is still enforced; but on a real phone you cannot get to either. | 5B |
| **D24** | **Two unreachable board holes, documented but deliberately NOT gated.** A `word_result` accepted with no `word` banks (280+310+310); `turn_update`+accept after `game_over` banks +1260. Neither is server-reachable. Asserting current behaviour tests nothing and asserting fixed behaviour would be a speculative TIER 1 change. | adversarial agent |
| **D25** | **`.lp-scrim` is 0.72 flat where `.mode-dialog-scrim` is 0.62 + `blur(4px)`**, so the menu stays fully legible behind the locked preview and it reads as a tooltip more than a modal. A design call. | 5B |
| **D26** | **The documented lint gate is red on the base branch.** `npx eslint src --max-warnings=0` fails on `feat/rarity-moment` itself — 37 warnings, 0 errors. The real bar is `npx eslint src` exit 0. Treat any report claiming `--max-warnings=0` green as suspect. | verified by stashing |
| **D27** | **`npx vitest run` is broken in this checkout** — "No test suite found" for all 125 files. The unit runner is `node --test` via `npm run test`. Cost two agents time before they worked it out. | three independent hits |
| **D9** | **SAT Rush's orphan sound control is now UNBLOCKED.** It was left out of App.jsx's suppression list because "its screen is being reworked on another branch" — that branch is `feat/sat-craft`, which has since landed. | `src/App.jsx:2550` |
| **D5/D4** | Carried forward, now with numbers — see §C3 and §C2. | — |
| **D2** | **Resolved.** `feat/run-craft` finished and is on origin at `630bd14` (74 files, its own spec, new art components). | `git ls-remote` |
| **D15** | **Resolved.** The README's only remaining `GameIcons` mention is an explicit historical note, not a pointer. | `README.md:61` |

---

## E. THE WORK, WITH THE REASONING

### E5a. Batch 5, first half — informational overlays become in-place reactions

The principle enforced: **a full-screen overlay is only justified when the player has a CHOICE.**
Anything that merely reports what already happened belongs on the thing it is about.

| Overlay | Verdict | Outcome |
|---|---|---|
| `.countdown-overlay` | **Informational** — and the real defect | `fixed`→`absolute`, **0.85 scrim deleted**, `pointer-events:none`. The numeral is now a flat card that lands on the bomb. |
| `.ko-overlay`, `.clutch-popup`, `.hype-popup` | Informational, already in-place | No change — verified, including every descendant, in the panic band |
| `.game-over-overlay`, `.connlost-overlay` ×4 | **Choice** | No change — each carries a required action |
| `.sticker-backdrop` | Informational, **stays modal** | See below |

**Removing the countdown scrim was safe, and that was checked rather than assumed:** input is gated
in *state* (`GameScreen.jsx:1738`, `inputEnabled = isMyTurn && !gameOver && !showCountdown`), never
by the overlay's hit area. Gate was red before the fix — the scrim measured `rgba(13,6,24,0.85)`
and `elementFromPoint` at board centre returned the sheet.

**The sticker was attacked and survived.** The obvious move — make the "you just got something"
reveal an in-place reaction — is refuted by `ShopScreen.jsx:512`: `HoldBuy` commits on a **single
click** (the name is legacy). The reveal sits over the shop grid for 4.2s, so a `pointer-events:none`
scrim turns the dismiss tap into a purchase. That is the bug class `Sticker.jsx`'s own header records
having already happened once ("opened SAT RUSH"). The two leaks that *were* real got fixed instead:
no focusable control, and no Escape.

### E5b. Batch 5, second half — the modal contract, and the click-through question answered

**The headline hypothesis was wrong, and it was measured rather than argued.** One real gesture
(`mouse.move` → `down` → `up`) over a live `.game-card` beside each dialog: **5 events —
pointerdown, mousedown, pointerup, mouseup, click — all 5 on the scrim, 0 on the card.** Cause: both
scrims close on **`click`**, by which point the target chain is resolved. Proven by *sabotage*, not
by assumption — switching to `onPointerDown` + immediate close does land `pointerup`/`mouseup` on
the card and the new gate goes red at all three desktop widths.

What the audit actually found was worse than the hypothesis: **the Tab ring walked out of five of
the six modals.** `MarksPicker` had *all four* clauses broken — no Escape, no backdrop dismiss,
focus never entered (10 of 12 Tabs landed on the live menu behind it), and at 320×640 the ✕ scrolled
to **y = −168**, so there was genuinely no way out. A shared `useModalFocus` now covers all six.

**And the gate reclassified something the author had wrong.** `LockedPreviewDialog` was written into
the spec as `choice: true`; the structural check went red at all five viewports with *"offers only a
dismiss: [Close]"*. Its own header agrees — "No PLAY button — it's a teaser." It is a screen, and
the gate said so, not the author.

### E6. Batch 6 — the economy follow-through

**The sim printed pass conditions it never evaluated.** Three conditions stated in prose at the
bottom of `econ-curve-sim.mjs`, none checked — so when one began failing, the file went on printing
its own pass conditions directly underneath a table that violated them. That is *why* D5 survived a
whole run. Now evaluated, non-zero exit. My first cut of the monotonicity check was wrong and it
matters: at a zero epsilon it **failed the healthy curve** on `round10` noise ("LV50→100 fell to
×1.1150" against a column reading 1.1150 three times). Tolerance is 5e-4; red-checked against the
v6 constants it exists to catch.

**A fourth raw number, on the one screen the gate never visited.** `SatRushResults.jsx:142` rendered
`+{winsEarned}` — no formatter, in a file that imports none. On the gate's own R10 save that panel
printed `985320700`. Same defect class as the three already fixed; it survived because no test
reached a solo mode's *end* screen. Fixed, red-checked via the shipped `?tune=1&scene=results`
deep-link (a real fast-forward through the engine, not a stub), and the gate now also walks every
STATS tab and all three solo modes. A narrow exemption was needed for SAT Rush's zero-padded arcade
score — six digits by design — or the fix would have failed its own gate.

**The authoring note on the poster, and why it could never have been actioned.** `pensive` shipped
with `"...tell her at all. (also alts: add thoughtful)"` rendered verbatim inside the sentence the
player solves. I applied the note first — and the file's *own* contract test rejected it:
`alt "thoughtful" (10) != word length 7`. Every alt must be the same length as its word (the slot
invariant). So the data carried a player-facing defect in exchange for a reminder that was already
impossible. Note stripped, `alts` left `[]`, and a ninth schema test now matches the shapes of
editorial asides rather than of English.

**Both perf CSS gates named the wrong line when they fired.** Not a false pass — a false *address*.
Both strip comments before scanning and both destroyed the line count doing it (`willChange` to
`''`, `typeScale` to `' '.repeat`). Probe: an offender on true line 13 behind a ten-line comment,
reported as **line 3** by both. The CSS here is heavily commented, so the real misdirection is much
larger. Fixed; both re-probed at 13.

### E7a. Batch 7, first half — the adversarial attack

**A. Three of the four Word Bomb rejects were FREE.** The find of the run. CLAUDE.md's
"INSTANT LOCAL-REJECT" pattern says the client decides `too_short` / `missing_combo` /
`already_used` itself and never sends them, and that the client checks mirror the server's exactly.
They do — but the **consequence** was not mirrored. `onLocalWordResult` was
`setLastWordResult`, full stop: it set the toast and never broke the payout combo, while the
server-reject branch (`App.jsx:1379`) does. Measured: the next word banked **780** after a local
reject and **620** after a server one, and the preserved streak keeps paying for the rest of the
run. So the three rejects a player triggers most often cost nothing, and the one that round-trips
cost everything. Fixed with the *same* `markComboKeep` roll so a mark cannot apply twice or to one
path only.

**B. A local reject shattered the wrong word** — the effect shatters `lastSubmitWordRef.current`,
assigned *after* the local-reject early return, so it blew apart the last word actually **sent**.

**C. `turn_over` had no copy** — returned when the turn advances during the dictionary lookup (you
beat the buzzer by less than the lookup took), and the fallback printed **INVALID WORD** at a valid,
merely-late word.

**D. `slice(-0)` is `slice(0)`.** `railFit` clamps the used-words budget to 0 when no whole chip
fits — which at 3+ players is *every* phone-landscape size measured — and `slice(-0)` then returns
the whole array, laying out all 24 chips in a 0px row.

**What the attack did NOT find, which is the other half of the evidence:** duplicate accepts bank 0;
a `turn_update` overtaking a `word_result` still pays once and attributes correctly; a ghost
player's accept banks 0; `game_started`+`room_update` in one tick drops neither, in either order;
the 3-word gate holds across a restart; rebirth has exactly one writer. Client/server normalisation
was attacked directly — Turkish İ, combining marks, trailing newlines — and **agrees exactly**, same
two locale-independent built-ins in the same order.

### E7b. Batch 7, second half — perf / a11y / dead code

*Pending — see A7.*

### E7c. Cross-mode copy (report only)

§E7 of the previous run listed five divergences. Re-derived from source, four hold:
`TOO SHORT — NEED 3+ LETTERS` vs `MIN 3 LETTERS`; `ALREADY USED — TRY AGAIN` vs `ALREADY USED THIS
RUN`; `INVALID WORD`/`INVALID ANSWER` vs `REJECTED`; and `LEAVE` vs an icon labelled "Exit" vs
`EXIT`. `NOT IN OUR WORD LIST` and `MUST CONTAIN` already agree.

**One refutes.** The "SAT Rush is sentence case" row is partly wrong: SAT Rush's lowercase *panel
labels* (`score`, `wins earned`) are its sanctioned retro-print sub-style, which DESIGN.md §196
explicitly protects. The real outlier is the **`Run it back` button** — DESIGN.md:97 locks
TITLES IN CAPS, control labels are caps in every other mode, and `RUN IT BACK` already exists in
caps in Word Bomb. That one line, not the whole screen.

### E8. What the screenshots caught that the gates did not — the pattern, again

Four this run, every one green on every assertion:

1. **The countdown numeral had no ground.** Scrim removed, the bare glyph came down on top of the
   YOUR TURN label and the bomb at once. Then the plate added to fix it was `#1a0b2e` — the stage's
   own fill — so its black border and 9px offset shadow both vanished and it read as *a hole punched
   in the board*. Inverted: colour to the plate, glyph dark.
2. **A stray yellow NEXT chip in the top-left corner of the viewport**, half off screen, at every
   width from 320 to 1536. `.shop-card` had no `position: relative`, so `.shop-card-next`
   (`absolute; top:-10; left:8`) resolved against `.shop-overlay`. One line.
3. **`MASTERY — PLAY TO LEVI`**, cut mid-word, and a marks grid whose cards squashed below their
   content so "UNLOCKS WITH BOMB SQUAD" printed over the SPRINTER card, and a stats tab bar that
   overprinted itself at 320.
4. **My own**, and the reason this section keeps earning its place: the mark-slots picker computed
   `full` unconditionally, so at ONE slot every unworn mark went disabled and read SLOTS FULL — the
   picker could never change your mark again. 557 unit tests passed; they exercise
   `progress/marks.js`, not the component.

### E9. Mistakes recorded

- The mark-slots regression above. Pinned by a gate, red-checked by restoring the bad expression.
- My first power-creep summary flattened both rebirth states into one list, so min/max reported the
  **cross-mode** spread while labelling it "R0-vs-R10 divergence" — it printed 25.14pp of
  interaction that does not exist. A real number under a false name is worse than no number.
- I claimed the chance effects "reduce exactly to p" at one mark. They do not: `1 - (1 - 0.3)` is
  `0.30000000000000004`, and the existing test caught it.
- I round-tripped `words.json` through `JSON.stringify` for a two-character edit and reformatted all
  956 entries (12,641 insertions). Reverted for a surgical text edit.
- I flagged "WORD B" in a countdown shot as a clipping defect before checking; it is `SprayReveal`
  mid-animation.
- A `&&` chain with a `grep` that matched nothing silently swallowed a commit, and I reported the
  push before noticing the SHA had not moved. `git ls-remote` is the only proof.
