# will-change audit — chore/willchange-audit — 2026-08-27 (REPORT ONLY)

**Bottom line:** the "will-change on exactly 2 elements site-wide" rule is fiction. There are **35
declarations** (0 inline JS), and **no build test enforces it — none was ever written** (grep of every
`*.test.js` / `*.spec.js` in `src`, `e2e`, `scripts` returns nothing). The total count was never the
right metric anyway. The number that matters — **concurrent layers on one screen** — is worst on the
**menu at ~58**, dominated by two things introduced/kept without scrutiny: 32 idle particle-shard
layers and 20 game-card layers.

## Every declaration, grouped by chunk

### Entry chunk `index-*.css` — 20 (ships on EVERY screen; the old count would have looked here)
| file:line | props | selector | screen it's for |
|---|---|---|---|
| GameCard.css:15 | transform | `.game-card-wrap` | menu (per card) |
| GameCard.css:27 | transform | `.game-card-magnet` | menu (per card) |
| GameCard.css:84 | transform, **box-shadow** | `.game-card` | menu (per card) |
| GameCard.css:188 | opacity | `.game-card::after` | menu (per card) |
| Homepage.css:303 | transform | `.homepage-logo` | menu |
| Homepage.css:512 | transform | `.homepage-btn-magnet` | menu |
| Homepage.css:571 | transform, **border-color** | `.homepage-btn` | menu |
| Homepage.css:760 | opacity | `.homepage-beat-glow` | menu |
| MenuXp.css:243 | transform, opacity | `.menu-xp-shard` | menu (×32 pooled) |
| ModeDialog.css:67 | transform, opacity | `.mode-dialog-shell` | menu dialog (1, transient) |
| WallScene.css:243 | transform | `.wall-scene.parallax-on .wall-parallax-layer` | menu (gated on parallax-on) |
| SplashScreen.css:252 | transform, opacity | `.splash-spark` | splash (per particle) |
| SplashScreen.css:276 | transform, opacity | `.splash-ember` | splash (per particle) |
| TransitionIntro.css:82 | transform | `.intro-tilt` | boot intro (transient) |
| TransitionIntro.css:94 | transform | `.intro-breathe` | boot intro (transient) |
| TransitionIntro.css:209 | transform | `.intro-line` | boot intro (transient) |
| TransitionIntro.css:221 | transform, opacity | `.intro-letter` | boot intro (per letter, transient) |
| KnifeSplit.css:40 | transform | `.knife-cover` | boot intro (transient) |
| KnifeSplit.css:173 | transform | `.knife-blade` | boot intro (transient) |
| KnifeSplit.css:225 | transform | `.knife-head` | boot intro (transient) |

### `GameScreen-*.css` (lazy — loaded entering Word Bomb / Blitz) — 12
| file:line | props | selector |
|---|---|---|
| GameScreen.css:96 | transform | `.game-stage.boom-shake` (transient) |
| GameScreen.css:334 | **box-shadow** | `.game-player-card` (per player) |
| GameScreen.css:832 | transform, opacity | `.submit-letter` (transient) |
| GameScreen.css:1065 | opacity, transform | `.wb-danger-vignette` (tension state) |
| GameScreen.css:1093 | opacity | `.wb-lastlife-vignette` (tension state) |
| GameScreen.css:1163 | opacity, transform | `.wb-tension-vignette` (tension state) |
| GameScreen.css:1238 | transform, opacity | `.wb-tension-getout` (tension state) |
| GameScreen.css:1319 | transform | `.bomb-flight-icon` (transient) |
| GameScreen.css:3497 | transform | `.bomb-vignette` |
| GameScreen.css:3519 | transform, **text-shadow** | `.cb-category-display` (Blitz) |
| SprayReveal.css:48 | **--spray-pos** (custom prop) | `.spray-reveal` |
| SprayReveal.css:67 | opacity | `.spray-reveal` |

### `RoomScreen-*.css` (lazy) — 2
| RoomScreen.css:46 | **text-shadow** | `.room-code` |
| RoomScreen.css:95 | **box-shadow** | `.room-player-chip` (per chip) |

### `SoloShell-*.css` (lazy — CHAIN/FUSE) — 1
| Solo.css:301 | transform, opacity | `.solo-fx-glyph` |

Chunk totals: **entry 20 · GameScreen 12 · RoomScreen 2 · SoloShell 1 = 35.**

