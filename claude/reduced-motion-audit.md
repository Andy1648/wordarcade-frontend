# JOB 28 — prefers-reduced-motion: coverage audit + end-to-end verification · REPORT ONLY

Audited how the app honors `prefers-reduced-motion`, across both CSS animations and the JS/WAAPI juice
layer (which CSS media queries can't reach), and verified it end-to-end. **Result: the path is already
complete, sophisticated, and works — nothing to ship.**

## Coverage — covered vs uncovered

**CSS (237 `@keyframes`, 70 reduced-motion blocks across 32 files):** EVERY `.css` file that defines an
animation also carries a `@media (prefers-reduced-motion: reduce)` guard — a scripted check for
"animation-bearing file with NO reduced-motion block" returned **zero files**. `index.css` adds
top-level catch-alls. The busy card-art (`GameCardArt.css`) explicitly kills its idle loops:
`.wb-bomb/.wb-orbit/.wb-tile/.wb-spark, .cb-brain, .cb-bolt/.cb-synapse, .sr-tile/.sr-caret/.sr-speed,
.chain-arrow-g, .fuse-flame/.fuse-spark → animation: none !important`, then pins sensible resting poses.

**JS / WAAPI juice (the part CSS can't gate):** a central source of truth in `juice/settings.js` —
`motionAllowed() = manualMotionFlag && !prefers-reduced-motion`, plus a live `reduced()`. The effect
modules consume it with a **correct, nuanced model** (not a blunt "kill everything"):
- **Vestibular / large-motion effects are fully SUPPRESSED under reduced-motion:** `shake`
  (`if (!motionAllowed()) return`), `hitStop`, and the particle `burst` / `ring` (`reduced()` gate).
- **Small functional-feedback effects are KEPT but SOFTENED** — matching WCAG's intent (reduced-motion
  targets vestibular triggers, not all UI feedback): `squash` keeps the press but shallows the overshoot
  (0.13 → 0.05); `flash` still fires but at lower brightness/saturation/duration and drops the color ring.
- 17 React components additionally gate their own motion on the preference (transitions, `Mascot`,
  `WallScene`, `KnifeSplit`, `TransitionIntro`, `ModeDialog`, …).

## End-to-end verification (the proof, not just the code read)
Emulated a real reduced-motion client (`page.emulateMedia({ reducedMotion: 'reduce' })`, confirmed
`matchMedia('(prefers-reduced-motion: reduce)').matches === true`) and counted RUNNING-infinite
animations at menu idle:

```
infinite animations under reduced-motion = 0   (.cb-brain → animation-name: none)
```

So the three idle card-art loops JOB 6 flagged in the DEFAULT state (`cb-throb`, `cb-illuminate`,
`sr-caret-blink`) are correctly suppressed for reduced-motion users — this also de-risks JOB 6's
"keep-or-convert" question: reduced-motion users already get them off; only motion-OK users see them,
which is the deliberate "nothing static" card-art aesthetic.

## Two notes for whoever tests this next
- **Use `page.emulateMedia({ reducedMotion })`, not `test.use({ reducedMotion })`** — in this
  Playwright setup the fixture form did NOT actually set the media query (matchMedia stayed false),
  which will silently pass a reduced-motion test that isn't really running. The page method works.
  (Relevant to JOB 10 visual baselines if it adds reduced-motion snapshots.)
- Coverage was checked at the file + central-gate level and verified by the 0-infinite runtime probe;
  a future exhaustive per-selector CSS pass could still find a stray un-listed selector, but no gap is
  visible from the runtime behavior.

## Verdict
prefers-reduced-motion is **complete and correct** — comprehensive CSS guards (0 uncovered files), a
central JS gate with an appropriately nuanced suppress-vs-soften model, and a verified 0 infinite
animations under real reduced-motion. Nothing to fix or ship.
