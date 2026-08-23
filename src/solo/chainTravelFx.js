// chainTravelFx.js — the CHAIN "OUT → IN" travel animation, as a pure DOM/WAAPI helper
// (no React, no engine). ChainGame wires DOM refs into it.
//
// DESIGN CONTRACT (why it's shaped this way):
//  - TWO POOLED elements are reused for every accept — a `traveler` (the accepted word's
//    last letter, flying from the OUT tile to the IN letter) and a `fader` (the OLD
//    required letter, dissolving in place at the IN centre). Never a node per accept.
//  - Geometry (OUT centre, IN centre) is measured ONLY on mount and on resize and cached.
//    The accept path (`play`) does NO getBoundingClientRect and NO forced reflow.
//  - Restart is `anim.cancel(); anim.play()` on a STORED WAAPI Animation — never a
//    `void el.offsetWidth` reflow hack.
//  - Keyframes are transform (translate) + opacity ONLY; nothing here ever touches the
//    input or any ancestor of it.

const DURATION_MS = 260;
const EASING = 'cubic-bezier(.2,.8,.2,1)';
const OPTS = { duration: DURATION_MS, easing: EASING, fill: 'both' };

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createTravelFx({ root, traveler, fader }) {
  let geom = null; // { outCx, outCy, inCx, inCy } in root-local px
  let animA = null; // traveler Animation (stored, reused)
  let animB = null; // fader Animation (stored, reused)

  // Point() is spelled out per-frame so a translate carries BOTH axes (the OUT tile sits
  // below the IN letter, so the travel is not purely horizontal) while staying strictly
  // within `transform`. The leading translate(-50%,-50%) centres the glyph's own box on
  // the target point.
  const at = (x, y) => `translate(-50%,-50%) translate(${x}px, ${y}px)`;
  const travelFrames = () => [
    { transform: at(geom.outCx, geom.outCy), opacity: 1, offset: 0 },
    { transform: at(geom.inCx, geom.inCy), opacity: 1, offset: 0.8 },
    { transform: at(geom.inCx, geom.inCy), opacity: 0, offset: 1 },
  ];
  const fadeFrames = () => [
    { transform: at(geom.inCx, geom.inCy), opacity: 1, offset: 0 },
    { transform: at(geom.inCx, geom.inCy), opacity: 0, offset: 1 },
  ];

  // Measure tile centres relative to the root. Called on mount + resize ONLY.
  function measure() {
    if (!root) return;
    const face = root.querySelector('.solo-out-face');
    const center = root.querySelector('.solo-center');
    if (!face || !center) return;
    const rr = root.getBoundingClientRect();
    const f = face.getBoundingClientRect();
    const c = center.getBoundingClientRect();
    geom = {
      outCx: f.left + f.width / 2 - rr.left,
      outCy: f.top + f.height / 2 - rr.top,
      inCx: c.left + c.width / 2 - rr.left,
      inCy: c.top + c.height / 2 - rr.top,
    };
    if (!animA) {
      // Create the two Animations ONCE, then cancel so they sit idle (base opacity 0).
      animA = traveler.animate(travelFrames(), OPTS);
      animA.cancel();
      animB = fader.animate(fadeFrames(), OPTS);
      animB.cancel();
    } else {
      // Resize: refresh the cached geometry on the stored Animations.
      animA.effect.setKeyframes(travelFrames());
      animB.effect.setKeyframes(fadeFrames());
    }
  }

  // Fire one travel. No measurement, no reflow — just swap text and restart the stored
  // Animations. `newLetter` flies OUT→IN; `oldLetter` fades out at the IN centre.
  function play(newLetter, oldLetter) {
    if (prefersReduced() || !animA || !geom) return;
    traveler.textContent = (newLetter || '').toUpperCase();
    fader.textContent = (oldLetter || '').toUpperCase();
    animA.cancel();
    animA.play();
    animB.cancel();
    animB.play();
  }

  return { measure, play };
}
