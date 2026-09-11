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

**3. Three screens are genuinely contested at EVERY viewport. §7d**
The value-grouping gate, made real, run over 8 viewports x 15 screens, then re-scored on region
DOMINANCE after a raw region count over-reported (I withdrew a claim about CHAIN/FUSE doing this).
The two mode dialogs and the lobby have no dominant element at any size — and the dialogs' two
loudest regions are *exactly the same size* (ratio 1.00 and 1.02): PLAY and JOIN WITH CODE, tied.
Six screens pass 8/8, which is the other half: the system works where it is applied.

**4. Three look experiments are built and shot side by side. Nothing is merged. §7**
7a danger escalation — works, reads clearly, and is the one I'd argue for.
7b chromatic Bungee lockup — buildable, but only after throwing Bungee Shade out of it, and it
still renders wrong in place (§7b, honestly unresolved).
7c per-mode motifs — built for all five modes, and the finding is that at the brief's 6-10% they
are INVISIBLE on the dark multiplayer boards: measured pixel delta 1/255. `?x7c=2` at 18% exists
only so the idea can be judged at all.

**5. The menu's entry point is the ROOKIE rank chip. §7d**
Not the wordmark, not the spotlit card — `.menu-xp-rank` at every desktop size, and `.menu-xp-bar`
on a phone. The whole XP strip is the loudest thing on the menu.

The menu is also the dimmest of the shell screens by a distance: its peak reaches L\* **0.471**,
against 0.82–0.96 for every other shell screen, and only **0.227** at 360x640. (It is not the
dimmest screen in the game — CHAIN and FUSE play are lower still, at 0.28 and 0.30. I claimed the
menu was the dimmest earlier in this run and that was wrong.) The wordmark is Bungee Shade under a
5px black stroke, which eats most of each letter; that is the canonical title spec and CLAUDE.md
locks it, so it is your call, not a bug I should fix.

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
| `feat/experiments` | `67dff18` | P7 prototypes + the measuring tools. **NEVER MERGE.** | pushed |

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

### 7c — Per-mode background motifs · `?x7c=1` (per brief) / `?x7c=2` (judgeable)
`claude/x7/7c-wb.png`, `7c-blitz.png`, `7c-wb-phone.png`, **`7c-wb-strong.png`**, `7c-blitz-strong.png`

Five silhouettes authored as real vector assets in `public/art/motif/` — blast, brain, gavel,
chain, fuse cord — generated by `claude/_tools/gen-motifs.mjs` with a seeded PRNG so the blast's
spikes and the fuse's spark have deliberate asymmetry rather than machine-perfect symmetry. Used as
CSS **masks**, not images, so the mode script supplies the colour and one asset serves every hue.
Anchored to a corner, bled off two edges so the text column always runs over flat ground, and
static — a drifting motif would be an idle loop, which the menu motion law and the animation budget
both forbid.

**The result is the finding: at the opacity the brief specifies, it is invisible.**

The first two runs of this experiment produced side-by-side shots with no visible difference at
all, and I nearly reported "it adds nothing". Two causes, both found by probing rather than
squinting at a PNG:

1. **It was mounted outside `.game-stage`**, which carries an opaque `#1a0b2e` background — so it
   was painted over completely. Fixed by mounting it as the stage's first child, which is exactly
   what CHAIN and FUSE already do with `.solo-motif`.
2. **Even mounted correctly, 8% does not register on these boards.** Sampling the same 240x200
   block of the Word Bomb stage with the motif shown and hidden gives a mean pixel delta of
   **1 / 255** in R and G. The element is present, masked, sized 476x476 and positioned correctly —
   it just does not survive against `#1a0b2e`.

So `?x7c=2` exists at **18%**, deliberately outside the brief's 6-10% band, purely so the IDEA can
be judged. `7c-wb-strong.png` puts 8% and 18% side by side and the difference is the whole point:
at 8% there is nothing to decide on.

