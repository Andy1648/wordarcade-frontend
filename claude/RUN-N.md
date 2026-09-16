# OVERNIGHT RUN — 2026-09-15 · the SUBTRACTION run

Branch `feat/econ-visible`. Rails held: **no merge to main, no deploy, no backend push.**
Two agents max, both used adversarially (one prosecutes, one defends). Every finding below was
put to a second agent before it was acted on — which is the reason this run cuts far less than
the brief asked for, and the reason I can tell you exactly why.

**Read §0 first.** The headline of this run is not what was removed. It is that the subtraction
target could not be met on evidence, and one of the two *sims* the economy is tuned against was
measuring the wrong thing.

---

## 0. THE TWO THINGS THAT MATTER

### 0.1 The 20%-per-screen cut target was NOT met, and I think the target was wrong

The brief said: every screen drops at least 20% of its element count; removing needs no
justification. I inventoried every screen (≈326 distinct elements), produced a ranked 15-item
cut list, then put that list to a second agent whose only job was to refute it.

**Of 18 proposed cuts, 3 survived refutation. 15 died.** Not because the app isn't crowded —
because the specific elements a reader *thinks* are duplicates mostly are not:

- they render at a **different player count** (`.wb-status-row` ROUND/TURN only exist at ≤2
  players, exactly where the kill feed that would replace them is not rendered),
- or on a **different screen** (`MomentumRail` vs the shop is a menu vs an `aria-modal` dialog —
  never co-visible), and removing it breaks three live assertions in `e2e/momentum.spec.js`,
- or they were **already cut once** and what remains is the deliberate survivor (the reject
  toast survived the accept-toast cull specifically because a reject carries a *reason* nothing
  else prints — `GameScreen.jsx:3690`),
- or CLAUDE.md **names them as law** (`.homepage-beat-glow` is one of only two permitted motion
  moments *and* a documented flat-colour exception).

So I cut what survived scrutiny and I am handing you the other 15 as a **taste call**, because
that is what they are. You and the player are right that it feels crowded; the code simply does
not contain the redundancy that would let me prove which element to remove. That is your call to
make, not something I should have guessed at overnight. §3 lists all 15 with both arguments.

### 0.2 FUSE's throughput was never measured, and it had been distorting the economy for two re-fits

`winsmin-sim.mjs` derived CHAIN's words/min from its real engine (11.6/min) but **asserted**
FUSE's at ~20/min from prose: *"continuous solo, short fragments, little downtime."*

Driving the real `fuse.js` engine with the *same* calibrated human model CHAIN uses measures
**9.3/min** — the median run dies at ~18 words at ~6.5s per word, because late fuses fall toward
`fuseBase → 3500ms` while the human still needs ~5.5s, and every expire burns a full fuse for no
word at all. **The asserted figure was 2.15× too fast.**

Since `wins/min = throughput × per-word`, that one wrong input made every proposed FUSE rate rise
look like it would blow the cross-mode spread. It would not have. **That is why fuse sat at ×1.35
through two re-fits**, and it is why your "CHAIN and FUSE should lead" ask kept coming back
impossible. It is now derived, in a shared `claude/fuseThroughput.mjs` that both sims import —
two divergent copies of one quantity is the bug class that caused this.

A second one of the same shape, found while fixing the first: the two sims modelled the *typist*
differently. `econ-visible-sim` drew words with `rng**2.2` over the whole 31k list (median word
rank ~6,845 — "cookers", "jerseys", "starks"); `winsmin-sim` used a frequency-weighted top-12k
typist (median rank ~720 — "painting", "photo", "across"). Nobody types the former with a fuse
burning. The loose picker inflated every non-SAT mode's rarity weight and so **understated the
spread** — 1.89× against winsmin's 2.41× on the same table. Both now use the same typist, and the
config that was live when this run started turns out to have been at **2.06×**, i.e. already over
the 2.00× limit.

---

## 1. BATCH 6 — REBASE THE STACK *(done)*

`origin/main` was 8 commits / 5 PRs ahead; this branch 42 ahead. Merged main in — **not** rebased,
so the 42 commits keep their history. **13 conflicts, every one of them convergent evolution:**
both branches had independently attacked the same first-load payload problem.

