# RUN18 — landing pad

Rails held. **Nothing merged to main, nothing pushed to main, nothing deployed, backend never
touched.** Branches, prototypes and reports only. Concurrency stayed at or below 2 agents.

---

## THE NINE THINGS THAT NEED YOU

**0. The squint harness names the element under every hot region — and that changes answers. §6c**
A lobby variant scored a clean "1 region, PASS" while the entry point was the NAME FIELD and the
CONTINUE button never reached the bar at all. A screen can pass a region count and still fail the
rule. Everything below was re-checked with that turned on.

**1. Two Word Bomb layout defects, measured, with both fixes built and neither chosen. §2**
At 1366x768 a seat's NAME is cut off by 31px at 2 players, and at 3+ players the KILL FEED sits
entirely below the fold (128px under at 1366x768, 119px at 390x844). The brief's own two
constraints cannot both hold at 768px tall, so which one yields is yours:
`?wbfit=ring` (the ring shrinks) vs `?wbfit=prompt` (the fragment shrinks). Screenshots for both,
at every player count and viewport, in `claude/wb-ring/`.

**2. On every mode dialog the SECONDARY button is the loudest thing on screen. §6a**
`.mode-dialog-btn-join { background: #fff }`. White is **19.88:1** on the dark field; PLAY takes
the mode's own colour, **7.03:1** for Word Bomb. JOIN WITH CODE is 2.8x the contrast of the primary
CTA on both MULTIPLAYER dialogs (Word Bomb and Category Blitz — the solo modes render a single PLAY
and are unaffected), where the brief says "START the only hot element". One-line fix built as
`?dlgcta=demote`; screenshots in `claude/x7/`.

**3. Five screens have no single entry point at ANY viewport. §7d**
The value-grouping gate, made real, run over 8 viewports x 15 screens. `wb-dialog`, `blitz-dialog`,
`lobby`, `chain-play` and `fuse-play` fail at **every size tested** — these are composition
problems, not responsive ones, and no breakpoint work will touch them. Six screens pass 8/8, which
is the other half of the result: the system works where it is applied.

**4. Three look experiments are built and shot side by side. Nothing is merged. §7**
7a danger escalation — works, reads clearly, and is the one I'd argue for.
7b chromatic Bungee lockup — buildable, but only after throwing Bungee Shade out of it, and it
still renders wrong in place (§7b, honestly unresolved).
7c per-mode motifs — built for all five modes; CHAIN and FUSE already shipped this idea at 7%
before the run started, which is the strongest evidence for it.

**5. The menu is the dimmest screen in the game, by measurement. §7d**
Its loudest element reaches L\* 0.430 after a 12px blur, where every other non-solo screen is
0.74–0.96. The wordmark is Bungee Shade under a 5px black stroke, which eats most of the letter.
This is a consequence of the canonical title spec, which CLAUDE.md locks — so it is your call,
not a bug I should fix.

**6. Phase 3's per-mode colour scripts are declared and then never used. §3**
Seven scripts are defined in `texture.css`. `--mode-lead` and `--mode-second` are consumed by
**nothing in the repo**. The screens still LOOK right, because each mode's CSS hardcodes the same
hues by hand — so the cost is not a wrong colour today, it is that there is no single source of
truth and nothing stops the two copies drifting. Low severity; the item is not actually done.

**7. THE RUN has no screen on this stack, and Phase 5 could not build one.** §5
`release/prod-1` has five modes. The Run lives on `integration/run-stack-3`, unmerged. Phase 5
delivered four of its five named screens; the fifth was not reachable from this base.

**8. Nothing here has had a 2-device play-test.** The phase stack touches `GameScreen.jsx`
rendering and `App.jsx`-adjacent surfaces. Per CLAUDE.md that is a Tier 1/2 gate I cannot clear.

---

## BRANCHES

The six phase branches are a STACK, each off the last, so **`feat/shell-screens` is the single tip
that carries all six.** `feat/experiments` sits on top of it and must never merge.

| branch | HEAD | what | state |
|---|---|---|---|
| `feat/type-scale` | `e357e45` | P1 modular scale, value grouping, contrast floors | pushed |
| `feat/wb-ring` | `7f1b38c` | P2 the ring | pushed |
| `feat/texture-scripts` | `5a6140e` | P3 grain, halftone, per-mode colour scripts, cel facet | pushed |
| `feat/juice-stack` | `cca46dc` | P4 one event-only juice stack | pushed |
| `feat/mode-screens` | `1689427` | P5 Blitz, SAT Rush, Chain, Fuse | pushed |
| **`feat/shell-screens`** | **`f6bcf49`** | **P6 menu/dialogs/shop/stats/end + the WB fixes. THE TIP.** | pushed |
| `feat/wb-gameplay-look` | `241398a` | the reported glyph defect, fixed on the branch it was reported on | pushed |
| `feat/experiments` | `d067dbc` | P7 prototypes + the measuring tools. **NEVER MERGE.** | pushed |