**What I would take from it:** the 6-10% band is calibrated for CHAIN and FUSE, which already ship
this at `opacity: .07` on a lighter `.solo-stage`. On the darker multiplayer boards the same number
buys nothing. If you want motifs on Word Bomb and Blitz, the band has to move or the boards do —
that is the decision, and it is not one I should make.
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
the shape of the box. 120 screen/viewport pairs.

### The harness was wrong twice, and catching it is most of the value

**First correction — a raw region COUNT over-reports.** Word Bomb's game-over screen scored 4
regions at 2560x1440, but they were **175, 60, 9 and 7** cells. One region seventeen to twenty-five
times the size of the specks beside it is not four entry points; it is one entry point and some
chips. So the score is now **DOMINANCE**: the ratio of the largest hot region to the next largest.
Above ~4x the eye still has one place to land.

**Second correction — three screens were not the screens I thought.** Making the harness name the
element under each region immediately showed that `wb-play` and `blitz-play` were scoring a clean
8/8 on `.countdown-overlay` — they were measuring the 3-2-1 intro, not the board — and `sat-play`
was measuring `.sr-modecards`, the mode picker. Three of six "clean" screens were the wrong screen.
The reaches now wait for the intro to mount AND clear and for the board to be genuinely playable.

### The result, after both corrections

| screen | single | dominant | contested | what the eye actually lands on | worst pair |
|---|---|---|---|---|---|
| shop | 8 | — | 0 | `.shop-back` | — |
| stats | 8 | — | 0 | `.stats-back` | — |
| collection | 8 | — | 0 | `.stats-back` | — |
| wb-play | — | — | — | **`.game-input`** | — |
| blitz-play | — | — | — | **`.game-input`** | — |
| chain-play | 0 | 6 | 2 | `.solo-input` | `.solo-input` vs `.wins-hud-label` (2.95) |
| fuse-play | 0 | 6 | 2 | `.solo-sill` | `.solo-input` vs `.wins-hud-label` (3.50) |
| chain-death | 3 | 3 | 2 | `.solo-restart` | `.solo-restart` vs `.solo-deathcard` (3.74) |
| wb-gameover | 1 | 5 | 2 | `.game-over-rematch` | `.game-over-rematch` vs `.share-btn` (2.92) |
| menu | 2 | 1 | 5 | **`.menu-xp-rank`** | `.menu-xp-rank` vs `.menu-xp-cluster` (1.46) |
| rooms-browser | 2 | 0 | 6 | `.browser-name-input` | `.browser-name-input` vs `.browser-code-input` (1.30) |
| **lobby** | 0 | 0 | **8/8** | `.lobby-input` | `.lobby-input` vs `.lobby-toggle-btn` (1.84) |
| **wb-dialog** | 0 | 0 | **8/8** | `.mode-dialog-btn` | `.mode-dialog-btn` vs `.mode-dialog-btn` (**1.02**) |
| **blitz-dialog** | 0 | 0 | **8/8** | `.mode-dialog-btn` | `.mode-dialog-btn` vs `.mode-dialog-btn` (**1.00**) |

Four things fall out of it.

**1. The dialogs are the worst thing measured in this run, by a distance.** Dominance **1.00 and
1.02** means the two loudest regions are *exactly the same size*, and the tool names them both as
`.mode-dialog-btn`: PLAY and JOIN WITH CODE, tied. That is the same defect §6a found from the
contrast side and §6b explained structurally, reached from a third direction.

**2. On every play screen the eye lands on the TEXT INPUT.** `wb-play` and `blitz-play` resolve to
one region and it is `.game-input`; chain and fuse the same. This is a direct, measured miss against
Phase 2's own spec, which says the fragment is "the brightest text on screen". As a colour claim
that is true — the fragment is `#FFE94A`, 16.10:1. As a COMPOSITION claim it is false: the fragment
carries a 4px black stroke that eats most of each glyph, while `.game-input` is a large solid white
block at 19.88:1. Stroked yellow text loses to a solid white rectangle under a blur, and to the eye.

