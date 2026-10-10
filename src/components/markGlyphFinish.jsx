// markGlyphFinish.jsx — the FINISH every mark glyph wears in ROLL v1 (Andy oct5 mockup: "glyphs with shade +
// highlights + extras + a hard drop shadow"). Lazy: it loads with markGlyphsRolled.jsx (the MARKS chunk), never on
// the menu's first paint. MarkBadge draws the base glyph + the hard drop shadow; once this is registered it adds:
//   SHADE      a lower-right crescent: the glyph's BODY minus the body shifted up-left, filled with ink at 30% — so
//              the shade follows the real outline of every glyph (light comes from the top-left, always)
//   HIGHLIGHT  a white gleam just inside the upper-left edge (the body shifted down-right a little minus a little
//              more), kept to the upper-left by a round window — clear of the ink outline
//   EXTRAS     a white four-point sparkle up-right + a palette dot down-left, placed per mark by a hash of its id, so
//              no two marks sit the same (asymmetry, house rule)
// BODY = the glyph's main coloured shape(s), copied from its drawing (MarkBadge.jsx GLYPHS / markGlyphsRolled.jsx)
// with no paint of their own: the masks paint them. A stroke-drawn glyph lists its coloured stroke (fill="none" +
// its width) and a smaller shade offset. ART VS MOTION: all of it is vector art; nothing here moves.
//
// `uid` keeps the mask ids unique per badge (MarkBadge passes its useId), so a glyph shown twice never shares one.
const INK = '#0d0618';

/** id → [body, shadeOffset] (offset defaults to 7 — the crescent width on a filled shape). */
const BODIES = {
  // ---- the legacy glyphs (MarkBadge.jsx) ----
  'mk-linguist': [<g><path d="M50 36 C42 31 32 31 25 34 L25 68 C32 65 42 65 50 70 Z" /><path d="M50 36 C58 31 68 31 75 34 L75 68 C68 65 58 65 50 70 Z" /></g>],
  'mk-eternal': [<path d="M50 51 C43 41 29 40 28 51 C29 62 43 61 50 51 C57 41 71 40 72 51 C71 62 57 61 50 51 Z" fill="none" strokeWidth="8" strokeLinejoin="round" />, 2.5],
  'mk-curator': [<rect x="26" y="34" width="48" height="36" rx="4" />],
  'mk-legend': [<path d="M24 66 L28 34 L40 48 L50 26 L60 48 L72 34 L76 66 Z" />],
  // ---- the rolled + permanent glyphs (markGlyphsRolled.jsx) ----
  'mk-ironhand': [<path d="M30 44 C30 36 40 34 42 40 C44 32 54 32 55 40 C58 33 67 34 67 42 C72 40 76 46 74 54 L70 70 L36 72 C30 64 28 54 30 44 Z" />],
  'mk-marathon': [<path d="M62 18 L77 21 L71 25 L77 29 L62 28 Z" />, 3],
  'mk-blaze': [<path d="M52 20 C60 32 74 40 70 58 C67 72 56 78 46 78 C34 76 26 64 30 52 C32 44 38 42 40 36 C44 42 46 44 48 40 C50 34 48 26 52 20 Z" />],
  'mk-ritual': [<rect x="26" y="30" width="48" height="44" rx="4" transform="rotate(4 50 52)" />],
  'mk-grandmaster': [<g><path d="M40 34 L60 32 L56 56 L44 56 Z" /><path d="M38 56 L62 56 L66 70 L34 72 Z" /></g>, 5],
  'mk-omega': [<path d="M29 74 L42 74 L42 66 C30 60 28 44 36 36 C44 28 58 28 66 36 C74 44 72 60 60 66 L60 74 L73 73" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />, 2],
};

const SPARK = 'M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z';
const DOTS = ['#2EFFE0', '#FFE94A', '#FF4FA3', '#FF6B3D'];
const BOX = { maskUnits: 'userSpaceOnUse', x: '-20', y: '-20', width: '140', height: '140' };
function hash(s) {
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
/** The ROLLABLE glyphs are drawn in the kit construction (markGlyphsRolled.jsx): their shade plane, one glint and
 * asymmetric detail are part of the art, so the finish adds nothing to them (a second gleam + sparkle would break
 * the kit's "exactly one glint"). */
export const KIT_DRAWN = new Set([
  'mk-detonator', 'mk-cyclone', 'mk-scholar', 'mk-ouroboros', 'mk-tinder', 'mk-slipstream', 'mk-smith', 'mk-phoenix',
  'mk-metronome', 'mk-hotwire', 'mk-grapple', 'mk-sparkplug', 'mk-pyro', 'mk-nova', 'mk-golem', 'mk-brainstorm',
  'mk-flashpoint', 'mk-voltage', 'mk-talisman', 'mk-leviathan', 'mk-eclipse', 'mk-headmaster', 'mk-thunderclap',
  'mk-singularity', 'mk-kraken', 'mk-hydra', 'mk-origin',
]);
/** Which glyph ids are finished — a body here, or kit-drawn (the unit test checks every mark id is covered). */
export const FINISHED_IDS = [...Object.keys(BODIES), ...KIT_DRAWN];

/** The finish layer for one glyph, drawn in the glyph's own 100×100 space on top of it. */
export function GLYPH_FINISH(id, uid) {
  if (KIT_DRAWN.has(id)) return null;
  const h = hash(String(id));
  const extras = (
    <g stroke={INK} strokeLinejoin="round">
      <path d={SPARK} transform={`translate(${80 + (h % 9)} ${15 + ((h >> 3) % 10)}) rotate(${((h >> 5) % 40) - 20}) scale(${0.8 + (h % 3) * 0.12})`} fill="#fff" strokeWidth="2.5" />
      <circle cx={15 + ((h >> 7) % 8)} cy={76 + ((h >> 10) % 8)} r="3.5" fill={DOTS[h % 4]} strokeWidth="2.2" />
    </g>
  );
  const b = BODIES[id];
  if (!b) return extras;
  const [body, o = 7] = b;
  const ms = `ms${uid}`;
  const mh = `mh${uid}`;
  const a1 = o >= 4 ? o * 0.3 : 0.5;
  const a2 = o * 0.85;
  return (
    <g className="mb-finish">
      <defs>
        <mask id={ms} {...BOX}>
          <g fill="#fff" stroke="#fff" strokeWidth="0">{body}</g>
          <g fill="#000" stroke="#000" strokeWidth="0" transform={`translate(${-o} ${-o})`}>{body}</g>
        </mask>
        <mask id={mh} {...BOX}>
          <g fill="#fff" stroke="#fff" strokeWidth="0" transform={`translate(${a1} ${a1})`}>{body}</g>
          <g fill="#000" stroke="#000" strokeWidth="0" transform={`translate(${a2} ${a2})`}>{body}</g>
          <path d="M-20 -20 H120 V120 H-20 Z M34 10 A24 24 0 1 0 34.01 10 Z" fill="#000" fillRule="evenodd" />
        </mask>
      </defs>
      <rect x="-20" y="-20" width="140" height="140" fill="#000" opacity="0.3" mask={`url(#${ms})`} />
      <rect x="-20" y="-20" width="140" height="140" fill="#fff" opacity="0.85" mask={`url(#${mh})`} />
      {extras}
    </g>
  );
}