Every push verified against `git ls-remote`, not assumed.

---

## 0. THE THREE REPORTED DEFECTS

### 0a. The stray bomb glyph — FIXED, and it was not what it looked like
Reported: "a stray bomb glyph renders between the WORDS and BEST COMBO values on the local
player's card."

Diagnosed from source, not guessed from the screenshot. The bomb hand-off ghost animates
`bomb-flight-arc 340ms ... forwards`, but the node is unmounted by a **560ms** JS timer
(`GameScreen.jsx`, `setFlight(null)`). Nothing anywhere animates its opacity — not the
`.bomb-flight` container, not `.bomb-flight-icon`. So for the last **~220ms of every single turn
change** the bomb sat static and fully opaque at `b.left + b.width/2, b.top + b.height/2` — the
dead centre of the newly active player's card. The two stats are a centred flex row, so the card's
horizontal centre is exactly the gap between them. It was never a stray glyph; it was the
hand-off ghost parking on the card it had just been thrown to.

Fixed by absorbing the ghost as it lands. The opacity sits on the ICON rather than the container,
so the landing impact ring — a sibling running 300–540ms — still plays in full, and the 0.35
motion-smear `::after` fades with it for free as its pseudo-child. Finite, transform/opacity only,
zero new infinite animations.

Shipped on `feat/wb-gameplay-look` as asked, **and** on the phase tip, because the same bug was
live in all six phase branches.

### 0b. The timer ring — mostly superseded, one literal gap closed
Phase 2 had already replaced the orbiting ring. It is now concentric with the mascot (`cx 80
cy 105 r 62` against a mascot at `x10 y35 140x140` — the same centre, so it is part of the bomb
rather than orbiting it), thickened to a 5px fill on a 7px black track, and tied to the mode
script (`#FFE94A` → `#FF6B3D` → `#FF4B4B`).

The one sub-item genuinely unmet was "put the spark ON the ring path": the ring's leading edge was
a bare rounded stroke cap, which is precisely why it read as a flat circle rather than something
being consumed. It now carries a burn head in the same escalating colour as the fuse.

**The geometry was wrong the first time and I caught it by measuring.** I wrote the head at arc
fraction `1-ratio`. With `pathLength=100`, `strokeDasharray=100` and `strokeDashoffset=100*(1-r)`,
the dash phase at arc-length `s` is `(s+d) mod 200`, so the visible arc is `[0, 100r)` and the burn
head is at fraction **`r`** — retreating anticlockwise toward 12 o'clock, not sweeping clockwise
away from it. Checked by sampling the phase in node before shipping. It is the same convention the
fuse flame already uses (`fusePointAt(ratio)`), which is the cross-check that it is right.

Deliberately does not flicker: the fuse flame's flicker is an `infinite` animation and the budget
is zero new infinite ones.

### 0c. The bomb in bottom-left dead space — not fixed, by instruction
Phase 2 replaces that layout. It does — see §2, which is also where it still falls short.

---

## 1. WHAT I VERIFIED VS WHAT I INHERITED

Phases 1–5 were built overnight before this session resumed; Phase 6 was sitting **uncommitted** in
the working tree. I did not re-derive their work. What I did check, before touching anything:

* `vite build` exit 0
* `eslint src` — **0 errors** (33 pre-existing warnings, all `react-hooks/exhaustive-deps` and one
  unused import, none introduced by this run)
* `node --test` — **517/517 pass**

And the phases wrote their own build-failing gates, which is the part that actually matters,
because it means these constraints cannot silently rot:

| phase | assertion that now fails the build |
|---|---|
| 1 | every font-size goes through a `--fs-*` token — the scale cannot be bypassed |
| 1 | the scale holds its ratio and its accessibility floors |
| 1 | the touch-target floors are 44px / 8px; no declared target smaller than 44px |
| 1 | exactly one `--v-accent` element per screen |
| 3 | the grain is never painted on an animated element |
| 3 | the grain is an inline data-URI, never a network request |
| 3 | grain opacity stays in the 6–10% band and halftone in 10–20% |
| 3 | the halftone stays off text-bearing panels |
| 4 | the shake tiers are 2px/0.2deg routine and 4px/0.4deg heavy |
| 4 | every CAMERA shake carries rotation and stays inside the caps |
| 4 | the motion toggle is persisted AND reaches the CSS-driven shakes |
| — | `will-change` lists only compositor props (transform / opacity) |

