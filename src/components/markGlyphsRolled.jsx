// markGlyphsRolled.jsx — the 26 MARK ROLLS glyphs (20 rolled + 6 permanent, spec §12), split out of
// MarkBadge.jsx so they load with the MARKS panel, not on the menu's first paint (payload ratchet, PR #156).
// MarkBadge registers them on demand: MarksIndex imports this module, and a badge for an id it can't draw
// yet (the menu chip of a worn ROLLED mark) loads it once and re-draws. Same hand as the base glyphs:
// chunky ink, flat fills, nothing centred or mirrored.
export { GLYPH_FINISH } from './markGlyphFinish.jsx';

const INK = '#0d0618';

export const ROLLED_GLYPHS = {
  // ---- MARK ROLLS (spec §12): the 20 rolled + 6 permanent ids. Same hand: chunky ink, flat fills,
  // nothing centred or mirrored — every one leans, drips or trails off one side. ----
  'mk-sparky': (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M27 74 C35 62 47 68 50 57 C53 47 44 42 51 35" stroke={INK} strokeWidth="7" fill="none" />
      <path d="M27 74 C35 62 47 68 50 57 C53 47 44 42 51 35" stroke="#C98A4B" strokeWidth="3" fill="none" />
      <path d="M55 19 L60 29 L71 24 L64 34 L74 41 L62 41 L60 52 L54 42 L44 45 L50 35 L42 27 L53 29 Z" fill="#FFE94A" stroke={INK} strokeWidth="3" />
      <circle cx="56" cy="35" r="4" fill="#FF6B3D" />
      <path d="M76 53 L80 57 M70 59 L71 64" stroke="#FF6B3D" strokeWidth="3" fill="none" />
    </g>
  ),
  'mk-dasher': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 40 L45 38 L51 50 L70 54 C78 56 80 62 78 66 L34 68 C30 60 30 48 32 40 Z" fill="#FF4FA3" />
      <path d="M34 68 L78 66 L77 72 L35 74 Z" fill="#fff" />
      <path d="M45 46 L51 44 M47 52 L54 50" strokeWidth="2.5" fill="none" />
      <path d="M14 48 L25 48 M10 58 L25 57 M17 67 L26 66" stroke="#2EFFE0" strokeWidth="4" fill="none" />
    </g>
  ),
  'mk-crammer': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M30 40 L38 27 L46 36 L57 24 L62 34 L73 30 L69 42 Z" fill="#fff" />
      <rect x="26" y="40" width="48" height="32" rx="3" fill="#9A1AFF" transform="rotate(-4 50 56)" />
      <path d="M28 64 L74 61" stroke="#fff" strokeWidth="3" />
      <path d="M36 49 L57 47" stroke="#FFE94A" strokeWidth="3" />
    </g>
  ),
  'mk-inkwell': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M24 70 C30 64 44 66 54 70 C64 74 76 70 80 74 C76 80 64 78 56 80 C46 82 30 80 24 70 Z" fill="#9A1AFF" />
      <path d="M30 46 L51 34 L62 53 L41 65 Z" fill="#2a1648" />
      <path d="M51 34 L57 29 L67 46 L62 53 Z" fill="#5F6F84" />
      <path d="M62 62 C64 66 66 70 64 73" stroke="#9A1AFF" strokeWidth="5" fill="none" />
      <circle cx="71" cy="62" r="3" fill="#9A1AFF" />
    </g>
  ),
  'mk-shackle': (
    <g fill="none" strokeLinecap="round">
      <path d="M40 66 C24 64 22 40 38 34 C50 30 60 38 58 50" stroke={INK} strokeWidth="12" />
      <path d="M40 66 C24 64 22 40 38 34 C50 30 60 38 58 50" stroke="#CFD8E3" strokeWidth="6" />
      <rect x="56" y="54" width="20" height="12" rx="6" transform="rotate(30 66 60)" stroke={INK} strokeWidth="9" />
      <rect x="56" y="54" width="20" height="12" rx="6" transform="rotate(30 66 60)" stroke="#5F6F84" strokeWidth="4" />
      <circle cx="40" cy="66" r="5" fill={INK} />
    </g>
  ),
  'mk-wick': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M36 48 L64 46 L66 76 L34 77 Z" fill="#fff" />
      <path d="M36 48 C38 56 42 54 42 62 C42 66 46 66 46 60 L46 48" fill="#EDE6FF" strokeWidth="2.5" />
      <path d="M50 47 L51 39" strokeWidth="3" />
      <path d="M51 39 C42 33 48 23 53 17 C54 25 62 29 56 38 C55 40 53 40 51 39 Z" fill="#FF6B3D" />
      <path d="M52 35 C49 32 51 28 53 26 C54 30 57 32 52 35 Z" fill="#FFE94A" strokeWidth="2" />
    </g>
  ),
  'mk-matchstick': (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M30 76 L59 39" stroke={INK} strokeWidth="11" />
      <path d="M30 76 L59 39" stroke="#C98A4B" strokeWidth="5" />
      <ellipse cx="61" cy="36" rx="8" ry="10" transform="rotate(38 61 36)" fill="#FF4FA3" stroke={INK} strokeWidth="3.5" />
      <path d="M66 27 C62 20 67 15 72 11 C72 19 80 21 74 29 Z" fill="#FFE94A" stroke={INK} strokeWidth="3" />
    </g>
  ),
  'mk-pacer': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="44" y="20" width="12" height="8" rx="2" fill="#5F6F84" />
      <path d="M67 30 L73 24" strokeWidth="5" />
      <circle cx="50" cy="55" r="23" fill="#fff" />
      <path d="M50 55 L50 39" strokeWidth="4" />
      <path d="M50 55 L62 62" stroke="#FF4FA3" strokeWidth="4" />
      <path d="M50 33 L50 37 M73 55 L69 55 M27 55 L31 55" strokeWidth="3" />
    </g>
  ),
  'mk-nitro': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="34" y="30" width="28" height="44" rx="10" fill="#2EFFE0" transform="rotate(-10 48 52)" />
      <path d="M40 27 L52 25 L53 19 L42 21 Z" fill="#5F6F84" />
      <path d="M37 49 L60 45" stroke="#fff" strokeWidth="5" />
      <path d="M66 60 L80 56 M66 68 L78 70 M63 76 L71 81" stroke="#FF6B3D" strokeWidth="4" />
    </g>
  ),
  'mk-detonator': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="28" y="50" width="44" height="26" rx="3" fill="#FF6B3D" />
      <path d="M48 50 L48 31" strokeWidth="6" />
      <rect x="34" y="23" width="30" height="9" rx="3" fill="#5F6F84" transform="rotate(-6 49 27)" />
      <path d="M34 62 L44 62 M56 62 L66 62" stroke="#FFE94A" strokeWidth="4" />
      <path d="M72 70 C80 70 81 77 86 76" fill="none" strokeWidth="3" />
    </g>
  ),
  'mk-cyclone': (
    <g fill="none" strokeLinecap="round">
      <path d="M22 32 C40 24 68 25 78 33 M28 45 C42 39 63 39 72 45 M36 57 C46 53 59 54 66 58 M46 68 C51 65 57 66 60 70 M54 78 L57 80" stroke={INK} strokeWidth="9" />
      <path d="M22 32 C40 24 68 25 78 33 M28 45 C42 39 63 39 72 45 M36 57 C46 53 59 54 66 58 M46 68 C51 65 57 66 60 70 M54 78 L57 80" stroke="#2EFFE0" strokeWidth="4" />
    </g>
  ),
  'mk-ouroboros': (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M62 30 C45 21 24 32 26 52 C28 72 52 80 66 68 C74 60 74 47 69 40" fill="none" stroke={INK} strokeWidth="13" />
      <path d="M62 30 C45 21 24 32 26 52 C28 72 52 80 66 68 C74 60 74 47 69 40" fill="none" stroke="#2EFFE0" strokeWidth="6" />
      <path d="M58 23 L74 27 L72 40 L61 36 Z" fill="#2EFFE0" stroke={INK} strokeWidth="3.5" />
      <circle cx="68" cy="30" r="2.5" fill={INK} />
    </g>
  ),
  'mk-tinder': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M26 62 L36 44 L54 40 L66 50 L62 68 L40 74 Z" fill="#5F6F84" />
      <path d="M36 44 L44 56 L66 50" fill="none" strokeWidth="2.5" />
      <path d="M64 31 L68 39 M72 26 L74 34 M79 38 L73 42" stroke="#FFE94A" strokeWidth="4" />
      <circle cx="58" cy="34" r="3" fill="#FF6B3D" />
    </g>
  ),
  'mk-slipstream': (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 36 L58 36 C69 36 71 26 63 24 M28 52 L73 52 C83 52 83 66 73 64 M22 68 L51 68" stroke={INK} strokeWidth="9" />
      <path d="M20 36 L58 36 C69 36 71 26 63 24 M28 52 L73 52 C83 52 83 66 73 64 M22 68 L51 68" stroke="#EDE6FF" strokeWidth="4" />
    </g>
  ),
  'mk-kraken': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M36 51 C24 64 22 66 20 74 C30 72 34 66 42 56 M46 53 C44 64 40 70 43 80 C49 74 51 64 53 55 M58 53 C61 64 66 70 75 71 C70 63 67 58 65 51" fill="#FF4FA3" />
      <path d="M33 52 C29 30 71 26 68 51 Z" fill="#FF4FA3" />
      <circle cx="46" cy="42" r="4" fill="#fff" />
      <circle cx="58" cy="41" r="3" fill="#fff" />
    </g>
  ),
  'mk-golem': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M30 32 L68 28 L74 64 L56 76 L34 74 L26 52 Z" fill="#CFD8E3" />
      <path d="M38 46 L48 46 L47 52 L38 52 Z M56 45 L66 44 L66 50 L57 51 Z" fill="#2EFFE0" />
      <path d="M40 64 L60 62" strokeWidth="4" />
      <path d="M30 32 L40 40 M68 28 L60 37" strokeWidth="2.5" fill="none" />
    </g>
  ),
  'mk-eclipse': (
    <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
      <circle cx="47" cy="53" r="24" fill="#FFE94A" />
      <circle cx="56" cy="48" r="22" fill="#2a1648" />
      <path d="M23 31 L29 35 M19 55 L25 55 M27 75 L31 71" stroke="#FFE94A" strokeWidth="4" />
    </g>
  ),
  'mk-leviathan': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M18 70 C28 62 34 74 44 66 C54 58 60 72 70 64 C76 60 80 64 84 62 L84 78 L18 78 Z" fill="#2EFFE0" />
      <path d="M36 63 C34 44 44 26 62 24 C70 24 74 30 70 34 L58 36 C52 40 50 50 52 63 Z" fill="#9A1AFF" />
      <circle cx="64" cy="29" r="2.5" fill="#FFE94A" />
      <path d="M44 41 L36 37 M46 49 L38 47" strokeWidth="3" />
    </g>
  ),
  'mk-singularity': (
    <g>
      <ellipse cx="50" cy="52" rx="32" ry="11" transform="rotate(-14 50 52)" fill="none" stroke={INK} strokeWidth="11" />
      <ellipse cx="50" cy="52" rx="32" ry="11" transform="rotate(-14 50 52)" fill="none" stroke="#FF6B3D" strokeWidth="5" />
      <circle cx="49" cy="51" r="15" fill={INK} stroke="#FFE94A" strokeWidth="3" />
      <path d="M74 34 L78 30 M80 42 L85 41" stroke="#FFE94A" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  ),
  'mk-origin': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M50 18 C64 38 74 50 70 64 C66 78 36 80 31 64 C27 52 38 38 50 18 Z" fill="#fff" />
      <path d="M50 46 L54 56 L64 57 L56 63 L59 73 L50 67 L42 72 L44 63 L37 57 L47 56 Z" fill="#FF6B3D" strokeWidth="2.5" />
      <path d="M36 30 L33 26" stroke="#FFE94A" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
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
