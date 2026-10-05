// MarkBadge — a mark's drawn GLYPH inside its COG (ROLL v1, Andy oct5 mockup claude/mockups/roll-v1/MarkCard.dc.html:
// "this is gold"). The cog is twelve teeth + a ring in the TIER colour (markCard/palette.js), black-inked, around a
// dark inner disc; SECRET's teeth are the rainbow (one static colour per tooth — never an animated fill). The glyph
// sits on a hard black drop shadow; once the lazy glyph chunk (markGlyphsRolled.jsx) has loaded, every glyph also
// gets its SHADE (a lower-right crescent), a HIGHLIGHT gleam and EXTRAS (markGlyphFinish.jsx). ART VS MOTION: every
// shape here is vector art; CSS only moves it — the cog spins ONCE on a reveal / hover (MarkCard.css), never loops.
//
// Kept small on purpose: this file rides the menu's index chunk (the worn-mark chip). Payload ratchet.
import { memo, useEffect, useId, useState } from 'react';
import { CARD_RAR, RAINBOW_TEETH, LOCKED, cardTier } from './markCard/palette.js';

// Rank rims (legacy marks, ranks II–V): the cog's colour once a legacy mark ranks up.
export const RANK_RIMS = [
  { fill: '#C98A4B', line: '#6E3F17' }, // I bronze
  { fill: '#CFD8E3', line: '#5F6F84' }, // II silver
  { fill: '#FFD54A', line: '#A8800F' }, // III gold
  { fill: '#2EFFE0', line: '#0F8F7E' }, // IV cyan
  { fill: '#FF4FA3', line: '#A3175E' }, // V pink
];


const INK = '#0d0618';