Phase 6 I committed and pushed myself (`c3a91c1`): the menu's spotlit last-played card at a real
1.5fr grid slot rather than a transform over an equal one, the shop ladder, the stats chips, and —
the part worth calling out — every share now offers a plain-text twin. An emoji grid is a known
screen-reader failure; thirty squares announce as "green square" thirty times. `buildResultCardPlain`
says the same thing in a sentence and `describeGlyphRow` doubles as the grid's alt text, so the
emoji row is never the only account of itself.

---

## 2. PHASE 2 — I RAN THE RING'S OWN GATE. IT HALF PASSES.

`claude/_tools/wb-ring-gate.mjs` measures the acceptance the brief actually specified — player
counts 2/3/4/8 at 1366x768, 1280x720 and 390x844 — instead of eyeballing one screenshot.
Screenshots of all twelve combinations, for all three variants, are in `claude/wb-ring/`.

### What holds — and this is the thing the ring was built for
| players | seat widths | overlap | page scroll | bomb % of cell |
|---|---|---|---|---|
| 2 | 68 / 68 | 0px | 0 | 56.8% |
| 3 | 68 / 68 / 68 | 0px | 0 | 56.8% |
| 4 | 68 × 4 | 0px | 0 | 56.8% |
| 8 | 68 × 8 | 0px | 0 | 56.8% |

Identical at 1280x720 (56.2%) and 390x844 (56.1%). Against a >=55% floor, at every count, at every
viewport. **The stretched-empty-bar failure is genuinely gone** — a row could not do this and the
ring does.

### What does not hold — two separate defects
**(i) A seat name is clipped at 2 players, 1366x768, by 31px.** The ring is capped against the raw
viewport (`min(46vw, 62vh)` = 476px) rather than against the space left after the header and the
fragment. Measured at 1366x768 with 4 players:

```
viewport height          768
header (grid row 1)       69.4
fragment (grid row 2)    179.6
gaps + padding            ~73
ring (grid row 3)        476.2   = min(46vw, 62vh)
-----------------------------
ring top at               322  ->  ring bottom at 798, against a fold at 768
```

It fits at 1280x720 and 1440x900 and fails at 1366x768 and 390x844, which is exactly why a spec
that samples other sizes stays green. `e2e/wb-short-layout.spec.js` reports `fitH: 100.7` at
1366x768 and passes — it is already reading the overflow, just under its own threshold.

**(ii) At 3+ players the KILL FEED sits entirely below the fold** — 128px under at 1366x768, 119px
at 390x844. Not a ring-size problem, and neither fix below clears it. Found, not fixed.

### Both ways out are built. Choosing is yours.
The brief asks for "bomb + fuse >= 55% of its cell" and "fragment 72-96px Bungee". At 768px tall
those two cannot both hold. Rather than pick one quietly:

| | 2p clip @1366 | kill feed @1366 | bomb % of cell | fragment |
|---|---|---|---|---|
| today | **+31px** | +128px | 56.8% | in band |
| `?wbfit=ring` | **−14px** ✔ | +82px | 56.7% ✔ | in band ✔ |
| `?wbfit=prompt` | **−44px** ✔ | +53px | 56.8% ✔ | **out of the 72-96px band** |

`?wbfit=ring` caps the ring at 56vh — derived from the measured 322px top edge, not guessed — and
the bomb keeps its share because every length in the ring is derived from `--wb-size`.
`?wbfit=prompt` helps the kill feed more but spends the fragment's hero scale to do it.

### One honest gap in the gate
The brief asks for "fuse strictly decreasing over 5 samples". That check is **not** in the gate and
is not faked with a passing assertion: against the backend mock the client's local turn clock does
not advance, so sampling the fuse five times measures the mock, not the fuse. It needs a real
server or a clock-controlled harness.

---

## 6b. THE STRUCTURAL CAUSE BEHIND MOST OF THE SQUINT FAILURES

The dialog inversion is not a one-off. It is an instance of something the value system does not
account for:

**The value ladder has a tier above `--v-accent` that it does not name: plain white.**