## The number that matters: concurrent will-change LAYERS on one screen
`will-change` promotes an element to a compositor layer for as long as it EXISTS, not just while it
animates — so "active" = present-and-will-change'd. Per screen:

| screen | concurrent will-change layers | breakdown |
|---|---|---|
| **MENU** (the default landing) | **~58** | **32** `.menu-xp-shard` (idle, always in DOM) + **20** game-card layers (5 cards × 4 nested: wrap/magnet/card/::after) + ~6 homepage (logo/2 CTAs/beat-glow). +1 dialog / +parallax when active. |
| Word Bomb game | ~5–10 | player-cards (2–8) + 1–2 tension vignettes (states are near-exclusive) + bomb-vignette; the rest (submit-letter, boom-shake, bomb-flight) are transient one-offs. |
| Boot intro | ~10–20 (transient, ~2.5s) | `.intro-letter` per letter + knife-split parts; gone once the menu settles. |
| Splash | a handful | spark/ember particles. |
| Room | 1 + per chip | `.room-code` + `.room-player-chip` × players. |
| CHAIN/FUSE | ~1–few | `.solo-fx-glyph`. |

**The menu is ~29× the "2" rule, and it's the screen everyone sees first.**

## Findings that matter
1. **No enforcement ever existed.** There is no will-change build test anywhere in the repo. The doc's
   "a build test was supposed to enforce it" describes something never written — so 35 declarations
   accrued with zero signal.
2. **32 idle shard layers on the menu** (`.menu-xp-shard`, MenuXp.css:243 — added in feat/purchase-feel
   §1). The pool's 32 nodes sit at `opacity:0` at rest but each still gets a persistent compositor layer.
   `will-change` should be set per-SPAWN and dropped on finish, not statically on idle pooled nodes.
   Removing it here alone takes the menu from ~58 → ~26.
3. **7 declarations target non-composited properties** — `will-change` on these is a no-op the browser
   can't act on (box-shadow/text-shadow/border-color/custom-props don't composite):
   GameCard.css:84 (box-shadow), GameScreen.css:334 (box-shadow), GameScreen.css:3519 (text-shadow),
   Homepage.css:571 (border-color), RoomScreen.css:46 (text-shadow), RoomScreen.css:95 (box-shadow),
   SprayReveal.css:48 (`--spray-pos`). Pure waste (or a hint to promote a layer that then repaints anyway).
4. **20 game-card layers on the menu** — 4 nested will-change'd elements per card × 5 cards. The cards do
   animate (beat pulse, magnetic tilt, hover), so *some* promotion is justified, but 4 stacked layers
   per card is heavy for a 5-card grid.

## Recommendation — REVISE (don't keep the "2", don't blanket-retire)
`will-change` is **not** like the animation-count budget. Concurrent composited *work* scales; concurrent
*layers* do not — each is GPU memory, and layer count has a real ceiling on low-end mobile (the exact
device class this game targets on school Chromebooks/phones). So retiring it with no guidance is riskier
than retiring the animation count was.

**Retire the fictional "exactly 2 site-wide" number**, and replace it with a rule that's both meaningful
AND statically enforceable:

- **RULE (build-failing, easy to enforce):** `will-change` may only list **transform** and/or **opacity**.
  Any other property (box-shadow/text-shadow/border-color/filter/custom-prop) is a lint error — a grep-
  level CSS test catches all 7 offenders above today. This is the will-change analogue of "transform/
  opacity only" already in the ANIMATION BUDGET.
- **RULE (review/lint, harder to auto-enforce):** never `will-change` an idle / pooled / always-present
  element. Toggle it on at animation start and off at finish (or scope it to the active state class).
  Fixes the 32 shard layers.
- **METRIC (advisory, not build-failing):** track the **per-screen concurrent layer count**, not the
  repo total. Flag any screen over ~a dozen for review. The menu (~58) is the one to investigate now;
  the two quick wins (drop idle-shard will-change −32, reconsider 4-layers-per-card −~10) bring it to
  ~16 without touching anything that actually animates.

In one line: **keep a will-change discipline, but make it "composited-props-only + never-on-idle-nodes +
per-screen-advisory", and delete the "2".** The "2" was never true and was never enforced; a per-screen
layer budget is the honest version of the same intent.
