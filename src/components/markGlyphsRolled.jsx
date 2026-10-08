// markGlyphsRolled.jsx — the MARK ROLLS glyphs (the 29 rollable marks + the 6 permanent), split out of MarkBadge.jsx
// so they load with the MARKS panel, not on the menu's first paint (payload ratchet, PR #156). MarkBadge registers
// them on demand: MarksIndex / RollScreen import this module, and a badge for an id it can't draw yet (the menu chip
// of a worn mark) loads it once and re-draws.
//
// NIGHT oct8 4b: the 29 ROLLABLE glyphs are drawn in the KIT construction (kit/kitIconsCore.js): one bold silhouette,
// a BASE fill + ONE darker SHADE plane on its lower-right (flat, no stroke, between fill and outline), an INK outline,
// exactly ONE white glint (upper-left) and ONE asymmetric detail (a spark, a drip, a trailing line, a crack). Their
// shade + glint live in the art, so markGlyphFinish.jsx skips them (KIT_DRAWN). Each glyph keeps its object's own
// colours — rarity colour is the cog's job, never the glyph's. Stroke-drawn forms (chains, rings, streams) get their
// shade by laying the base colour over the shade colour nudged up-left, so the shade shows on the lower-right edge.
export { GLYPH_FINISH } from './markGlyphFinish.jsx';

const INK = '#0d0618';
const W = '#fff';
const KS = { stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const UL = 'translate(-2 -2)';

/** A circle as a path (so it can be a Form). */
const disc = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
/** The lower-right shade crescent of a circle (light from the top-left). */
function moon(x, y, r, k = 1.4) {
  const at = (deg) => {
    const a = (deg * Math.PI) / 180;
    return `${Math.round((x + r * Math.cos(a)) * 10) / 10} ${Math.round((y + r * Math.sin(a)) * 10) / 10}`;
  };
  const p = at(-40);
  const q = Math.round(r * k * 10) / 10;
  return `M${p}A${r} ${r} 0 0 1 ${at(130)}A${q} ${q} 0 0 0 ${p}Z`;
}
/** One kit FORM: base fill, the shade plane, then the ink outline pass. */
function F({ d, f, s, sd }) {
  return (
    <>
      <path d={d} fill={f} stroke="none" />
      <path d={sd} fill={s} stroke="none" />
      <path d={d} fill="none" />
    </>
  );
}
/** A stroke-drawn form: ink, the shade stroke, then the base stroke nudged up-left. */
function S({ d, f, s, w = 6, ink = 14 }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={ink} fill="none" />
      <path d={d} stroke={s} strokeWidth={w} fill="none" />
      <path d={d} stroke={f} strokeWidth={w} fill="none" transform={UL} />
    </>
  );
}
const G = ({ d, w = 4 }) => <path d={d} stroke={W} strokeWidth={w} fill="none" />;