```
#ffffff                    19.88:1 on #0d0618      <- not in the system, used everywhere
--c-cream    #f0ead9       16.54:1
--c-yellow   #ffe94a       16.10:1
--c-cyan     #2effe0       15.62:1
--c-orange   #ff6b3d        7.03:1
--c-pink     #ff4fa3        6.53:1                 <- the DEFAULT accent
--c-red      #ff4b4b        6.02:1
--c-purple   #9a28ff        3.90:1
--v-panel    #160f28        ~1.2:1
--v-field    #0d0618         1.00
```

Twenty selectors across the component CSS paint `background: #fff` — inputs, secondary buttons,
chips. An accent element **cannot** be the loudest thing on a screen it shares with a white
surface: pink at 6.53:1 loses to white at 19.88:1 by a factor of three. The rule "exactly ONE
element carries `--v-accent`" is satisfied while the eye still lands somewhere else entirely.

This one fact explains three of the squint failures at once, and I checked each by eye against its
own screenshot rather than inferring them:

* **lobby** (4 regions, the worst on desktop) — the white NAME INPUT is the brightest thing on the
  panel; the pink CONTINUE button, which is the actual CTA, is third behind it and the mint
  PRIVATE toggle.
* **wb-dialog** (3 regions) — white JOIN WITH CODE beats orange PLAY.
* **blitz-dialog** (6 regions on a phone) — white JOIN WITH CODE, plus three selected pack rows in
  the same blue as PLAY.

So the actionable version of §7d is not "16 screens are busy". It is: **the accent tier is not the
top of the ladder, and until white is either brought into the system or taken off these surfaces,
no amount of accent discipline will make the CTA win.**

---

## 6a. THE DIALOG CTA IS INVERTED — AND THE SQUINT TEST AND THE CONTRAST AUDIT AGREE

Two independent methods land on the same rule, which is the strongest kind of finding this run
produced.

**From the contrast side:** `src/components/ModeDialog.css:404`

```css
.mode-dialog-btn-join {
  flex: 1;
  background: #fff;     /* <- white: 19.88:1 on #0d0618, the loudest value in the palette */
  border-color: #000;
}
```

PLAY takes the mode's own colour. For Word Bomb that is `#FF6B3D` at 7.03:1. So the SECONDARY
action carries 2.8x the contrast of the PRIMARY one. It affects the two MULTIPLAYER dialogs only:
`ModeDialog.jsx` renders JOIN WITH CODE in the create/join branch, so SAT Rush, Chain and Fuse get
a single PLAY button and are not affected. Word Bomb and Category Blitz are.

**From the squint side:** `wb-dialog` resolves into three regions of comparable weight — the mode
name, PLAY, and JOIN WITH CODE — where Phase 6's own spec says "START the only hot element".
`blitz-dialog` resolves into **six** on a phone: the AI JUDGED badge, three selected pack rows
that use the same blue as the PLAY button, PLAY itself, and the white JOIN WITH CODE.

**The fix is one rule, and the helper for it already exists and is unused.** `values.css` defines
`.v-demote` — panel ground, dimmed ink, rule-coloured border — as "what a secondary button looks
like after the audit", and no JSX in the repo applies it. `?dlgcta=demote` does exactly that to
JOIN WITH CODE. That single change also closes part of §1b's dead-helper finding.

**Measured, not eyeballed — and measuring it exposed a flaw in my own metric first.**
Scoring the variant in the squint test's default RELATIVE mode made it look WORSE (3 regions to 5),
which is an artifact: removing the loudest element drops the screen's peak from 0.954 to 0.597, and
because the cut is a fraction of the peak, the bar drops with it and dimmer things start to
qualify. Region counts are not comparable across variants when the peak moves. So the tool grew an
ABSOLUTE mode (`abs:0.572`) that pins both variants to the same bar:

| screen | today | `?dlgcta=demote` | what left |
|---|---|---|---|
| wb-dialog desktop | 2 regions (127, 77) | **1 region (77)** — PASS | the 127-cell region |
| wb-dialog phone | 3 regions (42, 9, 6) | 2 regions (9, 6) | the 42-cell region |
| blitz-dialog desktop | 3 regions (134, 132, 28) | 2 regions (132, 28) | the 134-cell region |
| blitz-dialog phone | 4 regions (47, 33, 16, 7) | 3 regions (33, 16, 7) | the 47-cell region |
| **lobby (control)** | 2 regions (93, 43) | **2 regions (93, 43)** | nothing — untouched |

In every dialog the demote removes exactly one hot region and it is the largest one, and the lobby
— which the change does not touch — is bit-for-bit identical, which is the control that says the
measurement is responding to the change rather than to noise. Across all 30 screen/viewport pairs:
16 pass / 8 busy before, 17 pass / 7 busy after. One screen improved, nothing regressed.

