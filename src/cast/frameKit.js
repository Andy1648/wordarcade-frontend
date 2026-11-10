// frameKit.js — the avatar frames as LAYERED COMPONENTS (Andy nov9: "frames still look shit... i dont see components - they
// look too static and AI generated"). Each frame is built from separate painted parts, every one painted alone and cut on
// its own silhouette (no rectangle, no crop line), assembled here:
//   bar      one straight band segment, laid along the four sides between the corners (the left / right ones turned 90°)
//   corner   one corner cap, painted for the TOP-LEFT and mirrored to the other three
//   parts    the frame's own props (a bomb, a padlock, icicles...), each with its own finite act
// Geometry is in % of the frame box (AvatarFrame's ring box). The face sits inside the band. PURE: the art + numbers only.
//   c        the corner cap's height, % of the box; geo = its measured shape (aspect, arm edges + thickness)
//            — the band's thickness IS the corner's arm thickness, so the bars always meet the caps flush
//   parts[]  { src, x, y, w (% of the box, its top-left + width), o (transform-origin), act (FRAME_ACTS key), z ('under') }
export const FRAME_INSET = 3; // the band's outer edge, % in from the box edge (props may hang past it)

export const FRAME_KIT = Object.freeze({
  // FROST: jagged ice blocks frozen round the face, icicles hanging off the corners, a snowflake gem set in the top
  frost: { c: 44, geo: { aspect: 0.867, top: 0.117, arm: 0.238, left: 0.059, armW: 0.302 }, corner: '/cast/frame/frost-corner-v1.webp', bar: '/cast/frame/frost-bar-v1.webp', parts: [
    { src: '/cast/frame/frost-flake-v1.webp', x: 38, y: -6, w: 24, o: '50% 50%', act: 'spin' },
  ] },
  // GRAFFITI: a hot-pink tag sprayed straight round the face, wet paint dripping off the bottom corners, overspray dots
  graffiti: { c: 40, geo: { aspect: 0.953, top: 0.094, arm: 0.254, left: 0.074, armW: 0.324 }, corner: '/cast/frame/graffiti-corner-v1.webp', bar: '/cast/frame/graffiti-bar-v1.webp',
    cornerB: '/cast/frame/graffiti-cornerB-v1.webp', geoB: { aspect: 0.91, top: 0.227, arm: 0.188, left: 0.107, armW: 0.266 }, parts: [
    { src: '/cast/frame/graffiti-can-v1.webp', x: -5, y: 58, w: 27, o: '50% 90%', act: 'jiggle' },
    { src: '/cast/frame/graffiti-smile-v1.webp', x: 72, y: -5, w: 27, o: '50% 50%', act: 'pop' },
  ] },
  // FLAME: charred iron with lava cracks, fire licking UP off every corner (its own bottom corners, so it never burns down)
  flame: { c: 42, geo: { aspect: 0.824, top: 0.266, arm: 0.205, left: 0.085, armW: 0.251 }, corner: '/cast/frame/flame-corner-v1.webp', bar: '/cast/frame/flame-bar-v1.webp',
    cornerB: '/cast/frame/flame-cornerB-v1.webp', geoB: { aspect: 0.789, top: 0.117, arm: 0.21, left: 0.045, armW: 0.312 }, parts: [
    { src: '/cast/frame/flame-ball-v1.webp', x: 70, y: -10, w: 30, o: '50% 70%', act: 'hop' },
  ] },
  // ARCADE: a chunk of a purple cabinet with cyan T-molding, a big red push-button in every corner, the joystick on top
  arcade: { c: 32, geo: { aspect: 1.032, top: 0.012, arm: 0.375, left: 0.023, armW: 0.312 }, corner: '/cast/frame/arcade-corner-v1.webp', bar: '/cast/frame/arcade-bar-v1.webp', parts: [
    { src: '/cast/frame/arcade-joy-v1.webp', x: 55, y: -17, w: 25, o: '45% 88%', act: 'swing' },
  ] },
  // LIGHTNING: storm-blue steel split by a yellow bolt, a thundercloud squatting on each corner, a smug little bolt riding it
  bolt: { c: 40, geo: { aspect: 0.883, top: 0.184, arm: 0.266, left: 0.08, armW: 0.332 }, corner: '/cast/frame/bolt-corner-v1.webp', bar: '/cast/frame/bolt-bar-v1.webp', parts: [
    { src: '/cast/frame/bolt-zap-v1.webp', x: 79, y: 55, w: 26, o: '50% 50%', act: 'flare' },
  ] },
  // SCHOLAR: an old red leather tome wrapped round the face, brass corner guards, pages showing, ribbons hanging, a mortarboard on top
  scholar: { c: 32, geo: { aspect: 1.036, top: 0.036, arm: 0.364, left: 0.02, armW: 0.352 }, corner: '/cast/frame/scholar-corner-v1.webp', bar: '/cast/frame/scholar-bar-v1.webp',
    cornerB: '/cast/frame/scholar-cornerB-v1.webp', geoB: { aspect: 0.941, top: 0.145, arm: 0.328, left: 0.012, armW: 0.386 }, parts: [
    { src: '/cast/frame/scholar-cap-v1.webp', x: -7, y: -11, w: 36, o: '50% 80%', act: 'hop' },
  ] },
  // CHAIN: gunmetal plates with cyan edges, a heavy chain run along every side, iron rings bolted in the corners, a smug padlock
  chain: { c: 32, geo: { aspect: 1.028, top: 0.032, arm: 0.343, left: 0.059, armW: 0.359 }, corner: '/cast/frame/chain-corner-v1.webp', bar: '/cast/frame/chain-bar-v1.webp', parts: [
    { src: '/cast/frame/chain-lock-v1.webp', x: 74, y: 68, w: 27, o: '50% 8%', act: 'swing' },
  ] },
  // DEFUSER: the bomb's own lime casing, red / blue / yellow wires clipped along it, a circuit board in each corner, the cutters
  defuser: { c: 32, geo: { aspect: 1.012, top: 0.034, arm: 0.34, left: 0.02, armW: 0.359 }, corner: '/cast/frame/defuser-corner-v1.webp', bar: '/cast/frame/defuser-bar-v1.webp', parts: [
    { src: '/cast/frame/defuser-cutters-v1.webp', x: -9, y: 66, w: 33, o: '55% 50%', act: 'snip' },
  ] },
  // JACKPOT: a gold slot-machine casing, marquee bulbs, a ruby starburst on every corner, the lucky cherries (+ JackpotCoins)
  jackpot: { c: 34, geo: { aspect: 1.016, top: 0.097, arm: 0.32, left: 0.062, armW: 0.335 }, corner: '/cast/frame/jackpot-corner-v1.webp', bar: '/cast/frame/jackpot-bar-v1.webp', parts: [
    { src: '/cast/frame/jackpot-cherry-v1.webp', x: 69, y: -13, w: 31, o: '42% 6%', act: 'swing' },
  ] },
  // BOMB SQUAD: hazard-striped steel bolted round the face, and the bomb it is guarding perched on the corner, fuse lit
  bomb: { c: 32, geo: { aspect: 1.028, top: 0.052, arm: 0.378, left: 0.047, armW: 0.359 }, corner: '/cast/frame/bomb-corner-v1.webp', bar: '/cast/frame/bomb-bar-v1.webp', parts: [
    { src: '/cast/frame/bomb-bomb-v1.webp', x: 68, y: -10, w: 33, o: '45% 85%', act: 'jiggle' },
  ] },
});