export const ROLLED_GLYPHS = {
  // ---- the 29 ROLLABLE marks, kit construction ----
  'mk-bomber': (
    <g {...KS}>
      <path d="M54 42 L61 35 L69 43 L62 50 Z" fill="#8FA0B5" />
      <F d={disc(45, 58, 20)} f="#3B2D5C" s="#1F1438" sd={moon(45, 58, 20)} />
      <path d="M65 39 C70 33 72 30 76 27" strokeWidth="8" fill="none" />
      <path d="M65 39 C70 33 72 30 76 27" stroke="#C98A4B" strokeWidth="3.5" fill="none" />
      <path d="M79 15 L81 21 L87 19 L83 24 L88 28 L82 28 L80 34 L77 28 L71 29 L75 24 L72 18 L78 21 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M90 37 L93 40 M69 13 L68 9" stroke="#FF6B3D" strokeWidth="3" />
      <G d="M32 55 C33 49 36 45 41 43" w="4.5" />
    </g>
  ),
  'mk-sparky': (
    <g {...KS}>
      <path d="M22 80 C30 70 42 74 44 62 C45 56 44 52 48 47" strokeWidth="9" fill="none" />
      <path d="M22 80 C30 70 42 74 44 62 C45 56 44 52 48 47" stroke="#C98A4B" strokeWidth="4" fill="none" />
      <g strokeWidth="3.5"><F d="M56 13 L61 27 L78 21 L68 35 L77 43 L65 45 L68 62 L56 50 L46 58 L47 45 L28 44 L44 35 L38 24 L51 27 Z" f="#FFE94A" s="#F2A900" sd="M56 38 L68 35 L77 43 L65 45 L68 62 L56 50 Z" /></g>
      <path d="M82 52 L86 56 M78 64 L80 69" stroke="#FF6B3D" strokeWidth="3.5" />
      <G d="M43 29 L48 31" w="3" />
    </g>
  ),
  'mk-sprinter': (
    <g {...KS}>
      <F d="M58 18 L30 54 L46 54 L38 82 L70 42 L53 42 L63 18 Z" f="#FFE94A" s="#F2A900" sd="M63 18 L53 42 L70 42 L38 82 L50 47 L57 25 Z" />
      <path d="M72 25 L82 21 M75 33 L86 31" stroke="#2EFFE0" strokeWidth="4" />
      <G d="M55 27 L49 35" />
    </g>
  ),
  'mk-dasher': (
    <g {...KS}>
      <F d="M30 38 L44 36 L50 48 L70 52 C80 54 82 62 80 66 L32 68 C28 58 28 46 30 38 Z" f="#FF4FA3" s="#C72E7E" sd="M56 49 L70 52 C80 54 82 62 80 66 L54 67 C68 62 70 56 56 49 Z" />
      <path d="M32 68 L80 66 L79 74 L33 76 Z" fill="#CFD8E3" />
      <path d="M44 45 L50 43 M46 51 L53 49" strokeWidth="3" />
      <path d="M12 48 L23 48 M8 58 L23 57 M15 67 L24 66" stroke="#2EFFE0" strokeWidth="4" />
      <G d="M35 44 L34 56" />
    </g>
  ),
  'mk-crammer': (
    <g {...KS}>
      <g transform="rotate(-5 50 56)">
        <path d="M30 44 L35 26 L45 35 L55 20 L62 33 L72 27 L71 44 Z" fill={W} strokeWidth="3.5" />
        <F d="M26 42 L74 42 L74 74 L26 74 Z" f="#9A1AFF" s="#6A0FC0" sd="M62 42 L74 42 L74 74 L62 74 Z" />
        <path d="M38 53 L56 53" stroke="#FFE94A" strokeWidth="5" />
        <G d="M32 48 L32 64" />
      </g>
      <path d="M76 17 L86 21 L82 30 L72 26 Z" fill={W} strokeWidth="3.5" />
    </g>
  ),
  'mk-inkwell': (
    <g {...KS}>
      <path d="M50 36 C54 22 64 14 80 10 C76 22 68 30 56 38 Z" fill="#FF4FA3" strokeWidth="3.5" />
      <path d="M53 37 L73 17" strokeWidth="2.5" />
      <path d="M40 32 L60 32 L60 44 L40 44 Z" fill="#5F6F84" />
      <F d="M28 52 C28 46 34 43 50 43 C66 43 72 46 72 52 L72 74 C72 79 66 81 50 81 C34 81 28 79 28 74 Z" f="#2EFFE0" s="#12A99A" sd="M60 44 C67 45 72 47 72 52 L72 74 C72 79 66 81 54 81 C60 72 62 58 60 44 Z" />
      <path d="M58 43 C60 48 65 50 65 56 C65 60 59 60 59 56 C59 51 57 48 56 44 Z" fill="#9A1AFF" strokeWidth="3" />
      <path d="M31 66 C40 70 60 70 69 66 L69 74 C69 77 64 78 50 78 C36 78 31 77 31 74 Z" fill="#9A1AFF" stroke="none" />
      <path d="M31 66 C40 70 60 70 69 66" strokeWidth="3" fill="none" />
      <G d="M34 53 L34 61" />
    </g>
  ),
  'mk-linker': (
    <g {...KS}>
      <g transform="rotate(-24 50 50)">
        <S d="M27 41 L45 41 A9 9 0 0 1 45 59 L27 59 A9 9 0 0 1 27 41 Z" f="#2EFFE0" s="#12A99A" />
        <S d="M55 41 L73 41 A9 9 0 0 1 73 59 L55 59 A9 9 0 0 1 55 41 Z" f="#FF4FA3" s="#C72E7E" />
        <S d="M45 59 A9 9 0 0 0 54 50" f="#2EFFE0" s="#12A99A" />
        <G d="M18 46 A9 9 0 0 1 23 40" w="3" />
        <path d="M86 36 L90 31 M88 45 L94 45" stroke="#FFE94A" strokeWidth="4" />
      </g>
    </g>
  ),
  'mk-shackle': (
    <g {...KS}>
      <S d="M53 61 A16 16 0 1 1 58 46" f="#CFD8E3" s="#8FA0B5" w="8" ink="16" />
      <g fill="none">
        <ellipse cx="68" cy="66" rx="7" ry="4.5" transform="rotate(40 68 66)" strokeWidth="9" />
        <ellipse cx="68" cy="66" rx="7" ry="4.5" transform="rotate(40 68 66)" stroke="#8FA0B5" strokeWidth="3.5" />
        <ellipse cx="78" cy="75" rx="6.5" ry="4" transform="rotate(-30 78 75)" strokeWidth="9" />
        <ellipse cx="78" cy="75" rx="6.5" ry="4" transform="rotate(-30 78 75)" stroke="#8FA0B5" strokeWidth="3.5" />
      </g>
      <path d="M52 44 L64 42 L66 57 L54 59 Z" fill="#5F6F84" />
      <circle cx="59" cy="50" r="2.5" fill={INK} stroke="none" />
      <G d="M25 45 A16 16 0 0 1 32 36" w="3" />
    </g>
  ),
  'mk-wick': (
    <g {...KS}>
      <F d="M36 46 L64 44 L66 79 L34 80 Z" f="#FF4FA3" s="#C72E7E" sd="M56 45 L64 44 L66 79 L57 79 Z" />
      <path d="M46 46 C47 53 50 53 50 58 C50 62 54 62 54 57 L54 45" strokeWidth="3" fill="none" />
      <path d="M50 45 L51 38" strokeWidth="3.5" />
      <path d="M51 39 C42 33 46 22 54 13 C55 22 63 27 57 36 C56 39 53 40 51 39 Z" fill="#FF6B3D" strokeWidth="3.5" />
      <path d="M52 35 C49 32 51 28 53 26 C54 30 57 32 52 35 Z" fill="#FFE94A" stroke="none" />
      <G d="M40 52 L40 66" />
    </g>
  ),
  'mk-matchstick': (
    <g {...KS}>
      <F d="M24 75 L52 38 L60 44 L32 81 Z" f="#C98A4B" s="#8A5A2B" sd="M56 41 L60 44 L32 81 L28 78 Z" />
      <F d={disc(58, 35, 10)} f="#FF4FA3" s="#C72E7E" sd={moon(58, 35, 10)} />
      <path d="M60 26 C56 18 62 12 68 8 C68 16 77 18 70 27 C67 30 63 30 60 26 Z" fill="#FFE94A" strokeWidth="3.5" />
      <path d="M63 25 C61 21 64 18 66 16 C67 20 70 22 66 26 Z" fill="#FF6B3D" stroke="none" />
      <path d="M79 22 L83 20 M80 30 L84 31" stroke="#FF6B3D" strokeWidth="3.5" />
      <G d="M51 33 C51 30 52 28 55 27" w="3.5" />
    </g>
  ),
  'mk-pacer': (
    <g {...KS}>
      <path d="M45 22 L55 22 L55 31 L45 31 Z" fill="#5F6F84" />
      <path d="M68 33 L74 27" strokeWidth="9" />
      <path d="M68 33 L74 27" stroke="#8FA0B5" strokeWidth="3.5" />
      <F d={disc(50, 56, 24)} f="#CFD8E3" s="#8FA0B5" sd={moon(50, 56, 24, 1.25)} />
      <circle cx="50" cy="56" r="16" fill={W} strokeWidth="3.5" />
      <path d="M50 42 L50 45 M64 56 L61 56" strokeWidth="3" />
      <path d="M50 56 L50 46" strokeWidth="4" />
      <path d="M50 56 L59 62" stroke="#FF4FA3" strokeWidth="4" />
      <path d="M10 50 L20 50 M13 61 L22 61" stroke="#2EFFE0" strokeWidth="4" />
      <G d="M31 49 A20 20 0 0 1 39 38" w="3.5" />
    </g>
  ),
  'mk-nitro': (
    <g {...KS}>
      <g transform="rotate(-12 50 52)">
        <path d="M43 19 L53 19 L53 27 L43 27 Z" fill="#5F6F84" />
        <path d="M39 18 L57 18" strokeWidth="5" />
        <F d="M44 26 L52 26 Q62 26 62 36 L62 62 Q62 72 52 72 L44 72 Q34 72 34 62 L34 36 Q34 26 44 26 Z" f="#2EFFE0" s="#12A99A" sd="M54 27 Q62 27 62 36 L62 62 Q62 71 54 71 Z" />
        <path d="M34 44 L62 44 L62 56 L34 56 Z" fill="#FF4FA3" strokeWidth="3.5" />
        <path d="M66 60 L80 56 M66 68 L78 71 M62 76 L70 82" stroke="#FF6B3D" strokeWidth="4" />
        <G d="M40 32 L40 39" />
      </g>
    </g>
  ),
  'mk-detonator': (
    <g {...KS}>
      <path d="M48 52 L48 30" strokeWidth="6" />
      <path d="M34 24 L62 21 L63 30 L35 33 Z" fill="#5F6F84" />
      <F d="M26 50 L72 50 L72 78 L26 78 Z" f="#FF6B3D" s="#D9381E" sd="M60 50 L72 50 L72 78 L60 78 Z" />
      <path d="M34 66 L54 66" stroke="#FFE94A" strokeWidth="5" />
      <path d="M72 70 C80 70 81 77 87 75" strokeWidth="7" fill="none" />
      <path d="M72 70 C80 70 81 77 87 75" stroke="#FF4FA3" strokeWidth="3" fill="none" />
      <G d="M32 56 L42 56" />
    </g>
  ),
  'mk-cyclone': (
    <g {...KS}>
      <F d="M18 28 C34 20 68 20 84 28 C82 36 74 40 68 42 C70 48 64 54 58 56 C60 62 56 68 52 70 C54 74 52 78 48 82 C46 76 44 72 44 68 C40 64 38 60 38 56 C32 52 30 48 30 44 C24 40 18 34 18 28 Z" f="#2EFFE0" s="#12A99A" sd="M66 23 C74 24 80 26 84 28 C82 36 74 40 68 42 C70 48 64 54 58 56 C60 62 56 68 52 70 C54 74 52 78 48 82 C52 72 58 58 66 23 Z" />
      <path d="M24 36 C42 32 62 32 78 34 M33 46 C44 44 56 44 66 45 M42 58 C47 57 52 57 56 58" strokeWidth="3" fill="none" />
      <path d="M14 62 L21 57 L25 64 L18 68 Z" fill="#8FA0B5" strokeWidth="3" />
      <G d="M27 30 L37 27" w="3.5" />
    </g>
  ),
  'mk-scholar': (
    <g {...KS}>
      <path d="M32 46 L32 62 C40 70 60 70 68 62 L68 46 L50 54 Z" fill="#4A0D8A" />
      <F d="M48 24 L82 37 L52 51 L18 39 Z" f="#9A1AFF" s="#6A0FC0" sd="M50 38 L82 37 L52 51 Z" />
      <path d="M50 37 L78 38 L78 56" strokeWidth="3.5" fill="none" />
      <circle cx="50" cy="37" r="3.5" fill="#FFE94A" strokeWidth="3" />
      <path d="M74 55 L82 55 L84 66 L72 66 Z" fill="#FFE94A" strokeWidth="3.5" />
      <G d="M29 38 L46 30" w="3.5" />
    </g>
  ),
  'mk-ouroboros': (
    <g {...KS}>
      <S d="M62 30 C45 21 24 32 26 52 C28 72 52 80 66 68 C74 60 74 47 69 40" f="#2EFFE0" s="#12A99A" w="7" ink="16" />
      <F d="M61 43 C56 34 61 22 71 21 C80 21 84 30 80 37 C77 42 70 45 61 43 Z" f="#2EFFE0" s="#12A99A" sd="M82 31 C82 38 76 44 64 44 C72 41 79 37 82 31 Z" />
      <path d="M60 32 L70 34" strokeWidth="3" />
      <circle cx="73" cy="28" r="2.5" fill={INK} stroke="none" />
      <path d="M83 44 C80 49 80 52 83 53 C86 52 86 49 83 44 Z" fill="#FF4FA3" strokeWidth="2.5" />
      <G d="M26 38 C28 33 31 30 35 28" w="3" />
    </g>
  ),
  'mk-tinder': (
    <g {...KS}>
      <F d="M24 64 L34 44 L54 38 L68 48 L64 70 L40 76 Z" f="#8FA0B5" s="#5F6F84" sd="M44 58 L68 48 L64 70 L40 76 Z" />
      <path d="M34 44 L44 58 L68 48" strokeWidth="3" fill="none" />
      <path d="M64 31 L68 39 M72 25 L74 34 M81 37 L73 42" stroke="#FFE94A" strokeWidth="4" />
      <circle cx="58" cy="31" r="3" fill="#FF6B3D" strokeWidth="2.5" />
      <G d="M31 56 L37 48" w="3.5" />
    </g>
  ),
  'mk-slipstream': (
    <g {...KS}>
      <S d="M20 36 L58 36 C69 36 71 26 63 24 M28 52 L73 52 C83 52 83 66 73 64 M22 68 L51 68" f="#2EFFE0" s="#12A99A" w="5" ink="12" />
      <path d="M75 32 C78 27 83 28 82 32 C81 36 76 36 75 32 Z" fill="#FF4FA3" strokeWidth="2.5" />
      <G d="M22 34 L32 34" w="2.5" />
    </g>
  ),
  'mk-smith': (
    <g {...KS}>
      <F d="M20 46 L70 46 C76 46 80 42 86 42 C84 52 76 56 64 56 L60 56 L62 64 L70 68 L70 76 L30 76 L30 68 L38 64 L40 56 L30 56 C24 56 20 52 20 46 Z" f="#8FA0B5" s="#5F6F84" sd="M50 56 L60 56 L62 64 L70 68 L70 76 L50 76 Z" />
      <path d="M30 37 L50 37 L50 46 L30 46 Z" fill="#FF6B3D" strokeWidth="3.5" />
      <path d="M61 27 L77 12" strokeWidth="8" />
      <path d="M61 27 L77 12" stroke="#C98A4B" strokeWidth="3.5" />
      <path d="M50 22 L61 16 L68 28 L57 34 Z" fill="#5F6F84" />
      <path d="M28 33 L22 27 M34 31 L32 23 M21 39 L14 37" stroke="#FFE94A" strokeWidth="3.5" />
      <G d="M24 51 L30 51" w="3.5" />
    </g>
  ),
  'mk-phoenix': (
    <g {...KS}>
      <F d="M50 80 C42 74 40 66 44 58 C34 58 24 50 18 36 C30 40 38 42 44 46 C42 38 46 28 54 22 C56 30 56 36 54 44 C60 38 70 30 84 28 C80 40 70 50 58 56 C62 64 58 72 50 80 Z" f="#FF6B3D" s="#D9381E" sd="M84 28 C80 40 70 50 58 56 C62 64 58 72 50 80 C54 70 56 60 58 52 C66 46 76 38 84 28 Z" />
      <path d="M50 74 C45 68 45 62 48 56 C50 60 53 60 54 56 C57 62 55 68 50 74 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M50 27 L43 29 L50 32 Z" fill="#FFE94A" strokeWidth="2.5" />
      <circle cx="53" cy="29" r="2" fill={INK} stroke="none" />
      <path d="M30 18 L33 22 L30 26 L27 22 Z" fill="#FFE94A" strokeWidth="2.5" />
      <G d="M26 43 C32 46 36 47 40 50" w="3" />
    </g>
  ),
  'mk-metronome': (
    <g {...KS}>
      <F d="M38 22 L62 22 L74 78 L26 78 Z" f="#FF4FA3" s="#C72E7E" sd="M56 22 L62 22 L74 78 L60 78 Z" />
      <path d="M45 31 L55 31 L62 66 L38 66 Z" fill="#CFD8E3" strokeWidth="3.5" />
      <path d="M50 70 L64 30" strokeWidth="4" />
      <path d="M53 42 L63 42 L63 49 L53 49 Z" fill="#FFE94A" strokeWidth="3" />
      <path d="M22 76 L78 76 L78 83 L22 83 Z" fill="#5F6F84" />
      <path d="M71 24 C75 28 77 32 77 37 M78 18 C82 23 84 28 84 33" stroke="#2EFFE0" strokeWidth="3.5" fill="none" />
      <G d="M40 29 L37 42" w="3" />
    </g>
  ),
  'mk-pyro': (
    <g {...KS}>
      <path d="M50 34 C50 28 54 26 56 22" strokeWidth="3.5" fill="none" />
      <g transform="rotate(-10 36 55)">
        <F d="M30 38 L42 38 L42 72 L30 72 Z" f="#FF4FA3" s="#C72E7E" sd="M37 38 L42 38 L42 72 L37 72 Z" />
        <G d="M34 43 L34 51" w="3" />
      </g>
      <g transform="rotate(10 64 55)">
        <F d="M58 38 L70 38 L70 72 L58 72 Z" f="#FFE94A" s="#F2A900" sd="M65 38 L70 38 L70 72 L65 72 Z" />
      </g>
      <F d="M44 34 L56 34 L56 72 L44 72 Z" f="#FF6B3D" s="#D9381E" sd="M51 34 L56 34 L56 72 L51 72 Z" />
      <path d="M29 58 L71 58" strokeWidth="8" />
      <path d="M29 58 L71 58" stroke="#8FA0B5" strokeWidth="3" />
      <path d="M58 12 L60 18 L66 16 L62 21 L67 25 L61 25 L59 30 L56 25 L51 26 L54 21 L52 16 L57 18 Z" fill="#FFE94A" strokeWidth="2.5" />
    </g>
  ),
  'mk-nova': (
    <g {...KS}>
      <g strokeWidth="4"><F d="M56 18 L59 37 L70 36 L66 47 L84 56 L63 59 L63 69 L53 66 L45 81 L41 63 L30 64 L34 53 L15 44 L37 41 L37 31 L47 34 Z" f="#FFE94A" s="#F2A900" sd="M50 50 L66 47 L84 56 L63 59 L63 69 L53 66 L45 81 Z" /></g>
      <circle cx="50" cy="50" r="8" fill="#2EFFE0" strokeWidth="3.5" />
      <path d="M74 25 L80 19 M82 33 L88 31" stroke="#FF4FA3" strokeWidth="4" />
      <G d="M54 25 L53 31" w="3" />
    </g>
  ),
  'mk-golem': (
    <g {...KS}>
      <F d="M30 30 L68 26 L76 62 L58 78 L34 76 L24 52 Z" f="#CFD8E3" s="#8FA0B5" sd="M68 26 L76 62 L58 78 L48 77 L62 60 Z" />
      <path d="M34 41 L50 39 M56 38 L68 36" strokeWidth="4.5" />
      <path d="M37 46 L47 45 L47 51 L38 52 Z M57 44 L66 43 L67 49 L58 50 Z" fill="#2EFFE0" strokeWidth="3" />
      <path d="M40 64 L60 62" />
      <path d="M48 28 L45 34 L49 38" strokeWidth="3" fill="none" />
      <G d="M31 37 L28 48" w="3.5" />
    </g>
  ),
  'mk-leviathan': (
    <g {...KS}>
      <path d="M37 52 L27 48 L37 42 Z M42 38 L34 30 L46 30 Z" fill="#FF4FA3" strokeWidth="3.5" />
      <F d="M36 66 C34 46 44 26 62 24 C70 24 76 30 72 36 L60 38 C54 42 52 52 54 66 Z" f="#9A1AFF" s="#6A0FC0" sd="M60 38 C54 42 52 52 54 66 L47 66 C47 54 50 43 60 38 Z" />
      <circle cx="64" cy="30" r="3" fill="#FFE94A" strokeWidth="2.5" />
      <F d="M16 70 C26 62 32 74 42 66 C52 58 58 72 68 64 C74 60 80 64 86 62 L86 80 L16 80 Z" f="#2EFFE0" s="#12A99A" sd="M54 80 C64 74 76 72 86 70 L86 80 Z" />
      <path d="M80 46 C78 50 78 52 80 53 C82 52 82 50 80 46 Z" fill="#2EFFE0" strokeWidth="2.5" />
      <G d="M41 48 C42 42 45 36 49 32" w="3.5" />
    </g>
  ),
  'mk-eclipse': (
    <g {...KS}>
      <circle cx="46" cy="54" r="24" fill="#FFE94A" />
      <F d={disc(56, 49, 21)} f="#3B2D5C" s="#1F1438" sd={moon(56, 49, 21)} />
      <path d="M14 36 L20 40 M10 56 L17 56 M16 76 L21 71" stroke="#FFE94A" strokeWidth="4" />
      <G d="M27 50 C27 45 30 41 33 38" />
    </g>
  ),
  'mk-singularity': (
    <g {...KS}>
      <g transform="rotate(-14 50 52)">
        <path d="M16 52 A34 11 0 0 1 84 52" strokeWidth="11" fill="none" />
        <path d="M16 52 A34 11 0 0 1 84 52" stroke="#FF6B3D" strokeWidth="5" fill="none" />
      </g>
      <circle cx="49" cy="51" r="15" fill={INK} stroke="#FFE94A" strokeWidth="3" />
      <g transform="rotate(-14 50 52)">
        <path d="M16 52 A34 11 0 0 0 84 52" strokeWidth="12" fill="none" />
        <path d="M16 52 A34 11 0 0 0 84 52" stroke="#D9381E" strokeWidth="5" fill="none" />
        <path d="M16 52 A34 11 0 0 0 84 52" stroke="#FF6B3D" strokeWidth="5" fill="none" transform="translate(-1 -1.5)" />
        <G d="M22 47 A34 11 0 0 1 32 43" w="2.5" />
      </g>
      <path d="M75 32 L79 28 M81 42 L86 41" stroke="#FFE94A" strokeWidth="3.5" />
    </g>
  ),
  'mk-kraken': (
    <g {...KS}>
      <path d="M36 51 C24 64 22 66 20 74 C30 72 34 66 42 56 Z M46 53 C44 64 40 70 43 80 C49 74 51 64 53 55 Z M58 53 C61 64 66 70 75 71 C70 63 67 58 65 51 Z" fill="#C72E7E" strokeWidth="3.5" />
      <path d="M64 46 C76 44 82 36 78 28 C76 24 71 26 73 30 C75 34 72 40 62 40 Z" fill="#FF4FA3" strokeWidth="3.5" />
      <F d="M32 54 C28 30 70 24 68 52 C60 56 40 58 32 54 Z" f="#FF4FA3" s="#C72E7E" sd="M58 30 C66 34 70 42 68 52 C62 55 54 56 48 56 C58 50 62 42 58 30 Z" />
      <circle cx="44" cy="44" r="4.5" fill={W} strokeWidth="3" />
      <circle cx="57" cy="43" r="3.5" fill={W} strokeWidth="3" />
      <path d="M45 45 h0.1 M58 44 h0.1" strokeWidth="3.5" />
      <G d="M36 44 C36 38 39 34 44 31" w="3.5" />
    </g>
  ),
  'mk-origin': (
    <g {...KS}>
      <F d="M50 16 C64 36 74 50 70 64 C66 78 36 80 31 64 C27 52 38 36 50 16 Z" f="#2EFFE0" s="#12A99A" sd="M64 42 C70 52 72 58 70 64 C67 75 52 79 42 77 C58 73 66 60 64 42 Z" />
      <path d="M50 44 L54 54 L64 55 L56 61 L59 71 L50 65 L42 70 L44 61 L37 55 L47 54 Z" fill="#FFE94A" strokeWidth="3" />
      <path d="M77 64 C73 70 73 74 77 76 C81 74 81 70 77 64 Z" fill="#2EFFE0" strokeWidth="2.5" />
      <G d="M38 48 C40 42 43 36 47 30" />
    </g>
  ),
  // ---- the 6 PERMANENT marks (finished by markGlyphFinish.jsx) ----
  'mk-ironhand': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M30 44 C30 36 40 34 42 40 C44 32 54 32 55 40 C58 33 67 34 67 42 C72 40 76 46 74 54 L70 70 L36 72 C30 64 28 54 30 44 Z" fill="#CFD8E3" />
      <path d="M42 40 L43 52 M55 40 L55 51 M67 42 L66 52" strokeWidth="2.5" fill="none" />
      <rect x="36" y="70" width="34" height="10" rx="2" fill="#5F6F84" />
    </g>
  ),
  'mk-marathon': (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M24 80 C38 66 64 70 54 56 C46 44 58 38 62 32" fill="none" stroke={INK} strokeWidth="13" />
      <path d="M24 80 C38 66 64 70 54 56 C46 44 58 38 62 32" fill="none" stroke="#FFE94A" strokeWidth="3" strokeDasharray="5 5" />
      <path d="M62 34 L62 18" stroke={INK} strokeWidth="3.5" />
      <path d="M62 18 L77 21 L71 25 L77 29 L62 28 Z" fill="#FF4FA3" stroke={INK} strokeWidth="3" />
    </g>
  ),
  'mk-blaze': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M52 20 C60 32 74 40 70 58 C67 72 56 78 46 78 C34 76 26 64 30 52 C32 44 38 42 40 36 C44 42 46 44 48 40 C50 34 48 26 52 20 Z" fill="#FF4FA3" />
      <path d="M48 76 C40 72 38 62 44 56 C46 60 50 60 52 56 C58 60 60 70 54 75 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M16 46 L24 46 M14 58 L24 58" stroke="#FF6B3D" strokeWidth="4" />
    </g>
  ),
  'mk-ritual': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="26" y="30" width="48" height="44" rx="4" fill="#fff" transform="rotate(4 50 52)" />
      <path d="M27 40 L73 43" stroke="#FF6B3D" strokeWidth="8" />
      <path d="M36 26 L36 34 M62 28 L62 36" strokeWidth="4" />
      <path d="M36 56 L41 61 L50 50 M52 63 L56 67 L64 57" stroke="#9A1AFF" strokeWidth="4" fill="none" />
    </g>
  ),
  'mk-grandmaster': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M48 18 L52 18 L52 22 L56 22 L56 26 L52 26 L52 30 L48 30 L48 26 L44 26 L44 22 L48 22 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M40 34 L60 32 L56 56 L44 56 Z" fill="#9A1AFF" />
      <path d="M38 56 L62 56 L66 70 L34 72 Z" fill="#9A1AFF" />
      <rect x="30" y="70" width="40" height="8" rx="2" fill="#5c0fa3" transform="rotate(-3 50 74)" />
    </g>
  ),
  'mk-omega': (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M29 74 L42 74 L42 66 C30 60 28 44 36 36 C44 28 58 28 66 36 C74 44 72 60 60 66 L60 74 L73 73" stroke={INK} strokeWidth="12" />
      <path d="M29 74 L42 74 L42 66 C30 60 28 44 36 36 C44 28 58 28 66 36 C74 44 72 60 60 66 L60 74 L73 73" stroke="#FF6B3D" strokeWidth="5" />
    </g>
  ),
};