I built it rather than shipped it because it changes the look of both multiplayer dialogs, which is
yours. It is the smallest high-value change in this entire run: one CSS rule, a measured single-
region result on the dialog it most affects, and it puts the repo's own unused `.v-demote` helper
to work.

---

## 6c. THE LOBBY — I BUILT TWO FIXES AND NEITHER ONE WORKS

The lobby fails at all eight viewports. Measured on `#0d0618`, its four loud elements are:

```
.lobby-input              #fff        19.88:1     the name field
.lobby-toggle-btn.active  #2EFFE0     15.62:1     PRIVATE / PUBLIC
.lobby-back-btn           #2EFFE0     15.62:1     the back arrow
.lobby-continue-btn       --v-accent   6.53:1     <- THE CTA, and the DIMMEST of the four
```

Two variants, both behind flags, both measured on the same fixed bar:

| | desktop | phone |
|---|---|---|
| today | 2 regions | 2 regions |
| `?lobbycta=quiet` (demote the field too) | **0 regions — FLAT** | **0 — FLAT** |
| `?lobbycta=keepfield` (field stays white) | **1 region — PASS** | **1 — PASS** |

`keepfield` looks like a clean win. **It is not, and finding out why produced the single most
useful change to the harness.**

I made the squint test hit-test each region back in the live page and name the element it actually
covers. The answer:

```
lobby today       2 regions:  93 .lobby-input  +  43 .lobby-toggle-btn
lobby keepfield   1 region:   93 .lobby-input
```

**The surviving entry point is the NAME FIELD.** `.lobby-continue-btn` never reaches the bar in any
variant — pink at 6.53:1 is not close to the 0.572 L\* cut. `keepfield` passes a region COUNT while
the eye still lands on a text input. And `quiet` goes FLAT for the same underlying reason: once the
white field steps down there is nothing bright left, because the CTA was never bright.

So the honest result is negative, and it is more useful than a pass would have been:

* **Neither variant fixes the lobby**, and I am not proposing either.
* **A screen can pass a region count and still fail the design rule.** The tool now prints the
  element under every region, so this can never be mistaken again. Re-run against the dialogs, it
  confirms their two regions are literally `.mode-dialog-btn` and `.mode-dialog-btn` — PLAY and JOIN
  at 134 and 132 cells on Blitz desktop, two buttons of near-identical weight.
* **The real lobby fix is the §6b problem**: the CTA has to become genuinely loud, and a pink accent
  cannot out-value a white field. That is a palette decision, not a CSS tweak, so it stops here.

---

## 7. THE EXPERIMENTS — BUILT, SHOT, NOT SHIPPED

All three live behind URL flags on `feat/experiments`, and are inert without them. That is
deliberate: a side-by-side is only honest if both variants come out of the **same build**, because
two builds means anything else that drifted shows up in the comparison as if it were the thing
being judged. Every pair is one stitched, labelled PNG in `claude/x7/` for the same reason — two
separate files invite comparing them at different zoom levels on different days.

### 7a — Word Bomb danger escalation · `?x7a=1` · **my recommendation: ship it**
`claude/x7/7a-wb-d00.png`, `7a-wb-d50.png`, `7a-wb-d100.png`, `7a-wb-d100-phone.png`

The board's value band darkens and its one accent creeps `#FFE94A → #FF4B4B`, both interpolated per
channel on `--danger` — the eased 0..1 the timer **already** publishes. No new JS, no new timer, no
new state, so if it is not worth it there is nothing to unwind. The dim is a flat opacity-only
layer under the centre stage, so the bomb and the fragment keep full value while everything around
them sinks: the screen feeling the timer must not cost the player the two things they are reading.

It reads clearly at danger 1.0 — the opponent's avatar goes yellow to red and the whole periphery
steps back — and it is invisible at 0.0, which is what you want. Both ends of the accent creep
clear 4.5:1 on the field (yellow 16.10, red 6.02), so it never crosses the contrast floor.

**Budget note, stated rather than assumed:** a value-band shift is a paint, and the budget says
animate transform and opacity only. That rule is about per-frame work; `--danger` is written about
once a second, not per frame, so this repaints about as often as the numeral already does. The two
things that would be per-frame — a filter and a box-shadow — are deliberately not used.

**Getting these shots took three attempts and both failures are worth keeping.** First, the camera
fired during the 3-2-1 intro, where `BombVisual` pins its ratio to 1 regardless of the clock — so
the escalation got photographed at the one value where it does nothing. Second, after waiting the
countdown out, pushing a frame that says "4 seconds" also makes the turn 4 seconds long, because
`maxTimer` is read from the same `turn_update` — full ring, `--danger` 0, again. The shots now pin
`--danger` to a known point on the curve and are labelled with that value rather than a number of
seconds, which is both honest and a better experiment: three controlled samples instead of wherever
a racing clock happened to be.