| conflict | resolution | why |
|---|---|---|
| `mascot-*.webp` ×5, `firecracker.mp3` | **main's** encodes | both sides re-encoded the same sources; main's are smaller *and* it also ships `.avif`, which this branch never generated |
| `Mascot.jsx` / `Mascot.css` | **main** | AVIF>WebP>PNG superset + intrinsic `width`/`height`. This branch's `webpOf()`/`POSE_SRC` are gone; the class is `.mascot-pic` now |
| `useMusicPlayer.js` | **hybrid** | main's `ensureAudio()` (constructs *nothing* at mount, vs this branch's render-body element with `preload='none'`), keeping this branch's `loadedRef` — the auto-merged `play()` body uses both |
| `main.jsx` | **union, not a pick** | kept this branch's LAZY Sentry boot (plain-class `ErrorBoundary` + queueing `captureException`); the merged `analytics.js` no longer exports `Sentry`, so main's `Sentry.ErrorBoundary` **would not have compiled**. Added main's `installChunkReloadGuard` |
| `GameScreen.jsx` | **this branch**, + one carry-over | this branch MOVED the combo box into the top stack; main edited it in place, so main's block was a **duplicate** — dropped. Carried main's `translate="no"` (PR #33's crash fix) onto the moved copy, which `notranslate.test.js` would otherwise have failed |
| `LoadingScreen.css` | **rebuilt as a real union** | taking main wholesale broke two `typeScale` guards that only exist on this branch (main's AVIF commit predates the `--fs-*` tokenisation). Result: this branch's typography + main's `<picture>` mascot block |
| `LoadingScreen.jsx` | **main** | AVIF boot poses, 176,307 → 49,311 bytes |

Merge commit `ab44070`. Branch is now **0 behind** main.

---

## 2. BATCH 5 — THE NUMBERS *(done)*

### The re-fit

`WINS_MULT`: `wordBomb 2 → 2.1` · `satRush 0.8 → 1` · `chain 1.9 → 2.7` · `fuse 1.35 → 2.9`.
Blitz unchanged at 1.2.

Word Bomb's rise is **not a buff for its own sake** — it lifts the *floor* of the wins/min band up
to meet SAT, which is the only way SAT's card can sit near Blitz's with the spread under 2.00×.

### Simulated, weak / median / strong (`node claude/econ-visible-sim.mjs`)

| mode | weak/run | median/run | strong/run | wins/min | (was) |
|---|---|---|---|---|---|
| wordBomb | 1,414 | 4,377 | 13,369 | 4,661 | 4,439 |
| blitz | 1,308 | 3,958 | 11,563 | 4,661 | 4,661 |
| satRush | 2,508 | 9,320 | 29,087 | 9,303 | 7,442 |
| chain | 2,942 | 12,806 | 42,285 | 8,690 | 6,115 |
| fuse | 4,535 | 20,857 | 62,834 | 7,470 | 3,606 |

Spread **1.996×** (was 2.06× — over the limit). All 7 sim conditions pass, and the conditions are
now *your* asks, evaluated with a non-zero exit, not prose.

At LV40 the card table reads **CHAIN 1,040 · FUSE 1,120 · WB 810 · BLITZ 460 · SAT 390** — both
solo modes now lead both multiplayer modes by ~1.29×, and SAT is 83% of Blitz (was 67%, and 40%
of Word Bomb — your "a third").

### ✅ THE SAT DOUBLE COUNT IS FIXED — headroom 0.1% → 7.3%

`satRarityMult()` (`progress/rarity.js`) now scores a SAT word **relative to its own deck**: the
deck averages **3.42×** rarity against a real typist's **1.23×**, so SAT was collecting a flat
**2.79×** nobody chose. A typical SAT word is now ×1; harder-than-typical ones still pay more, so
the variance survives and only the bias goes. A drift-guard in `rarity.test.js` recomputes the
constant from the shipped deck, so adding words cannot silently move every SAT payout.

Re-fit: `satRush 1 → 3.9`, `fuse 2.9 → 2.7`. **Word Bomb, Blitz and CHAIN are unchanged**, which
is why no payout e2e pin had to move again.

| mode | weak/run | median/run | strong/run | wins/min |
|---|---|---|---|---|
| wordBomb | 1,414 | 4,377 | 13,369 | 4,661 |
| blitz | 1,308 | 3,958 | 11,563 | 4,661 |
| satRush | 2,002 | 5,548 | 12,517 | 4,690 |
| chain | 2,942 | 12,806 | 42,285 | 8,690 |
| fuse | 4,223 | 19,419 | 58,500 | 6,955 |

**Spread 1.864× — 7.3% of headroom, up from 0.1%.** Both sims now agree (winsmin 1.83×); they
disagreed by 4× before, which was the third model-vs-live mismatch (below). All 8 sim conditions
pass with a non-zero exit.

**One of your asks is now provably impossible, and it flipped direction.** "SAT within 20% of
Blitz" was written when SAT was too *low*. With the double count gone, SAT is the only mode with
**no per-word multiplier at all** — no combo, no lucky, and now no free deck rarity — so at an
equal card rate it earns **0.31× Blitz per minute**. Holding the two cards within 20% forces a
2.7–4.0× wins/min gap that busts the 2.00× spread by itself. An exhaustive search over card space
in multiples of 10 found **no** assignment satisfying both. So SAT's card is **390** against
Blitz's 120 — coherent for a mode of few, slow, hard words with nothing to stack.
**If you want the cards closer, the lever is giving SAT the combo + lucky every other mode has.**
That is a gameplay change and I have not made it.

**THIRD MODEL-VS-LIVE MISMATCH, same family as the FUSE throughput.** `winsmin-sim` had
`HAS_COMBO_LUCKY.satRush = true` — it has been modelling a SAT that gets combo and lucky, while
`SatRushGame.jsx` has always passed `1, 1`. It was reporting SAT ~2× richer per word than it is.
Corrected; both sims now use the same live path.

### (historical) The corner this fit used to sit on

SAT's deck is ~4× rarer than a real typist's vocabulary, so at an equal card rate it earns **2.40×
per word from rarity alone**, while its throughput (12/min) is near Blitz's (14). That makes
`wm_sat/wm_blitz = 2.40 × (c_sat/c_blitz)`. Your 20% ask forces the card ratio ≥ 0.80; the 2.00×
spread forces it ≤ 0.835. **The entire feasible window is ~4 card points wide**, and 100/120 is the
only multiple-of-10 pair inside it. Measured 1.996×, and 1.972–1.999 across 12 typist seeds:
under 2.00× everywhere, with ~0.1% of headroom.

**The root cause is a double count.** SAT is paid for rarity twice — once by a deck that is rare
by construction, and again by the per-word rarity multiplier, which exists to reward a player for
*choosing* an uncommon word. A SAT player never chooses; the deck serves the word. Damping SAT's
rarity term is what moves this off the corner. That is a scoring change, not a re-fit, so I did
**not** bundle it. Until it lands, treat SAT's multiplier as load-bearing: nudging it up, or making
the deck rarer, pushes the spread through 2.00×.

### End-to-end verification *(already existed; still green)*

`e2e/no-hidden-wins.spec.js` already does exactly what the brief asks — a scripted 20-word run
asserting `sum(every wins line the UI showed) === delta(taw.wins)`, seeded at 99 collected words so
the 100-word milestone fires *during* the run (the shape of your "800 on screen, 2k in the
balance" report). **It passes after the re-fit.**

### Four e2e specs were pinned to the old numbers — and FOUR of those pins were already wrong

`parity-wb-blitz` (4 tests), `rarity-race` (2), `word-bomb-scoring` (3) and `wins` (2) all pin
exact payouts. Every figure was recomputed from the live table — **never nudged to match** — and
each change was checked for proportionality before being accepted (Word Bomb moved +4.7% against a
+5% multiplier change; the residue is `bankWordWins` snapping *each* per-word grant to a round 10
independently, not one sum).

| spec | was | now | why |
|---|---|---|---|
| `word-bomb-scoring` 3-word | 840 | **880** | WB ×2 → ×2.1 |
| `word-bomb-scoring` 5-word | 1,710 | **1,790** | WB ×2 → ×2.1 |
| `word-bomb-scoring` race | 840 | **880** | WB ×2 → ×2.1 |
| `parity-wb-blitz` WB ×3 | 320/220/3,600 | **340/230/3,780** | WB ×2 → ×2.1 |
| `rarity-race` | 840/140 | **880/760** | WB ×2 → ×2.1 |
| `parity-wb-blitz` Blitz ×2 | 160/110 | **190/130** | ⚠ **already red** |
| `wins` Blitz ×2 | 360/650 | **430/780** | ⚠ **already red** |

**Four pins were wrong before this branch touched anything.** 160/110/360/650 are all
`round10(weight × 100)` — Blitz at the *base* rate, ×1. Blitz has been ×1.2 (per-word 120) since
the rebalance-2 fit, so the correct figures were 190/130/430/780. Blitz's multiplier was **not
changed by this run**; these only surfaced because the full suite was run. A viewport-only gate
never executed them, so they survived several merges — which is the second instance in this run of
a check that was believed to be running and wasn't.

---

## 3. BATCH 1 + 7 — SUBTRACTION, PROSECUTED AND DEFENDED

### 3.1 What was actually removed

| what | where | net |
|---|---|---|
| **the entire share / COPY RESULT pipeline** *(you named it)* | `ShareBar`, `CopyResultButton`, `shareCard`, `cardModel`, `renderCard`, `qr`, `copyText`, `shareConfig`, `shareText` + its test, `index.js` — **13 files deleted** | −1,087 lines |
| its call sites | Word Bomb, Category Blitz (solo + multi), SAT Rush results, CHAIN, FUSE — 4 screens, 6 render sites | |
| its CSS | `.sr-share` block in `SatRush.css`, the `.solo-share-btn` slot in `SoloShell` | |
| its e2e | the 44-line share-receipt test in `solo-endgame.spec.js` | |
| `.game-spectator-count` | `GameScreen.jsx` — a count of cards already visible in the same viewport | |
| `.shop-back` + `.stats-back` | both are panel-level siblings of the scroller, permanently co-visible with the header ✕, calling the identical `onBack` | |
| dead decor in `Homepage.jsx` | `GraffitiTag` + `PaintSplatter1-4` imports, `VANISHING`, `PERSPECTIVE_ENDS`, `RECEDING_TAGS` and the palette that only `RECEDING_TAGS` used — all defined, never rendered | −50 lines |
| `"WINS"` from every game card | `"610 WINS / WORD"` → `"610 / WORD"` | 5 instances |

**Kept, deliberately:** `links.js` (room invite links — still live) and `resultCard.js`
(`tierForClockLeft` is solo-run logic, not share UI). `REF_URL` was inlined into `links.js`
**verbatim**, `?ref=share` included, so invite behaviour and its PostHog attribution are unchanged.

**`TryModeRow` survives** — it lives in `src/share/` but is a cross-promo row, not the share
button. You didn't name it; say the word and it goes.

### 3.2 ANDY'S RULING (2026-09-16) — five cut, ten kept

He overruled the defence on five and upheld it on ten. **Cut and shipped:**

| cut | where | why it went |
|---|---|---|
| `.wb-tension` | `GameScreen.jsx` | four simultaneous full-viewport layers — vignette, three speed lines, HURRY!/GET OUT!, red throb — on top of the continuous danger vignette, the bomb's fuse, the rattle and the timer. Five ways to say "hurry". `data-tension` stays (it still drives the bomb and the seats); only the overlay left. Took **4 infinite animations** with it. |
| the two duplicate motifs | `SoloShell.jsx` | `.solo-deck-motif` + `.solo-over-motif` were the *same node* rendered twice more on one screen. One motif per screen now. |
| the NEXT-unlock line | `Homepage.jsx` | three spans that at R1 read **"NEXT REBIRTH 1 FRAME REBIRTH 1"** — the same word three times, naming a reward the player cannot see, with no affordance. |
| the NO MARK chip | `MenuXp.jsx` | the empty slot rendered a dimmed outline on the theory that it advertises itself. It is a chip that says nothing, parked next to the level. It now appears only when a mark is actually equipped. |

**Kept (ten), including `.homepage-beat-glow`** — the defence stands as written below.

The defence's own scoreboard is unchanged and worth keeping visible: of 18 proposed cuts, 3
survived on evidence, and Andy then cut 4 more on taste. That is the right split — the code
could not prove these four should go, and it did not need to.

### The 15 that survived refutation — the arguments, for the record

Each is listed as: *the case for cutting* → **the case that saved it**. I have applied none of them.

1. **`.wb-tension`** (vignette + 3 speed lines + HURRY!/GET OUT! + throb) — *four full-viewport
   layers saying what the danger vignette, fuse and rattle already say* → **different drivers**
   (discrete `tensionTier` vs a continuous `--danger` ramp), and HURRY!/GET OUT! is the only
   *text* prompt in the mode. Already cut once (12 → 3 speed lines).
2. **`MomentumRail`** — *a trophy for a number the shop prints* → **breaks 3 assertions** in
   `e2e/momentum.spec.js`; the shop is a separate `aria-modal` screen. Already renders nothing
   until the first buy.
3. **`.menu-next-unlock`** — *3 nodes, no affordance* → no duplicate exists anywhere; the menu's
   only forward-looking retention line.
4. **`.sr-stack-dock` / LiveStack in SAT** — *SAT's weight is hardcoded so the stack can't move* →
   **the claim was a category error.** LiveStack reads `perWordRateNow`, never `cappedWordMult`,
   and SAT's per-word `awardWordXp` moves the LEVEL row mid-run. It also self-hides below 900px.
5. **`.solo-deck-motif` + `.solo-over-motif`** — *the same motif 3×* → the over-motif replaces one
   buried under an 86% scrim; both are 5–7% opacity `aria-hidden` textures, not UI.
6. **`.go-awards`** — *restates the summary* → only element that attributes a superlative to a
   **player**; self-hides when nobody solely owns one.
7. **CB `.go-stats-summary`** — *the scoreboard below lists all three* → **already gated to
   `scores.length > 2`** for exactly that reason; the 1v1 cut was made months ago.
8. **`.solo-armhint`** — *CHAIN states the rule 5×* → it is 3×, two mutually exclusive, and this
   one renders **only** in the pre-clock window and vanishes the moment you type.
9. **`.sr-cover-example`** — *the briefing teaches it properly* → rule ≠ worked instance; every
   other mode ships an example (asserted in 3 specs). Cutting it makes SAT the only mode that
   hides its mechanic.
10. **`.sr-filmstrip`** — *the share receipt encodes the same run* → **that argument is now void:
    I deleted the receipt.** `.sr-resstrip` carries 3 scalars; the filmstrip carries the ordered
    sequence (where the streak broke, whether misses clustered).
11. **`.homepage-beat-glow` + `.homepage-logo-drip`** — *ambient noise* → **CLAUDE.md:159-160**
    names the glow as one of only two permitted motion moments *and* a documented flat-colour
    exception. Cutting it amputates half the MENU MOTION LAW.
12. **`.wb-status-row` ROUND/TURN** — *duplicated elsewhere* → render **only at ≤2 players**,
    exactly where the kill feed is absent and nothing else states whose turn it is.
13. **`SweatDrops` / `.bomb-spark-burst` / `FloatingScore` / `.game-toast.rejected`** — *four
    redundant accept/urgency cues* → all transient and self-unmounting; the reject toast carries a
    **reason** nothing else prints, and is the documented survivor of the accept-toast cull.
14. **`.solo-chain-node.is-ghost`** — *decorative padding* → removing them makes the deck
    **reflow on every accepted word**, the exact instability the codebase engineers against.
15. **`.cb-cat-mascot`** — *sits on the thing you must read* → the only mascot in the CB round
    view and the mode's live reaction channel.

**If you want a blunter cut anyway, say so and name the screens** — I'll do it on your taste
rather than argue the code at you. My own pick of the 15, if forced: #1 (`.wb-tension` down to the
danger vignette + the text prompt only) and #5 (the two duplicate motifs). Those are the two where
"fewer, louder" genuinely applies.

---

## 4. BATCH 3 — THE PROGRESS BAR *(built; needs your pick)*

Three sizes built, not one guessed at. `?xpbar=tall` (default) · `?xpbar=xl` · `?xpbar=xxl`, plus
**`?xpbar=off`** which restores the old hairline so you can A/B against what it replaced.

| | track height | vs the old 30px hairline |
|---|---|---|
| `tall` | 92px | 3.1× |
| `xl` | 116px | 3.9× |
| `xxl` | 140px | 4.7× |

Everything you asked for is in all three:

- **a slab, not a strip** — `#1a0b2e` fill, 3px black border, 8px radius, hard `4px 4px 0` offset
  shadow: the CHAIN chip treatment (`Solo.css:666`), applied at panel scale.
- **hard black tick segments** — ten segments split by 4px of solid `#000`. The old notches were
  1.5px of `rgba(255,255,255,.16)`, which is half of why it read as a hairline. The ticks paint
  **above** the fill so segmentation survives a full bar.
- **texture** — a halftone dot field in the empty track and the same halftone in ink inside the
  fill, so the bar reads as two printed plates meeting at the leading edge. Every stop is a hard
  stop: these paint flat dots, not a gradient ramp.
- **the level numeral at 3.8× its label** — `--fs-h2` (42px) against the `--fs-micro` (11px)
  "LEVEL" kicker, in Bungee, in its own inset chip. Bungee is legal here *because* it is finally
  big enough — the typeScale guard requires Bungee ≥ `--fs-panel`, which is exactly why the old
  13px Space Mono chip could not be display type.
- **the active rate printed on it** — the hovered card's live `perWordWins` (level-, rebirth- and
  mark-scaled), falling back to Word Bomb on touch.

**Layout note:** the bar is two rows now (meta chips on top; LEVEL block + full-width track
below). Sharing one row starved the track to ~150px of a 760px bar — the readout and the rate line
both overflowed it, and the ticks read as fat bars.

**The phone could not take it, and I stopped trying to force it.** At 390px the full two-row slab
costs ~200px of height. The menu's card fit-math spends whatever the header leaves, so that came
straight out of the five cards — they were squeezed until `.game-card-badge` overflowed its own
card, which `viewport-integrity` caught at 390×844 and 360×640 in **both** themes. Two attempts
made it worse before the right answer appeared:

1. **reserve the corner-nav's height and push the flow below it** — shrank the cards to ~40px
   slivers. Reverted; a nav collision is better than an unusable card row.
2. **shrink the track** (92 → 64px) — moved the card from 41px to 57px wide. Still overflowing.

So below 600px the bar keeps the **original single row** (chips and track side by side, no wrap)
and spends its budget on the three things that actually made it loud: a taller track, the hard
black ticks, and a level numeral that is still display type (`--fs-panel`). The rate line is
dropped — every card already prints its own rate and there is nowhere to put it at that width.
~60px against the old hairline's 34px, so the cards keep their room. **The 3–4× spec holds on the
desktop menu, which is the screen you're judging.** If you want the full slab on phones too, the
honest cost is dropping to 3 cards per screen — your call.

**Screenshots:** `claude/xpbar/{off,tall,xl,xxl}-{1366x768,390x844}.png` plus `-bar.png` tight
crops of each. Bar heights measured: desktop **170 / 194 / 218px** against the old **36px**;
phone **143 / 143 / 150px** against **34px**.

### Reviewing those images caught three bugs no assertion would have

This is the part of the rails that earned its keep. Every one of these renders fine, passes every
test, and is wrong:

1. **The bar printed the wrong rate.** It called `perWordWins({ mode: 'word-bomb' })` — but
   `perWordWins` looks `WINS_MULT` up by **raw key**; it is `perWordRateNow` that runs the id
   through `modeKey()` first. So the gameData id missed the table and silently resolved to ×1:
   the bar printed **290** where the card directly under the cursor printed **610**. That is
   precisely the "multipliers should show" bug this feature exists to fix, reintroduced by the
   feature itself. It now calls `perWordRateNow` — the same function `GameCard` uses — so the two
   numbers agree *by construction*.
2. **The phone layout hid the headline.** The corner nav is a ~200px absolutely-positioned column
   at top-right (x ≥ 245 of 390), and the bar ordered the LEVEL block and the track **last** — so
   both were drawn under REBIRTH and STATS, leaving a phone user looking at a streak chip and
   nothing else. The loud row now goes first and hard left, with the readout left-aligned; only
   the track's empty right end falls under the nav.
3. **The streak chip's order rule never matched.** The selector said `.menu-streak-chip`; the
   element is `.menu-streak`. It kept `order: 0` and sorted ahead of everything in *both*
   layouts — visible in the desktop shots as the streak sitting left of the wins chip, which is
   not what the rules say.

And the last `viewport-integrity` holdout: at **360×640** the five cards are ~65px wide and
`610 / WORD (×6)` overflowed its own card even with the type pinned at its 7px floor. Type size
cannot fix a string longer than its container, so something had to go — and it must not be either
*number* (the rate is the point; the `(×N)` is the only surface showing the **combined** level ×
rebirth × momentum × mark multiplier). `/ WORD` now drops via a **container** query under 96px of
card width: it is the one part a player can infer, and the bar states the unit once on the same
screen. **`viewport-integrity` menu: 35/35, all themes, all viewports** (was 10 failing).

---

## 5. BATCH 2 — PAUSE TO LEARN *(shipped in SAT Rush; blocked elsewhere, and here is why)*

### SAT Rush — shipped

SAT already had the beat: on a miss, a `ReEncode` card shows **IT WAS** → the word large → the
sentence with the answer filled in and highlighted → the definition → one root cousin, dismissible
by any key. What it did **not** have was time to read it, and that is precisely the complaint:

- `MISS_PAUSE_MS` **1800 → 3200**. Four things to read in 1.8s was never realistic; a player
  saying "the modes move too fast to learn anything" is describing this number.
- **new `FINAL_MISS_PAUSE_MS = 6000`** — the miss that *ends the run* now holds for 6s. This is
  your specific ask, and it is the one pause with **no pacing cost**: nothing follows it but the
  results screen, so a short hold only loses you the last word you got wrong — the one most worth
  learning. Any key still skips it.

### CHAIN, FUSE, Word Bomb, Blitz — reporting, not faking

Two blockers, and the second is the interesting one.

1. **There is no definition source.** The only gloss data in the app is SAT Rush's 956-word deck
   (`word`, `pos`, `gloss`, `context`, `root.cousins`). The accept set is **87,815 words**.
   Overlap: **919 words = 1.0% coverage.** There is no offline dictionary to fall back on, and a
   runtime dictionary API would put a network call in a game loop. Per your instruction I am
   saying so rather than faking one.
2. **More fundamentally: those four modes do not end on "a word the player failed."** They end on
   a **prompt the player couldn't satisfy** — CHAIN dies on a *letter*, FUSE and Word Bomb on a
   *fragment*, Blitz on running out of category members. There is no answer-word to define. Even
   with a full dictionary, there would be nothing to look up.

**What would actually work, if you want it:** show *a word you could have played* — the engines
can supply one (CHAIN knows its valid continuations, FUSE/WB know words containing the fragment).
That teaches real vocabulary and fakes nothing. It needs a decision from you, because it's
additive in a subtraction run, and the definition half of it still needs a data source.

---

## 6. WHAT NEEDS YOU

| # | thing | why it's yours |
|---|---|---|
| 1 | **Pick an XP bar size** — `?xpbar=tall` / `xl` / `xxl`, A/B against `?xpbar=off` | taste; all three meet the spec |
| 2 | **The 15 defended elements (§3.2)** | the code says keep them; you and a player say the app feels crowded. Taste wins over code archaeology here, but not without you saying so |
| 3 | **SAT's rarity double-count (§2)** | the econ fit is on a ~0.1% margin until this is fixed. It's a scoring change, so I left it for you |
| 4 | **Batch 2 for the four non-SAT modes (§5)** | needs your call on "a word you could have played", and a definition data source |
| 5 | **2-device live play-test** | the merge touched `main.jsx` boot, `useMusicPlayer` and `GameScreen` — all Tier 1. REGRESSION CHECKLIST, please |

## 7. NOT DONE

**Batch 4 (the arcane pass)** — not started. It is the largest and most speculative batch, it
applies "to every screen that survives Batch 1", and Batch 1 did not settle until late because the
adversarial pass overturned most of it. Starting a whole-app restyle on an unsettled element list
would have produced exactly the kind of change you'd have to unpick. It needs §6.2 answered first.

I'd rather hand you five finished things and one honest omission than eight half-applied ones.

---

## 8. BATCH B — THE ARCANE PASS *(applied; before/after in `claude/shots/`)*

Five primitives, in `src/theme/arcane.css`, applied to surfaces that **already exist**. The pass
adds exactly ONE element to the whole app — the grain layer — and nothing else: every other
treatment rides a `::before`/`::after` on a box already in the tree. That is deliberate. Running
"make it louder" straight after "make it emptier" only works if louder is a property of what
survived, not a new stack of treatment layers.

| primitive | what it does | where |
|---|---|---|
| **grain** | single-hue static overlay — `feTurbulence` + `feColorMatrix` inlined as a **data URI**, so the browser rasterises one 180px tile and then repeats pixels. A live `<filter>` would be re-evaluated on paint; this cannot be, because by the time it reaches the compositor it is a bitmap. 5% opacity, one fixed layer, whole app. | `App.jsx`, beside `CursorTrail` |
| **facet** | posterised hard cel-shadow: two FLAT bands meeting on a hard stop at 62%. No ramp. | `.game-card`, `.solo-deathcard` |
| **rim** | one bright 2px inset edge, **rationed to one per screen** — WB card on the menu, the prompt box in-game, the primary action in a dialog. Two rims on a screen means the screen has no subject. | 3 selectors total |
| **halftone** | hard-stop dot field, on the BACK plate of a surface so "never behind text" is structural rather than a promise | `.game-card-art`, shop body |
| **value grouping** | the supporting cast steps back to 0.86 so exactly one thing is brightest — dimming the rest is cheaper than brightening one thing, and it composites | corner nav, footer, rails, used-list |

**Nothing here animates.** No keyframes, no transitions, no `will-change`. The infinite-animation
count cannot move, and the `.wb-tension` cut in Batch A *removed* four.

**SAT Rush is excluded from the rim and the facet** — CLAUDE.md pins it to the retro-print
sub-style, and it already has halftone and grain natively in its own ink/paper idiom. Applying the
neon house treatment there is the one change this pass must not make.

### What the screenshots caught that the gates did not

**The facet was applied to the big panels too, and it was wrong.** On a 900px panel a 163° hard
stop does not read as "lit from one side" — it reads as a **diagonal band slicing across the
content**. In the shop it cut straight through the PRISM theme card and half-darkened its price
button, breaking this file's own rule that a facet must never darken text.
`viewport-integrity` measures *boxes*; it cannot see that a shadow landed on a word, and it passed
the frame clean. Fixed by restricting facets to things the player reads as one solid object at a
glance — a card, a death slab. Anything big enough to contain a layout is too big to be lit from
one side. Compare `claude/shots/B-after/shop-1366x768.png` against the first attempt.

**And a second one, in CHAIN:** the frame shows the mode's single rule stated **three times at
once** — the pre-clock armhint ("EVERY WORD STARTS WITH THE LAST LETTER OF THE ONE BEFORE"), the
deck hint ("EACH WORD STARTS WHERE THE LAST ONE ENDED") and the input placeholder ("START WITH
'F' · 3+ LETTERS"). The defence argued these were "3, two of them mutually exclusive with normal
play". The screenshot says otherwise: in the pre-clock state, which is every run's first moment,
all three are on screen together. That is a Batch C/D cut, and the picture is the evidence.

---

## 9. BATCH C — THE FIRST FIVE MINUTES, MEASURED

Measured by `e2e/_shots.spec.js`, which takes the census from the **same page-load** as the
screenshot, so the number and the picture can never disagree. Counts only what a player perceives:
rendered, non-transparent, ≥4px boxes that paint their own ink; hues above 40% saturation; and
type sizes split into UI vs decoration (the wall graffiti is texture, not type).

| step | elements | hot colours | UI type sizes | moving |
|---|---|---|---|---|
| splash | 70 | 5 | **2** | 4 (3 infinite) |
| menu | 128 | 7 | 10 | **0** |
| **dialog-word-bomb** | **154** | 7 | **11** | **13** |
| ingame-word-bomb | 94 | 5 | 5 | **0** |
| gameover-word-bomb | 123 | 5 | 6 | 3 (3 infinite) |

*(target: <25 elements / ≤4 hot colours / ≤5 type sizes / ≤2 moving)*

**The worst three steps: the mode dialog, the menu, and the game-over card** — in that order. The
dialog is worst on every axis at once.

### The <25-element target is not reachable, and here is the arithmetic

The menu's job is five mode cards. One card is ~15 painted elements before any chrome — art
plate, halftone, facet, ribbon, badge, masthead, title, payout, multiplier, lock, and the
magnet/scale wrappers that give it its box. **Five cards is ~75 elements on their own**, and that
is the screen's entire purpose. Hitting 25 means shipping a menu that does not show the modes.

The honest reading: **element count is the wrong metric for this app** — it counts a five-card grid
as five times worse than a one-card grid, when a grid of five is exactly what a player came for.
The three axes that *are* actionable, and where the crowding complaint actually lives:

1. **UI type sizes — menu 10, dialog 11, against a scale with 7 steps.** Off-scale sizes in use:
   7, 8, 19, 20, 24, 73px. Two of those (7, 8) are mine, from the card-payout clamp floor. This is
   the single most fixable axis and the one a player reads as "visually noisy".
2. **Moving things on the dialog: 13.** On a screen whose job is to answer "what is this mode?"
3. **Hot colours: 7 on the menu, 9 in the shop**, against a 4-colour target.

### Two of those three turned out to be measuring the wrong thing — and the third was real

**Type sizes: not a defect.** The menu's 10 UI sizes are 11 / 13 / 18 / 28 / 73 for the CHROME —
five, exactly at target, and every one is a `--fs-*` token or a documented height-guarded one
(the 73px wordmark is `min(--fs-hero, 9.5vh)`, capped on purpose so it does not eat the title↔XP
gap on a 768-tall laptop). The other five come from inside the five game cards, whose type is
`cqw`-scaled to card width **by design** — that is how a card keeps its proportions when the grid
resizes it. Snapping card type to the global scale would break the cards at every width but one.

**"Moving things": mostly entrance, not idle.** The dialog's 13 are its finite one-shot entrance —
`inf 0`. What matters is what never stops, and the census reports that separately.

**THE REAL FINDING, and nobody had looked:** the menu runs **0** infinite animations at rest — the
MENU MOTION LAW works. The screens it was never applied to do not:

| screen | infinite animations at rest |
|---|---|
| **gameover-category-blitz** | **11** |
| **lobby** | **9** |
| **room** | **7** |
| splash / browser / gameover-word-bomb | 3 each |
| **menu · ingame-word-bomb · every dialog** | **0** |

The cause is one rule. `.wave-letter` ran `letter-bounce-forever … infinite` — **a loop per
letter**, for as long as the screen was open. The lobby title is 9 letters; the room code is 4.
It is the same "constant idle jumping" the menu law was written to stop, and it was never applied
here because `WaveText` only appears on the lobby and the room, which nobody audited.

**Cut:** `.wave-letter` is now a one-shot entrance ripple that holds its resting pose, and the
room's three other idle loops go with it — the per-slot `chip-rock` (whose count *grew with the
room*: an 8-player lobby ran eight), the button `breathe`, and the mascot `loiter`. The waiting
pulse stays as the single liveness cue. Entrances, hover and press feedback are untouched; that is
motion the player asked for.

**Still not cut, and reported rather than guessed:** hot colours (menu 7, shop 9, against 4). That
is a palette decision across five themes, not a mechanical fix, and it is the one axis where I
would be substituting my taste for yours.

