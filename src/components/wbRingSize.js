// wbRingSize.js — the ring's diameter, derived from the box it sits in.
//
// THE BUG THIS EXISTS TO KILL. The first ring shipped its diameter as a media-query
// guess (`min(46vw, 62vh)`, `min(42vw, 48vh)`, `min(84vw, 44vh)`) — a number picked
// from the VIEWPORT while the ring actually lives inside a padded stage that also
// owes height to a header, a hero prompt and an input row. The two never agreed: at
// 1366x768 the guess produced a 476px ring inside a 686px-tall budget and the bottom
// of the circle ran off the board; at 1280x720 the shrink-to-fit rule jammed it into
// a 346px column in the left third of a 1148px stage.
//
// So the diameter is COMPUTED from the stage's own box and the height its siblings
// actually measure, never from vw/vh:
//
//   d = clamp(220, min( min(stageW, stageH) * 0.72,   <- the design size
//                       freeHeight,                   <- what the rows leave
//                       freeWidth ),                  <- what the rails leave
//             520)
//
// NO FEEDBACK LOOP, by construction: the stage's height is pinned in CSS (it is a
// dvh box, not content-sized), the top stack and the bottom bar are full-width rows
// whose heights cannot depend on the ring, and the side rails are capped to the ring
// so a long used-word list can never grow the row it shares. Changing --wb-size
// therefore cannot change any input to this function.

export const WB_RING_MIN = 220;
export const WB_RING_MAX = 520;
export const WB_RING_OF_STAGE = 0.72;
// A HARD CEILING ON THE BOARD'S SHORTER SIDE, applied after the 220px design floor.
// On a 320px phone the app frame (a 15px scrollbar gutter each edge plus the wrap's
// own padding) leaves a 274px-wide board, and 0.72 of that is 197px - under the
// floor. The floor would then push the ring to 80% of the board. A ring that crowds
// its board is worse than a slightly small one, so the board always wins: this is
// the only place the 220px floor can be overruled, and only downward.
export const WB_RING_OF_STAGE_MAX = 0.75;

/**
 * Pure geometry — exported so it can be unit-tested without a DOM.
 * All inputs are CSS pixels of the STAGE's border box / content box.
 */
export function ringDiameter({
  stageW,
  stageH,
  contentW,
  contentH,
  headH = 0,
  topH,
  botH,
  railW = 0,
  rowGap = 0,
  colGap = 0,
}) {
  // THE HEADER ROW is chrome: it is taken off the TOP of the content box once, and
  // the ring is then centred in what is left (the PLAY AREA). It is the one band
  // that is NOT reserved twice — which is exactly why the header is a row of its
  // own instead of sitting inside the top stack, where its height would have cost
  // the ring double.
  const playH = contentH - (headH ? headH + rowGap : 0);
  // The ring row sits between two EQUAL 1fr tracks (that equality is what centres
  // it in the play area), so each track gets whatever is left over halved — meaning
  // the ring may only take the height that remains after the TALLER of the two
  // stacks has been reserved on BOTH sides.
  const reserved = Math.max(topH, botH) + rowGap;
  const freeHeight = playH - 2 * reserved;
  // Same argument horizontally: the rails are equal 1fr tracks either side.
  const freeWidth = contentW - 2 * (railW + colGap);
  const shorterSide = Math.min(stageW, stageH);
  const design = shorterSide * WB_RING_OF_STAGE;
  const d = Math.min(design, freeHeight, freeWidth);
  const floored = Math.max(WB_RING_MIN, Math.min(WB_RING_MAX, Math.floor(d)));
  // THE FLOOR IS A PREFERENCE; THE SPACE IS A CONSTRAINT. `floored` can raise the ring
  // back up to 220px on a small board, and on a 320x640 phone that put a ring 27px
  // TALLER than the rows actually left - the 6-o'clock seat and its floated name landed
  // on the used-word strip. Clamping by freeHeight here costs nothing on every board
  // where the rows do leave 220px (this term simply isn't the smallest), and is the
  // difference between a slightly small ring and two overlapping captions.
  return Math.floor(Math.min(floored, shorterSide * WB_RING_OF_STAGE_MAX, Math.max(freeHeight, 0)));
}

const px = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Measure the stage once and write the result to `--wb-size` on it.
 * Returns the diameter it wrote (or null if the stage isn't laid out yet).
 */
export function applyRingSize(stage, { head, top, bottomBar, bottom } = {}) {
  if (!stage) return null;
  const box = stage.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const cs = getComputedStyle(stage);
  const contentW = box.width - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  const contentH = box.height - px(cs.paddingTop) - px(cs.paddingBottom) - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
  // `--wb-layout` is the ONE thing CSS tells JS: `rails` = used-words sits in the
  // right rail, `stack` = it sits under the input. Reading it beats duplicating the
  // breakpoint in a matchMedia string that would drift from the stylesheet.
  const stack = cs.getPropertyValue('--wb-layout').trim() === 'stack';
  const railW = stack ? 0 : px(cs.getPropertyValue('--wb-rail'));
  const rowGap = px(cs.rowGap);
  const colGap = stack ? 0 : px(cs.columnGap);
  const d = ringDiameter({
    stageW: box.width,
    stageH: box.height,
    contentW,
    contentH,
    headH: head ? head.offsetHeight : 0,
    topH: top ? top.offsetHeight : 0,
    botH: (stack ? bottom : bottomBar)?.offsetHeight || 0,
    railW,
    rowGap,
    colGap,
  });
  stage.style.setProperty('--wb-size', `${d}px`);
  return d;
}