// Glyphs, drawn in a 100×100 box centred on (50,50), ~44 units across. Uneven on purpose.
const GLYPHS = {
  'mk-bomber': (
    <g>
      <circle cx="47" cy="56" r="17" fill={INK} />
      <path d="M58 41 L63 35" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M63 35 C67 30 70 31 71 27" stroke="#FF6B3D" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M72 22 L74 27 L79 26 L75 30 L78 34 L73 32 L70 36 L70 31 L66 29 L71 28 Z" fill="#FFE94A" stroke={INK} strokeWidth="1.5" />
      <circle cx="41" cy="50" r="4" fill="#fff" opacity="0.8" />
    </g>
  ),
  'mk-sprinter': (
    <path d="M56 26 L34 54 L48 54 L41 76 L66 44 L52 44 L60 26 Z" fill="#FFE94A" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
  ),
  'mk-scholar': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M50 30 L76 42 L50 54 L24 42 Z" fill={INK} />
      <path d="M36 48 L36 60 C42 66 58 66 64 60 L64 48 L50 54 Z" fill="#9A1AFF" />
      <path d="M72 44 L72 60" fill="none" strokeLinecap="round" />
      <circle cx="72" cy="63" r="3.5" fill="#FFE94A" />
    </g>
  ),
  'mk-linguist': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M50 36 C42 31 32 31 25 34 L25 68 C32 65 42 65 50 70 Z" fill="#fff" />
      <path d="M50 36 C58 31 68 31 75 34 L75 68 C68 65 58 65 50 70 Z" fill="#EDE6FF" />
      <path d="M31 44 L43 44 M31 51 L43 51 M57 44 L69 44 M57 51 L66 51" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  'mk-metronome': (
    <g stroke={INK} strokeWidth="3.5">
      <circle cx="50" cy="51" r="23" fill="#fff" />
      <circle cx="50" cy="51" r="14" fill="#FF4FA3" />
      <circle cx="50" cy="51" r="5" fill={INK} />
      <path d="M50 51 L72 29" strokeWidth="4" strokeLinecap="round" />
      <path d="M72 29 L66 29 M72 29 L72 35" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  'mk-student': (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" fill="none">
      <path d="M27 70 L27 32" />
      <path d="M27 70 L75 70" />
      <path d="M33 62 L45 48 L54 55 L70 36" stroke="#2EFFE0" strokeWidth="6" />
      <path d="M33 62 L45 48 L54 55 L70 36" strokeWidth="2" />
      <path d="M62 35 L71 34 L71 43" />
    </g>
  ),
  'mk-magpie': (
    <g stroke={INK} strokeWidth="3.5">
      <ellipse cx="50" cy="52" rx="22" ry="21" fill="#FFD54A" />
      <ellipse cx="50" cy="52" rx="14" ry="13" fill="none" stroke="#A8800F" strokeWidth="3" />
      <path d="M50 42 L53 49 L60 49 L54 53 L56 60 L50 56 L44 60 L46 53 L40 49 L47 49 Z" fill="#fff" strokeWidth="2" />
    </g>
  ),
  'mk-eternal': (
    <path
      d="M50 51 C43 41 29 40 28 51 C29 62 43 61 50 51 C57 41 71 40 72 51 C71 62 57 61 50 51 Z"
      fill="none"
      stroke="#9A1AFF"
      strokeWidth="8"
      strokeLinejoin="round"
    />
  ),
  // ---- STEP 49: the eight new marks, same hand: uneven, chunky ink, flat fills ----
  'mk-linker': (
    <g stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round">
      <rect x="24" y="40" width="30" height="18" rx="9" transform="rotate(-24 39 49)" stroke="#2EFFE0" strokeWidth="8" />
      <rect x="24" y="40" width="30" height="18" rx="9" transform="rotate(-24 39 49)" />
      <rect x="46" y="44" width="30" height="18" rx="9" transform="rotate(-24 61 53)" stroke="#FF4FA3" strokeWidth="8" />
      <rect x="46" y="44" width="30" height="18" rx="9" transform="rotate(-24 61 53)" />
    </g>
  ),
  'mk-veteran': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M38 24 L50 40 L62 24 L66 27 L54 46 L46 46 L34 27 Z" fill="#FF4FA3" />
      <circle cx="50" cy="60" r="16" fill="#FFD54A" />
      <path d="M50 51 L53 57 L60 57 L54 61 L57 68 L50 64 L43 68 L46 61 L40 57 L47 57 Z" fill="#fff" strokeWidth="2" />
    </g>
  ),
  'mk-phoenix': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M50 78 C34 74 26 60 32 44 C36 52 40 54 42 50 C40 40 44 30 52 24 C52 34 58 38 62 34 C66 42 70 52 66 62 C62 72 56 76 50 78 Z" fill="#FF6B3D" />
      <path d="M50 72 C42 68 40 60 44 52 C46 58 50 58 52 54 C56 58 60 62 58 66 C56 70 54 72 50 72 Z" fill="#FFE94A" strokeWidth="2.5" />
    </g>
  ),
  'mk-smith': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M26 70 L74 70 L68 62 L32 62 Z" fill="#5F6F84" />
      <path d="M36 62 L40 54 L60 54 L64 62 Z" fill="#CFD8E3" />
      <path d="M48 46 L66 28" strokeWidth="6" strokeLinecap="round" />
      <rect x="58" y="18" width="20" height="12" rx="2" transform="rotate(45 68 24)" fill="#FF6B3D" />
      <path d="M30 50 L26 44 M36 46 L35 39 M24 56 L18 54" stroke="#FFE94A" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  'mk-curator': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <rect x="26" y="34" width="48" height="36" rx="4" fill="#9A1AFF" />
      <path d="M26 42 L38 42 L42 36 L58 36" fill="none" />
      <rect x="32" y="26" width="30" height="16" rx="2" fill="#fff" transform="rotate(-6 47 34)" />
      <path d="M36 32 L54 30" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 50 L53 57 L60 58 L55 63 L56 70 L50 66 L44 70 L45 63 L40 58 L47 57 Z" fill="#FFE94A" strokeWidth="2" />
    </g>
  ),
  'mk-pyro': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <rect x="30" y="38" width="12" height="34" rx="3" fill="#FF4FA3" transform="rotate(-10 36 55)" />
      <rect x="44" y="34" width="12" height="38" rx="3" fill="#FF6B3D" />
      <rect x="58" y="38" width="12" height="34" rx="3" fill="#FFE94A" transform="rotate(10 64 55)" />
      <path d="M50 34 C50 28 54 26 56 22" fill="none" strokeLinecap="round" />
      <path d="M56 22 L60 16 L59 23 L66 21 L60 26 Z" fill="#FFE94A" strokeWidth="2" />
    </g>
  ),
  'mk-nova': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M50 18 L56 42 L80 38 L60 52 L74 74 L50 60 L28 76 L40 52 L20 36 L44 42 Z" fill="#fff" />
      <circle cx="50" cy="50" r="9" fill="#2EFFE0" />
    </g>
  ),
  'mk-legend': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M24 66 L28 34 L40 48 L50 26 L60 48 L72 34 L76 66 Z" fill="#FFD54A" />
      <path d="M24 66 L76 66 L74 74 L26 74 Z" fill="#A8800F" />
      <circle cx="50" cy="56" r="5" fill="#FF4FA3" strokeWidth="2.5" />
      <circle cx="35" cy="58" r="3.5" fill="#2EFFE0" strokeWidth="2" />
      <circle cx="65" cy="58" r="3.5" fill="#2EFFE0" strokeWidth="2" />
    </g>
  ),
};
// The 26 MARK ROLLS glyphs + every glyph's FINISH (shade / highlight / extras) live in markGlyphsRolled.jsx (lazy —
// payload ratchet). A screen that needs them registers them (RollScreen, MarksIndex); a badge drawn before that
// loads the module once and re-draws.
const EXTRA = {};
let FINISH = null;
let extraLoad = null;
export function registerMarkGlyphs(map, finish) {
  Object.assign(EXTRA, map);
  if (finish) FINISH = finish;
}
function loadExtraGlyphs() {
  if (!extraLoad) {
    extraLoad = import('./markGlyphsRolled.jsx').then((m) => registerMarkGlyphs(m.ROLLED_GLYPHS, m.GLYPH_FINISH), () => { extraLoad = null; });
  }
  return extraLoad;
}
const LOCK = (
  <g stroke="#6b5a86" strokeWidth="4" strokeLinejoin="round" fill="none">
    <path d="M38 48 L38 40 C38 30 62 30 62 40 L62 48" />
    <rect x="32" y="48" width="36" height="26" rx="4" fill="#2a1648" />
    <circle cx="50" cy="60" r="3.5" fill="#6b5a86" stroke="none" />
  </g>
);
const SHADOW = { filter: 'drop-shadow(3px 3px 0 #000)' };
const TEETH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
/** The COG: twelve black-inked teeth + the ring, in `line` (or the rainbow, one colour a tooth), in a 120 box. */
export function CogRing({ line, rainbow = false }) {
  return (
    <g className="mb-cog">
      <g stroke="#000" strokeWidth="3" strokeLinejoin="round">
        {TEETH.map((a, i) => (
          <rect key={a} x="51" y="1" width="18" height="20" rx="2" fill={rainbow ? RAINBOW_TEETH[i % 5] : line} transform={a ? `rotate(${a} 60 60)` : undefined} />
        ))}
      </g>
      <circle cx="60" cy="60" r="44" fill={line} stroke="#000" strokeWidth="5" />
    </g>
  );
}