**3. The white-surface problem of §6b is now measured on SIX screens**, not three: lobby,
rooms-browser, chain-play, fuse-play, wb-play and blitz-play all resolve to a white input as their
hottest element.

**4. The menu's entry point is the ROOKIE rank chip** (`.menu-xp-rank`) at every desktop size, and
`.menu-xp-bar` on a phone — never the wordmark and never the spotlit card. With the menu's peak at
L\* 0.471 against 0.82-0.96 for the other shell screens (and 0.227 at 360x640), that is the
clearest available statement of why the menu reads flat: the loudest thing on it is a progress
chip, and even that is dim.

Good news worth stating: **shop, stats, collection, wb-gameover and chain-death all resolve to a
single dominant element, and on the two end screens it is the right one** — `.game-over-rematch`
and `.solo-restart`, the primary CTAs. Those screens work.

### The SAT play screen, finally reached

`sat-play` scored a clean 8/8 for two runs on `.sr-modecards` — the MODE PICKER. The reach was
clicking `.sr-modeselect .sr-mode`, a selector that does not exist; the real classes are
`.sr-modecards` / `.sr-modecard`, so it never got past the gate and quietly measured the gate. The
reach now advances cover -> picker -> briefing -> play and **throws** if the play surface never
appears, rather than photographing whatever is on screen.

What the actual SAT play screen measures:

| view | ground | regions | dominance | the region |
|---|---|---|---|---|
| 1366x768 | 0.063 (dark) | 2 | **147x** | **4117 cells — `.sr-fieldbody`, 57.3% of the screen** |
| 390x844 | 0.912 (cream) | 1 | — | 449 cells — `.sr-fields`, 20.3% |

It passes on dominance, overwhelmingly — but the "entry point" is 57% of the display. That is not a
focal point, it is a page. It also shows the duotone doing exactly what it should: on a phone the
paper fills the viewport so the page's own GROUND is cream (0.912) and the ink reads against it; on
desktop the card sits on a dark board, the ground is dark (0.063), and the whole card becomes one
hot region.

This is the clearest argument for the next iteration of the harness: **cap a region's SHARE of the
screen**, not just count regions. One region covering more than roughly a third of the display
should not score as "the eye has one place to land".

---

## 5b. PHASE 5 — SAT RUSH'S DUOTONE HOLDS, WITH ONE 0.05 MISS

Phase 5's SAT item: "full duotone — cream + ONE near-black ink ... Definition text must hit 4.5:1
on cream (near-black, not mid-grey)."

Verified by measurement, not by reading the CSS:

```
--ink    #111     on --paper #f0ead9   15.71:1    the definition text. Passes, comfortably.
--paper  #f0ead9  on --ink   #111      15.71:1    the negative reprint. Passes.
--redink #C8321E  on --paper #f0ead9    4.45:1    <- 0.05 BELOW the 4.5 body floor
```

There are no mid-greys used as text anywhere in `SatRush.css` — the mode really is a duotone, and
the definition text really is near-black. That item is done.

The `--redink` miss is small and specific. It is used in two places: `.sr-cover-ex-answer` at
`--fs-panel` (20-28px), which counts as LARGE text and only needs 3:1 — fine — and `.sr-cover-pay b`
at `--fs-body`, which clamps at **18px**. WCAG's large-text threshold for bold is 18.66px, so that
one is body text and needs 4.5:1. It has 4.446:1.

**The fix is two characters: `#C8321E` -> `#C6321E` gives 4.509:1** and is visually
indistinguishable (a 1% darken at the same hue). I have NOT applied it — `--redink #C8321E` is
sanctioned by name in DESIGN.md's SAT sub-style, so changing it is a design-doc decision, not a
bug fix.

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