### 7b — Chromatic Bungee lockup · `?x7b=1` · **buildable, but I would not ship it**
`claude/x7/7b-menu.png`, `7b-menu-phone.png`, per-layer breakdown in `claude/x7/zoom/`

**The finding that decides the design: Bungee Shade cannot be layered.** Measured at 96px,
"TYPE A WORD":

```
Bungee          664.72px
Bungee Inline   664.72px   identical
Bungee Outline  664.72px   identical
Bungee Shade    770.31px   +105.59px  (+15.9%)
```

Bungee, Inline and Outline are metrically identical and stack perfectly. Shade bakes its 3D offset
into every glyph's ADVANCE, gaining ~9.6px per character, so its letters walk steadily away from
the others. The drift is cumulative per character, so no single transform corrects it. The first
build of this prototype shipped visibly doubled letters because I assumed otherwise. The depth
Shade used to supply now comes from a hard offset copy of the solid face in black — the house idiom
anyway.

Second defect, also measured: **`-webkit-text-stroke` is inherited.** `.homepage-logo` sets
`5px #000`, every layer span inherited it, and all four painted as a 5px black keyline — the lockup
came out almost solid black with the pink and yellow buried under their own outlines. Zeroing it on
the parent is not enough; inheritance hands the computed value down, so each layer must clear it.

The layers now register exactly — all four measure 507.4px in situ.

**Unresolved, and I am flagging it rather than papering over it:** in place, the lockup paints at
roughly a quarter of its nominal colour. A pure-white probe inside `.homepage-logo` comes back at
rgb(69,66,73). I localised it to the `.homepage-stage` subtree — an identical probe one level up in
`.homepage-wrap` is full brightness — and ruled out opacity, filter, mix-blend-mode,
backdrop-filter, mask, `isolation`, the wall overlay layers, and `-webkit-text-fill-color`
inheritance. I did not find the cause inside the time I gave it. It applies to **both** variants
equally — today's wordmark is just as dark in the same capture — so the side-by-side is still a
fair comparison of the two, and it is the same effect §7d measures independently as the menu's low
peak. It may be one finding, not two.

**The argument against shipping, independent of any of that:** it needs two more woff2 files on the
critical path for the largest, earliest-painted element on the site. That is a real cost for a
paint change.

### 7c — Per-mode background motifs · `?x7c=1` · **the idea is already proven in the codebase**
`claude/x7/7c-wb.png`, `7c-blitz.png`, `7c-wb-phone.png`

Five silhouettes authored as real vector assets in `public/art/motif/` — blast, brain, gavel,
chain, fuse cord — generated by `claude/_tools/gen-motifs.mjs` with a seeded PRNG so the blast's
spikes and the fuse's spark have deliberate asymmetry rather than machine-perfect symmetry. They
are used as CSS **masks**, not images, so the mode script supplies the colour and one asset serves
every hue. Anchored to a corner and bled off two edges so the text column always runs over flat
ground, and static — a drifting motif would be an idle loop, which the menu motion law and the
animation budget both forbid.

**The strongest evidence is that you already shipped this.** CHAIN and FUSE have had per-mode
static motifs at `opacity: .07` since before this run (`ChainGame.jsx` `CHAIN_MOTIF`,
`FuseGame.jsx` `FUSE_MOTIF`, styled by `.solo-motif`). So the open question is not whether the idea
works — it is only whether it survives on the busier multiplayer boards, which is exactly what the
WB and Blitz shots are for. I matched the existing 7% rather than inventing a new number.

### 7d — THE SQUINT TEST · **the value-grouping gate, made real**
`claude/_tools/squint.mjs`, output + blurred renders in `claude/squint/v2/`

Render every screen, blur it 12px until every glyph and edge is gone, and count how many regions
still pull away from the page's own ground. One region means the eye has an entry point.

**Three method choices, because the threshold IS the test:**
* **CIE L\*, not linear luminance.** Relative luminance crushes everything dark into the bottom 1%
  of its range, so on a `#0d0618` page a hot pink accent and a mid panel look almost equally "not
  white", and the test only ever flags white text.
* **Deviation from the page's MODAL lightness.** SAT Rush is a cream page where the hot thing is
  near-black ink; every other screen is dark where the hot thing is bright. `|L* − L*_mode|` is the
  one measure that reads both.
