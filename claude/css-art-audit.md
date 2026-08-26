# CSS-Art Audit — wordarcade-frontend

**Date:** 2026-08-26 · **Branch:** chore/css-art-audit · **Scope:** report-only, no code changed.

**What this checks:** places the UI draws ART with CSS (shapes from borders/gradients/
pseudo-elements, hand-rolled icons, starbursts, padlocks, glyphs-as-art, decorative flourishes)
instead of using a real vector/PNG asset. Per the new ART VS MOTION rule.

**Excluded** (not art): rectangles, circles, borders-as-borders, XP-bar notches, lighting/vignette
effects, effect particles, emoji-as-content, real `<svg>`/`<img>` assets, and UI affordances
(buttons, inputs, close ✕, back arrows, focus rings, scrollbars).

---

## Headline

**This codebase is unusually clean on this axis.** Almost every actual *illustration* is already
a real asset: the game-card backgrounds (`GameArt.jsx`), badge icons (`GameIcons.jsx`), wall
stickers/splatters/graffiti (`decor/*.jsx`), the mascot (`mascot-*.png`), the padlock
(`LockedPreviewDialog.jsx:49`), the wall pipe/crack (`WallScene.jsx:213-225`), and both starbursts
(`SplashScreen.jsx:158`, `ModeDialogBackground.jsx`) are all inline SVG or PNG. What remains as
genuine CSS-art is mostly **textures, type treatments, and effect layers** — not crude
illustrations. Only three items are worth an asset-swap conversation, and all three are low-priority.

---

## Findings, ranked by player visibility

### 1. WallScene "spray tag" panel — persistent, every screen — VERDICT: leave it (good)
- `src/components/wall-system.css:85-126` (`.wall-tag-panel`)
- Draws: a torn/sprayed dark paint patch behind menu controls — `clip-path` jagged polygon +
  radial-gradient fill + `feTurbulence` paper-noise (`::before`) + overspray dots (`::after`),
  tilted −0.7deg.
- Honest read: **actually good.** This is craft, not crude — the torn clip + grain sell it. The
  one CSS-art piece doing real illustrative work.
- Replace: leave it. An SVG could do it but this is convincing and tunable.

### 2. Halftone dot texture — persistent, every screen — VERDICT: leave it (correct technique)
- `src/components/WallScene.css:133-144` (`.wall-halftone`); also `SplashScreen.css:203`,
  `GameScreen.css:64,2994`, `CreditsScreen.css:19`, and SAT Rush surfaces.
- Draws: Ben-Day dots via `radial-gradient(circle, … 0.8px)` tiled at 12px, opacity ~0.05.
- Honest read: fine — the standard, resolution-independent way to do halftone. Subliminal at 0.05.
- Replace: leave it. A PNG tile would be *worse* (fixed DPI).

### 3. WallScene "handstyle" extrude + paint-drip rects — persistent — VERDICT: drips are the weakest
- `wall-system.css:154-159` (`.wall-handstyle`): faux-3D extrude via stacked hard `text-shadow`.
  Passable sticker-type trick — leave it.
- `WallScene.css:62-66` + `WallScene.jsx:327-339` (`.wall-paint-drip`): the five "dried drips" are
  literally thin colored `<div>` rectangles with `border-radius: 0 0 3px 3px`.
- Honest read: **the crudest CSS-art here** — just rounded-bottom bars pretending to be drips.
  Saved only by opacity 0.10–0.14 behind content, so nearly invisible in practice.
- Replace: **minor SVG teardrop/streak drips** would look better. Low priority (opacity hides it).

### 4. Homepage CREATE/JOIN button starburst — main menu — VERDICT: optional swap
- `src/components/Homepage.css:580-611` (`.homepage-btn::before`)
- Draws: a spiky star behind each primary button via a 12-point `clip-path: polygon(...)`, fading
  to 0.2 on hover.
- Honest read: passable but a touch generic — the classic "CSS starburst." Fine at low opacity.
- Replace: optional. An SVG spike-burst would be crisper and easier to shape.

### 5. Splash chromatic-split wordmark — first screen — VERDICT: leave it (tasteful)
- `SplashScreen.css:74-109` (`.splash-logo::before/::after`): cyan/pink RGB-split ghost clones via
  `attr(data-text)`, screen-blended, drifting ±2px.