/** Each act is one finite transform-only one-shot (played on equip, on hover, never at rest). */
export const FRAME_ACTS = Object.freeze({
  // the whole kit clamps on: corners squeeze in and settle (equip only)
  clamp: { ms: 380, frames: [{ transform: 'scale(1.18)', opacity: 0 }, { transform: 'scale(0.94)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }] },
  jiggle: { ms: 520, frames: [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.1)', offset: 0.25 }, { transform: 'rotate(8deg) scale(0.97)', offset: 0.55 }, { transform: 'rotate(-3deg)', offset: 0.8 }, { transform: 'rotate(0) scale(1)' }] },
  swing: { ms: 700, frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(16deg)', offset: 0.25 }, { transform: 'rotate(-10deg)', offset: 0.55 }, { transform: 'rotate(5deg)', offset: 0.8 }, { transform: 'rotate(0)' }] },
  hop: { ms: 460, frames: [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-14%) scale(1.06, 0.95)', offset: 0.35 }, { transform: 'translateY(2%) scale(0.96, 1.05)', offset: 0.7 }, { transform: 'translateY(0) scale(1)' }] },
  pop: { ms: 420, frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: 0.3 }, { transform: 'scale(0.92)', offset: 0.65 }, { transform: 'scale(1)' }] },
  spin: { ms: 620, frames: [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(200deg) scale(1.15)', offset: 0.6 }, { transform: 'rotate(360deg) scale(1)' }] },
  flare: { ms: 520, frames: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.08, 1.3)', offset: 0.3 }, { transform: 'scale(0.96, 0.9)', offset: 0.65 }, { transform: 'scale(1, 1)' }] },
  snip: { ms: 480, frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)', offset: 0.3 }, { transform: 'rotate(6deg)', offset: 0.55 }, { transform: 'rotate(0)' }] },
});

export const frameKitOf = (id) => (id && Object.prototype.hasOwnProperty.call(FRAME_KIT, id) ? FRAME_KIT[id] : null);

/** The corner cap's box: its painted size (c = height, % of the frame box; aspect = w/h), placed so the outer edges of its two
 *  arms (geo.top / geo.left: fractions of its own box, measured off the cut — claude/framekit scripts arm.py) sit on the band's
 *  outer edge. Returns the TOP-LEFT one; the others mirror it. */
function cornerBox(kit) {
  const g = kit.geo; const h = kit.c; const w = h * g.aspect;
  return { x: FRAME_INSET - g.left * w, y: FRAME_INSET - g.top * h, w, h, tH: g.arm * h, tV: g.armW * w };
}

/** The four corners and four bars of a kit, as boxes in % of the frame box: { kind, x, y, w, h, flipH, flipV, rot }. */
export function kitPieces(kit) {
  const k = cornerBox(kit); const i = FRAME_INSET;
  const tuck = 0.18; // a bar starts / ends 18% inside the corner cap, hidden under it
  const ax = k.x + k.w * (1 - tuck); const ay = k.y + k.h * (1 - tuck);
  const runX = 100 - 2 * ax; const runY = 100 - 2 * ay;
  return [
    { kind: 'bar', x: ax, y: i, w: runX, h: k.tH },
    { kind: 'bar', x: ax, y: 100 - i - k.tH, w: runX, h: k.tH, flipV: true },
    // turning the bar 90° clockwise puts its painted top (the OUTER edge) on the right: the left bar flips it back out
    { kind: 'bar', x: i, y: ay, w: k.tV, h: runY, rot: true, flipV: true },
    { kind: 'bar', x: 100 - i - k.tV, y: ay, w: k.tV, h: runY, rot: true },
    { kind: 'corner', x: k.x, y: k.y, w: k.w, h: k.h },
    { kind: 'corner', x: 100 - k.x - k.w, y: k.y, w: k.w, h: k.h, flipH: true },
    // a GRAVITY frame (drips, icicles) paints its own bottom-left corner (cornerB, geoB measured off it flipped upright)
    // so nothing hangs upward; the bottom corners then use it unflipped vertically, the right one mirrored only
    ...(kit.cornerB ? (() => { const b = cornerBox({ c: k.tH / kit.geoB.arm, geo: kit.geoB }); return [ // sized so its arm matches the band
      { kind: 'corner', x: b.x, y: 100 - b.y - b.h, w: b.w, h: b.h, b: true },
      { kind: 'corner', x: 100 - b.x - b.w, y: 100 - b.y - b.h, w: b.w, h: b.h, flipH: true, b: true },
    ]; })() : [
      { kind: 'corner', x: k.x, y: 100 - k.y - k.h, w: k.w, h: k.h, flipV: true },
      { kind: 'corner', x: 100 - k.x - k.w, y: 100 - k.y - k.h, w: k.w, h: k.h, flipH: true, flipV: true },
    ]),
  ];
}

/** The face window: inside the band, tucked 1.5 points under it so no edge of the portrait ever shows. [cx, cy, half]. */
export const kitWindow = (kit) => { const k = cornerBox(kit); return [50, 50, 50 - FRAME_INSET - Math.min(k.tH, k.tV) + 1.5]; };
