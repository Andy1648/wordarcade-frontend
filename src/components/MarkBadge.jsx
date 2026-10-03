// MarkBadge — STEP 21 / Andy A3: marks get real art. Each mark is a drawn SVG glyph (no emoji) set in
// a badge whose RIM shows the mark's rank: I bronze → II silver → III gold → IV cyan → V pink with a
// star crown. ART VS MOTION: every shape here is vector art; CSS only animates it.
//
// STEP 21 compared three frames (claude/step21/marks-{coin,pin,patch}-*.png): the COIN shipped — a
// notched medallion reads as a thing you EARNED and shows the rank colour on the most surface; the
// shield pin and stitched patch read as UI chrome. The other two frames are kept as variants.
import { memo } from 'react';

// Rank rims: flat fill + darker outline shade (house rule: coloured outlines, not black).
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
// A rolled mark's FINISH replaces the rank rim: GOLD (10 dupes) and RAINBOW (10 golds). Flat fills only —
// the rainbow is the house palette in hard-edged teeth, never a gradient.
const GOLD_RIM = { fill: '#FFD54A', line: '#A8800F' };
const RAINBOW_TEETH = [
  { fill: '#FF4FA3', line: '#A3175E' },
  { fill: '#FF6B3D', line: '#A63A12' },
  { fill: '#FFE94A', line: '#A8800F' },
  { fill: '#2EFFE0', line: '#0F8F7E' },
  { fill: '#9A1AFF', line: '#5c0fa3' },
];
const PERM_RIM = { fill: '#9A1AFF', line: '#5c0fa3' };
const LOCK = (
  <g stroke="#6b5a86" strokeWidth="4" strokeLinejoin="round" fill="none">
    <path d="M38 48 L38 40 C38 30 62 30 62 40 L62 48" />
    <rect x="32" y="48" width="36" height="26" rx="4" fill="#2a1648" />
    <circle cx="50" cy="60" r="3.5" fill="#6b5a86" stroke="none" />
  </g>
);

function Frame({ variant, rim, locked, finish, permanent }) {
  const fill = locked ? '#1a0b2e' : '#2a1648';
  const ring = locked ? { fill: '#3d3150', line: '#241a33' } : rim;
  if (permanent) {
    // PERMANENT frame (spec §2): a ten-point burst, not the coin — earned, never rolled. Uneven points.
    const pts = [];
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? (i % 4 === 0 ? 49 : 46) : 37;
      pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
    }
    const p = locked ? ring : PERM_RIM;
    return (
      <g>
        <polygon points={pts.join(' ')} transform="translate(4,4)" fill="#000" />
        <polygon points={pts.join(' ')} fill={p.fill} stroke={p.line} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="32" fill={fill} stroke={p.line} strokeWidth="2.5" />
      </g>
    );
  }
  if (variant === 'pin') {
    // enamel PIN: a shield, metal rim, enamel field
    return (
      <g>
        <path d="M50 6 L88 18 L84 58 C80 78 64 90 50 96 C36 90 20 78 16 58 L12 18 Z" transform="translate(4,4)" fill="#000" />
        <path d="M50 6 L88 18 L84 58 C80 78 64 90 50 96 C36 90 20 78 16 58 L12 18 Z" fill={ring.fill} stroke={ring.line} strokeWidth="4" strokeLinejoin="round" />
        <path d="M50 16 L78 25 L75 57 C72 72 60 81 50 86 C40 81 28 72 25 57 L22 25 Z" fill={fill} stroke={ring.line} strokeWidth="2.5" />
      </g>
    );
  }
  if (variant === 'patch') {
    // stitched PATCH: an uneven hexagon with a dashed stitch line
    return (
      <g>
        <path d="M50 5 L90 27 L89 73 L50 95 L10 72 L11 27 Z" transform="translate(4,4)" fill="#000" />
        <path d="M50 5 L90 27 L89 73 L50 95 L10 72 L11 27 Z" fill={ring.fill} stroke={ring.line} strokeWidth="4" strokeLinejoin="round" />
        <path d="M50 15 L81 32 L80 68 L50 85 L19 67 L20 32 Z" fill={fill} />
        <path d="M50 11 L85 30 L84 70 L50 89 L15 69 L16 30 Z" fill="none" stroke={ring.line} strokeWidth="2" strokeDasharray="5 4" />
      </g>
    );
  }
  // COIN (default): a medallion with a notched rim
  const body = !locked && finish === 'gold' ? GOLD_RIM : !locked && finish === 'rainbow' ? RAINBOW_TEETH[2] : ring;
  const teeth = [];
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const x = 50 + Math.cos(a) * 46;
    const y = 50 + Math.sin(a) * 46;
    const t = !locked && finish === 'rainbow' ? RAINBOW_TEETH[i % RAINBOW_TEETH.length] : body;
    teeth.push(<circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={finish === 'rainbow' && !locked ? '6' : '5'} fill={t.fill} stroke={t.line} strokeWidth="2.5" />);
  }
  return (
    <g>
      <circle cx="54" cy="54" r="46" fill="#000" />
      {teeth}
      <circle cx="50" cy="50" r="43" fill={body.fill} stroke={body.line} strokeWidth="4" />
      <circle cx="50" cy="50" r="33" fill={fill} stroke={ring.line} strokeWidth="2.5" />
    </g>
  );
}

function Crown() {
  return <path d="M34 4 L39 -8 L45 1 L50 -11 L55 1 L61 -8 L66 4 Z" fill="#FFE94A" stroke="#000" strokeWidth="3" strokeLinejoin="round" />;
}

/**
 * @param mark     a MARKS entry (or null for an empty slot)
 * @param rank     1..5
 * @param locked   draws the lock in a dead frame
 * @param size     px
 * @param variant  'coin' | 'pin' | 'patch'
 * @param finish   'base' | 'gold' | 'rainbow' — a rolled mark's dupe finish (replaces the rank rim)
 * @param permanent  draws the PERMANENT burst frame (hard-achievement marks)
 */
function MarkBadge({ mark, rank = 1, locked = false, size = 56, variant = 'coin', className = '', finish = 'base', permanent = false }) {
  const r = Math.max(1, Math.min(5, rank || 1));
  const rim = RANK_RIMS[r - 1];
  const glyph = !mark || locked ? LOCK : GLYPHS[mark.id] || null;
  return (
    <svg
      className={`mark-badge v-${variant}${locked ? ' is-locked' : ''}${finish !== 'base' ? ` is-${finish}` : ''}${permanent ? ' is-permanent' : ''} ${className}`}
      viewBox="-6 -14 112 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <Frame variant={variant} rim={rim} locked={locked || !mark} finish={finish} permanent={permanent} />
      <g transform="translate(50 50) scale(1.18) translate(-50 -50)">{glyph}</g>
      {!locked && mark && r >= 5 && <Crown />}
    </svg>
  );
}

export default memo(MarkBadge);