* **Relative dominance, not an absolute cut — and I got this wrong first.** I set an absolute hot
  line at L\* deviation 0.45 and the menu came back FLAT, no hot region at all, which is plainly
  false. Sampling the histogram showed why: the brightest cell anywhere on the blurred menu reaches
  L\* **0.442**. A 12px blur mixes every bright shape with its own black outline, so nothing on a
  Newgrounds-dark page survives an absolute 0.45 and nearly everything on cream would. The line is
  now drawn at a fraction of each screen's **own** peak: hot = within 40% of the loudest thing
  present. That asks the right question — "is there ONE winner, or several things equally loud?" —
  and asks it identically on cream and on black.

**Run across EIGHT viewports** — 2560x1440, 1920x1080, 1440x900, 1366x768, 1280x720, 1163x501,
390x844, 360x640 — because value grouping is a composition property and composition changes with
the shape of the box. 120 screen/viewport pairs: **56 pass / 64 busy.**

The per-screen view is the one that matters, and it says something much stronger than a raw count:

| screen | passes | busy at (region count) |
|---|---|---|
| shop | **8/8** | — |
| stats | **8/8** | — |
| collection | **8/8** | — |
| wb-play | **8/8** | — |
| blitz-play | **8/8** | — |
| sat-play | **8/8** | — |
| chain-death | 3/8 | worse as the screen GROWS: 5 regions @2560, 2 @1366 |
| menu | 2/8 | 2-3 regions everywhere except the two largest sizes |
| rooms-browser | 2/8 | 2 regions at six of eight |
| wb-gameover | 1/8 | worse as the screen GROWS: 4 @2560-1440, 3 below |
| **wb-dialog** | **0/8** | 2-3 regions at every single size |
| **blitz-dialog** | **0/8** | 3 everywhere on desktop, **6 at 390x844**, 5 at 360x640 |
| **lobby** | **0/8** | 4 regions at five of eight sizes |
| **chain-play** | **0/8** | 3 regions at every single size |
| **fuse-play** | **0/8** | 3 regions at seven of eight |

**The headline is that the failures are not responsive, they are structural.** Five screens fail at
every size tested. No amount of breakpoint work will fix a screen that has three entry points at
360px and three at 2560px — the composition has three entry points.

Six screens are clean at every size, which is the other half of the result and worth saying: the
value system demonstrably works where it is applied. Shop, stats, collection and all three play
screens hold one entry point from a phone to a 4K monitor.

Two further things worth acting on:
1. **The two game-over screens get WORSE as the display grows** (chain-death 2 regions at 1366x768,
   5 at 2560x1440; wb-gameover 3 and 4). At small sizes the summary elements merge under the blur
   into one mass; as the screen grows they separate and start competing. A max-width on the summary
   grid would hold the small-screen composition at every size.
2. **`sat-play` passes on a technicality.** One region, but it is 1209 cells — 16.7% of the screen
   at 1366x768 and 34.3% at 390x844. That is one enormous hot area, not a focal point. The test
   counts regions, not their share; a share cap is the obvious next iteration.

---

## 5. PHASE 5 — FOUR OF FIVE SCREENS

Blitz, SAT Rush, Chain and Fuse shipped (`1689427`). **THE RUN did not**, and could not: this stack
is off `release/prod-1`, which has five modes in `gameData.js` and no `src/run/`. The Run lives on
`integration/run-stack-3`, which is unmerged. The Run's colour script (`#9A28FF` + `#FF4B4B`) in
Phase 3 has nothing to apply to here either. Doing that work means either merging the run stack
first or rebasing a Phase 5b onto it — your call which.

---

## THINGS I FOUND AND COULD NOT FIX

1. **The 7b in-situ dimming**, §7b. Localised to `.homepage-stage`, cause not isolated.
2. **The kill feed below the fold at 3+ players**, §2(ii). Neither WB fit option clears it.
3. **The fuse-strictly-decreasing check**, §2. Not expressible against the backend mock, and left
   absent rather than written as an assertion that would always pass.
4. **`--mode-lead` / `--mode-second` are dead tokens**, §3. Wiring every screen to consume them
   instead of its hardcoded copy is a pass across six modes' CSS, not a one-liner, and nothing
   looks wrong today — so it is reported rather than half-done.
5. **Three screens carry no accent element**, §1b, and the test that guards the rule cannot see it.
6. **This box's e2e flakiness is real and it is not the code.** Re-running the three specs that
   carried the previous gate's failures gave **843 passed / 0 failed / 4 flaky** — and the four
   flakes were *different tests* from the previous run's four. All five of the earlier run's
   problem tests now pass, including `wb-short-layout @ 1280x720`. Treat any single flaky list as
   noise; treat a test that fails twice on different runs as real.

