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
  'mk-bomber': [<circle cx="47" cy="56" r="17" />],
  'mk-sprinter': [<path d="M56 26 L34 54 L48 54 L41 76 L66 44 L52 44 L60 26 Z" />, 6],
  'mk-scholar': [<path d="M36 48 L36 60 C42 66 58 66 64 60 L64 48 L50 54 Z" />, 5],
  'mk-linguist': [<g><path d="M50 36 C42 31 32 31 25 34 L25 68 C32 65 42 65 50 70 Z" /><path d="M50 36 C58 31 68 31 75 34 L75 68 C68 65 58 65 50 70 Z" /></g>],
  'mk-metronome': [<circle cx="50" cy="51" r="23" />],
  'mk-student': [<path d="M33 62 L45 48 L54 55 L70 36" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />, 2],
  'mk-magpie': [<ellipse cx="50" cy="52" rx="22" ry="21" />],
  'mk-eternal': [<path d="M50 51 C43 41 29 40 28 51 C29 62 43 61 50 51 C57 41 71 40 72 51 C71 62 57 61 50 51 Z" fill="none" strokeWidth="8" strokeLinejoin="round" />, 2.5],
  'mk-linker': [
    <g fill="none" strokeWidth="8">
      <rect x="24" y="40" width="30" height="18" rx="9" transform="rotate(-24 39 49)" />
      <rect x="46" y="44" width="30" height="18" rx="9" transform="rotate(-24 61 53)" />
    </g>,
    2.5,
  ],
  'mk-veteran': [<g><path d="M38 24 L50 40 L62 24 L66 27 L54 46 L46 46 L34 27 Z" /><circle cx="50" cy="60" r="16" /></g>, 6],
  'mk-phoenix': [<path d="M50 78 C34 74 26 60 32 44 C36 52 40 54 42 50 C40 40 44 30 52 24 C52 34 58 38 62 34 C66 42 70 52 66 62 C62 72 56 76 50 78 Z" />],
  'mk-smith': [<g><path d="M26 70 L74 70 L68 62 L32 62 Z" /><path d="M36 62 L40 54 L60 54 L64 62 Z" /></g>, 5],
  'mk-curator': [<rect x="26" y="34" width="48" height="36" rx="4" />],
  'mk-pyro': [
    <g>
      <rect x="30" y="38" width="12" height="34" rx="3" transform="rotate(-10 36 55)" />
      <rect x="44" y="34" width="12" height="38" rx="3" />
      <rect x="58" y="38" width="12" height="34" rx="3" transform="rotate(10 64 55)" />
    </g>,
    4,
  ],
  'mk-nova': [<path d="M50 18 L56 42 L80 38 L60 52 L74 74 L50 60 L28 76 L40 52 L20 36 L44 42 Z" />, 6],
  'mk-legend': [<path d="M24 66 L28 34 L40 48 L50 26 L60 48 L72 34 L76 66 Z" />],
  // ---- the rolled + permanent glyphs (markGlyphsRolled.jsx) ----
  'mk-sparky': [<path d="M55 19 L60 29 L71 24 L64 34 L74 41 L62 41 L60 52 L54 42 L44 45 L50 35 L42 27 L53 29 Z" />, 5],
  'mk-dasher': [<path d="M32 40 L45 38 L51 50 L70 54 C78 56 80 62 78 66 L34 68 C30 60 30 48 32 40 Z" />],
  'mk-crammer': [<rect x="26" y="40" width="48" height="32" rx="3" transform="rotate(-4 50 56)" />],
  'mk-inkwell': [<g><path d="M24 70 C30 64 44 66 54 70 C64 74 76 70 80 74 C76 80 64 78 56 80 C46 82 30 80 24 70 Z" /><path d="M30 46 L51 34 L62 53 L41 65 Z" /></g>, 5],
  'mk-shackle': [<path d="M40 66 C24 64 22 40 38 34 C50 30 60 38 58 50" fill="none" strokeWidth="6" strokeLinecap="round" />, 2],
  'mk-wick': [<path d="M36 48 L64 46 L66 76 L34 77 Z" />],
  'mk-matchstick': [<g><ellipse cx="61" cy="36" rx="8" ry="10" transform="rotate(38 61 36)" /><path d="M66 27 C62 20 67 15 72 11 C72 19 80 21 74 29 Z" /></g>, 4],
  'mk-pacer': [<circle cx="50" cy="55" r="23" />],
  'mk-nitro': [<rect x="34" y="30" width="28" height="44" rx="10" transform="rotate(-10 48 52)" />],
  'mk-detonator': [<rect x="28" y="50" width="44" height="26" rx="3" />],
  'mk-cyclone': [<path d="M22 32 C40 24 68 25 78 33 M28 45 C42 39 63 39 72 45 M36 57 C46 53 59 54 66 58 M46 68 C51 65 57 66 60 70" fill="none" strokeWidth="4" strokeLinecap="round" />, 1.5],
  'mk-ouroboros': [<g><path d="M62 30 C45 21 24 32 26 52 C28 72 52 80 66 68 C74 60 74 47 69 40" fill="none" strokeWidth="6" strokeLinecap="round" /><path d="M58 23 L74 27 L72 40 L61 36 Z" /></g>, 2.5],
  'mk-tinder': [<path d="M26 62 L36 44 L54 40 L66 50 L62 68 L40 74 Z" />],
  'mk-slipstream': [<path d="M20 36 L58 36 C69 36 71 26 63 24 M28 52 L73 52 C83 52 83 66 73 64 M22 68 L51 68" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />, 1.5],
  'mk-kraken': [<g><path d="M36 51 C24 64 22 66 20 74 C30 72 34 66 42 56 M46 53 C44 64 40 70 43 80 C49 74 51 64 53 55 M58 53 C61 64 66 70 75 71 C70 63 67 58 65 51" /><path d="M33 52 C29 30 71 26 68 51 Z" /></g>, 5],
  'mk-golem': [<path d="M30 32 L68 28 L74 64 L56 76 L34 74 L26 52 Z" />],
  'mk-eclipse': [<circle cx="47" cy="53" r="24" />, 5],
  'mk-leviathan': [<g><path d="M18 70 C28 62 34 74 44 66 C54 58 60 72 70 64 C76 60 80 64 84 62 L84 78 L18 78 Z" /><path d="M36 63 C34 44 44 26 62 24 C70 24 74 30 70 34 L58 36 C52 40 50 50 52 63 Z" /></g>, 5],
  'mk-singularity': [<g><ellipse cx="50" cy="52" rx="32" ry="11" transform="rotate(-14 50 52)" fill="none" strokeWidth="5" /><circle cx="49" cy="51" r="15" /></g>, 3],
  'mk-origin': [<path d="M50 18 C64 38 74 50 70 64 C66 78 36 80 31 64 C27 52 38 38 50 18 Z" />],
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
/** Which glyph ids have a body (the unit test checks every mark id is covered). */
export const FINISHED_IDS = Object.keys(BODIES);

/** The finish layer for one glyph, drawn in the glyph's own 100×100 space on top of it. */
export function GLYPH_FINISH(id, uid) {
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