/**
 * @param mark        a marks entry ({ id, tier }) or null (an empty slot)
 * @param rank        1..5 — a legacy mark's rank (II–V recolour the cog; V adds the crown)
 * @param locked      the LOCK glyph in a dead grey cog (legacy panels, blank reel cells)
 * @param silhouette  ROLL v1 locked card: the mark's own glyph in solid black, the cog still in its tier colour
 * @param permanent   a PERMANENT (hard-achievement) mark — the cyan cog
 * @param size        px
 * @param cog         false = no cog (MarkCard draws its own, in an HTML layer it can spin on the compositor)
 */
function MarkBadge({ mark, rank = 1, locked = false, silhouette = false, size = 56, className = '', permanent = false, cog = true }) {
  const uid = useId().replace(/[^\w-]/g, '');
  const r = Math.max(1, Math.min(5, rank || 1));
  const dead = locked || !mark;
  const tier = permanent ? 'permanent' : cardTier(mark && mark.tier);
  const pal = CARD_RAR[tier];
  const line = dead ? '#3d3150' : r > 1 ? RANK_RIMS[r - 1].fill : pal.line;
  const rainbow = !dead && r === 1 && tier === 'secret';
  const [, redraw] = useState(0);
  const want = !!mark && !locked && (!(GLYPHS[mark.id] || EXTRA[mark.id]) || !FINISH);
  useEffect(() => {
    if (!want) return undefined;
    let live = true;
    loadExtraGlyphs().then(() => { if (live) redraw((n) => n + 1); });
    return () => { live = false; };
  }, [want]);
  const glyph = dead ? LOCK : GLYPHS[mark.id] || EXTRA[mark.id] || null;
  return (
    <svg
      className={`mark-badge${dead ? ' is-locked' : ''}${silhouette ? ' is-sil' : ''} ${className}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {cog ? <CogRing line={line} rainbow={rainbow} /> : null}
      <circle cx="60" cy="60" r="35" fill={dead ? '#1a0b2e' : silhouette ? LOCKED.inner : pal.inner} stroke="#000" strokeWidth="4" />
      {glyph ? (
        <g className="mb-glyph" style={SHADOW}>
          <g className={silhouette ? 'mx-sil' : undefined} transform="translate(60 60) scale(1.32) translate(-50 -50)">
            {glyph}
            {!dead && !silhouette && FINISH ? FINISH(mark.id, uid) : null}
          </g>
        </g>
      ) : null}
      {!dead && r >= 5 ? <path d="M44 -2 L49 -14 L55 -5 L60 -17 L65 -5 L71 -14 L76 -2 Z" fill="#FFE94A" stroke="#000" strokeWidth="3" strokeLinejoin="round" /> : null}
    </svg>
  );
}

export default memo(MarkBadge);