- Honest read: fine — deliberate retro chromatic aberration on *text*, not an illustration.
- Note: the homepage copy of this trick (`Homepage.css:331`) is `display:none` — **dead code**,
  could be removed.

### 6. GameCard beat/glitch/screentone layers — menu cards — VERDICT: leave (effect/texture)
- `GameCard.css:153-243`: beat-glow (box-shadow/opacity lighting — excluded), `::before` RGB-split
  glitch fringe (brief effect, fine), sat-rush radial-gradient screentone plate on beat.
- Honest read: all effect/texture, well done.

### 7. SAT Rush in-game manga CSS — whole SAT screen — VERDICT: INTENTIONAL STYLE, leave it
- `src/satRush/SatRush.css` throughout: screentone vars `:37-39`, pulp grain `::before:101-108`,
  triangle halftone corner `::after:112-124`, tonal drop-shadow behind glyphs via
  `background-clip:text` `.sr-print::before:271`, torn/starburst/wavy `clip-path` card edges
  `:419,:431,:988,:992`, corner tone masks `:386-396,:441-448`.
- Honest read: this is the **deliberate retro-print manga aesthetic** from DESIGN.md. Execution is
  genuinely strong (screentone, off-register plates, speed-lines all read as print). Flag as
  intentional, **not** accidental low-quality art.
- Replace: leave it — it's the whole point of the mode.

### 8. GameScreen tension layers — during Word Bomb — VERDICT: excluded (effects)
- `GameScreen.css:707-708` (bomb halo), `:1056-1178` (edge vignettes teal→orange→red), `:3860`
  (clutch flash), `juice/tension.js` clip-path mask — all lighting/vignette effects, not art.

### 9. TransitionIntro paint-drips + vinyl title — intro, once/session — VERDICT: leave it
- `TransitionIntro.css:352-378` (`.intro-letter::after`): a small CSS paint-drip
  (`width:0.08em; height:0.16em; border-radius:0 0 45% 45%`, scaleY-animated). Passable teardrop,
  seen once. The 8-direction `text-shadow` vinyl ring `:199` is a type treatment, fine.
- Note: comments record the old comic starburst was **already removed as low-quality** — good instinct.

### 10. ComboMeter spark particles — in-game HUD — VERDICT: excluded (effect)
- `ComboMeter.css:97-115` (`.combo-spark`): flat cel squares flung on tier-up. On-style effect
  particles. The `🔥`/`✦` (`ComboMeter.jsx:51`) is emoji content.

### 11. KnifeSplit glint — menu-entry transition, once — VERDICT: leave it (light, not shape)
- `KnifeSplit.css:213-226` (`.knife-head`): white circle + `box-shadow: 0 0 26px 9px` glow = the
  blade's leading light. The blade itself is SVG. Box-shadow used as *light*, not to draw a shape.

### Minor: char-based glyphs used as art
- `★ FEATURED` ribbon — `GameCard.jsx:299`: a star **character** as a decorative icon. Mildly
  char-as-art; the one spot an SVG star would match the house style better.
- `→` flow arrows — `ModeExample.jsx:47-86`, `chainCards.jsx:46-52`, `SatRushGame.jsx:180` (`▼`):
  text arrows as content connectors. Borderline; read as fine.
- `✕` close, `← BACK`, PackPicker corner tab — UI affordances, excluded.

---

## Bottom line — the only asset-swap candidates (priority order)

1. **`.wall-paint-drip` rectangle drips** (`WallScene.css:62-66`) — crudest, but low-opacity so
   barely seen. SVG teardrop streaks would look better.
2. **`★ FEATURED` char-star** (`GameCard.jsx:299`) — cheap glyph vs the SVG house style; a small
   SVG star would match better.
3. **Homepage button clip-path starburst** (`Homepage.css:580-611`) — generic; an SVG burst would
   be crisper. Optional.

Everything else is a legitimate effect/texture, the deliberate SAT Rush manga style, or already a
real SVG/PNG asset. Also flagged: dead `display:none` chromatic-split block at `Homepage.css:331`.

**No code changed in this job.**
