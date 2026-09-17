// wbRailFit.js — ONE height for the two rail cards, and how many rows each may show.
//
// THE BUG THIS EXISTS TO KILL. The rails shared a height token that was a guess at the
// ring's size (`clamp(104px, --wb-size * 0.44, 196px)`) and had nothing to do with what
// was inside either card. On the preview that meant USED WORDS (5) drew four chips with
// the fourth sliced through the middle, and the MATCH readout cut MODE off at the bottom
// — both cards clipping their own content while the gate reported a perfect 0% area skew,
// because two equally-wrong boxes are still equal.
//
// THE RULE NOW: the shared height is the TALLER of the two cards' NATURAL content
// heights, capped by the space the row actually has. A card that still doesn't fit inside
// that cap drops whole ROWS (newest kept) instead of clipping one — so nothing is ever
// drawn half-height, and the label keeps showing the true total.
//
// Pure arithmetic on measured primitives, so it runs in render off cached metrics: no
// layout read per accepted word, and no feedback path back into the ring's diameter
// (the ring is sized from the header/prompt/input rows only — never from a rail).

/**
 * @param {object} arg
 * @param {Array<{key: string, chrome: number, step: number, count: number}>} arg.lists
 *   Cards made of uniform rows: `chrome` is everything that is not a row (padding,
 *   border, title and its margin), `step` is one row plus one gap, `count` is how many
 *   rows the card WANTS to show.
 * @param {number[]} [arg.fixed]
 *   Natural heights of cards that must never lose a row (the MATCH readout: dropping
 *   "MODE" is not a taper, it is a missing fact).
 * @param {number} arg.cap
 *   The tallest the row may be. Passed as the ring's diameter, which is by construction
 *   no taller than the play area — so honouring it can never grow the ring's row and
 *   push the board past the viewport.
 * @returns {{height: number, visible: Record<string, number>, natural: number, capped: boolean}}
 */
export function railFit({ lists = [], fixed = [], cap = 0 }) {
  const naturals = [
    ...lists.map((l) => l.chrome + Math.max(0, l.count) * l.step),
    ...fixed,
  ];
  const natural = naturals.length ? Math.max(...naturals) : 0;
  // The cap bounds the LISTS. It does not bound `fixed`: a card that may not lose a row
  // sets the floor, and if that floor is above the cap the row is simply that tall (the
  // MATCH card is four short rows - it has never been the tall one, and the gate proves
  // it at every viewport rather than trusting that).
  const floor = fixed.length ? Math.max(...fixed) : 0;
  const height = Math.max(floor, Math.min(natural, cap || natural));

  const visible = {};
  for (const l of lists) {
    // Whole rows only. `floor` here is the arithmetic one, not the variable above.
    const fits = l.step > 0 ? Math.floor((height - l.chrome) / l.step) : l.count;
    visible[l.key] = Math.max(0, Math.min(l.count, fits));
  }
  return { height: Math.round(height), visible, natural: Math.round(natural), capped: natural > height };
}

/** Read one CSS length off a computed style, treating anything unparsable as 0. */
const px = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Measure the primitives railFit() needs from a live rail card: the chrome around its
 * list, and the height of one row plus one gap.
 *
 * Measured from COMPUTED STYLE and a single sample row, never by counting rendered rows,
 * so the numbers hold for a count the card is not currently showing - which is the whole
 * reason the fit can be computed in render without touching the DOM again.
 *
 * @param {Element|null} card   the rail card (.game-used / .kill-feed)
 * @param {Element|null} list   the row container inside it
 * @param {Element|null} row    any one row, for its height (null -> `fallbackStep`)
 * @param {Element|null} title  the card's label, if it has one
 */
export function measureRailCard(card, list, row, title, fallbackStep = 24) {
  if (!card || !list) return null;
  const cs = getComputedStyle(card);
  let chrome =
    px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
  if (title) {
    chrome += title.offsetHeight + px(getComputedStyle(title).marginBottom);
  }
  const gap = px(getComputedStyle(list).rowGap);
  const step = row ? row.offsetHeight + gap : fallbackStep + gap;
  return { chrome: Math.round(chrome), step: Math.round(step) };
}

/**
 * The MATCH readout's natural height: its own chrome plus every row it owns. It is a
 * `fixed` input to railFit - it may be padded, never trimmed.
 */
export function measureStatusCard(card) {
  if (!card) return null;
  const cs = getComputedStyle(card);
  const rows = card.querySelector('.wb-status-rows');
  const title = card.querySelector('.wb-status-title');
  const h =
    px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth) +
    (title ? title.offsetHeight : 0) +
    (title ? px(cs.rowGap) : 0) +
    // scrollHeight, not offsetHeight: the rows box is a flex item in a fixed-height
    // column, so it SHRINKS when the card is too short - which is exactly the state we
    // are measuring our way out of. scrollHeight is the content's real height either way.
    (rows ? rows.scrollHeight : 0);
  return Math.round(h);
}