---

## BLOCK STATE — CHECKED AGAINST ORIGIN, NO REWRITE NEEDED

`typeaword-block-state.md` lives on `docs/block-state-4` (`a902149`). It states it was refreshed on
2026-09-10 against `main @ d4c40c3`.

Checked rather than assumed:

* `git fetch origin` then `git rev-parse origin/main` -> **`d4c40c3`**. `git rev-list --count
  d4c40c3..origin/main` -> **0**. Main has not moved since the doc was written.
* Its most drift-prone number still holds: it claims "1090 tests in 48 spec files", and
  `git ls-tree -r origin/main e2e` counts **48** spec files today.

So the doc is current against origin and a rewrite would have been churn. What a returning reader
needs ON TOP of it is this file, and specifically: §2 (the WB ring's measured state), §1b and §6b
(the accent tier is not the top of the value ladder), §3 (the colour scripts are declared twice,
not consumed), and the gate note — which independently confirms the doc's own warning that a gate
run on this 2-vCPU box must not overlap with anything else. It was right, and I proved it the
hard way.

---

## TOOLS LEFT BEHIND (all on `feat/experiments`, under `claude/_tools/`)

| tool | what it does |
|---|---|
| `squint.mjs` | the value-grouping gate: blur every screen, count regions that still pop |
| `wb-ring-gate.mjs` | Phase 2's acceptance, measured — 4 player counts × 3 viewports × 3 variants |
| `wb-rows.mjs` | prints what actually consumes the WB stage's height, row by row |
| `x-shots.mjs` | captures both variants of an experiment from one build and stitches them |
| `x7b-zoom.mjs` | tight wordmark shots plus a per-layer breakdown |
| `bungee-metrics.mjs` | measures whether font layers register before you try to stack them |
| `gen-motifs.mjs` | authors the five motif SVGs |
| `contrast-audit.mjs` | re-derives every claimed contrast ratio and prints the accent map |

Two of these carry a lesson in their comments that cost real time to learn: `x7b-zoom.mjs` uses
`page.screenshot({clip})` rather than `el.screenshot()`, because an element screenshot came back
uniformly ~27% darker than the same pixels in a page capture and made a working lockup look
broken; and `bungee-metrics.mjs` waits for the stylesheet `onload` before calling
`document.fonts.load`, because the `@font-face` rules do not exist until the sheet lands and
measuring early silently returns the fallback for every face — which makes all four fonts look
identical, the exact opposite of the true answer.

---

## GATE

**`npm run gate` on `feat/shell-screens` (the tip): lint 0 errors, 517/517 unit, e2e 1117 passed /
10 failed.** All ten failures re-ran clean: `24 passed (47.8s)` on the four affected spec files
with `--retries=2` on an otherwise idle machine.

The ten were:

```
corner-click       REBIRTH @1280x640, SHOP @1568x675, STATS @1568x675
intro              a first visit loads through the full intro to the menu
mode-screens       CHAIN @390x844, FUSE @1366x768, FUSE @390x844
parity-wb-blitz    WB combo builds/resets, WB combo resets on life lost, Blitz combo builds/resets
```

**I caused most of that contention and will not pretend otherwise.** `npm run gate` runs two
workers on a 2-vCPU box, and I ran the contrast audit, several greps and a branch switch while it
was in flight. That is exactly the condition the memory note about this machine describes.

Two of the ten are worth a second look anyway, because their failure mode was *specific* rather
than a timeout — and chasing them is what produced the Phase 3 correction in §3:

* `CHAIN @390x844` failed with `seam = null`, not a wrong colour — the element was absent at the
  moment of measurement. On the clean run it read `rgb(255, 107, 61)`.
* Both FUSE tests logged `cord undefinedpx below the input`, i.e. `.fuse-line` was missing when the
  geometry was read. It is rendered by `SoloShell.jsx:51`, and on the clean run measured 14px and
  15px below the input, burning `0.976 -> 0.832`. The read happens BEFORE the keystroke that arms
  the clock, so if that element only mounts once armed, this test is timing-sensitive by
  construction. Worth hardening (wait for `.fuse-line` before measuring) rather than re-running.

**The honest summary: the tip is green, on a quiet machine, and this box cannot give a trustworthy
single-run verdict.** Treat any one flaky list as noise; treat a test that fails on two independent
runs as real. Nothing failed twice.
